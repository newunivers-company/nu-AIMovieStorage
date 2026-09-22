"""로컬 엔진 하나를 **앱과 같은 길로** 돌립니다(worker.py + 엔진 venv).

앱 밖에서 결과를 뽑아 볼 때 씁니다 — 음원·영상·그림 엔진 전부 같은 규약입니다.

    python scripts/runEngine.py --engine minimaxmusic --out D:/out.wav \
        --opts "{\\"prompt\\": \\"...\\", \\"seconds\\": 150}"
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

APPDATA = Path(os.environ["APPDATA"]) / "com.aivideostorage.local"
ENGINES = APPDATA / "local" / "engines"
RESOURCES = Path(__file__).resolve().parent.parent / "src-tauri" / "resources" / "local"
WORKER = RESOURCES / "worker.py"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--opts", default="{}")
    parser.add_argument("--timeout", type=float, default=7200)
    args = parser.parse_args()

    python = ENGINES / args.engine / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    root = ENGINES / args.engine
    if not python.exists():
        print(f"엔진이 설치되어 있지 않습니다: {python}")
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONPATH"] = str(RESOURCES)

    started = time.time()
    proc = subprocess.Popen(
        [str(python), str(WORKER), "--engine", args.engine, "--root", str(root)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    request = {"id": "1", "op": "generate", "output": str(out), "opts": json.loads(args.opts)}

    code = 1
    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                print("워커가 곧바로 끝났습니다(로그를 보세요).")
                break
            event = json.loads(line)
            if event.get("event") == "ready":
                print(f"엔진 준비 — {event.get('device','')} {event.get('torch','')}", flush=True)
                proc.stdin.write(json.dumps(request) + "\n")
                proc.stdin.flush()
                break
            if event.get("event") == "error":
                print(f"실패: {event.get('message')}")
                break
        else:
            pass

        while True:
            if time.time() - started > args.timeout:
                print(f"{int(args.timeout)}초를 넘겨 끊었습니다.")
                break
            line = proc.stdout.readline()
            if not line:
                break
            event = json.loads(line)
            kind = event.get("event")
            if kind == "progress":
                text = (event.get("message") or "").strip()
                if text:
                    print(f"  {event.get('percent')}% {text}", flush=True)
            elif kind == "done":
                print(f"완료 — {out} ({round(time.time() - started)}초)")
                extra = {k: v for k, v in event.items() if k not in {"id", "event", "output"}}
                print(json.dumps(extra, ensure_ascii=False))
                code = 0
                break
            elif kind == "error":
                print(f"실패: {event.get('message')}")
                break
    finally:
        try:
            proc.stdin.write(json.dumps({"id": "2", "op": "quit"}) + "\n")
            proc.stdin.flush()
            proc.wait(timeout=60)
        except Exception:
            proc.kill()
    return code


if __name__ == "__main__":
    sys.exit(main())
