---
id: acting
label: 연기 지시
---

## 핵심 규칙

이 절만 요청에 실립니다(까닭과 실측은 아래에 있습니다 — 사람이 읽는 몫).

1. **감정 이름만 적지 마세요.** 생성기는 감정을 모르고 **눈에 보이는 신호**만 압니다.
   `sad` → `gaze lowered, lips pressed together, shoulders dropped`.
   감정 이름을 써도 되지만 **신호를 최소 하나** 붙입니다.
2. **한 줄의 순서는 부위 · 움직임 · 크기 · 길이.**
   `her lower lip trembles, barely perceptible, for a beat, then she presses her lips flat`
   **크기 말을 빼지 마세요**(`slight`·`barely perceptible`·`pronounced`) — 안 적으면
   모델이 늘 큰 쪽을 고릅니다.
3. **한 컷에 인물 동작 하나 + 카메라 동작 하나.** 「놀랐다가 슬퍼졌다가 웃는다」는
   한 컷이 아니라 세 컷입니다.
4. **시선에는 대상을 적습니다** — `gaze fixed on the man across the table`.
   「카메라를 보지 않는다」처럼 **부정문으로 적지 마세요.**
5. **프레이밍에 맞는 부위만** 지시합니다. 풀샷에 속눈썹을 적어 봐야 그릴 픽셀이 없고,
   말만 길어져 다른 지시를 밀어냅니다.
6. **손은 접촉점까지** 적습니다 — 무엇을 어디로 어떻게 쥐는지.
7. **참는 감정은 얼굴과 몸을 갈라** 적습니다 — 얼굴에 하나, 몸에 하나.
8. **과장되면 지시를 빼세요.** 기본값이 이미 셉니다. 톤 라벨을 하나로 줄이고,
   강도 말을 앞에 붙이고, 그래도 크면 감정 이름을 빼고 행동만 남깁니다.
   감정이 큰 장면일수록 **작게** 적습니다.
9. **대사는 따로 떼어** 적습니다. 서술에 섞으면 자막으로 박히거나 무시됩니다.
   모델마다의 대사 문법은 «모델 규칙» 문서를 따릅니다.

# 연기 지시

## 감정 이름은 연기가 아닙니다

생성기는 감정을 모릅니다. **감정에 딸린 눈에 보이는 신호**만 압니다.
`sad`, `angry`, `emotional` 만 적으면 대개 아무 일도 일어나지 않는
밋밋한 기본 얼굴이 나옵니다.

감정 이름은 적어도 됩니다. 다만 **신호를 최소 하나** 붙이세요.

| 이렇게 쓰면 | 이렇게 바꿉니다 |
| --- | --- |
| happy | lip corners rising, crinkles at the outer eyes, brows relaxed |
| sad | gaze lowered, lips pressed together, shoulders dropped |
| angry | jaw clenched, brows drawn together, breathing through the nose |
| surprised | eyes widen, brows lift, lips part slightly, breath catches |
| tense | shoulders raised, hands still, blinking less than usual |

## 한 줄의 순서 — 부위 · 움직임 · 크기 · 길이

한 가지 연기를 적을 때의 순서입니다.

1. **부위** — 눈, 입꼬리, 턱, 어깨, 손
2. **움직임** — 무엇이 어느 쪽으로
3. **크기** — `slight`, `barely perceptible`, `pronounced`
4. **길이·전환** — 얼마나 유지되고 무엇으로 넘어가는지 (영상만)

`her lower lip trembles, barely perceptible, for a beat, then she presses her lips flat`

크기 말을 빼면 모델이 알아서 정합니다. 정해 주세요.

## 한 컷에 연기 하나

한 컷에는 **분명한 인물 동작 하나 + 카메라 동작 하나**입니다.
동작 두세 개를 겹치면 어느 쪽도 제대로 나오지 않고, 서로 모순되는 지시는
모델이 둘을 섞어 이상한 것을 만듭니다.

`놀랐다가 슬퍼졌다가 웃는다` 는 한 컷이 아니라 세 컷입니다.

### 초에 맞는 동작량

길이가 정해 주는 것입니다. 넘치면 뭉개집니다.

| 길이 | 넣을 수 있는 것 |
| --- | --- |
| 5초 | 이어지는 동작 **하나** + 작은 손짓 하나 |
| 8초 | 동작 전환 **한 번** (고개를 든다 → 눈이 마주친다 → 입을 연다) |
| 그보다 길면 | 동작을 더 쌓지 말고, **하나를 느리게 늘려** 구간으로 나눕니다 |

8초에 다섯 가지를 시키는 것이 연기가 안 나오는 첫째 원인입니다.

## 영상은 비트로 쪼갭니다

시간을 형용사로 적지 말고 **몇 걸음, 몇 번, 어느 순간**으로 적습니다.

- 나쁨 — `she walks across the room emotionally`
- 좋음 — `she takes four steps to the window, pauses, and pulls the curtain in the final second`

감정 변화는 **시작 얼굴과 끝 얼굴을 각각** 적습니다. 「미묘한 감정 변화」는
시작도 끝도 없어서 지시가 되지 않습니다.

`she listens, still — her eyes widen and her breath catches — then she blinks slowly and her gaze drops to the floor`

타임코드를 이해하는 모델이면 `0:00-0:03 ... 0:03-0:06 ...` 로 나눠도 됩니다.

## 시선에는 대상을 적습니다

시선은 연기에서 가장 강한 신호인데 가장 자주 빠집니다.
**어디를 보는가**를 반드시 적으세요.

- `gaze fixed on the man across the table`
- `eyes flick up to something off-frame left, then back down`
- `eyeline just below the lens` — 카메라를 정면으로 보지 않으면서 가까운 느낌

「카메라를 보지 않는다」처럼 부정문으로 적지 마세요. 네거티브를 읽지 않는
모델이 있습니다. **시선의 목적지**를 적으면 같은 결과가 나옵니다.

## 프레이밍에 맞는 부위를 지시합니다

풀샷에서 눈꺼풀 지시는 그릴 자리가 없습니다.

| 사이즈 | 지시할 것 |
| --- | --- |
| 클로즈업 | 눈, 눈썹, 입술, 호흡 |
| 바스트 | 시선, 어깨, 턱, 손 |
| 전신·풀샷 | 자세, 무게 중심, 걸음, 팔 |

## 손은 접촉점까지 적습니다

손은 뭉개지기 가장 쉬운 곳입니다. **무엇에 어떻게 닿는지**를 말하지 않으면
모델이 빈자리를 손가락으로 채웁니다.

`his right hand rests flat on the table, fingers distinct and slightly apart`

## 참는 감정은 얼굴과 몸을 갈라 적습니다

「화났지만 참는다」는 한 부위에 두 지시를 겹치는 말이라 섞여 버립니다.
**얼굴에 하나, 몸에 하나**로 나누면 그대로 나옵니다.

`his face stays still, jaw set — his hand tightens around the glass`

## 대사는 따로 떼어 놓습니다

대사는 화면 묘사와 섞지 말고 별도 블록에 넣고, 화자 이름을 컷마다 **같은
표기로** 씁니다. 짧은 컷에 대사를 많이 넣으면 말이 빨라지거나 잘립니다.
4초짜리면 한두 마디입니다.

대사와 함께 **말투와 동작을 붙여** 적습니다.
`she says it flatly, without lifting her eyes`

### 먼저 — 그 모델이 소리를 만드는가

이것이 모든 차이의 뿌리입니다. 소리를 못 만드는 모델에 대사를 적어 봐야
**자막으로 박히거나 그냥 무시됩니다.**

| 소리를 만듭니다 | 못 만듭니다 |
| --- | --- |
| Veo 3 · 3.1 (끌 수 없음) · Sora 2 · Kling 2.6 이상 · MiniMax H3 · Wan 2.5 이상 · LTX-2 계열 · Seedance 2.x | Runway Gen-4 · Gen-4.5 · Kling 2.5 이하 · Hailuo 02 · 2.3 · Wan 2.2 · Luma · Pika |

오른쪽 모델에는 **대사 문자열을 빼고 입 모양과 표정만** 적습니다. 소리가 필요하면
따로 립싱크 단계로 넘깁니다.

### 한 문장을 통째로 따옴표에 넣지 마세요

대사 지시에서 가장 크게 갈리는 지점입니다. 통째로 넣으면 모델이 연기하지 않고
**낭독**합니다. 타이밍이 무너져 급히 읽거나, 남는 구간을 대사와 어긋나는
잔동작으로 채웁니다.

**구 하나 → 연기 지시 하나 → 다음 구** 로 끊습니다.

```
나쁨
A middle-aged man speaks slowly: "I remember after you kids came along,
your mom said something to me I never quite understood." He looks sad.

좋음
A middle-aged man speaks in a sad, slow-paced voice, "I remember after you
kids came along..." He pauses and looks to the side, then continues,
"your mom..." His eyes widen momentarily. He finishes with a cracking voice,
"said something to me I never quite understood."
```

**시선을 바꾸는 지시는 구와 구 사이에만 먹습니다.** 말하는 도중에 넣으면 무시됩니다.

**한 비트에 지시 하나입니다.** 셋을 넣으면 모델이 우선순위를 못 잡고 연기가
경련처럼 됩니다.

### Kling 2.6 — 화자 라벨을 붙이는 공식 문법

Kling 공식 가이드가 못 박아 둔 형식입니다.
`"문장" + 감정 + 말 속도 + 음색 + 화자 라벨`

```
[Black-suited Agent, raspy, deep voice]: "Don't move."
Immediately, as the speaker switches,
[Female Assistant, clear, fearful voice]: "I'm scared."
```

네 가지가 규칙입니다.

1. **라벨은 고유하고 일관되게.** 대명사(`he`, `the man`)를 쓰지 마세요.
2. **행동을 먼저 쓰고 대사를 붙입니다** — 그래야 누가 말했는지 고정됩니다.
3. **인물마다 다른 톤·감정 라벨**을 줍니다.
4. **`Immediately,` / `as the speaker switches` 로 차례를 강제합니다.**
   연결어가 없으면 **한 사람이 계속 말해 버립니다**(공식 경고).

2인 대화까지가 권장입니다. 세 명 이상은 성능이 떨어집니다. 노래·대사 장면은
**10초** 쪽이 안정적입니다.

**Kling 3.0 은 한국어를 한국어로 잘 말합니다**.
다만 **연기가 과장됩니다** — 톤 라벨을 한 단계 낮춰 적으세요. 자세한 것은
모델 문서의 Kling 절에 있습니다.

2.6 공식 문서에는 「중국어·영어만」 이라고 적혀 있는데 3.0 은 다릅니다.
옛 판의 제약을 새 판에 그대로 옮기지 마세요.

### Runway — 시간을 찍어 표정 비트를 나눕니다

Runway 영상 모델은 **소리를 만들지 않습니다.** 대신 표정을 초 단위로 찍는
공식 형식이 있습니다. 「비트로 쪼갠다」를 가장 구체적으로 적는 방법입니다.

```
[00:00 through 00:02] looking away, then turns towards camera
[00:02 through 00:03] rapidly crash zoom to closely frame his eyes
[00:03 through 00:04] black eyes squint
[00:04 through 00:07] brow slowly furrows
```

공식 권고는 **타임스탬프와 자연어 문장을 함께** 쓰라는 것입니다.

퍼포먼스 캡처(Act-Two)에는 **표정 세기 노브**가 있습니다. 기본값 3이고,
내리면 표정이 줄지만 **인물이 덜 흔들리고**, 올리면 표정은 커지지만
얼굴이 깨질 수 있습니다. 「기본은 `subtle`」이라는 규칙이 벤더 UI 에도
그대로 박혀 있는 셈입니다.

### 목소리 연기를 지시하는 말

Kling 공식 트리거 워드입니다. 대사 라벨 안에 그대로 넣습니다.

| 갈래 | 영문 |
| --- | --- |
| 음량·명료도 | `Whispering` · `Softly Speaking` · `Clearly Speaking` |
| 감정·톤 | `Excitedly Speaking` · `Complaining` · `Sighing` · `Gently Speaking` |
| 음색 | `Hoarse Voice` · `Deep Voice` |
| 속도 | `Fast Talking` · `Slow Talking` |
| 주고받기 | `Answering` · `Arguing` · `Shouting` · `Discussing` |
| 발성 행동 | `Crying / Sobbing` · `Screaming` · `Laughing / Chuckling` |
| 형식 | `Reciting` · `Monologue` · `Narration / Voiceover` |

Runway 의 음성 합성은 대사 안에 태그를 박습니다 —
`[whispers]` `[laughs]` `[shouts]` `[excited]` `[sarcastic]`.

### 쉼은 문장부호로 만듭니다

Kling Avatar 공식 팁입니다. **쉼표로 끊어 적으면 그 자리에서 쉽니다.**
`pause` 라고 적는 것보다 이쪽이 확실합니다.

```
I thought about it, for a long time, and I still don't know.
```

## 과장되면 지시를 빼세요

생성기는 대개 **기본값이 이미 셉니다.** 그래서 감정을 적을수록 커집니다.
연기가 과하게 나오면 지시를 더 붙이지 말고 **덜어냅니다.** 순서는 이렇습니다.

1. **톤 라벨을 하나로 줄입니다.** 「화내며 떨리는 목소리로 다급하게」는
   셋을 다 하려다 과장됩니다.
2. **강도 말을 앞에 붙입니다** — `slight` · `subtle` · `barely perceptible`.
   안 적으면 모델은 늘 큰 쪽을 고릅니다.
3. **감정 이름을 빼고 행동만 남깁니다.** 얼굴은 대사와 상황이 알아서 합니다.

감정이 큰 장면일수록 **작게 적습니다.** 화를 참는 얼굴이 화내는 얼굴보다 세게
읽히는 것과 같은 이치입니다.

| 크게 나올 때 | 이렇게 바꿉니다 |
| --- | --- |
| 화내며 소리치는 | 낮게 눌러 말하는, 턱에 힘이 들어간 |
| 울먹이며 | 목이 살짝 잠긴, 눈에 물기만 |
| 놀라서 | 숨이 한 박자 멎었다가 |
| 활짝 웃으며 | 입꼬리만 올라간, 눈가가 접히는 |

Runway 의 퍼포먼스 캡처에도 같은 장치가 있습니다. 표정 세기 노브의 기본값이
**3**이고, 올리면 표정은 커지지만 얼굴이 깨집니다. 「기본은 약하게」가
벤더 UI 에도 그대로 박혀 있는 셈입니다.

## 호흡과 말의 리듬

LTX 공식 문서가 잘라 말합니다 — **쉼 지시가 대사 프롬프트에서 효과가 가장 큰
단 하나의 지시**입니다. 감정 형용사를 더 붙이는 것보다 쉼을 한 번 넣는 편이 낫습니다.

### 쉼과 속도

| 영문 | 뜻 |
| --- | --- |
| `pauses, then continues` | 쉬었다가 이어 말한다 |
| `trails off` | 말끝을 흐린다 |
| `holds the silence for a beat` | 한 박자 침묵을 끈다 |
| `finishes quietly` | 조용히 끝맺는다 |
| `speaks slowly, weighing each word` | 한 마디씩 곱씹으며 천천히 |

### 목소리의 결

| 영문 | 뜻 |
| --- | --- |
| `cracking voice` · `voice catching` | 목이 메인다 |
| `whispered, low energy` | 기운 없는 속삭임 |
| `voice tight with restraint` | 참느라 조여진 목소리 |
| `voice trembling` | 목소리가 떨린다 |
| `warm, conversational delivery` | 따뜻한 대화체 |
| `forced confidence` | 억지 자신감 |
| `slightly breathy` | 숨결이 섞인 |

### 숨 그 자체

| 영문 | 뜻 |
| --- | --- |
| `holds her breath for a beat, then continues` | 한 박자 숨을 참았다가 잇는다 |
| `exhales softly, then murmurs` | 가볍게 내쉬고 중얼거린다 |
| `pauses, exhales, then adds` | 쉬고 내쉬고 덧붙인다 |
| `voice barely above a breath` | 숨소리보다 겨우 큰 목소리 |
| `out of breath` · `speaking between breaths` | 숨이 차서 · 숨 사이로 |
| `swallows before continuing` | 삼키고 나서 이어 말한다 |

### 침묵의 모양

| 영문 | 뜻 |
| --- | --- |
| `quiet between phrases` | 구와 구 사이의 정적 |
| `long silence after the line` | 대사 뒤 긴 침묵 |
| `the room holds the silence` | 공간이 침묵을 머금는다 |

### 쉼을 적는 두 가지 방법

- **짧은 쉼** — 대사 안의 쉼표나 `...`
- **긴 쉼** — 따옴표를 끊고 그 사이에 지시문을 넣습니다

```
"I know exactly who did it."  He pauses, exhales, then adds,
"I just can't prove it."
```

MiniMax H3 만 다릅니다. 숨·웃음·헐떡임은 화면 묘사가 아니라
**소리 칸(`overall_soundscape`)** 에 적으라고 공식이 지시합니다.

## 대사 중에는 카메라를 크게 움직이지 마세요

LTX 공식 권고입니다. 대사 중 넓은 수평 팬은 모델이 **정지 구간을 가리는 데**
써서, 지루한 커버리지로 읽힙니다.

- 감정이 바뀌는 지점에 **느린 푸시인**
- **쉬는 동안에는 프레임 고정** — 배우가 그 박자를 끌게 둡니다
- 주의가 옮겨 갈 때만 **살짝 랙 포커스**

## 대사가 길이를 넘기면 씹힙니다

자연스러운 말 속도는 **초당 두세 단어**입니다. 8초면 16~22단어가 한계입니다.

| 길이 | 넣을 수 있는 대사 |
| --- | --- |
| 4초 | 짧은 주고받기 한두 마디 |
| 8초 | 긴 한 줄, 또는 짧은 두 줄, 또는 한 줄 + 반응 |

말 앞뒤에 **침묵 한 박자**를 남겨 두세요. 꽉 채우면 급히 읽습니다.
Kling 은 대사·노래 장면에 10초를 권합니다.

## 자주 쓰는 용어

### 눈 · 눈썹

| 영문 | 뜻 | 쓰는 곳 |
| --- | --- | --- |
| brows drawn together / knitted brow | 미간 좁힘 | 분노, 집중, 곤혹 |
| inner brow raise | 눈썹 안쪽만 올림 | 슬픔, 걱정, 애원 |
| brows lift | 눈썹 올림 | 놀람, 관심 |
| eyes widen | 눈 크게 뜸 | 놀람, 공포 |
| eyes narrow / squint | 눈 가늘게 뜸 | 의심, 경계 |
| gaze lowered / downcast eyes | 시선 내림 | 수치, 체념 |
| eyes flick to ~ | 시선이 ~로 튐 | 동요, 계산 |
| slow blink | 천천히 깜빡임 | 체념, 피로 |
| eyes glistening / glossy eyes | 눈에 물기 | 울기 직전 |
| crinkles at the outer eyes | 눈가 주름 | 진짜 웃음 |

### 입 · 턱

| 영문 | 뜻 | 쓰는 곳 |
| --- | --- | --- |
| lip corners rise | 입꼬리 올라감 | 미소 |
| lips pressed together | 입술 다뭄 | 참음, 결심 |
| pursed lips | 입술 오므림 | 못마땅함 |
| lips part slightly | 입술 살짝 벌어짐 | 놀람, 말하려다 멈춤 |
| lower lip trembles | 아랫입술 떨림 | 울음 직전 |
| jaw clenched | 턱 악뭄 | 참는 분노 |
| jaw muscle twitching | 턱 근육 움찔 | 억눌린 긴장 |
| nose wrinkled, lip curled | 코 찡그림, 입술 말림 | 혐오 |
| sneer | 비웃음 | 경멸 |
| chin dips / chin lifts | 턱 내림 / 턱 듦 | 위축 / 도전 |

### 몸 · 호흡

| 영문 | 뜻 | 쓰는 곳 |
| --- | --- | --- |
| shoulders drop | 어깨 처짐 | 낙담, 긴장 풀림 |
| shoulders squared | 어깨 폄 | 대치, 각오 |
| chest rises on a long inhale | 긴 숨에 가슴 들림 | 진정, 각오 |
| breath catches | 숨이 멎음 | 충격 |
| weight shifts to one foot | 무게 중심 옮김 | 초조, 지루함 |
| flinch | 움찔 | 반사 반응 |
| slow head shake | 천천히 고개 저음 | 부정, 믿기지 않음 |
| hands still at sides | 손을 가만히 둠 | 억제 |
| trembling hands | 손 떨림 | 공포, 분노 |

일부 가이드는 근육 이름(`orbicularis oculi`, `lip corner puller`)까지 내려가
적기를 권합니다. 겉으로 보이는 모양으로 적어도 같은 곳을 가리킵니다.
어느 쪽이든 `happy` 보다는 낫습니다.

## 크기와 속도

| 말 | 뜻 |
| --- | --- |
| barely perceptible | 거의 안 보이는 |
| slight / subtle | 살짝 |
| pronounced | 뚜렷하게 |
| slow, deliberate | 느리고 의도적으로 |
| quick, clipped | 짧고 끊어지게 |
| frantic, rapid | 다급하게 |

같은 손짓도 `a slow, deliberate wave` 와 `a frantic, rapid wave` 는 다른 장면입니다.

## 좋은 예와 나쁜 예

**영상 — 슬픔**

- 나쁨 `a sad woman at a window, emotional, cinematic`
- 좋음 `she stands at the window, gaze lowered to the sill, lips pressed together, shoulders dropped; a long inhale lifts her chest, then she turns her head toward the door`

**영상 — 참는 분노**

- 나쁨 `he is angry but tries to hide it, dramatic tension`
- 좋음 `his face stays still, jaw clenched, eyes fixed on the man across the table; his right hand slowly tightens around the glass, fingers distinct`

**정지컷 — 표정 시트**

- 나쁨 `expression sheet, various emotions`
- 좋음 `head-on portrait, brows relaxed, lips together but not pressed, eyes level with the lens, no smile`

## 모델이 잘 못 알아듣는 표현

| 쓰지 마세요 | 왜 | 대신 |
| --- | --- | --- |
| emotional, dramatic, cinematic, epic, dynamic | 그릴 것이 없습니다. 매번 다른 얼굴이 나옵니다 | 얼굴에서 무엇이 움직이는지 |
| 감정 이름만 (`sad`, `angry`) | 감정은 신호가 아닙니다 | 감정 이름 + 신체 신호 하나 |
| acting naturally, with feeling, 감정을 담아 | 방향이 없습니다 | 인물이 무엇을 하려는지 한 줄 |
| subtle emotional shift, 미묘한 감정 변화 | 시작도 끝도 없습니다 | 시작 얼굴과 끝 얼굴을 각각 |
| don't look at the camera | 네거티브를 읽지 않는 모델이 있습니다 | 시선의 목적지 |
| moves gracefully, banks hard | 형용사에는 경로가 없어 형태가 뭉개집니다 | 어디서 어디로, 몇 걸음에 |
| 컷마다 다른 말로 쓴 인물 묘사 | 같은 사람이라도 다르게 해석합니다 | 앞 컷의 문장을 그대로 |

## 벤더 문서가 직접 짚은 실패

전부 Kling·Runway 공식 문서의 반례입니다. 추측이 아닙니다.

**① 감정을 추상적으로 풀어 쓰면 아무것도 안 나옵니다.**

| | |
| --- | --- |
| 나쁨 | `The subject embodies the essence of joyful greeting, manifesting an acknowledgment of presence in a welcoming manner.` |
| 좋음 | `The woman smiles and waves.` |

**② 넣은 그림에 이미 있는 것을 다시 묘사하지 마세요.** 첫 프레임이 외모를
이미 정했습니다. 다시 적으면 그 묘사가 그림과 경쟁합니다.

| | |
| --- | --- |
| 나쁨 | `The tall man with black hair wearing a blue business suit and red tie reaches out his hand` |
| 좋음 | `The man extends his arm to shake hands, then nods politely.` |

인물은 `the subject` · `she` 처럼 일반 지칭으로 부릅니다. 둘 이상이면 자리로
가리킵니다 — `The subject on the left walks forward. The subject on the right remains still.`

**③ 부정문은 모델에 따라 통하지 않습니다.**

| | |
| --- | --- |
| 나쁨 | `not blurry` / `No camera movement.` |
| 좋음 | `sharp focus, high detail` / `Locked camera. The camera remains still.` |

**④ JSON 으로 적어도 소용없습니다.** Runway 공식 FAQ 가 잘라 말합니다 —
JSON 형식은 **생성 모델이 무시합니다.** 더 정확해 보이는 착시일 뿐입니다.
프롬프트는 자연어 문장으로 펴서 보내세요.

**⑤ 퍼포먼스 캡처에는 못 하는 것이 있습니다.** 혀를 내미는 것 같은 표정은
지원되지 않습니다. 인물은 한 명이어야 하고, 얼굴이 끝까지 보여야 하며,
가장 넓어도 허리 위 프레이밍입니다. 중간에 컷이 있으면 안 됩니다.
손동작을 쓰려면 **첫 프레임에 손이 보여야** 합니다.

**⑥ 숫자와 물리는 아직 못 셉니다.** Kling 공식 가이드가 인정합니다 —
「해변의 강아지 10마리」 같은 개수 일관성, 공이 튀거나 던진 물건이 그리는
궤적 같은 복잡한 물리는 어렵습니다. 프롬프트는 쉬운 단어와 단순한 문장으로.

## 안 나오면 벗겨 냅니다

연기가 계속 어긋나면 지시를 더 붙이지 마세요. **카메라를 고정하고, 동작을
하나로 줄이고, 배경을 비웁니다.** 그게 나오면 그 위에 한 겹씩 다시 얹습니다.
