---
id: sora-2
label: Sora 2 Pro
---

# Sora 2 Pro 프롬프트 가이드

OpenAI 의 영상 생성 모델입니다. `sora-2` 의 상위 등급으로, 1080p 출력과 더 안정적인
움직임을 담당합니다. 영상과 **소리(대사·폴리·앰비언스)를 한 번에** 만듭니다.
사운드를 따로 붙이지 않습니다.

> **서비스 종료 예고.** OpenAI 는 2026-03-24 에 Videos API 와 Sora 2 계열 모델의
> 지원 중단을 공지했고, **2026-09-24 에 API 에서 제거**합니다. 대체 모델은 지정하지
> 않았습니다. Sora 웹·앱은 이미 종료됐습니다. 새 작업은 다른 모델로 잡는 편이 안전합니다.

---

## 1. 잘하는 것과 못하는 것

| | 내용 |
|---|---|
| **잘함** | 물리적으로 그럴듯한 움직임, 무게감 있는 동작 |
| | 화면과 맞물린 **동기화된 대사·발소리·환경음** |
| | 촬영 용어(렌즈·앵글·그레이딩)로 준 지시를 알아듣는 것 |
| | 짧은 클립(4~8초) 안에서의 지시 이행 |
| | 레퍼런스 이미지를 첫 프레임으로 고정해 미술·의상을 잡는 것 |
| **못함** | **화면 안 글자.** 간판·자막·라벨은 뭉개집니다. 글자는 후반에 합성합니다 |
| | 20초를 넘는 단일 샷 |
| | 여러 클립을 이어붙였을 때 조명·인물의 완벽한 일치 |
| | 인물이 뒤엉키는 빠른 상호작용, 머리카락·손가락 같은 얇은 형태, 극단적 클로즈업 |
| | 긴 대사. 4초 클립은 짧은 주고받기 한두 번이 한계입니다 |
| **금지** | 실존 인물·저작권 캐릭터 생성. 사람 얼굴이 들어간 입력 이미지는 거부됩니다 |

---

## 2. 프롬프트 구조

**서술문 먼저, 구조화된 블록을 뒤에.** 공식 가이드가 제시하는 골격을 그대로 씁니다.

```
[장면 서술. 인물, 의상, 배경, 날씨, 시간대를 평범한 산문으로. 여기가 본문입니다.]

Cinematography:
Camera shot: [프레이밍과 앵글. 예: wide establishing shot, eye level]
Mood: [전체 톤. 예: cinematic and tense]

Actions:
- [동작 1: 구체적인 한 박자]
- [동작 2: 클립 안의 다른 한 박자]
- [동작 3]

Dialogue:
[대사. 짧게. 클립 길이에 맞게.]
```

순서에는 이유가 있습니다.

1. **스타일을 맨 앞에.** "1970s film", "16mm black-and-white", "IMAX-scale" 같은
   한마디가 뒤따르는 모든 선택을 규정합니다. 스타일이 가장 강한 레버입니다.
2. **그다음 피사체와 배경.** 구체적인 명사로. "a beautiful street" 가 아니라
   "wet asphalt, zebra crosswalk, neon signs reflecting in puddles".
3. **카메라와 무드.** 프레이밍·앵글·심도를 한 줄씩.
4. **동작은 박자로 쪼개서.** "actor walks across the room" 대신
   "takes four steps to the window, pauses, and pulls the curtain in the final second".
5. **대사는 맨 뒤 별도 블록.** 화자 이름을 붙입니다. 서술과 섞으면 모델이 대사를
   화면 묘사로 오해합니다.
6. **조용한 샷이면 소리 한 개만.** "distant traffic hiss", "a crisp snap" 정도로
   박자를 암시합니다.

색은 **3~5개**를 지정하고 광원을 이름으로 부릅니다.
`soft window light with warm lamp fill, cool rim from hallway` — 이렇게 쓰면
여러 샷에 걸쳐 팔레트가 유지됩니다.

---

## 3. 길이와 문체

- **태그 나열이 아니라 서술문입니다.** 콤마로 끊은 키워드 뭉치보다,
  촬영감독에게 브리핑하듯 쓴 문장이 잘 먹습니다.
- 다만 `Cinematography` · `Actions` · `Dialogue` 는 라벨 붙인 블록으로 분리합니다.
  이 혼합형이 기본입니다.
- **짧은 프롬프트 = 모델의 자유, 긴 프롬프트 = 통제.** 결과가 튀는 게 싫으면
  길게 씁니다. 아이디어를 얻고 싶으면 짧게 씁니다.
- 프롬프트는 **계약서가 아니라 희망 목록**입니다. 같은 프롬프트를 여러 번 돌려
  변주를 고르는 것이 정상 사용법입니다.
- 모호한 형용사는 값을 못 합니다. "cinematic look", "brightly lit room",
  "moves quickly" 는 지우고 측정 가능한 말로 바꿉니다.

---

## 4. 해상도 · 비율 · 길이

프롬프트 문장으로 요청할 수 없습니다. **API 파라미터로만** 지정합니다.

| 모델 | 해상도(`size`) |
|---|---|
| `sora-2` | 720x1280, 1280x720 |
| `sora-2-pro` | 720x1280, 1280x720, 1024x1792, 1792x1024, **1080x1920, 1920x1080** |

- 비율은 **9:16 세로와 16:9 가로 두 가지**뿐입니다. 정사각형·4:3 규격은 없습니다.
- 1080p 출력이 필요할 때만 `sora-2-pro` 를 씁니다.

| 항목 | 값 |
|---|---|
| 클립 길이(`seconds`) | `4`, `8`, `12`, `16`, `20` (기본 `4`) |
| 단일 생성 최대 | 20초 |
| 이어붙이기 | 세그먼트당 최대 20초, 최대 6회, 합계 120초 |

**짧을수록 지시를 잘 따릅니다.** 8초 한 개보다 4초 두 개를 붙이는 편이 통제가 쉽습니다.

---

## 5. 네거티브 프롬프트

**전용 네거티브 파라미터가 없습니다.** 공식 가이드도 네거티브 프롬프트를 다루지 않습니다.
따라서 **원하지 않는 것을 나열하지 말고, 원하는 것을 적어 그 자리를 채웁니다.**

| 쓰지 말 것 | 대신 |
|---|---|
| `no people` | `an empty street at dawn, no traffic yet` — 텅 빈 상태를 묘사합니다 |
| `no blur` | `deep focus, everything sharp from foreground to background` |
| `not modern` | `1978, wood paneling, CRT television, rotary phone` |
| 제외 목록 열 줄 | 긍정 묘사 열 줄. 배제어를 늘릴수록 전체가 희석됩니다 |

꼭 배제해야 하면 **한두 개까지만**, 본문 뒤에 짧게 덧붙입니다
(`no camera shake` 정도). 목록으로 부풀리지 않습니다.

---

## 6. 잘 듣는 표현과 피할 표현

| 잘 듣습니다 | 피합니다 |
|---|---|
| `16mm black-and-white`, `1970s film stock`, `IMAX-scale` | `cinematic`, `high quality`, `4K`, `masterpiece` |
| `wide shot, low angle` / `medium close-up, slight angle from behind` | `nice framing`, `good composition` |
| `handheld ENG camera`, `locked-off tripod`, `slow dolly in` | `dynamic camera`, `cool movement` |
| `shallow focus on subject, blurred background` | `bokeh` 단독 |
| `soft window light with warm lamp fill, cool rim from hallway` | `beautiful lighting` |
| `teal, sand, rust` (색 3~5개 지정) | `colorful`, `vibrant` |
| `jogs three steps and stops at the curb` | `moves quickly`, `walks around` |
| `180° shutter, fine grain, subtle halation` | `film grain effect` |
| 화자 이름을 붙인 짧은 대사 | 화자 표기 없는 긴 독백 |
| 서로 맞물리는 설정 한 벌 | 충돌하는 설정(예: `sunny` + `neon night`) |

---

## 7. 레퍼런스와 재사용

| 기능 | 규칙 |
|---|---|
| 레퍼런스 이미지 | **출력 해상도와 크기가 정확히 같아야** 합니다. JPEG·PNG·WebP. 첫 프레임을 고정하고, 이후 움직임은 텍스트가 결정합니다. 사람 얼굴이 들어간 이미지는 거부됩니다 |
| 캐릭터 | Characters API. 720p~1080p, 2~4초 MP4 로 등록. **생성당 2명까지** 권장 |
| 조합 제한 | 레퍼런스 이미지는 캐릭터·이어붙이기와 함께 쓸 수 없습니다 |
| 수정 | edits 엔드포인트. **한 번에 한 가지만** 바꿉니다 (`same shot, switch to 85mm`) |

여러 샷에 걸쳐 인물을 유지하려면 **같은 묘사 문장을 토씨까지 그대로** 복사해 씁니다.
샷마다 표현을 바꾸면 사람이 바뀝니다.

---

## 8. 예시

```
1970s 35mm film look, warm faded stock. A rain-slicked alley behind a noodle shop
at 2am. Steam rises from a floor vent. A courier in a yellow rain jacket crouches
beside a parked scooter, checking a paper map under a flickering sign.
Palette: sodium orange, wet black, dull jade.

Cinematography:
Camera shot: medium wide, low angle from the puddle line, locked-off tripod
Mood: patient, quiet, faintly ominous
Lighting: single sodium streetlamp overhead, cool spill from the shop doorway,
shallow focus on the courier

Actions:
- The courier folds the map in three and tucks it into the jacket.
- She stands, wipes the scooter seat once with her sleeve.
- She looks off-frame left as a shadow crosses the wall behind her.

Dialogue:
COURIER: Two more stops. Then I'm done.

Sound: rain on metal awning, distant scooter engine, the sign's electrical buzz
```

**문제가 생기면 덜어냅니다.** 카메라를 고정하고, 동작을 하나로 줄이고, 대사를 빼서
성공하는 최소 샷을 먼저 만든 뒤 한 겹씩 다시 올립니다.
