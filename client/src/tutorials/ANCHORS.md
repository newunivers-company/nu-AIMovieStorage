# 튜토리얼 앵커 — `data-tour="…"` 를 어디에 다는가

튜토리얼 걸음(`full.ts` · `pages.ts` · `planner.ts`)의 `anchor` 값과 화면 요소를 잇는 표입니다.
화면 쪽은 표의 요소에 `data-tour="<앵커>"` 속성을 달기만 하면 됩니다. 이름은 여기와 자료가
**한 글자도 다르면 안 됩니다** — `tutorials.test.ts` 가 «걸음이 부르는 앵커 ⊆ 이 표» 와
«이 표의 앵커 ⊆ 걸음이 부르는 앵커» 를 양쪽으로 셉니다. 표의 첫 칸(`` `앵커` ``)만 읽으므로
설명 칸은 자유롭게 고쳐도 됩니다.

줄 번호는 2026-09-22 기준 «그 언저리» 입니다 — 다른 작업이 파일을 고치면 밀립니다. 요소는 **문구로**
찾으세요(단추 이름 · `title=` · `aria-label=` 을 그대로 적어 두었습니다).

규칙:

- 목록 안에 같은 요소가 여럿이면(인물 패널 · 컷 카드 · 장면 줄) **모든 것**에 같은 앵커를 달아도
  됩니다. 띄우는 쪽이 첫 번째 것을 잡습니다.
- 접이식 안에 있는 요소(«수치 입력 · 색», «위치 · 회전 숫자»)는 접혀 있으면 못 잡습니다 — 접이식의
  **머리 단추**에 다세요.
- 같은 조건에서 하나만 그려지는 두 요소(빈 상태의 «첫 캐릭터 추가하기» 와 목록 끝의 «캐릭터 추가»)는
  둘 다에 다세요.
- `settings-language` 는 «언어» 와 «튜토리얼» 두 Section 을 싸는 `div` 하나에 답니다 — 걸음 «언어 · 튜토리얼» 이
  둘을 한 번에 가리킵니다. 앵커를 못 찾는 걸음은 가운데 카드로 뜹니다(`TutorialOverlay` 가 그렇게 물러납니다).

## 전역 띠 (`client/src/components/GlobalNav.tsx` · `TaskQueuePanel.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `nav-settings` | `GlobalNav.tsx` | 위 띠 항목 map 의 «설정» 단추 — `item.path === "/settings"` (L41-80) |
| `nav-ai-ready` | `GlobalNav.tsx` | «AI 최적화 준비됨 / 필요» 칩 `<span>` (L91) |
| `nav-tasks` | `TaskQueuePanel.tsx` | 위 띠의 «작업» 단추 — `title="돌고 있는 일과 기다리는 일"` (L90) |

## 프로젝트 보드 (`client/src/pages/ProjectsPage.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `projects-stats` | `ProjectsPage.tsx` | 요약 숫자 네 칸을 싸는 `div.flex.items-center.gap-6` (L192) |
| `projects-new` | `ProjectsPage.tsx` | 오른쪽 위 «새 프로젝트» `Button` (L160); 빈 상태 «첫 프로젝트 만들기» (L268) 에도 |
| `projects-search` | `ProjectsPage.tsx` | `placeholder="프로젝트 검색..."` 입력칸 (L206) |
| `projects-grid` | `ProjectsPage.tsx` | 카드 그리드/목록 컨테이너 `div` (L246, `viewMode === "grid" ? "grid …" : "flex …"`) |
| `projects-card-hide` | `ProjectsPage.tsx` | 카드 안 숨기기 단추 `aria-label="… 숨기기"` (`EyeOff`, L300) — 카드마다 달아도 됨 |
| `projects-hidden` | `ProjectsPage.tsx` | «숨긴 프로젝트 (N)» 펼치기 단추 (L339) |
| `projects-reload` | `ProjectsPage.tsx` | `aria-label="폴더 다시 읽기"` 단추 (L232) |

## 프로젝트 껍데기 (`client/src/pages/NewProjectPage.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `project-progress` | `NewProjectPage.tsx` | 전역 프로그래스 바 — `STEPS.map` 을 싸는 `div` (L548 언저리) |
| `project-next` | `NewProjectPage.tsx` | 하단 «다음» 단추 (L696) |
| `project-finish` | `NewProjectPage.tsx` | 마지막 단계의 «프로젝트 목록으로» 단추 (L677) |

## 주제 설정 (`client/src/components/project/StepBasics.tsx` · `ProjectBootstrapDialog.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `basics-bootstrap` | `StepBasics.tsx` | «AI 로 일괄 생성» — 빈 상태 `section` (L112) 과 접힌 단추 (L142) 둘 다 |
| `basics-info` | `StepBasics.tsx` | `<Panel title="작품 정보">` 뿌리 (L165) — Panel 에 `data-tour` 를 넘기거나 싸는 `div` |
| `basics-title` | `StepBasics.tsx` | «제목» 입력칸 `placeholder="수화의 숲"` (L173) |
| `basics-genre` | `StepBasics.tsx` | «장르» 칩 Panel (L248) |
| `basics-style` | `StepBasics.tsx` | «비주얼 스타일» 칩 Panel (L256) |
| `basics-era` | `StepBasics.tsx` | `<Panel title="시대 배경">` (L263) |
| `basics-preview` | `StepBasics.tsx` | `<Panel title="프롬프트에 이렇게 들어갑니다">` (L346) |
| `bootstrap-scenario` | `ProjectBootstrapDialog.tsx` | «시나리오 · 설정 · 기획안» textarea (L257) |
| `bootstrap-mode` | `ProjectBootstrapDialog.tsx` | «어떻게 넣을까요» 블록 — «이미 있는 것에 덧붙이기 / 비우고 새로» (L381) |
| `bootstrap-run` | `ProjectBootstrapDialog.tsx` | «만들기 / 다시 만들기» 단추 (L586); «상세만 다시 만들기» 는 그 옆 (L567). «카드마다 프롬프트 자세히 쓰기 (4/4)» 체크(L638)도 같은 아래 띠라 4/4 걸음이 이 앵커를 같이 씁니다 |

## 캐릭터 (`client/src/components/project/*` · `client/src/components/*`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `characters-add` | `StepCharacters.tsx` | 목록 끝 «캐릭터 추가» (L269); 빈 상태 «첫 캐릭터 추가하기» (L127) 에도 |
| `character-panel` | `EntityLineagePanel.tsx` | 인물 패널 뿌리 `<section>` (파일 앞부분, 이름 줄을 싸는 것) — 첫 패널만 잡혀도 됨 |
| `character-variation` | `LineageTree.tsx` | 원본 카드 아래 «이 카드에서 변형» 단추 (L371) |
| `character-sheet-compose` | `EntityLineagePanel.tsx` | «캐릭터 시트 제작» 단추 (L402; 배경이면 «배경 시트 제작») |
| `card-references` | `PromptCardBody.tsx` | 머리 왼쪽 레퍼런스 스트립 — `ReferenceImageUploader` 를 싸는 칸 (L260 언저리) |
| `card-basics` | `StepCharacters.tsx` | 이름·역할·형태·성별·키·체격 `Field` 들을 싸는 2열 grid (L673) |
| `card-analysis` | `PromptCardBody.tsx` | «이미지 분석» 제목 줄 `div.flex` (L457-463) |
| `card-profile` | `CharacterProfilePanel.tsx` | «특징 정하기» 단추 (L133) |
| `card-blueprint` | `BlueprintTogglePanel.tsx` | 구성 판 뿌리 — «캐릭터 레퍼런스 구성» 제목이 있는 상자 (L194) |
| `card-prompt-write` | `PromptCardBody.tsx` | «프롬프트 작성» 단추 (L780) |
| `card-first-reference` | `PromptCardBody.tsx` | «첫 레퍼런스 프롬프트» 접이식 머리 (L1266) |
| `card-compose` | `PromptResultPanels.tsx` | 프롬프트 칸의 «구성» 단추 (L169) — 한글 칸 것에 달면 첫 번째로 잡힘 |
| `card-generated-images` | `GeneratedImageShelf.tsx` | «생성 결과 이미지» 선반 뿌리 (L277 제목이 든 상자) |
| `card-image-crop` | `ImageActions.tsx` | 가위 `ActionButton corner="crop"` — `label="… 에서 칸 잘라내기"` (L135) |

## 씬 구성 (`client/src/components/project/*` · `MagnificInboxPanel.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `scenes-add` | `StepScenes.tsx` | 목록 끝 «장면 추가» (L148); 빈 상태 «첫 장면 추가하기» (L117) 에도 |
| `scene-summary` | `StepScenes.tsx` | 장면 요약 textarea `placeholder="이 장면에서 무슨 일이 일어나는지"` (L274) |
| `scene-cut-add` | `StepScenes.tsx` | «컷 추가» 단추 (L357) |
| `scene-storyboard` | `SceneStoryboard.tsx` | «스토리보드» 제목 줄 (L382) 을 싸는 상자 |
| `scene-storyboard-make` | `SceneStoryboard.tsx` | «스토리보드 만들기 / 다시 만들기» 단추 (L412) |
| `cut-open-planner` | `CutCard.tsx` | 머리줄 «구도잡기» 단추 (L1311) |
| `cut-import-composition` | `CutCard.tsx` | «구도 불러오기» 단추 (L1330) |
| `cut-frame` | `CutCard.tsx` | 펼친 컷의 프레임 그림 상자 — «구도를 잡으면 프레임이 붙습니다» 가 뜨는 곳 (L1433 언저리) |
| `cut-switches` | `CutCard.tsx` | «구도 쓰기» «레퍼런스 영상 쓰기» 스위치 줄 `div.flex.flex-wrap` (L1478-1489 의 두 스위치를 싸는 것) |
| `cut-summary` | `CutCard.tsx` | «구도에서 읽음» 상자 (L1539) |
| `cut-refs` | `CutCard.tsx` | «캐릭터 / 배경 / 레퍼런스» 탭 묶음을 싸는 `div` (탭 라벨 L1712-1722) |
| `cut-style-toggles` | `CutStyleToggles.tsx` | 연출 칩 판 뿌리 — 그룹은 스타일 · 촬영 · 조명 · 색감 · «질감 · 실사» (`lib/cutStyle.ts`); CutCard 에서 부르는 자리 L1846 |
| `cut-dialogue` | `CutCard.tsx` | «대사 · 연기 지시» 제목이 든 블록 (L1862) |
| `cut-prompt-section` | `CutPromptSection.tsx` | «컷 프롬프트» 제목 줄 `div.flex.flex-wrap` (L68) |
| `cut-prompt-write` | `CutPromptSection.tsx` | «프롬프트 작성» 단추 (L100) |
| `cut-video-section` | `CutVideoSection.tsx` | «영상 프롬프트» 제목 줄 `div.flex.flex-wrap` (L72-74) |
| `cut-video-prompt` | `CutVideoSection.tsx` | «영상 프롬프트» 단추 (L122) |
| `cut-ref-video-list` | `CutVideoSection.tsx` | «구도잡기에서 뽑은 영상 (N)» 목록 상자 (L198) |
| `inbox-panel` | `MagnificInboxPanel.tsx` | 후보함 머리 — «마그니픽에서 온 것 N개 …» 줄 (L253) |

## 확인 (`client/src/components/project/StepFinish.tsx` · `BatchGeneratePanel.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `finish-counts` | `StepFinish.tsx` | 인물·장소·컷·스토리보드·영상 다섯 칸을 싸는 줄 (L125-148) |
| `finish-batch` | `BatchGeneratePanel.tsx` | «한 번에 뽑기» 판 뿌리 (L74 제목이 든 상자) |
| `finish-scene-row` | `StepFinish.tsx` | 장면마다 한 줄 — 첫 장면 블록 (L180 언저리, «인쇄» 단추가 있는 상자) |
| `finish-print` | `StepFinish.tsx` | «인쇄» 단추 (L205) |
| `finish-scene-video` | `StepFinish.tsx` | `label="씬 영상 — 밖에서 뽑아 온 것도 여기로"` 의 `CutVideoShelf` (L233) |
| `finish-cut-videos` | `StepFinish.tsx` | «컷 영상 N개» 상자 (L259) |

## 설정 (`client/src/pages/SettingsPage.tsx`)

`Section` 부품에 `data-tour` 를 넘길 수 있게 하거나(`{...rest}`), Section 을 싸는 `div` 에 답니다.

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `settings-profile` | `SettingsPage.tsx` | `<Section title="프롬프트 작성 프로필">` (L409) |
| `settings-folders` | `SettingsPage.tsx` | `<Section title="폴더">` (L458) |
| `settings-base-folder` | `SettingsPage.tsx` | «기본 저장 폴더» `FolderRow` (L459-461) |
| `settings-api-keys` | `SettingsPage.tsx` | `<Section title="API 키">` (L492) |
| `settings-language` | `SettingsPage.tsx` | «언어» + «튜토리얼» 두 Section 을 싸는 `div.space-y-4` — 프롬프트 작성 프로필 바로 아래 |
| `settings-auto-unfold` | `SettingsPage.tsx` | `<Section title="전개도 자동 6면 커팅">` (L606) |
| `settings-lora` | `SettingsPage.tsx` | `<Section title="로라 (엔진별로 찾고 받기)">` (L647) |
| `settings-magnific` | `SettingsPage.tsx` | `<Section title="마그니픽 (MCP 로 끝까지 뽑기)">` (L651) |
| `settings-local-engines` | `SettingsPage.tsx` | `<Section title="로컬 모델 (그림·영상·음악)">` (L655) |
| `settings-upscale` | `SettingsPage.tsx` | `<Section title="업스케일 엔진">` (L660) |
| `settings-prompt-docs` | `SettingsPage.tsx` | `<Section title="가이드 문서 관리">` (L908) |
| `settings-task-models` | `SettingsPage.tsx` | `<Section title="작업별 모델">` (L912) |

## BGM (`client/src/pages/BgmProjectsPage.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `bgm-project-add` | `BgmProjectsPage.tsx` | «프로젝트 추가» 단추 (L518) |
| `bgm-track-add` | `BgmProjectsPage.tsx` | «+ 곡 추가» 단추 (L600) |
| `bgm-chips` | `BgmProjectsPage.tsx` | 칩 묶음 — «분위기» `ChipGroup` 부터 «곡 구조» 까지를 싸는 `div` (L711-751); 없으면 «분위기» 것에 |
| `bgm-tempo-length` | `BgmProjectsPage.tsx` | «템포 (BPM)» · «길이 (초)» 줄 (L767-790) |
| `bgm-tool` | `BgmProjectsPage.tsx` | «생성 도구» 라벨이 든 칸 (L806) |
| `bgm-instrumental` | `BgmProjectsPage.tsx` | «가사 없는 연주곡» 스위치 라벨 (L849) |
| `bgm-write` | `BgmProjectsPage.tsx` | «스타일 · 가사 뽑기» 단추 (L949) |
| `bgm-style-panels` | `BgmProjectsPage.tsx` | «곡 스타일 (한글) / Style» 두 칸 `PromptResultPanels` 을 싸는 상자 (L995) |
| `bgm-history` | `BgmProjectsPage.tsx` | `title="받아 둔 곡 스타일"` 의 `PromptHistoryShelf` (L1076) |
| `bgm-local-generate` | `BgmProjectsPage.tsx` | «바로 뽑기 / 줄에 섰습니다» 단추 (L1122) |
| `bgm-tracks-list` | `BgmProjectsPage.tsx` | 뽑은 곡 목록 상자 — «목록에서 뺍니다» 단추가 든 곳 (L1140 언저리) |

## 구도잡기 — 껍데기 (`client/src/components/CompositionPlanner.tsx` · `composition/planner/PlannerChrome.tsx` · `ShotBar.tsx` · `CameraBar.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `planner-header` | `PlannerChrome.tsx` | 머리줄 `div` — «구도 잡기» 글자가 든 줄 (L100-108) |
| `planner-undo` | `PlannerChrome.tsx` | `title="되돌리기 (Ctrl+Z)"` 단추 (L121) |
| `planner-ratio-chips` | `PlannerChrome.tsx` | «3D 배치» + 비율 칩 줄 (L181-205) |
| `planner-tabs` | `PlannerChrome.tsx` | «배치 / 환경 / 타임라인» 탭 띠 — `PANEL_TABS.map` 을 싸는 `div` (L236) |
| `planner-viewport` | `CompositionPlanner.tsx` | 3D 화면(`CompositionViewport`)을 싸는 `div` (L700 언저리) |
| `planner-ground-place` | `PlannerChrome.tsx` | «바닥에 세우기» 단추 (L362) |
| `planner-floor-toggle` | `PlannerChrome.tsx` | «바닥면» 단추 (L415) |
| `planner-save` | `PlannerChrome.tsx` | «구도 저장» 단추 (L429) |
| `planner-camera-hint` | `PlannerChrome.tsx` | `CameraHelpHint` — «화면에서 눌러 고르기 · 왼쪽 끌기 회전 …» 안내 (L572) |
| `planner-shot-save` | `ShotBar.tsx` | «지금 구도 저장» 단추 (L92) |
| `planner-camera-fov` | `CameraBar.tsx` | «샷 크기 — 렌즈 화각» 줄 (L72) |
| `planner-camera-speed` | `CameraBar.tsx` | «조작 속도 — 회전·이동·줌» 줄 (L127) |

## 구도잡기 — 배치 탭 (`composition/planner/LayoutPanel.tsx` 외)

포즈 판 둘(`PosePanel.tsx` · `PoseFromImageField.tsx`)은 `planner/` 가 아니라 **한 칸 위 `components/composition/`** 에 있습니다 — 파일 칸에 경로를 그대로 적어 두었습니다.

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `layout-characters` | `LayoutPanel.tsx` | `<PanelSection title="인물">` (L314) |
| `layout-character-fields` | `LayoutPanel.tsx` | 고른 인물의 «인물 이름 · 키 (cm) · 체격» 칸 (L482) |
| `layout-body-color` | `LayoutPanel.tsx` | «몸 색» 줄 (L560) |
| `layout-gizmo-mode` | `GizmoModeRow.tsx` | «수치 입력» 줄 — 이동·회전·크기 / 자유·바닥·높이 (L28) |
| `layout-path` | `LayoutPanel.tsx` | «캐릭터 동선 (N)» 줄 (L664) |
| `layout-objects` | `LayoutPanel.tsx` | `<PanelSection title="소품 · 조명">` (L753) |
| `layout-object-kinds` | `LayoutPanel.tsx` | 벽·박스·구·실린더·핀 조명·LED 조명 2열 단추 grid (L773) |
| `layout-object-group` | `ObjectList.tsx` | «함께 잡은 N개를 한 덩어리로» 단추 (L182) — 여럿 잡았을 때만 뜸 |
| `layout-object-swap` | `LayoutPanel.tsx` | «무엇으로 바꿔 그릴까 — 만들어 둔 시트» 라벨이 든 칸 (L900) |
| `layout-object-asset` | `LayoutPanel.tsx` | «이 소품의 에셋 만들기 — 시트를 뽑아 바로 잇습니다» 단추 (L958) |
| `layout-attach-bone` | `LayoutPanel.tsx` | «인물에 붙이기 — 포즈를 따라 함께 움직입니다» 칸 (L981) |
| `layout-light` | `LayoutPanel.tsx` | 조명 종류(하늘·포인트·스팟·면광)·세기·색 칸 (L1096-1125) |
| `layout-wall-image` | `LayoutPanel.tsx` | «이 벽의 그림» 칸 (L1157) |
| `layout-pose-from-image` | `composition/PoseFromImageField.tsx` | «그림에서 포즈 가져오기» 상자 (L100) |
| `layout-joints` | `composition/PosePanel.tsx` | «관절을 고르면 3D 화면에 기즈모가 붙습니다» 안내가 든 관절 판 (L137) |
| `layout-hands` | `composition/PosePanel.tsx` | «손 모양» 판 — 왼손/오른손 토글 2열 grid (L330); 그 아래 «현재 각도 (Y / Z°)» 표와 «이 손 전체 펴기» (L385-405). 내장 손 프리셋·폄/반/접음은 없습니다 |
| `layout-presets` | `composition/PosePanel.tsx` | «내 프리셋» 제목 줄 (L599) |
| `layout-mocap-cleanup` | `MotionCleanupPanel.tsx` | «모캡 키 다듬기» 판 뿌리 (L124) — 모션을 넣은 인물에서만 뜸 |
| `bone-picker` | `BonePicker.tsx` | 파이 메뉴 뿌리 (L120 «한 걸음 뒤로 / 닫기» 단추가 든 상자) — Tab 을 눌렀을 때만 뜸 |

## 구도잡기 — 환경 탭 (`composition/planner/EnvironmentPanel.tsx` · `RoomList.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `env-room-add-indoor` | `RoomList.tsx` | «실내» 단추 (L114); «실외» (L123) «호리존» (L138) 은 같은 줄 |
| `env-room-list` | `RoomList.tsx` | 방 목록 `div` — 방 이름 줄들을 싸는 것 (L170 언저리) |
| `env-room-size` | `EnvironmentPanel.tsx` | 가로·깊이·층고(또는 반지름) 숫자 칸 줄 (L498-540) |
| `env-horizon-color` | `EnvironmentPanel.tsx` | «호리존 색» 줄 (L561) — 호리존 방에서만 |
| `env-outdoor-shape` | `EnvironmentPanel.tsx` | «무엇으로 두를까» — 돔/방형 (L625) — 실외 방에서만 |
| `env-occlude-faces` | `EnvironmentPanel.tsx` | «뒤를 가릴 면 — 누른 면만 벽이 됩니다» (L659) — 실내 방에서만 |
| `env-room-make-image` | `EnvironmentPanel.tsx` | «전개도 만들기 / 파노라마 만들기» 단추 (L789) |
| `env-panoramas` | `EnvironmentPanel.tsx` | «파노라마 그림» 접이 머리 (L816) — 실외 방에서만 |
| `env-face-sets` | `EnvironmentPanel.tsx` | «6면 세트» 접이 머리 (L934) — 실내 방에서만 |
| `env-room-props` | `EnvironmentPanel.tsx` | «이 방의 소품» 제목 줄 (L1038) |
| `env-room-library` | `EnvironmentPanel.tsx` | `<PanelSection title="방 라이브러리">` (L256); «장소 라이브러리» 단추는 바로 위 (L245) |
| `env-display` | `EnvironmentPanel.tsx` | `<PanelSection title="화면">` (L333) |

## 구도잡기 — 타임라인 탭 (`composition/planner/TimelinePanel.tsx` · `MusicSection.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `timeline-music` | `MusicSection.tsx` | `<PanelSection title="노래">` (L127) |
| `timeline-music-pick` | `MusicSection.tsx` | «BGM에서 고르기 — 뽑아 둔 곡» select (L144) 와 «음원 올리기» 단추 (L162) 를 싸는 줄 |
| `timeline-music-sections` | `MusicSection.tsx` | «빠르기 · 마디씩 · 구간 나누기 · N초에서 자르기» 줄 (L231-279) |
| `timeline-mocap-open` | `TimelinePanel.tsx` | «영상 올려서 캐릭터에 모션 입히기» 단추 (L176) |
| `timeline-glb` | `TimelinePanel.tsx` | `<PanelSection title="GLB 애니메이션">` (L186) |
| `timeline-blender-prompt` | `TimelinePanel.tsx` | «블렌더 작업 지시문 만들기» 단추 (L219) |
| `timeline-render` | `TimelinePanel.tsx` | `<PanelSection title="레퍼런스 영상">` (L470) |
| `timeline-render-split` | `TimelinePanel.tsx` | 통째로 · 5초 · … · 노래 N구간 선택 줄 (L490-523) |
| `timeline-render-run` | `TimelinePanel.tsx` | «● 레퍼런스 영상 만들기 (MP4)» 단추 (L572) |
| `timeline-renders-list` | `TimelinePanel.tsx` | «뽑아 둔 영상 N편 — 누르면 이 컷이 그것을 씁니다» 목록 (L586) |

## 구도잡기 — 화면 아래 타임라인 (`composition/planner/MoveTimeline.tsx` · `TimelineRoomRows.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `bottom-timeline` | `MoveTimeline.tsx` | 펼친 판의 뿌리 `div` (L905 언저리, «접기» 단추가 걸친 상자) |
| `bottom-play` | `MoveTimeline.tsx` | «재생 / 멈춤» 단추 — 접힌 줄 (L873) 과 펼친 줄 (L1190) 둘 다 |
| `bottom-collapse` | `MoveTimeline.tsx` | `title="타임라인을 아래로 접기 (Ctrl+Space) …"` 단추 (L927) |
| `bottom-duration` | `MoveTimeline.tsx` | `title="타임라인 총 길이를 정합니다"` 단추 (L1619) |
| `bottom-fps` | `MoveTimeline.tsx` | `title="초당 프레임 수를 정합니다"` 단추 («24f», L1641) |
| `bottom-shot-presets` | `MoveTimeline.tsx` | 무빙 아이콘 가로 줄 — `SHOT_PRESETS.map` 을 싸는 `div.composition-scroll` (L1442) |
| `bottom-clip-start` | `MoveTimeline.tsx` | 클립 왼쪽 «이어서 / 구도 없음» 출발 구도 select (L2210) — 첫 클립 것 |
| `bottom-anchor` | `MoveTimeline.tsx` | 앵커 X/Y/Z · 따라가기 · 손으로 · 「앵커: …」 묶음 (L1220-1410) |
| `bottom-clip-amount` | `MoveTimeline.tsx` | 고른 클립의 «이동량» 칸 (L1804) |
| `bottom-clip-length` | `MoveTimeline.tsx` | 고른 클립의 «길이» 칸 (L1840); «+ 키 전부» 는 그 옆 (L1886) |
| `bottom-axis` | `MoveTimeline.tsx` | «축: 수평/수직/나선» · «앵커 보기» · «앵커 표시» · «손떨림» 묶음 (L1940-2037) |
| `bottom-easing` | `MoveTimeline.tsx` | «속도 그래프» 단추 (L2095) |
| `bottom-layers` | `MoveTimeline.tsx` | «인물 · 소품» 레이어 묶음 — `gutterStyle` 의 「인물 · 소품」 라벨이 든 블록 (L2523) |
| `bottom-room-rows` | `TimelineRoomRows.tsx` | «방 · 가릴 면 · 소품» 라벨(`gutterStyle`)이 든 블록 (L104) |

## 구도잡기 — 영상에서 모션 가져오기 창 (`composition/planner/MotionCaptureDialog.tsx`)

| 앵커 | 파일 | 요소 (줄 힌트) |
| --- | --- | --- |
| `mocap-add-video` | `MotionCaptureDialog.tsx` | «영상 추가» 단추 (L807) |
| `mocap-analyze` | `MotionCaptureDialog.tsx` | «1 · 분석» 제목이 든 블록 (L897) |
| `mocap-cleanup` | `MotionCaptureDialog.tsx` | «2 · 다듬기» 블록 (L1012) — 분석이 끝난 뒤에만 뜸 |
| `mocap-match` | `MotionCaptureDialog.tsx` | «3 · 번호 ↔ 캐릭터 (N명)» 블록 (L1068) — 분석이 끝난 뒤에만 뜸 |
| `mocap-apply` | `MotionCaptureDialog.tsx` | «타임라인에 넣기» 단추 (L1158) |
