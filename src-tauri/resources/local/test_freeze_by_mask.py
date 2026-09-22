# -*- coding: utf-8 -*-
"""«여기만 움직인다» 마스크가 **눈금까지 그대로** 섞는지 셉니다.

실측에서 두 번 터졌습니다(2026-09-23).

  ① `if not frames:` — 엔진이 numpy 를 주면 그 자리에서 예외가 납니다.
  ② uint8 로 바꿔 돌려줬더니 diffusers 의 `export_to_video` 가 numpy 프레임을
     «0~1 실수» 로 보고 255 를 **또** 곱했습니다. 영상이 224KB 에서 72KB 로 망가졌는데,
     로그로는 아무 일도 없어 보였습니다.

그래서 세 모양(PIL · float 0~1 · uint8 배열)을 전부 셉니다. 모델이 필요 없어 몇 ms 입니다.

    python -m pytest src-tauri/resources/local/test_freeze_by_mask.py
"""
import os
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

W, H = 64, 32


def _mask():
    """왼쪽 절반만 하얗게 = 왼쪽만 움직인다."""
    arr = np.zeros((H, W), "uint8")
    arr[:, : W // 2] = 255
    path = os.path.join(tempfile.mkdtemp(), "mask.png")
    Image.fromarray(arr).save(path)
    return path


def test_pil():
    frames = [
        Image.fromarray(np.full((H, W, 3), 10, "uint8")),
        Image.fromarray(np.full((H, W, 3), 200, "uint8")),
    ]
    out = common.freeze_by_mask(frames, _mask())
    arr = np.asarray(out[1])
    assert arr[:, 5].mean() == 200, "흰 구역은 새 프레임 그대로여야 합니다"
    assert arr[:, W - 5].mean() == 10, "검은 구역은 첫 장면이어야 합니다"
    assert hasattr(out[1], "convert"), "PIL 로 받았으면 PIL 로 돌려줘야 합니다"


def test_float_0_1():
    """diffusers 가 주는 모양. **255 를 곱해 돌려주면 안 됩니다.**"""
    frames = np.stack(
        [np.full((H, W, 3), 0.04, "float32"), np.full((H, W, 3), 0.8, "float32")]
    )
    out = common.freeze_by_mask(frames, _mask())
    assert out.dtype == np.float32, "자료형이 바뀌면 export_to_video 가 255 를 또 곱합니다"
    assert abs(float(out[1][:, 5].mean()) - 0.8) < 1e-5
    assert abs(float(out[1][:, W - 5].mean()) - 0.04) < 1e-5


def test_uint8_array():
    frames = np.stack(
        [np.full((H, W, 3), 10, "uint8"), np.full((H, W, 3), 200, "uint8")]
    )
    out = common.freeze_by_mask(frames, _mask())
    assert out.dtype == np.uint8
    assert out[1][:, 5].mean() == 200
    assert out[1][:, W - 5].mean() == 10


def test_first_frame_untouched():
    frames = [Image.fromarray(np.full((H, W, 3), 10, "uint8"))] * 3
    out = common.freeze_by_mask(frames, _mask())
    assert out[0] is frames[0], "첫 장면은 기준이라 손대지 않습니다"


def test_quietly_passes_when_nothing_to_do():
    """못 읽거나 빈 것에 걸려 **생성을 통째로 날리면 안 됩니다.**"""
    frames = [Image.fromarray(np.zeros((H, W, 3), "uint8"))]
    assert common.freeze_by_mask(frames, None) is frames
    assert common.freeze_by_mask(frames, "D:/없는파일.png") is frames
    assert common.freeze_by_mask([], _mask()) == []
    assert len(common.freeze_by_mask(np.zeros((0, H, W, 3), "uint8"), _mask())) == 0


def test_all_black_is_ignored():
    """전부 검으면 영상이 정지 사진이 됩니다 — 그릴 때의 실수 쪽이 훨씬 잦습니다."""
    path = os.path.join(tempfile.mkdtemp(), "black.png")
    Image.fromarray(np.zeros((H, W), "uint8")).save(path)
    frames = [
        Image.fromarray(np.full((H, W, 3), 10, "uint8")),
        Image.fromarray(np.full((H, W, 3), 200, "uint8")),
    ]
    assert common.freeze_by_mask(frames, path) is frames


def test_mask_is_resized():
    """마스크와 첫 장면의 크기가 달라도 늘려 맞춥니다."""
    arr = np.zeros((H * 2, W * 2), "uint8")
    arr[:, : W] = 255
    path = os.path.join(tempfile.mkdtemp(), "big.png")
    Image.fromarray(arr).save(path)
    frames = [
        Image.fromarray(np.full((H, W, 3), 10, "uint8")),
        Image.fromarray(np.full((H, W, 3), 200, "uint8")),
    ]
    out = np.asarray(common.freeze_by_mask(frames, path)[1])
    assert out[:, 5].mean() > 150 and out[:, W - 5].mean() < 60


if __name__ == "__main__":
    # pytest 없이도 돕니다 — CI 는 numpy·pillow 만 넣고 이 파일을 그냥 실행합니다.
    failed = 0
    for name, fn in sorted(globals().items()):
        if not name.startswith("test_") or not callable(fn):
            continue
        try:
            fn()
            print("  ok   {}".format(name))
        except Exception as exc:
            failed += 1
            print("  FAIL {} — {}".format(name, exc))
    print("{}개 실패".format(failed) if failed else "전부 통과")
    raise SystemExit(1 if failed else 0)
