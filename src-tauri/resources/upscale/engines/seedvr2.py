# -*- coding: utf-8 -*-
"""사실감·큰 배율 — SeedVR2 7B (numz `inference_cli.py`, 커밋 4490bd1 고정).

**상주 방식**: CLI 를 작업마다 서브프로세스로 부르지 않고, `inference_cli` 모듈을
한 번 import 해서 `_process_frames_core(frames, args, "0", debug, runner_cache)` 를
직접 부릅니다. `runner_cache` 를 모듈 전역에 들고 있으면 dit/vae 가 프로세스에 남아
(`--cache_dit/--cache_vae` 와 같은 효과) 두 번째 장부터는 로딩 시간이 사라집니다.
7B fp16 은 올리는 데만 수십 초라 이 차이가 큽니다.

import 이 조심스러운 이유
- `inference_cli` 는 import 하는 동안 `sys.argv` 를 미리 훑어 `--cuda_device` 를 봅니다.
  워커의 argv 가 그대로 보이면 엉뚱하게 해석하므로 **import 동안만 argv 를 비웁니다.**
- 저장소 뿌리를 `sys.path` 에 넣어야 `src.*` 를 찾습니다.
- import 시 torch 에 전역 패치를 겁니다 — 그래서 엔진마다 프로세스를 따로 씁니다.

목표 크기: `--resolution` 은 **짧은 변**입니다. 프런트의 목표는 긴 변이라 비율로 환산해
넣고, 마지막에 worker 가 Lanczos 로 정확히 맞춥니다.
긴 변이 6000 이상이면 VAE 타일을 켭니다(안 켜면 디코드에서 VRAM 이 터집니다).

플래시어텐션/apex/torch.compile 은 전부 끕니다 — sm_120(Blackwell) 빌드가 깨져 있고
compile 은 MSVC 를 요구합니다. SDPA 기본으로 충분합니다.
"""

import os
import sys

# torch 를 부르기 **전에** 정해야 하는 값이라 모듈 맨 위에 둡니다.
# (worker.py 가 `load_engine` 을 `common.torch_info()` 보다 먼저 부르고, common 은 torch 를
# 함수 안에서만 import 합니다 — 그래서 여기가 CUDA 가 깨어나기 전 마지막 자리입니다.)
#
# 왜 필요한가(2026-09-09 실측): 가중치를 GPU 에 상주시키면 16.5 GB 가 계속 자리를 차지해
# 기본 할당기가 큰 활성값을 넣을 자리를 못 찾고 캐시를 비웠다 다시 잡습니다.
# 상주만 켰을 때 전송 4초는 사라졌는데 샘플러가 5.8→8.2초로 느려져 본전이었습니다.
# `expandable_segments` 를 켜면 그 되풀이가 없어져 4K 두 번째 장이 22.7→16.4초가 됩니다.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import common  # noqa: E402  (위 환경 변수를 먼저 정해야 합니다)

_STATE = {"cli": None, "cache": {}, "model": "", "root": ""}

MODEL_FILES = {
    "7b": "seedvr2_ema_7b_fp16.safetensors",
    "7b_sharp": "seedvr2_ema_7b_sharp_fp16.safetensors",
    "3b": "seedvr2_ema_3b_fp16.safetensors",
}

# 이 아래 VRAM 에서는 상주를 포기하고 예전처럼 CPU 로 내립니다.
#
# 숫자의 근거(2026-09-09 재측정, `nvidia-smi` 카드 전체 사용량 · 기준선 5.5 GB 포함):
# 4K 한 장 **72.8 GB** · 8K 한 장 **59.6 GB**. 7B fp16 가중치 16.5 GB 는 그 안에 든 값입니다.
# 여기 처음 적었던 32 는 아무 데서도 재 보지 않은 숫자였고, 위 주석의 «4K 최고 59 GB» 도
# 실은 8K 줄의 값이었습니다.
#
# 그래서 기준을 실측 최고치 위로 올렸습니다. 상주는 «빠르면 좋은 것» 이고 CPU 로 내리는 길은
# 원래 돌던 길이라, 확신이 없으면 안전한 쪽(내리기)이 맞습니다. 예전에는 어떤 카드든 내렸으니
# 32~48 GB 카드에서 돌던 것이 근거 없는 기준 때문에 CUDA out of memory 로 죽으면
# 고친 것이 아니라 망친 것입니다. 사용자의 카드(96 GB) 말고는 검증할 방법이 없으므로,
# 실측한 96 GB 급에서만 켭니다. 필요하면 `SEEDVR2_OFFLOAD_DEVICE=0` 으로 손수 켤 수 있습니다.
RESIDENT_MIN_VRAM_GB = 80

# `_process_frames_core` 에 넘기는 장치 번호. 아래 «상주» 설명이 이 값에 기댑니다.
DEVICE_ID = "0"


def _offload_device_arg():
    """«쓰지 않을 때 가중치를 둘 곳». 상주시키려면 **추론 장치와 같은 값**을 줘야 합니다.

    함정 (2026-09-09 실측): 예전에는 `args.dit_offload_device = "none"` 을 넣었습니다.
    이름만 보면 «내리지 않음» 이지만, 저장소는 캐시가 켜져 있으면 그 값을 조용히 «cpu» 로
    바꿉니다 — `inference_cli._parse_offload_device(arg, platform, cache_enabled)` 가
    `if offload_arg == "none": return "cpu" if cache_enabled else None` 이고,
    우리는 상주를 위해 `cache_dit/cache_vae` 를 켜 두었기 때문입니다.

    그 결과 가중치가 **CPU 에 실체화**되고("Materializing DiT weights to CPU (offload device)"),
    장마다 Phase 2 가 16.5 GB 를 CPU→GPU 로 올린 뒤 `cleanup_dit` 이 다시 GPU→CPU 로
    내렸습니다. 4K 두 번째 장의 DiT 구간 11.3초 중 실제 샘플링은 5.9초뿐이었습니다.

    `"none"` 대신 장치 번호를 주면 «내릴 곳» 이 `cuda:0` 이 되고, `manage_model_device` 가
    «이미 그 장치» 라며 건너뛰어 결과적으로 GPU 상주가 됩니다.
    (`None` 을 넘기는 길은 없습니다 — `cleanup_dit` 이 None 도 cpu 로 되돌립니다.)

    `SEEDVR2_OFFLOAD_DEVICE=cpu` 로 예전 동작을 되돌릴 수 있게 두었습니다 — 고치기 전과
    뒤를 같은 기계에서 나란히 재 보려고 남긴 문입니다. 반대로 `=0` 을 주면 `RESIDENT_MIN_VRAM_GB`
    를 무시하고 상주시킵니다(자기 카드에서 직접 재 본 사람을 위한 문).
    """
    forced = (os.environ.get("SEEDVR2_OFFLOAD_DEVICE") or "").strip()
    if forced:
        return forced
    try:
        import torch

        if not torch.cuda.is_available():
            return "cpu"
        total_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        if total_gb < RESIDENT_MIN_VRAM_GB:
            return "cpu"
    except Exception:
        return "cpu"
    return DEVICE_ID


def _src_root(root):
    """`src/` 안에 풀어 둔 저장소 뿌리(= `inference_cli.py` 가 있는 폴더)."""
    base = os.path.join(root, "src")
    if os.path.isfile(os.path.join(base, "inference_cli.py")):
        return base
    for name in sorted(os.listdir(base)):
        candidate = os.path.join(base, name)
        if os.path.isfile(os.path.join(candidate, "inference_cli.py")):
            return candidate
    raise IOError("SeedVR2 코드를 찾지 못했습니다(inference_cli.py). 폴더: {}".format(base))


def _import_cli(root):
    if _STATE["cli"] is not None:
        return _STATE["cli"]

    src = _src_root(root)
    if src not in sys.path:
        sys.path.insert(0, src)
    here = os.getcwd()
    saved_argv = sys.argv
    try:
        # 저장소가 상대 경로를 쓰는 곳이 있어 그 안에서 import 합니다.
        os.chdir(src)
        sys.argv = ["inference_cli.py"]
        import importlib

        module = importlib.import_module("inference_cli")
    finally:
        sys.argv = saved_argv
        os.chdir(here)
    _STATE["cli"] = module
    return module


def _base_args(cli, root, model_file, resolution, max_resolution, tiled):
    """CLI 의 기본값을 그대로 쓰되 우리가 필요한 것만 덮어씁니다.

    argparse 를 직접 돌리지 않고 Namespace 를 손으로 채우면 저장소가 나중에 인자를
    추가했을 때 조용히 빠집니다. 그래서 **저장소의 파서로 기본값을 뽑고** 덮어씁니다.
    """
    saved_argv = sys.argv
    try:
        sys.argv = ["inference_cli.py", "dummy_input"]
        args = cli.parse_arguments()
    finally:
        sys.argv = saved_argv

    args.input = ""
    args.output = None
    args.output_format = "png"
    args.model_dir = os.path.join(root, "models")
    args.dit_model = model_file
    args.resolution = int(resolution)
    args.max_resolution = int(max_resolution)
    args.batch_size = 1
    args.seed = int(os.environ.get("SEEDVR2_SEED", "42"))
    args.color_correction = "lab"

    # 상주 — 이 둘이 켜져 있어야 runner_cache 에 dit/vae 가 남습니다.
    args.cache_dit = True
    args.cache_vae = True
    # «none» 은 캐시가 켜져 있으면 cpu 로 바뀝니다 — `_offload_device_arg` 설명을 보세요.
    offload = _offload_device_arg()
    args.dit_offload_device = offload
    args.vae_offload_device = offload

    # 6K/8K 만 VAE 타일. 켜면 느려지므로 필요할 때만.
    args.vae_encode_tiled = tiled
    args.vae_decode_tiled = tiled
    args.vae_encode_tile_size = 1024
    args.vae_decode_tile_size = 1024

    # Blackwell 에서 깨지거나 MSVC 를 요구하는 것들은 전부 끕니다.
    for flag in ("compile_dit", "compile_vae", "use_flash_attn", "debug"):
        if hasattr(args, flag):
            setattr(args, flag, False)
    return args


def load(root, opts):
    opts = opts or {}
    model = opts.get("model") or "7b"
    model_file = MODEL_FILES.get(model)
    if not model_file:
        raise ValueError("모르는 SeedVR2 가중치입니다: {}".format(model))
    path = os.path.join(root, "models", model_file)
    if not os.path.isfile(path):
        raise IOError("가중치가 없습니다: {}. 설정에서 «추가 모델» 을 켜고 다시 설치하세요.".format(path))

    _import_cli(root)
    if _STATE["model"] and _STATE["model"] != model:
        # 다른 가중치로 바꾸면 캐시를 버려야 합니다 — 안 그러면 옛 dit 가 계속 쓰입니다.
        unload()
    _STATE["model"] = model
    _STATE["root"] = root


def unload():
    _STATE["cache"] = {}
    _STATE["model"] = ""
    try:
        import torch

        torch.cuda.empty_cache()
    except Exception:
        pass


def upscale(img, target, opts, report):
    import torch

    cli = _STATE["cli"]
    if cli is None:
        raise RuntimeError("SeedVR2 코드가 올라가 있지 않습니다.")

    out_w, out_h = common.resolve_target((img.width, img.height), target)
    short_edge = min(out_w, out_h)
    long_edge = max(out_w, out_h)
    tiled = long_edge >= 6000

    model_file = MODEL_FILES[_STATE["model"] or "7b"]
    args = _base_args(cli, _STATE["root"], model_file, short_edge, long_edge, tiled)

    report(10, "가중치 확인")
    if not cli.download_weight(dit_model=args.dit_model, vae_model=cli.DEFAULT_VAE, model_dir=args.model_dir, debug=cli.debug):
        raise IOError("SeedVR2 가중치를 확인하지 못했습니다. 설정에서 다시 설치하세요.")

    # (T,H,W,C) float 0~1 — CLI 가 프레임 묶음을 기대합니다. 그림 한 장이면 T=1.
    frames = common.to_tensor(img)[0].permute(1, 2, 0).unsqueeze(0).contiguous()

    report(20, "업스케일 중 (1스텝 DiT)")
    result = cli._process_frames_core(
        frames_tensor=frames,
        args=args,
        device_id=DEVICE_ID,
        debug=cli.debug,
        runner_cache=_STATE["cache"],
    )
    report(90, "마무리")

    out = common.to_image(result[0].permute(2, 0, 1))
    del frames, result
    torch.cuda.empty_cache()
    return out
