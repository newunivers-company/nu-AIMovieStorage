---
id: prompt-basics
label: 프롬프트 기본
---

## 핵심 규칙

1. **슬롯 순서대로** 적습니다. 그림은
   상황(주체+동작) → 환경 → 인물 → 구도 → 빛 → 공기·질감 → 양식·렌즈·필름.
   영상은 주체 → 동작 → 카메라 동선 → 환경 움직임 → 빛 → 길이·화면비 → 바꾸지 말 것.
   요청 문구가 순서를 따로 정하면(시트는 태그·인물 묘사가 먼저) 그쪽을 따릅니다.
2. **앞쪽이 무겁습니다.** 가장 중요한 것을 맨 앞에 두세요.
3. **품질 수식어를 쓰지 마세요** — `masterpiece`·`8k`·`best quality` 는 그림을 안 바꾸고
   자리만 차지합니다. 원하는 것을 **구체로** 적으세요.
4. **고칠 때는 한 칸씩.** 여러 칸을 한 번에 바꾸면 무엇이 효과였는지 알 수 없습니다.
5. 모델이 못 알아듣는 표현을 피합니다 — 부정문, 셈(「정확히 세 명」), 글자 쓰기,
   왼쪽·오른쪽 같은 방향 지정은 자주 어긋납니다.


# 프롬프트 기본

여기서 만든 프롬프트는 프리픽·ComfyUI·Magnific 같은 바깥 도구에 그대로 붙여 넣습니다.
그러니 사람에게 설명하는 글이 아니라 **모델에 넣을 지시문**으로 씁니다.
설명·인사말·「~해 주세요」 같은 말은 넣지 않습니다.

---

## 1. 슬롯으로 씁니다

프롬프트는 자유 작문이 아니라 **칸을 채우는 일**입니다. 칸이 비면 모델이 마음대로 채웁니다.
비어서 가장 자주 사고가 나는 칸은 **구도**입니다.

### 이미지 — 6칸

여섯 칸은 **최소**입니다. 컷 키 이미지처럼 장면이 있는 그림은 핵심 규칙 1 의 일곱 자리로 —
주체와 동작이 «상황» 하나로 합쳐져 맨 앞에 서고, 빛 뒤에 «공기·질감» 이 한 칸 더 붙습니다.

| 순서 | 칸 | 무엇을 적는가 | 예 |
|---|---|---|---|
| 1 | Subject (주체) | 대상 + 나이·복장·표정 등 구체 속성 | `Korean woman in her 30s, short dark bob, mustard linen blazer` |
| 2 | Action / Pose (동작) | 무엇을 하고 있는가 | `leaning over a drafting table, pointing at a blueprint` |
| 3 | Environment (환경) | 장소·시간·배경 | `modern minimalist office, floor-to-ceiling windows, dusk` |
| 4 | Composition (구도) | 앵글·샷 크기·화면 배치 | `medium shot, slightly low angle, centered, shallow depth of field` |
| 5 | Lighting & Color (빛·색) | 광질·방향·팔레트 | `soft window light from the left, teal and amber palette` |
| 6 | Style / Technical (양식·기술) | 매체·화풍·렌즈·비율 | `editorial photography, 50mm f/1.4, 3:2` |

한 문장으로 이어 붙입니다.

```
[주체+속성], [동작], [환경], [구도], [빛·색], [양식·렌즈]
```

### 영상 — 움직임 칸이 더 붙습니다

정지 이미지 설명에 「움직인다」만 덧붙이면 **움직이는 사진**이 나옵니다.
영상은 움직임을 따로 적어야 합니다.

| 순서 | 칸 | 예 |
|---|---|---|
| 1 | Subject (주체) | `a woman in a mustard blazer at the window` |
| 2 | Action (동작) | `she turns her head toward the glass` |
| 3 | Camera move (카메라 동선) | `slow dolly in over 4 seconds` |
| 4 | Environment motion (환경 움직임) | `rain streaking down the glass, curtains drifting` |
| 5 | Lighting (시간에 따른 빛) | `neon reflections shifting across her face` |
| 6 | Format (길이·화면비) | `exactly 5 seconds, 9:16` |
| 7 | Consistency (바꾸지 말 것) | `keep her face and outfit identical to the reference` |

**카메라를 맨 앞에 두지 마세요.** 2026-09-18 이전에는 이 표의 1번이 카메라였는데,
공개 프롬프트 8,961개를 센 자료(vflow)가 정확히 그 실패를 지적합니다.

> 카메라로 시작하는 프롬프트는 **카메라가 작용할 대상이 없습니다.**
> 그렇다고 카메라를 아예 안 적으면 카메라는 그래도 생깁니다 — 모델의 기본값으로.

`tracking` 만 덩그러니 적으면 «무엇을» 따라갈지 모델이 정하고, 대개 엉뚱한 것이
움직입니다. 다만 그 자료도 솔직합니다 — 카메라와 조명을 둘 다 적은 프롬프트 중
카메라가 먼저 오는 것은 **56%** 뿐이라, 규칙이 아니라 **권장 순서**입니다.

**속도를 반드시 적습니다.** 모델에는 기본 카메라 속도가 없습니다.
`slow` `gradual` 같은 수식어나 `5-second pan right` 같은 길이를 붙이지 않으면 제멋대로 빨라집니다.

### 가장 자주 빠뜨리는 칸 — 실측

같은 8,961개에서 각 항목이 **적혀 있는 비율**입니다.

| 항목 | 적는 비율 | |
|---|---|---|
| 무드 | 97.9% | 거의 다 적습니다 |
| 일관성 잠금 | 83.2% | 코퍼스가 스스로 «필수» 로 취급합니다 |
| 카메라 | 77.6% | |
| 조명 | 73.7% | |
| **길이** | **46.0%** | 절반 이상이 빠뜨립니다 |
| 네거티브 | 44.3% | |
| **화면비** | **24.9%** | **가장 안 적고, 없으면 좋은 클립을 가장 자주 망칩니다** |

우리 앱은 길이(구도잡기 타임라인)와 화면비(프로젝트 설정)를 **이미 알고 있습니다.**
그러니 이 둘은 빈칸으로 나갈 이유가 없습니다 — 컷 영상 프롬프트는 맨 뒤에
`Format: exactly 4.0 seconds, 9:16 aspect ratio.` 를 자동으로 답니다.

### 일관성은 «바꾸지 마라» 로, 둘 이상 잠급니다

> 원하는 것을 더 자세히 적는 것보다 **«그대로 두라» 고 적는 것**이 낫습니다.
> 긍정 묘사는 모델의 선택과 경쟁하지만, 제약은 그 선택을 아예 없앱니다.

잠근 항목이 평균 2.26개인데, **하나만 잠근 15%** 가 「얼굴은 같은데 옷이 바뀐다」의
주범입니다. 얼굴·의상·장소를 **함께** 잠그고, 그 문장은 **맨 뒤**에 둡니다 —
이미 묘사가 끝난 장면에 제약이 걸리도록.

```
Keep 여울's face, hair and outfit, and the location and lighting,
identical to the attached references throughout the entire shot.
```

이것은 규칙 6(«정체성은 하나»)을 문장으로 한 번 더 박는 것입니다. 레퍼런스 그림을
거는 것만으로는 부족합니다 — 모델은 참조를 «참고» 로만 읽을 수 있습니다.

### 명령형 동사를 본문에 쓰지 마세요

「바꿔 · 지워 · 빼 · 늘려 · 추가해」 같은 말이 본문에 들어가면, 일부 영상 모델은
그 어투를 보고 **«새로 만들기» 가 아니라 «영상 편집·연장» 작업으로 오인합니다.**

| 이렇게 쓰면 | 이렇게 바꿉니다 |
|---|---|
| 겉옷을 빨간색으로 바꿔 | 그녀는 빨간 겉옷을 입고 있다 |
| 배경에서 간판을 지워 | 배경은 간판이 없는 민 벽이다 |
| 3초 더 늘려 | 8초짜리 한 컷 |

---

## 2. 앞쪽이 무겁습니다

대부분의 모델은 **앞에 나온 말에 더 큰 가중치**를 둡니다.
잃으면 안 되는 것 — 주체, 구도, 빛 — 을 앞쪽 15단어 안에 넣습니다.
품질 수식어(`sharp focus`, `8k`)는 맨 뒤로 보냅니다.

---

## 3. 길이

| 대상 | 권장 |
|---|---|
| 이미지 일반 | 20–80단어. 20–50단어가 장황한 버전보다 나은 경우가 많습니다 |
| 영상 | 가이드에 따라 60–120단어까지 권합니다 |
| 100단어 초과 | 주의가 흩어지고 문장끼리 모순될 위험이 커집니다 |

길이보다 **단어당 정보량**이 중요합니다. 형용사 40개는 서로를 희석시킵니다.

---

## 4. 자주 쓰는 용어

### 구도·앵글

| 영문 | 뜻 |
|---|---|
| close-up / medium shot / wide shot | 얼굴 / 상반신 / 전신·전경 |
| bird's eye view | 머리 위 수직 부감 |
| worm's eye view | 바닥에서 올려다봄 |
| low angle / high angle | 아래에서 / 위에서 |
| Dutch angle | 화면을 기울인 앵글 |
| rule of thirds | 삼분할 배치 |
| leading lines | 시선을 끌고 가는 선 |
| negative space | 여백 |
| shallow depth of field | 얕은 심도 (배경 날림) |
| bokeh | 초점 밖 빛망울 |

### 조명

| 영문 | 뜻 |
|---|---|
| golden hour | 해 뜨고 지기 직전의 따뜻한 빛 |
| blue hour | 해가 진 직후의 푸른 빛 |
| Rembrandt lighting | 한쪽 뺨에 삼각형 하이라이트가 생기는 인물 조명 |
| rim light / backlight | 윤곽을 살리는 역광 |
| overcast / diffused | 흐린 날처럼 그림자가 부드러운 빛 |
| chiaroscuro | 명암 대비가 극단적인 빛 |
| volumetric light | 공기 중에 빛줄기가 보이는 상태 |
| studio lighting | 통제된 스튜디오 조명 |
| neon | 네온·간판의 인공광 |

### 렌즈·카메라

| 영문 | 뜻 |
|---|---|
| 35mm film | 필름 질감 |
| 85mm f/1.4 | 인물용 망원 + 얕은 심도 |
| macro | 접사 |
| fisheye | 어안 |
| tilt-shift | 미니어처처럼 보이는 이동·기울임 렌즈 |
| medium format | 중형 포맷의 넓은 계조 |

### 카메라 무빙 (영상)

| 영문 | 뜻 |
|---|---|
| dolly in / push-in | 카메라가 피사체 쪽으로 전진 |
| pull-back | 뒤로 후퇴하며 넓혀 보여줌 |
| pan | 제자리에서 좌우로 회전 |
| whip pan | 빠르게 휘두르는 팬 |
| tilt | 제자리에서 상하로 회전 |
| truck | 카메라가 좌우로 평행 이동 (배경 원근이 계속 바뀜) |
| pedestal | 카메라 높이를 위아래로 이동 |
| orbit | 피사체 둘레를 한 바퀴 돎 |
| arc | 둘레를 일부만 돎. 오빗보다 자연스러움 |
| crane | 높이를 바꾸며 이동. 도착점을 함께 적습니다 |
| crash zoom | 급격한 줌 |
| handheld | 손각대의 미세한 흔들림 |
| steadicam / gimbal | 흔들림 없이 따라가는 이동 |
| locked-off static | 완전 고정 |

---

## 5. 좋은 예 · 나쁜 예

| 나쁨 | 좋음 | 이유 |
|---|---|---|
| `a woman in a city` | `Japanese woman in her 60s crossing a rain-slicked Shibuya intersection at dusk, yellow umbrella, street-level shot` | 주체·환경·시간·구도가 다 있음 |
| `a beautiful landscape` | `misty Scottish highland at dawn, heather in bloom, stone cottage with chimney smoke, atmospheric landscape photography` | 「아름다운」은 그림을 정하지 못함 |
| `portrait of a chef` | `portrait of a chef, Rembrandt lighting from the left, warm kitchen glow behind, steam rising from a pan catching the backlight` | 빛의 방향과 원천이 정해짐 |
| `cool poster, high quality` | `minimalist wordmark logo for a coffee roaster, warm brown on cream, geometric sans-serif, flat vector, centered` | 매체·색·배치가 정해짐 |
| `realistic photo, cartoon style` | 한쪽만 고름 | 서로 모순되면 어느 쪽도 제대로 안 나옴 |

---

## 6. 모델이 잘 못 알아듣는 표현

| 쓰지 말 것 | 왜 | 대신 |
|---|---|---|
| `no logos on the wall` 같은 부정형 | 최신 모델 상당수가 부정을 그냥 «벽·로고» 라는 단어로 읽습니다. 오히려 로고가 생깁니다 | `a plain matte uninterrupted wall` — 놓을 자리를 없앱니다 |
| `beautiful, amazing, stunning` | 그림을 하나도 정하지 못하면서 토큰만 먹습니다 | 구체 명사·수치로 바꿉니다 |
| `masterpiece, best quality, 8k` 남발 | 주제가 흐릿한 프롬프트를 구해 주지 못합니다 | 주체·구도를 먼저 채웁니다 |
| `three people` 같은 개수 지정 | 모델은 수를 세지 못합니다. 자주 틀립니다 | 개수가 중요하면 각 인물을 따로 서술하거나, 생성 후 골라냅니다 |
| 간판·로고의 긴 문구 | 문자 렌더링은 여전히 불안정합니다. 짧은 단어는 최근 모델이 꽤 맞히지만 긴 문구·희귀 단어·복잡한 서체는 자주 깨집니다 | 문구를 짧게, 서체를 단순하게. 또는 나중에 합성합니다 |
| 추상 개념 (`freedom`, `nostalgia` 만 적기) | 그릴 대상이 없습니다 | 그 감정을 만드는 **사물과 빛**을 적습니다 |
| 상반된 지시 (`photorealistic, flat illustration`) | 둘 다 반쯤 섞인 결과가 나옵니다 | 한 방향만 고릅니다 |
| 손가락·손 클로즈업 | 아직도 자주 어긋납니다 | 손을 화면 주역으로 두는 구도를 피하거나, 동작을 단순하게 |

### 네거티브 프롬프트

- **ComfyUI·Stable Diffusion 계열**: 네거티브 칸이 따로 있습니다. 짧게 씁니다.
  2023년식 `ugly, bad anatomy, low quality` 목록을 통째로 붙이지 않습니다.
  실제로 그 오류가 보일 때만 해당 항목을 추가합니다.
- **최근 상용 모델 상당수**: 네거티브 프롬프트 칸 자체가 없습니다.
  빼고 싶은 것은 **긍정 서술로 뒤집어** 본문에 적습니다.

---

## 7. 정체성은 문장을 고정합니다

같은 인물을 여러 시트에 걸쳐 쓸 때, 모델은 매번 얼굴을 조금씩 바꿉니다.

- **정체성 블록을 한 번 쓰고, 글자 그대로 재사용합니다.**
  `Mina, 28, oval face, short black bob, warm brown skin, small mole under the left eye`
- 같은 뜻이라도 **표현을 바꾸면 다른 사람이 됩니다.** 매번 새로 쓰지 않습니다.
- 텍스트만으로는 한계가 있습니다. **레퍼런스 이미지를 함께 거는 쪽이 훨씬 안정적입니다.**
  이 도구에서 변형 시트가 부모 시트를 정체성 기준으로 자동으로 무는 이유입니다.
- 정체성 블록에는 **바뀌지 않는 것만** 넣습니다. 옷·포즈·배경은 장면 쪽에 적습니다.

---

## 8. 고칠 때는 한 칸씩

결과가 마음에 안 들면 프롬프트를 통째로 다시 쓰지 않습니다.
**한 번에 한 절만** 바꿉니다. 그래야 무엇이 효과가 있었는지 알 수 있습니다.
잘 나온 절은 칸별로 모아 두고 다음 프롬프트에 재사용합니다.

---

## 9. 대상 도구에 따라

| 대상 | 문체 |
|---|---|
| Midjourney | 짧게. 60단어 미만이 낫습니다. 기본값이 «예쁜» 쪽으로 기울어 있어, 다큐멘터리처럼 담백한 그림이 필요하면 `--style raw` 를 씁니다. 지나치게 기술적인 카메라 용어는 잘 듣지 않습니다 |
| Stable Diffusion / ComfyUI | 쉼표로 끊은 키워드 나열. 네거티브 프롬프트를 함께 씁니다. 가중치 문법(`(cinematic:1.3)`)이 통합니다 |
| Flux 계열 | 자연어 서술을 길게 써도 됩니다. 단어 하나짜리 화풍 지정은 약합니다 |
| GPT 이미지 / Nano Banana 계열 | 대화체 자연어. 문자 렌더링과 편집에 강합니다. 네거티브 칸은 없습니다 |

---

## 10. 내보내기 전 점검

1. 여섯 칸이 다 찼는가. 특히 **구도**.
2. 잃으면 안 되는 것이 앞쪽 15단어 안에 있는가.
3. 부정형(`no ~`, `without ~`)이 남아 있는가 → 긍정 서술로 바꿉니다.
4. 서로 모순되는 지시가 있는가.
5. 그림을 정하지 못하는 형용사가 있는가.
6. 영상이면 **카메라 동선과 속도**가 적혀 있는가.
7. 같은 인물이면 **정체성 블록이 글자까지 동일한가.**
