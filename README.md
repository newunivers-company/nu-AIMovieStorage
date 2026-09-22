# AIMovieStorage — AI Video Production Workbench

[English](#aimoviestorage--ai-video-production-workbench) · [한국어](#한국어)

A Windows desktop app for planning AI videos, managing character references, blocking shots in 3D,
and preparing model-specific prompts. Keep each cut's prompts, references and generated assets in one project.

**[Release status](https://github.com/raonolje/AIMovieStorage/releases)** · [Installation](#installation) ·
[Feature details](#what-it-does) · [Build from source](#build-from-source) ·
[Report an issue](https://github.com/raonolje/AIMovieStorage/issues)

| Task | What AIMovieStorage provides |
| --- | --- |
| Plan the story | Break a screenplay into characters, locations, scenes and cuts, with a prompt request for each card. |
| Keep character references connected | Reference sheets, linked variants and `@tags` for reusing the same identity across cuts. |
| Design the shot | 3D rooms, character poses, camera framing and movement, plus reference-video export. |
| Prepare generation | Model-specific prompts, Magnific desktop integration and optional local image, video and music engines. |
| Organize the results | Project folders, named assets and imported renders linked back to their cards. |

**Workflow:** screenplay → characters & locations → 3D blocking → prompts & references → generation → import & reuse.

> **Beta.** Local generation and model-specific prompts are still being verified. Check results and keep backups.
> The interface defaults to Korean; English, Japanese and Chinese are available in Settings, with some screens still untranslated.

## Installation

**The previously published build has been removed while an updated build is being prepared.**
There is currently no packaged download. You can [build from source](#build-from-source), or check
the [Releases page](https://github.com/raonolje/AIMovieStorage/releases) for the next published build.
Prebuilt packages do not require Node, pnpm or Rust; those tools are only needed to [build from source](#build-from-source).

When a release is published, open its **Assets** section and choose:

| Package | How to use it |
| --- | --- |
| Installer (`*-setup.exe`) | Run the installer and follow the setup steps. |
| Portable (`*_portable.zip`) | Extract the entire archive, then run the included `.exe`. Keep the `resources` folder beside it. Settings and model downloads still use the user's app data folder. |

GitHub's automatic **Source code (zip/tar.gz)** archives contain source files, not a ready-to-run app.

- **Windows 10/11, x64.** macOS and Linux are not currently supported.
- **NVIDIA GPU (CUDA):** needed only for local generation; requirements vary by engine. Model weights are downloaded separately and have [their own licenses](#license).
- **OpenAI or Claude API key:** optional, for LLM-assisted prompt writing.
- **WebView2 Runtime:** required by the desktop app. If missing when using the portable package, follow its included `읽어보세요.txt`.

## Workflow and beta status

> **⚠️ Beta — not everything here is verified yet.**
>
> This is an early build put together over a short period. Most of it works, but not every path
> has been exercised end to end — **local model generation in particular is still being checked**
> against real output, and prompts are still being tuned per model. Expect rough edges, keep your
> own backups, and verify results before you depend on them.
>
> **Please open an Issue** — bugs, confusing behaviour, or a feature you wish existed. Because this is
> a beta, that feedback is genuinely what decides what gets fixed and built next. Rough notes are fine;
> a screenshot and what you were doing is plenty.

**The hard part of making video with AI is not getting one good frame — it is holding
*the same person, the same space, the shot you intended* across every cut.**

Write each cut's prompt from scratch and the character drifts, the room grows a window on the
wrong wall, and you get the angle the generator likes instead of the one you drew. Every frame
looks fine on its own; strung together they belong to different films.

AIMovieStorage is the workbench that keeps those three anchored. It manages prompts and references
in one place, and takes what you generated outside back in **as the reference for the next step**.

It does not generate images itself by default — you write the prompt here, render it in Magnific,
ComfyUI or whatever you use, then bring the result back so the next sheet can point at it.
(It *can* generate locally — see below.)

> The interface is Korean-first, with English, Japanese and Chinese available in Settings.

---

## What it does

### The same person — identity on a single thread

Each character gets a **reference sheet**, and variants (younger, injured, different outfit) branch
from it. A variant window holds its parent sheet as the *identity anchor* and will not let you remove
it — remove it and you have a different person. In a cut you call a character by `@sheetName`, and when
you swap the image, **Relink @tags** replaces the name without touching a word of your prose.

### The same space, the shot you intended — block it in 3D, then read the numbers

Build the room (interior cube · exterior dome · **cyclorama studio**), place people, pose them, set the
camera, key the movement on a timeline. From that scene you get:

- **Shot size, angle, lens and each character's position in frame** as numbers that go straight into the prompt
- A **reference video** to feed video models — camera movement and blocking delivered as footage, not adjectives
- The room's **six-face unfold** to render outside; bring it back and it is cut and hung on the walls automatically

### One screenplay to a whole project

Paste a screenplay and it fills in over **four passes** — cast and locations, then details with scenes and cuts,
then blocking per cut, then **a separate prompt request for every card**. That last pass is the point: asking one
model call to write 60 cut prompts leaves a paragraph each, so each card gets its own request and room to describe
situation, environment, posture, expression and light.

### It knows each model's grammar

Even dialogue is written differently per model — Veo uses a colon, Kling square brackets, MiniMax-H3 `<d>` tags,
Seedance braces. Where prohibitions belong differs too (a negative field, inline text, or phrased positively).
The app keeps the rule table and rewrites your prompt into that model's dialect on the way out.

### It drives Magnific for you

AIMovieStorage talks to the **Magnific desktop app** directly. Press **Compose** on a cut and it opens
Magnific, drops the prompt in, uploads the references — layout capture, character sheets, background —
and wires them into the generator node, so the canvas is set up and waiting instead of you dragging
files around. Finished renders come back through an inbox and attach themselves to the card that asked.
Magnific's MCP interface is supported too, for running a batch end to end without the window.

### Generating on your own machine

Images (Qwen-Image · Z-Image Turbo · Krea 2), video (MiniMax-H3 · Wan 2.2 · LTX 2.5) and music
(MiniMax-Music3 · ACE-Step) run directly, without ComfyUI. LoRAs are searched per engine
(Civitai · Hugging Face), downloaded, and managed down to strength and trigger words.

### Files organise themselves

You never choose a folder or name a file. Each project gets one folder; each character gets one
folder inside it, and that character's variants, assets and sheets all live there. Names follow a
single rule — `character_001`, `character_variant_001`, `character_variant_panel_001` — so a file
tells you what it is and who it belongs to at a glance.

Rename a character and the folder, every file starting with the old name, and the `@tags` inside
your prompts all follow. Register something you generated outside and it is filed, numbered and
attached to the right card. The folder is the source of truth: if a file is gone from disk it is gone
from the app, and deleting in the app deletes the original — otherwise it would reappear on the next read.

## Build from source

Development requires **Windows 10/11**, **Git**, **Node 22+**, **pnpm 10+**, **Rust (MSVC)**,
and **Visual Studio C++ Build Tools**. The GPU and API key requirements above apply only to their optional features.

```bash
git clone https://github.com/raonolje/AIMovieStorage.git
cd AIMovieStorage
pnpm install --frozen-lockfile
pnpm dev:desktop --edition public  # run with public-edition engine restrictions
```

To check the code or create distributable packages:

```bash
pnpm check         # type check
pnpm test          # unit tests
pnpm build:public  # public installer + portable build
```

The installer is written to `src-tauri/target/release/bundle/nsis/` and the portable archive to
`src-tauri/target/release/bundle/portable/` with the default build configuration.
The public edition excludes the engines listed in [edition.json](edition.json).
`pnpm dev:desktop` without `--edition public` defaults to the private edition; the engines' license terms still apply.

For maintainers, the [release workflow](.github/workflows/release.yml) builds and uploads both packages
to GitHub Releases when a `v*` tag is pushed. Manual workflow runs save build artifacts on the Actions run instead.

## Keys

API keys are stored as files in the app's own settings folder, never in the browser, and every call is
made from inside the app — so keys are not visible to the web layer and CORS is not in the way.

## Suggestions and bug reports

Both are welcome, and wanted. Open an [Issue](https://github.com/raonolje/AIMovieStorage/issues) for anything at all —
something crashed, something behaved oddly, a step was hard to follow, or a feature you need is missing.
Korean or English is fine. If it is a bug, the app version, what you clicked and a screenshot make it
much faster to track down; if it is an idea, just describe what you were trying to do.

## License

The application code is [MIT](LICENSE). **Model weights the app downloads carry their own licenses** —
each engine card in Settings states its terms; check them before commercial use.

For the same reason a few engines are not part of this build — `edition.json` records which and why.

---

## 한국어

### AIMovieStorage — AI 영상 제작 워크벤치

인물 레퍼런스, 3D 구도, 모델별 프롬프트와 생성 결과를 한 프로젝트에서 관리하는 Windows 데스크톱 앱입니다.
시나리오를 씬과 컷으로 나누고, 각 컷의 인물·공간·카메라 구도를 준비하는 작업을 돕습니다.

**[배포 상태](https://github.com/raonolje/AIMovieStorage/releases)** · [설치 안내](#설치-안내) ·
[기능 자세히 보기](#무엇을-해-주는가) · [소스에서 실행](#소스에서-실행) ·
[오류 제보](https://github.com/raonolje/AIMovieStorage/issues)

| 작업 | 주요 기능 |
| --- | --- |
| 이야기 구성 | 시나리오에서 인물·장소·씬·컷을 정리하고 카드마다 프롬프트를 요청합니다. |
| 인물 레퍼런스 관리 | 기준 시트, 연결된 변형, `@태그`로 컷마다 같은 인물의 레퍼런스를 재사용합니다. |
| 구도 설계 | 3D 공간에서 인물 포즈·카메라·동선을 잡고 레퍼런스 영상을 내보냅니다. |
| 생성 준비 | 모델별 프롬프트, 마그니픽 데스크톱 연동, 선택형 로컬 이미지·영상·음악 생성을 제공합니다. |
| 결과 정리 | 프로젝트 폴더와 파일 이름을 관리하고, 외부 생성 결과를 해당 카드에 연결합니다. |

**작업 흐름:** 시나리오 → 인물·장소 → 3D 구도 → 프롬프트·레퍼런스 → 생성 → 결과 등록·재사용.

> **베타입니다.** 로컬 생성과 모델별 프롬프트는 검증 중입니다. 결과를 확인하고 중요한 자료는 백업해 주세요.
> 기본 언어는 한국어이며 설정에서 English · 日本語 · 中文으로 바꿀 수 있습니다. 일부 화면은 아직 한국어로 표시됩니다.

## 설치 안내

**기존 배포본을 내리고 수정된 빌드를 준비하고 있습니다.**
현재 내려받을 수 있는 설치본·무설치본은 없습니다. [소스에서 실행](#소스에서-실행)하거나,
[Releases](https://github.com/raonolje/AIMovieStorage/releases)에서 다음 배포본을 확인해 주세요.
배포 파일을 실행할 때는 Node·pnpm·Rust가 필요하지 않습니다. 이 도구들은 [소스에서 실행](#소스에서-실행)할 때만 필요합니다.

새 Release가 게시되면 **Assets**에서 원하는 형식을 선택합니다.

| 파일 | 실행 방법 |
| --- | --- |
| 설치본(`*-setup.exe`) | 파일을 실행하고 설치 안내를 따릅니다. |
| 무설치본(`*_portable.zip`) | 압축을 모두 푼 뒤 안의 `.exe`를 실행합니다. `resources` 폴더를 실행 파일 옆에 유지하세요. 설정과 모델은 사용자 앱 데이터 폴더에 저장됩니다. |

GitHub가 자동으로 제공하는 **Source code** 압축 파일(`zip`/`tar.gz`)은 바로 실행하는 앱이 아닌 소스 코드입니다.

- **Windows 10/11, x64.** macOS·Linux는 아직 지원하지 않습니다.
- **NVIDIA GPU(CUDA):** 로컬 생성에만 필요하며 요구 사양은 엔진마다 다릅니다. 모델 가중치는 별도로 내려받으며 [각자의 라이선스](#라이선스)를 따릅니다.
- **OpenAI 또는 Claude API 키:** LLM 프롬프트 작성에만 필요한 선택 사항입니다.
- **WebView2 런타임:** 데스크톱 앱에 필요합니다. 무설치본을 쓰는 컴퓨터에 없다면 동봉된 `읽어보세요.txt`를 참고하세요.

## 작업 흐름과 베타 상태

> **⚠️ 베타입니다 — 아직 전부 검증하지 못했습니다.**
>
> 짧은 기간에 만든 초기 판입니다. 대부분 돌아가지만 모든 길을 끝까지 확인하지는 못했습니다 —
> **특히 로컬 모델 생성은 실제 결과를 보며 확인하는 중**이고, 모델별 프롬프트도 다듬는 중입니다.
> 거친 부분이 있을 수 있으니 결과를 꼭 확인하고 쓰시고, 중요한 자료는 따로 백업해 두세요.
>
> **Issues 에 글을 남겨 주세요** — 오류든, 이상하게 동작하는 것이든, 「이런 기능이 있었으면」 이든
> 전부 환영합니다. 베타라서 그 이야기가 다음에 무엇을 고치고 만들지를 실제로 정합니다.
> 다듬어 쓰지 않으셔도 됩니다 — 화면 한 장과 «무엇을 하다가» 만 적어 주셔도 충분합니다.

**AI 로 영상을 만들 때 어려운 것은 한 장을 잘 뽑는 일이 아니라, 컷이 이어지는 동안**
**«같은 사람 · 같은 공간 · 원하는 구도» 를 끝까지 지키는 일입니다.**

컷마다 프롬프트를 새로 쓰면 인물이 미묘하게 달라지고, 같은 방인데 창이 반대쪽에 나고,
머릿속에 그린 앵글 대신 생성기가 좋아하는 앵글이 나옵니다. 컷 하나로는 멀쩡한데
이어 붙이면 다른 작품이 됩니다.

AIMovieStorage 는 그 일관성을 지키는 **작업대**입니다 — 인물·공간·구도를 각각 **기준으로 붙들어 두고**,
프롬프트와 레퍼런스를 한자리에서 관리하고, 밖에서 뽑은 결과를 다시 등록해 **다음 단계의 레퍼런스로** 씁니다.

이 앱은 그림을 직접 만들지 않습니다(로컬 모델을 켜면 만들 수도 있습니다). 프롬프트를 여기서 짓고,
마그니픽·ComfyUI 같은 생성기에서 뽑고, 결과를 되가져와 다음 시트에 물립니다.

---

## 무엇을 해 주는가

### 같은 사람 — 정체성을 한 줄로 꿰기

인물마다 **기준 시트**를 만들고, 그 시트에서 변형(어린 시절·부상·의상)을 뻗습니다. 변형 창은 부모 시트를
«정체성 기준» 레퍼런스로 자동으로 물고 있어 뺄 수 없습니다 — 빼면 다른 사람이 되기 때문입니다.
컷에서는 인물을 `@시트이름` 으로 부르고, 그림을 바꾸면 **「@ 다시 잇기」** 가 문장은 그대로 둔 채
이름만 갈아 끼웁니다.

### 같은 공간, 원하는 구도 — 3D 로 잡고 그 값을 프롬프트로

방을 세우고(실내 큐브 · 실외 돔 · **호리존 스튜디오**), 인물을 놓고, 포즈를 잡고, 카메라를 두고,
타임라인에 움직임을 찍습니다. 그 구도에서:

- **샷 크기·앵글·렌즈·인물의 화면 자리**가 숫자로 나와 프롬프트에 그대로 들어갑니다
- **레퍼런스 영상**을 뽑아 영상 모델에 물립니다 — 카메라 무빙과 동선을 글이 아니라 영상으로 전합니다
- 방의 **여섯 면 전개도**를 생성기로 뽑아 되가져오면 자동으로 잘려 벽에 붙습니다

### 시나리오 한 편에서 작품 한 벌로

시나리오를 붙여넣으면 **네 걸음**으로 채웁니다 — 인물·장소 목록 → 상세와 씬·컷 → 컷마다 구도 →
**카드마다 프롬프트를 따로 씁니다.** 마지막 걸음이 핵심입니다: 컷 60개의 프롬프트를 한 답에 몰아 쓰면
컷당 한 문단이 고작이라, 카드마다 요청을 따로 보내 상황·환경·인물의 자세와 표정·빛까지 적게 합니다.

### 모델마다 다른 문법을 앱이 압니다

대사 하나도 모델마다 적는 법이 다릅니다 — Veo 는 콜론, Kling 은 대괄호, MiniMax-H3 는 `<d>`,
Seedance 는 중괄호. 금지 사항을 어디에 적는지도(네거티브 칸 / 본문 / 긍정으로 뒤집기) 다릅니다.
규칙표를 앱이 들고 있다가 보낼 때 그 모델의 말로 바꿔 적습니다.

### 마그니픽 데스크톱을 앱이 대신 조작합니다

**마그니픽 데스크톱 앱**과 곧바로 연동됩니다. 컷에서 **「구성」** 을 누르면 마그니픽을 켜고,
프롬프트를 넣고, 레퍼런스(구도 캡처·인물 시트·배경)를 올려 생성기 노드에 물려 줍니다 —
파일을 끌어다 놓는 일 없이 캔버스가 차려진 채로 기다립니다. 다 뽑힌 결과는 후보함으로 들어와
요청한 카드에 스스로 붙습니다. MCP 연결도 지원해서 창 없이 한 벌을 끝까지 돌릴 수도 있습니다.

### 이 컴퓨터에서 직접 뽑기

그림(Qwen-Image · Z-Image Turbo · Krea 2) · 영상(MiniMax-H3 · Wan 2.2 · LTX 2.5) ·
음악(MiniMax-Music3 · ACE-Step)을 ComfyUI 없이 앱이 직접 돌립니다. LoRA 는 엔진별로 찾아
받고(Civitai · Hugging Face), 세기와 «불러오는 말» 까지 관리합니다.

### 파일은 알아서 정리됩니다

폴더를 고르거나 파일 이름을 짓는 일이 없습니다. 작품마다 폴더 하나, 그 안에 **인물마다 폴더 하나**가
생기고 그 인물의 변형·에셋·시트가 전부 거기 들어갑니다. 이름은 한 규칙을 따릅니다 —
`인물_001`, 변형은 `인물_변형_001`, 잘라낸 칸은 `인물_변형_얼굴 정면_001` — 그래서 파일 하나만 봐도
무엇이고 누구 것인지 압니다.

인물 이름을 바꾸면 폴더와 «옛 이름_» 으로 시작하는 파일이 전부 따라가고, 프롬프트 안의 `@태그` 까지
같이 바뀝니다(바꾸기 전에 한 번 묻습니다). 밖에서 뽑은 그림을 등록하면 알아서 제자리에 번호를 달아
놓이고 카드에 붙습니다. **폴더가 진실입니다** — 디스크에 없으면 앱에도 없고, 앱에서 지우면 원본도
지웁니다(안 그러면 폴더를 다시 읽을 때 되살아납니다).

## 소스에서 실행

**Windows 10/11 · Git · Node 22+ · pnpm 10+ · Rust(MSVC) · Visual Studio C++ 빌드 도구**가 필요합니다.
GPU와 API 키는 위에서 설명한 선택 기능에만 사용됩니다.

```bash
git clone https://github.com/raonolje/AIMovieStorage.git
cd AIMovieStorage
pnpm install --frozen-lockfile
pnpm dev:desktop --edition public  # 공개판 엔진 제한을 적용해 실행
```

`pnpm check`로 타입을 확인하고 `pnpm test`로 단위 테스트를 실행합니다.
배포용 파일은 `pnpm build:public`으로 만듭니다. 기본 빌드 설정에서 설치본은
`src-tauri/target/release/bundle/nsis/`, 무설치본은 `src-tauri/target/release/bundle/portable/`에 생성됩니다.

공개판은 [edition.json](edition.json)에 명시된 엔진을 제외합니다.
`--edition public` 없이 `pnpm dev:desktop`을 실행하면 기본값은 비공개판이며, 각 엔진의 라이선스 조건은 그대로 적용됩니다.
관리자가 `v*` 태그를 푸시하면 [배포 워크플로](.github/workflows/release.yml)가 공개판 파일을 만들어 Releases에 올립니다.
수동 실행 결과는 해당 Actions 실행의 빌드 산출물로 저장됩니다.

## 키

API 키는 브라우저가 아니라 **앱 설정 폴더에 파일로** 저장되고 호출도 앱 안에서 합니다 —
웹 쪽에서 키가 보이지 않고 CORS 에 막히지도 않습니다.

## 언어

한국어 · English · 日本語 · 中文. 설정에서 바꿉니다(기본 한국어). 아직 번역되지 않은 화면은 한국어로 나옵니다.

## 건의와 오류 제보

둘 다 환영합니다. 무엇이든 [Issues](https://github.com/raonolje/AIMovieStorage/issues) 에 남겨 주세요 — 멈췄다거나, 이상하게 동작한다거나,
따라 하기 어려웠다거나, 필요한 기능이 없다거나. 한국어·영어 다 좋습니다.
오류라면 앱 판과 «무엇을 눌렀는지», 화면 한 장이 있으면 훨씬 빨리 찾습니다.
건의라면 «무엇을 하려고 했는지» 만 적어 주셔도 됩니다.

## 라이선스

앱 코드는 [MIT](LICENSE) 입니다. **앱이 내려받는 모델 가중치는 각자의 라이선스를 따릅니다** —
설정 화면의 엔진 카드마다 조건을 적어 두었으니 상업적으로 쓰기 전에 확인하세요.

같은 까닭으로 몇몇 엔진은 이 판에 들어 있지 않습니다 — 무엇을 왜 뺐는지는 `edition.json` 에 있습니다.
