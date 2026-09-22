---
id: composition
label: 구도
---

## 핵심 규칙

1. **적는 순서** — 샷 크기 → 카메라 높이 → 앵글 → 배치 → 심도 → 화면비.
2. **샷 크기는 용어로** 못 박습니다. 「가까이」가 아니라
   `wide shot`·`medium shot`·`close-up`·`extreme close-up`.
   대화 장면의 기본값은 미디엄, 감정은 클로즈업입니다.
3. **카메라 높이와 앵글은 다른 축**입니다. 지면에 놓고 수평으로 찍을 수도 있습니다.
   높이(눈높이·허리·지면·머리 위)와 각도(올려봄·내려봄)를 따로 적으세요.
4. **헤드룸·리드룸**을 적습니다 — 인물이 보는 쪽에 여백을 둡니다.
   안 적으면 얼굴이 프레임에 꽉 차거나 정수리가 잘립니다.
5. **심도는 무엇이 선명한지로** 적습니다 — `shallow depth of field, eyes sharp, background dissolved`.
6. **화면비를 반드시** 적습니다. 안 적으면 모델이 제 기본값으로 갑니다.


# 구도

구도는 「무엇을, 프레임 안 어디에, 얼마나 크게, 어느 높이에서 보는가」입니다.
프롬프트에서는 이것을 **문장 앞쪽에** 적습니다. 모델은 앞에 온 말을 더 크게 반영합니다.
얼굴·의상 묘사를 앞에 두면 화면이 얼굴 쪽으로 당겨집니다.

## 적는 순서

```
[앵글] + [샷 크기] + [피사체] + [배치] + [배경·여백] + [렌즈·심도] + [화면비]
```

```
low-angle medium shot, a woman in a red coat, positioned on the left vertical third,
empty street filling the right two thirds, 85mm, shallow depth of field, 16:9
```

지킬 것 넷.

1. 카메라 용어는 문장 앞에 두고 쉼표로 끊습니다.
2. **앵글 하나, 샷 크기 하나.** 여러 개를 나열하면 서로 희석됩니다.
3. 모순되는 지시를 같이 적지 않습니다. (조감 + 눈높이, 클로즈업 + 배경 전체)
4. 구도를 먼저, 세부 묘사를 나중에 적습니다.

## 샷 크기 (shot size)

인물의 어디가 프레임에 잘리는지로 정해집니다.

| 영문 | 한국어 | 프레임 기준 |
|---|---|---|
| `establishing shot` (ES) | 설정 샷 | 장면 첫머리. 장소를 알려 줍니다. |
| `extreme wide shot` (EWS) | 익스트림 와이드 | 인물이 장소에 비해 아주 작습니다. 주인공은 장소입니다. |
| `wide shot` / `long shot` (WS/LS) | 와이드 · 롱 | 전신과 주변을 함께 담습니다. |
| `full shot` (FS) | 풀 샷 | 머리부터 발끝까지, 인물이 프레임을 채웁니다. |
| `medium wide shot` (MWS) | 미디엄 와이드 | 무릎 위. |
| `cowboy shot` | 카우보이 샷 | 허벅지 중간 위. 허리춤이 보입니다. |
| `medium shot` (MS) | 미디엄 | 허리 위. 대화 장면의 기본값입니다. |
| `medium close-up` (MCU) | 미디엄 클로즈업 | 가슴 위. |
| `close-up` (CU) | 클로즈업 | 얼굴이 화면을 채웁니다. |
| `extreme close-up` (ECU) | 익스트림 클로즈업 | 눈 같은 한 부분만. 여백이 거의 없습니다. |
| `over-the-shoulder shot` (OTS) | 오버 더 숄더 | 상대 어깨 너머로 봅니다. 층이 생겨 깊이가 납니다. |

관절에서 자르지 않습니다. 팔꿈치·무릎 바로 위나 아래로 잡으면 자연스럽습니다.

## 카메라 높이 (camera height)

높이는 「카메라가 바닥에서 얼마나 떨어져 있는가」, 앵글은 「어느 쪽으로 기울여 보는가」입니다.
**다른 축입니다.** 지면에 카메라를 놓고 수평으로 찍을 수도 있습니다.

| 영문 | 한국어 | 쓰임 |
|---|---|---|
| `eye level` | 눈높이 | 중립. 기본값. |
| `shoulder level` | 어깨 높이 | 눈높이보다 살짝 낮은 대화 톤. |
| `hip level` | 허리 높이 | 허리춤 동작, 손에 든 물건. |
| `knee level` | 무릎 높이 | 아이·동물 시점, 발밑 동작. |
| `ground level` | 지면 높이 | 카메라가 바닥에 붙습니다. |
| `overhead` / `bird's eye view` | 부감 · 조감 | 수직으로 내려다봅니다. |

## 앵글 (camera angle)

| 영문 | 한국어 | 인상 |
|---|---|---|
| `eye-level shot` | 눈높이 | 중립, 자연스러움, 대화하는 느낌. |
| `low-angle shot` | 로우 앵글 | 아래에서 올려다봅니다. 힘·권위·크기. |
| `high-angle shot` | 하이 앵글 | 위에서 내려다봅니다. 약함·고립·상황 설명. |
| `bird's eye view` | 버즈 아이 | 수직 위 90도. 거리감·패턴·규모. |
| `worm's eye view` | 웜즈 아이 | 지면에서 올려다봅니다. 경외·기념비. 아껴 씁니다. |
| `POV shot` | 시점 샷 | 인물의 눈 위치. 몰입. |
| `Dutch angle` | 더치 앵글 | 수평선을 기울입니다. 불안·혼란. |

로우 앵글은 광각과, 텔레포토는 인물 분리와 잘 맞습니다.

| 렌즈 | 성질 |
|---|---|
| `wide-angle` | 시야가 넓고 원근이 과장됩니다. 공간을 보여 줍니다. |
| `telephoto` | 앞뒤가 압축되고 인물이 배경에서 떨어집니다. |
| `fisheye` | 통 왜곡. 눈에 띄지만 쉽게 장난스러워집니다. |
| `macro` | 극단적 확대. 질감. |

## 화면 분할과 배치

| 영문 | 한국어 | 뜻 |
|---|---|---|
| `rule of thirds` | 삼분할 | 화면을 가로·세로 3등분해 선이나 교차점에 피사체를 둡니다. |
| `centered composition` / `symmetrical composition` | 중앙 · 대칭 | 정면성·격식. 모델의 기본 성향과 맞아 잘 나옵니다. |
| `leading lines` | 유도선 | 길·난간 같은 선이 시선을 피사체로 끕니다. |
| `negative space` | 여백 | 비워 둔 면적. |
| `foreground framing` / `framing device` | 전경 프레임 | 문틀·나뭇가지로 피사체를 감쌉니다. |
| `foreground / midground / background` | 전경 · 중경 · 배경 | 세 층으로 나눠 깊이를 만듭니다. |

「rule of thirds」만 적으면 어느 삼분선인지 모릅니다. **방향을 못 박습니다.**

```
positioned on the left vertical third
on the right third intersection
subject on the right third, horizon on the lower third
```

여백은 「비어 있다」가 아니라 **무엇으로 채워지는지** 적습니다.
`empty corridor filling the left half`, `plain grey wall behind the subject`

## 헤드룸 · 리드룸

| 영문 | 한국어 | 뜻 |
|---|---|---|
| `headroom` | 헤드룸 | 머리 꼭대기와 프레임 윗변 사이 여백. |
| `lead room` / `nose room` / `looking room` | 리드룸 · 노즈룸 | 인물이 보거나 움직이는 **앞쪽** 여백. |

규칙.

- 눈은 위에서 1/3 지점에 둡니다.
- 헤드룸이 넓으면 죽은 공간이 생기고, 좁으면 턱과 목에 눈이 쏠려 답답합니다.
- 샷이 가까워질수록 헤드룸은 줄어듭니다. 익스트림 클로즈업은 정수리가 잘려도 정상입니다.
- 와이드에서는 하늘과 땅의 균형이 헤드룸보다 우선합니다.
- 여백은 **시선·진행 방향 앞**에 둡니다. 뒤를 비우면 막힌 느낌이 납니다.

```
eyes on the upper third line
looking screen right with lead room on the right
walking to the left, empty road ahead of her on the left
```

## 피사계 심도 (depth of field)

| 영문 | 한국어 | 결과 |
|---|---|---|
| `shallow depth of field` | 얕은 심도 | 인물만 선명, 배경은 흐림. |
| `deep focus` | 깊은 심도 | 앞에서 뒤까지 전부 선명. |
| `selective focus` | 선택 초점 | 한 지점만 선명. |
| `bokeh` | 보케 | 흐려진 배경의 빛망울. |
| `soft focus` | 소프트 포커스 | 전체가 부드럽게. 몽롱한 톤. |
| `tilt-shift` | 틸트시프트 | 띠 모양으로만 선명. 미니어처 느낌. |
| `35mm` / `50mm` / `85mm` | 초점거리 | 35 환경, 50 자연스러운 원근, 85 인물·배경 압축. |
| `f/1.8` · `f/2.8` · `f/8` | 조리개 | 숫자가 작을수록 배경이 크게 흐려집니다. |

숫자만 적으면 반영이 약합니다. **숫자와 결과를 함께** 적습니다.

```
85mm, f/1.8, shallow depth of field, background melting into soft bokeh
24mm, deep focus, sharp from the foreground rocks to the far ridge
```

## 화면비

화면비를 바꾸면 같은 프롬프트라도 구도가 달라집니다. **먼저 정하고 시작합니다.**

| 비율 | 성질 |
|---|---|
| `16:9` | 가로가 넓습니다. 인물이 작아지고 공간이 넓게 잡힙니다. 설정 샷에 맞습니다. |
| `9:16` | 세로. 전신이 들어가고 헤드룸이 넓어집니다. 세로로 세울 것이 없으면 비어 보입니다. |
| `1:1` · `4:5` | 인물 중심. 배경이 줄어듭니다. |
| `2:1` · `panoramic` | 파노라마. 넓게 쓰려면 명시해야 합니다. |

## 좋은 예와 나쁜 예

**좋음**

```
low-angle medium shot, an old fisherman in oilskins, positioned on the left vertical third,
harbour cranes filling the right two thirds, 50mm, deep focus, 16:9
```
앵글 하나, 샷 하나. 위치를 못 박았고, 남는 면적이 무엇으로 차는지 말했습니다.

**나쁨**

```
cinematic shot of a fisherman, beautiful composition, bird's eye view eye-level,
close-up of the whole harbour
```
「cinematic」과 「beautiful composition」은 지시가 아닙니다. 조감과 눈높이는 동시에 성립하지 않습니다.
클로즈업과 항구 전체도 모순입니다.

---

**좋음**

```
full shot, head to toe, full body visible, uncropped, a dancer standing on a wooden stage floor,
centered composition, 9:16
```
전신을 긍정문으로 말했고, 발이 닿는 바닥을 줘서 아래쪽 잘림을 막았습니다.

**나쁨**

```
full body portrait, gorgeous, highly detailed, ultra detailed face and eyes
```
「highly detailed」·얼굴 묘사는 화면을 얼굴로 당깁니다. 전신을 요구해도 다리가 잘립니다.

---

**좋음**

```
medium close-up, subject on the right third looking screen left,
empty corridor filling the left half, shallow depth of field
```

**나쁨**

```
medium close-up, don't cut off the head, no empty space, dynamic angle
```
부정문은 지켜지지 않습니다. 「dynamic angle」은 정의가 없습니다.

## 모델이 잘 못 알아듣는 표현

| 쓰지 않는 표현 | 이유 | 대신 |
|---|---|---|
| `cinematic`, `beautiful composition`, `perfect framing` | 방향이 없습니다. | 샷 크기·앵글·배치를 직접 적습니다. |
| `don't cut off the feet`, `no empty space` | 긍정 프롬프트 안의 부정문은 자주 무시됩니다. | 원하는 상태를 긍정문으로. 부정 프롬프트 칸이 따로 있으면 거기에 `cropped, cut off, out of frame, missing feet, missing head`. |
| `bird's eye view eye-level shot` | 카메라가 두 곳에 있을 수 없습니다. | 하나만 고릅니다. |
| `close-up` + 「배경 전체가 보이게」 | 모순입니다. | 샷을 나누거나 미디엄으로 내립니다. |
| 앵글·렌즈 용어를 다섯 개 이상 나열 | 서로 희석되어 전부 약해집니다. | 앵글 1 · 샷 1 · 렌즈 1. |
| `f/1.4` 만 단독으로 | 숫자만으로는 반영이 약합니다. | 결과 묘사를 붙입니다. |
| `rule of thirds` 만 | 어느 삼분선인지 모릅니다. | `on the left vertical third`. |
| `dynamic angle`, `interesting perspective` | 이름이 없는 지시입니다. | 로우 앵글, 더치 앵글처럼 이름 있는 앵글로. |
| 화면비를 안 정함 | 모델 기본값 구도가 나옵니다. | 먼저 정합니다. |

## 잘림을 막는 문구

전신이 필요할 때 함께 적습니다.

```
full body visible, head to toe, entire figure in frame, uncropped
```

바닥을 함께 줍니다. `standing on a stone floor`, `standing on grass`.
발이 닿을 곳이 있으면 아래쪽이 덜 잘립니다.

## 점검표

- 앵글 하나만 적었는가
- 샷 크기 하나만 적었는가
- 피사체가 프레임 어디에 있는지 방향으로 말했는가
- 남는 면적이 무엇으로 채워지는지 말했는가
- 시선·진행 방향 앞이 비어 있는가
- 심도를 숫자와 결과로 함께 적었는가
- 화면비를 정했는가
- 구도가 세부 묘사보다 앞에 있는가
