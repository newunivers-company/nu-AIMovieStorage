# -*- coding: utf-8 -*-
"""**이 PC 에 맞는 SageAttention 휠을 고릅니다** — 없으면 «건너뜀» 이라고 답합니다.

**맞았습니다.** 처음에는 휠 주소를
`requirements.txt` 에 그대로 못 박아 두었는데, 그러면

  · 엔비디아가 아니거나 sm_80 보다 낮은 GPU(1660·2080 같은 튜링)
  · 윈도우가 아닌 PC
  · 토치·CUDA 판이 다른 PC

에서 **설치가 통째로 실패합니다.** 휠 하나 때문에 엔진을 아예 못 깔게 됩니다.

그래서 순서를 뒤집었습니다. 필수 꾸러미를 먼저 다 깔고, 그다음에 이 파일이 **그 PC 의
토치를 직접 물어봐서** 맞는 휠을 고릅니다. 맞는 것이 없으면 그냥 건너뜁니다 — 어텐션은
`common.use_fast_attention` 이 알아서 다음 순위(`flash_hub`·`_native_cudnn`)로 내려가니
**안 깔려도 그림은 나옵니다.** 느릴 뿐입니다.

    python fast_attention.py <적을 곳>

고른 결과를 `<적을 곳>` 에 **requirements 꼴로** 적습니다(건너뛰면 주석만 남습니다).
설치는 앱(`upscale.rs`)이 그 파일을 `uv pip install -r` 로 돌려서 합니다 — 여기서 직접
깔지 않는 이유는 uv 자리와 취소 깃발을 앱이 쥐고 있기 때문입니다.
"""
import json
import platform
import sys

# woct0rdho 커뮤니티 휠(윈도우 공식 빌드가 없습니다). 판을 올릴 때는 이 두 줄만 고칩니다.
RELEASE = "https://github.com/woct0rdho/SageAttention/releases/download/v2.2.0-windows.post6"
WHEEL = "sageattention-2.2.0%2B{tag}.post6-cp310-abi3-win_amd64.whl"
TRITON = "triton-windows==3.8.0.post28"

# SageAttention 2.x 의 커널은 암페어(sm_80)부터입니다. 그 아래는 빌드 자체가 없습니다.
MIN_CAPABILITY = 80


def decide():
    try:
        import torch
    except Exception as error:
        return [], "토치를 못 읽었습니다({})".format(error)

    if sys.platform != "win32":
        return [], "윈도우용 휠만 준비되어 있습니다(지금은 {})".format(sys.platform)
    if platform.machine().lower() not in ("amd64", "x86_64"):
        return [], "x64 용 휠만 있습니다(지금은 {})".format(platform.machine())
    if not torch.cuda.is_available():
        return [], "CUDA GPU 가 없습니다"

    major, minor = torch.cuda.get_device_capability(0)
    capability = major * 10 + minor
    name = torch.cuda.get_device_name(0)
    if capability < MIN_CAPABILITY:
        return [], "{} 은(는) sm_{} 이라 SageAttention 2.x 가 지원하지 않습니다(sm_80 이상)".format(name, capability)

    cuda = str(torch.version.cuda or "")
    if cuda.startswith("12."):
        cuda_tag = "cu128"
    elif cuda.startswith("13."):
        cuda_tag = "cu130"
    else:
        return [], "CUDA {} 용 휠이 없습니다".format(cuda or "없음")

    # 토치 판 → 휠 이름. 2.10 부터는 «andhigher» 하나로 묶여 있습니다.
    parts = torch.__version__.split("+")[0].split(".")
    try:
        version = (int(parts[0]), int(parts[1]))
    except Exception:
        return [], "토치 판을 못 읽었습니다({})".format(torch.__version__)
    if version >= (2, 10):
        torch_tag = "torch2.10.0andhigher"
    elif version == (2, 9):
        torch_tag = "torch2.9.1"
    else:
        return [], "토치 {} 용 휠이 없습니다(2.9 이상)".format(torch.__version__)

    wheel = "{}/{}".format(RELEASE, WHEEL.format(tag=cuda_tag + torch_tag))
    why = "{} (sm_{}) · CUDA {} · 토치 {}".format(name, capability, cuda, torch.__version__)
    # 트라이톤도 같이 — SageAttention 이 일부 경로에서 씁니다. 같은 명령에 넣어 한 번에 깝니다.
    return [wheel, TRITON], why


def main():
    install, why = decide()
    sys.stderr.write("빠른 어텐션: {} — {}\n".format("설치" if install else "건너뜀", why))
    sys.stdout.write(json.dumps({"install": install, "why": why}, ensure_ascii=False) + "\n")
    if len(sys.argv) > 1:
        lines = ["# 이 파일은 fast_attention.py 가 이 PC 를 보고 적었습니다. 손으로 고치지 마세요.",
                 "# " + why]
        lines.extend(install)
        with open(sys.argv[1], "w", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
