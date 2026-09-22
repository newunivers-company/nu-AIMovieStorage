# -*- coding: utf-8 -*-
"""로컬 생성 엔진이 같이 쓰는 도구 — 로그·장치·가중치 내려받기·시드.

엔진 모듈이 구현할 것은 세 함수뿐입니다(업스케일 쪽과 같은 모양).

    load(root, opts)                    — 모델을 올린다(이미 올라가 있으면 그냥 돌아온다)
    generate(output, opts, report)      -> dict (덧붙일 값: seconds·width·height·seed 등)
    unload()                            — VRAM 을 비운다

# 가중치는 왜 «첫 생성 때» 받는가

업스케일 엔진의 가중치는 파일 한두 개라 manifest 에 URL·sha256 을 적어 두고 설치 때
받습니다. 생성 모델은 **하나가 수십 개 파일로 흩어진 diffusers 저장소**라 그 목록을
손으로 적어 둘 수가 없습니다(판이 바뀌면 통째로 어긋납니다). 그래서 설치는 파이썬
환경까지만 하고, 가중치는 huggingface_hub 가 **이어받기와 해시 확인을 스스로 하면서**
첫 생성 때 받습니다. 받은 것은 `<엔진>/models/` 안에 남아 다음부터는 바로 씁니다.

# 다만 영상 엔진(미니맥스·완)은 설치 때 미리 받습니다

 첫 생성 때 받는 방식은 **그때 쓰는 덩어리만** 받습니다 —
미니맥스의 `transformer_ref/`(레퍼런스 영상, 62 GB)와 완의 I2V 판(60 GB)은 사용자의 기계에 없었고,
처음 쓰는 날 «생성 중» 안에서 말없이 받게 돼 있었습니다. 그래서 엔진 모듈에 `prefetch(root, report)`
가 있으면(manifest 의 `prefetch: true`) 설치 끝에 저장소를 통째로 받아 둡니다. 받는 한 벌은
`engines/_hf.py` 의 `snapshot` 입니다 — 재시도·토큰·진행 표시를 엔진마다 적지 않습니다.
"""

import os
import sys
import time
import random

# HF 캐시를 엔진 폴더 안으로. 사용자 홈(C:)에 수십 GB 를 흘리지 않습니다 —
# 제거를 누르면 엔진 폴더 하나만 지우면 깨끗해져야 합니다.
_engine_root = {"path": None}
"""지금 엔진의 폴더. «이 모델은 빠른 어텐션이 안 된다» 를 적어 두는 자리를 찾는 데 씁니다."""


def _fast_attention_mark():
    """이 엔진에 «빠른 어텐션 쓰지 말 것» 표시가 있는지 볼 파일 자리."""
    root = _engine_root["path"]
    return os.path.join(root, "빠른어텐션-못씀.txt") if root else None


def use_engine_cache(root):
    _engine_root["path"] = root
    models = os.path.join(root, "models")
    os.makedirs(models, exist_ok=True)
    os.environ["HF_HOME"] = models
    # 옛 이름(HUGGINGFACE_HUB_CACHE)과 새 이름(HF_HUB_CACHE)을 **둘 다** 잡습니다 — 허브는 새 이름을 먼저 보므로,
    # 사람 환경에 HF_HUB_CACHE 가 있으면 옛 이름만 잡아서는 가중치가 엔진 폴더 밖으로 갑니다(2026-09-22 점검).
    os.environ["HUGGINGFACE_HUB_CACHE"] = os.path.join(models, "hub")
    os.environ["HF_HUB_CACHE"] = os.path.join(models, "hub")
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    _avoid_symlinks()
    return models


def _avoid_symlinks():
    """**윈도우에서 심볼릭 링크를 못 만드는 계정이 있습니다.**

    2026-09-18 실측: ACE-Step 이 가중치를 7.7 GB 까지 받아 놓고 마지막에 죽었습니다 —
    「[WinError 1314] 클라이언트가 필요한 권한을 가지고 있지 않습니다」. 허깅페이스 캐시는
    `snapshots/…` 에서 `blobs/…` 로 심볼릭 링크를 겁니다. 개발자 모드가 꺼져 있고
    관리자도 아니면 못 겁니다.

    hub 안에 «못 걸면 복사» 하는 길이 있긴 한데 그쪽은 `PermissionError` 만 받아 냅니다.
    1314 는 파이썬에서 그냥 `OSError` 라 그 손을 빠져나갑니다. 환경 변수로 끄는 길도
    이 판(0.36)에는 없습니다 — 그래서 **«심볼릭 링크 되나?» 를 늘 아니오로** 만듭니다.
    그러면 hub 가 스스로 복사·이동 쪽으로 갑니다.

    안 되는 판이면 조용히 지나갑니다 — 이 손질이 없어도 되는 환경(리눅스·개발자 모드)에서
    쓸데없이 실패하면 안 됩니다.
    """
    try:
        from huggingface_hub import file_download
    except Exception:
        return
    try:
        if file_download.are_symlinks_supported():
            return
    except Exception:
        pass
    file_download.are_symlinks_supported = lambda *args, **kwargs: False


def _sage_kernel_runs():
    """SageAttention 커널이 **이 GPU 에서 실제로 도는지** 한 번 굴려 봅니다.

    diffusers 가 기대하는 모양은 (batch, seq, heads, dim) 입니다 — 축을 (B, H, N, D) 로
    놓고 재면 말도 안 되는 숫자가 나옵니다(2026-09-18 에 제가 그렇게 잘못 쟀습니다).
    """
    try:
        import torch
        from sageattention import sageattn
    except Exception:
        return False
    if not torch.cuda.is_available():
        return False
    try:
        shape = (1, 128, 2, 64)  # 아주 작게. 커널이 붙는지만 보면 됩니다.
        q, k, v = (torch.randn(shape, dtype=torch.bfloat16, device="cuda") for _ in range(3))
        sageattn(q, k, v, tensor_layout="NHD")
        torch.cuda.synchronize()
        return True
    except Exception as error:
        log("SageAttention 이 이 GPU 에서 돌지 않아 건너뜁니다: {}".format(error))
        return False


def use_fast_attention(*models):
    """**어텐션을 빠른 것으로 바꿉니다** — 되는 것 중 가장 빠른 하나로.

    

    diffusers 0.40 은 모델마다 `set_attention_backend` 로 어텐션 커널을 갈아 끼웁니다.
    빠른 순서대로 시도하고, 못 쓰면 다음 것으로 넘어갑니다 — 마지막은 늘 기본값이라
    **아무것도 못 바꿔도 그림은 나옵니다.**

    · `sage`     SageAttention 2.x. int8 QK + fp8 PV 라 긴 영상에서 가장 빠릅니다.
                 **다만 2.x 는 PyPI 에 없습니다**(1.0.6 뿐). 윈도우에서 쓰려면 소스로
                 빌드하거나 커뮤니티 휠을 받아 넣어야 합니다 — 깔려 있으면 여기서 잡힙니다.
    · `sage_hub` 허브에서 미리 빌드된 커널을 받아 씁니다. 리눅스는 되는데 **윈도우 빌드가
                 아직 없습니다**(2026-09-18 확인: `build does not exist` 404).
    · `flash_hub`·`_native_cudnn` 은 이 기계에서 실제로 쓸 수 있는 것들입니다.

    어느 것이 걸렸는지 로그에 남깁니다 — 「왜 안 빨라졌지」 를 여기서 알 수 있어야 합니다.
    """
    wanted = ["sage", "sage_hub", "flash_hub", "_native_cudnn"]
    # `set_attention_backend("sage")` 는 **꾸러미가 import 되는지만** 봅니다. 커널이 이 GPU 에서
    # 도는지는 안 봅니다. 그래서 여기서 손바닥만 한 텐서로 한 번 굴려 봅니다 — 안 돌면 목록에서
    # 뺍니다. 이걸 안 하면 다른 사람 PC(암페어 미만이거나 휠이 어긋난 경우)에서 **다 올린 뒤
    # 생성 도중에** 죽습니다().
    if not _sage_kernel_runs():
        wanted = [name for name in wanted if name != "sage"]
    # 한 번 «이 모델은 안 된다» 를 겪었으면 다시 시도하지 않습니다. 안 그러면 워커를 새로
    # 띄울 때마다 첫 생성이 20초쯤 헛돌고 되돌아옵니다(Krea 2 실측).
    mark = _fast_attention_mark()
    if mark and os.path.exists(mark):
        log("빠른 어텐션은 이 모델에서 못 씁니다(지난번에 겪었습니다). 기본으로 갑니다.")
        return None
    picked = None
    for model in models:
        if model is None or not hasattr(model, "set_attention_backend"):
            continue
        for name in wanted:
            try:
                model.set_attention_backend(name)
                picked = name
                break
            except Exception:
                continue
    log("어텐션: {}".format(picked or "기본값(바꾸지 못했습니다)"))
    return picked


def plain_attention(pipe):
    """빠른 어텐션을 **끄고 기본으로 되돌립니다.**

    `reset_attention_backend()` **하나로는 안 됩니다**(2026-09-18 실측). diffusers 의
    `set_attention_backend` 는 두 군데를 건드립니다 — 부품마다의 `_attention_backend`,
    그리고 **전역** `_AttentionBackendRegistry._active_backend`. 그런데 되돌리기는 앞의
    것만 지웁니다. 그래서 되돌린 뒤에도 전역에 남은 sage 로 다시 가서 똑같이 죽었습니다.
    둘 다 원래대로 돌려놔야 합니다.
    """
    for name in ("transformer", "transformer_2", "unet"):
        part = getattr(pipe, name, None)
        if part is None or not hasattr(part, "reset_attention_backend"):
            continue
        try:
            part.reset_attention_backend()
        except Exception:
            pass
    try:
        from diffusers.models.attention_dispatch import (
            AttentionBackendName,
            _AttentionBackendRegistry,
        )

        _AttentionBackendRegistry.set_active_backend(AttentionBackendName.NATIVE)
    except Exception as error:
        log("전역 어텐션을 되돌리지 못했습니다: {}".format(error))


def run_attention_safe(pipe, run):
    """`run()` 을 돌리되, **빠른 어텐션 때문에 죽으면 기본으로 되돌려 한 번 더** 합니다.

    2026-09-18 실측: Krea 2 는 sage 를 잡고도 첫 생성에서 죽었습니다.

        ValueError: `attn_mask` is not supported for sage attention

    SageAttention 커널에는 어텐션 마스크 자리가 없습니다. 그런데 글자를 채워 넣는 모델은
    («여기까지가 진짜 글자» 를 알려 주려고) 마스크를 씁니다 — 커널이 이 GPU 에서 도는지
    미리 굴려 봐도 이건 못 잡습니다. **모델이 무엇을 넘기느냐** 의 문제라서요.

    그래서 여기서 받아 냅니다. 한 번 되돌리면 그 모델은 계속 기본 어텐션으로 돕니다 —
    다음 생성부터는 실패도 없습니다. 느려질 뿐 **그림은 나옵니다**, 이게 중요합니다.
    """
    try:
        return run()
    except Exception as error:
        text = str(error).lower()
        if "sage" not in text and "attention" not in text:
            raise
        log("빠른 어텐션으로는 못 돌려 기본 어텐션으로 다시 합니다: {}".format(error))
        plain_attention(pipe)
        # 다음부터는 아예 시도하지 않도록 적어 둡니다.
        mark = _fast_attention_mark()
        if mark:
            try:
                with open(mark, "w", encoding="utf-8") as handle:
                    handle.write("{}\n{}\n".format(time.strftime("%Y-%m-%d %H:%M"), error))
            except Exception:
                pass
        return run()


def log(message):
    """stderr 로 한 줄. stdout 은 프로토콜 전용이라 절대 쓰면 안 됩니다."""
    sys.stderr.write("[{}] {}\n".format(time.strftime("%H:%M:%S"), message))
    sys.stderr.flush()


def torch_info():
    """기동 직후 화면에 보여 줄 값 — GPU 를 잡았는지."""
    import torch

    cuda = bool(torch.cuda.is_available())
    name = torch.cuda.get_device_name(0) if cuda else ""
    vram = 0
    if cuda:
        vram = round(torch.cuda.get_device_properties(0).total_mem / (1024 ** 3), 1) \
            if hasattr(torch.cuda.get_device_properties(0), "total_mem") \
            else round(torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 1)
    return {
        "cuda": cuda,
        "device": name,
        "torch": torch.__version__,
        "vram_gb": vram,
    }


def device_and_dtype():
    """GPU 가 있으면 bf16, 없으면 CPU·fp32.

    bf16 인 까닭: 요즘 DiT(Qwen-Image·FLUX·Wan)는 bf16 으로 학습돼 fp16 에서 검은 화면이
    나오는 일이 있습니다. 사용자의 GPU 는 넉넉하니 굳이 fp16 으로 내려갈 이유가 없습니다.
    """
    import torch

    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    return "cpu", torch.float32


def vram_gb():
    """이 기계의 VRAM(GB). GPU 가 없으면 0."""
    import torch

    if not torch.cuda.is_available():
        return 0.0
    props = torch.cuda.get_device_properties(0)
    total = getattr(props, "total_memory", None) or getattr(props, "total_mem", 0)
    return round(total / (1024 ** 3), 1)


def plan_precision(bf16_gb, opts=None):
    """이 GPU 에서 **어떤 정밀도로 올릴지** 정합니다.

    여태는 **아니었습니다.** 화면에 «줄이면 됩니다» 라고 적어만
    두고 실제로는 늘 원본을 받아 CPU 오프로드로 버텼습니다. 오프로드는 «안 죽게» 해 줄
    뿐이라 24 GB 카드에서 26 GB 짜리를 돌리면 블록이 계속 오가며 몇 배로 느려집니다.

    여기서 진짜로 고릅니다. 판단은 **워커 안에서** 합니다 — 앱이 nvidia-smi 로 읽은 값과
    torch 가 보는 값이 다를 수 있고(여러 장·MIG), 실제로 올리는 쪽이 torch 니까요.

      · 넉넉하면            bf16 그대로
      · 8비트로 들어가면    int8  (품질 손실이 거의 없습니다)
      · 그래도 모자라면     int4  (nf4 — 눈에 띄지만 도는 것이 안 도는 것보다 낫습니다)

    `opts.precision` 으로 사람이 못 박을 수 있습니다("bf16"·"int8"·"int4"·"auto").
    자동 판단이 틀릴 때(다른 프로그램이 VRAM 을 쥐고 있을 때 등) 손으로 내리라고 둔 길입니다.
    """
    wanted = str((opts or {}).get("precision") or "auto").lower()
    have = vram_gb()
    if wanted in ("bf16", "int8", "int4"):
        return {"mode": wanted, "bits": {"bf16": 0, "int8": 8, "int4": 4}[wanted], "vram": have, "why": "사람이 고름"}
    if have <= 0:
        # CPU 뿐이면 양자화가 오히려 느립니다(bitsandbytes 는 CUDA 전용).
        return {"mode": "bf16", "bits": 0, "vram": have, "why": "GPU 없음"}

    # 가중치 말고도 텍스트 인코더·VAE·중간값이 올라갑니다. 1.25배쯤 잡아야 실제로 들어갑니다.
    room = have / 1.25
    if room >= bf16_gb:
        return {"mode": "bf16", "bits": 0, "vram": have, "why": "넉넉함"}
    if room >= bf16_gb / 2.0:
        return {"mode": "int8", "bits": 8, "vram": have, "why": "bf16 이 안 들어감"}
    return {"mode": "int4", "bits": 4, "vram": have, "why": "int8 도 안 들어감"}


def quantized_transformers(repo, dtype, bits, extra=()):
    """줄여 올릴 **트랜스포머들**을 `from_pretrained` 에 끼울 꼴로 돌려줍니다.

    Wan 2.2 처럼 전문가가 둘인 모델(`transformer` + `transformer_2`)은 하나만 줄이면
    **절반이 bf16 으로 남아** 여전히 안 들어갑니다. 실제로 model_index.json 을 열어 보고
    알았습니다(2026-09-17) — 그전에는 `transformer` 하나만 줄이고 있었습니다.
    """
    out = {}
    for name in ("transformer",) + tuple(extra):
        out[name] = quantized_component(repo, dtype, bits, subfolder=name)
    return out


def quantized_component(repo, dtype, bits, subfolder="transformer"):
    """저장소의 **트랜스포머만** 줄여서 올립니다.

    파이프라인 통째로는 못 줄입니다(diffusers 는 모델 단위로 받습니다). 큰 것은 어차피
    DiT 한 덩어리라 그것만 줄이면 대부분의 VRAM 이 내려갑니다 — 텍스트 인코더와 VAE 는
    합쳐도 몇 GB 입니다.
    """
    from diffusers import AutoModel, BitsAndBytesConfig

    if bits == 8:
        config = BitsAndBytesConfig(load_in_8bit=True)
    else:
        # nf4 — 4비트 중 그림에서 가장 덜 상하는 방식입니다. 계산은 bf16 으로 되돌려 합니다.
        config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=dtype,
        )
    log("{} 의 {} 를 {}비트로 올립니다.".format(repo, subfolder, bits))
    return AutoModel.from_pretrained(
        repo,
        subfolder=subfolder,
        quantization_config=config,
        torch_dtype=dtype,
    )


def place(pipe, device, quantized):
    """올린 파이프라인을 장치에 놓습니다.

    양자화한 모델은 **옮길 수 없습니다** — bitsandbytes 가 이미 GPU 에 자리를 잡아 두었고
    `.to()` 를 부르면 오류가 납니다. 오프로드도 판에 따라 거부하므로, 되면 켜고 안 되면
    그냥 둡니다(그 상태로도 이미 VRAM 안에 들어가 있습니다).
    """
    if device != "cuda":
        return pipe.to(device)
    try:
        # VRAM 이 아무리 넉넉해도 오프로드를 씁니다 — 20B 급이 텍스트 인코더까지 한꺼번에
        # 올라가면 영상 엔진이나 업스케일이 끼어들 때 둘 다 죽습니다.
        pipe.enable_model_cpu_offload()
    except Exception as error:
        if not quantized:
            raise
        log("오프로드를 못 켰습니다(양자화판이라 그대로 둡니다): {}".format(error))
    return pipe


def resolve_seed(opts):
    """시드가 없으면 하나 뽑아 **돌려줍니다** — 마음에 든 결과를 다시 뽑으려면 시드가 필요합니다."""
    seed = opts.get("seed")
    if seed in (None, "", -1, "-1"):
        seed = random.randint(0, 2 ** 31 - 1)
    return int(seed)


def generator(seed):
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    return torch.Generator(device=device).manual_seed(int(seed))


def free_vram():
    """모델을 내린 뒤 실제로 VRAM 이 비도록."""
    import gc

    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception as error:  # torch 가 없을 수도 있습니다(설치 직후 검증 단계)
        log("VRAM 을 비우지 못했습니다: {}".format(error))
    gc.collect()


def step_reporter(report, total_steps, base=10, span=85):
    """디퓨전 스텝을 진행률로 바꿔 주는 콜백.

    diffusers 의 `callback_on_step_end` 규약에 맞춘 꼴로 돌려줍니다. 진행이 안 보이면
    수 분짜리 생성이 «멈춘 것» 으로 보여서, 사용자가 앱을 강제로 닫게 됩니다.
    """

    def callback(pipe, step, timestep, kwargs):
        if total_steps:
            percent = base + span * (step + 1) / float(total_steps)
            report(min(base + span, percent), "{}/{} 스텝".format(step + 1, total_steps))
        return kwargs

    return callback


def save_video(frames, path, fps):
    """프레임 목록을 mp4 로. diffusers 의 export_to_video 를 그대로 씁니다."""
    from diffusers.utils import export_to_video

    export_to_video(frames, path, fps=int(fps))
    return path
