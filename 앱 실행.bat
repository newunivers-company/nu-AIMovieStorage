@echo off
chcp 65001 >nul
rem ===========================================================================
rem  AI 영상 스토리지 — 바로 실행
rem
rem  이 파일을 두 번 누르면 앱이 뜹니다. 바탕화면에 두고 쓰시려면 이 파일을
rem  오른쪽 클릭 → «바로 가기 만들기» 한 뒤 그 바로 가기를 바탕화면으로 옮기세요.
rem  (파일 자체를 옮기면 프로젝트 폴더를 못 찾습니다 — %~dp0 가 이 파일의 자리를 씁니다.)
rem
rem  **빌드해 둔 실행 파일이 있으면 그것을 띄웁니다.** 예전에는 늘 개발 서버
rem  (`pnpm dev:desktop`)로 띄웠는데, 그러면 검은 창을 닫으면 앱도 꺼지고 처음 한 번은
rem  Rust 를 컴파일하느라 몇 분씩 걸렸습니다. 빌드본은 곧바로 뜨고 창도 남지 않습니다.
rem  `pnpm build:desktop` 을 한 번 돌리면 그 실행 파일이 생깁니다.
rem ===========================================================================

cd /d "%~dp0"

set "APP=%~dp0src-tauri\target\release\frameforge.exe"

if exist "%APP%" (
  echo.
  echo   AI 영상 스토리지를 띄웁니다...
  echo   %APP%
  echo.
  start "" "%APP%"
  exit /b 0
)

rem ── 빌드본이 없을 때만 개발 서버로 ────────────────────────────────────────
title AI 영상 스토리지 — 개발 서버로 실행 중 (이 창을 닫으면 앱도 꺼집니다)

echo.
echo   빌드해 둔 실행 파일이 없어 개발 서버로 띄웁니다.
echo   한 번 "pnpm build:desktop" 을 돌려 두면 다음부터 곧바로 뜹니다.
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo   [!] pnpm 을 찾지 못했습니다.
  echo       Node.js 를 설치한 뒤 "corepack enable" 을 한 번 실행해 주세요.
  echo.
  pause
  exit /b 1
)

call pnpm dev:desktop

echo.
if errorlevel 1 (
  echo   [!] 앱이 오류로 멈췄습니다. 위의 빨간 글을 확인해 주세요.
  echo       «Port 3000 is already in use» 라면 앱이 이미 떠 있거나
  echo       지난번 창이 남아 있는 것입니다.
) else (
  echo   앱을 닫았습니다.
)
pause
