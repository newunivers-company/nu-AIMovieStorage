# -*- coding: utf-8 -*-
"""LTX 2.5 — 22B 영상 DiT(Lightricks). 

미니맥스 H3 · Wan 2.2 와 나란히 놓는 **세 번째 갈래**입니다. 셋의 쓰임이 다릅니다.

  · H3   — 영상과 소리를 한 번에. 레퍼런스를 통째로 물립니다. 대신 125 GB.
  · Wan  — 로라 생태계가 가장 큼. 화풍을 고정해야 할 때.
  · LTX  — 해상도와 길이. 4K·24fps 까지 가고, fp8 로 줄이면 24 GB 카드에서도 돕니다.

# 프레임 수가 8n+1 이라야 합니다

LTX 의 VAE 는 시간축을 8배로 줍니다. 8n+1 이 아니면 마지막 토막이 잘려 끝이 뚝 끊깁니다.
길이는 사람이 **초**로 적고 여기서 맞춥니다(Wan 의 4n+1 과 같은 까닭, 배수만 다릅니다).
"""

import os
import time

import common

_state = {"pipe": None, "mode": None, "loras": [], "plan": None, "pose": False}

"""이 모델을 bf16 그대로 올리는 데 필요한 VRAM(GB) — 정밀도를 고르는 잣대."""
BF16_GB = 48.0

REPO = "Lightricks/LTX-2.5-Diffusers"


def info(root):
    return {
        "repo": REPO,
        "notes": "영상. opts.image 를 주면 그 그림에서 시작합니다(I2V). 프레임은 8n+1, 변은 32의 배수.",
    }


def _mode_of(opts):
    """어느 파이프라인이 필요한가 — 동작 기준이 있으면 InContext, 첫 장면이 있으면 I2V."""
    if (opts.get("control") or {}).get("frames"):
        return "pose"
    return "i2v" if (opts.get("image") or "").strip() else "t2v"


def load(root, opts):
    mode = _mode_of(opts)
    # 정밀도를 **먼저** 셈합니다 — 이미 올라가 있어도 사람이 정밀도를 바꿨으면 다시 올려야
    # 합니다(로라만 다시 걸고 정밀도는 안 보던 자리). 판단은 `common.plan_precision` 한 곳.
    plan = common.plan_precision(BF16_GB, opts, loaded=_state["plan"])
    if _state["pipe"] is not None and _state["mode"] == mode and not plan["reload"]:
        _apply_loras(opts)
        return
    import diffusers

    """
    **판을 먼저 봅니다.** 2026-09-18 점검에서 이 컴퓨터의 엔진 환경에 diffusers 0.36 이
    깔려 있었습니다 — `requirements.txt` 는 0.40 을 못 박았는데 환경은 그 전에 만들어진
    것이었습니다. 0.36 에는 `LTX2*` 파이프라인이 **아예 없어서**, 그대로 두면 45 GB 를
    받고 나서 `AttributeError` 한 줄을 봅니다. 그 대신 무엇을 눌러야 하는지 말합니다.
    """
    version = tuple(int(part) for part in diffusers.__version__.split(".")[:2] if part.isdigit())
    if version < (0, 40):
        raise RuntimeError(
            "이 엔진 환경의 diffusers 가 {} 입니다 — LTX 2.5 는 0.40 이상이 필요합니다. "
            "설정 → 로컬 모델 → LTX 2.5 의 «다시 설치» 를 눌러 환경을 새로 만들어 주세요.".format(
                diffusers.__version__
            )
        )

    common.use_engine_cache(root)
    device, dtype = common.device_and_dtype()
    unload()
    """
    **`LTXPipeline` 은 LTX 1.x 것입니다.** 2.5 는 `LTX2*` 입니다 — 처음에 1.x 이름을 적어
    두었는데, diffusers 0.40 의 파이프라인 목록을 직접 열어 보고 알았습니다(2026-09-17).
    그대로 두었으면 45 GB 를 받고 나서 「그런 파이프라인이 없습니다」 를 봤을 것입니다.
    """
    """
    동작 기준(모캡 뼈 그림)이 있으면 **`LTX2InContextPipeline`** 입니다. diffusers 0.40 의
    소스를 직접 열어 보니(2026-09-18) `LTX2Pipeline`·`LTX2ImageToVideoPipeline` 은 조건
    영상을 받는 자리가 없고, IC-LoRA 용 InContext 파이프라인만 `reference_conditions`
    (참조·포즈 영상)와 `conditions`(첫 장면·키프레임)를 받습니다.
    """
    pipeline_class = getattr(
        diffusers,
        {"pose": "LTX2InContextPipeline", "i2v": "LTX2ImageToVideoPipeline"}.get(
            mode, "LTX2Pipeline"
        ),
    )
    """
    `LTX25_REPO` 는 **시험용 우회로**입니다. 2.5 저장소는 게이트라 허깅페이스에서 약관에
    동의한 계정만 받을 수 있는데(2026-09-18 실측: 사용자 계정이 아직 동의 전이라 403), 그
    사이에도 같은 코드가 도는지 보려고 게이트 없는 `diffusers/LTX-2.3-Diffusers` 로 돌려
    본 길입니다. 앱은 이 변수를 주지 않으므로 평소에는 REPO 그대로입니다.
    """
    repo = (os.environ.get("LTX25_REPO") or "").strip() or REPO
    # 이 GPU 에 bf16 이 안 들어가면 **정말로 줄여서** 올립니다.
    common.log_precision(repo, plan)
    """
    `prompt_enhancer=None` — 저장소에 든 Gemma4 «프롬프트 다듬기» 모델(10 GB)은 우리가 안 씁니다
    (프롬프트는 앱이 이미 다듬어서 줍니다). 이렇게 빼 두면 diffusers 가 그 폴더를 **받지도
    올리지도** 않습니다. 2026-09-18 실측에서는 이걸 몰라 165 GB 를 받고 RAM 에까지 올렸습니다 —
    세 파이프라인(T2V·I2V·InContext) 모두 이 부품을 선택 항목으로 둡니다.
    """
    parts = {"prompt_enhancer": None, "dtype": dtype}
    try:
        if plan["bits"]:
            parts["transformer"] = common.quantized_component(repo, dtype, plan["bits"])
        pipe = pipeline_class.from_pretrained(repo, **parts)
    except Exception as error:
        """
        게이트 저장소의 403 은 «토큰이 틀렸다» 가 아니라 «약관에 동의하지 않았다» 입니다.
        허깅페이스 원문은 영어 열 줄이라 무엇을 눌러야 하는지 안 보입니다 — 주소를 바로 줍니다.
        """
        if "GatedRepoError" in type(error).__name__ or "gated" in str(error).lower():
            raise RuntimeError(
                "허깅페이스에서 {} 의 약관에 아직 동의하지 않았습니다. https://huggingface.co/{} 에 "
                "로그인해 «Agree and access repository» 를 누른 뒤(세분화 토큰이면 «Read access to "
                "public gated repos» 권한도 켜야 합니다) 다시 뽑아 주세요. 원문: {}".format(
                    repo, repo, str(error).strip().splitlines()[-1][:200]
                )
            )
        raise
    # 영상 DiT 는 그림보다 훨씬 큽니다. 오프로드 없이는 VRAM 이 넉넉해도 최고점에서 터집니다.
    pipe = common.place(pipe, device, bool(plan["bits"]))
    try:
        pipe.set_progress_bar_config(disable=True)
    except Exception:
        pass
    common.use_fast_attention(getattr(pipe, "transformer", None))
    _state["pipe"] = pipe
    _state["mode"] = mode
    _state["plan"] = plan
    _state["loras"] = []
    _apply_loras(opts)


def unload():
    _state["pipe"] = None
    _state["mode"] = None
    _state["loras"] = []
    _state["plan"] = None
    _state["pose"] = False
    common.free_vram()


def _apply_loras(opts):
    """`opts.loras = [{"path": …, "weight": 0.8}, …]` — Wan 과 같은 규약입니다."""
    pipe = _state["pipe"]
    wanted = [item for item in (opts.get("loras") or []) if item.get("path")]
    signature = [(item["path"], float(item.get("weight", 1.0))) for item in wanted]
    if signature == _state["loras"]:
        return
    try:
        pipe.unload_lora_weights()
    except Exception as error:
        common.log("로라를 떼지 못했습니다(무시): {}".format(error))
    names, weights = [], []
    for index, item in enumerate(wanted):
        path = item["path"]
        if not os.path.isfile(path):
            raise IOError("로라 파일을 찾지 못했습니다: {}".format(path))
        folder, filename = os.path.split(path)
        name = "lora{}".format(index)
        pipe.load_lora_weights(folder, weight_name=filename, adapter_name=name)
        names.append(name)
        weights.append(float(item.get("weight", 1.0)))
    if names:
        pipe.set_adapters(names, adapter_weights=weights)
        common.log("로라 {}개를 먹였습니다.".format(len(names)))
    _state["loras"] = signature


# ─────────────────────────────────────────────────────────────────────────────
# 동작 그대로 옮기기 — 포즈 IC-LoRA
# ─────────────────────────────────────────────────────────────────────────────

"""


LTX 2 계열에는 **포즈 IC-LoRA** 가 따로 나와 있습니다(`LTX-2-19b-IC-LoRA-Pose-Control`).
얹으면 뼈 그림 줄을 «조건» 으로 받아 그 동작을 그대로 따릅니다.

# 규약을 **찍지 않습니다**

모델 쪽 안내가 ComfyUI 워크플로만 말하고 diffusers 호출 규약은 적어 두지 않았습니다.
그래서 여기서는 **파이프라인에게 직접 물어봅니다** — `__call__` 이 받는 인자 이름을 보고
있는 것으로 넘깁니다. 없으면 **조용히 무시하지 않고** 무엇이 없는지 말하고 멈춥니다.

조용한 무시가 가장 나쁩니다: 45 GB 를 올리고 20분을 뽑았는데 춤을 안 따라 하고, 그게
로라 탓인지 그림 탓인지 규약 탓인지 알 길이 없습니다.
"""

POSE_LORA_REPO = "Lightricks/LTX-2-19b-IC-LoRA-Pose-Control"
POSE_LORA_FILE = "ltx-2-19b-ic-lora-pose-control.safetensors"


def _pose_frames(opts, width, height, frames):
    """뼈 그림들을 파이프라인 크기에 맞춰 읽어 옵니다. 모자라면 마지막 장을 늘립니다."""
    from PIL import Image

    control = opts.get("control") or {}
    paths = [p for p in (control.get("frames") or []) if p]
    if not paths:
        return None
    missing = [p for p in paths if not os.path.isfile(p)]
    if missing:
        raise IOError("뼈 그림을 찾지 못했습니다: {}".format(missing[0]))
    images = [Image.open(p).convert("RGB").resize((width, height)) for p in paths]
    # 길이를 맞춥니다 — 모자라면 마지막 자세로 버티고, 넘치면 앞에서 자릅니다.
    if len(images) < frames:
        images += [images[-1]] * (frames - len(images))
    return images[:frames]


def _attach_pose(pipe, opts):
    """포즈 IC-LoRA 를 얹습니다. 이미 얹혀 있으면 아무 일도 하지 않습니다."""
    if _state.get("pose"):
        return
    common.log("포즈 IC-LoRA 를 받습니다: {}".format(POSE_LORA_REPO))
    pipe.load_lora_weights(POSE_LORA_REPO, weight_name=POSE_LORA_FILE, adapter_name="pose")
    _state["pose"] = True


def _pose_kwarg(pipe):
    """이 파이프라인이 조건 그림을 **어느 이름으로** 받는가. 없으면 None."""
    import inspect

    try:
        names = set(inspect.signature(pipe.__call__).parameters)
    except (TypeError, ValueError):
        return None
    """
    **`reference_conditions` 가 먼저입니다.** diffusers 0.40 의 소스를 직접 열어 보니
    (2026-09-18) 포즈 IC-LoRA 용 `LTX2InContextPipeline` 은 두 이름을 **다 가지고** 있는데
    뜻이 다릅니다 — `reference_conditions` 가 «참조 영상(포즈 영상)» 이고, `conditions` 는
    «첫 장면·키프레임 그림» 입니다. 예전 순서(`conditions` 먼저)면 뼈 그림이 첫 장면 자리로
    들어가 동작이 아니라 그림이 고정됐을 것입니다. `LTX2Pipeline`·`LTX2ImageToVideoPipeline`
    은 넷 다 없습니다 — 포즈를 쓰려면 파이프라인 자체가 InContext 여야 합니다.
    """
    for name in ("reference_conditions", "conditions", "control_frames", "control_video"):
        if name in names:
            return name
    return None


def _fit32(value):
    """변은 32의 배수라야 합니다 — 아니면 파이프라인이 제 마음대로 잘라 비율이 틀어집니다."""
    return max(32, int(round(value / 32.0)) * 32)


def generate(output, opts, report):
    started = time.time()
    pipe = _state["pipe"]
    fps = int(opts.get("fps") or 24)
    seconds = float(opts.get("seconds") or 5.0)
    frames = int(round(seconds * fps))
    # 8n+1 로 올림이 아니라 내림 — 올리면 요청한 길이를 넘습니다.
    frames = max(9, ((frames - 1) // 8) * 8 + 1)
    steps = int(opts.get("steps") or 30)
    seed = common.resolve_seed(opts)
    width = _fit32(int(opts.get("width") or 1280))
    height = _fit32(int(opts.get("height") or 704))

    kwargs = {
        "prompt": opts.get("prompt") or "",
        "num_frames": frames,
        # 설치된 0.40 의 `__call__` 을 직접 읽어 보니(2026-09-18) 세 파이프라인 모두 `frame_rate` 를
        # 받고 기본이 24 입니다. 안 넘기면 30fps 로 뽑아도 시간 좌표·소리 길이는 24 기준이 됩니다.
        "frame_rate": float(fps),
        "num_inference_steps": steps,
        "guidance_scale": float(opts.get("guidance") or 3.0),
        "generator": common.generator(seed),
        "callback_on_step_end": common.step_reporter(report, steps),
    }
    negative = (opts.get("negative") or "").strip()
    if negative:
        kwargs["negative_prompt"] = negative

    kwargs["width"] = width
    kwargs["height"] = height
    first_frame = None
    image_path = (opts.get("image") or "").strip()
    if image_path:
        from PIL import Image

        if not os.path.isfile(image_path):
            raise IOError("첫 장면 그림을 찾지 못했습니다: {}".format(image_path))
        first_frame = Image.open(image_path).convert("RGB").resize((width, height))

    # ── 동작 기준(모캡에서 구운 뼈 그림) ──────────────────────────────
    control = _pose_frames(opts, width, height, frames)
    if control:
        slot = _pose_kwarg(pipe)
        if slot != "reference_conditions":
            raise RuntimeError(
                "이 파이프라인은 참조 영상을 받지 않습니다({}). 동작을 그대로 옮기려면 "
                "LTX2InContextPipeline 이라야 합니다 — diffusers 0.40 이상인지 확인하고 "
                "설정 → 로컬 모델에서 «다시 설치» 를 눌러 주세요.".format(type(pipe).__name__)
            )
        """
        **`diffusers` 맨 위에는 이 둘이 없습니다.** 0.40 을 실제로 깔고 `from diffusers import
        LTX2ReferenceCondition` 을 해 보니 AttributeError 였습니다(2026-09-18) — 파이프라인 클래스만
        맨 위로 올라가 있고, 조건 데이터클래스는 `diffusers.pipelines.ltx2` 패키지가 냅니다.
        """
        from diffusers.pipelines.ltx2 import LTX2ReferenceCondition

        _attach_pose(pipe, opts)
        weight = float((opts.get("control") or {}).get("weight") or 1.0)
        """
        뼈 그림은 **참조 조건**으로, 첫 장면은 **프레임 조건**으로 — 둘의 뜻이 다릅니다.
        `reference_conditions` 는 IC-LoRA 가 «따라 할 영상» 이고, `conditions` 는 «이
        장면에서 시작하라» 입니다. 뒤바꾸면 뼈 그림이 화면에 그려집니다.
        세기(`strength`)가 조건 자체에 있어 로라 세기와 따로 겁니다.
        """
        kwargs["reference_conditions"] = [LTX2ReferenceCondition(frames=control, strength=weight)]
        if first_frame is not None:
            from diffusers.pipelines.ltx2 import LTX2VideoCondition

            kwargs["conditions"] = [LTX2VideoCondition(frames=first_frame, index=0)]
        common.log("동작 기준 {}장을 참조 조건으로 넘깁니다(세기 {}).".format(len(control), weight))
    elif first_frame is not None:
        # 동작 기준 없이 첫 장면만 — I2V 파이프라인은 `image` 로 받습니다.
        kwargs["image"] = first_frame

    result = common.run_attention_safe(pipe, lambda: pipe(**kwargs))
    report(95, "mp4 로 내보내는 중")
    common.save_video(result.frames[0], output, fps)
    out = {
        "width": width,
        "height": height,
        "frames": frames,
        "fps": fps,
        "seconds_video": round(frames / float(fps), 2),
        "seed": seed,
        "generate_seconds": round(time.time() - started, 2),
    }
    # 요청한 정밀도와 실제로 올라간 정밀도 — 한 곳에서 만듭니다.
    out.update(common.precision_fields(_state["plan"]))
    return out
