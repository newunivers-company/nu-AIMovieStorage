/**
 * Rust 가 쓸 링커가 제대로 잡혔는지 확인합니다.
 *
 * # 왜 이게 필요한가
 *
 * Git Bash 에는 `link` 라는 리눅스 도구가 들어 있습니다 (하드링크를 만드는
 * coreutils 명령). 이름이 MSVC 링커와 똑같습니다.
 *
 * Git Bash 에서 이 앱을 빌드하면 `C:\Program Files\Git\usr\bin` 이 PATH 앞쪽에
 * 있어서 Rust 가 그 엉뚱한 `link.exe` 를 집습니다. 그러면 크레이트 600개를
 * 다 컴파일한 다음에야 «extra operand» 라는 알 수 없는 오류가 쏟아집니다.
 * 진짜 원인은 저 한 줄인데, 그걸 알아채기까지 로그를 한참 봐야 합니다.
 *
 * 그래서 **컴파일을 시작하기 전에** 여기서 막습니다.
 */
import { execSync } from "node:child_process";

let found = "";
try {
  found = execSync("where link", { encoding: "utf8" }).split(/\r?\n/)[0].trim();
} catch {
  found = "";
}

const wrong = /[\\/]Git[\\/]usr[\\/]bin[\\/]link\.exe$/i.test(found);

if (!found || wrong) {
  console.error("");
  console.error("  ✗ Rust 링커가 잘못 잡혔습니다.");
  console.error("");
  if (wrong) {
    console.error(`    지금 잡힌 것: ${found}`);
    console.error("    이건 MSVC 링커가 아니라 Git Bash 에 들어 있는 리눅스 도구입니다.");
    console.error("    이름만 같습니다.");
  } else {
    console.error("    link.exe 를 찾지 못했습니다. Visual Studio 빌드 도구 설정이 안 됐습니다.");
  }
  console.error("");
  console.error("  → Git Bash 나 PowerShell 말고 cmd 에서 실행하세요.");
  console.error("");
  console.error("      Win+R → cmd → 엔터");
  console.error("      cd /d %~dp0..");
  console.error("      pnpm dev:desktop");
  console.error("");
  process.exit(1);
}

console.log(`  링커 확인: ${found}`);
