# -*- coding: utf-8 -*-
"""ACE-Step — 이 컴퓨터에서 도는 음악(BGM) 엔진.



사용자가 지목한 **MiniMax-Music3** 가 기본입니다(`minimaxmusic.py`). 이 엔진은 그것이
무거운 기계를 위한 **가벼운 대안**입니다 — ACE-Step 은 3.5B 라 훨씬 가볍습니다.
태그로 장르·악기·분위기를 주고, 가사를 주면 노래로, `[inst]` 만 주면 연주곡으로 뽑습니다.
우리 쓰임(BGM)은 대개 연주곡입니다.

프롬프트 모양
    opts.prompt  "cinematic orchestral, strings, slow build, melancholic, 90 bpm"
    opts.lyrics  "[inst]"  ← 가사 없는 연주곡. 노래로 하려면 가사를 그대로 넣습니다.
"""

import time

import common

_state = {"pipe": None}

# bf16 으로 통째로 올릴 때 필요한 GB(가중치 7 + 텍스트 인코더·중간값). 이보다 좁으면 흘립니다.
BF16_GB = 10.0


def info(root):
    return {
        "repo": "ACE-Step/ACE-Step-v1-3.5B",
        "notes": "BGM. 태그로 장르·악기·bpm 을 주고, [inst] 면 연주곡입니다.",
    }


def load(root, opts):
    if _state["pipe"] is not None:
        return
    from acestep.pipeline_ace_step import ACEStepPipeline

    models = common.use_engine_cache(root)
    # 이 엔진만 **사양을 안 보고** 늘 bf16 으로 통째로 올렸습니다.
    # 3.5B 라 가중치는 7 GB 쯤이지만 텍스트 인코더까지 올리면 10 GB 를 넘습니다 —
    # 8 GB 카드에서는 그대로 터집니다. bitsandbytes 로는 못 줄이는 파이프라인이라
    # (자체 `quantized` 는 따로 받은 체크포인트를 요구합니다) **CPU 오프로드**로 내립니다.
    vram = common.vram_gb()
    tight = 0 < vram < BF16_GB
    common.log("ACE-Step 을 올립니다 (VRAM {:.0f} GB{}).".format(vram, " · CPU 로 흘립니다" if tight else ""))
    pipe = ACEStepPipeline(
        checkpoint_dir=models,
        dtype="bfloat16",
        torch_compile=False,
        cpu_offload=tight,
    )
    # 첫 호출에서 가중치를 받아 올립니다(없으면 여기서 내려받습니다).
    pipe.load_checkpoint(models)
    _state["pipe"] = pipe


def unload():
    _state["pipe"] = None
    common.free_vram()


def generate(output, opts, report):
    started = time.time()
    pipe = _state["pipe"]
    seconds = float(opts.get("seconds") or 60.0)
    seed = common.resolve_seed(opts)
    # 가사를 안 주면 연주곡입니다 — BGM 은 대개 이쪽입니다.
    lyrics = opts.get("lyrics")
    if lyrics is None or not str(lyrics).strip():
        lyrics = "[inst]"

    _save_with_soundfile()
    report(15, "{}초짜리 음악을 만드는 중".format(int(seconds)))
    pipe(
        prompt=opts.get("prompt") or "",
        lyrics=str(lyrics),
        audio_duration=seconds,
        infer_step=int(opts.get("steps") or 60),
        guidance_scale=float(opts.get("guidance") or 15.0),
        manual_seeds=str(seed),
        save_path=output,
        format=output.rsplit(".", 1)[-1].lower(),
    )
    return {
        "seed": seed,
        "seconds_audio": seconds,
        "generate_seconds": round(time.time() - started, 2),
    }


def _save_with_soundfile():
    """**소리를 `soundfile` 로 씁니다.**

    2026-09-18 실측: 음악을 다 만들어 놓고 마지막 저장에서 죽었습니다.

        TorchCodec is required for save_with_torchcodec.
        → torchcodec 을 깔았더니: Could not load libtorchcodec.
          FFmpeg is not properly installed in your environment.

    ACE-Step 은 `torchaudio.save(..., backend="soundfile")` 라고 **soundfile 을 콕 집어**
    부르는데, torchaudio 2.11 이 그 부탁을 무시하고 전부 torchcodec 으로 보냅니다.
    torchcodec 은 FFmpeg 공유 라이브러리를 요구하고, 그것을 깔자고 엔진마다 FFmpeg 를
    끌고 들어올 수는 없습니다 — 우리에겐 이미 `soundfile` 이 있습니다.

    그래서 저장 함수만 갈아 끼웁니다. 파이프라인 안에서 부르는 것이라 여기서 바꿔야
    닿습니다. 한 번만 바꾸고, 이미 바꿔 두었으면 지나갑니다.
    """
    import torchaudio

    if getattr(torchaudio.save, "_우리것", False):
        return

    def save(path, tensor, sample_rate, **kwargs):
        import soundfile

        data = tensor.detach().cpu().numpy()
        # torchaudio 는 (채널, 표본), soundfile 은 (표본, 채널) 입니다.
        if data.ndim == 2:
            data = data.T
        soundfile.write(str(path), data, int(sample_rate))

    save._우리것 = True
    torchaudio.save = save
