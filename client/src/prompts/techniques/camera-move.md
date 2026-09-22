---
id: camera-move
label: 카메라 무빙
---

## 핵심 규칙

1. **무빙 세 갈래를 섞어 부르지 마세요.**
   **이동**(dolly·truck·pedestal·crane — 카메라 몸통이 움직여 패럴랙스가 생김) ·
   **회전**(pan·tilt·roll — 자리는 그대로, 화면만 쓸림) ·
   **렌즈**(zoom — 원근 변화 없이 확대). 달리와 줌을 바꿔 적으면 전혀 다른 그림이 됩니다.
2. **한 컷에 주 무빙은 하나.** 두 개를 겹치면 둘 다 흐려집니다.
3. **한 문장에 네 가지를 담습니다** — 무엇이 · 어느 쪽으로 · 얼마나 빠르게 · 몇 초 동안.
   `slow dolly in toward her face over 4 seconds`
4. **고정도 반드시 적습니다.** 안 적으면 모델이 제멋대로 흔듭니다 —
   `locked-off camera, the frame does not move`.
5. **속도는 말과 초를 함께.** `slow`만 적으면 모델마다 다르게 읽습니다.
6. 카메라 자리·움직임은 **한 덩어리로 모아** 적습니다. 문장 여기저기 흩으면 섞입니다.


## 무빙은 세 갈래이고, 섞어 부르면 안 됩니다

| 갈래 | 실제로 움직이는 것 | 화면에 나타나는 신호 | 대표 용어 |
| --- | --- | --- | --- |
| 이동 | 카메라 몸통이 공간을 지나갑니다 | 패럴랙스. 전경과 후경이 서로 다른 속도로 흐릅니다 | dolly, truck, pedestal, crane |
| 회전 | 위치는 그대로, 방향만 돕니다 | 원근은 그대로고 화면만 쓸립니다 | pan, tilt, roll |
| 렌즈 | 카메라도 방향도 고정입니다 | 원근 변화 없이 확대·축소됩니다 | zoom |

이 셋의 차이가 프롬프트에서 통하는 유일한 근거입니다. 「카메라를 당긴다」 는
달리인지 줌인지 알 수 없어 모델이 임의로 고릅니다.

## 한 컷에 주 무빙은 하나입니다

주 무빙 하나, 보조 하나까지가 안전합니다. 「달리 인 + 살짝 틸트 업」은 됩니다.
셋을 넘기면 모델이 지시를 평균 내 뭉갭니다. 상반된 지시(왼쪽 팬 + 오른쪽 오빗)는
둘 다 버려지고 결과가 정지 샷으로 떨어집니다.

## 한 문장에 네 가지를 담습니다

1. 무빙과 방향
2. 속도와 길이
3. 대상
4. 그 무빙이 드러내는 것

```
Slow dolly in over 4 seconds toward the woman's face,
background compressing behind her, revealing the tremor in her jaw.
```

「드러내는 것」이 빠지면 무빙에 목적이 없어 카메라가 정처 없이 흐릅니다.

## 자리는 한 덩어리로 모읍니다

카메라 지시는 인물·배경 묘사와 섞지 않고 한 곳에 모읍니다. 섞어 쓰면 인물이
뭉개지고 경계가 일그러집니다. 앞에 둘지 뒤에 둘지는 모델마다 다릅니다.
Veo 계열은 카메라를 **앞**에 둘 때 더 잘 따르고, Kling 안내는 **맨 뒤**를 권합니다
(장면을 먼저 세운 뒤 그 안을 움직이라는 뜻). 어느 쪽이든 흩뿌리지는 않습니다.

## 고정도 반드시 적습니다

안 적으면 모델이 스스로 흔들거나 «스윕» 을 넣습니다.

```
locked-off static camera, no camera movement, tripod
```

구도잡기에서 «고정 샷» 을 골랐다면 프롬프트에도 이 문장이 들어가야 합니다.

## 용어표

### 이동 — 카메라가 공간을 지나갑니다

| 영문 | 한국어 | 뜻 |
| --- | --- | --- |
| dolly in / push in | 달리 인 · 푸시인 | 대상 쪽으로 나아갑니다. 원근이 바뀝니다 |
| dolly out / pull back | 달리 아웃 · 풀백 | 물러나며 주변 상황을 드러냅니다 |
| truck left / right | 트럭 (트래킹) | 옆으로 미끄러집니다. 대상과 나란히 갑니다 |
| pedestal up / down | 페데스탈 | 앵글은 그대로 두고 카메라 전체가 엘리베이터처럼 오르내립니다 |
| crane up / down (jib) | 크레인 · 지브 | 팔에 매달려 크게 오르내립니다. 페데스탈보다 폭이 훨씬 큽니다 |
| orbit | 오빗 | 거리를 유지한 채 대상 둘레를 돕니다 |
| arc | 아크 | 부분 오빗. 보통 90~180도 |
| drone ascent / descent | 드론 상승 · 하강 | 지면 근처에서 고도로, 또는 그 반대 |
| top-down (bird's eye) | 부감 · 탑다운 | 바로 위에서 수직으로 내려다봅니다 |
| FPV dive | FPV 다이브 | 빠르고 공격적으로 내리꽂습니다 |

### 회전 — 위치는 고정입니다

| 영문 | 한국어 | 뜻 |
| --- | --- | --- |
| pan left / right | 팬 | 삼각대 위에서 좌우로 돕니다 |
| tilt up / down | 틸트 | 위아래로 돕니다. 카메라는 제자리입니다 |
| whip pan | 휩 팬 | 매우 빠른 팬. 잔상 블러가 생깁니다. 전환용 |
| dutch angle / roll | 더치 앵글 | 수평선이 기웁니다. **무빙이 아니라 프레이밍입니다** |

### 렌즈 — 아무것도 움직이지 않습니다

| 영문 | 한국어 | 뜻 |
| --- | --- | --- |
| zoom in / out | 줌 | 초점거리만 바뀝니다. 패럴랙스가 없습니다 |
| crash zoom / snap zoom | 크래시 줌 · 스냅 줌 | 순식간에 당깁니다. 충격·강조 |
| dolly zoom (zolly, vertigo) | 달리 줌 · 버티고 | 달리와 줌을 반대 방향으로 동시에. 대상 크기는 그대로고 배경만 밀립니다 |
| rack focus | 포커스 이동 | 초점만 옮깁니다. **무빙이 아닙니다** |

### 질감과 시점

| 영문 | 한국어 | 뜻 |
| --- | --- | --- |
| handheld | 핸드헬드 | 사람이 든 듯한 미세한 흔들림 |
| steadicam / gimbal | 스테디캠 · 짐벌 | 흔들림을 지운 매끄러운 이동 |
| locked-off | 고정 | 완전 정지 |
| POV | 시점 샷 | 카메라가 인물의 눈을 대신합니다 |
| over-the-shoulder | 어깨너머 | 한 인물의 어깨를 넘어 상대를 봅니다 |
| following / leading shot | 팔로우 · 리딩 | 뒤를 따라가거나, 앞서 물러나며 마주 봅니다 |

## 속도는 말과 초를 함께 적습니다

| 말 | 쓰임 |
| --- | --- |
| slow, gradual, almost imperceptible | 서서히 조여드는 푸시인 |
| smooth, steady, gliding | 스테디캠·드론의 기본값 |
| fast, rapid, aggressive | 치고 들어가는 무빙 |
| whip, crash, snap | 1초 안팎의 순간 동작 |

`over 4 seconds` 처럼 초를 함께 적으세요. 속도어가 없으면 대개 너무 빠르게,
불규칙하게 나옵니다. `smooth` `slow` 같은 한 단어가 아티팩트를 눈에 띄게 줄입니다.

## 달리를 줌으로 오해하지 않게 하는 법

가장 흔한 실패입니다. **깊이 층이 없는 달리는 줌이 됩니다.** 전경·중경·후경에
무엇이 있는지 적어 주면 모델이 패럴랙스를 만들 근거를 갖습니다.

| | |
| --- | --- |
| 나쁨 | `dolly in on the man` |
| 좋음 | `slow dolly in past a foreground railing, the man in mid-ground, city lights compressing behind him` |

## 좋은 예와 나쁜 예

| 나쁜 예 | 왜 실패하나 | 좋은 예 |
| --- | --- | --- |
| `cinematic dynamic camera` | 공간 지시가 하나도 없습니다. 모델은 정지 샷이나 일반적인 스윕으로 떨어집니다 | `slow orbit 180 degrees around the subject over 8 seconds` |
| `camera moves through the scene` | 무빙 종류도 방향도 없습니다 | `steadicam tracking forward down the corridor, following the subject from behind` |
| `orbit and zoom in and crane up` | 무빙 동사 세 개. 예측 불가능한 표류가 생깁니다 | `slow arc around the subject, ending on a low angle` |
| `static handheld dolly zoom` | 서로 모순입니다 | `locked-off static shot, no camera movement` |
| `wide shot close-up zoom` | 프레이밍 단어가 충돌합니다 | `medium close-up, slow push in` |
| `pan left while orbiting right` | 동시에 상반된 회전입니다 | `pan left, then hold` |
| `epic drone shot` | 인상만 있고 경로가 없습니다 | `drone ascent from ground level to rooftop height over 6 seconds, revealing the harbour` |

## 모델이 못 알아듣는 표현

- **인상어.** `cinematic` `dynamic` `cool movement` `interesting camera work` `epic`.
  모델은 카메라 지시를 장식이 아니라 공간 방향으로 읽습니다. 이 말들은 아무 일도
  하지 않고 자리만 차지합니다. `cinematic` 을 쓰고 싶으면 대신 `shallow depth of field`
  `anamorphic flare` `35mm` 처럼 실제 장치를 적으세요.
- **모순 쌓기.** 위 표의 `static handheld` `wide shot close-up`.
- **신뢰도가 낮은 용어.** `follow cam` `roll` `whip pan` 은 결과가 들쭉날쭉합니다.
  풀어 쓰세요. `follow cam` → `camera follows behind the subject at a constant distance`.
- **페데스탈·크레인·지브의 뭉개짐.** 셋을 구분하지 못하고 「위로 올라감」 하나로
  처리하는 모델이 있습니다(Kling 이 그렇습니다). 폭을 숫자나 묘사로 덧붙이세요.
  `pedestal up from waist level to eye level` / `crane up to rooftop height`.
- **무빙이 아닌 것을 무빙으로 요구하기.** 더치 앵글과 랙 포커스는 카메라가 움직이지
  않습니다. `dutch angle held throughout` `rack focus from the glass to her eyes` 처럼
  상태·초점으로 적습니다.
- **직역 조어.** `camera walking` `screen moves` `viewpoint goes up` 같은 말은
  학습된 촬영 용어가 아니라 무시됩니다.

## 길이를 무빙에 맞춥니다

오빗 180도·360도, 크레인 리빌처럼 완주가 필요한 무빙은 7~10초 쪽이 안정적입니다.
3초짜리 클립에 360도를 요구하면 회전이 잘리거나 배속으로 돌아갑니다.
반대로 스냅 푸시인·휩 팬·크래시 줌은 1초 안팎입니다.

## 이 도구에서

구도잡기가 만든 문장이 사실입니다. 이제 촬영 용어와 **속도 곡선까지** 붙어 나옵니다.

```
dolly in toward the subject, a steady move over 4 seconds,
easing in and easing out, keeping the subject centred in frame, smooth and stable
```

2026-09-18 이전에는 `dolly-in camera move, 2.5 meters over 4 seconds` 였습니다 —
`dolly-in` 은 우리 내부 id 라 생성기가 못 알아들었고, 속도 그래프는 아예 안 실렸습니다.
앱에서 «급가속 후 정지» 로 맞춰 놔도 밖에서 뽑은 영상은 등속이었습니다.

프롬프트를 쓸 때 이 무빙을 다른 것으로 바꾸지 마세요. **초와 각도는 그대로 옮기고**,
위 형식(무빙·속도·대상·드러나는 것)에 맞게 «드러나는 것» 만 덧붙입니다.
구도잡기와 프롬프트가 서로 다른 무빙을 말하면 어느 쪽이 맞는지 알 수 없게 됩니다.

## 얼마나 쓰이는가 — 공개 프롬프트 8,961개 실측

vflow 가 X 에 공개된 영상 프롬프트를 모아 센 값입니다(2026-09-18 확인). 목록에 있다고
모델이 잘 알아듣는다는 뜻은 아닙니다. **드물게 쓰이는 용어는 대개 잘 안 먹혀서** 드뭅니다.

| 용어 | 비율 | 용어 | 비율 |
| --- | --- | --- | --- |
| tracking | 29.2% | POV | 5.7% |
| close-up | 28.7% | tilt | 5.5% |
| handheld | 21.3% | macro | 4.7% |
| wide shot | 15.9% | one-take | 3.1% |
| slow motion | 11.6% | dolly | 2.9% |
| orbit | 10.4% | whip pan | 2.1% |
| aerial / drone | 8.1% | crane | 1.9% |
| push-in | 8.0% | rack focus | 0.9% |
| pull-out | 7.9% | over-the-shoulder | 0.7% |
| zoom | 7.9% | high-angle | 0.7% |
| pan | 7.8% | **dutch angle** | **0.2%** |

**정지도 6.2% 밖에 안 적습니다.** 그런데 아무 말도 안 하면 모델은 움직임을 지어냅니다.
고정 샷이면 반드시 `locked-off static camera, no camera movement, tripod` 를 적으세요.

조명까지 함께 적은 프롬프트에서 **카메라와 자주 붙어 다니는 조명**(기대치 대비 배율):

| 카메라 | 잘 어울린 조명 |
| --- | --- |
| orbit | volumetric 2.3배 · neon 1.8배 · dramatic 1.6배 |
| handheld | natural light 2.1배 |
| slow motion | dramatic lighting 1.9배 |
| wide shot | volumetric 1.7배 · dramatic 1.6배 |
| tracking | volumetric 1.5배 · dramatic 1.5배 · golden hour 1.5배 |

## 무빙 문장 사전 — 그대로 붙여 쓰는 42가지

출처는 AIShotStudio 의 «42 Camera Movements». **한 줄만 던지면 안 됩니다** — 이 문장들은
«주어 → 동작» 뒤에 끼워 넣는 **조각**입니다. `Tracking` 만 적으면 무엇이 움직일지 모델이
정하고, 대개 엉뚱한 것이 움직입니다.

### 달리 · 줌

| 한국어 | 프롬프트 문장 |
| --- | --- |
| 느린 달리 인 | `Slow dolly in, camera moves slowly forward toward the subject.` |
| 느린 달리 아웃 | `Slow dolly out, camera moves slowly backwards away from the subject.` |
| 빠른 달리 인 | `Fast dolly in, camera moves rapidly forward toward the subject, urgent motion.` |
| 버티고(돌리 줌) | `Vertigo effect, dolly zoom, camera moves backward while zooming in, background expands.` |
| 초접사 줌 | `Extreme macro zoom, zoom transition from subject to micro details of surface.` |
| 우주 하이퍼 줌 | `Cosmic hyper zoom, fast zoom transition from extreme wide view down to macro level.` |
| 부드러운 광학 줌 인 | `Smooth optical zoom in, lens magnifies subject, camera stays stationary.` |
| 부드러운 광학 줌 아웃 | `Smooth optical zoom out, lens widens, background becomes blurry.` |
| 스냅 줌(크래시 줌) | `Snap zoom, crash zoom, rapid zoom directly into the eyes.` |

### 프레이밍 · 렌즈 · 초점

| 한국어 | 프롬프트 문장 |
| --- | --- |
| 어깨 너머 샷 | `Over the shoulder shot, camera mounted behind subject A framing subject B.` |
| 어안 렌즈 | `Fisheye lens, extreme wide-angle distortion, circular frame.` |
| 가림막 뒤에서 드러내기 | `Wipe movement, camera slides laterally from behind foreground object to reveal the scene.` |
| 통과 샷 | `Fly through, camera moves through an opening into the scene.` |
| 흐림에서 등장 | `Rack focus, start completely out of focus, slowly pull focus until sharp.` |
| 초점 옮기기 | `Rack focus, focus shifts from the foreground object to the background subject.` |

### 회전 · 평행 이동

| 한국어 | 프롬프트 문장 |
| --- | --- |
| 틸트 업 | `Tilt up, camera pans vertically up from bottom to top.` |
| 틸트 다운 | `Tilt down, camera pans vertically down from top to bottom.` |
| 트럭 레프트 | `Truck left, camera moves sideways on a track to the left.` |
| 트럭 라이트 | `Truck right, camera moves sideways on a track to the right.` |
| 페데스탈 다운 | `Pedestal down, camera lowers vertically straight down.` |
| 페데스탈 업 | `Pedestal up, camera rises vertically straight up from waist to eye level.` |
| 크레인 업 | `Crane up, camera lifts high into the air.` |
| 크레인 다운 | `Crane down, camera descends slowly to the subject.` |
| 휩 팬 | `Whip pan, camera whips violently to the side with extreme directional motion blur.` |
| 더치 앵글 | `Dutch angle, camera roll, tilted sideways on Z-axis.` |

### 공전

| 한국어 | 프롬프트 문장 |
| --- | --- |
| 180도 공전 | `Orbit 180, camera moves in a half-circle around the subject.` |
| 빠른 360도 공전 | `Fast 360 orbit, camera spins rapidly 360 degrees around the subject.` |
| 느린 호(아크) | `Slow cinematic arc, camera moves in a wide curve to reveal side profile.` |
| 불릿 타임 | `Bullet time, frozen moment, ultra slow motion, camera orbit right.` |
| 배럴 롤 | `Barrel roll, camera spins 360 degrees clockwise while moving forward, disorienting.` |

Seedance 1.5 Pro 는 대상을 자리에 넣는 판을 따로 씁니다 —
`180 orbit, camera orbits 180 degrees around the [대상].`

### 드론 · 높이

| 한국어 | 프롬프트 문장 |
| --- | --- |
| 드론 상공 통과 | `Drone fly over, high altitude flight moving forward over the landscape.` |
| 드론 상승 공개 | `Epic drone reveal, rising and tilting down to reveal the scene.` |
| 대형 드론 선회 | `Large scale drone orbit, massive sweeping circle around the landscape.` |
| 수직 부감 | `Top down shot, camera pointing straight down, slow twist.` |
| FPV 급강하 | `FPV drone dive, aggressive diving motion down a vertical structure.` |

### 추적 · 현장감

| 한국어 | 프롬프트 문장 |
| --- | --- |
| 핸드헬드 다큐 | `Handheld camera, shaky motion, natural movement, documentary style.` |
| 앞서 가며 뒷걸음 | `Leading shot, camera moves backward matching the subject's speed.` |
| 뒤따라가기 | `Following shot, camera follows behind the subject matching speed.` |
| 나란히 추적 | `Side tracking, camera trucks alongside the subject.` |
| 1인칭 걷기 | `POV walk, first person camera moving forward with bobbing motion.` |
| 지면 시점 추적 | `Worm's eye view, low angle tracking, camera moves along the ground looking up.` |
| 하이퍼랩스 | `Hyperlapse, camera moves forward rapidly, time accelerated, fast motion, light trails.` |

목록에 **«고정»이 없습니다.** 원문에 없어서 우리가 따로 둡니다 —
`Locked-off static camera, no camera movement, tripod.`

## 안 되면 프롬프트보다 먼저 다시 뽑습니다

생성은 확률적입니다. 같은 프롬프트도 매번 다르게 나옵니다. 문장을 뜯어고치기 전에
두세 번 다시 뽑아 보세요. 세 번 다 같은 방식으로 틀리면 그때 프롬프트 문제입니다.
