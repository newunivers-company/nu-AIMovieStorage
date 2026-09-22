"""허깅페이스에서 받을 때 **기다렸다 다시** 하는 한 벌.

사용자 2026-09-16 에 허깅페이스가 `429 이용 제한을 걸어야 했습니다` 를 돌려줬습니다. 429 는 «지금 요청이 몰렸으니 잠깐 쉬어라»
라는 뜻이라 **잠시 뒤 다시 하면 대개 됩니다.** 그런데 우리는 한 번 실패하면 그대로 멈춰서, 12 GB 를 받다 마지막에 걸리면
처음부터 다시 눌러야 했습니다.

# 왜 여기 따로 두는가

받는 엔진이 여럿입니다(SAM 3D Body·FLUX·완·미니맥스). 엔진마다 재시도를 적으면 한 군데만 고치는 사고가 납니다 —
공통 규칙 1 과 같은 이유로 한 곳에 둡니다.

# 토큰

`HF_TOKEN` 은 앱이 워커를 띄울 때 환경 변수로 넘깁니다(`upscale.rs`). huggingface_hub 가 알아서 읽지만, 승인이 필요한
저장소에서 «왜 401 이 나는지» 를 사람이 알아보게 하려고 여기서 한 번 더 명시해 넘깁니다.
"""

import os
import time

import common  # 워커가 HERE 를 sys.path 에 넣어 두므로 엔진 모듈과 같은 길로 보입니다


def token():
    """설정에 넣어 둔 허깅페이스 토큰. 없으면 None — 공개 저장소는 그대로 받습니다."""
    value = (os.environ.get("HF_TOKEN") or "").strip()
    return value or None


def _sleep_for(error_text, attempt):
    """429 가 «몇 초 뒤에» 를 알려 주면 그만큼, 아니면 점점 길게(4·8·16…초) 기다립니다."""
    import re

    found = re.search(r"retry[- ]after[\"']?\s*[:=]?\s*(\d+)", error_text, re.IGNORECASE)
    if found:
        return min(120, max(1, int(found.group(1))))
    return min(120, 4 * (2 ** attempt))


def retrying(call, attempts=5, on_wait=None):
    """`call()` 을 하다 429·5xx 를 만나면 기다렸다 다시 합니다. 그 밖의 오류는 그대로 올립니다.

    `on_wait(seconds, attempt, error)` 를 주면 기다리기 전에 부릅니다 — 진행 표시에 「제한에 걸려 n초 뒤 다시」 를 띄우려고요.
    """
    last = None
    for attempt in range(attempts):
        try:
            return call()
        except Exception as error:  # noqa: BLE001 — 무엇이 오든 글로 판정합니다(허브 예외 종류가 판마다 다릅니다)
            text = str(error)
            temporary = (
                "429" in text
                or "Too Many Requests" in text
                or "rate limit" in text.lower()
                or "502" in text
                or "503" in text
                or "504" in text
            )
            if not temporary or attempt == attempts - 1:
                raise
            wait = _sleep_for(text, attempt)
            if on_wait:
                on_wait(wait, attempt + 1, text)
            time.sleep(wait)
            last = error
    if last:
        raise last
    return None


def explain(error_text, repo):
    """받기 실패를 **사람이 읽는 말**로. 아니면 None — 부르는 쪽이 원래 오류를 그대로 냅니다."""
    text = error_text or ""
    if "429" in text or "Too Many Requests" in text or "rate limit" in text.lower():
        return (
            "허깅페이스가 잠시 이용 제한(429)을 걸었습니다. 몇 분 뒤 다시 눌러 주세요. "
            "설정 → 로컬 모델에 «허깅페이스 토큰» 을 넣어 두면 로그인한 계정으로 받아 제한에 덜 걸립니다."
        )
    if "401" in text or "403" in text or "gated" in text.lower() or "Unauthorized" in text:
        return (
            "가중치를 받을 권한이 없습니다. 허깅페이스의 {} 페이지에서 접근 승인을 받은 계정으로 토큰(읽기)을 만들어 "
            "설정 → 로컬 모델 → «허깅페이스 토큰» 에 넣으세요.".format(repo)
        )
    return None


# ─────────────────────────── 저장소 통째로 미리 받기 ───────────────────────────
#
# 그전까지 미니맥스·완의 가중치는 **첫 생성 때** 받았습니다.
# 그런데 미니맥스 H3 의 레퍼런스 워크플로(ref2va)는 `transformer_ref/`(62 GB)라는 **다른 덩어리**를
# 쓰고, 완은 첫 장면 그림을 주면 I2V 저장소(60 GB)를 **한 벌 더** 씁니다. 그래서 사용자의 기계에는
# 글·첫 프레임용 가중치만 있고, 레퍼런스 영상을 처음 뽑는 날 «생성 중» 안에서 62 GB 를 말없이
# 받게 돼 있었습니다. 설치 때(그리고 이미 깔린 엔진은 단추로) 미리 받아 두려고 이 한 벌을 둡니다.
#
# 진행률은 **캐시 폴더의 크기를 재서** 냅니다. tqdm 을 갈아 끼우는 길도 있지만
# · 판마다(0.36 / 1.31) 파일 하나짜리 막대가 tqdm_class 를 타는지가 다르고,
# · 이미 받아 둔 파일은 막대가 아예 안 떠서 «이어받기» 때 퍼센트가 0 부터 시작하며,
# · 받다 만 조각(initial)은 update 로 안 들어옵니다.
# 폴더를 재면 이 셋이 다 저절로 맞습니다 — 수백 파일이라 2초에 한 번 재도 값쌉니다.


def _repo_cache_dir(repo):
    """`<HF_HUB_CACHE>/models--org--name` — `common.use_engine_cache` 가 엔진 폴더 안으로 돌려 둔 그 자리.

    환경 변수를 직접 읽지 않고 `constants.HF_HUB_CACHE` 를 씁니다 — `snapshot_download` 가 기본 cache_dir 로 쓰는 값이
    바로 그것이라, 재는 자리가 받는 자리와 늘 같습니다. 예전에는 `HUGGINGFACE_HUB_CACHE` 만 읽어서, 환경에 `HF_HUB_CACHE`
    가 따로 잡혀 있으면(허브는 그쪽을 먼저 봅니다) 받는 자리와 재는 자리가 갈려 퍼센트가 0 에 머물렀습니다(2026-09-22 점검).
    """
    from huggingface_hub import constants

    return os.path.join(constants.HF_HUB_CACHE, "models--" + repo.replace("/", "--"))


def _repo_bytes(repo, allow_patterns=None):
    """저장소에서 받을 파일의 합(바이트). 모르면 None — 그때는 퍼센트 없이 «받은 양» 만 보여 줍니다."""
    from fnmatch import fnmatch

    try:
        from huggingface_hub import HfApi

        info = HfApi(token=token()).model_info(repo, files_metadata=True)
    except Exception as error:  # noqa: BLE001 — 목록을 못 읽어도 받기는 계속합니다
        common.log("{} 의 파일 목록을 읽지 못해 퍼센트 없이 받습니다: {}".format(repo, error))
        return None
    patterns = [allow_patterns] if isinstance(allow_patterns, str) else list(allow_patterns or [])
    total = 0
    for sibling in info.siblings or []:
        name = getattr(sibling, "rfilename", "") or ""
        if patterns and not any(fnmatch(name, pattern) for pattern in patterns):
            continue
        total += int(getattr(sibling, "size", 0) or 0)
    return total or None


def _cached_bytes(folder):
    """캐시 폴더에 **실제로 받아 둔** 바이트.

    사용자의 기계(2026-09-22 실측)는 심볼릭 링크를 못 걸어 `snapshots/` 에 파일이 **복사본**으로 놓이고
    `blobs/` 에도 같은 것이 49 GB 남아 있습니다. 둘을 다 더하면 두 배가 되므로 `snapshots/` 만 세고,
    `blobs/` 에서는 받다 만 `.incomplete` 만 더합니다. 링크가 걸리는 환경(리눅스·개발자 모드)에서는
    snapshots 의 링크가 가리키는 blob 크기를 따라가 셉니다 — 어느 쪽이든 한 번만 세게.
    """
    total = 0
    snapshots = os.path.join(folder, "snapshots")
    for base, _dirs, files in os.walk(snapshots):
        for name in files:
            path = os.path.join(base, name)
            try:
                total += os.stat(path).st_size if os.path.islink(path) else os.lstat(path).st_size
            except OSError:
                continue
    blobs = os.path.join(folder, "blobs")
    try:
        names = os.listdir(blobs)
    except OSError:
        names = []
    for name in names:
        if not name.endswith(".incomplete"):
            continue
        try:
            total += os.lstat(os.path.join(blobs, name)).st_size
        except OSError:
            continue
    return total


def _gb(value):
    return "{:.1f} GB".format(value / float(1024 ** 3))


def snapshot(repo, report, allow_patterns=None):
    """저장소 하나를 통째로(또는 `allow_patterns` 만) 받습니다. 받아 둔 자리를 돌려줍니다.

    `report(percent, message)` 로 진행을 흘립니다 — 2초마다, «받은 양 / 전체» 로. 429·5xx 는 `retrying` 이
    기다렸다 다시 하고, 권한·제한 오류는 `explain` 이 사람 말로 바꿉니다(sam3dbody 와 같은 길).
    이미 받아 둔 파일은 huggingface_hub 가 건너뛰므로, 다 있으면 몇 초 만에 돌아옵니다.
    """
    import threading

    from huggingface_hub import snapshot_download

    folder = _repo_cache_dir(repo)
    total = _repo_bytes(repo, allow_patterns)
    stop = threading.Event()

    def tick():
        have = _cached_bytes(folder)
        if total:
            percent = min(100.0, have * 100.0 / total)
            report(percent, "{} · {} / {}".format(repo, _gb(have), _gb(total)))
        else:
            report(None, "{} · {} 받음".format(repo, _gb(have)))

    def poll():
        while not stop.wait(2.0):
            try:
                tick()
            except Exception as error:  # noqa: BLE001 — 진행 표시가 받기를 죽이면 안 됩니다
                common.log("진행을 재지 못했습니다(계속 받습니다): {}".format(error))

    tick()
    thread = threading.Thread(target=poll, daemon=True)
    thread.start()

    def once():
        kwargs = {"repo_id": repo}
        if token():
            kwargs["token"] = token()
        if allow_patterns:
            kwargs["allow_patterns"] = allow_patterns
        return snapshot_download(**kwargs)

    try:
        path = retrying(
            once,
            on_wait=lambda seconds, attempt, text: report(
                None, "{} · 허깅페이스 이용 제한(429) — {}초 뒤 다시 ({}번째)".format(repo, seconds, attempt)
            ),
        )
    except Exception as error:  # 승인·토큰·제한 문제는 사람이 알아볼 말로
        text = str(error)
        friendly = explain(text, repo)
        if friendly:
            raise RuntimeError("{} (원래 오류: {})".format(friendly, text[:200]))
        raise
    finally:
        stop.set()
        thread.join(timeout=5)
    tick()
    common.log("{} 을(를) 받아 두었습니다 — {}".format(repo, path))
    return path
