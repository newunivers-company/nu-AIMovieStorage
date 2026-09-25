import { toast } from "sonner";
import { loadBgmProjects, saveBgmProjects } from "@/lib/bgmProjects";
import { loadPrecision, type LocalEngineId } from "@/lib/localEngines";
import { runLocalToProject } from "@/lib/localOutput";
import { BGM_ROOT } from "@/lib/bgmLibrary";
import { enqueueTask, isStopping, registerTaskRunner } from "@/lib/taskQueue";

/**
 * **BGM 뽑기도 작업 줄에서.**
 *
 *
 *
 * 맞습니다 — BGM 만 제 화면 안에서 `await` 로 돌고 있었습니다. 그래서 그 화면을 벗어나면
 * 진행을 물을 데가 없고, 앱이 꺼지면 남은 일이 사라졌습니다. 곡 하나에 몇 분씩 걸리는
 * 일이라 다른 일과 같은 줄에 서야 합니다.
 *
 * # 줄은 `media` 입니다
 *
 * 음악도 GPU 를 씁니다. 그림·영상과 같은 줄에 세워 **한 번에 하나**만 돌게 합니다 —
 * 둘을 같이 돌리면 VRAM 이 터지거나 둘 다 느려집니다.
 *
 * # 어디에 놓이는가
 *
 * `BGM/곡/<프로젝트>/` 입니다. **영상 프로젝트 폴더가 아닙니다** — 한 곡을 여러 영상에서 돌려 쓰는데 프로젝트 폴더에
 * 두면 그 프로젝트를 지울 때 곡까지 사라지고, 같은 곡이 프로젝트마다 복사본으로 늘어납니다.
 *
 * 앱 안에서는 그 곡 카드의 **«뽑은 결과»** 에 붙습니다(`track.resultPaths`).
 */

export const BGM_TASK = "bgmTrack";

interface BgmPayload {
  projectId: string;
  projectName: string;
  trackId: string;
  trackName: string;
  engine: LocalEngineId;
  prompt: string;
  seconds: number;
  lyrics: string;
}

/** 곡 하나를 줄에 세웁니다. */
export function startBgmTrack(input: BgmPayload): boolean {
  if (!input.prompt.trim()) {
    toast.error("먼저 프롬프트를 만들어 주세요.");
    return false;
  }
  const id = enqueueTask({
    lane: "media",
    kind: BGM_TASK,
    projectId: `bgm:${input.projectId}`,
    projectTitle: `BGM · ${input.projectName}`,
    label: `${input.trackName || "곡"} 뽑기`,
    // 같은 곡을 두 번 세우지 않습니다 — 「뽑기」 를 두 번 눌러도 한 번만 돕니다.
    dedupe: `bgm:${input.trackId}`,
    payload: input,
  });
  if (!id) {
    toast.message("이미 줄에 서 있습니다.", {
      description: "위쪽 «작업» 단추에서 차례를 볼 수 있습니다.",
    });
    return false;
  }
  toast.success(`${input.trackName || "곡"} 을 줄에 세웠습니다.`, {
    description: "위쪽 «작업» 단추로 진행을 봅니다. 창을 나가도 계속 돕니다.",
  });
  return true;
}

registerTaskRunner(BGM_TASK, async (raw, report, task) => {
  const payload = raw as BgmPayload;
  if (isStopping(task.id)) return;

  report({ step: "모델을 올리는 중" });
  const made = await runLocalToProject({
    engine: payload.engine,
    extension: "wav",
    kind: "audio",
    projectName: BGM_ROOT,
    assetType: "bgm-track",
    ownerName: payload.projectName,
    stem: `${payload.projectName}_${payload.trackName || "곡"}`,
    opts: {
      prompt: payload.prompt,
      seconds: payload.seconds,
      // 연주곡이면 가사를 비웁니다 — 비면 엔진이 `[inst]` 로 받습니다.
      lyrics: payload.lyrics,
      precision: loadPrecision(),
    },
    timeoutSecs: 3600,
    shouldStop: () => isStopping(task.id),
    onProgress: (message) => report({ step: message || "뽑는 중" }),
  });

  report({ step: "곡에 붙이는 중" });
  /*
    **지금 값을 받아 다음 값을 만듭니다.** 몇 분이 걸리는 일이라 그사이 다른 곡을
    만지는 것이 정상입니다 — 값으로 덮어쓰면 그 사이 편집이 사라집니다(CLAUDE.md).
  */
  const projects = loadBgmProjects();
  const found = projects.find((item) => item.id === payload.projectId);
  if (!found) throw new Error("뽑기는 했는데 그 BGM 프로젝트를 찾지 못했습니다.");
  saveBgmProjects(
    projects.map((item) =>
      item.id !== payload.projectId
        ? item
        : {
            ...item,
            updatedAt: Date.now(),
            tracks: item.tracks.map((entry) =>
              entry.id !== payload.trackId
                ? entry
                : { ...entry, resultPaths: [...(entry.resultPaths || []), made.path] },
            ),
          },
    ),
  );
});
