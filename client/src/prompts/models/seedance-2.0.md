---
id: seedance-2.0
label: Seedance 2.0
---

# Seedance 2.0 프롬프트 가이드

ByteDance 의 영상 생성 모델입니다. 텍스트·이미지·영상·오디오를 한꺼번에 받아
**한 번의 생성으로 여러 샷과 소리(대사·환경음·효과음)까지 같이** 만듭니다.
그래서 프롬프트는 «장면 설명» 이 아니라 **짧은 촬영 대본** 으로 씁니다.

---

## 1. 잘하는 것 / 못하는 것

| 잘합니다 | 못합니다 |
| --- | --- |
| 한 클립 안에서 컷이 나뉘는 멀티샷 구성 | 초 단위 정확한 타이밍 지정 (불안정) |
| 물리 반응 — 무게·마찰·관성이 보이는 움직임 | 빠르고 충격이 큰 액션 (팔다리가 무너집니다) |
| 영상과 소리를 한 번에 — 입모양 맞춘 대사 포함 | 화면 안의 글자 렌더링 (간판·자막·제품 라벨) |
| 레퍼런스로 준 인물·스타일 유지 | 빠른 손동작 (손가락이 늘어나거나 붙습니다) |
| 카메라 워크 지시 반영 | 인물 레퍼런스 5명 이상 (급격히 불안정해집니다) |

- 12초를 넘어가면 인물이 원본에서 벗어나고 색이 흔들리는 현상이 보고됩니다.
- 실존 인물의 얼굴을 레퍼런스로 넣는 것은 차단됩니다.

---

## 2. 프롬프트 구조 — 이 순서로 씁니다

ByteDance 가 안내하는 순서입니다. **앞에 쓴 것이 더 강하게 반영됩니다.
주체와 동작을 맨 앞에 두세요.**

| 순서 | 요소 | 쓰는 법 |
| --- | --- | --- |
| 1 | 주체 | 누가/무엇이. 구체적인 외형 특징 한두 개. |
| 2 | 동작 | 동사로. 결과까지 적습니다. 형용사보다 동사가 화면을 움직입니다. |
| 3 | 장소 | 어디서. 시간대·날씨까지. |
| 4 | 빛과 색 | 광원의 방향과 색조. |
| 5 | 카메라 | **샷당 하나만.** |
| 6 | 스타일 | 필름 종류·화풍 등 하나만. |
| 7 | 소리 | 대사·환경음·음악. 아래 3절 표기법으로. |
| 8 | 제약 | 빼고 싶은 것. 맨 끝에 한 줄. |

동작을 쓸 때는 **원인이 아니라 결과**를 적습니다.
`the car turns` 가 아니라 `the tires smoke as the car slides ninety degrees` 처럼
무게와 힘이 계산되도록 씁니다.

카메라 움직임은 다음 중 **하나만** 고릅니다. 두 개를 겹치면 화면이 떨립니다.

> 밀어 들어가기(push-in) · 빼기(pull-out) · 팬 · 트래킹 · 오빗 · 항공 · 핸드헬드 · 고정

---

## 3. 길이와 문체

- **서술문으로 씁니다.** 태그 나열이 아닙니다. 사람이 읽는 촬영 지시서처럼.
- **짧게.** 단일 샷은 60~100단어 안팎이 적당합니다. 길수록 좋아지지 않고,
  과하게 길면 품질이 떨어집니다.
- 멀티샷이면 **샷당 2~3문장**으로 끊습니다.
- 길이 상한은 영어 1,000단어 / 중국어 500자 수준으로 안내됩니다. 이건 상한이지 목표가 아닙니다.
- 형용사를 쌓지 마세요. 비슷한 말 세 개보다 정확한 말 하나가 낫습니다.
- 해상도·비율·길이는 **프롬프트에 쓰지 않습니다.** 설정값입니다.
  `make it 4K and 10 seconds` 같은 문장은 낭비입니다.

---

## 4. 멀티샷 — 번호로 나눕니다

한 클립 안에 컷을 나누려면 **`Shot 1`, `Shot 2`, `Shot 3`** 으로 번호를 붙입니다.
시간대(`0-3s`)로 나누지 마세요. **초 단위 지정은 불안정해서 결과가 망가집니다.**

```
Shot 1: Wide shot of the empty stage, a single spotlight snaps on. Static camera.
Shot 2: Medium shot of the singer stepping into the light, gripping the mic. Slow push-in.
Shot 3: Close-up of her eyes as she opens them. Locked-off camera.
```

- 번호를 건너뛰지 마세요.
- 샷마다 카메라 지시는 하나씩.
- 컷을 나눌 생각이 없다면 `no cuts` 라고 적습니다. 안 적으면 모델이 알아서 자릅니다.

---

## 5. 소리 — 괄호 종류로 구분합니다

Seedance 2.0 은 괄호 모양을 «이게 무슨 정보인가» 로 읽습니다.
이걸 지키면 대사가 자막으로 나오거나 효과음을 소리 내어 읽는 사고를 막습니다.

| 표기 | 뜻 | 예 |
| --- | --- | --- |
| `( )` | 배경 음악 | `(slow piano, minor key)` |
| `< >` | 효과음·환경음 | `<rain on a metal roof>` |
| `{ }` | 대사 | `{We should leave. Now.}` |
| `【 】` | 화면에 찍히는 글자 | `【Chapter One】` |

- 영어가 아닌 대사는 **언어를 먼저 밝힙니다.** — `says in Korean {지금 나가자}`
- **한 장면에 한 언어만** 씁니다.
- 대사는 짧게. 길면 입모양이 밀립니다. 긴 대사는 컷을 나눠 나눠 담습니다.
- 말투를 지정하면 잘 듣습니다. `flat and tired`, `dry and proud` 처럼.

---

## 6. 레퍼런스 자산 연결

이미지·영상·오디오를 올리면 `@Image1`, `@Video1`, `@Audio1` 같은 이름이 붙습니다.
프롬프트에서 **그 이름으로 역할을 지정**합니다.

```
@Image1 is the woman. @Image2 is the alley at night.
She walks toward the camera. Imitate the walking rhythm of @Video1.
```

- 파일 원본 ID(`asset-2026xxxx`)를 문장에 그대로 쓰면 안 먹습니다. 반드시 `@Image1` 형식으로.
- **레퍼런스가 말하는 것과 반대되는 문장을 쓰지 마세요.** 이미지가 밤인데 `sunny noon` 이라고 쓰면 둘 다 무너집니다.
- 슬롯을 다 채울 필요 없습니다. **총 4~5개**가 권장됩니다.

| 종류 | 최대 개수 | 조건 |
| --- | --- | --- |
| 이미지 | 9장 | 장당 30MB, JPEG/PNG/WEBP 등 |
| 영상 | 3개 | 개당 2~15초, 24~60fps, 200MB |
| 오디오 | 3개 | 개당 2~15초, MP3/WAV, 15MB |

---

## 7. 해상도 · 비율 · 길이

| 항목 | 값 |
| --- | --- |
| 길이 | 4~15초 |
| 해상도 | 480p / 720p / 1080p / 4K (4K 는 정식 2.0 만. Fast·Mini 는 720p 까지) |
| 비율 | 21:9 · 16:9 · 4:3 · 1:1 · 3:4 · 9:16 · 레퍼런스 자동 맞춤 |

길이를 고르는 기준입니다.

| 길이 | 담을 수 있는 것 |
| --- | --- |
| 4~6초 | 동작 하나 + 강조 하나. 가장 안정적입니다. |
| 7~10초 | 접근 → 동작 → 반응까지. |
| 11~15초 | 여러 샷이 있는 짧은 흐름. 대신 인물이 흔들릴 위험이 커집니다. |

**작업 순서:** 낮은 해상도·4~6초로 구도와 톤을 먼저 잡고, 마음에 드는 것만 최종 해상도로 다시 뽑습니다.
20초짜리가 필요하면 한 번에 뽑지 말고 샷 3개로 나눠 뽑아 붙입니다.
4K 는 H.265 로 인코딩돼서 브라우저에서 미리보기가 안 되는 경우가 있습니다.

---

## 8. 네거티브 프롬프트

**별도의 네거티브 프롬프트 칸이 없습니다.** 뺄 것은 프롬프트 **맨 끝에 한 줄**로 씁니다.

확실히 듣는 것은 자막과 소리입니다.

```
No subtitles. No on-screen text.
No BGM; ambient and action sounds only.
No audio.
No logo, no watermark.
```

화질·구도 쪽 부정문(`no flickering`, `no distortion`, `stable composition`)도 같이 쓰지만,
자막·소리만큼 확실하지는 않습니다. **줄이는 것이지 없애는 것은 아닙니다.**
인물 영상이면 `avoid jitter and bent limbs` 를 기본으로 붙입니다.

---

## 9. 잘 듣는 표현 / 피할 표현

| 잘 듣습니다 | 피하세요 |
| --- | --- |
| 물리 결과 — `water sprays toward the camera`, `dust settles behind the wheels` | `stunning`, `beautiful`, `masterpiece`, `8k` — 화면을 바꾸지 못합니다 |
| 카메라 하나 — `slow push-in`, `locked-off` | `epic cinematic camera movement` — 무슨 뜻인지 모릅니다 |
| 리듬 형용사 — `slow`, `smooth`, `steady`, `gentle` | 수식어 없는 `fast` — 화면이 무너집니다 |
| 소리의 질감 — `muffled`, `reverb`, `high-pitched` | 소리를 안 적는 것 — 원하지 않는 음악이 붙습니다 |
| 샷 번호로 나눈 구성 | 시간대(`0-3s`)로 나눈 구성 |
| `Shot 2: ... handheld` 처럼 샷마다 하나씩 | 한 샷에 카메라 움직임 두 개 이상 |
| `@Image1 is the woman` | `asset-2026xxxx is the woman` |
| 사람이 아닌 인물·창작 캐릭터 | 실존 인물 얼굴 — 차단됩니다 |

고칠 때는 **한 번에 하나만** 바꿉니다. 여러 개를 동시에 바꾸면 무엇이 효과였는지 알 수 없습니다.

---

## 10. 완성 예시

**단일 샷**

```
A middle-aged fisherman in a soaked yellow raincoat hauls a net over the gunwale,
the rope biting into his gloves as the boat rolls. Open sea before dawn,
low grey light from the horizon, cold blue cast. Handheld camera, slight drift.
16mm film grain. <waves slapping the hull, rope creaking>
No subtitles. No BGM; ambient and action sounds only.
```

**멀티샷 + 대사**

```
@Image1 is the woman. @Image2 is the diner interior at night.

Shot 1: Wide shot of the empty diner, rain streaking the window. Static camera.
Shot 2: Medium shot of the woman sliding into the booth, pulling off her wet coat.
        Slow push-in. She says, flat and tired, {He's not coming.}
Shot 3: Close-up of her hands wrapping around the coffee cup. Locked-off camera.

Warm sodium light from overhead, cold blue from the window. 35mm film look.
<rain on glass, a refrigerator hum>
No subtitles. No BGM. Avoid jitter and bent limbs.
```

---

## 11. 확인되지 않은 것

- 프롬프트 길이 상한은 출처마다 다르게 적혀 있습니다(영어 1,000단어 / 3,000자 등).
  **어느 쪽이든 짧게 쓰는 편이 결과가 좋습니다.**
- 화질 관련 부정문이 실제로 얼마나 반영되는지는 수치로 확인된 바 없습니다.
- 후속 버전(Seedance 2.5)은 길이·레퍼런스 개수가 다릅니다. 이 문서는 **2.0 기준**입니다.
