---
id: comfyui
label: ComfyUI
---

# ComfyUI 프롬프트 작성 지침

ComfyUI 는 노드 그래프입니다. 프롬프트는 «그림 한 장을 설명하는 문장» 이 아니라
**어떤 노드의 텍스트 칸에 들어가는 문자열**입니다. 그래서 프롬프트를 쓸 때는
«어느 노드에 넣을 글인가» 를 먼저 정합니다.

## 1. 가장 중요한 규칙 — 레퍼런스는 글이 아니라 배선으로 들어간다

로컬 모델(Flux, Qwen, Wan 로컬 등)에서는 **프롬프트 문자열 안에 파일 이름·경로·URL 을
써도 아무 일도 일어나지 않습니다.** 레퍼런스 이미지는 `Load Image` 노드로 불러와
인코더 노드의 이미지 입력에 연결됩니다. 프롬프트가 하는 일은 **연결된 그 이미지를
말로 가리키는 것**뿐입니다.

| 쓰면 안 되는 것 | 대신 |
| --- | --- |
| `refs/주인공_정면.png 를 참고해서` | 그 파일을 `Load Image` 로 올리고, 프롬프트에서는 `image 1` 처럼 순번으로 지칭 |
| `https://.../ref.jpg` | 미리 내려받아 `input` 폴더에 두고 노드로 로드 |
| `<lora:스타일:0.8>` | `LoraLoader` 노드 (프롬프트 인라인 LoRA 문법은 ComfyUI 코어에 없습니다) |

예외는 **API 노드(Wan 3.0 등)** 입니다. 아래 3절.

## 2. 레퍼런스를 프롬프트에서 가리키는 문법

| 대상 | 넣는 노드 | 프롬프트에서 부르는 법 | 개수 |
| --- | --- | --- | --- |
| Qwen-Image-Edit 2509 / 2511 | `TextEncodeQwenImageEditPlus` 의 `image1` · `image2` · `image3` | 자연어로 `image 1`, `image 2`, `image 3` | 최대 3장 |
| FLUX.1 Kontext (단일) | `Load Image` → `FluxKontextImageScale` → `ReferenceLatent` | 이미지를 부르지 않고 **바꿀 대상을 명사로** 지목 | 1장 |
| FLUX.1 Kontext (여러 장) | `Image Stitch` 로 좌우/상하로 이어 붙여 1장으로 | 붙인 위치로 지목 (왼쪽/오른쪽 등) | 실사용 2~3장 |
| Wan 3.0 (API 노드) | `Load Image` → Wan 3.0 레퍼런스 노드 | **`@Image1` · `@Video1` · `@Audio1`** | 이미지 10 · 영상 5 · 오디오 5 (합 20) |
| Wan 2.2 Animate | `WanAnimateImageToVideo` (레퍼런스 이미지 + 포즈 영상) | 프롬프트로 지칭하지 않음 | 1장 + 구동 영상 |

### Qwen-Image-Edit — 순번으로 부른다

`TextEncodeQwenImageEditPlus` 는 `clip` · `prompt` 가 필수, `vae` · `image1` · `image2` ·
`image3` 이 선택입니다. 연결한 순서가 그대로 번호입니다.

```
Put the jacket from image 2 onto the man in image 1.
Keep the face, hairstyle and background of image 1 unchanged.
```

- 한 장은 «바탕», 다른 한 장은 «가져올 것» 으로 역할을 나눠 적습니다.
- 무엇을 옮기고 무엇을 그대로 둘지 **양쪽 다** 씁니다.
- 도너 이미지는 바탕과 시점·조명이 비슷할수록 결과가 맞습니다.

### FLUX.1 Kontext — 지시문으로 쓴다

Kontext 는 «편집 지시» 를 받습니다. 공식 문서의 권장 형태입니다.

```
Change [대상] to [바뀐 상태], keep [유지할 것] unchanged
```

- 대명사 금지. `she` 가 아니라 `The woman with short black hair`.
- 유지 조건을 명시: `while maintaining the same facial features, hairstyle, and expression`.
- 동사는 `change` · `replace`. `transform` 은 피합니다.
- **영어로 씁니다.** 이 모델의 프롬프트는 영어만 지원합니다.
- 여러 장을 쓸 때는 `Image Stitch` 로 이어 붙인 뒤 위치로 지목합니다.

### Wan 3.0 — 유일하게 프롬프트 안에서 파일을 부른다

레퍼런스는 **타입별 입력 순서대로** 번호가 붙습니다.

```
@Image1 walks through the door and says the line from @Audio1.
```

- `@Image1` … `@Image10`, `@Video1` … `@Video5`, `@Audio1` … `@Audio5`.
- 프롬프트 길이 20,000자. 출력 2~30초. 480p / 720p / 1080p.
  화면비 16:9 · 9:16 · 4:3 · 3:4 · 1:1.
- 레퍼런스 영상·오디오는 각 15초 이하.
- ComfyUI v0.33.4 이상 또는 Comfy Cloud 에서 동작합니다.
- 문장은 «주어 · 장면 · 움직임» 한 줄로 시작하고, 필요하면 카메라·조명·스타일·소리를 덧붙입니다.

## 3. 프롬프트 문자열 문법

| 문법 | 뜻 |
| --- | --- |
| `(단어:1.2)` | 가중치 1.2 |
| `(단어)` | `(단어:1.1)` 과 같음 |
| `((단어:1.2):0.5)` | 중첩은 곱셈 → 0.6 |
| `\(1990\)` | 괄호를 글자로 쓸 때는 이스케이프 |
| `embedding:이름` | 텍스추얼 인버전 임베딩 호출 (가중치를 줄 때는 괄호로 감쌈) |
| `{빨강\|파랑\|초록}` | 텍스트 칸에서 하나를 무작위로 고름 |

동작하지 않는 것:

- `<lora:이름:0.8>` — 코어에 없습니다. `LoraLoader` 노드를 씁니다.
- `BREAK` — 코어에 없습니다. 별도 커스텀 노드가 있어야 합니다.
- `{a|b}` 는 텍스트 위젯에 **직접 친** 경우에 해석됩니다. 다른 노드에서 문자열을
  연결해 넣으면 그대로 들어가는 사례가 보고돼 있습니다. 확정 문구를 쓰는 편이 안전합니다.

## 4. 네거티브 프롬프트

| 모델 | 상태 |
| --- | --- |
| Flux dev / schnell | CFG 1.0 로 쓰므로 **네거티브가 무시됩니다.** 칸이 있어도 반영되지 않습니다. |
| Qwen-Image | `negative_prompt` 칸은 파이프라인상 필요하지만, 내용을 배제하는 훈련이 되어 있지 않습니다. |
| SD 계열 (CFG > 1) | 정상 동작합니다. |

**결론: 빼고 싶은 것은 네거티브에 적지 말고, 긍정 프롬프트에서 원하는 상태를 단정적으로 적습니다.**
`no hat` 이 아니라 `bare head, hair fully visible`.

## 5. 파일 이름·폴더 규칙

- `Load Image` 는 파일을 ComfyUI 의 **`input` 폴더**에 올립니다. 드래그앤드롭도 같습니다.
  인식 포맷은 png · jpg · jpeg · webp.
- 워크플로에는 **파일 이름 문자열**이 저장됩니다. 같은 이름으로 다른 그림을 덮어쓰면
  예전 워크플로가 다른 그림을 물고 옵니다. 레퍼런스 파일 이름은 한 번 정하면 바꾸지 않습니다.
- 이름은 **역할 + 순번**으로 정합니다. 프롬프트의 `image 1` / `@Image1` 과 연결 순서가
  맞아떨어져야 합니다. 예: `01_face_front`, `02_outfit`, `03_bg`.
- 저장 쪽 `Save Image` 의 `filename_prefix` 는 토큰을 씁니다.
  - `폴더명/접두어` → 하위 폴더로 저장
  - `%date:yyyy-MM-dd%`, `%width%`, `%height%` 등 치환 토큰 사용
- **워크플로 전체가 박히는 건 PNG 뿐입니다.** 다른 포맷은 메타데이터만 들어갑니다.
  다시 쓸 결과물은 PNG 로 저장합니다.

## 6. 프롬프트를 붙여넣는 자리

| 모델 | 노드 | 칸 |
| --- | --- | --- |
| SD / Flux 일반 | `CLIP Text Encode (Prompt)` | 텍스트 |
| Qwen-Image-Edit 2509 / 2511 | `TextEncodeQwenImageEditPlus` | `prompt` (positive · negative 각각) |
| FLUX.1 Kontext | `CLIP Text Encode` | 텍스트 |
| Wan 3.0 | Wan 3.0 API 노드 | 프롬프트 칸 (`@` 참조 포함) |

주의:

- 반복 편집은 `Load Image (from output)` 로 직전 결과를 다시 물려 이어 갑니다.
- Qwen 계열은 입력 이미지를 비전 처리용 384×384(비율 유지)로, VAE 인코딩용은 8의 배수
  (기준 1024×1024)로 스케일합니다. 아주 작은 글자·무늬는 프롬프트로 요구해도 남지 않습니다.
- 이미지→이미지에서는 `KSampler` 의 `denoise` 가 1 미만이어야 원본이 남습니다.
  프롬프트만 고쳐서는 «원본을 얼마나 지킬지» 를 조절하지 못합니다.

## 7. 출력 형식

ComfyUI 용 프롬프트를 요청받으면 다음을 함께 냅니다.

1. **positive** — 영어 한 문단. 편집 지시형이면 `Change ..., keep ... unchanged` 구조.
2. **negative** — 모델이 네거티브를 쓰는 경우에만. 안 쓰는 모델이면 «해당 없음» 이라고 적습니다.
3. **레퍼런스 배선표** — 어떤 파일이 몇 번 입력이고, 프롬프트에서 어떤 이름으로 불리는지.

```
positive:
Replace the jacket of the man in image 1 with the jacket from image 2.
Keep his face, hairstyle, pose and the background of image 1 unchanged.
Studio lighting, 50mm, waist-up.

negative:
해당 없음 (Qwen-Image-Edit)

레퍼런스:
image1 ← 01_face_front.png   (바탕 · 인물)
image2 ← 02_outfit.png       (도너 · 의상)
```

## 8. 확인 사항

- 파일 이름이나 URL 을 프롬프트 문장에 넣지 않았는가.
- 순번 지칭(`image 1`, `@Image1`)이 실제 연결 순서와 맞는가.
- 유지할 것과 바꿀 것을 둘 다 적었는가.
- 대명사 대신 특징으로 지목했는가.
- 네거티브가 무시되는 모델인데 거기에 중요한 조건을 적지 않았는가.
