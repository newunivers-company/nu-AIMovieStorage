import type { Tutorial } from "./types";

/*
  페이지별 튜토리얼 — «작업하다 막혔을 때» 그 화면의 기능을 하나씩.

  
  한 바퀴(full.ts)가 «순서» 라면 여기는 «사전» 입니다. 걸음마다 단추 하나·칸 하나이고,
  이름은 화면 코드의 것을 그대로 씁니다. 구도잡기는 기능이 많아 planner.ts 에 따로 있습니다.
*/

const P = "/project/:id" as const;

const PROJECTS: Tutorial = {
  id: "page-projects",
  kind: "page",
  page: "projects",
  title: "프로젝트 보드",
  summary: "작품 목록을 보고, 만들고, 숨기고, 폴더를 다시 읽는 화면입니다.",
  steps: [
    {
      id: "page-projects-stats",
      route: "/",
      page: "projects",
      anchor: "projects-stats",
      title: "요약 숫자",
      body:
        "활성 프로젝트 · 총 씬 · 생성된 자산 · AI 최적화 횟수 네 칸은 전부 실제 저장된 프로젝트에서 셉니다. 가짜 예시 카드는 없습니다 — 비어 있으면 비어 있다고 그대로 보여 줍니다.",
    },
    {
      id: "page-projects-new",
      route: "/",
      page: "projects",
      anchor: "projects-new",
      title: "새 프로젝트",
      body:
        "«새 프로젝트» 나 목록의 «새 프로젝트 만들기» 카드를 누르면 네 단계 화면이 열립니다. 제목만 정해 두면 나머지는 나중에 채워도 됩니다.",
    },
    {
      id: "page-projects-search",
      route: "/",
      page: "projects",
      anchor: "projects-search",
      title: "검색과 보기 방식",
      body: "검색 칸은 제목으로 거릅니다. 오른쪽 두 단추로 바둑판과 목록 보기를 바꿉니다.",
    },
    {
      id: "page-projects-card",
      route: "/",
      page: "projects",
      anchor: "projects-grid",
      title: "카드 읽기",
      body:
        "카드에는 상태 뱃지(초안 · 진행 중), 씬 수, 자산 수, 마지막으로 고친 날짜가 있습니다. 카드를 누르면 채운 단계 중 마지막 다음으로 바로 갑니다 — 다 채웠으면 확인 단계입니다.",
    },
    {
      id: "page-projects-hide",
      route: "/",
      page: "projects",
      anchor: "projects-card-hide",
      title: "숨기기 — 지우기가 아닙니다",
      body:
        "카드에 마우스를 올리면 나오는 눈 단추는 목록에서만 감춥니다. 프로젝트 폴더와 그 안의 그림·영상은 그대로 남습니다. 진짜로 지우려면 탐색기에서 폴더를 지우세요.",
      why: "폴더 안에 몇 시간씩 뽑은 그림이 들어 있습니다. 클릭 한 번에 그게 다 사라지면 되돌릴 길이 없습니다.",
    },
    {
      id: "page-projects-hidden",
      route: "/",
      page: "projects",
      anchor: "projects-hidden",
      title: "숨긴 프로젝트",
      body: "아래 «숨긴 프로젝트 (N)» 을 펼치면 감춘 것이 폴더 이름과 함께 늘어서고, «다시 보이기» 로 되돌립니다.",
    },
    {
      id: "page-projects-reload",
      route: "/",
      page: "projects",
      anchor: "projects-reload",
      title: "폴더 다시 읽기",
      body: "탐색기에서 프로젝트 폴더를 지우거나 옮겼다면 오른쪽의 새로 고침 단추를 누르세요. 폴더가 원본이라 목록은 그 거울일 뿐입니다.",
    },
  ],
};

const BASICS: Tutorial = {
  id: "page-basics",
  kind: "page",
  page: "basics",
  title: "주제 설정",
  summary: "작품 정보와 장르·스타일·시대를 정합니다. 이후 모든 프롬프트의 머리말이 됩니다.",
  steps: [
    {
      id: "page-basics-bootstrap",
      route: "/new-project",
      page: "basics",
      anchor: "basics-bootstrap",
      title: "AI 로 일괄 생성",
      body:
        "시나리오를 붙여넣어 작품 정보 · 캐릭터 · 배경 · 장면 · 컷 구도 · 키컷 프롬프트까지 한 번에 만드는 창입니다. API 키가 있어야 켜집니다. 이미 뭔가 적어 두었으면 한 줄 단추로 접혀 있습니다.",
    },
    {
      id: "page-basics-bootstrap-mode",
      route: "/new-project",
      page: "basics",
      anchor: "bootstrap-mode",
      title: "덧붙이기 · 비우고 새로",
      body:
        "«이미 있는 것에 덧붙이기» 는 제목·줄거리를 두고 카드만 뒤에 붙입니다. «비우고 새로» 는 캐릭터·배경·장면 목록을 비우고 넣는데, 그림이 붙은 카드는 남깁니다 — 카드를 없애면 그 인물 폴더를 앱에서 지울 길이 사라집니다. 장면은 제목이 같아도 걸러지지 않고 뒤에 붙습니다.",
    },
    {
      id: "page-basics-bootstrap-again",
      route: "/new-project",
      page: "basics",
      anchor: "bootstrap-run",
      title: "상세만 다시 만들기 · 중지",
      body:
        "받아 둔 작품 정보가 있으면 «상세만 다시 만들기» 가 늘 보입니다. 제목·줄거리·인물 목록은 그대로 두고 2·3단계(상세·장면·구도)만 다시 부릅니다. 도는 중에는 «중지» 로 끊고, 지난 답은 «지난 일괄 생성» 선반에서 되돌립니다.",
    },
    {
      // 4단계는 «만들기» 옆 체크라 같은 앵커입니다. 그래서 생긴 단계.
      id: "page-basics-bootstrap-rich",
      route: "/new-project",
      page: "basics",
      anchor: "bootstrap-run",
      title: "카드마다 프롬프트 자세히 쓰기 (4/4)",
      body:
        "«만들기» 옆의 체크로, 기본은 켜짐입니다. 3단계는 한 답에 컷 전부를 몰아 받아 컷마다 한 문단이 고작이라, 답을 넣은 뒤 인물·장소 시트와 컷의 그림·영상 프롬프트를 카드마다 «프롬프트 작성» 과 같은 요청으로 따로 받습니다. 진행 줄에 «4/4 카드마다 프롬프트를 자세히 쓰는 중 — n/N번째» 가 뜹니다. 요금과 시간이 카드 수만큼 드니 끄면 3단계의 짧은 프롬프트와 규칙 조립만 남습니다. «넣고 이미지·영상까지 바로 뽑기» 는 이 단계가 끝난 뒤에야 줄을 세웁니다.",
    },
    {
      id: "page-basics-info",
      route: "/new-project",
      page: "basics",
      anchor: "basics-info",
      title: "작품 정보",
      body:
        "다섯 칸 — 제목 · 한 줄 줄거리 · 줄거리 · 톤·분위기 · 분량입니다. 제목은 폴더 이름이 되고 나중에 바꿔도 폴더는 그대로입니다. 분량(예: 3분 단편)은 일괄 생성이 컷 길이를 정할 때 봅니다.",
    },
    {
      id: "page-basics-genre",
      route: "/new-project",
      page: "basics",
      anchor: "basics-genre",
      title: "장르",
      body: "무엇이 나오는가 — 소재입니다. 여러 개 켤 수 있고 켠 수가 제목 옆에 뜹니다.",
    },
    {
      id: "page-basics-style",
      route: "/new-project",
      page: "basics",
      anchor: "basics-style",
      title: "비주얼 스타일",
      body: "어떻게 그려지는가 — 화풍입니다. 장르와 따로 두는 까닭은 «판타지» 를 실사로도 애니로도 그릴 수 있어서입니다.",
    },
    {
      id: "page-basics-era",
      route: "/new-project",
      page: "basics",
      anchor: "basics-era",
      title: "시대 배경",
      body:
        "단추로 고르거나 «연도로 직접 잡기» 의 «구간 추가» 로 «1900년대 ~ 2000년대» 처럼 적습니다. 연도를 적으면 단추는 흐려집니다 — 두 곳에서 정하면 반드시 어긋나서 더 좁게 짚은 쪽이 이깁니다. «시대를 특정하지 않음» 을 켜면 «어느 시대에도 묶이지 않음» 이라고 프롬프트에 분명히 적습니다.",
    },
    {
      id: "page-basics-preview",
      route: "/new-project",
      page: "basics",
      anchor: "basics-preview",
      title: "프롬프트에 이렇게 들어갑니다",
      body: "고른 것이 영어로 어떻게 나가는지 미리 보는 칸입니다. «판타지» 를 골랐을 때 영어로 뭐라고 나가는지 모르면 결과를 못 고칩니다.",
    },
    {
      id: "page-basics-nav",
      route: "/new-project",
      page: "basics",
      anchor: "project-progress",
      title: "프로그래스 바와 다음",
      body:
        "위 네 동그라미는 «채웠는가», 사이 선은 «가 봤는가» 입니다. 지금 있는 곳은 테두리로, 건너뛴 곳은 점선으로 표시됩니다. 아무 단계나 눌러 오갈 수 있고, 아래 «다음» «건너뛰기» «이전» 으로도 움직입니다. 저장 단추는 없습니다 — 손을 멈추면 1.5초 뒤, 창을 가릴 때, 화면을 떠날 때 저절로 저장합니다.",
    },
  ],
};

const CHARACTERS: Tutorial = {
  id: "page-characters",
  kind: "page",
  page: "characters",
  title: "캐릭터",
  summary: "인물 카드 하나의 칸을 위에서 아래로 — 레퍼런스, 분석, 프롬프트, 뽑은 그림, 시트, 변형.",
  steps: [
    {
      id: "page-characters-panel",
      route: P,
      page: "characters",
      anchor: "character-panel",
      title: "인물 패널",
      body:
        "인물마다 패널 하나입니다. 이름 줄 · 원본 카드(왼쪽) → 변형 카드(오른쪽) 계보 · 다른 원본 · 보유 애셋 · 제작한 캐릭터 시트 · «캐릭터 시트 제작» 순서입니다. 이름 옆 화살표로 패널을 한 줄로 접습니다. 배경·에셋도 같은 상자를 씁니다.",
    },
    {
      id: "page-characters-add",
      route: P,
      page: "characters",
      anchor: "characters-add",
      title: "캐릭터 추가 · 다른 작품에서 끌어오기",
      body:
        "목록 끝의 «캐릭터 추가» 는 빈 카드를 만들고 바로 엽니다. «다른 작품에서 캐릭터 끌어오기» 는 다른 프로젝트의 카드와 그림을 이 작품 폴더로 복사해 들여옵니다 — 시리즈물처럼 인물을 나눠 쓸 때.",
      why: "복사인 까닭은, 한 카드를 두 작품이 가리키면 «화면에서 지우면 원본도 지운다» 는 규칙이 무너지기 때문입니다.",
    },
    {
      id: "page-characters-references",
      route: P,
      page: "characters",
      anchor: "card-references",
      title: "레퍼런스 이미지와 활용",
      body:
        "왼쪽 스트립에 «레퍼런스 이미지 추가» 로 넣거나 끌어다 놓습니다. 썸네일에 마우스를 올리면 복사 · 폴더 열기 · 가위가 뜹니다. 스트립 아래 세 단추(«이 인물 그대로» · «요소만 참고» · «참고 안 함»)가 레퍼런스를 어떻게 볼지입니다 — 배경은 «이 장소 그대로», 에셋은 «이 물건 그대로». 모델은 이걸 스스로 판단하지 못합니다. 태그를 걸려면 폴더에서 끌어다 «추가 외형 묘사» 칸에 놓으세요.",
    },
    {
      id: "page-characters-basics",
      route: P,
      page: "characters",
      anchor: "card-basics",
      title: "기본 정보",
      body:
        "이름 · 역할 · 형태(사람형 · 동물형 · 그 밖의 존재) · 성별(여성형 · 남성형 · 중립형) · 키(cm) · 체격. 키와 체형은 그림에서 못 읽으므로 여기 값이 프롬프트에 그대로 갑니다. 이름은 파일 이름의 앞부분이라 바꾸면 폴더와 파일 이름이 따라가고, 바꾸기 전에 한 번 묻습니다.",
    },
    {
      id: "page-characters-analysis",
      route: P,
      page: "characters",
      anchor: "card-analysis",
      title: "이미지 분석",
      body:
        "«이미지 분석» 은 API 로 바로, «LLM 요청문» 은 요청 글을 복사해 밖에서 답을 받아 «② 결과 넣기» 에 붙여넣는 길입니다. 도는 동안 마우스를 올리면 «중지» 가 됩니다. 결과 칸은 직접 고칠 수 있고, 다시 분석하면 앞의 판이 «받아 둔 분석» 에 남습니다. 같은 부모의 다른 카드 분석은 «분석 가져오기» 로 옮깁니다.",
    },
    {
      id: "page-characters-profile",
      route: P,
      page: "characters",
      anchor: "card-profile",
      title: "특징 정하기",
      body: "성격 · 말투 · 버릇처럼 그림에 안 찍히는 것을 정합니다. 시트의 프로필 글상자에 글자로 찍혀 영상 모델이 연기할 때 읽습니다. 그림 프롬프트에는 안 실립니다.",
    },
    {
      id: "page-characters-blueprint",
      route: P,
      page: "characters",
      anchor: "card-blueprint",
      title: "캐릭터 레퍼런스 구성",
      body:
        "시트에 어떤 칸을 넣을지 그룹별로 켜고 끕니다 — 정체성·체형, 얼굴·헤어, 연기·동작, 외형·의상, 소품·상호작용, 색·재질·제작 메모. «전체» 로 한 번에 켭니다. 여기서 고른 칸이 «프롬프트 작성» 의 재료입니다.",
    },
    {
      id: "page-characters-prompt",
      route: P,
      page: "characters",
      anchor: "card-prompt-write",
      title: "프롬프트 작성 · 규칙 조립 · LLM 요청문",
      body:
        "«이미지 모델» 을 고르면 그 모델 문법으로 글이 지어집니다. «프롬프트 작성» 은 API 로, «규칙 조립» 은 API 없이 규칙으로, «LLM 요청문» 은 복사해 밖에서. 결과는 한글 프롬프트 · English Prompt 두 칸이고 «네 칸 모두 지우기» 로 비웁니다. 앞의 판은 «받아 둔 프롬프트» 에 쌓여 «되돌리기» 로 돌아갑니다.",
    },
    {
      id: "page-characters-first-reference",
      route: P,
      page: "characters",
      anchor: "card-first-reference",
      title: "첫 레퍼런스 프롬프트",
      body:
        "레퍼런스가 아직 한 장도 없을 때 쓰는 칸입니다. 이름·설명·기본 정보만으로 «맞춤 프롬프트 만들기» 를 누르면 첫 그림을 뽑을 글이 나옵니다. 여기서도 «구성» 으로 프롬프트만 든 생성기를 놓을 수 있습니다.",
    },
    {
      id: "page-characters-compose",
      route: P,
      page: "characters",
      anchor: "card-compose",
      title: "구성 · 마그니픽 · 복사 · 로컬로 뽑기",
      body:
        "칸마다 단추가 셋입니다. «구성» 은 레퍼런스와 프롬프트(@칩 연결)가 든 이미지 생성기를 마그니픽 캔버스에 놓습니다(이 앱이 켠 마그니픽 데스크톱에서만). «마그니픽» 은 글만 텍스트 노드로 붙여넣고, «복사» 는 클립보드로. 로컬 모델이 깔려 있으면 «로컬로 뽑기» 가 이 컴퓨터에서 바로 한 장 만듭니다 — 보내는 순간 @칩과 --ar 같은 매개변수를 걷어냅니다.",
    },
    {
      id: "page-characters-images",
      route: P,
      page: "characters",
      anchor: "card-generated-images",
      title: "생성 결과 이미지",
      body:
        "«이미지 등록» 이나 끌어다 놓기로 넣습니다. «마그니픽 후보함» 은 마그니픽 동기화 폴더를 열고, 마그니픽에 연결했으면 «가져오기» 로 이미 만들어 둔 것을 다시 뽑지 않고 끌어옵니다. 별이 대표 이미지이고, 지우면 «저장 폴더의 원본 파일도 함께 지워집니다».",
    },
    {
      id: "page-characters-crop",
      route: P,
      page: "characters",
      anchor: "card-image-crop",
      title: "가위 — 자르기 · 지우기 · 표시하기 · 동선 · 전개도 6면",
      body:
        "그림의 가위를 누르면 편집 창입니다. «자르기 · 지우기» 는 칸을 사각형으로 그려 «인물_칸 이름_자름» 으로 저장하고, 지우개 상자는 둘레 색으로 덮습니다(지우기가 자르기보다 먼저 적용). «표시하기» 는 앵커·사각형·원·자유선으로 번호를 찍고, «동선» 은 카메라·인물·빛 화살표를 그립니다. «업스케일해서 저장» 은 설정의 엔진으로 그 자리에서 키웁니다.",
    },
    {
      id: "page-characters-sheet",
      route: P,
      page: "characters",
      anchor: "character-sheet-compose",
      title: "캐릭터 시트 제작",
      body:
        "시트 합성 창에서 왼쪽 그림(원본 · 변형 · 보유 에셋 · 공용 에셋)을 캔버스에 끌어 칸을 만들고 크기를 맞춥니다. «배치도» 는 프로젝트 공용이라 이름을 적어 다른 인물에서도 고르고, 복제해 칸 몇 개만 갈아 끼웁니다. «뽑을 규격» 은 캔버스 px, «칸 이름 굽기» 는 그림 밑에 이름을 찍습니다. «시트 제작» 으로 굽고, 편집이면 «다시 굽기» 나 «새 판으로 저장». Ctrl+Z 됩니다.",
    },
    {
      id: "page-characters-variation",
      route: P,
      page: "characters",
      anchor: "character-variation",
      title: "변형 · 다른 원본 · 애셋",
      body:
        "«이 카드에서 변형» 은 부모 시트를 «정체성 기준» 으로 고정하고 바꿀 요소만 적는 창입니다(기준은 뺄 수 없고 다른 그림의 ★로 바꿀 수만 있습니다). «다른 원본» 상자의 «캐릭터 생성»(배경이면 «배경 생성»)은 어린 시절·노인처럼 같은 인물의 다른 모습, «보유 애셋» 의 «애셋 생성» 은 이 인물이 든 물건 — 셋 다 이 인물 폴더 안에 들어갑니다.",
    },
  ],
};

const SCENES: Tutorial = {
  id: "page-scenes",
  kind: "page",
  page: "scenes",
  title: "씬 구성과 컷 카드",
  summary: "장면과 컷을 만들고, 컷 카드 안의 칸 — 구도, 레퍼런스, 대사, 프롬프트, 영상, 스토리보드 — 를 하나씩.",
  steps: [
    {
      id: "page-scenes-add",
      route: P,
      page: "scenes",
      anchor: "scenes-add",
      title: "장면 추가",
      body:
        "«첫 장면 추가하기» 나 목록 끝 «장면 추가» 로 만듭니다. 장면 머리줄의 화살표로 접고 펴며, 휴지통은 «컷과 스토리보드·씬 영상이 함께 사라집니다. 저장 폴더의 원본 파일도 함께 지워집니다» 를 묻습니다.",
    },
    {
      id: "page-scenes-summary",
      route: P,
      page: "scenes",
      anchor: "scene-summary",
      title: "장면 제목과 요약",
      body:
        "«장면 제목» 과 «이 장면에서 무슨 일이 일어나는지» 요약입니다. 요약은 씬 영상 프롬프트의 첫 줄이 되므로 컷·대사·VFX 와 같은 «프롬프트 말로» 단추가 달려 있습니다.",
    },
    {
      id: "page-scenes-cut-add",
      route: P,
      page: "scenes",
      anchor: "scene-cut-add",
      title: "컷 추가와 머리줄",
      body:
        "«컷 추가» 로 컷을 세우고, 컷을 누르면 아래로 펼쳐집니다. 머리줄에는 번호 · «한 줄 제목» · 연출 칩 · 대표 그림 · «구도잡기» «구도 불러오기» «특수 배경» · 휴지통이 있습니다.",
    },
    {
      id: "page-scenes-planner-buttons",
      route: P,
      page: "scenes",
      anchor: "cut-import-composition",
      title: "구도잡기 · 구도 불러오기 · 특수 배경",
      body:
        "«구도잡기» 는 3D 창을 엽니다. «구도 불러오기» 는 이 프로젝트에서 잡아 둔 구도를 그림으로 골라 방·소품·인물 자리를 통째로 가져옵니다(카메라만 바꾸면 되는 컷에). «특수 배경» 은 도면 · 도면+동선 · 사람 크기 기준 같은 «읽는 그림» 을 뽑는 장소 카드를 엽니다.",
    },
    {
      id: "page-scenes-frame",
      route: P,
      page: "scenes",
      anchor: "cut-frame",
      title: "프레임과 설명",
      body: "구도를 저장하면 왼쪽에 프레임 그림이 붙습니다. 오른쪽 «무엇이 보이고 무엇이 일어나는지» 에 컷 설명을 적습니다.",
    },
    {
      id: "page-scenes-switches",
      route: P,
      page: "scenes",
      anchor: "cut-switches",
      title: "구도 쓰기 · 레퍼런스 영상 쓰기",
      body:
        "«구도 쓰기» 를 켜면 구도 그림·배경 플레이트가 레퍼런스로 올라가고 프롬프트에 «배치도대로» 가 실립니다. 끄면 인물 시트와 글만으로 뽑습니다(키 이미지용). «레퍼런스 영상 쓰기» 를 켜면 구도잡기 영상이 함께 올라가고 카메라 설명은 글에서 빠집니다 — 두 지시가 겹치면 어긋납니다. 켜고 끄면 @태그도 같이 바뀝니다.",
    },
    {
      id: "page-scenes-summary-line",
      route: P,
      page: "scenes",
      anchor: "cut-summary",
      title: "구도에서 읽음",
      body: "샷 크기 · 앵글 · 거리 · 무빙은 구도를 잡으면 여기 자동으로 뜹니다. 토글로 직접 고르지 않습니다 — 두 곳에 두면 어긋나서요.",
    },
    {
      id: "page-scenes-refs",
      route: P,
      page: "scenes",
      anchor: "cut-refs",
      title: "캐릭터 · 배경 · 레퍼런스 고르기",
      body:
        "«캐릭터» 탭에서 인물 그림을 누르면 번호가 붙고 그 순서대로 올라갑니다(앞이 셉니다). 한 인물에 두 장 이상 고르면 «같은 사람의 다른 그림» 줄이 프롬프트에 붙습니다. 안 고르면 시트 한 장이 자동으로 갑니다. «배경» 탭은 장소의 6면 세트, «레퍼런스» 탭은 그 밖의 참고 그림입니다. 고른 뒤에는 «@ 다시 잇기» 를 권하는 알림이 뜹니다.",
    },
    {
      id: "page-scenes-style",
      route: P,
      page: "scenes",
      anchor: "cut-style-toggles",
      title: "연출 칩 — 스타일 · 촬영(초점거리·심도) · 조명 · 색감 · 질감 · 실사",
      body:
        "컷의 연출을 칩으로 켭니다. 작품 스타일과 샷 크기를 보고 앱이 실사 기본값을 먼저 켜 두며, 손으로 정한 것은 건드리지 않습니다. 켠 칩은 한글·영문 프롬프트 양쪽에 촬영 용어로 들어갑니다.",
    },
    {
      id: "page-scenes-dialogue",
      route: P,
      page: "scenes",
      anchor: "cut-dialogue",
      title: "대사 · 연기 지시 · VFX",
      body:
        "평소 말투로 적어도 됩니다. «연기 · 프롬프트 말로» «효과 · 프롬프트 말로» 단추가 생성기가 알아듣는 말로 바꿔 주고 바꾸기 전에 보여 줍니다. VFX 는 「비를 추가해」 처럼 시키는 말투가 아니라 「굵은 비가 비스듬히 쏟아진다」 처럼 적으세요.",
    },
    {
      id: "page-scenes-prompt",
      route: P,
      page: "scenes",
      anchor: "cut-prompt-section",
      title: "컷 프롬프트",
      body:
        "«프롬프트 작성» 은 API 로 네 칸을 채우고(구도에서 읽은 사실은 두고 문장만 다듬음), «규칙 조립» 은 API 없이, «@ 다시 잇기» 는 써 둔 문장은 두고 그림 이름(@태그)만 지금 걸린 것으로 바꿉니다. 칸마다 «구성» 으로 마그니픽에 올리고, 로컬 모델이 있으면 «로컬로 뽑기». 앞의 판은 «받아 둔 프롬프트» 에 남습니다.",
    },
    {
      id: "page-scenes-video",
      route: P,
      page: "scenes",
      anchor: "cut-video-section",
      title: "영상 프롬프트 · 영상으로 · 로컬 영상",
      body:
        "«영상 프롬프트» 는 카메라 무빙·인물·소품에서 영상용 글을 따로 짓고, 러닝타임은 구도잡기 타임라인이 정합니다. «구도잡기에서 뽑은 영상» 목록에서 어느 것을 레퍼런스로 올릴지 고르고 여기서 바로 재생해 봅니다. «영상으로» 는 레퍼런스 영상 · 인물 시트 · 배경을 올린 영상 생성기를 이어 붙이고, «로컬 영상» 은 대표 그림을 첫 프레임으로 이 컴퓨터에서 만듭니다. 결과는 «영상» 선반에 «영상 불러오기» 로 등록합니다.",
    },
    {
      id: "page-scenes-storyboard",
      route: P,
      page: "scenes",
      anchor: "scene-storyboard",
      title: "스토리보드",
      body:
        "장면 아래 «스토리보드 만들기» 는 컷 대표 그림을 순서대로 6000×6000 시트로 굽습니다. 키 이미지가 없는 컷은 구도 그림이 대신 들어가고, 그림도 구도도 없는 컷은 빠집니다. 컷 그림에 «표시하기» 로 그린 동선·카메라 무빙은 칸 위에 같이 그려지고 글로도 실립니다. 시트가 생기면 «프롬프트 작성» 으로 씬 영상 프롬프트를 받고 «영상으로» 로 올립니다. 돌아온 영상은 «씬 영상» 선반에.",
    },
    {
      id: "page-scenes-inbox",
      route: P,
      page: "scenes",
      anchor: "inbox-panel",
      title: "마그니픽에서 온 것",
      body:
        "화면 위 후보함에 마그니픽 동기화로 내려온 그림·영상이 뜹니다. 타일을 눌러 여러 개 고르고 «고른 것을 …에 채택» 으로 인물·장소·컷·장면에 붙입니다. 영상은 컷이나 장면에만 붙습니다. «숨기기» 는 목록에서만 뺍니다 — 후보함 파일은 옮기거나 지우지 않습니다.",
    },
  ],
};

const FINISH: Tutorial = {
  id: "page-finish",
  kind: "page",
  page: "finish",
  title: "확인",
  summary: "작품 전체를 한눈에 보고, 스토리보드를 인쇄하고, 남은 것을 한 번에 뽑습니다.",
  steps: [
    {
      id: "page-finish-counts",
      route: P,
      page: "finish",
      anchor: "finish-counts",
      title: "인물 · 장소 · 컷 · 스토리보드 · 영상",
      body: "다섯 숫자는 이 작품에 지금 있는 것을 셉니다. 스토리보드가 장면 수보다 적으면 아직 안 구운 장면이 있다는 뜻입니다.",
    },
    {
      id: "page-finish-batch",
      route: P,
      page: "finish",
      anchor: "finish-batch",
      title: "한 번에 뽑기",
      body:
        "«지금 뽑기» 는 아직 안 뽑은 것을 인물 시트 → 컷 그림 → 스토리보드 → 씬 영상 차례로 줄에 세웁니다. 앞 걸음이 뽑은 그림이 다음 걸음의 레퍼런스가 됩니다. 무엇으로 뽑을지는 주제 설정의 «AI 로 일괄 생성» 에서 고른 값을 씁니다. «이 작품 것 모두 멈추기» 로 끊습니다.",
      why: "마그니픽 «끝까지 뽑기» 는 건당 과금입니다. 손으로 골라 가며 할 때는 «생성기를 차려 놓기» 쪽을 고르세요.",
    },
    {
      id: "page-finish-tasks",
      route: P,
      page: "finish",
      anchor: "nav-tasks",
      title: "진행은 «작업» 서랍에서",
      body:
        "위 띠의 «작업» 을 열면 돌고 있는 일과 기다리는 일이 한 줄씩 보입니다. 몇 분째인지, 소식이 끊긴 지 얼마인지가 적혀 «멈춘 건지 진행 중인지» 를 알 수 있습니다. 앱을 껐다 켜도 이어집니다. 옆의 «API 기록» 은 LLM 요청과 쓴 토큰입니다.",
    },
    {
      id: "page-finish-scene",
      route: P,
      page: "finish",
      anchor: "finish-scene-row",
      title: "장면마다 한 줄",
      body: "장면 제목 · 컷 수 · 스토리보드 시트가 늘어섭니다. 시트가 없으면 «씬 구성» 탭의 그 장면 아래에서 «스토리보드 만들기» 를 누르라는 안내가 뜹니다.",
    },
    {
      id: "page-finish-print",
      route: P,
      page: "finish",
      anchor: "finish-print",
      title: "인쇄",
      body: "«인쇄» 는 그 장면의 시트 한 장만 종이 크기로 깔아 찍습니다. 화면의 나머지는 인쇄에서만 감춥니다.",
    },
    {
      id: "page-finish-scene-video",
      route: P,
      page: "finish",
      anchor: "finish-scene-video",
      title: "씬 영상 — 밖에서 뽑아 온 것도 여기로",
      body: "«씬 영상» 선반에 «영상 불러오기» 나 끌어다 놓기로 등록하면 그 장면의 씬 영상으로 붙습니다. 어느 컷의 것인지는 컷 카드에서 넣어야 알 수 있습니다.",
    },
    {
      id: "page-finish-cut-videos",
      route: P,
      page: "finish",
      anchor: "finish-cut-videos",
      title: "컷 영상",
      body: "컷 카드 안에 등록한 영상을 장면별로 모아 봅니다. 씬 영상은 위 선반이 이미 보여 주므로 여기는 컷 것만입니다.",
    },
    {
      id: "page-finish-exit",
      route: P,
      page: "finish",
      anchor: "project-finish",
      title: "프로젝트 목록으로",
      body: "«프로젝트 목록으로» 는 저장하고 보드로 나갑니다. 이미 자동 저장되고 있으니 안 누르고 위 띠로 나가도 잃는 것은 없습니다.",
    },
  ],
};

const SETTINGS: Tutorial = {
  id: "page-settings",
  kind: "page",
  page: "settings",
  title: "설정 — 작업 환경",
  summary: "폴더 · API 키 · 작업별 모델 · 생성기 · 엔진 · 로라 · 문구를 정하는 화면입니다. 전부 이 기기에만 저장됩니다.",
  steps: [
    {
      id: "page-settings-profile",
      route: "/settings",
      page: "settings",
      anchor: "settings-profile",
      title: "프롬프트 작성 프로필",
      body: "Claude(긴 글과 판단) 와 GPT(구조와 형식) 카드 중 하나가 «선택됨» 입니다. 아래 API 키와 작업별 모델이 이 선택을 따라갑니다.",
    },
    {
      id: "page-settings-folders",
      route: "/settings",
      page: "settings",
      anchor: "settings-folders",
      title: "폴더",
      body:
        "«기본 저장 폴더» 하나만 정하면 «프롬프트 문구 폴더» 와 «포즈 프리셋 폴더» 는 그 안에서 갈라집니다. 각각 «다른 곳으로» 로 따로 두거나 «기본 자리로» 되돌립니다. 문구 폴더의 md 파일은 앱 밖 편집기로도 고칠 수 있습니다.",
    },
    {
      id: "page-settings-api-keys",
      route: "/settings",
      page: "settings",
      anchor: "settings-api-keys",
      title: "API 키",
      body:
        "Claude · OpenAI 키를 붙여넣고 «저장». 저장한 뒤에는 «저장됨 ···끝 네 자리» 만 보이고 «연결 확인» «지우기» 가 뜹니다. 키는 앱 설정 폴더에 파일로 저장되고 호출도 앱 안에서 합니다. 두 곳 모두 결제 수단 등록이 필요합니다.",
    },
    {
      id: "page-settings-language",
      route: "/settings",
      page: "settings",
      anchor: "settings-language",
      title: "언어 · 튜토리얼",
      body: "한국어(기본) · 영어 · 일본어 · 중국어 중 하나를 고르면 화면 문구와 튜토리얼이 그 언어로 바뀝니다. 튜토리얼은 같은 자리의 스위치로 켜고 끕니다.",
    },
    {
      id: "page-settings-auto-unfold",
      route: "/settings",
      page: "settings",
      anchor: "settings-auto-unfold",
      title: "전개도 자동 6면 커팅",
      body:
        "장소 카드에 6면 전개도가 들어오면 여섯 면을 자동으로 잘라 «6면» 폴더에 한 세트로 저장합니다. 전개도인지는 네 가지(회색 바탕 위 십자 · 여섯 칸 · 칸마다 여러 색 · 네 귀퉁이 빔)를 다 보고 정하고, 애매하면 아무것도 하지 않습니다. 잘못 잘리면 여기서 끄고 가위의 «전개도 6면» 탭에서 직접 자르세요.",
    },
    {
      id: "page-settings-lora",
      route: "/settings",
      page: "settings",
      anchor: "settings-lora",
      title: "로라 (엔진별로 찾고 받기)",
      body:
        "엔진마다 폴더가 갈립니다 — 로라는 학습한 모델에 묶여 있어 엔진이 다르면 로딩이 통째로 실패합니다. 검색 칸에 «dance» «anime style» 처럼 적고 «찾기», 결과에서 «받기». 받아 둔 목록에서 «세기»(1 이 원래) 와 «기본»(따로 고르지 않은 생성에 들어감)을 정합니다. 브라우저로 받은 파일은 «파일 고르기» 로 들이고, Civitai API 키·허깅페이스 토큰을 넣어 두면 로그인이 필요한 것도 앱이 대신 받습니다.",
    },
    {
      id: "page-settings-magnific",
      route: "/settings",
      page: "settings",
      anchor: "settings-magnific",
      title: "마그니픽 (MCP 로 끝까지 뽑기)",
      body:
        "«연결» 을 누르면 브라우저가 열리고 코드를 넣습니다. 연결되면 «한 번에 뽑기» 에 «마그니픽 — 끝까지 뽑기» 가 생깁니다 — 사람 손 없이 인물 시트부터 씬 영상까지, 다만 건당 과금. 여태 쓰던 «생성기를 차려 놓기»(창에서 직접 뽑는 길)는 그대로입니다. «연결 확인» «연결 끊기» 도 여기.",
    },
    {
      id: "page-settings-local",
      route: "/settings",
      page: "settings",
      anchor: "settings-local-engines",
      title: "로컬 모델 (그림·영상·음악)",
      body:
        "이 컴퓨터의 GPU·빈 자리를 읽어 엔진마다 «이 기계에서 됩니다 · 줄이면 됩니다 · 빠듯합니다 · 안 됩니다» 를 판정합니다. «정밀도» 는 자동이 기본. «설치» 는 파이썬 환경을 만들고, 영상 엔진(미니맥스 · 완)은 가중치까지 설치 때 통째로 받으며 나머지는 수십 GB 라 첫 생성 때 받습니다. 이미 깔아 둔 엔진에는 «가중치 미리 받기 (약 N GB)» 단추가 있어 미리 받아 둘 수 있습니다. «제거» 는 그 엔진 폴더만 지웁니다. «워커 내리기» 로 VRAM 을 비웁니다.",
    },
    {
      id: "page-settings-upscale",
      route: "/settings",
      page: "settings",
      anchor: "settings-upscale",
      title: "업스케일 엔진",
      body:
        "«기본 목표 크기» 와 «기본» 엔진을 정하면 가위 편집 창 · 6면 세트 카드 · 파노라마 탭의 «업스케일» 이 그것을 씁니다. ComfyUI 와 무관한 고정 환경이고, 바깥 ComfyUI 워크플로를 «외부 엔진» 으로 잡을 수도 있습니다. «작업 후 워커 유지» 를 켜 두면 다음 장이 빠릅니다.",
    },
    {
      id: "page-settings-docs",
      route: "/settings",
      page: "settings",
      anchor: "settings-prompt-docs",
      title: "가이드 문서 관리",
      body:
        "모델 · 플랫폼 · 기법 · 요청문 네 갈래의 md 문서를 보고 고칩니다. «전체 내보내기» 로 json 한 장에 담고 «불러오기» 로 되살립니다. 앱 기본 문구가 바뀌면 손대지 않은 사본만 자동으로 갈아 끼우고, 고쳐 둔 것은 «기본값으로» 를 눌러야 받습니다.",
    },
    {
      id: "page-settings-task-models",
      route: "/settings",
      page: "settings",
      anchor: "settings-task-models",
      title: "작업별 모델",
      body:
        "«사용할 제공자» 를 고르면 그 제공자의 표가 뜹니다. 작업마다 모델(Sonnet 5 — 균형 · Opus 5 — 품질 우선 · Haiku 4.5 — 빠르고 저렴, GPT-5.6 Terra · Sol · Luna)과 추론 노력(생각 없이 · 조금 · 보통 · 깊이 · 아주 깊이)을 둡니다. 제공자마다 따로 저장되어 바꿔 가며 견줘도 앞 설정이 남습니다. «기본값» 으로 되돌립니다.",
    },
    {
      id: "page-settings-nav",
      route: "/settings",
      page: "settings",
      anchor: "nav-ai-ready",
      title: "위 띠의 «AI 최적화 준비됨»",
      body: "키가 저장되어 있으면 «AI 최적화 준비됨», 없으면 «AI 최적화 필요» 입니다. 카드의 «프롬프트 작성» «이미지 분석» 단추가 이 상태를 따라 켜집니다.",
    },
  ],
};

const BGM: Tutorial = {
  id: "page-bgm",
  kind: "page",
  page: "bgm",
  title: "BGM 프로젝트",
  summary: "Suno · 로컬 MiniMax Music 용 곡 스타일과 가사를 만들고, 뽑은 곡을 곡별로 정리합니다. 영상 프로젝트와 따로 삽니다.",
  steps: [
    {
      id: "page-bgm-project",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-project-add",
      title: "프로젝트 추가 · 지우기",
      body:
        "«프로젝트 추가» 로 이름을 적어 «만들기». 곡은 «<저장 폴더>/BGM/곡/<BGM 프로젝트>/» 에 들어갑니다. 휴지통은 기록만 지우고 음원 파일은 남깁니다 — 다른 컷이 그 곡을 타임라인에 깔고 있을 수 있어서요.",
    },
    {
      id: "page-bgm-track",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-track-add",
      title: "곡 추가",
      body: "왼쪽 목록의 «+ 곡 추가» 로 곡을 만들고 «곡 이름» 과 «어느 장면에 쓸지» 를 적습니다.",
    },
    {
      id: "page-bgm-chips",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-chips",
      title: "분위기 · 장르 · 악기 · 보컬 · «시대 · 질감» · 프로덕션 · 곡 구조",
      body: "칩을 켜면 그 낱말이 그대로 스타일 문장과 가사 틀이 됩니다. «곡 구조» 는 고른 차례대로 구간이 만들어지고, 로컬 모델은 길이(초)보다 이 구간 수를 따릅니다.",
    },
    {
      id: "page-bgm-tempo",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-tempo-length",
      title: "템포 · 길이",
      body: "«템포 (BPM)» «길이 (초)» 는 비우면 자동입니다. 로컬 모델은 가사의 구조 태그가 길이를 정합니다.",
    },
    {
      id: "page-bgm-tool",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-tool",
      title: "생성 도구",
      body: "Suno 처럼 밖에서 뽑는 도구는 여기서 프롬프트까지, 로컬 모델(MiniMax Music 등)은 아래에서 파일까지 나옵니다.",
    },
    {
      id: "page-bgm-instrumental",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-instrumental",
      title: "가사 없는 연주곡",
      body:
        "켜면 가사 없이 연주로만 만들고 «스타일 · 가사 뽑기» 는 구간 태그만 채웁니다. 꺼져 있는데 가사 없이 답이 오면 «연주곡이 아닌데 가사 없이 왔습니다» 알림이 뜹니다 — 그때는 스타일 칸의 «instrumental» 도 지우세요.",
    },
    {
      id: "page-bgm-write",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-write",
      title: "스타일 · 가사 뽑기 · 규칙 조립 · LLM 요청문",
      body:
        "«스타일 · 가사 뽑기» 는 설정에서 고른 모델로 곡 스타일 두 칸과 가사 두 칸을 받습니다(가사는 온 것만 덮어씀). «규칙 조립» 은 API 없이, «LLM 요청문» 은 복사해 밖에서. 이미 적어 둔 것이 있으면 덮어쓸지 묻습니다.",
    },
    {
      id: "page-bgm-panels",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-style-panels",
      title: "곡 스타일 · 가사 · 제외할 스타일",
      body:
        "«곡 스타일 (한글)» «Style (생성기에 넣는 칸)» 과 «가사 (한글)» «Lyrics (생성기에 넣는 칸)» — Suno v6 의 Style(1,000자) · Lyrics(5,000자) 두 칸과 같습니다. 한도를 넘기면 칸 아래에 «뒤가 잘립니다» 가 뜹니다. «제외할 스타일» 은 네거티브가 아니라 Suno 의 Exclude Styles 이고, 로컬 모델에는 «avoid …» 로 붙습니다.",
    },
    {
      id: "page-bgm-history",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-history",
      title: "받아 둔 곡 스타일",
      body: "받거나 조립할 때마다 쌓이고 «되돌리기» 로 앞 판으로 갑니다 — 인물·장소 카드와 같은 선반입니다.",
    },
    {
      id: "page-bgm-local",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-local-generate",
      title: "로컬 모델로 바로 뽑기",
      body:
        "«생성 도구» 에서 로컬 모델을 골랐고 설치되어 있으면 «바로 뽑기» 가 켜집니다. 영문 스타일과 가사를 보내고(태그 어휘가 영어), 곡은 «작업» 서랍의 줄에 서서 몇 분 뒤 아래 목록에 파일로 옵니다.",
    },
    {
      id: "page-bgm-tracks",
      route: "/bgm",
      page: "bgm",
      anchor: "bgm-tracks-list",
      title: "뽑은 곡 목록",
      body: "곡마다 재생기와 «목록에서 뺍니다(폴더의 파일은 그대로 둡니다)» 단추가 있습니다. 여기 있는 곡을 구도잡기 «노래» 칸의 «BGM에서 고르기» 가 그대로 씁니다.",
    },
    {
      id: "page-bgm-to-planner",
      route: "/bgm",
      page: "bgm",
      title: "뮤직비디오로 이어 가기",
      body:
        "곡을 타임라인에 올리는 자리는 구도잡기 «타임라인» 탭의 «노래» 칸입니다. 거기서 «노래 길이로» 타임라인을 맞추고 구간을 나누면, 그 경계가 «레퍼런스 영상» 나눠 뽑기의 자르는 자리가 됩니다.",
    },
  ],
};

export const PAGE_TUTORIALS: Tutorial[] = [PROJECTS, BASICS, CHARACTERS, SCENES, FINISH, SETTINGS, BGM];
