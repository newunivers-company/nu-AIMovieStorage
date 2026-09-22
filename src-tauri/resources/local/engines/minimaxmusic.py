# -*- coding: utf-8 -*-
"""MiniMax-Music3 — BGM 을 이 컴퓨터에서. 오픈 웨이트(2026-08-13).



한 번에 **5분짜리 완곡**을 냅니다. 토막이나 루프가 아니라 도입·전개·후렴이 이어지는
한 곡이라, 영상 전체에 까는 BGM 으로 그대로 씁니다. 32 kHz 스테레오.

# 프롬프트와 가사를 **따로** 줍니다

    prompt  "Genre: cinematic orchestral. BPM: 92. strings, low brass, sparse piano"
    lyrics  "[verse]…" — 비워 두면 연주곡입니다.

BGM 은 대개 연주곡이라 가사 칸이 비어 옵니다. 그때는 아예 넘기지 않습니다 — 빈 문자열을
주면 «가사가 없는 노래» 로 읽고 웅얼거리는 보컬이 끼는 일이 있습니다.

# VRAM

24 GB 면 넉넉하고, 8 GB 도 레이어 스트리밍으로 돕니다. 그 갈림은 `load` 에서 잽니다.
"""

import time

import common

_state = {"pipe": None, "plan": None}

REPO = "MiniMaxAI/MiniMax-Music3"

"""
bf16 으로 통째로 올릴 때의 **모델 크기**(GB).

필요한 VRAM 은 `common.plan_precision` 이 여유(1.25배)를 얹어 23.75 GB 로 봅니다 — 24 GB
카드가 통째로 올라가 돌던 자리를 그대로 지키는 값입니다. 여태 이 엔진만 `vram >= 24` 를
손으로 들고 있었고, 그래서 화면의 안내와 워커의 판단이 서로를 모른 채 갈라져 있었습니다.
"""
BF16_GB = 19.0

"""
**이 엔진이 올릴 수 있는 정밀도는 bf16 뿐입니다.** 모듈러 파이프라인이라 양자화를 끼우려면
부품마다 따로 만들어야 합니다. 좁은 카드는 대신 언어 모델을 흘려 보냅니다.
"""
SUPPORTED = ("bf16",)


def info(root):
    return {
        "repo": REPO,
        "notes": "완곡 BGM. 32kHz 스테레오. 가사를 비우면 연주곡입니다.",
    }


def load(root, opts):
    # 정밀도 판단은 다른 엔진과 **같은 한 곳**입니다. 줄이는 길이 없는 엔진이라 규칙이
    # «줄여라» 라고 하면 그것이 곧 «언어 모델을 흘려라» 입니다.
    plan = common.plan_precision(BF16_GB, opts, loaded=_state["plan"], supported=SUPPORTED)
    if _state["pipe"] is not None and not plan["reload"]:
        return
    import torch
    from diffusers import ComponentsManager, ModularPipeline

    common.use_engine_cache(root)
    common.log_precision(REPO, plan)

    if plan["wanted"] == "bf16":
        pipe = ModularPipeline.from_pretrained(REPO)
        pipe.load_components(dtype=torch.bfloat16)
        pipe.to("cuda")
    else:
        """
        좁은 카드는 **언어 모델을 잎 단위로 스트리밍**합니다.

        Music3 은 8B 짜리 전역 LLM 이 곡의 뼈대를 잡고 그 은닉 상태로 확산 모듈을 조건화하는
        짜임이라, 덩치의 대부분이 그 LLM 입니다. 그것만 흘려 보내면 8 GB 대에서도 돕니다.
        """
        from diffusers.hooks import apply_group_offloading

        manager = ComponentsManager()
        manager.enable_auto_cpu_offload(device="cuda")
        pipe = ModularPipeline.from_pretrained(REPO, components_manager=manager)
        pipe.load_components(dtype=torch.bfloat16)
        apply_group_offloading(
            pipe.language_model,
            onload_device=torch.device("cuda"),
            offload_type="leaf_level",
            use_stream=True,
        )
        common.log("VRAM 이 좁아 언어 모델을 흘리며 돌립니다 — 느리지만 돕니다.")
    _state["pipe"] = pipe
    _state["plan"] = plan


def unload():
    _state["pipe"] = None
    _state["plan"] = None
    common.free_vram()


def generate(output, opts, report):
    import soundfile as sf
    import torch

    started = time.time()
    pipe = _state["pipe"]
    seconds = float(opts.get("seconds") or 60.0)
    seed = common.resolve_seed(opts)
    lyrics = (opts.get("lyrics") or "").strip()

    kwargs = {
        "prompt": opts.get("prompt") or "",
        "audio_duration": seconds,
        "generator": torch.Generator("cuda" if torch.cuda.is_available() else "cpu").manual_seed(seed),
        "output": "audios",
        # 가사는 **늘 넘깁니다.** 안 넘기면 파이프라인이 «Required input 'lyrics' is missing» 으로 멈추고,
        # 빈 문자열을 주면 웅얼거리는 보컬이 낍니다. 연주곡은 [instrumental] 한 줄로 말합니다.
        "lyrics": lyrics or "[instrumental]",
    }

    report(15, "{}초짜리 {}을 만드는 중".format(int(seconds), "노래" if lyrics else "연주곡"))
    audio = pipe(**kwargs)[0]

    report(95, "파일로 쓰는 중")
    # 파이프라인 판에 따라 **토치 텐서일 때도, 넘파이 배열일 때도** 있습니다. 배열을 받은 채로
    # `.float().cpu()` 를 부르면 «'numpy.ndarray' object has no attribute 'float'» 로 끝납니다
    # (2026-09-16, 150초 BGM 을 다 만들어 놓고 마지막 줄에서 잃었습니다).
    data = audio.T
    if hasattr(data, "detach"):
        data = data.detach().float().cpu().numpy()
    sf.write(output, data, pipe.sampling_rate)
    out = {
        "seed": seed,
        "seconds_audio": seconds,
        "sample_rate": int(pipe.sampling_rate),
        "instrumental": not bool(lyrics),
        "generate_seconds": round(time.time() - started, 2),
    }
    # 요청한 정밀도와 실제로 올라간 정밀도 — 한 곳에서 만듭니다.
    out.update(common.precision_fields(_state["plan"]))
    return out
