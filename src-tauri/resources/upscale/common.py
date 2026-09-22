# -*- coding: utf-8 -*-
"""엔진 모듈이 같이 쓰는 도구 — 이미지 읽기/쓰기, 목표 크기 계산, 타일, 로그.

왜 따로 두는가: 엔진마다 «목표 긴 변을 어떻게 짧은 변으로 환산하는가»,
«마무리 리사이즈를 어떤 필터로 하는가» 가 달라지면 같은 «4K» 를 골라도
엔진마다 다른 크기가 나옵니다. 계산을 한 군데로 모아 둡니다.

엔진 모듈이 구현할 것은 세 함수뿐입니다.
    load(root, opts)                 — 모델을 올린다(이미 올라가 있으면 그냥 돌아온다)
    upscale(img, target, opts, report) -> PIL.Image
    unload()                         — VRAM 을 비운다
"""

import os
import sys
import json
import time

from PIL import Image

# 아주 큰 그림(8K 파노라마)을 열 때 PIL 이 «폭탄» 으로 의심해 막습니다.
# 우리가 만든 파일만 다루므로 상한을 풉니다.
Image.MAX_IMAGE_PIXELS = None


def log(message):
    """stderr 로 한 줄. stdout 은 프로토콜 전용이라 절대 쓰면 안 됩니다."""
    sys.stderr.write("[{}] {}\n".format(time.strftime("%H:%M:%S"), message))
    sys.stderr.flush()


def round16(value):
    """16 의 배수로 반올림(최소 16). DiT·VAE 가 8~16 배수를 요구합니다."""
    n = int(round(float(value) / 16.0)) * 16
    return max(16, n)


def round8(value):
    """8 의 배수로 반올림(최소 8). NVIDIA Maxine 이 8 배수를 요구합니다."""
    n = int(round(float(value) / 8.0)) * 8
    return max(8, n)


def resolve_target(size, target):
    """(원본 크기, 목표 지정) → 결과 크기.

    `long_edge` 는 **긴 변**입니다. 짧은 변은 원본 비율대로 계산해 16 배수로 맞춥니다
    (프런트의 «4K» 는 긴 변 4096 을 뜻합니다 — 정사각 6면이면 그대로 한 변).
    `scale` 은 배율. 둘 다 없으면 원본 그대로.
    """
    width, height = int(size[0]), int(size[1])
    if width <= 0 or height <= 0:
        raise ValueError("원본 크기를 읽지 못했습니다.")
    target = target or {}
    long_edge = target.get("long_edge") or target.get("longEdge")
    scale = target.get("scale")
    if long_edge:
        long_edge = int(long_edge)
        if width >= height:
            out_w = round16(long_edge)
            out_h = round16(long_edge * height / float(width))
        else:
            out_h = round16(long_edge)
            out_w = round16(long_edge * width / float(height))
        return out_w, out_h
    if scale:
        scale = float(scale)
        return round16(width * scale), round16(height * scale)
    return round16(width), round16(height)


def open_image(path):
    """원본을 RGB 로 엽니다. 알파는 버립니다 — 업스케일 모델이 3채널만 받습니다."""
    img = Image.open(path)
    if img.mode not in ("RGB",):
        img = img.convert("RGB")
    else:
        img.load()
    return img


def fit_to(img, size):
    """마무리 리사이즈. 이미 그 크기면 그대로 돌려줍니다(불필요한 재샘플링 금지)."""
    if (img.width, img.height) == (int(size[0]), int(size[1])):
        return img
    return img.resize((int(size[0]), int(size[1])), Image.LANCZOS)


def save_image(img, path):
    """결과를 씁니다. 확장자를 따르고, jpg 는 품질 95·webp 는 무손실.

    임시 파일에 쓴 뒤 바꿔치기하는 것은 **Rust 가** 합니다(원본을 덮어쓰는 경우가
    있어 중간에 끊기면 원본이 반쪽이 됩니다). 여기서는 Rust 가 준 자리에 그대로 씁니다.

    그래서 Rust 가 주는 임시 이름은 **확장자가 끝에 남는 꼴**이어야 합니다
    (`.<이름>.업스케일중.jpg`). 예전에는 `.<이름>.업스케일중` 이라 여기 splitext 가
    확장자를 «업스케일중» 으로 읽고 늘 else 갈래(PNG)로 떨어졌습니다 — 이름만 jpg 인
    20 MB PNG 가 나갔고, 아래 jpg 품질 95·webp 무손실 갈래는 통째로 죽은 코드였습니다.
    """
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    parent = os.path.dirname(path)
    if parent and not os.path.isdir(parent):
        os.makedirs(parent, exist_ok=True)
    if ext in ("jpg", "jpeg"):
        img.save(path, "JPEG", quality=95, subsampling=0)
    elif ext == "webp":
        img.save(path, "WEBP", lossless=True)
    else:
        img.save(path, "PNG")
    return path


# ─────────────────────────── 타일 ───────────────────────────


def tile_positions(length, tile, overlap):
    """한 축의 타일 시작 좌표들. 마지막 타일은 끝에 붙여 잘림을 막습니다."""
    tile = max(16, int(tile))
    overlap = max(0, int(overlap))
    if length <= tile:
        return [0]
    step = max(1, tile - overlap)
    positions = list(range(0, max(1, length - tile + 1), step))
    if positions[-1] != length - tile:
        positions.append(length - tile)
    return positions


def feather_mask(width, height, overlap):
    """타일 이음매를 부드럽게 할 가중치(가장자리에서 0 → 안쪽에서 1).

    numpy 로 만들고 float32 로 돌려줍니다. 겹침이 0 이면 전부 1.
    """
    import numpy as np

    mask = np.ones((height, width), dtype="float32")
    if overlap <= 0:
        return mask
    ramp = np.linspace(0.0, 1.0, min(overlap, width // 2 or 1), dtype="float32")
    if ramp.size:
        mask[:, : ramp.size] *= ramp[None, :]
        mask[:, -ramp.size :] *= ramp[::-1][None, :]
    ramp = np.linspace(0.0, 1.0, min(overlap, height // 2 or 1), dtype="float32")
    if ramp.size:
        mask[: ramp.size, :] *= ramp[:, None]
        mask[-ramp.size :, :] *= ramp[::-1][:, None]
    return mask


def tiled_forward(tensor, scale, tile, overlap, run, report=None):
    """(1,3,H,W) 텐서를 타일로 나눠 `run(tile_tensor)` 을 부르고 겹침을 페더로 섞습니다.

    8K 를 한 번에 넣으면 96GB 라도 어텐션에서 터집니다. 타일이 정답이고,
    이음매는 페더로 지웁니다(겹침 없이 이어 붙이면 격자 자국이 남습니다).
    """
    import torch

    _, _, height, width = tensor.shape
    out_h, out_w = height * scale, width * scale
    out = torch.zeros((1, 3, out_h, out_w), dtype=torch.float32, device=tensor.device)
    weight = torch.zeros((1, 1, out_h, out_w), dtype=torch.float32, device=tensor.device)

    ys = tile_positions(height, tile, overlap)
    xs = tile_positions(width, tile, overlap)
    total = len(ys) * len(xs)
    done = 0
    for y in ys:
        for x in xs:
            piece = tensor[:, :, y : y + tile, x : x + tile]
            result = run(piece).float()
            ph, pw = result.shape[-2], result.shape[-1]
            mask = torch.from_numpy(feather_mask(pw, ph, overlap * scale)).to(result.device)
            mask = mask[None, None, :, :]
            oy, ox = y * scale, x * scale
            out[:, :, oy : oy + ph, ox : ox + pw] += result * mask
            weight[:, :, oy : oy + ph, ox : ox + pw] += mask
            done += 1
            if report:
                report(int(done * 100 / max(1, total)), "타일 {}/{}".format(done, total))
    return out / weight.clamp(min=1e-6)


def to_tensor(img):
    """PIL RGB → (1,3,H,W) float32 0~1 텐서(CPU)."""
    import numpy as np
    import torch

    array = np.asarray(img, dtype="float32") / 255.0
    return torch.from_numpy(array).permute(2, 0, 1).unsqueeze(0).contiguous()


def to_image(tensor):
    """(1,3,H,W) 또는 (3,H,W) 0~1 텐서 → PIL RGB."""
    import numpy as np

    if tensor.dim() == 4:
        tensor = tensor[0]
    array = tensor.detach().clamp(0.0, 1.0).float().cpu().permute(1, 2, 0).numpy()
    return Image.fromarray((array * 255.0 + 0.5).astype("uint8"), "RGB")


def torch_info():
    """`ready` 이벤트에 실을 값 — CUDA 여부·장치 이름·torch 판·VRAM(GB)."""
    try:
        import torch
    except Exception as error:  # torch 가 없는 엔진(upscayl 등)
        return {"cuda": False, "device": "", "torch": "", "vram_gb": 0, "note": str(error)}
    cuda = bool(torch.cuda.is_available())
    device = torch.cuda.get_device_name(0) if cuda else ""
    vram = 0
    if cuda:
        try:
            vram = int(round(torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)))
        except Exception:
            vram = 0
    return {"cuda": cuda, "device": device, "torch": torch.__version__, "vram_gb": vram}


def dump(obj):
    """프로토콜 한 줄 — stdout 에 JSON 을 쓰고 바로 흘려보냅니다."""
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()
