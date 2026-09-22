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

_state = {"pipe": None}


def info(root):
    return {
        "repo": "MiniMaxAI/MiniMax-Music3",
        "notes": "완곡 BGM. 32kHz 스테레오. 가사를 비우면 연주곡입니다.",
    }


def _vram_gb():
    import torch

    if not torch.cuda.is_available():
        return 0.0
    return torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)


def load(root, opts):
    if _state["pipe"] is not None:
        return
    import torch
    from diffusers import ComponentsManager, ModularPipeline

    common.use_engine_cache(root)
    vram = _vram_gb()
    common.log("MiniMax-Music3 을 올립니다 (VRAM {:.0f} GB).".format(vram))

    if vram >= 24:
        pipe = ModularPipeline.from_pretrained("MiniMaxAI/MiniMax-Music3")
        pipe.load_components(dtype=torch.bfloat16)
        pipe.to("cuda")
    else:
        """
        24 GB 미만이면 **언어 모델을 잎 단위로 스트리밍**합니다.

        Music3 은 8B 짜리 전역 LLM 이 곡의 뼈대를 잡고 그 은닉 상태로 확산 모듈을 조건화하는
        짜임이라, 덩치의 대부분이 그 LLM 입니다. 그것만 흘려 보내면 8 GB 대에서도 돕니다.
        """
        from diffusers.hooks import apply_group_offloading

        manager = ComponentsManager()
        manager.enable_auto_cpu_offload(device="cuda")
        pipe = ModularPipeline.from_pretrained(
            "MiniMaxAI/MiniMax-Music3", components_manager=manager
        )
        pipe.load_components(dtype=torch.bfloat16)
        apply_group_offloading(
            pipe.language_model,
            onload_device=torch.device("cuda"),
            offload_type="leaf_level",
            use_stream=True,
        )
    _state["pipe"] = pipe


def unload():
    _state["pipe"] = None
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
    return {
        "seed": seed,
        "seconds_audio": seconds,
        "sample_rate": int(pipe.sampling_rate),
        "instrumental": not bool(lyrics),
        "generate_seconds": round(time.time() - started, 2),
    }
