---
id: photoreal
label: 실사 — AI 티 없애기
---

## 핵심 규칙

**모델은 이미 «예쁜 쪽»으로 치우쳐 있습니다.** `beautiful`·`perfect skin` 같은 말은
아무 정보도 주지 않으면서 그 치우침을 더 밉니다. 쓰지 마세요.

1. **피부는 부위를 갈라** 적습니다 — `visible pores across the T-zone, softer on the cheeks`.
   얼굴 전체에 같은 질감을 깔면 밀랍이 됩니다.
2. **결점을 최소 하나** 둡니다 — 잔주름, 홍조, 유분, 잔머리, 미세한 비대칭.
   실제 얼굴은 균일하지 않습니다.
3. **눈에는 광원을 물리적으로** 둡니다 — `catchlight from a window to camera-left in both eyes`.
   「눈」만 그리면 캐치라이트가 안 생겨 죽은 눈이 됩니다. **양쪽이 같은 광원**이어야 합니다.
4. **광원을 지목합니다** — 어디서, 어떤 크기로, 어느 방향으로.
   빛을 안 적으면 모델이 사방에서 고르게 비추는 스튜디오 기본값을 씁니다.
5. **보정하지 말라고 못 박습니다** — `no retouching, unretouched skin`.
   부정문이 안 통하는 모델에서는 긍정으로 뒤집습니다 — `skin as photographed, texture intact`.
6. **영상에서는 질감을 뒤에 얹습니다.** 앞에 두면 동작 지시를 밀어냅니다.
7. **풀샷에는 피부 지시를 넣지 마세요.** 그릴 픽셀이 없고 다른 지시만 밀립니다.


# 실사 — AI 티 없애기

AI 특유의 인물 느낌을 지우고, 실제 영화와 구분되지 않는 결을 내는 것이 이 문서의 목표입니다.

## 먼저 알아야 할 것 — 모델은 이미 «예쁜 쪽»으로 치우쳐 있습니다

이게 AI 티의 뿌리입니다. 취향 문제가 아니라 **출고 상태**입니다.

Meta 의 Emu 논문이 이걸 수치로 보여 줍니다. 11억 쌍으로 학습한 모델을 **수천 장의
극히 매력적인 이미지**로 추가로 미세조정하면, 그 뒤로는 **모든 생성물**의 «시각적
매력» 선호도가 크게 올라갑니다. 요즘 상용 모델은 대개 이 단계를 거쳐 나옵니다.

그래서 **가만두면 늘 광고 사진이 나옵니다.** 실사로 가려면 좋게 만드는 말을
더하는 게 아니라 **그 편향을 되돌리는 말**을 넣어야 합니다.

여기서 결론 하나가 바로 나옵니다.

> `8k` · `ultra realistic` · `hyperdetailed` · `masterpiece` · `cinematic` 을 빼세요.

이 말들은 **정보를 주지 않으면서 기본값 편향만 강화합니다.** `masterpiece, best
quality` 는 원래 애니 태그 체계에서 온 말이라 실사 모델에는 맞지도 않습니다.
요즘 실사 모델들은 이 태그가 필요 없게 튜닝되어 나옵니다.

「무조건 나빠진다」는 아닙니다. 통제 실험으로 잰 연구는 없습니다. 정확히 말하면
**아무 정보도 주지 않으면서 이미 기울어진 쪽으로 더 민다**는 것입니다.

대신 **하나의 구체적인 촬영 상황**으로 바꾸세요. `professional product photography`
가 `high quality` 보다, `realistic skin texture` 가 `8K` 보다 모델에 훨씬 많은
정보를 줍니다.

## AI 티가 나는 신호 — 이름을 붙여 둡니다

이름이 있어야 고칠 수 있습니다.

### 피부

| 신호 | 왜 그렇게 나오나 |
| --- | --- |
| **밀랍 피부** | 확산 모델이 과하게 매끈하게 만들면서 미세 질감·혈색 변이·빛의 감쇠 셋을 한꺼번에 지웁니다 |
| **모공 없는 균일 질감** | 실제 얼굴은 T존·볼·턱의 모공이 제각각인데 모델은 얼굴 전체에 같은 패턴을 깝니다 |
| **보정 기본값** | 학습 데이터에 리터칭·뷰티필터 사진이 많아 「잡티 없는 매끈함」이 기본값으로 굳었습니다 |
| **과한 대칭** | 위와 같은 뿌리입니다 |

### 눈

| 신호 | 왜 |
| --- | --- |
| **죽은 눈** | 캐치라이트는 각막에 맺힌 **광원의 정반사**입니다. 광원을 물리적으로 두지 않고 「눈」을 그리면 이 반사가 안 생깁니다 |
| **양쪽 반사광이 안 맞음** | 두 눈이 「같은 광원」을 공유한다는 제약을 모델이 안 지킵니다 |
| **깜박임이 이상함** | 너무 드물게, 너무 규칙적으로, 양쪽이 완벽히 동시에 깜박입니다. 실제 깜박임은 살짝 비대칭입니다 |

실제 눈은 이걸 **동시에** 갖고 있습니다 — 젖은 캐치라이트, 홍채 고유 무늬,
공막의 실핏줄, 눈꺼풀에 박힌 속눈썹 뿌리, 윗눈꺼풀의 자연스러운 무게.

### 조명

| 신호 | 왜 |
| --- | --- |
| **너무 완벽한 균일광** | 시청자들이 AI 클립을 알아보는 첫 단서입니다 — 「실제 촬영으로는 큰 준비 없이 나올 수 없을 만큼 고르게 아름다운」 조명 |
| **얼굴만 뜬 느낌** | 얼굴의 그림자 방향이 환경 조명과 안 맞습니다. 인물이 창문 앞을 지나가는데 얼굴 조명이 그대로인 식입니다 |
| **소실점이 여럿** | 실제 화면에선 평행선이 한 점으로 모입니다 |

### 렌즈

| 신호 | 왜 |
| --- | --- |
| **오려 붙인 듯한 심도** | 모델에는 유리도 센서도 없습니다. 「앞은 선명, 뒤는 흐림」이라는 **패턴 재현**일 뿐이라 전경·피사체·배경의 **깊이 관계**가 없습니다 |
| **윤곽의 헤일로** | 피사체 테두리에 회색·청록 띠. 머리카락·투명체·장신구·손가락에서 먼저 드러납니다 |

### 움직임 — 영상에서만

| 신호 | 왜 |
| --- | --- |
| **정체성 표류** | 확산 영상 모델은 **매 프레임을 노이즈에서 다시 만듭니다.** 지속 기억에 고정된 정체성이 없어서 프레임마다 「최선의 추측」이 미세하게 어긋나고 그게 쌓입니다. 클립이 길수록, 움직임이 클수록 심해집니다 |
| **미끄러지는 보행** | 물리를 이해하는 게 아니라 **통계적 상관**을 배웠습니다. 다리 교차 없이 옆으로 미끄러지는 걷기가 대표입니다 |
| **마이크로 표정 부재** | 실제로 말할 때는 볼이 올라가고 턱이 이동하고 눈가가 강세에 반응합니다. AI 는 입만 움직입니다 |
| **립싱크 분리** | 입과 턱만 바뀝니다. 입술을 정확히 닫거나 벌려야 하는 음소(`p` `b` `m` `f` `v` `o`)에서 제일 잘 드러납니다 |

## 그래서 무엇을 적나

### 피부 — 불완전함을 적습니다

```
natural visible pores, subtle uneven skin texture, fine peach fuzz
visible pores around the cheeks and nose, fine peach fuzz catching the side light
fine lines around the eyes, natural forehead lines, subtle pigmentation
unretouched skin, no beauty retouching
```

### 눈 — 광원을 눈에 비춥니다

```
catchlight in eyes, wet lower lid, natural iris detail, visible eyelash roots
soft window light reflected in the eyes
individual wet eyelashes, imperfect eyebrow hairs
irregular hairline, a few flyaway hairs
natural lip texture
```

### 조명 — 광원을 지목합니다

「부드러운 조명」이 아니라 **어디에 있는 무슨 빛인지** 적습니다. 이것 하나로
광원 불일치와 죽은 눈이 같이 잡힙니다.

```
Large north-facing window on camera left, soft daylight
Small direct on-camera flash, hard frontal light
Cool overhead bathroom light mixed with weak morning daylight
Soft overcast daylight, open shade, low contrast across the face
soft window light with warm lamp fill, cool rim from hallway
```

촬영 현장 용어인 `practical light` · `motivated lighting` 자체가 생성기에
효과가 있다는 근거는 없습니다. **광원을 구체적으로 지목하는 쪽**이 확인된 방법입니다.

### 렌즈와 필름 — 장치를 적습니다

```
32 mm / 50 mm spherical primes
anamorphic 2.0x lens
65 mm photochemical contrast
16mm black-and-white film
fine grain; subtle halation on speculars
soft vignette for period authenticity
handheld micro-shake
shot as if on 1980s color film, slightly grainy
```

헤일레이션에는 물리적 근거가 있습니다. 필름의 뒷면 차광층을 없애면 과노출 경계에
적·주황 후광이 생깁니다. 그 구조를 그대로 쓰는 필름이 실제로 있어서
`tungsten-balanced, visible halation around lights` 가 말이 됩니다.

### 덜 완벽하게 — 두 가지 원칙

```
candid amateur flash snapshot, harsh direct on-camera flash
bright hotspot on the faces, background falling into near-black
slight motion blur, framing a little tilted
mild over-exposure with a few blown highlights
heavy grain, halation around the bright lights
mixed warm-streetlight and cool-fluorescent color
flat overcast daylight, no sun
unposed, off-center framing
candid moment with her looking down at her hands rather than at the camera
```

1. **끝까지 미세요.** 반만 적용하면 아마추어도 프로도 아닌 어정쩡한 것이 됩니다.
2. **「아닌 것」이 아니라 「무엇인지」로.** 「평범한, 모델 같지 않은」은 무시됩니다.
   나이대·직업·피부 질감·애매한 표정처럼 **중립적인 구체어**로 적으세요.

## 네거티브에 넣을 말

```
plastic skin, waxy skin, poreless skin, airbrushed skin
dead eyes, empty eyes, doll eyes
asymmetrical eyes, uneven eyes
beauty filter, instagram filter
oversaturated, overexposed
bad hands, malformed hands, fused fingers
```

영상에는 이것도 —
`face distortion, warping, morphing, floating objects, background shifting, flicker, sudden cut`

## 부정문이 안 통하는 모델에서는

FLUX·Runway 는 네거티브를 지원하지 않습니다. Runway 는 한술 더 떠
**넣으면 반대 결과가 나올 수 있다**고 공식으로 경고합니다.

그때는 **「그게 없으면 대신 무엇이 보이나」**를 묻고 그걸 적습니다.

| 이렇게 쓰던 것 | 이렇게 |
| --- | --- |
| no people | empty · deserted · solitary |
| no colors | monochrome · black and white |
| no text | clean surfaces · unmarked · blank |
| 안경 없는 인물 | a portrait showing clear, unobstructed eyes |
| 모자 없는 인물 | a person with natural hair flowing freely |
| not scary | peaceful, welcoming, warm atmosphere with soft golden lighting |

우리 목적에 맞춘 것 — 아래는 위 원칙을 적용한 것이지 따로 검증한 문장은 아닙니다.

| 네거티브 | 긍정으로 |
| --- | --- |
| plastic skin | visible pores, fine peach fuzz, uneven skin tone, slight redness on the cheeks and nose |
| dead eyes | wet catchlight from the window on camera left, visible eyelash roots |
| oversaturated | muted desaturated palette, low-contrast overcast daylight |

**미드저니 주의.** `--no` 는 단어를 **각각 따로** 읽습니다. `--no modern clothing` 은
「no modern」 + 「no clothing」 으로 해석되어 사고가 납니다. 이럴 땐 원하는 쪽을
긍정으로 적으세요.

## 영상에서 얼굴이 무너지는 것을 막기

- **짧게 끊습니다.** 길수록, 동작이 클수록 정체성 표류가 커집니다.
- **얼굴을 크게 잡습니다.** 얼굴이 화면에서 작으면 픽셀이 모자라 무너집니다.
  대사 컷은 클로즈·미디엄으로 가세요. 와이드에서 얼굴이 크게 깨진다는 보고가
  모델마다 반복됩니다.
- **레퍼런스를 겁니다.** 원본 그림을 앵커로 주입하는 것이 표류 대책으로 확인된
  거의 유일한 방법입니다. 우리 앱의 «정체성 기준 레퍼런스»(규칙 6)가 바로 이 역할입니다.
- **한 샷에 카메라 하나, 동작 하나.** 여기에 **끝점**을 붙이세요 —
  `then settles back into place`.

## 영상의 플라스틱 얼굴 — 질감은 뒤에서 얹습니다

AI 영상의 인물은 얼굴이 조금 플라스틱처럼 매끈하게 나옵니다.

**첫 프레임에 질감 좋은 그림을 넣으면 영상이 그 결을 이어받을 것 같지만, 그렇다는
근거를 못 찾았습니다.** 입력 그림이 구도·피사체·조명·화풍을 정하는 강한 앵커라는
것까지는 확인됩니다. 그런데 **모공이나 그레인 같은 고주파 질감이 프레임마다 살아남는다는
실측이나 공식 진술은 없습니다.**

그래서 첫 프레임에만 기대지 마세요. 실무 권고는 오히려 반대 방향입니다 —
**질감은 영상을 뽑은 뒤에 얹습니다.**

순서가 정해져 있습니다. **그레이딩 먼저, 그다음 블러, 마지막이 그레인.**
그레인 위에서 다시 그레이딩하면 질감이 어긋납니다.

| 단계 | 값 |
| --- | --- |
| 가우시안 블러 | 0.3~0.8 px — AI 특유의 미세 샤프닝을 먼저 죽입니다 |
| 필름 그레인 | 35mm·16mm 그레인을 불투명도 8~15%, 내장 필터면 2~3% |
| 오버레이 클립 | Overlay 20~40%(시네마틱) · Soft Light(직접 찍은 느낌) |
| 하이라이트 | 약한 헤일레이션. 폰 촬영 느낌이면 색수차도 |

여러 생성본을 이어 붙인 컷도 **하나의 그레인 레이어로 덮으면** 한 숏처럼 읽힙니다.

**한계를 알아 두세요.** 그레인과 블러는 **질감의 티**를 지웁니다. **움직임과 해부의
티는 못 지웁니다.** 미끄러지는 보행이나 손가락 개수는 후처리로 안 됩니다.

시간축 일관성을 높이면 디테일이 뭉개진다는 맞바꿈은 영상 복원 논문에 명시되어
있습니다. 다만 그건 초해상·복원 이야기이고, **생성 모델이 같은 이유로 모공을 평균 내
버린다는 직접 근거는 없습니다.** 관찰 수준의 기술만 있습니다 — AI 영상에는 센서
노이즈가 없고 대신 합성적인 과샤프니스와 플라스틱 표면이 있다는 것.

## 점검표

1. 품질 수식어(`8k` `masterpiece` `ultra realistic`)를 뺐는가
2. 피부의 **불완전함**을 하나라도 적었는가
3. **광원을 지목**했는가 — 어디에 있는 무슨 빛인지
4. 눈에 **캐치라이트**를 적었는가
5. 렌즈나 필름을 **장치 이름**으로 적었는가
6. 「덜 완벽하게」를 **끝까지** 밀었는가, 아니면 반만 적용했는가
7. 영상이면 — 클립이 짧은가, 얼굴이 큰가, 레퍼런스가 걸렸는가
