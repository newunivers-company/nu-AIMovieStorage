import { invoke } from "@tauri-apps/api/core";
import { BGM_ROOT } from "@/lib/bgmLibrary";
import { createBgmProject, createBgmTrack, loadBgmProjects, saveBgmProjects, type BgmProject } from "@/lib/bgmProjects";
import { isDesktopApp } from "@/lib/llm";
import { getMediaLibrarySettings, whenAppSettingsReady } from "@/lib/mediaLibrary";

/*
  **BGM 을 폴더에서 되살립니다.**

  영상 프로젝트는 폴더마다 `project.json` 이 있어 저장 폴더만 있으면 통째로 되살아납니다.
  그런데 BGM 기록은 **브라우저 저장소에만** 있었습니다. 그래서 폴더(`BGM/곡/<프로젝트>/`)에 곡이
  멀쩡히 있어도 화면은 「프로젝트가 없습니다」 였습니다 — 앱을 다시 깔거나 저장소가 비면 그렇게 됩니다.
  «폴더가 진실» 이라는 이 앱의 규칙과도 어긋났습니다.

  그래서 목록을 읽을 때 폴더를 한 번 훑어 **기록에 없는 것만** 채웁니다.

  - 폴더 이름이 곧 BGM 프로젝트 이름입니다(`곡/TEST/` → 「TEST」).
  - 파일 이름은 `<프로젝트>_<곡 이름>_<번호>.wav` 라 가운데가 곡 이름입니다. 같은 곡의 여러 판
    (`TEST_곡_001.wav` · `TEST_곡_001_001.wav`)은 한 곡으로 묶습니다 — 목록에 같은 이름이 줄줄이
    늘어서면 무엇이 무엇인지 알 수 없습니다.
  - 이미 기록에 있는 프로젝트는 **건드리지 않습니다.** 사람이 적어 둔 프롬프트·분위기·가사를
    폴더에서 읽은 껍데기로 덮어쓰면 그게 더 큰 손해입니다. 곡 파일만 빠져 있으면 그것만 붙입니다.
*/

/** `list_sub_folders` 가 돌려주는 한 폴더. */
interface SubFolder {
  name: string;
  files: string[];
}

/** 곡 파일에서 «곡 이름» 을 읽습니다 — `<프로젝트>_<곡 이름>_<번호>[_<번호>].wav`. */
export function trackNameOf(filePath: string, projectName: string): string {
  const base = (filePath.split(/[\\/]/).pop() || "").replace(/\.[^.]+$/, "");
  const withoutPrefix = base.startsWith(`${projectName}_`) ? base.slice(projectName.length + 1) : base;
  // 꼬리의 번호들(`_001`, `_001_001`)을 뗍니다. 남는 것이 곡 이름입니다.
  const name = withoutPrefix.replace(/(_\d{3,})+$/, "").trim();
  return name || withoutPrefix || base;
}

/**
 * 저장 폴더의 `BGM/곡/` 을 훑어 기록에 없는 것을 채워 넣습니다.
 *
 * 돌려주는 것은 **채운 뒤의 목록**입니다. 바뀐 것이 없으면 읽은 것을 그대로 돌려줍니다 —
 * 매번 저장하면 `updatedAt` 만 흔들려 목록 차례가 뒤집힙니다.
 */
export async function restoreBgmProjectsFromDisk(): Promise<BgmProject[]> {
  /*
    **앱 데이터 폴더의 거울을 먼저 기다립니다.**

    설치본과 개발 서버는 웹뷰 origin 이 달라 `localStorage` 가 통째로 갈립니다. 기다리지
    않고 읽으면 설치본에서는 기록이 비어 있고 저장 폴더도 «없음» 이라, 폴더 훑기까지
    건너뛰고 「프로젝트가 없습니다」 로 끝납니다. 화면은 이 함수를 기다리는 동안 먼저
    읽은 목록을 띄우고 있으므로, 여기서 기다려도 빈 화면이 보이지는 않습니다.
  */
  await whenAppSettingsReady();
  const projects = loadBgmProjects();
  if (!isDesktopApp() || !getMediaLibrarySettings().baseDirectory.trim()) return projects;

  let folders: SubFolder[] = [];
  try {
    folders = await invoke<SubFolder[]>("list_sub_folders", {
      baseDirectory: getMediaLibrarySettings().baseDirectory.trim(),
      relativePath: `${BGM_ROOT}/곡`,
      extensions: ["wav", "mp3", "flac", "m4a", "ogg"],
    });
  } catch {
    // 폴더가 아직 없거나 읽지 못하면 기록 그대로 씁니다 — 되살리기는 «있으면 좋은 것» 입니다.
    return projects;
  }

  let changed = false;
  const next = [...projects];

  for (const folder of folders) {
    if (!folder.files.length) continue;
    const already = next.find((item) => item.name === folder.name);
    const known = new Set((already?.tracks || []).flatMap((track) => track.resultPaths || []));
    const missing = folder.files.filter((file) => !known.has(file));
    if (!missing.length) continue;

    // 곡 이름으로 묶습니다 — 같은 곡의 여러 판이 한 줄로 모입니다.
    const byName = new Map<string, string[]>();
    for (const file of missing) {
      const name = trackNameOf(file, folder.name);
      byName.set(name, [...(byName.get(name) || []), file]);
    }

    const owner = already ?? createBgmProject(folder.name);
    const tracks = [...(owner.tracks || [])];
    for (const [name, files] of byName) {
      const seen = tracks.find((track) => (track.name || "").trim() === name);
      if (seen) {
        seen.resultPaths = [...(seen.resultPaths || []), ...files];
        continue;
      }
      tracks.push({
        ...createBgmTrack(),
        name,
        // 폴더에서 주워 온 것이라 프롬프트가 없습니다. 사람이 열어 채우면 됩니다.
        notes: "폴더에서 되살린 곡입니다. 프롬프트와 분위기는 비어 있습니다.",
        resultPaths: files,
      });
    }

    const filled: BgmProject = { ...owner, tracks, updatedAt: Date.now() };
    if (already) next[next.indexOf(already)] = filled;
    else next.unshift(filled);
    changed = true;
  }

  if (changed) saveBgmProjects(next);
  return next;
}
