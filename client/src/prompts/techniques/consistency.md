---
id: consistency
label: 연속성
---

## 핵심 규칙

1. **모델은 앞 컷을 기억하지 않습니다.** 컷마다 정체성을 처음부터 다시 적습니다.
2. **프롬프트를 다섯 토막으로** 씁니다.
   정체성 잠금(**바꾸지 않음**) · 장면 동작(바꿈) · 카메라(바꿈) ·
   조명·스타일(거의 안 바꿈) · 금지(바꾸지 않음).
3. **정체성 잠금은 강한 고정점으로.** 약한 말은 컷마다 다르게 해석됩니다.
   `brown hair` → `shoulder-length coiled hair worn loose`,
   `denim jacket` → `worn dark denim jacket over a white crew-neck tee`.
4. **같은 사람은 늘 같은 말로** 부릅니다. 한 컷에서 「여울」, 다음 컷에서 「그 여자」로
   부르면 모델은 다른 사람으로 읽습니다.
5. **장소도 인물과 똑같이** 다룹니다 — 지형·재질·빛·색을 컷마다 다시 못 박습니다.
6. **색으로 묶는 것이 가장 싼 장치**입니다. 팔레트 한 줄을 모든 컷에 같이 넣으세요.


# 연속성

같은 인물·같은 장소가 여러 컷에서 같아 보이게 하는 방법입니다.

## 모델은 앞 컷을 기억하지 않습니다

생성기에는 컷 사이의 기억이 없습니다. 매 생성이 독립적으로 처음부터 만들어집니다.
그래서 **드리프트(drift)가 기본값**입니다. 붙잡아 두는 것이 없으면 모델은
「앞 컷과 같음」이 아니라 「그럴듯함」을 고릅니다. 턱선이 바뀌고 머리색이 옮겨
가고 옷의 단추 수가 달라집니다.

「같은 인물로 해 주세요」는 지시가 되지 않습니다. 기억할 대상이 없기 때문입니다.
연속성은 문장으로 부탁해서 얻는 것이 아니라 **세 가지를 물리적으로 고정**해서 얻습니다.

1. **레퍼런스 이미지를 매번 다시 붙입니다.** 텍스트만으로는 매번 새로 지어냅니다.
2. **정체성 문장을 토씨까지 똑같이 반복합니다.** 동의어로 바꾸면 그 자체가 변경 지시입니다.
3. **바꿀 것만 바꿉니다.** 나머지 문장은 손대지 않습니다.

## 프롬프트 다섯 토막

컷 프롬프트는 아래 순서로 씁니다. 앞에 놓은 것이 더 강하게 반영됩니다.

| 토막 | 하는 일 | 컷마다 |
| --- | --- | --- |
| 정체성 잠금 | 누구인가 — 얼굴·머리·의상·비율·색·화풍 | **바꾸지 않습니다** |
| 장면 동작 | 이 컷에서 무엇을 하는가 | 바꿉니다 |
| 카메라 | 사이즈·앵글·무빙 | 바꿉니다 |
| 조명·스타일 | 컷끼리 붙었을 때 튀지 않게 | 거의 바꾸지 않습니다 |
| 금지 | 나오면 안 되는 것 (네거티브) | 바꾸지 않습니다 |

기본 틀입니다.

```
Use the same character from the reference image.
Preserve the exact [정체성 항목].
In this scene, the character [동작].
Camera: [사이즈, 앵글, 무빙].
Lighting/style: [광원, 색온도, 화풍].
Keep the character identity consistent across the entire clip.
Do not change [보호할 것].
```

## 정체성 잠금에 무엇을 나열하나

「같은 인물」로 뭉뚱그리지 말고 부위를 나열합니다. 나열하지 않은 부위가 먼저 흔들립니다.

```
preserve the exact face shape, eye shape, eye color, nose, mouth, jawline,
hairstyle, hair length, outfit, accessories, body proportions, silhouette,
color palette, and overall art style
```

여기에 **그 인물만의 고정점 두세 개**를 더 붙입니다. 전부 똑같이 중요하다고 적으면
어느 것도 지켜지지 않습니다. 남과 구별되는 것을 고르세요.

| 약한 고정점 | 강한 고정점 |
| --- | --- |
| `brown hair` | `shoulder-length coiled hair worn loose` |
| `tan skin` | `medium brown skin with warm undertones` |
| `denim jacket` | `worn dark denim jacket over a white crew-neck tee` |
| `braids` | `shoulder-length box braids` |
| `red stripe shoes` | `white sneakers with a red stripe` |

색은 형용사 하나로 끝내지 말고 **어떤 계열의 어떤 색인지**까지 적습니다.
`tan` 은 컷마다 다른 색으로 나옵니다.

## 시트 문장을 컷 프롬프트로 옮기는 법

캐릭터 시트·배경 시트는 **사실을 보관하는 문서**입니다. 컷 프롬프트에 통째로
붙여넣지 마세요. 길어질수록 정작 중요한 지시가 묻힙니다. 시트에서 **가장
구별되는 항목만 뽑아 압축**해 넣습니다. 한 컷의 묘사는 80~150 단어가 권장값입니다.

| | |
| --- | --- |
| 시트 원문 | 중간 갈색 피부에 따뜻한 언더톤, 어깨까지 오는 곱슬머리를 풀어 내림, 각진 턱, 낡은 진 재킷과 흰 티셔츠, 검정 슬림 진, 빨간 줄 흰 운동화 … (계속) |
| 컷 프롬프트 | `a tall woman in a worn dark denim jacket and white tee, medium brown skin, shoulder-length natural coiled hair worn loose, square jaw, focused expression` |

배경도 같습니다.

```
in a small apartment living room, muted olive and warm brown tones,
morning light through a window to her left, exposed brick wall in soft focus behind her
```

**뽑아낸 압축 문장은 한 번 정하면 그대로 재사용합니다.** 컷마다 다시 쓰지 마세요.
다시 쓰면 반드시 단어가 달라지고, 단어가 달라지면 인물이 달라집니다.

## 같은 말로 부릅니다 — 잠금 문구

정체성 문장은 **글자 그대로 복사**해 넣습니다. 동의어 교체가 드리프트의 가장 흔한 원인입니다.

| 컷 1 | 컷 2 | 결과 |
| --- | --- | --- |
| `cute anime girl with red hair` | `brave young heroine with crimson hair` | 다른 사람이 나옵니다 |
| `worn dark denim jacket` | `faded blue jean jacket` | 옷이 바뀝니다 |
| `square jaw` | `strong jawline` | 얼굴이 바뀝니다 |

컷마다 다른 사람이 쓰더라도 같은 문장이 나오도록, 정체성 문장·시드·화풍 설명·
레퍼런스 파일 이름을 한곳에 적어 두고 거기서 복사합니다.

## 시트에서 잘라 쓰는 흐름

시트는 만들어 두고 잊는 물건이 아니라 **컷마다 꺼내 쓰는 재료**입니다.

1. **한 장을 고릅니다.** 잘 나온 정면 컷 하나를 기준으로 정합니다.
2. **그 한 장으로 시트를 만듭니다.** 정면·측면(프로필)·3/4·후면을 한 장에 늘어놓습니다.
   칸 배치를 프롬프트에 직접 지정하면 모델이 구도를 잡을 근거가 생깁니다.
   `four-panel character reference sheet, top row front and side view, bottom row three-quarter and back view, same character across all panels, consistent costume and proportions`
3. **시트를 검증합니다.** 칸마다 같은 사람인지 먼저 확인합니다. 한 칸이라도
   얼굴이 다르면 그 시트는 버립니다. 뒤에서 쓸 모든 컷이 이 시트를 기준으로 삼습니다.
4. **필요한 각도의 칸을 잘라 씁니다.** 옆을 보는 컷에는 측면 칸을, 뒷모습 컷에는
   후면 칸을 레퍼런스로 겁니다. 시트 전체를 넣는 것보다 그 각도만 잘라 넣는 편이
   각도가 정확합니다.
5. **잘 나온 결과물로 레퍼런스를 갈아 끼웁니다.** 생성된 컷 중 가장 좋은 것을
   다음 컷의 레퍼런스로 승격시킵니다. 원본 시트는 계속 함께 겁니다.

여러 장 뽑을 때는 낱장보다 **격자로 뽑고 좋은 칸만 추출**하는 편이 낫습니다.
한 번의 생성 안에서는 칸끼리 서로를 참고하므로 낱장을 여러 번 뽑는 것보다 덜 흔들립니다.

**주의.** 참조 강도를 최대로 두면 의상까지 강제됩니다. 옷을 갈아입히는 컷에서는
참조 강도를 낮춰야 합니다. 그러지 않으면 매 생성마다 레퍼런스와 싸우게 됩니다.

## 컷을 이어붙일 때 — 마지막 프레임

앞 컷과 곧바로 이어지는 컷이면 텍스트보다 **앞 컷의 프레임**이 정확합니다.

- 앞 컷에서 깨끗한 프레임 한 장을 뽑아 다음 컷의 레퍼런스(또는 첫 프레임)로 씁니다.
  이것을 마지막 프레임 잇기(last-frame chaining)라고 합니다.
- **원본 시트를 같이 겁니다.** 뽑은 프레임만 물려 가면 매 컷 조금씩 어긋난 것이
  누적되어 몇 컷 뒤에는 다른 사람이 됩니다.
- 흐릿하거나 얼굴이 반쯤 가린 프레임은 쓰지 마세요. 그 흐림이 다음 컷의 기준이 됩니다.

## 장소도 인물과 똑같이 다룹니다

장소는 인물보다 자주 빠뜨립니다. 「아까 그 카페」라고 적어도 모델은 매번 새 카페를 짓습니다.

- **설정 레퍼런스 한 장**을 만들어 둡니다. 공간 전체, 눈에 띄는 지형지물, 광원이
  한 장에 보여야 합니다. 실재하지 않는 장소라도 강한 컨셉 이미지 한 장이면 됩니다.
- 인물 레퍼런스와 **같은 요청에 함께** 겁니다. 따로 다루면 붙지 않습니다.
- 같은 장소의 컷은 **몰아서 한 번에** 만듭니다. 이야기 순서상 떨어져 있어도
  같이 뽑아야 창문이 같은 벽에 남습니다.
- 장소가 바뀌는 컷에서는 **인물 문장은 그대로 두고 장면 문장만** 교체합니다.
- 컷 사이에 색온도와 카메라 거리를 맞춰 둡니다. 배경은 한 번에 확 바꾸지 말고
  조금씩 옮깁니다.

## 색으로 묶습니다 — 가장 싼 장치

여러 컷을 한 작품처럼 보이게 하는 데 **색만큼 값싼 것이 없습니다.** 인물 잠금은
얼굴을 지켜 주지만 「같은 작품」이라는 인상은 색이 만듭니다.

실제로 세어 본 값입니다(공개 프롬프트 129편 기준).

1. **주인공 색 하나를 세 군데 이상에 심습니다** — 의상·소품·배경.
   129편 중 **98편**이 이렇게 했습니다. 「화면이 정리돼 보인다」의 정체가 이것입니다.
2. **바탕은 채도를 낮추고 포인트는 하나.** 파스텔·크림·차분한 톤 위에
   쨍한 색 한둘만 올립니다.
3. **금속 광택 하나.** 은·금·크롬 중 하나. `glossy` 와 짝으로 붙습니다.

문장 형식과 값 잠금:

```
The color palette is dominated by 색1, 색2, 색3, punctuated by 포인트색.
HEX VALUES: ["#1a0205", "#380b10", "#6e1d24", "#8a242d", "#c8a855", "#e8dcc8"]
```

색 이름은 해석이 갈리지만 **HEX 는 값**입니다. 컷마다 같은 배열을 붙이면
「지난 컷보다 푸르게 나왔다」가 줄어듭니다. 어두운 것부터 밝은 순으로 6개쯤.

## 한 세트를 뽑을 때 — 무엇만 바꾸는가

인물 시트나 변형처럼 **여러 장을 한 세트로** 뽑을 때의 규칙입니다.

인물 블록·의상 블록·화풍 블록은 **한 글자도 안 바꾸고 그대로 복사**합니다.
장마다 바꾸는 것은 다섯뿐입니다 — **장면 · 행동 · 프레이밍 · 앵글 · 손에 든 것.**

- **「앞 장과 같은 인물」 같은 축약은 금지.** 프롬프트는 장마다 따로 도는 것이라
  **그 장에 안 적힌 것은 없는 것**입니다.
- **프레이밍은 반드시 섞습니다.** 인물도 옷도 같은데 프레이밍까지 같으면
  여섯 장이 한 장처럼 보입니다.
- **장소는 한 공간 안에서 움직입니다.** 같은 옷을 입은 사람이 도시 세 곳을
  순간이동하면 세트가 아니라 합성으로 보입니다.

## 자주 쓰는 용어

| 영문 | 뜻 | 쓰는 곳 |
| --- | --- | --- |
| identity lock | 정체성 잠금 — 바뀌면 안 되는 부위를 나열한 문장 | 모든 컷 프롬프트의 첫머리 |
| character reference | 정체성 레퍼런스 — 인물을 가져오는 이미지 | 인물이 나오는 모든 컷 |
| style reference | 화풍 레퍼런스 — 색·질감·구도만 가져오는 이미지 | 인물이 아니라 룩을 맞출 때 |
| model sheet / character sheet | 캐릭터 시트 — 한 인물의 확정 외형 문서·이미지 | 컷 프롬프트의 재료 |
| turnaround | 턴어라운드 — 정면·측면·3/4·후면을 한 장에 | 각도가 바뀌는 컷을 뽑기 전 |
| panel | 칸 — 시트 안의 한 구획 | 잘라서 레퍼런스로 씀 |
| drift | 드리프트 — 컷이 진행되며 인물이 서서히 달라짐 | 막아야 할 대상 |
| locked prompt | 잠금 프롬프트 — 글자 그대로 재사용하는 고정 문장 | 정체성·화풍 부분 |
| seed | 시드 — 난수 기준값. 같은 시드 + 같은 문장이면 변주가 줄어듭니다 | 재현이 필요할 때 |
| image-to-image strength | 레퍼런스 영향력 — 원본을 얼마나 따를지 | 60~80% 가 권장값 |
| consistency weight | 참조 강도 — 정체성을 얼마나 강하게 강제할지 | 의상이 바뀌는 컷에서 낮춤 |
| last-frame chaining | 마지막 프레임 잇기 — 앞 컷 프레임을 다음 컷 기준으로 | 이어지는 컷 |
| first/last frame | 첫·끝 프레임 지정 — 두 장을 주고 사이를 생성 | 시작과 끝이 정해진 컷 |
| establishing reference | 설정 레퍼런스 — 공간 전체가 보이는 기준 이미지 | 장소 연속성 |
| ControlNet pose strength | 포즈 강제 강도 | 턴어라운드 정렬. 70~100 이 권장값 |
| LoRA | 인물 전용 추가 학습 | 각도가 크게 바뀌어도 얼굴이 버팁니다 |

## 좋은 예와 나쁜 예

| 나쁜 예 | 왜 실패하나 | 좋은 예 |
| --- | --- | --- |
| `same character as before` | 모델은 앞 컷을 기억하지 않습니다 | `use the same character from the reference image, preserve the exact face shape, jawline, hairstyle, and outfit` |
| `민수가 문을 연다` | 이름은 모델에게 아무 정보가 아닙니다 | `a tall man in a worn dark denim jacket, square jaw, short black hair, opens the door` |
| `keep it consistent` | 무엇을 지킬지 없습니다 | `do not change the hairstyle, outfit, accessories, or color palette` |
| `cute anime girl with red hair` → `brave heroine with crimson hair` | 동의어 교체가 곧 변경 지시입니다 | 두 컷 모두 같은 문장을 글자 그대로 씁니다 |
| `anime style, photorealistic, 3D render` | 화풍어가 서로 충돌합니다 | `anime style, flat cel shading` 하나만 |
| 시트 전문을 붙여넣기 | 길어져서 정작 중요한 지시가 묻힙니다 | 구별되는 항목만 압축해 80~150 단어로 |
| `same coffee shop as before` | 장소 레퍼런스가 없으면 매번 새로 짓습니다 | 설정 레퍼런스를 걸고 `same room as the reference, window on her left, exposed brick behind her` |
| 정체성 문장을 컷 끝에 붙이기 | 뒤에 놓을수록 약해집니다 | 정체성 잠금을 맨 앞에 |

## 모델이 못 알아듣는 표현

- **앞을 가리키는 말.** `same as before`, `as previously`, `like the last shot`,
  `continuing from the previous scene`. 모델에는 컷 사이 기억이 없어 아무 일도
  일어나지 않습니다. 가리킬 것을 **이미지로** 주세요.
- **이름 부르기.** `민수`, `Anna` 는 학습된 인물이 아닌 한 빈 단어입니다.
  이름은 사람이 관리하려고 쓰는 것이고, 모델에게는 외형을 적어 줘야 합니다.
- **뭉뚱그린 유지 요청.** `same character`, `consistent look`, `keep the style`.
  지킬 항목을 나열하지 않으면 지켜지지 않습니다.
- **동의어 교체.** 같은 인물을 `crimson` / `red`, `square jaw` / `strong jawline`,
  `denim jacket` / `jean jacket` 으로 번갈아 부르는 것. 매번 조금씩 다른 사람이 나옵니다.
- **화풍어 섞기.** `anime` + `realistic` + `3D` 를 한 프롬프트에 넣으면 컷마다
  다른 쪽으로 기웁니다. 하나로 정하고 모든 컷에 같은 말을 씁니다.
- **네거티브에만 의존하기.** 네거티브를 읽지 않는 모델이 있습니다.
  `not a different face` 대신 본문에 `preserve the exact face shape` 를 적으세요.
- **막연한 색·재질.** `tan`, `dark hair`, `casual outfit` 은 컷마다 다르게 해석됩니다.
- **말로 하는 각도 요청.** 옆모습이 필요하면 `side view` 만 적지 말고 **시트의 측면 칸**을
  레퍼런스로 거세요.

## 네거티브 — 칸끼리 어긋나는 것을 막습니다

시트나 여러 칸을 한 장에 뽑을 때는 아래 층을 넣습니다. 첫 번째 층이 있어야
그 시트를 뒤에서 레퍼런스로 쓸 수 있습니다.

| 층 | 넣을 말 |
| --- | --- |
| 칸 사이 불일치 | `different face between views, different hair between views, different outfit between panels, inconsistent skin tone, inconsistent proportions, different age between views, changing accessories, mismatched colors` |
| 칸 겹침 | `merged views, overlapping figures, figures touching each other, views blending into one another, panels merging, duplicate poses, cropped figures, cut-off limbs, uneven spacing` |
| 배경 오염 | `gradient background, busy background, shadows on backdrop, props in hand, held objects, environmental clutter` |
| 기본 결함 | `bad anatomy, bad hands, extra limbs, missing fingers, deformed hands, distorted face, asymmetrical eyes, low quality, blurry, jpeg artifacts, watermark, signature, text, logo` |

## 이 도구에서

- **인물 하나에 폴더 하나.** 시트·변형·에셋이 전부 그 폴더에 모입니다.
  같은 인물의 재료가 흩어지면 컷마다 다른 것을 집게 됩니다.
- **변형 창의 «정체성 기준» 레퍼런스는 뺄 수 없습니다.** 부모 시트가 그 인물의
  기준입니다. 빼면 다른 사람이 됩니다.
- **변형 시트는 changes 에 적힌 것만 바꿉니다.** 적혀 있지 않은 얼굴 구조·이목구비
  비율·눈동자 색·체형·피부톤은 손대지 마세요. 「겸사겸사」 다듬으면 그때부터 두 사람이 됩니다.
- **칸 잘라내기로 각도를 꺼내 씁니다.** 시트의 칸을 잘라 그 컷의 레퍼런스로 등록합니다.
- **레퍼런스 파일 이름은 그대로 씁니다.** 줄이거나 번역하거나 순서를 바꾸지 마세요.
  플랫폼마다 부르는 방식이 다릅니다 — Magnific `@이름`, ComfyUI `<Picture 1>`,
  Higgsfield `@image_1`. 어느 이름이 몇 번인지 한글 설명에 적어 둡니다.

## 확인

컷 프롬프트를 넘기기 전에 봅니다.

- 정체성 레퍼런스가 걸려 있는가
- 정체성 문장이 앞 컷과 **글자까지 같은가**
- 지킬 부위가 나열돼 있는가 (얼굴 구조·머리·의상·비율·색·화풍)
- 이 컷에서 바뀌는 것이 동작·카메라·(필요하면) 장소뿐인가
- 장소가 나오면 설정 레퍼런스도 함께 걸려 있는가
- 화풍어가 하나로 통일돼 있는가
- 칸 사이 불일치 네거티브가 들어 있는가

세 번 뽑아 세 번 다 인물이 어긋나면 프롬프트가 아니라 **레퍼런스**를 의심하세요.
대개 기준 시트 자체가 칸마다 다른 사람입니다.
