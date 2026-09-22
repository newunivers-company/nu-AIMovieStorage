# -*- coding: utf-8 -*-
"""디테일 생성 (실험) — VOSR 2.0 (cswry/VOSR, 커밋 516f292 고정).

**서브프로세스 방식**입니다(SeedVR2 처럼 상주가 아님). 이유:
저장소의 `inference_vosr_onestep.py` 는 `torch.hub.set_dir('preset/ckpts/torch_cache')`,
`ae_path: "preset/ckpts/Qwen-Image-vae-2d"` 처럼 **현재 폴더 기준 상대 경로**를 여러 군데
박아 두었고, 모델을 올리는 부분이 `main()` 안에 통째로 들어 있어 함수만 떼어 쓰기 어렵습니다.
그래서 엔진 폴더를 현재 폴더로 삼아 CLI 를 그대로 부릅니다 — 매번 모델을 다시 올리니
1.4B 라도 한 장에 수십 초가 더 붙습니다. «실험» 배지를 단 이유이기도 합니다.

폴더 약속: 가중치는 `<engines/vosr>/preset/ckpts/` 아래에 그대로 놓습니다
(`VOSR2/`, `Qwen-Image-vae-2d/`, `torch_cache/`). 그래야 저장소가 박아 둔 상대 경로가 맞습니다.

목표 크기: CLI 는 정수 배율(`-u`)만 받습니다. 필요한 배율을 올림해서 넘기고
마지막에 worker 가 Lanczos 로 정확히 맞춥니다.

자식을 띄울 때의 함정 둘(2026-09-09 에 실제로 겪은 것 — 자세한 이유는 아래 주석):
`stdin=DEVNULL` 이 없으면 자식이 무언가를 물을 때 답을 못 받고 영원히 기다리고,
`TORCHDYNAMO_DISABLE=1` 이 없으면 triton 이 없어 CLI 가 종료코드 0 으로 조용히 끝납니다.
둘 다 지우지 마세요.
"""

import os
import re
import glob
import math
import shutil
import subprocess
import sys
import tempfile
import time
from collections import deque

import common

"""
왜 자식 핸들을 전역에 들고 있나(2026-09-09 지적):

이 엔진이 `Popen` 으로 띄우는 VOSR CLI 는 **Rust 가 모르는 손자 프로세스**입니다.
`ask()` 가 시간을 초과하거나 앱이 꺼지면 Rust 는 워커 파이썬만 자식 핸들로 끊는데,
그러면 손자는 부모를 잃은 채 5.6 GB 가중치와 VRAM 을 계속 붙잡고 있었습니다
(그 상태로 앱을 다시 켜면 CUDA out of memory). worker.py 는 `quit` 을 받을 때
`engine.unload()` 를 부르므로, 여기서 **우리가 띄운 그 핸들만** 정리하면
«이름 기준 kill 금지» 규칙 안에서 해결됩니다.
"""
_STATE = {"root": "", "src": "", "proc": None}

# CREATE_NO_WINDOW — 부모 워커는 콘솔이 없는데(Rust 의 hidden_command) 자식은 콘솔 앱이라
# 그냥 띄우면 자기 콘솔 창을 새로 엽니다. VOSR 이 도는 내내 검은 창이 화면에 남았습니다.
_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def _stop_process():
    """띄워 둔 CLI 를 끊습니다 — 우리가 받아 둔 핸들만."""
    process = _STATE.get("proc")
    _STATE["proc"] = None
    if process is None or process.poll() is not None:
        return
    try:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    except Exception as error:  # 이미 끝났거나 권한이 없으면 더 할 일이 없습니다.
        common.log("VOSR 자식을 정리하지 못했습니다: {}".format(error))


# 작업 폴더 이름 앞에 늘 이것을 붙입니다 — 치울 때 «우리가 만든 것» 만 고르는 기준입니다.
_WORK_PREFIX = "vosr_"


def _work_root(root):
    """임시 작업 폴더(입력 png · 결과 png)를 두는 자리 — 엔진 폴더 안 `work/`.

    왜 %TEMP% 가 아닌가(2026-09-09 실측): 예전에는 `engines/vosr/logs` 가 있으면 그 안에,
    없으면 `tempfile` 기본 자리에 만들었는데 워커 로그는 엔진 폴더가 아니라 `upscale/logs`
    에 있습니다. 그래서 «있으면» 이 한 번도 참이 아니었고 8K 한 장이면 100 MB 가 넘는
    폴더가 매번 `%TEMP%` 로 떨어졌습니다. 도중에 끊기면 지우는 코드도 못 돌아 그대로 남았고요.
    엔진 폴더 안이면 «지우기는 engines/<id>/ 안으로만» 규칙(12 번 문서 §2)에 맞고,
    엔진을 제거할 때 같이 사라집니다.
    """
    return os.path.join(root, "work")


# 이 시간(초)보다 오래 손대지 않은 폴더만 «버려진 것» 으로 봅니다 — 아래 _sweep_work 참고.
_SWEEP_MIN_AGE_SECONDS = 3600


def _sweep_work(root):
    """강제로 끊겨 남은 작업 폴더를 치웁니다 — `work/` 바로 아래 `vosr_` 로 시작하는 **낡은** 폴더만.

    finally 는 프로세스가 살아 있을 때만 돕니다. 앱이 통째로 죽으면 그날 것이 남으므로
    다음 기동 때 한 번 치웁니다. 이름을 하나씩 확인해서 우리가 만든 접두사만 고르고,
    와일드카드나 상위 폴더 지정은 쓰지 않습니다(CLAUDE.md).

    왜 «나이» 를 보나(2026-09-09 지적): 예전에는 `_STATE['proc']` 만 보고 접두사가 맞으면 전부
    지웠습니다. 그 안전장치는 **이 프로세스 안에서만** 참입니다. worker.py 는 업스케일 요청마다
    `engine.load()` 를 부르므로 sweep 은 매 작업 앞에서 돌고, Tauri 에 single-instance 설정이 없어
    앱을 두 번 띄우면 워커도 두 벌이 떠 같은 `work/` 를 씁니다. B 가 작업을 시작하는 순간 A 가
    쓰고 있던 `vosr_XXXX/in/input.png`·`out/` 이 사라져, A 는 «종료코드 0 인데 결과 그림이 없습니다»
    로 실패했습니다. 그래서 **한 시간 넘게 손대지 않은 폴더만** 지웁니다 — 도는 중인 작업은
    입력·출력을 계속 쓰므로 그 조건에 걸리지 않습니다. 지우는 범위는 그대로입니다.
    """
    if _STATE.get("proc") is not None:
        return
    base = _work_root(root)
    if not os.path.isdir(base):
        return
    cutoff = time.time() - _SWEEP_MIN_AGE_SECONDS
    for name in os.listdir(base):
        if not name.startswith(_WORK_PREFIX):
            continue
        stale = os.path.join(base, name)
        if not os.path.isdir(stale):
            continue
        try:
            # 폴더 자체와 그 안 두 칸(in·out)의 최신 수정 시각을 봅니다 — 폴더 mtime 은
            # 파일을 덮어써도 안 바뀌는 경우가 있어, 도는 중인 작업을 낡았다고 볼 수 있습니다.
            touched = max(
                [os.path.getmtime(stale)]
                + [
                    os.path.getmtime(os.path.join(stale, sub))
                    for sub in ("in", "out")
                    if os.path.exists(os.path.join(stale, sub))
                ]
            )
        except OSError:
            # 시각을 못 읽으면 남의 것일 수 있으니 손대지 않습니다.
            continue
        if touched >= cutoff:
            continue
        shutil.rmtree(stale, ignore_errors=True)


def _child_env():
    """자식 CLI 에 줄 환경.

    `TORCHDYNAMO_DISABLE=1` 인 이유(2026-09-09 실측): 저장소의 `src/models/lightningdit.py`
    가 `@torch.compile` 을 다섯 군데 붙여 두었는데 우리 requirements 에는 triton 이 없습니다
    (Windows 용 고정 버전 휠이 마땅치 않아 넣지 않았습니다). 그대로 두면 첫 forward 에서
    `torch._dynamo` 가 «triton 없음» 으로 터지고, **CLI 가 그 예외를 자기 try 로 삼켜
    종료코드 0 으로 끝냅니다.** 우리 쪽에는 «결과 그림을 내지 않았습니다» 라는 엉뚱한 말만
    남아서 원인을 찾는 데 한참 걸렸습니다. dynamo 를 끄면 그냥 eager 로 돕니다 —
    1 스텝 추론이라 컴파일 이득도 원래 크지 않고, 끈 상태로 4K 한 장이 나왔습니다.

    UTF-8 두 줄은 자식이 찍는 글자를 우리가 utf-8 로 읽기 때문에 양쪽을 맞추는 것입니다.
    """
    env = dict(os.environ)
    env["TORCHDYNAMO_DISABLE"] = "1"
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def _tail_text(lines, count=6):
    """자식이 마지막으로 남긴 몇 줄 — 오류 문구에 그대로 붙입니다.

    자식의 stdout·stderr 은 한 파이프로 합쳐 로그에만 흘렸는데, 그러면 화면에는
    «결과 그림을 내지 않았습니다» 만 뜨고 진짜 이유(triton 없음 같은 것)는 로그 파일을
    열어야 보였습니다. 사람이 화면만 보고도 알 수 있게 마지막 줄을 실어 보냅니다.
    """
    picked = [line[:300] for line in list(lines)[-count:] if line]
    if not picked:
        return " 자식이 아무 말도 남기지 않았습니다(로그: upscale/logs/vosr.log)."
    return " 자식의 마지막 출력:\n" + "\n".join(picked)


def _src_root(root):
    base = os.path.join(root, "src")
    if os.path.isfile(os.path.join(base, "inference_vosr_onestep.py")):
        return base
    for name in sorted(os.listdir(base)):
        candidate = os.path.join(base, name)
        if os.path.isfile(os.path.join(candidate, "inference_vosr_onestep.py")):
            return candidate
    raise IOError("VOSR 코드를 찾지 못했습니다(inference_vosr_onestep.py). 폴더: {}".format(base))


def load(root, opts):
    src = _src_root(root)
    checkpoint = os.path.join(root, "preset", "ckpts", "VOSR2")
    if not os.path.isdir(checkpoint):
        raise IOError("VOSR2 가중치가 없습니다: {}. 설정에서 설치하세요.".format(checkpoint))
    _STATE["root"] = root
    _STATE["src"] = src
    _sweep_work(root)


def abort():
    """작업이 도는 중에 `quit` 이 왔을 때 worker.py 의 stdin 스레드가 부릅니다.

    모델을 내리지 않고 **우리가 띄운 CLI 핸들만** 끊습니다. 그래야 앱을 닫거나 시간이
    초과됐을 때 손자가 VRAM 을 문 채 남지 않습니다.
    """
    _stop_process()


def unload():
    # Rust 가 `quit` 을 보내면 worker.py 가 여기를 부릅니다 — 남은 손자를 여기서 끊습니다.
    _stop_process()
    _STATE["root"] = ""
    _STATE["src"] = ""


def info(root):
    return {"mode": "subprocess", "note": "작업마다 CLI 를 새로 부릅니다(상주 아님)"}


def upscale(img, target, opts, report):
    root, src = _STATE["root"], _STATE["src"]
    if not root:
        raise RuntimeError("VOSR 이 준비되지 않았습니다.")

    opts = opts or {}
    out_w, out_h = common.resolve_target((img.width, img.height), target)
    # CLI 는 정수 배율만 받습니다. 모자라면 안 되니 올림하고, 남는 만큼은 뒤에서 줄입니다.
    scale = max(1, min(8, math.ceil(max(out_w / float(img.width), out_h / float(img.height)))))

    base = _work_root(root)
    os.makedirs(base, exist_ok=True)
    work = tempfile.mkdtemp(prefix=_WORK_PREFIX, dir=base)
    # 만든 직후부터 try 로 감쌉니다 — 그림 저장이나 Popen 이 터져도 폴더가 남지 않게.
    try:
        in_dir = os.path.join(work, "in")
        out_dir = os.path.join(work, "out")
        os.makedirs(in_dir, exist_ok=True)
        os.makedirs(out_dir, exist_ok=True)
        in_path = os.path.join(in_dir, "input.png")
        img.save(in_path, "PNG")

        command = [
            sys.executable,
            # -u : 자식의 stdout 을 줄마다 흘려보내게 합니다. 파이프로 받으면 기본이 덩어리
            # 버퍼라 진행 줄이 끝나고 한꺼번에 왔습니다(진행률이 0 에서 멈춘 것처럼 보임).
            "-u",
            os.path.join(src, "inference_vosr_onestep.py"),
            "-c", os.path.join(root, "preset", "ckpts", "VOSR2"),
            "-i", in_path,
            "-o", out_dir,
            "-u", str(scale),
            "--tile_size", str(int(opts.get("tile") or 512)),
            "--vae_tile_size", str(int(opts.get("vae_tile") or 1024)),
            "--infer_steps", "1",
        ]
        common.log("VOSR 실행: {}".format(" ".join(command)))
        report(15, "VOSR 실행 (배율 {}×)".format(scale))

        # cwd 를 엔진 폴더로 두는 것이 핵심입니다 — 저장소의 상대 경로가 여기서 맞습니다.
        process = subprocess.Popen(
            command,
            cwd=root,
            # stdin=DEVNULL 은 «묻는 자리에서 매달리지 않게» 하는 장치입니다.
            #
            # 2026-09-09 에 여기 적혀 있던 이유(«워커의 stdin 파이프를 물려받아 읽기 스레드와
            # 손잡이를 다투느라 멈춘다»)는 **틀렸습니다.** 같은 모양으로 재현해 봤습니다 —
            # 부모가 `for line in sys.stdin` 스레드를 돌리는 채로, stdin 을 물려받고
            # creationflags 까지 똑같이 준 자식이 0.03초에 첫 줄을 찍고 정상 종료했습니다.
            # stdin 을 한 번도 읽지 않는 자식은 손잡이를 물려받아도 막히지 않습니다.
            #
            # 그때 30분을 넘긴 진짜 원인은 torch.hub 였습니다. `inference_vosr_onestep.py` 의
            # `load_dinov2` 가 `torch.hub.load('facebookresearch/dinov2', ...)` 를 부르는데,
            # hub 폴더(preset/ckpts/torch_cache)에 `facebookresearch_dinov2_main` 이 없으면
            # torch 가 GitHub 로 나가 저장소 zip 을 받으려 듭니다. 그 자국이 남아 있습니다 —
            # 신뢰 확인이 만든 빈 `trusted_list` 는 01:59, 실제 dinov2 폴더는 03:06 입니다.
            # 지금은 manifest 의 `code[dinov2]` 가 설치 때 그 폴더를 미리 풀어 두므로
            # 캐시를 쓰고 밖으로 나가지 않습니다.
            #
            # 그래도 DEVNULL 은 남깁니다. 자식이 무언가를 stdin 으로 물으면(예: hub 폴더가
            # 어떤 이유로 비어 torch 의 «(y/N)» 물음이 뜨는 경우) 파이프에는 아무도 답을 쓰지
            # 않아 앱이 살아 있는 내내 기다립니다. 끊어 두면 그 자리에서 EOFError 로 즉시 끝나
            # 우리는 이유가 적힌 오류를 받습니다. 자식은 stdin 을 쓸 일이 없습니다.
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            encoding="utf-8",
            errors="replace",
            creationflags=_NO_WINDOW,
            env=_child_env(),
        )
        # 예외로 빠져나가도 손자가 남지 않게 아래 finally 가 받습니다.
        _STATE["proc"] = process

        percent = 15
        tail = deque(maxlen=40)  # 오류 문구에 실을 마지막 출력
        for line in process.stdout:
            line = line.rstrip()
            if not line:
                continue
            tail.append(line)
            common.log("[vosr] " + line)
            matched = re.search(r"(\d+)%", line)
            if matched:
                percent = max(percent, min(90, 15 + int(int(matched.group(1)) * 0.75)))
                report(percent, "VOSR 처리 중")
        code = process.wait()
        if code != 0:
            raise RuntimeError("VOSR 이 오류로 끝났습니다(코드 {}).{}".format(code, _tail_text(tail)))

        produced = sorted(glob.glob(os.path.join(out_dir, "**", "*.png"), recursive=True))
        if not produced:
            # 종료코드 0 인데 결과가 없는 일이 실제로 있었습니다 — CLI 가 한 장씩 try 로 감싸
            # 예외를 삼키고 그대로 끝내기 때문입니다(triton 없음이 그렇게 숨었습니다).
            # 그래서 «없다» 로 끝내지 않고 자식이 마지막에 한 말을 같이 올려 보냅니다.
            raise RuntimeError(
                "VOSR 이 종료코드 0 으로 끝났는데 결과 그림이 없습니다.{}".format(_tail_text(tail))
            )
        report(92, "결과 읽기")
        return common.open_image(produced[0]).copy()
    finally:
        _stop_process()
        shutil.rmtree(work, ignore_errors=True)
