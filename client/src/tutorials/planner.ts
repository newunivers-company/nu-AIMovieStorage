import type { Tutorial, TutorialStep } from "./types";

/*
  구도잡기 튜토리얼 — 기능이 많아 «주제별» 로 나눕니다.

   한 튜토리얼이 열두 걸음을 넘으면 어디까지 봤는지
  잊습니다. 창 훑어보기 · 방과 환경 · 인물과 포즈 · 소품 · 카메라 · 타임라인 · 레퍼런스 영상 ·
  모션 캡처 · 노래 · GLB · 단축키 — 막힌 데만 골라 보게 열한 갈래입니다.

  단추·칸 이름은 PlannerChrome · LayoutPanel · EnvironmentPanel · TimelinePanel · MoveTimeline ·
  MotionCaptureDialog · PosePanel 에 적힌 그대로입니다.
*/

const P = "/project/:id" as const;

/** 구도잡기 걸음은 전부 같은 주소·같은 화면이라 두 칸을 여기서 채웁니다. */
function step(fields: Omit<TutorialStep, "route" | "page">): TutorialStep {
  return { route: P, page: "planner", ...fields };
}

const BASICS: Tutorial = {
  id: "planner-basics",
  kind: "planner",
  page: "planner",
  title: "구도잡기 창 훑어보기",
  summary: "창의 머리줄 · 비율 칩 · 세 탭 · 3D 화면 조작 · 오른쪽 위 단추 · 저장까지.",
  steps: [
    step({
      id: "planner-basics-header",
      anchor: "planner-header",
      title: "머리줄",
      body:
        "«구도 잡기» 옆에는 인물을 세우면 샷·앵글·거리 요약이 글로 뜹니다. 오른쪽에 되돌리기(Ctrl+Z) · 다시 실행(Ctrl+Shift+Z) · 닫기. Esc 도 창을 닫습니다 — 관절 고르기에서 한 걸음 뒤로는 Esc 가 아니라 Ctrl+Tab 입니다.",
    }),
    step({
      id: "planner-basics-ratio",
      anchor: "planner-ratio-chips",
      title: "3D 배치와 비율 칩",
      body: "«3D 배치» 는 비율 제한 없는 자유 화면, 1:1 · 4:3 · 3:4 · 16:9 · 9:16 · 21:9 는 캡처 프레임입니다. 구도를 저장할 때 이 프레임대로 찍힙니다.",
    }),
    step({
      id: "planner-basics-tabs",
      anchor: "planner-tabs",
      title: "배치 · 환경 · 타임라인",
      body:
        "오른쪽 패널은 탭 셋입니다. «배치» 는 인물·소품·포즈, «환경» 은 방·배경·화면 표시, «타임라인» 은 노래·모션·GLB·레퍼런스 영상. 카메라 무빙은 탭이 아니라 화면 아래 타임라인에 있습니다. 열 때마다 «배치» 부터입니다.",
    }),
    step({
      id: "planner-basics-viewport",
      anchor: "planner-viewport",
      title: "3D 화면 조작",
      body:
        "화면에서 눌러 고르기 · 왼쪽 끌기 회전 · 오른쪽(또는 가운데) 끌기 이동 · 휠 줌. 더블클릭이나 F 로 회전 중심을 옮기고(Ctrl+F 는 화면 한가운데로), W/A/S/D · Q/E 로 카메라를 걷습니다(Shift 정밀 · Alt 성큼). 이미지 · .hdr/.exr · .glb 를 화면에 끌어다 놓으면 등록됩니다.",
    }),
    step({
      id: "planner-basics-ground",
      anchor: "planner-ground-place",
      title: "바닥에 세우기",
      body:
        "켜고 바닥을 찍으면 고른 인물이 그 자리로 갑니다. 지평선 위·격자 밖은 안 됩니다. 기즈모로 x·z 를 하나씩 끄는 것보다 «저 잔디밭 저쯤» 을 짚는 편이 훨씬 빠릅니다. 배치 탭에서 인물을 먼저 골라야 합니다.",
    }),
    step({
      id: "planner-basics-floor",
      anchor: "planner-floor-toggle",
      title: "방 크기 표시와 바닥면",
      body:
        "«방 N m» 은 지금 방 한 변입니다(방이 없으면 «구도만»). 크기를 바꾸는 자리는 환경 탭 한 곳뿐입니다. «바닥면» 은 바닥 격자와 그림자를 숨기거나 보이고, 캡처에도 반영됩니다.",
    }),
    step({
      id: "planner-basics-save",
      anchor: "planner-save",
      title: "구도 저장",
      body:
        "«구도 저장» 은 지금 화면을 찍어 컷에 넘기고 창을 닫습니다. 컷 카드에 프레임 그림이 붙고 «구도에서 읽음» 이 채워집니다. 구도 그림은 프로젝트 폴더에 파일로 저장되어 스토리보드에서도 씁니다.",
      why: "«다시 찍기» 단추는 없앴습니다. 저장이 곧 찍는 것이라 둘을 나눠 두면 «찍는 것과 저장하는 것이 다른가» 하는 오해만 남겼습니다.",
    }),
    step({
      id: "planner-basics-undo",
      anchor: "planner-undo",
      title: "되돌리기",
      body: "Ctrl+Z 는 창 안 모든 편집에 듣습니다 — 인물 자리, 방 치수, 키, 모션 넣기까지. 손잡이를 끄는 동안은 한 동작으로 묶여, 한 번 끌기가 되돌리기 한 칸입니다.",
    }),
  ],
};

const ROOMS: Tutorial = {
  id: "planner-rooms",
  kind: "planner",
  page: "planner",
  title: "방과 환경",
  summary: "환경 탭 — 방 세우기, 치수, 돔과 방형, 가릴 면, 전개도·파노라마 만들기, 6면 세트, 방 라이브러리.",
  steps: [
    step({
      id: "planner-rooms-add",
      anchor: "env-room-add-indoor",
      title: "실내 · 실외 · 호리존",
      body:
        "새 컷에는 방이 없습니다 — 구도만 잡는 컷입니다. «실내» 는 여섯 면을 붙일 방(이미 방이 있으면 오른쪽에 벽을 맞대어 섭니다), «실외» 는 파노라마 한 장을 두르는 돔(한 변 100 m 공터로 섭니다), «호리존» 은 그림 없이 색 하나로 잇는 제품 컷 스튜디오입니다. 배경이 한쪽만 필요하면 방 대신 배치 탭의 «벽» 이 더 빠릅니다.",
    }),
    step({
      id: "planner-rooms-list",
      anchor: "env-room-list",
      title: "방 목록",
      body:
        "방을 누르면 그 아래가 펴지고 거기부터가 그 방의 속성입니다. 이름은 두 번 누르거나 연필로 고치고, 눈으로 잠시 숨기고, 휴지통으로 지웁니다(Ctrl+Z 로 되살림). 방이 둘 이상이면 «자리»(가로·깊이·높이·회전°)가 보이고, 3D 에서 Shift 로 방을 잡아 옮길 수도 있습니다.",
    }),
    step({
      id: "planner-rooms-size",
      anchor: "env-room-size",
      title: "치수 — 방 크기가 곧 축척",
      body:
        "실내는 가로 · 깊이 · 층고, 돔은 반지름 하나입니다. 밑면이 바닥이라 인물이 뜨지 않고, 크기를 줄이면 인물이 차지하는 비율이 커져 배경보다 커 보입니다. 이미지는 이 숫자대로 뽑히므로(프롬프트에 미터가 박힘) 인물을 놓고 눈으로 본 뒤 여기서 확정하세요.",
    }),
    step({
      id: "planner-rooms-horizon",
      anchor: "env-horizon-color",
      title: "호리존 색",
      body: "호리존 방은 «호리존 색» 을 고르면 여섯 면 전부가 그 색으로 이어집니다. 컷 프롬프트에는 «이음매 없는 단색 배경(색 #…)» 으로 실립니다. 제품은 아래 «이 방의 소품» 으로 세웁니다.",
    }),
    step({
      id: "planner-rooms-shape",
      anchor: "env-outdoor-shape",
      title: "실외 — 돔이냐 방형이냐",
      body:
        "«무엇으로 두를까» 에서 «돔 (파노라마 한 장)» 은 카메라가 제자리에서 돌 때(이음매·시차 없음), «방형 (6면 세트)» 는 카메라가 옮겨 다닐 때(앞뒤·가림이 맞음) 씁니다. 돔은 한가운데 눈높이 1.6 m 에서 가장 정확하고 멀어지면 바닥이 번집니다.",
    }),
    step({
      id: "planner-rooms-occlude",
      anchor: "env-occlude-faces",
      title: "뒤를 가릴 면 · 외벽 투시",
      body:
        "실내만 있습니다. 누른 면만 벽이 되어 뒤를 가립니다. «방 밖에서 외벽 투시» 는 외벽 그림을 붙인 방을 밖에서 볼 때 안에 선 인물을 가리는 외벽만 반투명하게 걷습니다(기본 켜짐). 시간대별로 바꾸려면 아래 타임라인의 «방 · 가릴 면 · 소품» 줄에 키를 찍습니다.",
    }),
    step({
      id: "planner-rooms-place",
      anchor: "env-room-make-image",
      title: "전개도 만들기 · 파노라마 만들기",
      body:
        "«이 공간의 장소» 의 «전개도 만들기»(실외는 «파노라마 만들기»)를 누르면 지금 치수가 적힌 장소 카드가 창으로 뜹니다. 카드에서 프롬프트를 뽑고 «구성» 으로 보낸 뒤 돌아온 그림을 등록하면 여섯 면이 자동으로 잘려 이 방에 걸립니다(실외는 파노라마 한 장이 돔으로). 이미 만든 장소는 드롭다운에서 고르고 «열기» 로 다시 열며, × 로 방에서 뺍니다(카드와 그림은 남음).",
      why: "이름이 «…외벽» 인 세트는 바깥 껍질로, 아니면 안쪽으로 갑니다. 각각 비어 있을 때만 걸어 사람이 걸어 둔 것은 덮지 않습니다.",
    }),
    step({
      id: "planner-rooms-panorama",
      anchor: "env-panoramas",
      title: "파노라마 그림 (실외)",
      body:
        "실외 방에는 «파노라마 그림» 목록이 있습니다. 누르면 이 실외의 돔이 되고, «돔 풀기» 로 뗍니다. 밖에서 만든 360° 그림은 «불러오기» 나 끌어다 놓기로 넣습니다 — 2:1 등장방형이 가장 잘 맞습니다(앱에서 뽑은 16:9 는 위아래가 조금 눌립니다).",
    }),
    step({
      id: "planner-rooms-facesets",
      anchor: "env-face-sets",
      title: "6면 세트 (실내)",
      body:
        "잘린 세트를 누르면 여섯 면이 한 번에 걸립니다(«걸림» 표시). 면이 모자란 세트는 그 면을 비워 둡니다. «그림 전체보기» 는 배경 라이브러리 창 — 세트와 전개도 원본을 큰 화면으로 훑고 면에 직접 붙입니다.",
    }),
    step({
      id: "planner-rooms-props",
      anchor: "env-room-props",
      title: "이 방의 소품",
      body:
        "방에 딸린 배경 소품은 여기서 세웁니다(캐릭터 쪽 소품은 배치 탭). «붙일 면» 을 고르면 그 면에 닿아 방을 넓혀도 따라붙고, «투시» 를 켜면 뒤가 비치고 카메라를 막지 않습니다. «이 소품의 에셋 만들기» 는 에셋 카드를 만들어 이 소품에 바로 잇습니다.",
    }),
    step({
      id: "planner-rooms-library",
      anchor: "env-room-library",
      title: "장소 라이브러리 · 방 라이브러리",
      body:
        "«장소 라이브러리 — 관계도 · 보유 에셋» 은 씬 탭에 있던 배경 화면 그대로(계보 · 다른 원본 · 보유 에셋)를 창으로 엽니다. «방 라이브러리» 의 «지금 방 저장 — 방 + 안의 소품까지» 는 치수·여섯 면·소품·묶음·이어 둔 에셋을 한 덩어리로 담고, 누르면 다른 컷에서 그대로 세웁니다. 목록은 이 작품 것만이고 «다른 작품에서 방 끌어오기» 로 복사해 들여옵니다.",
    }),
    step({
      id: "planner-rooms-display",
      anchor: "env-display",
      title: "화면",
      body: "«이름표 — 캡처·영상에는 나오지 않습니다» · «인물 동선» · «배경 밝기 — 하늘 조명이 없을 때» 를 켜고 끕니다. 보기 설정일 뿐 프롬프트에는 안 갑니다.",
    }),
  ],
};

const CHARACTERS: Tutorial = {
  id: "planner-characters",
  kind: "planner",
  page: "planner",
  title: "인물 배치와 포즈",
  summary: "배치 탭 — 인물 목록, 마네킹, 키·체격·몸 색, 기즈모, 동선, 관절 고르기, 손 모양, 내 프리셋.",
  steps: [
    step({
      id: "planner-characters-list",
      anchor: "layout-characters",
      title: "인물 목록",
      body:
        "이 작품의 인물이 번호 색동그라미 · 이름 · 키cm 로 섭니다. 눈 단추가 «이 컷에서 빼기» — 프로젝트 인물은 지우지 않습니다. Ctrl 을 누르고 누르면 여럿을 함께 잡아 색을 한 번에 바꿉니다. «+ 남성형» «+ 여성형» 은 마네킹이고 «마네킹 제거» 로 지웁니다.",
    }),
    step({
      id: "planner-characters-fields",
      anchor: "layout-character-fields",
      title: "인물 이름 · 키 · 체격",
      body:
        "고른 인물의 칸이 목록 바로 아래에서 열립니다. 마네킹은 이름·키·체격(슬림·보통·덩치 큰)을 여기서 정하고, 프로젝트 인물의 체격은 캐릭터 카드에서 정합니다. 키는 마네킹 크기 자체라 크기 기즈모로는 안 바꿉니다.",
    }),
    step({
      id: "planner-characters-color",
      anchor: "layout-body-color",
      title: "몸 색",
      body:
        "«자동» 이면 겹치지 않게 나눠 주고, 색 칩이나 고르개로 못 박습니다. 색은 캡처에서 누가 누구인지 가리는 유일한 표시입니다 — 이름표는 그림에 안 나가고, 프롬프트가 «파란 사람은 @…» 로 짝을 맞춥니다. 겹치면 인물이 통째로 바뀝니다.",
    }),
    step({
      id: "planner-characters-gizmo",
      anchor: "layout-gizmo-mode",
      title: "수치 입력 — 이동 · 회전 · 크기",
      body:
        "«수치 입력» 줄의 이동 · 회전 · 크기는 1 · 2 · 3 키와 같고, 자유 · 바닥 · 높이는 Ctrl+1·2·3 입니다. «바닥» 은 바닥에 붙여 좌우·앞뒤로만, «높이» 는 위아래로만. 위치·회전 숫자 칸은 접혀 있고 맞춰야 할 때만 폅니다. «위치·회전 초기화» 로 되돌립니다.",
    }),
    step({
      id: "planner-characters-path",
      anchor: "layout-path",
      title: "캐릭터 동선",
      body:
        "«캐릭터 동선 (N)» 의 + 는 지금 서 있는 자리를 동선 점으로 더하고, 눈으로 3D 화면에 길을 보이거나 숨기며, 휴지통으로 전부 지웁니다. 재생 중 인물이 어디 있는지는 타임라인의 이동 키가 정합니다.",
    }),
    step({
      id: "planner-characters-tab",
      anchor: "bone-picker",
      title: "Tab — 관절 고르기",
      body:
        "인물을 잡고 Tab 을 누르면 마우스 자리에 파이 메뉴가 뜹니다. 고리를 따라 상체 · 왼쪽 · 오른쪽 · 손가락으로 들어가고, 한 걸음 뒤로는 Ctrl+Tab, 닫기는 Tab. 고른 관절에 3D 기즈모(빨·초·파 링)가 붙습니다. 다른 것을 잡았다가 다시 잡으면 처음부터입니다.",
      why: "Esc 로 뒤로 가게 하면 첫 고리에서 한 번 더 눌렀을 때 구도잡기 창이 통째로 닫혔습니다.",
    }),
    step({
      id: "planner-characters-joints",
      anchor: "layout-joints",
      title: "관절 세부 조정",
      body:
        "«관절을 고르면 3D 화면에 기즈모가 붙습니다 · N개 조정됨». 접이 그룹(상체 · 왼쪽 · 오른쪽 · 왼손 손가락 · 오른손 손가락)에서 관절을 고르면 X축 · Y축 · Z축 숫자와 행별 초기화가 뜹니다 — 색은 기즈모 링 색과 같고 0° 가 프리셋 원래 자세입니다. «미세 조정» 은 2cm · 2° 단위로 끊어 움직입니다. IK 이동은 없고 회전만입니다.",
    }),
    step({
      id: "planner-characters-pose-image",
      anchor: "layout-pose-from-image",
      title: "그림에서 포즈 가져오기",
      body:
        "사진 · 만화 · 실루엣 한 장을 끌어다 놓거나 프로젝트 그림(레퍼런스로 등록한 시트)에서 골라 포즈를 통째로 가져옵니다. 막대 인간은 못 읽습니다. 가져온 뒤 어긋난 관절만 아래에서 고치세요.",
    }),
    step({
      id: "planner-characters-hands",
      anchor: "layout-hands",
      title: "손 모양",
      // 내장 손 프리셋은 PosePanel 에서 걷어냈습니다 — 화면에 있는 것만 적습니다.
      body:
        "«손 모양» 판은 왼손 · 오른손 토글로 어느 손을 다룰지 고릅니다. 손가락은 위 «관절 세부 조정» 의 «왼손 손가락» «오른손 손가락» 그룹에서 마디를 골라 각도로 맞춥니다. 아래 «현재 각도 (Y / Z°)» 표가 열다섯 마디의 굽힘(Z)·벌림(Y)을 한눈에 보여 주고, «이 손 전체 펴기» 로 편 손으로 되돌립니다. 다 맞췄으면 «현재 자세 저장» 으로 내 프리셋에 담아 두세요.",
      why: "보자기 · 주먹 · 가위 같은 내장 프리셋과 폄 · 반 · 접음 3단계는 걷어냈습니다 — 손가락마다 굽는 축이 달라 각도 계산이 계속 틀어졌습니다. 직접 맞춰 저장한 값은 틀어질 일이 없습니다.",
    }),
    step({
      id: "planner-characters-presets",
      anchor: "layout-presets",
      title: "내 프리셋",
      body:
        "내장 포즈 목록은 없습니다. 자세를 맞춘 뒤 «+ 현재 자세 저장» 으로 이름 · 그룹 · 종류(전체 · 몸통·팔다리 · 손 모양)를 적어 저장하면 단추가 됩니다. 손은 «왼손 기준 · 오른손 기준» 으로 저장해 반대 손에는 뒤집어 적용합니다. 단추는 끌어서 순서를 바꾸고, × 는 «저장 폴더의 원본 파일도 함께 지워집니다» 를 묻습니다.",
      why: "프리셋 파일은 설정의 포즈 프리셋 폴더에 갑니다. 폴더가 없으면 «이 브라우저에만 저장됩니다» 경고가 뜹니다.",
    }),
    step({
      id: "planner-characters-cleanup",
      anchor: "layout-mocap-cleanup",
      title: "모캡 키 다듬기",
      body:
        "영상에서 모션을 넣은 인물에는 «모캡 키 다듬기» 가 뜹니다. 둔하게 · 보통 · 예민하게로 민감도를 두고, «자동 다듬기» 는 지그재그·외톨이 튐을 규칙으로 잇고, «AI 분석 다듬기» 는 구간 숫자표를 LLM 에 보내 «인식 오류 / 의도한 빠른 동작» 을 가려 오류만 잇습니다. Ctrl+Z 로 되돌립니다.",
    }),
  ],
};

const OBJECTS: Tutorial = {
  id: "planner-objects",
  kind: "planner",
  page: "planner",
  title: "소품 · 조명 · 에셋",
  summary: "배치 탭의 소품 — 세우기, 묶기, 색, 관절에 붙이기, 시트로 바꿔 그리기, 조명, 벽 그림.",
  steps: [
    step({
      id: "planner-objects-kinds",
      anchor: "layout-object-kinds",
      title: "세우기 — 벽 · 박스 · 구 · 실린더 · 핀 조명 · LED 조명",
      body: "«소품 · 조명» 의 단추를 누르면 화면 한가운데에 섭니다. 테이블·크레이트는 없습니다 — 상자를 눌러 만들고 여러 개를 묶으면 됩니다. 조명을 안 세우면 «스카이 조명 사용 중» 입니다.",
    }),
    step({
      id: "planner-objects-list",
      anchor: "layout-objects",
      title: "목록 — 이름 · 숨기기 · Ctrl 로 여럿",
      body: "이름은 두 번 눌러 고치고, 눈으로 잠시 숨기고, 휴지통으로 지웁니다. Ctrl(맥은 ⌘)을 누르고 누르면 함께 잡히고, 둘 이상이면 아래에 «함께 잡은 N개를 한 덩어리로» 가 뜹니다.",
    }),
    step({
      id: "planner-objects-group",
      anchor: "layout-object-group",
      title: "덩어리",
      body:
        "묶으면 목록에서 한 줄로 서고 끌면 통째로 움직입니다(회전·크기는 한가운데를 축으로). 덩어리를 고르면 색 · 이름 · «무엇으로 바꿀까요 — 예: 바닥에 깔린 옅은 안개» · 묶음 에셋만 뜨고, «풀기» 로 풉니다(소품은 남음).",
    }),
    step({
      id: "planner-objects-fields",
      anchor: "layout-object-swap",
      title: "고른 소품 — 수치 · 색 · 무엇으로 바꿔 그릴까",
      body:
        "«수치 입력 · 색» 은 접혀 있고 위치 · 회전 · 크기(가로 · 높이 · 깊이)와 «위치·회전·크기 모두 초기화». 색은 화면 구분용이면서 프롬프트의 낱말이라 «the red box = 가방» 처럼 실립니다. «무엇으로 바꿔 그릴까 — 만들어 둔 시트» 에서 에셋 시트를 고르면 «이 자리에 «수화의 검» 을 그려라» 가 프롬프트에 들어가고, 안 고르면 이름만 나갑니다.",
    }),
    step({
      id: "planner-objects-asset",
      anchor: "layout-object-asset",
      title: "이 소품의 에셋 만들기",
      body:
        "박스 · 구 · 실린더에만 있습니다. 누르면 에셋 카드가 소품 이름 그대로 생기고 이 소품에 걸린 채로 열립니다. 이미 걸어 둔 에셋이 있으면 «열기 — 시트 뽑기». 띄우는 목록은 캐릭터·장소 화면의 공용 에셋 목록과 같습니다.",
    }),
    step({
      id: "planner-objects-attach",
      anchor: "layout-attach-bone",
      title: "인물에 붙이기",
      body:
        "«인물에 붙이기 — 포즈를 따라 함께 움직입니다» 에서 인물과 관절(오른손 · 왼손 · 팔뚝 · 머리 · 목 · 가슴 · 허리 · 발)을 고르면 좌표의 뜻이 그 관절 기준으로 바뀌고 자리가 0 으로 돌아갑니다. «손잡이 자리(m)» 는 소품 안에서 관절에 닿는 점 — 검은 손잡이가 손에 잡혀야지 한가운데가 잡히면 안 됩니다.",
    }),
    step({
      id: "planner-objects-light",
      anchor: "layout-light",
      title: "조명",
      body: "조명을 고르면 종류(하늘 · 포인트 · 스팟 · 면광) · 세기 · 색이 뜹니다. 하늘 조명이 없을 때의 배경 밝기는 환경 탭 «화면» 에 있습니다.",
    }),
    step({
      id: "planner-objects-wall",
      anchor: "layout-wall-image",
      title: "벽과 이 벽의 그림",
      body:
        "«벽» 을 세워 크기를 맞추면 «이 벽의 그림» 에 인물에서 몇 m 뒤인지가 뜹니다. «그림 고르기 — 만들어 둔 것» 에서 붙이거나 «이 크기로 배경 그림 만들기» 로 벽 크기와 거리가 적힌 장소 카드를 엽니다. 한 컷에 필요한 배경은 대개 정면 한 장이라, 여섯 면을 다 갖춘 방은 카메라가 도는 컷에서만 필요합니다.",
    }),
    step({
      id: "planner-objects-transparent",
      anchor: "env-room-props",
      title: "붙일 면 · 투시 (방 소품)",
      body:
        "방에 딸린 소품은 환경 탭의 «이 방의 소품» 에서 «붙일 면»(바닥 · 벽 · 천장)을 고르면 닿는 축만 방이 잡고, «투시» 를 켜면 뒤가 비치고 카메라를 막지 않습니다. 시간대별로는 타임라인의 그 소품 줄에 키를 찍습니다.",
    }),
  ],
};

const CAMERA: Tutorial = {
  id: "planner-camera",
  kind: "planner",
  page: "planner",
  title: "카메라와 샷",
  summary: "렌즈 화각, 조작 속도, 저장한 카메라, 무빙의 출발 구도, 앵커.",
  steps: [
    step({
      id: "planner-camera-fov",
      anchor: "planner-camera-fov",
      title: "샷 크기 — 렌즈 화각",
      body:
        "망원(약 75mm) · 준망원 · 표준(약 33mm, 기본) · 광각 · 초광각(약 14mm). 화각을 바꾸면 인물도 배경도 화면 크기가 똑같이 변해 둘의 비율이 안 틀립니다 — «구도를 유지한 채 원거리·근거리» 의 정답입니다. 카메라를 앞뒤로 빼는 것(달리)은 그 비율 자체를 바꿉니다.",
    }),
    step({
      id: "planner-camera-speed",
      anchor: "planner-camera-speed",
      title: "조작 속도 — 회전 · 이동 · 줌",
      body: "회전 감도는 화각으로 자동으로 잡히고 여기서 정한 배수가 그 위에 곱해집니다. 걷기는 Shift 로 0.3배(정밀), Alt 로 3배입니다.",
    }),
    step({
      id: "planner-camera-focus",
      anchor: "planner-camera-hint",
      title: "F · Ctrl+F · M · G",
      body:
        "더블클릭이나 F 는 회전 중심을 그 점으로, Ctrl+F 는 화면 한가운데로 옮깁니다. M 은 보던 방향 그대로 고른 것 앞으로 카메라를 글라이드합니다(화면에 꽉 차는 거리). G 는 활성 구도(저장한 카메라)로 돌아갑니다.",
    }),
    step({
      id: "planner-camera-shots",
      anchor: "planner-shot-save",
      title: "저장한 카메라 — 지금 구도 저장",
      body:
        "화면을 맞춘 뒤 «지금 구도 저장» 을 누르면 목록에 쌓입니다. 눌러서 그 구도로 바로 돌아오고, 이름은 두 번 눌러 고치며, 재저장 단추는 «이 구도를 지금 카메라로 덮어씁니다». 이 구도가 카메라 무빙의 출발점입니다 — 저장한 카메라가 없으면 무빙을 놓을 수 없습니다.",
    }),
    step({
      id: "planner-camera-presets",
      anchor: "bottom-shot-presets",
      title: "무빙 아이콘 — 달리 · 오빗 · 팬 · 휩 팬 · 틸트 · 트럭 · 크레인 · 줌 · 달리 줌 · 자유 경로",
      body:
        "타임라인 위의 아이콘을 누르면 클립이 더해지고, 끌어서 클립 위에 놓으면 그 클립의 무빙이 바뀝니다(자리와 길이는 그대로). 앵커를 쓰는 무빙(오빗 · 달리)만 노란 기가 돕니다 — 팬 · 틸트 · 트럭 · 크레인 · 줌은 앵커와 무관합니다. 달리 인/아웃은 이동량의 부호 차이라 하나로 합쳐져 있습니다.",
    }),
    step({
      id: "planner-camera-start",
      anchor: "bottom-clip-start",
      title: "출발 구도 — «이어서»",
      body:
        "클립 왼쪽 칸이 어느 저장 구도에서 출발할지입니다. 비워 두면(«이어서») 앞 클립이 끝난 자세에서 이어지고, 고르면 그 시각에 컷이 바뀝니다 — 한 타임라인에 카메라 여러 대를 세우는 셈입니다. 첫 클립만 출발 카메라가 자동으로 붙습니다.",
    }),
    step({
      id: "planner-camera-anchor",
      anchor: "bottom-anchor",
      title: "앵커 — 무엇을 중심으로 돌까",
      body:
        "앵커 X/Y/Z 는 늘 보이고 손으로 적을 수 있습니다. 배치 탭에서 대상을 고르면 «…의 머리 · 가슴 · 허리 · 발» 로 붙이고, «따라가기» 를 켜면 걸어가는 사람을 돌며 찍습니다. «손으로» 는 앵커를 3D 에서 끌어 옮기는 기즈모입니다. «앵커: 내 것 · 전부 첫 클립 · 다른 클립» 은 이 클립이 어느 앵커를 따를지 — A 키로도 넘깁니다.",
      why: "발밑이 아니라 가슴 높이가 기본인 까닭 — 사람을 중심으로 돌 때 발밑을 축으로 잡으면 머리가 화면 밖으로 휘둘립니다.",
    }),
    step({
      id: "planner-camera-options",
      anchor: "bottom-axis",
      title: "축 · 앵커 보기 · 손떨림",
      body:
        "«축: 수평» 은 사람 주위를 돌고, «수직» 은 위아래로 넘어가며, «나선» 은 둘 다. «앵커 보기» 를 켜면 앵커가 화면 한가운데로 오고, 끄면 잡아 둔 구도를 지킨 채 움직입니다. «앵커 표시» 는 3D 의 십자. «손떨림» 은 0% 삼각대 · 12% 어깨 · 25% 손으로 든 다큐 · 50% 뛰면서 · 80% 흔들어 찍는 액션.",
    }),
  ],
};

const TIMELINE: Tutorial = {
  id: "planner-timeline",
  kind: "planner",
  page: "planner",
  title: "타임라인 · 키 · 재생",
  summary: "화면 아래 무빙 타임라인 — 접기, 길이·fps, 재생, 클립 손잡이, 키, 속도 그래프, 인물·방 레이어.",
  steps: [
    step({
      id: "planner-timeline-collapse",
      anchor: "bottom-collapse",
      title: "접기 · 펴기 (Ctrl+Space)",
      body: "판이 3D 화면의 절반을 덮을 때 «접기» 로 아래로 내립니다. 접어도 «재생» 단추와 시각은 남습니다. 접힘 상태는 이 컴퓨터에 기억됩니다.",
    }),
    step({
      id: "planner-timeline-duration",
      anchor: "bottom-duration",
      title: "총 길이 · 프레임 수 · 배율",
      body:
        "왼쪽 칸의 초를 누르면 «타임라인 총 길이» 를, «24f» 를 누르면 «프레임 수»(실사 24 · 방송 30 · 게임 60)를 입력합니다. 줄여도 클립은 안 지워지고 밖으로 밀려나 안 보일 뿐입니다. 배율은 + / − 키나 배율 단추로 — 모캡 키가 따닥따닥 들어갔을 때 옆으로 늘려 집습니다.",
    }),
    step({
      id: "planner-timeline-play",
      anchor: "bottom-play",
      title: "재생 · 스페이스 · 스크럽",
      body:
        "«재생» 이나 스페이스로 돌리고, 재생 중에는 타임라인 어디를 눌러도 멈춥니다. 눈금자는 누른 채 끌면 따라옵니다. 앞 · 다음 키프레임 단추로 정확히 그 자리로 갑니다 — 손으로 맞추면 0.05초씩 어긋나 새 키가 생깁니다. 재생 중에는 3D 왼쪽 위에 «카메라 무빙 미리보기» 배지가 뜨고, 화면을 돌리면 해제됩니다.",
    }),
    step({
      id: "planner-timeline-clip",
      anchor: "bottom-clip-amount",
      title: "클립 — 이동량 · 길이",
      body:
        "프리셋 클립은 «지금 자세에서 얼마나» 라 손잡이가 셋입니다 — «이동량»(도 · 배율 · 미터) · «길이»(초) · 속도 그래프. 몸통을 끌면 시각, 오른쪽 끝을 끌면 길이, 두 번 누르면 초 입력, 골라 두고 Delete 로 삭제. ▲▼ 로 줄 차례를 바꾸고, 눈으로 잠시 끕니다. 오빗 90도도 이동량을 45로 바꾸면 그만입니다.",
    }),
    step({
      id: "planner-timeline-keys",
      anchor: "bottom-clip-length",
      title: "이동량 키 · 자유 경로 키",
      body:
        "클립 중간에 속도를 꺾고 싶을 때만 이동량 키를 씁니다(«+ 키 전부» 는 재생 머리 자리에 지금 카메라를 통째로). 자유 경로는 «카메라 자리(m)» «바라보는 곳(m)» «줌(배율)» 세 줄에 키가 따로 서고, 재생 머리를 옮기고 3D 에서 카메라를 움직이면 자동으로 키가 됩니다. 키는 한 번 누르면 값 판이 열리고, 끌어서 옮기고, Delete 로 지웁니다. 여럿을 잡으면 «키 N개 잡음» 이 뜨고 함께 움직입니다.",
    }),
    step({
      id: "planner-timeline-easing",
      anchor: "bottom-easing",
      title: "속도 그래프",
      body:
        "«속도 그래프» 는 이 키에서 다음 키까지의 완급입니다 — 프리셋 칩(리니어 · 이즈 인·아웃 · 슬로우 스타트 · 급가속 후 정지 · 예비 동작 · 오버슛…)과 곡선. 마지막 키를 고르면 «마지막 키 — 뒤 구간이 없습니다» 가 뜹니다. 인물 레이어에서는 고른 키의 구간을 고칩니다.",
    }),
    step({
      id: "planner-timeline-layers",
      anchor: "bottom-layers",
      title: "인물 · 소품 레이어",
      body:
        "카메라 클립과 같은 모양입니다 — 막대가 있는 동안만 화면에 서고, 몸통을 끌면 옮기고 양 끝을 끌면 자릅니다. ▸ 로 아래 속성 줄(이동 · 회전 · 자세, 소품은 크기)을 펴고, 줄마다 + 로 지금 값을 키로 찍습니다. 눈은 잠시 끄기, ∿ 는 속도 그래프. 두 번 누르면 «나타나는 시각» 을 숫자로.",
    }),
    step({
      id: "planner-timeline-k",
      anchor: "bottom-layers",
      title: "K · Shift+K — 키 찍기",
      body:
        "대상을 고르고 1·2·3 으로 속성을 고른 뒤 K 를 누르면 화면에 보이는 값 그대로 키가 찍힙니다 — 값이 안 바뀌어 자동 키가 안 생길 때(«3초까지 그대로 있다가 4초까지 움직이기»)에 씁니다. 자세는 관절을 고른 채 K, 프리셋만 눌렀으면 Shift+K. 인물 크기는 키로 찍지 않습니다.",
    }),
    step({
      id: "planner-timeline-pose-rows",
      anchor: "bottom-layers",
      title: "자세 줄 펼치기",
      body:
        "«▸ 자세» 를 펴면 움직인 관절마다 줄이 서고 움직인 구간이 막대로 보입니다. 점을 누르면 그 시각으로 가서 그 관절을 잡고(그 자리에서 기즈모로 돌리면 자동 키), 끌면 그 관절만 옮기고, Delete 는 그 관절만 지웁니다. 접힌 자세 줄의 요약 점은 그 자리 관절 점 전부를 한 번에 움직입니다.",
    }),
    step({
      id: "planner-timeline-rooms",
      anchor: "bottom-room-rows",
      title: "방 · 가릴 면 · 소품 줄",
      body:
        "«방 · 가릴 면 · 소품» 묶음에서 방마다 ▸ 로 면 줄(정면 · 후면 · 왼쪽 · 오른쪽 · 천장 · 바닥)을 펴고, 「가림 / 열림」 을 누르면 이 시각부터 뒤집는 키가 찍힙니다. 키가 없는 면은 환경 탭 체크를 따릅니다. 방 소품의 «투시 / 막음» 도 같은 묶음, 같은 모양입니다 — 카메라가 벽을 넘어 들어가는 컷에 씁니다.",
    }),
    step({
      id: "planner-timeline-delete",
      anchor: "bottom-timeline",
      title: "Delete · 되돌리기",
      body: "고른 키가 있으면 키가 먼저, 없으면 고른 클립이 Delete 로 지워집니다. 빈 자리를 톡 누르면 잡아 둔 키가 풀립니다. 전부 Ctrl+Z 로 되돌립니다.",
    }),
  ],
};

const RENDER: Tutorial = {
  id: "planner-render",
  kind: "planner",
  page: "planner",
  title: "레퍼런스 영상 뽑기",
  summary: "타임라인 탭 «레퍼런스 영상» — 통째로 또는 조각으로 MP4 를 뽑고, 컷이 쓸 것을 고릅니다.",
  steps: [
    step({
      id: "planner-render-section",
      anchor: "timeline-render",
      title: "레퍼런스 영상 칸",
      body:
        "«N프레임 (24fps · N초)» 이 뜹니다 — 길이와 fps 는 화면 아래 타임라인에서 고칩니다. 카메라 무빙 · 인물 키 · GLB 애니메이션이 이 시계를 함께 따르고, 영상에는 격자 · 이름표 · 경로선 · 앵커가 나오지 않습니다.",
    }),
    step({
      id: "planner-render-split",
      anchor: "timeline-render-split",
      title: "통째로 · 5초 · 10초 · 14초 · 15초 · 30초 · 1분 · 2분 · 노래 N구간",
      body:
        "«통째로» 는 한 파일로 — 컷에 영상으로 적힙니다. 초 단위는 그 길이씩 잘라 여러 파일로(마지막 조각만 남은 길이), 14초는 AI 영상 기본 길이라 따로 둡니다. 노래를 올린 컷이면 «노래 N구간» 이 구간 경계에서 자릅니다 — 이어 붙이면 박자가 맞습니다. 파일 이름에 part 번호와 구간이 붙습니다.",
    }),
    step({
      id: "planner-render-run",
      anchor: "timeline-render-run",
      title: "● 레퍼런스 영상 만들기 (MP4)",
      // 이름 규칙은 useReferenceVideo.ts 의 fileName 그대로 — 씬 제목 · cutNN · 샷 이름, 조각이면 partNN 과 초 구간.
      body: "누르면 «0 / 0 프레임» 진행이 돌고 «취소» 로 끊습니다. 인코더는 WebCodecs 라 최신 WebView·브라우저면 됩니다 — 데스크톱 앱에서는 프로젝트 폴더에 저장되고, 브라우저(pnpm dev)에서는 MP4 가 내려받기로 떨어집니다. 파일 이름은 «{씬}_{cutNN}_{샷}.mp4» 꼴이고, 조각으로 뽑으면 «_partNN_구간» 이 뒤에 붙습니다.",
    }),
    step({
      id: "planner-render-list",
      anchor: "timeline-renders-list",
      title: "뽑아 둔 영상",
      body:
        "«뽑아 둔 영상 N편 — 누르면 이 컷이 그것을 씁니다». 조각까지 한 줄씩 남아 «그때 그 12초짜리» 를 다시 고를 수 있고, 목록에서 빼도 파일은 폴더에 남습니다. 길이를 바꿔 여러 번 뽑아 놓고 고르는 것이 실제 작업 방식입니다.",
    }),
    step({
      id: "planner-render-cut",
      anchor: "cut-ref-video-list",
      title: "컷 카드에서 고르기",
      body:
        "컷 카드의 «구도잡기에서 뽑은 영상 (N)» 에서도 같은 목록을 보고 여기서 바로 재생합니다. 고른 것이 «레퍼런스 영상 쓰기» 를 켰을 때 영상 생성기에 맨 앞 레퍼런스로 올라갑니다 — 생성기는 앞쪽 레퍼런스를 더 무겁게 읽습니다.",
    }),
    step({
      id: "planner-render-fps",
      anchor: "bottom-fps",
      title: "fps 와 길이는 아래 타임라인에서",
      body: "«24f» 칸이 초당 프레임 수, 그 옆이 총 길이입니다. 재생과 영상 내보내기가 이 값을 씁니다. 5초는 기본값이지 한계가 아닙니다.",
    }),
  ],
};

const MOCAP: Tutorial = {
  id: "planner-mocap",
  kind: "planner",
  page: "planner",
  title: "영상에서 모션 가져오기",
  summary: "영상을 올려 사람마다 이동 · 몸 방향 · 관절을 읽고 캐릭터 키로 넣습니다.",
  steps: [
    step({
      id: "planner-mocap-open",
      anchor: "timeline-mocap-open",
      title: "영상 올려서 캐릭터에 모션 입히기",
      body:
        "타임라인 탭의 «영상에서 모션 가져오기» 에서 엽니다. 전신이 보이는 영상에서 사람마다 이동 · 몸 방향 · 관절을 읽어 손으로 찍은 키와 똑같은 키로 넣습니다 — 넣은 뒤에는 똑같이 고칩니다. 고정 카메라 · 앞이나 옆에서 찍은 영상이 가장 정확하고, 손에 든 카메라 · 모션블러가 심한 영상은 조각이 납니다.",
    }),
    step({
      id: "planner-mocap-sources",
      anchor: "mocap-add-video",
      title: "영상 추가",
      body:
        "«영상 추가» 로 MP4 · WebM · MOV 를 여러 개 한 번에 넣습니다. 프로젝트 폴더에 담기고, 이름은 두 번 눌러 고칩니다(타임라인 레이어에 «수화(춤선…)» 으로 뜨는 이름). 목록에서 빼도 원본 파일은 지우지 않습니다. 오른쪽 재생기에 지금 보는 장의 뼈대와 번호가 겹쳐 그려집니다.",
    }),
    step({
      id: "planner-mocap-engine",
      anchor: "mocap-analyze",
      title: "1 · 분석 — 모델 · 구간 · 초당 장 · 거울",
      body:
        "모델은 «MediaPipe · 앱 내장»(설치 없이 · 뒤돈 자세에 약함) 과 설정 → 로컬 모델에서 설치하는 NLF · SAM 3D Body · GVHMR. «구간» 은 몇 초부터 몇 초까지, «초당 장(키)» 은 10 · 15 · 30 · 60 또는 «영상 그대로»(한 장도 건너뛰지 않음). «거울 영상(좌우 뒤집기)» 은 연습실 거울 영상일 때 분석 전에 켭니다. «사람 찾기 · 관절 분석» 을 누르면 줄에 서고, 다른 분석 중이면 «줄에 세우기 — 끝나는 대로 분석».",
      why: "창을 닫아도 분석은 멈추지 않고, 끝나는 대로 프로젝트 폴더에 적힙니다.",
    }),
    step({
      id: "planner-mocap-cleanup",
      anchor: "mocap-cleanup",
      title: "2 · 다듬기 — 튐 보정 · 떨림 줄이기 · 디딘 발 고정",
      body:
        "«튐 보정»(끔 · 보통 · 강)은 한두 장 튀는 팔다리 · 좌우 뒤바뀜 · 몸 방향 뒤집힘을 앞뒤로 메웁니다. «떨림 줄이기»(약 · 보통 · 강)는 가만히 선 손 떨림은 누르고 빠른 동작은 살립니다. «디딘 발 고정 — 미끄러짐 없애기» 는 땅에 디딘 동안 발이 그 자리에 머물게 골반을 밀어 줍니다. 아래에 «튄 관절 N곳 · 통째로 메운 장 N · 좌우 뒤바뀜 N번» 이 숫자로 뜹니다.",
    }),
    step({
      id: "planner-mocap-match",
      anchor: "mocap-match",
      title: "3 · 번호 ↔ 캐릭터",
      body:
        "찾은 사람마다 «N번 · 몇 초~몇 초» 가 뜨고 드롭다운에서 캐릭터 · «새 마네킹(남) · (여)» · «안 씀» 을 고릅니다. 번호를 누르면 처음 나오는 장으로 갑니다. «타임라인 시작» 은 이 영상의 키가 몇 초부터 들어갈지, «영상 속 대형 그대로» 는 여럿을 넣을 때 서로의 간격·앞뒤를 영상대로 둘지입니다. 같은 캐릭터가 같은 시간에 두 번 들어가면 막습니다.",
    }),
    step({
      id: "planner-mocap-apply",
      anchor: "mocap-apply",
      title: "이동 · 몸 방향 · 관절 → 타임라인에 넣기",
      body:
        "아래 체크 셋이 어느 채널을 넣을지입니다. «타임라인에 넣기» 를 누르면 «영상 모션을 넣었습니다 · 영상 N개 · 캐릭터 N명» 이 뜨고, 넣는 구간 안의 그 캐릭터 키는 바뀌며 타임라인이 짧으면 늘어납니다. Ctrl+Z 한 번에 통째로 되돌립니다.",
    }),
    step({
      id: "planner-mocap-menu",
      anchor: "bottom-layers",
      title: "레이어 오른쪽 단추 — 모션 바꾸기 · 다시 분석",
      body:
        "타임라인의 인물 레이어를 오른쪽 단추로 누르면 «다른 모션으로 바꾸기»(분석해 둔 영상 중에서 고름) 와 «이 모션 다시 분석»(보정을 고쳐 다시 돌림) 이 뜹니다. 둘 다 모션 창을 그 줄과 그 사람을 미리 고른 채로 엽니다.",
    }),
    step({
      id: "planner-mocap-after",
      anchor: "layout-mocap-cleanup",
      title: "넣은 뒤 — 모캡 키 다듬기",
      body:
        "배치 탭에서 그 인물을 고르면 «모캡 키 다듬기» 가 뜹니다. «자동 다듬기» 는 규칙으로, «AI 분석 다듬기» 는 LLM 이 «인식 오류 / 의도한 동작» 을 가려 오류만 잇습니다. 키가 촘촘하면 타임라인을 + 로 늘려 집으세요.",
    }),
    step({
      id: "planner-mocap-limits",
      title: "어떤 영상이 잘 되나",
      body:
        "고정 카메라 · 1인 · 전신이 발끝까지 보이는 영상은 30fps 241장 중 239장이 잡혔습니다. 여럿이 겹쳐 서면 조각이 나고 2.5초 안이면 이어 붙입니다. 뒤돈 장 · 몸통이 가려진 장은 키가 비고 앞뒤 키 사이를 잇습니다. 무거운 모델(NLF 등)은 GPU 가 있어야 하고 설정에서 설치합니다.",
    }),
  ],
};

const MUSIC: Tutorial = {
  id: "planner-music",
  kind: "planner",
  page: "planner",
  title: "노래와 뮤직비디오",
  summary: "타임라인 탭 «노래» — 곡 올리기, 타임라인 길이 맞추기, 구간 나누기, 나눠 뽑기.",
  steps: [
    step({
      id: "planner-music-pick",
      anchor: "timeline-music-pick",
      title: "BGM에서 고르기 · 음원 올리기",
      body:
        "«BGM에서 고르기 — 뽑아 둔 곡» 은 BGM 프로젝트에서 뽑은 곡을 그대로 씁니다. «음원 올리기 — BGM · 업로드 폴더에 들어갑니다» 는 밖에서 받은 파일을 «<씬>_컷NN_» 이름으로 옮겨 올립니다. 재생하면 같이 울리고 «바꾸기» 와 빼기 단추로 갈거나 뗍니다(파일은 그대로).",
    }),
    step({
      id: "planner-music-length",
      anchor: "timeline-music",
      title: "노래 길이로",
      body: "타임라인이 노래보다 짧으면 뒤쪽은 뽑을 화면이 없습니다. «노래 길이(N초)로» 를 누르면 타임라인 길이가 곡에 맞고, «노래를 민 자리» 로 시작 시각을 밉니다 — 3분 곡이면 타임라인도 3분.",
    }),
    step({
      id: "planner-music-sections",
      anchor: "timeline-music-sections",
      title: "구간 나누기 · 여기서 자르기",
      body:
        "«빠르기»(BPM) 와 «마디씩» 을 적고 «구간 나누기» 를 누르면 한 번에 나뉩니다. 들으며 «N초에서 자르기» 로 재생 머리 자리에서 둘로 나눌 수도 있습니다. 구간마다 이름(도입 · 후렴)을 적고, 휴지통으로 지웁니다.",
    }),
    step({
      id: "planner-music-row",
      anchor: "bottom-timeline",
      title: "타임라인 맨 윗줄의 노래",
      body: "화면 아래 타임라인 맨 윗줄에 «노래 · 이름» 과 구간 칸, 그 뒤에 파형이 깔립니다. 구간을 누르면 그 자리로 갑니다. 파형이 있어야 «어디가 후렴인지» 를 읽습니다.",
    }),
    step({
      id: "planner-music-split",
      anchor: "timeline-render-split",
      title: "노래 구간대로 나눠 뽑기",
      body: "구간을 나눠 두면 «레퍼런스 영상» 의 나누기 선택지에 «노래 N구간» 이 뜹니다. 그 경계에서 잘라 뽑으면 이어 붙였을 때 노래와 박자가 맞습니다.",
    }),
    step({
      id: "planner-music-dance",
      anchor: "timeline-mocap-open",
      title: "춤은 «영상에서 모션 가져오기» 로",
      body: "댄스 커버 영상을 올려 번호마다 캐릭터를 고르면 그 춤이 캐릭터 키로 들어갑니다. 노래 · 모션 · 나눠 뽑기가 이 탭 하나에 있는 까닭입니다.",
    }),
  ],
};

const GLB: Tutorial = {
  id: "planner-glb",
  kind: "planner",
  page: "planner",
  title: "GLB 애니메이션과 블렌더",
  summary: "블렌더에서 만든 움직임을 GLB 로 들여와 타임라인에 얹습니다.",
  steps: [
    step({
      id: "planner-glb-prompt",
      anchor: "timeline-blender-prompt",
      title: "블렌더 작업 지시문 만들기",
      body: "지금 구도(방 · 인물 자리 · 카메라)를 글로 적은 지시문을 띄웁니다. LLM 에 붙여넣고 블렌더 MCP 로 실행하세요. 인물 동작은 앱이 알 수 없으니 주석 자리에 원하는 움직임을 적어 넣습니다. «복사» 로 가져갑니다.",
    }),
    step({
      id: "planner-glb-add",
      anchor: "timeline-glb",
      title: "GLB 파일 추가 (.glb / .gltf)",
      body: "블렌더에서 glTF/GLB 로 내보내면 애니메이션이 함께 들어옵니다. 단추로 고르거나 3D 화면에 끌어다 놓아도 됩니다. Mixamo FBX 는 안 됩니다 — GLB 로 바꿔 오세요.",
    }),
    step({
      id: "planner-glb-track",
      anchor: "timeline-glb",
      title: "트랙 카드 — 클립 · 시작 시각 · 재생 속도 · 크기 배율",
      body:
        "파일 안의 클립을 고르고, «시작 시각»(타임라인 몇 초부터), «재생 속도»(1 = 원래), «크기 배율»(블렌더와 단위가 다를 때)을 적습니다. «컷 끝까지 반복 재생» 을 끄면 한 번만 재생하고 마지막 프레임에서 멈춥니다. 클립 길이와 프레임 수가 아래에 뜹니다.",
    }),
    step({
      id: "planner-glb-place",
      anchor: "timeline-glb",
      title: "위치 · 회전 · 화면에서 직접 옮기기",
      body: "위치 X/Y/Z · 회전 X°/Y°/Z° 를 적거나 «화면에서 직접 옮기기» 로 기즈모를 붙여 끕니다(«기즈모 해제» 로 뗌). 눈으로 잠시 숨기고 × 로 제거합니다.",
    }),
    step({
      id: "planner-glb-render",
      anchor: "timeline-render",
      title: "레퍼런스 영상에 같이 담깁니다",
      body: "GLB 애니메이션은 카메라 무빙과 같은 시계를 따라 «레퍼런스 영상 만들기» 에 그대로 담깁니다. 미리보기 중 화면을 돌리면 해제됩니다.",
    }),
  ],
};

const SHORTCUTS: Tutorial = {
  id: "planner-shortcuts",
  kind: "planner",
  page: "planner",
  title: "단축키",
  summary: "구도잡기 창의 키 한 벌. 입력칸 안에서는 전부 물러납니다.",
  steps: [
    step({
      id: "planner-shortcuts-camera",
      anchor: "planner-camera-hint",
      title: "카메라 — W/A/S/D · Q/E · F · Ctrl+F · M · G",
      body: "W/A/S/D · Q/E 로 걷고(Shift 정밀 · Alt 성큼), 더블클릭이나 F 로 회전 중심을 옮기고, Ctrl+F 는 화면 한가운데로, M 은 고른 것 앞으로, G 는 활성 구도로 돌아갑니다.",
    }),
    step({
      id: "planner-shortcuts-gizmo",
      anchor: "layout-gizmo-mode",
      title: "기즈모 — 1 · 2 · 3 · Ctrl+1·2·3",
      body: "1 이동 · 2 회전 · 3 크기. Ctrl 과 함께면 자유 · 바닥 · 높이 제한입니다.",
    }),
    step({
      id: "planner-shortcuts-keys",
      anchor: "bottom-layers",
      title: "키 — K · Shift+K · Delete",
      body: "K 는 고른 대상의 «지금 고른 속성» 에 화면에 보이는 값 그대로 키를 찍습니다. Shift+K 는 자세 키(프리셋만 눌러 관절을 안 고른 채). Delete 는 고른 키, 없으면 고른 클립. 재생 중에는 K 를 안 받습니다.",
    }),
    step({
      id: "planner-shortcuts-timeline",
      anchor: "bottom-play",
      title: "타임라인 — 스페이스 · Ctrl+Space · + / −",
      body: "스페이스 재생·멈춤(어디를 눌러도 멈춤), Ctrl+Space 접기·펴기, + / − 가로 배율. 눈금자는 누른 채 끌면 스크럽.",
    }),
    step({
      id: "planner-shortcuts-anchor",
      anchor: "bottom-anchor",
      title: "앵커 — A",
      body: "클립을 고른 채 A 를 누르면 따라갈 앵커 레이어를 넘깁니다 — 내 것 → 전부 첫 클립 → 다른 클립들 → 다시 내 것.",
    }),
    step({
      id: "planner-shortcuts-bones",
      anchor: "bone-picker",
      title: "관절 — Tab · Ctrl+Tab",
      body: "인물을 잡고 Tab 으로 관절 고르기 파이 메뉴, Ctrl+Tab 으로 한 걸음 뒤로, Tab 으로 닫기. Esc 는 창을 닫는 키라 여기서는 안 씁니다.",
    }),
    step({
      id: "planner-shortcuts-select",
      anchor: "layout-objects",
      title: "여럿 잡기 — Ctrl · Shift",
      body: "Ctrl(맥은 ⌘)을 누르고 누르면 인물·소품을 함께 잡습니다. Shift 로 방을 잡아 3D 에서 옮깁니다.",
    }),
    step({
      id: "planner-shortcuts-undo",
      anchor: "planner-undo",
      title: "되돌리기 — Ctrl+Z · Ctrl+Shift+Z",
      body: "창 안 모든 편집에 듣습니다. 자동 키 · 방 규칙처럼 «사람이 한 편집이 아닌 것» 은 되돌리기에 쌓이지 않습니다.",
    }),
    step({
      id: "planner-shortcuts-typing",
      title: "입력칸 안에서는 물러납니다",
      body: "이름을 고치거나 숫자를 치는 동안은 스페이스 · K · Tab · Delete 가 글자로 들어갑니다. 칸 밖을 한 번 누른 뒤 키를 쓰세요.",
    }),
  ],
};

export const PLANNER_TUTORIALS: Tutorial[] = [
  BASICS,
  ROOMS,
  CHARACTERS,
  OBJECTS,
  CAMERA,
  TIMELINE,
  RENDER,
  MOCAP,
  MUSIC,
  GLB,
  SHORTCUTS,
];
