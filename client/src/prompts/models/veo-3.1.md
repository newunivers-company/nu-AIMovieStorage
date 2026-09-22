---
id: veo-3.1
label: Veo 3.1
---

# Veo 3.1 프롬프트 작성 규칙

구글의 영상 생성 모델입니다. **영상과 소리를 한 번에 만듭니다.** 대사·효과음·환경음이
화면과 맞물려 같이 나오므로, 프롬프트에 소리를 쓰지 않으면 모델이 알아서 채웁니다.
소리는 끌 수 없습니다. 그러니 **소리는 반드시 직접 지정합니다.**

프롬프트는 **영어로** 씁니다. 공식 가이드와 예시가 전부 영어입니다.

---

## 1. 잘하는 것과 못하는 것

| 잘합니다 | 못합니다 |
| --- | --- |
| 카메라 워크 지시 (달리·트래킹·크레인·아크) | 화면 안의 글자 — 간판·라벨·자막이 뭉개집니다 |
| 입에 맞는 대사, 다인 대화 | 무게감 있는 물리 — 물·천·관성이 가볍게 뜹니다 |
| 효과음·환경음의 타이밍 | 손가락, 정교한 손동작 |
| 조명과 필름 질감 지정 | 정확한 개수 — 「사람 다섯」은 늘어나거나 사라집니다 |
| 레퍼런스로 인물 외모 유지 | 동시에 벌어지는 여러 동작 — 서로 뭉갭니다 |
| 8초 안에서의 다중 샷 | 비물리적·추상적 스타일 |

**결론:** 화면에 글자가 필요하면 프롬프트로 넣지 말고 후반에 얹습니다.
물리 곡예보다 **카메라와 빛으로 만드는 장면**이 안정적입니다.

---

## 2. 프롬프트 구조 — 이 순서로 씁니다

```
[촬영] + [피사체] + [동작] + [배경] + [스타일·분위기] + [오디오]
```

앞에서부터 이렇게 채웁니다.

| 순서 | 항목 | 예 |
| --- | --- | --- |
| 1 | **촬영** — 샷 크기·앵글·렌즈·움직임 | `Medium shot`, `Low-angle crane shot`, `Close-up with very shallow depth of field` |
| 2 | **피사체** — 나이·머리·옷·표정까지 | `a tired corporate worker in a wrinkled shirt` |
| 3 | **동작** — 동사 하나, 힘의 방향까지 | `rubbing his temples in exhaustion` |
| 4 | **배경** — 장소·시간·날씨 | `in a cluttered office late at night` |
| 5 | **스타일·조명** | `harsh fluorescent overhead light`, `shot on 1980s color film, slightly grainy` |
| 6 | **오디오** — 대사·효과음·환경음 | 아래 4절 |

카메라를 맨 앞에 두는 것이 핵심입니다. 모델이 먼저 렌즈를 정하고 그 안을 채웁니다.

---

## 3. 길이와 문체

- **서술문으로 씁니다. 태그 나열은 쓰지 않습니다.**
  `cinematic, 4k, masterpiece, best quality` 같은 이미지 모델식 나열은 힘을 잃습니다.
- 한 문단, **대략 80~150 단어**가 적정선입니다.
- **30 단어 미만으로 쓰지 마세요.** 짧은 프롬프트는 구글 쪽 리라이터가 자동으로
  부풀립니다. 이 기능은 끌 수 없고, 무엇이 덧붙었는지 볼 수 없습니다.
  요청하지 않은 요소가 화면에 나오는 원인이 대부분 이것입니다.
  **직접 다 써 두는 것이 유일한 방어입니다.**
- 감각어를 씁니다. `beautiful` 대신 `rain-slicked asphalt reflecting neon`.
- 모호한 동작은 금물입니다. `moves` 가 아니라 `staggers back a half step`.

---

## 4. 오디오와 대사

오디오는 프롬프트 끝에 몰아 쓰거나, 장면 서술 안에 섞어 씁니다. 세 종류를 구분합니다.

| 종류 | 쓰는 법 |
| --- | --- |
| 대사 | `The detective says: Of all the offices in this town, you had to walk into mine.` |
| 효과음 | `SFX: tires screeching, engine roaring` |
| 환경음 | `Ambient noise: the quiet hum of a starship bridge` |
| 음악 | `SFX: a swelling, gentle orchestral score begins to play` |

**대사는 한 호흡에 끝나는 길이로 씁니다.** 클립이 최대 8초입니다.
8초짜리에 두 문장 이상 넣으면 말이 빨라지거나 잘립니다. 한 사람당 한 문장이 안전합니다.

### 자막이 화면에 박히는 문제

Veo 는 대사를 자막으로 태워 넣는 버릇이 있습니다. 지워지지 않습니다.

**왜 생기나.** 자막이 **프레임에 구워진** 영상(유튜브·틱톡)으로 배웠기 때문입니다.
별도 글자 레이어가 아니라 픽셀이라 학습할 때 걸러내기 어렵습니다. 한 광고 제작자는
출력의 **40%가 자막 때문에 못 쓸 것**이었다고 증언했습니다. 구글의 공식 답은
「개선 중이니 다시 돌려 보라」 수준입니다.

**막는 법.** 어느 것도 확실하지 않습니다. 겹쳐 쓰세요.

1. **따옴표 대신 콜론.** `says "hello"` 보다 `says: hello` 가 자막을 덜 부릅니다.
2. **아포스트로피를 피합니다.** `don't` → `do not`.
3. **대사를 프롬프트 맨 앞에** 둡니다.
4. 본문에 `(no subtitles)`.
5. 네거티브에 `subtitles, captions, on-screen text, watermark`.

1·2·3 은 커뮤니티가 찾은 것이고 **구글 공식 안내는 여전히 따옴표 방식**입니다.
둘 다 시험해 보세요.

**네거티브에 「no」 를 쓰지 마세요.** 구글 공식 규칙입니다 — 네거티브 칸에는
`no subtitles` 가 아니라 **원치 않는 것을 명사로만** 나열합니다.
그리고 네거티브 칸은 **Vertex AI 에만** 있습니다. Gemini API 에는 없습니다.

**오디오는 끌 수 없습니다.** Veo 는 항상 소리를 만듭니다.

목소리를 지정할 때는 톤을 함께 적습니다 — `in a weary, low voice`,
`whispering, breathless`. 억양·나이·성별도 여기서 지정합니다.

**대사는 프롬프트 꼬리에 두지 마세요.** 입력 상한이 약 1,024 토큰이라
긴 프롬프트의 끝부분이 잘려 나가는데, 대사가 거기 있으면 대사부터 사라집니다.

---

## 5. 한 클립 안에서 여러 샷 — 타임스탬프 프롬프트

8초 안에서 컷을 나누려면 구간을 명시합니다. 컷마다 카메라·동작·소리를 다시 씁니다.

```
[00:00-00:02] Medium shot from behind a young explorer as she pushes aside a jungle vine.
[00:02-00:04] Reverse shot of her face, filled with awe. SFX: rustling leaves, distant bird calls.
[00:04-00:06] Tracking shot following her hand over the carvings on a crumbling wall.
[00:06-00:08] Wide, high-angle crane shot revealing the vast temple complex.
```

---

## 6. 제약

| 항목 | 값 |
| --- | --- |
| 길이 | 4초 · 6초 · 8초 |
| 해상도 | 720p · 1080p (1080p 는 8초에서만) |
| 비율 | 16:9 · 9:16 |
| 레퍼런스 이미지 | 최대 3장, 8초 필요 |
| 이어붙이기 | 기존 클립에 7초씩 추가, 최대 20회, 720p 만 |
| 첫·끝 프레임 | 시작 이미지와 끝 이미지를 주면 사이를 채웁니다 (소리 포함) |
| 워터마크 | 모든 결과물에 SynthID 가 들어갑니다 |

비율은 내보내기 설정이 아니라 **연출 조건**입니다. 9:16 이면 인물을 크게 잡고 세로
동선을 씁니다. 프롬프트를 쓰기 전에 정하고 끝까지 유지합니다.

레퍼런스 이미지(인물·물건·장소·스타일)를 주면 여러 샷에 걸쳐 같은 인물을 유지합니다.
이때 프롬프트에서 그 이미지를 지목합니다 —
`Using the provided images for the detective and the office, create a medium shot of ...`

**주의:** 물체를 넣고 빼는 기능은 아직 Veo 2 로 처리되며 **소리가 나오지 않습니다.**

---

## 7. 네거티브 프롬프트

Vertex AI 쪽에서 `negativePrompt` 를 별도 항목으로 받습니다. 필터가 아니라 유도입니다.

**쓰는 법 — 원하지 않는 것을 명사로 나열합니다.**

```
subtitles, captions, on-screen text, watermark, extra limbs, distorted hands,
oversaturation, plastic skin, jump cut, blurry, low quality
```

**하지 말 것 — 네거티브 안에 `no`, `don't`, `without` 을 쓰지 마세요.**
`no cartoons` 라고 쓰면 `cartoons` 라는 단어는 그대로 살아 있습니다.

**본문에서는 반대로 씁니다.** 없는 것을 「있는 상태」로 묘사합니다.

| 나쁨 | 좋음 |
| --- | --- |
| `no man-made structures` | `a barren landscape untouched by roads or buildings` |
| `no people` | `an empty street at dawn, silent and deserted` |

---

## 8. 잘 듣는 표현과 피할 표현

**잘 듣습니다**

| 갈래 | 표현 |
| --- | --- |
| 카메라 | `dolly in`, `tracking shot`, `crane shot`, `slow pan`, `aerial view`, `POV shot`, `180-degree arc shot` |
| 구도 | `wide shot`, `close-up`, `extreme close-up`, `low angle`, `two-shot` |
| 렌즈 | `shallow depth of field`, `wide-angle lens`, `macro lens`, `deep focus`, `soft focus` |
| 조명 | `harsh fluorescent overhead light`, `golden hour backlight`, `single practical lamp` |
| 질감 | `shot on 1980s color film, slightly grainy`, `handheld 16mm`, `claymation`, `film noir` |
| 감정 | `Emotion: wonder and reverence` — 표정 연기를 잡아 줍니다 |

**피합니다**

| 피할 것 | 이유 |
| --- | --- |
| `4k, masterpiece, best quality, trending` | 이미지 모델 관용구. 화면에 반영되지 않습니다 |
| 30 단어 미만의 짧은 프롬프트 | 리라이터가 마음대로 채웁니다 |
| `a sign that reads "OPEN"` | 글자가 뭉개집니다 |
| `five people`, `three cars` | 개수가 지켜지지 않습니다 |
| `while ... and simultaneously ...` | 동작 두 개가 서로 뭉갭니다. 하나만 씁니다 |
| 대사 두 문장 이상 | 8초에 안 들어갑니다 |
| `beautiful`, `amazing`, `epic` 단독 | 정보가 없습니다. 빛과 색으로 바꿔 씁니다 |

---

## 9. 내보내기 전 점검

1. 카메라가 첫 문장에 있는가
2. 인물의 옷·머리·표정이 적혀 있는가 (다음 샷과 이어야 하면 특히)
3. 동작이 하나이고 구체적인가
4. 조명을 지정했는가
5. 대사·효과음·환경음 중 최소 하나를 적었는가
6. 대사가 한 호흡인가, `says:` 형태인가
7. 네거티브에 `subtitles, captions, on-screen text` 가 있는가
8. 30 단어를 넘겼는가

---

## 10. 완성된 예

```
Medium shot with shallow depth of field, a tired detective in his fifties, grey stubble
and a loosened tie, leans back in a creaking chair behind a cluttered desk. He looks up
slowly as a woman in a red coat steps into the doorway. A single desk lamp throws hard
shadows across the wall; rain streaks the window behind him. Film noir, shot on 35mm,
cool green-grey grade, visible grain.
The detective says: of all the offices in this town, you had to walk into mine.
SFX: the chair creaking, rain against glass.
Ambient noise: a low hum from the radiator, muffled traffic below.
```

네거티브:

```
subtitles, captions, on-screen text, watermark, extra limbs, distorted hands,
oversaturation, plastic skin, jump cut
```
