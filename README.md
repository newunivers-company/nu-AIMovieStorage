# FrameForge

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

FrameForge is the workbench that keeps those three anchored. It manages prompts and references
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

The **timeline** is where movement lives. Key the camera and each character over time, scrub or play it back,
and the cut's runtime comes from the timeline rather than a guess. Props get their own rows, and each room
face can be keyed to hide so a wall stops blocking the view mid-shot.

For motion you did not want to key by hand, **pull it out of a video**. Drop in footage and the pose is
extracted and retargeted onto the character, with a cleanup pass for jitter — useful when you need a real
gait or gesture instead of an approximation.

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

FrameForge talks to the **Magnific desktop app** directly. Press **Compose** on a cut and it opens
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

## Requirements

- **Windows 10/11** (macOS and Linux not yet)
- **Node 22+ · pnpm 10+ · Rust (MSVC)** for development
- An **NVIDIA GPU (CUDA)** only if you want the local generators; everything else works without one
- An OpenAI or Claude API key if you want the LLM to write prompts (optional)

```bash
pnpm install
pnpm dev:desktop   # run as a desktop app
pnpm check         # type check
pnpm test          # unit tests
pnpm build:public  # installer + portable build
```

Prebuilt downloads live in [Releases](../../releases) — an installer (`.exe`) and a portable (`.zip`).

## Keys

API keys are stored as files in the app's own settings folder, never in the browser, and every call is
made from inside the app — so keys are not visible to the web layer and CORS is not in the way.

## Suggestions and bug reports

Both are welcome, and wanted. Open an [Issue](../../issues) for anything at all —
something crashed, something behaved oddly, a step was hard to follow, or a feature you need is missing.
Korean or English is fine. If it is a bug, the app version, what you clicked and a screenshot make it
much faster to track down; if it is an idea, just describe what you were trying to do.

## License

The application code is [MIT](LICENSE). **Model weights the app downloads carry their own licenses** —
each engine card in Settings states its terms; check them before commercial use.

For the same reason a few engines are not part of this build — `edition.json` records which and why.

---

# FrameForge — AI 영상 스토리지

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

FrameForge 는 그 일관성을 지키는 **작업대**입니다 — 인물·공간·구도를 각각 **기준으로 붙들어 두고**,
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

움직임은 **타임라인**에 있습니다. 카메라와 인물마다 시간을 따라 키를 찍고, 끌어 보거나 재생해 확인합니다.
컷의 러닝타임도 짐작이 아니라 타임라인이 정합니다. 소품은 제 줄을 따로 갖고, 방의 면마다 «가리기» 키를
찍어 벽이 중간에 시야를 막지 않게 할 수 있습니다.

손으로 찍기 어려운 동작은 **영상에서 가져옵니다**(모션 캡처). 영상을 넣으면 자세를 뽑아 인물에 입히고,
튐을 다듬는 과정까지 있습니다 — 걸음걸이나 몸짓을 짐작으로 만들지 않고 실제 것을 쓰고 싶을 때 씁니다.

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

## 돌리려면

- **윈도 10/11** (맥·리눅스는 아직)
- **Node 22+ · pnpm 10+ · Rust(MSVC)** — 개발용
- 로컬 생성 모델을 쓰려면 **NVIDIA GPU**(CUDA). 안 써도 나머지 기능은 전부 돕니다
- LLM 프롬프트 작성에는 OpenAI 또는 Claude API 키(선택)

설치본을 쓰실 분은 [Releases](../../releases) 에서 받으세요 — 설치본(`.exe`)과 무설치본(`.zip`)이 함께 올라갑니다.

## 키

API 키는 브라우저가 아니라 **앱 설정 폴더에 파일로** 저장되고 호출도 앱 안에서 합니다 —
웹 쪽에서 키가 보이지 않고 CORS 에 막히지도 않습니다.

## 언어

한국어 · English · 日本語 · 中文. 설정에서 바꿉니다(기본 한국어). 아직 번역되지 않은 화면은 한국어로 나옵니다.

## 건의와 오류 제보

둘 다 환영합니다. 무엇이든 [Issues](../../issues) 에 남겨 주세요 — 멈췄다거나, 이상하게 동작한다거나,
따라 하기 어려웠다거나, 필요한 기능이 없다거나. 한국어·영어 다 좋습니다.
오류라면 앱 판과 «무엇을 눌렀는지», 화면 한 장이 있으면 훨씬 빨리 찾습니다.
건의라면 «무엇을 하려고 했는지» 만 적어 주셔도 됩니다.

## 라이선스

앱 코드는 [MIT](LICENSE) 입니다. **앱이 내려받는 모델 가중치는 각자의 라이선스를 따릅니다** —
설정 화면의 엔진 카드마다 조건을 적어 두었으니 상업적으로 쓰기 전에 확인하세요.

같은 까닭으로 몇몇 엔진은 이 판에 들어 있지 않습니다 — 무엇을 왜 뺐는지는 `edition.json` 에 있습니다.
