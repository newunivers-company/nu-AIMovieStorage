fn main() {
  // 판(edition)은 `option_env!("FRAMEFORGE_EDITION")` 로 컴파일 때 굳습니다. cargo 는 환경 변수가
  // 바뀐 것을 스스로 모르므로 여기서 알려야 합니다 — 안 그러면 공개판을 만든 직후 비공개판을
  // 빌드해도 «바뀐 게 없다» 고 지난 실행 파일을 그대로 씁니다.
  println!("cargo:rerun-if-env-changed=FRAMEFORGE_EDITION");
  tauri_build::build()
}
