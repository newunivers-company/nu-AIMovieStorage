# -*- coding: utf-8 -*-
"""«로라» 라고 부르는 파일의 **갈래와 이름 규칙**을 가립니다.

2026-09-23 에 엔진마다 로라를 받아 돌려 보며 알게 된 것들입니다.

  · 갈래가 여럿입니다 — LoRA · DoRA · LoKr · LoHa. 뒤 둘은 아예 못 올리는데, 그냥 올리면
    「맞는 자리가 하나도 없습니다」 라는 말만 나와 사람이 무엇을 할지 알 수 없었습니다.
  · 이름 규칙도 여럿입니다 — 앞머리만 다른 것 · DoRA 의 `.magnitude` · kohya 의
    `lora_unet_…` + `lora_down`/`lora_up`.
  · **짐작으로 이어 붙이면 안 됩니다.** 비슷한 이름에 아무 데나 붙이면 100% 붙은 것처럼
    보이면서 엉뚱한 층에 얹힙니다 — 안 붙는 것보다 찾기 어렵습니다.

모델도 가중치도 없이 셉니다(머리말만 만들어 씁니다).

    python src-tauri/resources/local/test_lora_shapes.py
"""
import json
import os
import struct
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402


def _fake(keys):
    """키 이름만 든 safetensors 파일을 만듭니다 — 텐서 값은 필요 없습니다."""
    head = {key: {"dtype": "F32", "shape": [1], "data_offsets": [0, 4]} for key in keys}
    raw = json.dumps(head).encode("utf-8")
    path = os.path.join(tempfile.mkdtemp(), "x.safetensors")
    with open(path, "wb") as out:
        out.write(struct.pack("<Q", len(raw)))
        out.write(raw)
        out.write(b"\0\0\0\0")
    return path


class _Fake:
    """`named_modules()` 만 있는 가짜 모델."""

    def __init__(self, names):
        self._names = names

    def named_modules(self):
        return [(name, None) for name in self._names]


def test_family_lora():
    path = _fake(["transformer.a.lora_A.weight", "transformer.a.lora_B.weight"])
    assert common.lora_family(path) == ("LoRA", True)


def test_family_dora():
    path = _fake(["a.lora_A.weight", "a.lora_B.weight", "a.magnitude"])
    assert common.lora_family(path) == ("DoRA", True)
    assert common.lora_has_dora(path)


def test_family_lokr_is_refused():
    """LoKr 은 로라가 아니라 크로네커 곱입니다 — 올릴 길이 없습니다."""
    path = _fake(["lora_unet_x.lokr_w1", "lora_unet_x.lokr_w2", "lora_unet_x.alpha"])
    assert common.lora_family(path) == ("LoKr", False)
    try:
        common.guard_lora_family(path)
    except IOError as error:
        assert "LoKr" in str(error), "갈래 이름을 불러 줘야 사람이 LoRA 판을 찾습니다"
    else:
        raise AssertionError("LoKr 을 막지 않았습니다")


def test_family_loha_is_refused():
    path = _fake(["lora_unet_x.hada_w1_a", "lora_unet_x.hada_w1_b"])
    assert common.lora_family(path) == ("LoHa", False)


def test_plain_lora_passes_the_gate():
    """보통 로라는 그냥 지나가야 합니다 — 문이 너무 넓게 막으면 쓸 수 있는 것도 막힙니다."""
    common.guard_lora_family(_fake(["a.lora_A.weight", "a.lora_B.weight"]))


def test_real_lora_with_extra_keys_is_not_refused():
    """**곁다리가 얹혀 있다고 진짜 로라를 막으면 안 됩니다.**

    Wan 2.2 의 4스텝 증류 로라는 `lora_down`/`lora_up` 810개 옆에 편향·노름 차분
    (`.diff`·`.diff_b`·`.diff_m`) 690개를 달고 옵니다. 한때 «못 쓰는 꼬리가 보이면 막는다»
    로 적었다가 이 파일을 통째로 거절했습니다(2026-09-23 실측). 차분은 ComfyUI 가 따로
    얹는 덤이지 «로라가 아니라는 증거» 가 아닙니다.
    """
    path = _fake(
        [
            "diffusion_model.blocks.0.cross_attn.k.lora_down.weight",
            "diffusion_model.blocks.0.cross_attn.k.lora_up.weight",
            "diffusion_model.blocks.0.cross_attn.k.diff_b",
            "diffusion_model.blocks.0.cross_attn.norm_k.diff",
            "diffusion_model.blocks.0.cross_attn.o.diff_m",
        ]
    )
    assert common.lora_family(path) == ("LoRA", True)
    common.guard_lora_family(path)  # 막으면 안 됩니다


def test_extra_keys_never_reach_the_loader():
    """덤은 **걸러 냅니다.** 그대로 넘기면 「남은 키가 있다」 며 생성이 통째로 실패합니다."""
    out = common.fit_lora_keys(
        {
            "diffusion_model.blocks.0.q.lora_down.weight": 1,
            "diffusion_model.blocks.0.q.lora_up.weight": 2,
            "diffusion_model.blocks.0.q.diff_b": 3,
            "diffusion_model.blocks.0.norm.diff": 4,
            "diffusion_model.blocks.0.q.alpha": 5,
        }
    )
    assert set(out) == {"blocks.0.q.lora_A.weight", "blocks.0.q.lora_B.weight"}


def test_dora_keys_renamed():
    """`.magnitude` → `.lora_magnitude_vector.weight`. diffusers 가 이것을 보고 DoRA 를 켭니다."""
    out = common.fix_dora_keys({"a.lora_A.weight": 1, "a.magnitude": 2})
    assert "a.lora_magnitude_vector.weight" in out
    assert "a.magnitude" not in out
    # 아닌 것은 손대지 않습니다.
    same = {"a.lora_A.weight": 1}
    assert common.fix_dora_keys(same) is same


def test_prefix_is_stripped():
    out = common.fit_lora_keys(
        {"diffusion_model.blocks.0.q.lora_A.weight": 1, "transformer.blocks.0.q.lora_B.weight": 2}
    )
    assert "blocks.0.q.lora_A.weight" in out
    assert "blocks.0.q.lora_B.weight" in out


def test_kohya_names_are_matched_against_the_model():
    """밑줄을 **모델에게 물어** 되돌립니다 — 글자만 봐서는 어디가 점이었는지 모릅니다."""
    model = _Fake(["blocks.0.self_attn.q_proj", "blocks.0.self_attn.k_proj"])
    state = {
        "lora_unet_blocks_0_self_attn_q_proj.lora_down.weight": 1,
        "lora_unet_blocks_0_self_attn_q_proj.lora_up.weight": 2,
        "lora_unet_blocks_0_self_attn_q_proj.alpha": 3,
        "lora_unet_blocks_0_self_attn_k_proj.lora_down.weight": 4,
        "lora_unet_blocks_0_self_attn_k_proj.lora_up.weight": 5,
    }
    out = common.fit_kohya_keys(model, state)
    assert "blocks.0.self_attn.q_proj.lora_A.weight" in out
    assert "blocks.0.self_attn.q_proj.lora_B.weight" in out
    assert "blocks.0.self_attn.k_proj.lora_A.weight" in out
    # 알파는 버립니다 — 랭크는 텐서 모양에 있고, 함께 넘기면 diffusers 가 거절합니다.
    assert not any(key.endswith(".alpha") for key in out)


def test_kohya_does_not_guess():
    """모델에 없는 이름은 **버립니다.** 비슷하다고 아무 데나 붙이면 엉뚱한 층에 얹힙니다."""
    model = _Fake(["blocks.0.self_attn.q_proj"])
    out = common.fit_kohya_keys(
        model, {"lora_unet_blocks_9_mlp_layer1.lora_down.weight": 1}
    )
    assert out == {}


def test_fits_counts_real_meetings():
    model = _Fake(["blocks.0.q", "blocks.0.k"])
    assert common.lora_fits(model, {"blocks.0.q.lora_A.weight": 1}) == 1
    assert common.lora_fits(model, {"nowhere.lora_A.weight": 1}) == 0


def test_mismatch_message_shows_both_sides():
    """무엇이 어긋났는지 **양쪽 이름**을 보여 줘야 고칠 길이 보입니다."""
    model = _Fake(["transformer_blocks.0.attn1.to_q"])
    error = common.lora_mismatch(model, {"blocks_0_self_attn_q_proj.lora_A.weight": 1}, "D:/a/x.safetensors")
    text = str(error)
    assert "x.safetensors" in text
    assert "transformer_blocks.0.attn1.to_q" in text
    assert "blocks_0_self_attn_q_proj" in text


if __name__ == "__main__":
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
