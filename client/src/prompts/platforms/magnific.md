---
id: magnific
label: Magnific
---

# Magnific 프롬프트 작성 가이드

Magnific(구 Freepik)은 이미지 생성(Mystic)·업스케일·리라이트·스타일 전이를 한곳에 모은 플랫폼입니다.
여기서 만든 프롬프트는 Magnific 웹앱의 프롬프트 칸에 그대로 붙여넣습니다.

## 가장 먼저 알아야 할 것 — 파일 이름은 프롬프트에 쓰지 않습니다

Magnific 에는 `@파일이름.png` 같은 **파일 지시 문법이 없습니다.**
레퍼런스 이미지는 프롬프트 텍스트가 아니라 **프롬프트 아래 References 칸에 따로 올립니다.**

- 웹앱: 프롬프트 입력칸 아래 References → `+ Add` → 프리셋을 고르거나 직접 업로드합니다. 여러 개를 함께 겁니다.
- API: `structure_reference` / `style_reference` 필드에 **Base64 로 인코딩한 이미지**를 넣습니다. URL 은 받지 않습니다.

그러므로 프롬프트 본문에는 파일명·경로·`img1` 같은 참조 표기를 절대 넣지 않습니다.
넣으면 그대로 글자로 읽혀 그림에 섞입니다.

## 프롬프트 안에 쓰는 유일한 태그 — `@캐릭터`

미리 학습시킨 커스텀 캐릭터(LoRA)만 프롬프트 본문에서 `@` 로 부릅니다.

| 문법 | 뜻 | 예 |
| --- | --- | --- |
| `@캐릭터이름` | 그 캐릭터를 등장시킵니다 | `My friend @john is a great artist.` |
| `@캐릭터이름::강도` | 반영 강도를 지정합니다 | `My friend @john::200 is a great artist.` |

- 강도 범위는 **0–200**, 기본값 **100** 입니다. 값이 클수록 캐릭터가 더 강하게 드러납니다.
- 이름은 학습시킬 때 정한 캐릭터 이름입니다. 임의로 지어 쓰면 아무 일도 일어나지 않습니다.
- 캐릭터는 이미지 12–24장으로 미리 학습시켜 둡니다. API 에서는 `v1/ai/loras` 로 id 를 조회하고 `styling.characters` 로도 지정합니다.
- API 의 `styling.characters` 배열은 **1개까지**입니다. 프롬프트 `@` 문법의 개수 제한은 문서에 없습니다.

## 레퍼런스 종류와 거는 자리

| 무엇을 옮기나 | 자리 | 세기 조절 |
| --- | --- | --- |
| 구도·형태 (스케치, 3D 가안, 포즈) | `structure_reference` | `structure_strength` 0–100, 기본 50 |
| 화풍·색감·질감 | `style_reference` | `adherence` 0–100 |
| 인물 정체성 | 프롬프트 `@이름` 또는 `styling.characters` | `::강도` / `strength` 0–200, 기본 100 |
| 학습시킨 스타일 | `styling.styles` (1개) | `strength` 0–200, 기본 100 |
| 색 팔레트 | `styling.colors` (1–5개, hex) | `weight` 0.05–1 |

`adherence` 를 올리면 프롬프트에 더 충실해지고, 대신 스타일 전이는 조금 덜 정확해집니다.
`structure_strength` 를 올리면 원본 형태를 더 지킵니다.

## 프롬프트를 붙여넣는 자리

### 1. Mystic (이미지 생성)

메인 프롬프트 칸에 넣습니다. 장면을 말로 전부 설명합니다.
간단한 `a cat` 부터 `a cat with wings, playing the guitar, and wearing a hat` 처럼 길게까지 받습니다.
공식 예시는 전부 영어입니다. **영어로 씁니다.**

주요 설정:

| 항목 | 값 |
| --- | --- |
| `model` | `realism` · `fluid` · `zen` · `flexible` · `super_real` · `editorial_portraits` |
| `engine` | `automatic` · `magnific_illusio` · `magnific_sharpy` · `magnific_sparkle` |
| `resolution` | `1k` · `2k` · `4k` |
| `aspect_ratio` | `square_1_1` · `widescreen_16_9` · `social_story_9_16` · `standard_3_2` · `traditional_3_4` 외 |
| `creative_detailing` | 0–100, 기본 33 |
| `hdr` | 0–100, 기본 50 |
| `fixed_generation` | 같은 결과를 다시 뽑을 때 `true` |

### 2. 업스케일러 (Creative)

프롬프트는 **선택 사항**이지만, 넣으면 어떤 디테일을 만들어 낼지 유도합니다.
**AI 로 생성한 이미지를 올릴 때는 그 이미지를 만든 원래 프롬프트를 그대로 다시 넣습니다.** 결과가 좋아집니다.

| 항목 | 값 |
| --- | --- |
| `scale_factor` | `2x` · `4x` · `8x` · `16x` (기본 2x) |
| `optimized_for` | `standard` · `soft_portraits` · `hard_portraits` · `art_n_illustration` · `videogame_assets` · `nature_n_landscapes` · `films_n_photography` · `3d_renders` · `science_fiction_n_horror` |
| `creativity` | -10 ~ 10, 기본 0. 없던 질감을 얼마나 지어내는가 |
| `resemblance` | -10 ~ 10, 기본 0. 높이면 원본에 붙습니다 |
| `hdr` | -10 ~ 10, 기본 0 |
| `fractality` | -10 ~ 10, 기본 0. 프롬프트의 세기와 픽셀 단위 정교함 |

`fractality` 는 실험적입니다. 높이면 프롬프트가 점점 더 작은 영역까지 반복 적용됩니다.
장미 사진에 `A photograph of a rose` 를 높은 fractality 로 넣으면 큰 장미 안에 작은 장미들이 돋아납니다.
낮추면 디테일은 줄지만 글리치가 덜합니다.

업스케일 출력은 최대 2,530만 화소입니다.

## 되는 것 / 안 되는 것

| 되는 것 | 안 되는 것 |
| --- | --- |
| 구도 레퍼런스 + 스타일 레퍼런스를 동시에 걸기 | 프롬프트에 파일명·URL 을 적어 이미지 부르기 |
| 프롬프트에서 `@이름::강도` 로 학습된 캐릭터 호출 | 학습하지 않은 인물을 `@이름` 으로 부르기 |
| 스케치·3D 가안을 structure 로 넣어 실사화 | Mystic 의 네거티브 프롬프트 (문서에 없습니다) |
| hex 색 팔레트 1–5개 지정 | `styling.styles` · `styling.characters` 를 2개 이상 |
| 리라이트·스타일 전이·배경 제거를 별도 도구로 | 그 도구들에 `@` 문법 적용 |

영상 모델(Kling·Hailuo·WAN·Runway 등)은 Magnific 안에서 돌아가지만 각자의 입력 필드를 씁니다.
`@` 문법과 structure/style 레퍼런스는 **Mystic 계열 이미지 생성 전용**입니다. 영상 프롬프트에 옮겨 쓰지 않습니다.

## 프롬프트를 쓸 때 지킬 것

1. 장면을 **말로 완결**시킵니다. 레퍼런스는 따로 걸리므로 프롬프트가 그림을 다 설명해야 합니다.
2. 피사체 → 행동 → 의상·소품 → 배경 → 조명 → 카메라·렌즈 → 화풍 순으로 씁니다.
3. 정체성은 `@이름` 하나로 고정하고, 외모 묘사를 중복해서 덧붙이지 않습니다. 서로 싸웁니다.
4. 파일명, 확장자, 경로, 번호 매긴 참조 표기를 넣지 않습니다.
5. 업스케일용 프롬프트는 **원본 생성 프롬프트를 그대로** 씁니다. 새로 지어내지 않습니다.
6. 수치 파라미터(creativity, hdr 등)는 프롬프트 문장에 적지 않습니다. 슬라이더로만 조절합니다.

### 출력 예

```
@john::150, a weathered fisherman mending a net on a wooden pier at dawn,
thick wool sweater, salt-stained hands, fog over the harbor behind him,
low warm side light, 85mm portrait lens, shallow depth of field,
muted cinematic color grade
```

구도는 부두 스케치를 `structure_reference` 로, 색감은 참고 사진을 `style_reference` 로 따로 겁니다.
