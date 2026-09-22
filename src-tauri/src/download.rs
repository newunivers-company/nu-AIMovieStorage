//! **파일 하나를 안전하게 받는 한 벌** — 이어받기 · 크기·sha256 확인 · 제자리로 옮기기.
//!
//! # 왜 한 벌인가
//!
//! 점검에서, 엔진 가중치(`upscale.rs`)와 로라(`lora.rs`)가 **받는 코드를 따로**
//! 들고 있는 것을 찾았습니다. 엔진 쪽에는 그동안 겪은 사고가 전부 반영돼 있었지만
//! (이어받기, 416 되짚기, 다 받고 끊긴 임시 파일, 해시 확인) 로라 쪽에는 **하나도** 없었습니다.
//! 로라는 파일 하나가 수 GB 라, 90% 에서 끊기면 처음부터 다시 받아야 했습니다.
//!
//! 두 곳이 다른 것은 «진행을 어디로 알리는가» 뿐이라, 그것만 함수로 받습니다.
//!
//! # 반쪽짜리 파일을 원래 자리에 만들지 않습니다
//!
//! 받는 동안에는 `<이름>.내려받는중` 에 씁니다. 중간에 앱이 꺼져 조각이 남아도 목록에는
//! 안 뜨고(확장자가 다릅니다), 다음에 **이어받습니다.** 다 받아 크기·해시를 확인한 뒤에야
//! 제 이름이 됩니다.

use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};

use crate::{err, Res};

/// 받는 동안 쓰는 이름의 꼬리.
///
/// **목록을 만드는 쪽이 이 상수를 봐야 합니다.** 예전에 로라는 꼬리를 `.받는중` 으로
/// 따로 정해 두고 목록도 그 글자로 걸렀는데, 받는 코드를 한 벌로 모으며 꼬리가 바뀌면
/// 목록 거르개가 조용히 헛돌아 **반쪽짜리 파일이 목록에 뜹니다**(고르면 로딩 실패).
/// 두 곳이 같은 상수를 보면 그럴 일이 없습니다.
pub const PARTIAL_SUFFIX: &str = "내려받는중";

/// 받다 만 조각인가. 목록을 만들 때 이것으로 거릅니다.
pub fn is_partial(file_name: &str) -> bool {
    file_name.ends_with(&format!(".{PARTIAL_SUFFIX}"))
}

/// 진행을 알리는 간격. 조각마다 알리면 화면이 그리다 지칩니다.
const REPORT_EVERY: Duration = Duration::from_millis(400);

/// 받을 것 하나.
pub struct Download<'a> {
    pub url: &'a str,
    /// 다 받으면 놓일 자리. 부모 폴더는 여기서 만듭니다.
    pub dest: &'a Path,
    /// 사람에게 보일 이름(오류 문구에 들어갑니다).
    pub label: &'a str,
    pub expected_sha: Option<&'a str>,
    pub expected_size: Option<u64>,
    /// 401·403 일 때 대신 띄울 안내. 없으면 상태 코드만 알립니다.
    ///
    /// Civitai 는 일부 로라에 로그인을 요구하는데, «받지 못했습니다» 만 띄우면
    /// 사람은 네트워크 탓인 줄 압니다.
    pub login_hint: Option<&'a str>,
    /// 함께 보낼 `Authorization: Bearer …` 값(Civitai API 키·허깅페이스 토큰).
    ///
    /// 로그인은 사람이 매번 하는 것이 아니라 앱이 대신 붙입니다. Civitai 는 상당수 로라를 로그인한
    /// 계정에만 내주는데, 프로그램에 허용된 로그인은 API 키뿐입니다. 설정에 한 번 넣어 두면
    /// 받을 때마다 여기로 붙습니다. 값은 오류 문구·로그에 절대 안 적습니다.
    pub bearer: Option<String>,
}

/// 진행 상황 한 번.
pub struct Beat {
    /// 0~100. 서버가 크기를 안 알려 주면 None.
    pub percent: Option<f64>,
    pub written: u64,
    pub total: Option<u64>,
    /// 해시를 확인하는 중이면 true — 이때는 받는 것이 아니라 읽는 중입니다.
    pub verifying: bool,
}

pub fn human(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 {
        format!("{:.1} GB", bytes as f64 / 1024.0 / 1024.0 / 1024.0)
    } else if bytes >= 1024 * 1024 {
        format!("{} MB", bytes / 1024 / 1024)
    } else {
        format!("{} KB", bytes / 1024)
    }
}

fn sha256_of(path: &Path) -> Res<String> {
    let mut file = fs::File::open(path).map_err(|e| err("파일을 열지 못했습니다", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|e| err("파일을 읽지 못했습니다", e))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn partial_path(dest: &Path) -> std::path::PathBuf {
    dest.with_file_name(format!(
        "{}.{PARTIAL_SUFFIX}",
        dest.file_name().and_then(|n| n.to_str()).unwrap_or("파일")
    ))
}

/// 다 받은 임시 파일을 확인하고 제자리로 옮깁니다(크기 → 해시 → 이름 바꾸기).
///
/// 받는 자리와 따로 떼어 둔 이유: «크기는 이미 맞는데 확인 전에 끊긴» 임시 파일이 있을 때
/// 이어받기를 건너뛰고 바로 이 단계로 오기 위해서입니다(아래 416 설명).
fn finish(spec: &Download, temp: &Path, beat: &impl Fn(Beat)) -> Res<()> {
    let label = spec.label;
    if let Some(size) = spec.expected_size {
        let got = fs::metadata(temp).map(|m| m.len()).unwrap_or(0);
        if got != size {
            let _ = fs::remove_file(temp);
            return Err(format!("{label} 의 크기가 다릅니다({got} ≠ {size}). 다시 시도해 주세요."));
        }
    }
    if let Some(expected) = spec.expected_sha {
        beat(Beat { percent: None, written: 0, total: None, verifying: true });
        let actual = sha256_of(temp)?;
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = fs::remove_file(temp);
            return Err(format!("{label} 의 sha256 이 다릅니다. 받다 망가졌거나 원본이 바뀌었습니다."));
        }
    }
    // 덮어쓸 것이 있으면 먼저 치웁니다(윈도우는 존재하는 자리로 rename 이 실패합니다).
    // 여기서는 선삭제가 안전합니다 — dest 는 앱이 받아 둔 파일이지 사람이 만든 그림이 아닙니다.
    let _ = fs::remove_file(spec.dest);
    fs::rename(temp, spec.dest).map_err(|e| err(&format!("{label} 을(를) 제자리에 놓지 못했습니다"), e))
}

/// 파일 하나를 받습니다. 받다 만 것이 있으면 이어받고, 다 받으면 크기·해시를 확인한 뒤
/// 제자리로 옮깁니다. 중간에 끊겨도 원래 자리에는 반쪽짜리가 생기지 않습니다.
///
/// `stop` 이 true 를 돌려주면 그 자리에서 멈춥니다 — 받다 만 것은 **남겨 둡니다**(다음에 이어받게).
pub async fn fetch(
    spec: Download<'_>,
    beat: impl Fn(Beat),
    stop: impl Fn() -> bool,
) -> Res<()> {
    use futures_util::StreamExt;

    let label = spec.label;
    if let Some(parent) = spec.dest.parent() {
        fs::create_dir_all(parent).map_err(|e| err("받을 폴더를 만들지 못했습니다", e))?;
    }

    // 이미 제자리에 있고 크기가 맞으면 건너뜁니다(다시 설치해도 16GB 를 또 받지 않게).
    if let Ok(meta) = fs::metadata(spec.dest) {
        if spec.expected_size.map(|size| meta.len() == size).unwrap_or(meta.len() > 0) {
            return Ok(());
        }
    }

    let temp = partial_path(spec.dest);
    let mut have = fs::metadata(&temp).map(|m| m.len()).unwrap_or(0);
    // 이미 받은 것이 목표보다 크면 딴 파일입니다 — 버리고 처음부터.
    if let Some(size) = spec.expected_size {
        if have > size {
            let _ = fs::remove_file(&temp);
            have = 0;
        }
        /*
          «다 받았는데 확인·이름 바꾸기 전에 끊긴» 임시 파일.

          예전에는 이때도 `Range: bytes=<크기>-` 를 보냈고, 서버는 416 을 돌려줬습니다.
          오류로 끝나면서 임시 파일은 그대로 남으니 **다시 설치해도 매번 같은 416** 이라,
          앱 데이터 폴더에서 손으로 지우기 전에는 그 엔진을 깔 길이 없었습니다.
          크기가 이미 맞으면 요청을 아예 보내지 말고 확인·이름 바꾸기로 넘어갑니다.
        */
        if have == size && have > 0 {
            return finish(&spec, &temp, &beat);
        }
    }

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| err("HTTP 클라이언트를 만들지 못했습니다", e))?;
    // 416(이어받을 자리가 서버가 아는 크기를 넘음)은 오류로 두지 않고 «임시 파일을 버리고
    // 처음부터» 로 **한 번만** 되짚습니다. 크기를 미리 모르는 항목(vosr 의 dinov2 zip)은
    // 위의 `have == size` 갈래로 걸러지지 않아 여기가 유일한 탈출구입니다.
    let mut restarted = false;
    let response = loop {
        let mut request = client.get(spec.url);
        if have > 0 {
            request = request.header(reqwest::header::RANGE, format!("bytes={have}-"));
        }
        // 키가 있으면 매 요청(이어받기 포함)에 붙입니다 — 되짚어 다시 보낼 때 빠지면 두 번째부터 401 입니다.
        if let Some(token) = spec.bearer.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
            request = request.header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"));
        }
        let response = request
            .send()
            .await
            .map_err(|e| err(&format!("{label} 을(를) 받지 못했습니다"), e))?;
        let status = response.status();
        if status.as_u16() == 416 && have > 0 && !restarted {
            let _ = fs::remove_file(&temp);
            have = 0;
            restarted = true;
            continue;
        }
        if !status.is_success() {
            let code = status.as_u16();
            return Err(match (code, spec.login_hint) {
                (401 | 403, Some(hint)) => hint.to_string(),
                _ => format!("{label} 을(를) 받지 못했습니다 ({status})."),
            });
        }
        break response;
    };
    let status = response.status();
    // 이어받기를 요청했는데 서버가 전체를 주면(206 이 아니면) 처음부터 다시 씁니다.
    let resuming = have > 0 && status.as_u16() == 206;
    if have > 0 && !resuming {
        have = 0;
    }
    let total = response.content_length().map(|len| len + have).or(spec.expected_size);

    let mut file = if resuming {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .open(&temp)
            .map_err(|e| err("이어받을 파일을 열지 못했습니다", e))?;
        file.seek(SeekFrom::Start(have))
            .map_err(|e| err("이어받을 자리를 찾지 못했습니다", e))?;
        file
    } else {
        fs::File::create(&temp).map_err(|e| err("받을 파일을 만들지 못했습니다", e))?
    };

    let mut written = have;
    let mut last_report = Instant::now();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if stop() {
            let _ = file.flush();
            return Err("멈췄습니다. 받다 만 파일은 다음에 이어받습니다.".into());
        }
        let chunk = chunk.map_err(|e| err(&format!("{label} 을(를) 받는 중 끊겼습니다"), e))?;
        file.write_all(&chunk).map_err(|e| err("받은 것을 쓰지 못했습니다", e))?;
        written += chunk.len() as u64;
        if last_report.elapsed() >= REPORT_EVERY {
            last_report = Instant::now();
            beat(Beat {
                percent: total.map(|t| (written as f64) * 100.0 / (t.max(1) as f64)),
                written,
                total,
                verifying: false,
            });
        }
    }
    file.flush().map_err(|e| err("받은 것을 쓰지 못했습니다", e))?;
    drop(file);

    finish(&spec, &temp, &beat)
}
