# -*- coding: utf-8 -*-
"""빠르고 가벼움 — spandrel 로 RealPLKSR / SPAN 가중치를 돌립니다.

모델은 4× 고정입니다. 목표 크기는 4× 로 키운 뒤 Lanczos 로 맞춥니다
(마무리 리사이즈는 worker 가 `common.fit_to` 로 합니다).

왜 타일인가: 8K 한 장을 통째로 넣으면 중간 텐서가 수십 GB 가 됩니다. 512 타일 ·
겹침 32 로 나누고 페더로 섞습니다(겹침 없이 이어 붙이면 격자 자국이 보입니다).
"""

import os

import common

_STATE = {"model": None, "name": "", "scale": 4}


def _model_dir(root):
    return os.path.join(root, "models")


def _find_model(root, name):
    """`models/<이름>.safetensors|.pth` 를 찾습니다. 이름은 프런트의 모델 id 와 같습니다."""
    directory = _model_dir(root)
    for ext in (".safetensors", ".pth"):
        candidate = os.path.join(directory, name + ext)
        if os.path.isfile(candidate):
            return candidate
    raise IOError("모델 파일이 없습니다: {} (폴더 {})".format(name, directory))


def load(root, opts):
    import torch
    from spandrel import ModelLoader

    name = (opts or {}).get("model") or "4xNomosWebPhoto_RealPLKSR"
    if _STATE["model"] is not None and _STATE["name"] == name:
        return

    unload()
    path = _find_model(root, name)
    common.log("모델을 올립니다: {}".format(path))
    descriptor = ModelLoader().load_from_file(path)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    descriptor.to(device)
    # fp16 은 이 갈래(RealPLKSR·SPAN)에서 안전합니다. DAT/HAT 는 bf16 이 필요해 half 를 건너뜁니다.
    if device == "cuda" and descriptor.supports_half:
        descriptor.model.half()
    descriptor.eval()
    _STATE["model"] = descriptor
    _STATE["name"] = name
    _STATE["scale"] = int(getattr(descriptor, "scale", 4) or 4)
    common.log("올렸습니다 — 배율 {}× · 장치 {}".format(_STATE["scale"], device))


def unload():
    if _STATE["model"] is None:
        return
    _STATE["model"] = None
    _STATE["name"] = ""
    try:
        import torch

        torch.cuda.empty_cache()
    except Exception:
        pass


def upscale(img, target, opts, report):
    import torch

    descriptor = _STATE["model"]
    if descriptor is None:
        raise RuntimeError("모델이 올라가 있지 않습니다.")

    opts = opts or {}
    tile = int(opts.get("tile") or 512)
    overlap = int(opts.get("tile_overlap") or 32)
    scale = _STATE["scale"]
    device = next(descriptor.model.parameters()).device
    dtype = next(descriptor.model.parameters()).dtype

    tensor = common.to_tensor(img).to(device)

    def run(piece):
        with torch.no_grad():
            return descriptor(piece.to(dtype)).float()

    report(10, "타일 계산")
    with torch.no_grad():
        if img.width <= tile and img.height <= tile:
            result = run(tensor)
            report(90, "마무리")
        else:
            result = common.tiled_forward(tensor, scale, tile, overlap, run, report)
    out = common.to_image(result)
    del tensor, result
    torch.cuda.empty_cache()
    return out
