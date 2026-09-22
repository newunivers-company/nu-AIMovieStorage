//! **API 키와 LLM 호출** — 2026-09-18 에 `lib.rs` 에서 떼어 냈습니다.
//!
//! 브라우저에서 직접 부르면 API 키가 개발자 도구에 그대로 보이고, 제공사 서버가 CORS 로
//! 막습니다. 키는 앱 설정 폴더에 두고 호출도 여기서 합니다.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::{ensure_dir, err, safe_name, LockSafe, Res};

// ─────────────────────────────────────────────────────────────────────────────
// API 키
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    /// 키가 저장돼 있는지.
    saved: bool,
    /// 확인용 꼬리 네 글자. 어느 키를 넣었는지 사람이 알아보기 위한 것입니다.
    hint: Option<String>,
}

/// 키를 두는 자리.
///
/// localStorage 에 두면 개발자 도구에서 그대로 보입니다. 앱 설정 폴더의
/// 파일이라 완벽하진 않지만, 적어도 화면에 노출되지도 프로젝트 폴더에
/// 딸려 가지도 않습니다.
pub fn key_file(provider: &str) -> Res<PathBuf> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "설정 폴더를 찾지 못했습니다.".to_string())?
        .join("ai-video-storage");
    ensure_dir(&dir)?;
    Ok(dir.join(format!("{}.key", safe_name(provider))))
}

#[tauri::command]
pub fn save_api_key(provider: String, key: String) -> Res<()> {
    let path = key_file(&provider)?;
    fs::write(&path, key.trim()).map_err(|e| err("키를 저장하지 못했습니다", e))
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Res<()> {
    let path = key_file(&provider)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(err("키를 지우지 못했습니다", e)),
    }
}

#[tauri::command]
pub fn get_api_key_status(provider: String) -> Res<ApiKeyStatus> {
    let path = key_file(&provider)?;
    match fs::read_to_string(&path) {
        Ok(key) => {
            let key = key.trim();
            /*
              **글자 단위로 자릅니다.** 2026-09-18 점검: `key[key.len() - 4..]` 는
              **바이트** 슬라이싱이라, 끝이 멀티바이트인 키(사람이 실수로 한글을 붙여넣은
              경우 포함)에서 글자 경계가 아니면 **패닉**합니다. 설정 화면을 여는 것만으로
              앱이 죽습니다.
            */
            let hint = if key.chars().count() >= 4 {
                Some(key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect())
            } else {
                None
            };
            Ok(ApiKeyStatus {
                saved: !key.is_empty(),
                hint,
            })
        }
        Err(_) => Ok(ApiKeyStatus {
            saved: false,
            hint: None,
        }),
    }
}

pub(crate) fn read_api_key(provider: &str) -> Res<String> {
    let path = key_file(provider)?;
    let key = fs::read_to_string(&path)
        .map_err(|_| format!("{provider} API 키가 저장돼 있지 않습니다."))?;
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err(format!("{provider} API 키가 비어 있습니다."));
    }
    Ok(key)
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM 호출
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmImage {
    media_type: String,
    /// base64 로 인코딩된 그림. 앞의 `data:...;base64,` 는 떼고 옵니다.
    data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    /// "claude" 또는 "openai"
    provider: String,
    model: String,
    /// 생각을 얼마나 깊게 할지. "low" | "medium" | "high"
    effort: Option<String>,
    system: Option<String>,
    prompt: String,
    #[serde(default)]
    images: Vec<LlmImage>,
    #[serde(default)]
    max_tokens: Option<u32>,
    /// 요청문 중 **늘 같은 앞부분**. 있으면 여기에 캐시 표를 답니다.
    fixed_prompt: Option<String>,
    /// 몇 초까지 기다릴지. 안 주면 180초.
    #[serde(default)]
    timeout_secs: Option<u64>,
    /// 화면이 붙인 요청 id. 주면 cancel_llm 으로 중간에 끊을 수 있습니다.
    #[serde(default)]
    request_id: Option<String>,
}

/// 진행 중인 LLM 요청의 «중지» 손잡이. request_id 별로 하나. 신호를 보내면 select! 가
/// 요청 future 를 버리고, reqwest 는 연결을 닫습니다.
static LLM_CANCELS: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashMap<String, tokio::sync::oneshot::Sender<()>>>,
> = std::sync::OnceLock::new();

pub fn llm_cancels() -> &'static std::sync::Mutex<std::collections::HashMap<String, tokio::sync::oneshot::Sender<()>>> {
    LLM_CANCELS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

/**
 * **이번 요청에 쓴 양.** 제공사가 답에 함께 실어 줍니다.
 *
 * 2026-09-19 에 붙였습니다. 여태 얼마를 쓰는지 **아무 데도 안 남았습니다** — 어디가 비싼지
 * 알려면 파일 크기를 세어 짐작하는 수밖에 없었습니다. 측정이 없으면 줄일 곳도 못 고릅니다.
 *
 * 캐시 두 칸을 따로 둡니다. 캐시는 **쓸 때 1.25배, 읽을 때 0.1배** 라 셈이 전혀 달라서,
 * 한 칸에 합치면 「캐시가 실제로 먹고 있나」 를 볼 수가 없습니다.
 */
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LlmUsage {
    pub request_id: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    /// 캐시에서 읽은 입력 토큰(싸게 먹힌 몫).
    pub cache_read_tokens: u64,
    /// 캐시에 새로 써 넣은 입력 토큰(조금 비싸게 먹힌 몫).
    pub cache_write_tokens: u64,
}

/**
 * 쓴 양을 읽어 **두 제공사를 같은 모양으로** 맞춥니다.
 *
 * # 두 곳이 «입력» 을 다르게 셉니다 — 여기서 안 맞추면 값이 틀립니다
 *
 * - **Claude**: `input_tokens` 는 **캐시를 뺀** 나머지입니다. 캐시는 따로 옵니다.
 * - **OpenAI**: `input_tokens` 가 **전체**이고, 그중 캐시로 먹은 몫이
 * `input_tokens_details.cached_tokens` 에 **겹쳐서** 들어 있습니다.
 *
 * 2026-09-21 사용자의 화면에서 잡혔습니다 — 캐시를 5,823 읽은 요청과 하나도 안 읽은 요청의
 * 추정 요금이 **똑같이 $0.041** 이었습니다. OpenAI 것을 그대로 더해서, 캐시로 싸게 먹은
 * 몫을 **정가로 한 번 + 캐시값으로 한 번** 두 번 세고 있었습니다. 싸진 것이 화면에 안
 * 나타나니 「캐시가 먹는데도 값이 그대로」 로 보입니다.
 *
 * 그래서 OpenAI 쪽은 **겹친 몫을 빼서** 내보냅니다. 이 뒤로는 어느 제공사든
 * `input_tokens` = 「정가로 낸 입력」 하나로 읽으면 됩니다.
 */
fn read_usage(json: &serde_json::Value, claude: bool, id: &str, model: &str) -> LlmUsage {
    let u = &json["usage"];
    let num = |key: &str| u[key].as_u64().unwrap_or(0);
    let input = num("input_tokens");
    let cache_read = if claude {
        num("cache_read_input_tokens")
    } else {
        u["input_tokens_details"]["cached_tokens"]
            .as_u64()
            .unwrap_or(0)
    };
    LlmUsage {
        request_id: id.to_string(),
        model: model.to_string(),
        // OpenAI 는 캐시가 input 에 겹쳐 있으므로 뺍니다. 음수가 안 나게 saturating.
        input_tokens: if claude {
            input
        } else {
            input.saturating_sub(cache_read)
        },
        output_tokens: num("output_tokens"),
        cache_read_tokens: cache_read,
        // OpenAI 는 «캐시에 쓴 몫» 을 따로 청구하지도, 알려 주지도 않습니다(자동 캐시).
        cache_write_tokens: if claude { num("cache_creation_input_tokens") } else { 0 },
    }
}

/// 토막 사이의 가름줄.
///
/// 프런트의 `SEAM`(`lib/llmRequestText.ts`)과 **같아야 합니다.** 캐시를 태우려고 요청문을
/// 둘로 갈라 보내는데, 이어 붙인 글이 화면의 「LLM 요청문」과 한 글자라도 다르면 API 로 간
/// 결과와 손으로 붙여넣은 결과를 견줄 수가 없습니다.
const SEAM: &str = "\n\n---\n\n";

/// OpenAI 가 `prompt_cache_key` 를 받아 주는가. 400 을 한 번 맞으면 꺼집니다.
static CACHE_KEY_OK: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

fn cache_key_allowed() -> bool {
    CACHE_KEY_OK.load(std::sync::atomic::Ordering::Relaxed)
}

/// 늘 같은 앞부분의 지문. 앞부분이 같은 요청끼리 같은 열쇠를 받습니다.
fn fingerprint_of(text: &str) -> String {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in text.trim().as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    format!("ff-{hash:08x}")
}

// ─────────────────────────────────────────────────────────────────────────────
// 배경 모드 — 앱이 닫혀도 답을 이어 받기
// ─────────────────────────────────────────────────────────────────────────────

/*
  

  여태는 답을 기다리는 HTTP 연결 하나가 전부였습니다. 앱이 닫히면 연결이 끊기고, 제공사는
  답을 끝까지 만들어 **요금은 그대로** 청구하는데 우리는 받을 길이 없었습니다. 그래서 작업 줄은
  «처음부터 다시» 보냈고 — 630초짜리 2단계면 그 시간과 값을 통째로 두 번 냈습니다.

  OpenAI Responses API 에는 **배경 모드**가 있습니다. `background: true` 로 보내면 곧바로
  `{id, status: "queued"}` 만 돌려주고, 답은 서버가 제 쪽에서 만듭니다. 우리는 그 id 로
  `GET /v1/responses/{id}` 를 2초마다 물어 `completed` 가 되면 여느 답과 **같은 모양**으로 받습니다.
  id 만 남겨 두면 앱을 껐다 켜도 이어 받을 수 있습니다(`llm_resume`). 화면은 id 를 `llm-started`
  로 받아 작업 줄에 적어 둡니다(`taskQueue.withResumableLlm`).

  Claude 에는 낱개 메시지에 이런 길이 없어 예전처럼 다시 보냅니다.
*/

/// 배경 모드 답의 `status` 를 읽고 **다음에 할 일**을 정합니다. 순수 함수 — 아래 시험이 이걸 봅니다.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum BackgroundStep {
    /// 아직 만드는 중 — 2초 뒤 다시 묻습니다.
    Wait,
    /// 끝났습니다 — `output` 을 여느 답처럼 읽습니다.
    Done,
    /// 서버가 포기했습니다 — 오류로 돌립니다.
    Failed,
}

pub fn background_step(status: Option<&str>) -> BackgroundStep {
    match status {
        Some("queued") | Some("in_progress") => BackgroundStep::Wait,
        /*
          `incomplete` 도 **끝난 것**으로 읽습니다. 답이 `max_output_tokens` 에 걸리면 이 상태로
          끝나는데, 받은 데까지의 `output` 은 들어 있습니다. 화면 쪽 `parseJsonResponse` 가 잘린 JSON
          에서 받은 데까지 건지는 것이 이 답을 전제로 합니다 — 여기서 오류로 돌리면 인물 열 명 중 아홉이
          멀쩡히 적힌 답을 통째로 버립니다(2026-09-18 에 실제로 겪은 모양).
        */
        Some("completed") | Some("incomplete") => BackgroundStep::Done,
        Some("failed") | Some("cancelled") => BackgroundStep::Failed,
        // 상태 칸이 없으면 배경 모드가 아닌 옛 모양의 답 — 예전처럼 바로 읽습니다.
        None => BackgroundStep::Done,
        // 모르는 상태는 기다려 봐야 끝이 없습니다 — 오류로 드러내는 편이 낫습니다.
        Some(_) => BackgroundStep::Failed,
    }
}

/// **묻기(GET) 한 번의 HTTP 상태 → 다음 할 일.** 순수 함수 — 아래 시험이 이걸 봅니다.
///
/// 2026-09-22 검토: 예전에는 GET 한 번이 429 나 5xx 로 튕기면 요청 전체를 실패로 돌렸습니다 — 몇 분째 만들던
/// 답을 «지금 몰렸다» 한 번에 통째로 버리고, 서버는 답을 끝까지 만들어 요금은 그대로 나가는 모양입니다.
/// 못 물은 것은 못 물은 것일 뿐입니다. 끝은 시간 제한(`deadline`)이 냅니다.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum PollStep {
    /// 답을 받았습니다 — 본문을 `background_step` 으로 넘깁니다.
    Read,
    /// 이번 한 번은 못 물었을 뿐(429·5xx·408·네트워크) — 물러섰다 다시 묻습니다.
    Wait,
    /// 서버에 그 답이 없습니다(404) — 기다려 봐야 소용없어 처음부터 다시 보냅니다(`RESUME_GONE`).
    Gone,
    /// 다시 물어도 같을 오류(그 밖의 4xx — 키가 죽었거나 id 모양이 틀림) — 실패로 돌리고 서버 쪽 일도 끊습니다.
    Fail,
}

pub fn poll_step(status: Option<u16>) -> PollStep {
    match status {
        // 상태 코드조차 못 받은 것(연결·시간 초과) — 서버가 아니라 길이 막힌 것이라 다시 묻습니다.
        None => PollStep::Wait,
        Some(code) if (200..300).contains(&code) => PollStep::Read,
        Some(404) => PollStep::Gone,
        Some(408) | Some(425) | Some(429) => PollStep::Wait,
        Some(code) if code >= 500 => PollStep::Wait,
        Some(_) => PollStep::Fail,
    }
}

/// 몇 초마다 물을까. 더 잦으면 요청만 늘고, 더 뜸하면 짧은 답이 괜히 늦습니다.
const POLL_SECS: u64 = 2;
/// 첫 물음은 보내자마자 — 짧은 답(키 확인·한 줄 답)은 2초를 다 기다릴 것 없이 그 자리에서 끝납니다(2026-09-22 검토).
const FIRST_POLL_MS: u64 = 250;
/// 못 물었을 때 물러서는 상한. 몰린 서버를 더 두드리면 더 튕깁니다.
const POLL_BACKOFF_MAX_SECS: u64 = 30;

/// **이번에는 얼마나 기다렸다 물을까** — 몇 번째 물음(`polls`)과 잇달아 못 물은 수(`misses`)로. 순수 함수.
pub fn poll_delay(polls: u32, misses: u32) -> std::time::Duration {
    if misses > 0 {
        // 2·4·8·16·30초 — 튕길수록 물러섭니다.
        return std::time::Duration::from_secs((POLL_SECS << (misses - 1).min(4)).min(POLL_BACKOFF_MAX_SECS));
    }
    if polls == 0 {
        std::time::Duration::from_millis(FIRST_POLL_MS)
    } else {
        std::time::Duration::from_secs(POLL_SECS)
    }
}

/// 400 본문이 **«이 인자를 모른다»** 인가 — `background`·`prompt_cache_key` 를 한 번만 배우고 끄는 자리가 같이 씁니다. 순수 함수.
///
/// 예전에는 본문에 그 낱말이 들어 있기만 하면 잡았습니다(`text.contains`). 그러면 「background 그림이 너무 큽니다」 같은
/// 엉뚱한 400 한 번에 배경 모드가 영영 꺼져 그 뒤로는 이어 받기가 안 됩니다(2026-09-22 검토). OpenAI 는 모르는 인자를
/// `error.param` 에 적어 주고, 말도 「Unknown parameter: 'background'」 꼴이라 그 모양만 봅니다.
pub fn rejects_parameter(body: &str, name: &str) -> bool {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(body) else {
        return false;
    };
    let error = &json["error"];
    if error["param"].as_str() == Some(name) {
        return true;
    }
    let message = error["message"].as_str().unwrap_or("");
    if !message.contains(&format!("'{name}'")) {
        return false;
    }
    let code = error["code"].as_str().unwrap_or("");
    matches!(code, "unknown_parameter" | "unsupported_parameter")
        || message.starts_with("Unknown parameter")
        || message.starts_with("Unsupported parameter")
}

/// OpenAI 가 `background` 를 받아 주는가. 400 을 한 번 맞으면 꺼집니다(`CACHE_KEY_OK` 와 같은 모양).
static BACKGROUND_OK: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

fn background_allowed() -> bool {
    BACKGROUND_OK.load(std::sync::atomic::Ordering::Relaxed)
}

/// 요청 하나의 **서버 쪽 형편.** «중지» 가 서버 쪽 일까지 끊으려면 알아야 합니다 — 폴링만 그만두면 우리는 못 받는데
/// 요금은 끝까지 나옵니다.
enum Background {
    /// 보내는 중 — 응답 id 가 아직 없습니다.
    Sending,
    /// id 가 생기기 **전에** «중지» 가 왔습니다. 보내는 POST 는 끊지 않고 두었다가(끊으면 id 를 영영 몰라 서버가 답을
    /// 끝까지 만들고 요금을 매깁니다 — 2026-09-22 검토) id 가 생기는 순간 그 자리에서 끊습니다(`background_started`).
    CancelRequested,
    /// 응답 id 가 생겼습니다 — 끊으려면 이 id 로 `POST …/cancel`.
    Started(String),
}

static BACKGROUNDS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, Background>>> =
    std::sync::OnceLock::new();

fn backgrounds() -> &'static std::sync::Mutex<std::collections::HashMap<String, Background>> {
    BACKGROUNDS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

/// 이어 받을 답이 서버에 없을 때의 **말머리 — ASCII 한 낱말.** 프런트(`promptRequest.isLlmResumeGone`)가 같은 낱말로 가려
/// 처음부터 다시 보냅니다. 사람이 읽는 까닭은 뒤에 붙습니다 — 우리말 문장을 양쪽에 두 벌 적어 두면 한쪽만 고쳐 어긋납니다.
pub const RESUME_GONE: &str = "RESUME_GONE";

/// «중지» 로 끝난 요청의 오류 말. 프런트(`promptRequest.isLlmCancel`)가 이 말로 «실패가 아니라 중지» 를 가립니다.
const CANCELLED: &str = "중지했습니다.";

/// 화면에 알리는 «응답 id 가 생겼다». 작업 줄이 받아 적어 두면 앱을 껐다 켜도 이어 받습니다.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LlmStarted {
    pub request_id: String,
    pub response_id: String,
}

/// `llm_resume` 의 입력 — 보내지 않고 **묻기만** 합니다.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResumeRequest {
    /// 지금은 "openai" 만. Claude 는 이어 받을 길이 없습니다.
    provider: String,
    response_id: String,
    /// 요금표에 맞출 모델 이름(요청할 때 고른 것). 답에 실린 이름은 날짜가 붙은 판이라 표와 안 맞습니다.
    #[serde(default)]
    model: Option<String>,
    /// 몇 초까지 기다릴지. 처음 보낼 때와 같은 값을 줍니다 — 같은 시간 규칙.
    #[serde(default)]
    timeout_secs: Option<u64>,
    /// 화면이 붙인 요청 id(API 기록의 job id). 주면 cancel_llm 으로 끊고, 쓴 양도 이 id 로 돌아갑니다.
    #[serde(default)]
    request_id: Option<String>,
}

/// 응답 id 가 생겼습니다 — 적어 두고 화면에 알립니다(`llm-started`). 그새 «중지» 가 와 있었으면 알리지 않고 서버 쪽을
/// 바로 끊은 뒤 참을 돌려줍니다 — 부르는 쪽은 그것으로 «중지했습니다» 를 냅니다.
fn background_started(app: &tauri::AppHandle, request_id: &str, response_id: &str) -> bool {
    {
        let mut map = backgrounds().lock_safe();
        if matches!(map.get(request_id), Some(Background::CancelRequested)) {
            map.remove(request_id);
            drop(map);
            spawn_cancel(response_id.to_string());
            return true;
        }
        map.insert(request_id.to_string(), Background::Started(response_id.to_string()));
    }
    use tauri::Emitter as _;
    let _ = app.emit(
        "llm-started",
        LlmStarted {
            request_id: request_id.to_string(),
            response_id: response_id.to_string(),
        },
    );
    false
}

/// 보내기가 id 없이 끝났습니다(오류·400) — 무엇이 적혀 있든 지웁니다. 남겨 두면 다음 «중지» 가 엉뚱한 것을 봅니다.
fn background_forget(request_id: &str) {
    backgrounds().lock_safe().remove(request_id);
}

/// 요청이 끝났습니다 — 적어 둔 응답 id 를 지웁니다. «중지» 깃발은 남깁니다: 아직 돌고 있는 보내기가 그것을 보고 지웁니다.
fn background_finished(request_id: &str) {
    let mut map = backgrounds().lock_safe();
    if matches!(map.get(request_id), Some(Background::Started(_))) {
        map.remove(request_id);
    }
}

/// «중지» — 응답 id 를 알면 바로 끊고, 아직 보내는 중이면 깃발만 세웁니다(id 가 생기는 순간 `background_started` 가 끊습니다).
/// 답을 기다리지 않습니다 — «중지» 는 바로 돌아와야 합니다.
fn cancel_background_of(request_id: &str) {
    let mut map = backgrounds().lock_safe();
    match map.remove(request_id) {
        Some(Background::Started(response_id)) => {
            drop(map);
            spawn_cancel(response_id);
        }
        Some(Background::Sending) | Some(Background::CancelRequested) => {
            map.insert(request_id.to_string(), Background::CancelRequested);
        }
        // Claude 나 배경 모드가 아닌 요청 — 서버 쪽에 끊을 것이 없습니다. 연결을 놓는 것(select!)이 끊는 전부입니다.
        None => {}
    }
}

fn spawn_cancel(response_id: String) {
    tauri::async_runtime::spawn(async move {
        let _ = cancel_openai_by_id(&response_id).await;
    });
}

/// 응답 id 하나로 서버 쪽 일을 끊습니다 — «중지» 와 `llm_cancel_response` 가 같은 것을 씁니다.
async fn cancel_openai_by_id(response_id: &str) -> Res<()> {
    let key = read_api_key("openai")?;
    let client = build_client(30)?;
    cancel_openai_response(&client, &key, response_id).await
}

// ─────────────────────────────────────────────────────────────────────────────
// 명령
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn call_llm(app: tauri::AppHandle, request: LlmRequest) -> Res<String> {
    let id = request.request_id.clone();
    with_cancel(id, call_llm_inner(&app, request)).await
}

/// 앱을 껐다 켠 뒤 — 이미 보낸 요청의 답을 **묻기만** 합니다. 파싱·시간 규칙은 `call_llm` 과 같습니다.
#[tauri::command]
pub async fn llm_resume(app: tauri::AppHandle, request: LlmResumeRequest) -> Res<String> {
    let id = request.request_id.clone();
    with_cancel(id, resume_inner(&app, request)).await
}

/// 진행 중인 LLM 요청을 끊습니다. 이미 끝났거나 모르는 id 면 false.
#[tauri::command]
pub fn cancel_llm(request_id: String) -> Res<bool> {
    let sender = llm_cancels().lock_safe().remove(&request_id);
    Ok(sender.map(|tx| tx.send(()).is_ok()).unwrap_or(false))
}

/// 줄에서 **시작 전에 뺀** 일의 답을 끊습니다 — 요청 id 는 이미 없고 응답 id 만 남은 자리(`taskQueue.stopTask`).
/// 이미 끝난 답이면 서버가 거절하는데, 그것은 실패가 아닙니다.
#[tauri::command]
pub async fn llm_cancel_response(response_id: String) -> Res<()> {
    cancel_openai_by_id(&response_id).await
}

/// «중지» 손잡이를 달고 돌립니다 — `call_llm` 과 `llm_resume` 이 **같은 것**을 씁니다.
///
/// 요청이 제공사 서버에 닿는 순간 요금은 발생합니다. 그래도 «중지» 는 있어야 합니다 —
/// 여러 개를 한꺼번에 돌리다 3분 타임아웃까지 빙글빙글 도는 단추를 사용자가 끌 수 없었습니다
/// (2026-09-08). 뮤텍스 가드는 await 를 넘기지 않습니다(비동기 명령은 Send 여야 함).
async fn with_cancel<F>(request_id: Option<String>, work: F) -> Res<String>
where
    F: std::future::Future<Output = Res<String>>,
{
    let rx = request_id.as_ref().map(|id| {
        let (tx, rx) = tokio::sync::oneshot::channel::<()>();
        // 자물쇠에 독이 묻어도 이어 갑니다 — 안 넣으면 그 요청은 «중지» 가 안 먹습니다.
        llm_cancels().lock_safe().insert(id.clone(), tx);
        rx
    });
    let result = match rx {
        Some(rx) => tokio::select! {
            res = work => res,
            _ = rx => {
                // 배경 모드면 서버 쪽 일도 끊습니다 — 폴링만 버리면 답은 못 받는데 요금은 끝까지 나옵니다.
                if let Some(id) = request_id.as_deref() {
                    cancel_background_of(id);
                }
                Err(CANCELLED.to_string())
            }
        },
        None => work.await,
    };
    if let Some(id) = &request_id {
        llm_cancels().lock_safe().remove(id);
        background_finished(id);
    }
    result
}

// ─────────────────────────────────────────────────────────────────────────────
// 실제 요청
// ─────────────────────────────────────────────────────────────────────────────

/// 시간 제한을 반드시 겁니다.
///
/// 없으면 답이 안 오는 요청 하나가 화면의 버튼을 영영 «확인 중…» 에 묶어 둡니다. 실제로 그렇게
/// 몇 분씩 멈춰 있었습니다. 끊어지면 적어도 «왜 안 되는지» 를 보여 줄 수 있습니다.
/// 배경 모드에서는 이 값이 요청 하나하나(보내기·묻기)의 한도이고, 전체 한도는 `deadline` 이 따로 봅니다.
fn build_client(timeout_secs: u64) -> Res<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| err("HTTP 클라이언트를 만들지 못했습니다", e))
}

fn send_error(provider: &str, e: reqwest::Error) -> String {
    if e.is_timeout() {
        format!("{provider} 서버가 제때 답하지 않았습니다. 네트워크나 방화벽을 확인해 주세요.")
    } else {
        err("요청을 보내지 못했습니다", e)
    }
}

/// 실제 요청. 보내고, OpenAI 면 끝날 때까지 묻고, 답 글자를 돌려줍니다.
pub async fn call_llm_inner(app: &tauri::AppHandle, request: LlmRequest) -> Res<String> {
    let key = read_api_key(&request.provider)?;
    let claude = request.provider == "claude";
    let timeout = request.timeout_secs.unwrap_or(180);
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(timeout);
    let client = build_client(timeout)?;

    // 추론 노력 → 실제 설정.
    //
    // 예전에는 이 값을 두 제공사에 **그대로 흘려보냈습니다.** 그래서
    // - OpenAI 는 "none" 을 모르는 모델에서 400 을 냈고,
    // - Claude 는 아예 안 읽어서 «깊이» 로 두어도 아무 일도 안 일어났습니다.
    // 요금과 직결되는 값이라 여기서 제공사별로 옮겨 줍니다.
    let effort = match request.effort.as_deref().unwrap_or("low") {
        value @ ("none" | "low" | "medium" | "high" | "xhigh") => value,
        // 화면에 없는 값이 저장돼 있을 수 있습니다. 모르는 것은 가운데로.
        _ => "medium",
    };
    // 생각에 쓰는 토큰. 0 이면 생각 없이 갑니다.
    let thinking_budget: u32 = match effort {
        "none" => 0,
        "low" => 1024,
        "medium" => 4096,
        "high" => 12000,
        // 아주 깊이. 요청한 단계입니다.
        // 요금이 크게 오르므로 기본값으로 두지 않습니다.
        "xhigh" => 24000,
        _ => 1024,
    };

    // 답으로 받을 최대 토큰.
    //
    // OpenAI 는 16 미만이면 400 입니다. 그리고 «생각» 도 이 한도 안에서
    // 쓰이기 때문에, 생각을 깊게 시킬수록 여유를 더 줘야 답이 잘리지 않습니다.
    let requested = request.max_tokens.unwrap_or(4096);
    let max_tokens = requested.max(16).max(thinking_budget + 1024);

    let body = if claude {
        let mut content = vec![];
        for image in &request.images {
            content.push(serde_json::json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image.media_type,
                    "data": image.data,
                }
            }));
        }
        /*
          ── 앞부분은 캐시에 얹습니다 ──────────────────────────────────
          이 앱은 **같은 글을 되풀이해 보냅니다** — 컷 예순두 개를 뽑으면 템플릿·공통규칙·
          기법 문서가 글자 하나 안 바뀌고 예순두 번 다시 갑니다(「국호」 실측 입력 토큰 115만).
          앞 조각에 표를 달아 두면 두 번째부터 **입력 요금의 0.1배**로 읽힙니다.

          **너무 짧으면 달지 않습니다.** 캐시에는 최소 길이가 있고(모델마다 1024~2048 토큰),
          못 미치면 제공사가 그냥 무시하거나 오류를 냅니다. 한국어는 글자당 토큰이 더 드는데,
          여기서는 **보수적으로 글자 수로** 재서 확실할 때만 답니다 — 캐시를 못 타는 것은
          손해가 없지만, 오류로 요청이 죽으면 그 요청은 통째로 못 씁니다.
        */
        const CACHE_MIN_CHARS: usize = 6000;
        match request.fixed_prompt.as_deref().map(str::trim) {
            Some(fixed) if fixed.chars().count() >= CACHE_MIN_CHARS => {
                content.push(serde_json::json!({
                    "type": "text",
                    "text": fixed,
                    "cache_control": { "type": "ephemeral" },
                }));
                content.push(serde_json::json!({ "type": "text", "text": request.prompt }));
            }
            Some(fixed) => {
                // 짧으면 예전처럼 한 덩어리로. 이어 붙인 글은 한 글자도 안 달라집니다.
                content.push(serde_json::json!({
                    "type": "text",
                    "text": format!("{fixed}{SEAM}{}", request.prompt),
                }));
            }
            None => {
                content.push(serde_json::json!({ "type": "text", "text": request.prompt }));
            }
        }

        let mut payload = serde_json::json!({
            "model": request.model,
            "max_tokens": max_tokens,
            "messages": [{ "role": "user", "content": content }],
        });
        if let Some(system) = &request.system {
            payload["system"] = serde_json::json!(system);
        }
        // Claude 는 budget_tokens 가 1024 이상이어야 하고, max_tokens 보다 작아야 합니다.
        if thinking_budget >= 1024 {
            payload["thinking"] = serde_json::json!({
                "type": "enabled",
                "budget_tokens": thinking_budget,
            });
        }
        payload
    } else {
        /*
          OpenAI 는 캐시를 **자동**으로 합니다(표를 달 자리가 없습니다). 앞부분이 같으면
          알아서 잡히므로 예전처럼 한 덩어리로 이어 붙입니다.
        */
        let joined = match request.fixed_prompt.as_deref().map(str::trim) {
            Some(fixed) if !fixed.is_empty() => format!("{fixed}{SEAM}{}", request.prompt),
            _ => request.prompt.clone(),
        };
        let mut content = vec![serde_json::json!({
            "type": "input_text",
            "text": joined
        })];
        for image in &request.images {
            content.push(serde_json::json!({
                "type": "input_image",
                "image_url": format!("data:{};base64,{}", image.media_type, image.data),
            }));
        }

        let mut input = vec![];
        if let Some(system) = &request.system {
            input.push(serde_json::json!({
                "role": "system",
                "content": [{ "type": "input_text", "text": system }]
            }));
        }
        input.push(serde_json::json!({ "role": "user", "content": content }));

        let mut payload = serde_json::json!({
            "model": request.model,
            "input": input,
            "max_output_tokens": max_tokens,
        });
        /*
          ── OpenAI 쪽 캐시 ────────────────────────────────────────────────
          

          OpenAI 에는 `cache_control` **이라는 것이 없습니다.** 표를 달아 «여기까지 캐시» 를
          지정하는 길이 없고, 앞부분이 같으면 **알아서** 잡습니다(1,024 토큰 이상). 그래서
          Claude 쪽에만 표가 붙은 것이지, OpenAI 를 빼먹은 것이 아닙니다.

          대신 여기서 할 수 있는 일이 하나 있습니다 — `prompt_cache_key`.
          같은 열쇠를 준 요청끼리 **같은 기계로 모아** 주어 캐시가 맞을 확률이 올라갑니다.
          이 앱은 캐릭터 시트·컷 프롬프트·일괄 생성이 뒤섞여 나가므로 효과가 있습니다.
          열쇠는 **늘 같은 앞부분의 지문**입니다 — 앞부분이 같은 요청끼리만 묶입니다.

          **모르는 인자면 400 을 냅니다.** 그때는 한 번만 실패로 배우고(아래 `CACHE_KEY_OK`)
          그 뒤로는 안 보냅니다 — 매 요청마다 두 번 보내면 느려지기만 합니다.
        */
        if cache_key_allowed() {
            if let Some(key) = request.fixed_prompt.as_deref().map(fingerprint_of) {
                payload["prompt_cache_key"] = serde_json::json!(key);
            }
        }
        // GPT-5.6 이 받는 값은 none · low · medium · high · xhigh · max 입니다.
        // 한때 «생각 없이» 를 minimal 로 옮겼는데, 그건 GPT-5.0 때 쓰던 말이라
        // 400(unsupported_value) 이 났습니다. 화면의 네 단이 그대로 통합니다.
        payload["reasoning"] = serde_json::json!({ "effort": effort });
        /*
          **배경 모드로 보냅니다** — 앱이 닫혀도 답을 이어 받는 길(위 «배경 모드» 주석). `store` 는
          기본값(true) 그대로 두어야 합니다 — 서버가 답을 들고 있어야 id 로 다시 찾습니다.
        */
        if background_allowed() {
            payload["background"] = serde_json::json!(true);
        }
        payload
    };

    let builder = if claude {
        client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
    } else {
        client
            .post("https://api.openai.com/v1/responses")
            .bearer_auth(&key)
            .header("content-type", "application/json")
            .json(&body)
    };

    /*
      배경 모드로 가는 OpenAI 요청은 **«중지» 가 못 끊는 자리(spawn)에서 보냅니다.**

      2026-09-22 검토: 보내는 도중에 «중지» 를 누르면 `with_cancel` 의 select! 가 이 future 를 버립니다. 그러면 POST 는
      이미 서버에 닿았는데 응답 id 는 영영 모릅니다 — 서버는 답을 끝까지 만들고 요금을 매기는데 우리는 끊을 길이 없습니다.
      떼어 낸 일은 끝까지 가서 id 가 생기면 «중지» 깃발(`Background::CancelRequested`)을 보고 그 자리에서 끊습니다.
      Claude 와 배경 모드 아닌 요청은 답이 POST 안에 통째로 오므로 예전처럼 연결을 놓는 것이 끊는 길입니다.
    */
    let detached = !claude && background_allowed() && request.request_id.is_some();
    let (status, text) = if detached {
        let request_id = request.request_id.clone().unwrap_or_default();
        backgrounds().lock_safe().insert(request_id.clone(), Background::Sending);
        let app = app.clone();
        tauri::async_runtime::spawn(async move { send_background(&app, &request_id, builder).await })
            .await
            .map_err(|e| err("보내는 일이 끊겼습니다", e))??
    } else {
        post_json(builder, &request.provider).await?
    };

    if !status.is_success() {
        /*
          **`prompt_cache_key` 를 모르는 계정·판이면 한 번만 배우고 끕니다.**

          이 인자는 「같은 열쇠끼리 같은 기계로 모아 캐시가 맞을 확률을 올리는」 것이라
          없어도 답은 똑같이 나옵니다. 그런데 모르는 인자를 보내면 OpenAI 는 400 을 냅니다 —
          그러면 **요청이 통째로 못 씁니다.** 없어도 되는 것 때문에 전부 죽으면 안 되니,
          한 번 맞으면 깃발을 내리고 그 요청만 다시 보냅니다. 두 번째부터는 아예 안 붙습니다.
        */
        if status.as_u16() == 400 && cache_key_allowed() && rejects_parameter(&text, "prompt_cache_key") {
            CACHE_KEY_OK.store(false, std::sync::atomic::Ordering::Relaxed);
            return Box::pin(call_llm_inner(app, request)).await;
        }
        // `background` 도 같은 규칙 — 이어 받기는 없어도 되지만, 답이 아예 안 오면 안 됩니다.
        if status.as_u16() == 400 && background_allowed() && rejects_parameter(&text, "background") {
            BACKGROUND_OK.store(false, std::sync::atomic::Ordering::Relaxed);
            return Box::pin(call_llm_inner(app, request)).await;
        }
        return Err(format!("{} 오류 {}: {}", request.provider, status, text));
    }

    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| err("답이 JSON 이 아닙니다", e))?;

    let json = if claude {
        json
    } else {
        // 응답 id 는 보낼 때 이미 적고 알렸습니다(`send_background`). 여기서는 끝날 때까지 묻기만 합니다.
        let response_id = json["id"].as_str().unwrap_or_default().to_string();
        settle_openai(&client, &key, &response_id, Some(json), deadline, timeout).await?
    };

    finish(
        app,
        &json,
        claude,
        request.request_id.as_deref().unwrap_or(""),
        &request.model,
    )
}

/// 보내기 한 번 — 상태와 본문. 두 제공사가 같은 것을 씁니다.
async fn post_json(builder: reqwest::RequestBuilder, provider: &str) -> Res<(reqwest::StatusCode, String)> {
    let response = builder.send().await.map_err(|e| send_error(provider, e))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| err("답을 읽지 못했습니다", e))?;
    Ok((status, text))
}

/// 배경 모드 보내기 — 떼어 낸 일 안에서 끝까지 갑니다. id 가 생기면 적어 두고 화면에 알리며(`llm-started`), 그새
/// «중지» 가 와 있었으면 그 자리에서 서버 쪽을 끊고 «중지했습니다» 로 끝냅니다. 요청 id 없이 간 것(키 확인)은 여기로 안 옵니다.
async fn send_background(
    app: &tauri::AppHandle,
    request_id: &str,
    builder: reqwest::RequestBuilder,
) -> Res<(reqwest::StatusCode, String)> {
    let posted = post_json(builder, "openai").await;
    let response_id = match &posted {
        Ok((status, text)) if status.is_success() => serde_json::from_str::<serde_json::Value>(text)
            .ok()
            .and_then(|json| json["id"].as_str().map(str::to_string)),
        _ => None,
    };
    match response_id {
        Some(response_id) => {
            if background_started(app, request_id, &response_id) {
                return Err(CANCELLED.to_string());
            }
        }
        None => background_forget(request_id),
    }
    posted
}

/// 앱을 껐다 켠 뒤 — 이미 보낸 요청을 id 로 **묻기만** 합니다.
async fn resume_inner(app: &tauri::AppHandle, request: LlmResumeRequest) -> Res<String> {
    if request.provider != "openai" {
        return Err(format!("{} 는 이어 받기가 없습니다 — 처음부터 다시 보내야 합니다.", request.provider));
    }
    let key = read_api_key("openai")?;
    let timeout = request.timeout_secs.unwrap_or(180);
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(timeout);
    let client = build_client(timeout)?;
    // «중지» 가 서버 쪽 일도 끊을 수 있게 — 보낼 때와 같은 자리에 적어 둡니다.
    if let Some(request_id) = &request.request_id {
        backgrounds()
            .lock_safe()
            .insert(request_id.clone(), Background::Started(request.response_id.clone()));
    }
    let json = settle_openai(&client, &key, &request.response_id, None, deadline, timeout).await?;
    // 요청할 때 고른 모델 이름이 요금표의 열쇠입니다. 없으면 답에 실린 이름이라도.
    let model = request
        .model
        .clone()
        .or_else(|| json["model"].as_str().map(str::to_string))
        .unwrap_or_default();
    finish(app, &json, false, request.request_id.as_deref().unwrap_or(""), &model)
}

/// 묻기 한 번의 결말 — `poll_step` 을 본문과 함께 실어 옵니다.
enum Polled {
    Read(serde_json::Value),
    /// 못 물었습니다 — 까닭은 들고만 있습니다(시간이 다 되면 그때의 말로 끝납니다).
    Wait(String),
    Gone(String),
    Fail(String),
}

/// 답 하나를 id 로 **묻습니다.** 못 물은 것과 없는 것과 틀린 것을 가려 돌려줍니다 — 가르는 규칙은 `poll_step` 하나.
async fn poll_openai_response(client: &reqwest::Client, key: &str, response_id: &str) -> Polled {
    let sent = client
        .get(format!("https://api.openai.com/v1/responses/{response_id}"))
        .bearer_auth(key)
        .send()
        .await;
    let (status, text) = match sent {
        Ok(response) => {
            let status = response.status().as_u16();
            match response.text().await {
                Ok(text) => (Some(status), text),
                Err(e) => (None, err("답을 읽지 못했습니다", e)),
            }
        }
        Err(e) => (None, send_error("openai", e)),
    };
    let why = || match status {
        Some(code) => format!("openai 오류 {code}: {text}"),
        None => text.clone(),
    };
    match poll_step(status) {
        PollStep::Read => match serde_json::from_str(&text) {
            Ok(json) => Polled::Read(json),
            Err(e) => Polled::Fail(err("답이 JSON 이 아닙니다", e)),
        },
        PollStep::Wait => Polled::Wait(why()),
        PollStep::Gone => Polled::Gone(text.clone()),
        PollStep::Fail => Polled::Fail(why()),
    }
}

/// 서버 쪽 일을 끊습니다. 이미 끝난 답이면 서버가 거절하는데, 그것은 실패가 아닙니다.
async fn cancel_openai_response(client: &reqwest::Client, key: &str, response_id: &str) -> Res<()> {
    client
        .post(format!("https://api.openai.com/v1/responses/{response_id}/cancel"))
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| send_error("openai", e))?;
    Ok(())
}

/// 배경 모드 답이 **끝날 때까지** 묻습니다 — 보내자마자 한 번, 그 뒤 2초마다(`poll_delay`). 처음 손에 든 답(`first`)이
/// 이미 끝났으면 바로 돌려줍니다. 못 물은 한 번은 실패가 아닙니다 — 물러섰다 다시 묻고, 끝은 시간 제한이 냅니다.
async fn settle_openai(
    client: &reqwest::Client,
    key: &str,
    response_id: &str,
    first: Option<serde_json::Value>,
    deadline: tokio::time::Instant,
    timeout: u64,
) -> Res<serde_json::Value> {
    let mut json = first;
    let mut polls: u32 = 0;
    let mut misses: u32 = 0;
    // 마지막으로 못 물은 까닭 — 시간이 다 됐을 때 「왜 못 받았는지」 를 같이 말합니다(429 가 계속됐는지, 길이 막혔는지).
    let mut last_miss: Option<String> = None;
    loop {
        if let Some(current) = json.take() {
            match background_step(current["status"].as_str()) {
                BackgroundStep::Done => return Ok(current),
                BackgroundStep::Failed => {
                    let why = current["error"]["message"]
                        .as_str()
                        .or_else(|| current["incomplete_details"]["reason"].as_str())
                        .unwrap_or("까닭 없음");
                    return Err(format!(
                        "openai 가 답을 끝내지 못했습니다({}): {why}",
                        current["status"].as_str().unwrap_or("?")
                    ));
                }
                BackgroundStep::Wait => {}
            }
        }
        if response_id.is_empty() {
            return Err("배경 모드 답에 id 가 없어 이어 물을 수 없습니다.".to_string());
        }
        let now = tokio::time::Instant::now();
        if now >= deadline {
            /*
              시간이 다 됐으면 **서버 쪽도 끊습니다.** 그냥 두면 우리는 못 받는데 요금은 끝까지 나옵니다 —
              예전(연결 하나로 기다리던 때)에도 끊긴 요청의 값은 그대로 나갔습니다. 이제는 막을 수 있습니다.
            */
            let _ = cancel_openai_response(client, key, response_id).await;
            let why = last_miss.map(|why| format!(" 마지막으로 못 물은 까닭 — {why}")).unwrap_or_default();
            return Err(format!(
                "openai 가 {timeout}초 안에 답을 끝내지 못했습니다. 작업 줄에서 다시 하거나 시간을 늘려 주세요.{why}"
            ));
        }
        tokio::time::sleep(poll_delay(polls, misses).min(deadline - now)).await;
        polls += 1;
        match poll_openai_response(client, key, response_id).await {
            Polled::Read(next) => {
                misses = 0;
                json = Some(next);
            }
            // 한 번 못 물었다고 몇 분째 만들던 답을 버리지 않습니다 — 다음 물음은 더 물러서서(`poll_delay`).
            Polled::Wait(why) => {
                misses += 1;
                last_miss = Some(why);
            }
            Polled::Gone(text) => return Err(format!("{RESUME_GONE}: 이어 받을 답이 서버에 없습니다(404) — {text}")),
            Polled::Fail(why) => {
                // 다시 물어도 같을 오류 — 서버가 아직 만드는 중이면 그것도 끊습니다(요금).
                let _ = cancel_openai_response(client, key, response_id).await;
                return Err(why);
            }
        }
    }
}

/// 끝난 답에서 쓴 양을 흘려보내고 글자를 꺼냅니다. 보낸 것이든 이어 받은 것이든 **여기 하나**를 지납니다.
fn finish(
    app: &tauri::AppHandle,
    json: &serde_json::Value,
    claude: bool,
    request_id: &str,
    model: &str,
) -> Res<String> {
    /*
      쓴 양을 화면으로 흘려보냅니다. 답을 못 읽어도 **쓴 값은 이미 청구되므로**
      여기(파싱 앞)에서 먼저 쏩니다 — 실패한 요청의 값이 기록에서 빠지면 안 됩니다.
    */
    {
        use tauri::Emitter as _;
        let usage = read_usage(json, claude, request_id, model);
        let _ = app.emit("llm-usage", usage);
    }

    let answer = if claude {
        json["content"]
            .as_array()
            .map(|blocks| {
                blocks
                    .iter()
                    .filter_map(|b| b["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default()
    } else {
        // Responses API 는 output_text 를 바로 주기도 하고, output 배열 안에
        // 넣어 주기도 합니다. 둘 다 받아 둡니다.
        json["output_text"]
            .as_str()
            .map(str::to_string)
            .or_else(|| {
                json["output"].as_array().map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item["content"].as_array())
                        .flatten()
                        .filter_map(|c| c["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
            })
            .unwrap_or_default()
    };

    if answer.trim().is_empty() {
        return Err(format!("답이 비어 있습니다: {json}"));
    }
    Ok(answer)
}

#[cfg(test)]
mod background_tests {
    use super::*;

    /// 상태 → 다음 할 일. 여기가 틀리면 끝난 답을 영영 기다리거나, 잘린 답을 통째로 버립니다.
    #[test]
    fn status_maps_to_step() {
        assert_eq!(background_step(Some("queued")), BackgroundStep::Wait);
        assert_eq!(background_step(Some("in_progress")), BackgroundStep::Wait);
        assert_eq!(background_step(Some("completed")), BackgroundStep::Done);
        // 토큰 한도에 걸려 잘린 답 — 받은 데까지는 들어 있으니 읽습니다(프런트가 되살립니다).
        assert_eq!(background_step(Some("incomplete")), BackgroundStep::Done);
        assert_eq!(background_step(Some("failed")), BackgroundStep::Failed);
        assert_eq!(background_step(Some("cancelled")), BackgroundStep::Failed);
        // 배경 모드가 아닌 옛 모양(상태 칸 없음)은 예전처럼 바로 읽습니다.
        assert_eq!(background_step(None), BackgroundStep::Done);
        // 모르는 상태는 기다려 봐야 끝이 없습니다.
        assert_eq!(background_step(Some("something_new")), BackgroundStep::Failed);
    }

    /// 묻기 한 번의 HTTP 상태 → 다음 할 일. 여기가 틀리면 429 한 번에 몇 분째 만들던 답을 버리거나(2026-09-22 검토),
    /// 없는 답을 시간이 다 될 때까지 기다립니다.
    #[test]
    fn poll_status_maps_to_step() {
        assert_eq!(poll_step(Some(200)), PollStep::Read);
        // 못 물은 것 — 연결·시간 초과·몰림·서버 쪽 사고. 다시 물으면 됩니다.
        assert_eq!(poll_step(None), PollStep::Wait);
        assert_eq!(poll_step(Some(408)), PollStep::Wait);
        assert_eq!(poll_step(Some(429)), PollStep::Wait);
        assert_eq!(poll_step(Some(500)), PollStep::Wait);
        assert_eq!(poll_step(Some(502)), PollStep::Wait);
        assert_eq!(poll_step(Some(503)), PollStep::Wait);
        // 없는 답 — 처음부터 다시 보내야 합니다.
        assert_eq!(poll_step(Some(404)), PollStep::Gone);
        // 다시 물어도 같을 것 — 키가 죽었거나 id 모양이 틀림.
        assert_eq!(poll_step(Some(400)), PollStep::Fail);
        assert_eq!(poll_step(Some(401)), PollStep::Fail);
        assert_eq!(poll_step(Some(403)), PollStep::Fail);
    }

    /// 첫 물음은 곧바로, 그 뒤 2초, 못 물었으면 두 배씩 물러서되 30초까지.
    #[test]
    fn poll_delay_first_fast_then_steady_then_backs_off() {
        use std::time::Duration;
        assert_eq!(poll_delay(0, 0), Duration::from_millis(250));
        assert_eq!(poll_delay(1, 0), Duration::from_secs(2));
        assert_eq!(poll_delay(7, 0), Duration::from_secs(2));
        assert_eq!(poll_delay(3, 1), Duration::from_secs(2));
        assert_eq!(poll_delay(3, 2), Duration::from_secs(4));
        assert_eq!(poll_delay(3, 4), Duration::from_secs(16));
        assert_eq!(poll_delay(3, 5), Duration::from_secs(30));
        assert_eq!(poll_delay(3, 9), Duration::from_secs(30));
    }

    /// «이 인자를 모른다» 400 만 잡습니다 — 낱말이 들어 있기만 한 엉뚱한 400 에 배경 모드를 꺼 버리면 안 됩니다.
    #[test]
    fn rejects_parameter_only_on_parameter_errors() {
        // OpenAI 가 모르는 인자를 말하는 모양 셋 — param 으로, code 로, 말머리로.
        assert!(rejects_parameter(
            r#"{"error":{"message":"Unknown parameter: 'background'.","type":"invalid_request_error","param":"background","code":"unknown_parameter"}}"#,
            "background"
        ));
        assert!(rejects_parameter(
            r#"{"error":{"message":"Unsupported parameter: 'background' is not supported with this model.","type":"invalid_request_error","param":null,"code":"unsupported_parameter"}}"#,
            "background"
        ));
        assert!(rejects_parameter(
            r#"{"error":{"message":"Unknown parameter: 'background'.","type":"invalid_request_error"}}"#,
            "background"
        ));
        // 낱말만 들어 있는 엉뚱한 400 — 예전 `contains` 는 이것에도 배경 모드를 껐습니다.
        assert!(!rejects_parameter(
            r#"{"error":{"message":"Invalid image: background layer too large.","type":"invalid_request_error","param":"input","code":"invalid_value"}}"#,
            "background"
        ));
        // 다른 인자 얘기는 다른 인자 얘기입니다.
        assert!(!rejects_parameter(
            r#"{"error":{"message":"Unknown parameter: 'prompt_cache_key'.","param":"prompt_cache_key","code":"unknown_parameter"}}"#,
            "background"
        ));
        // JSON 이 아니면 모릅니다.
        assert!(!rejects_parameter("background: nope", "background"));
    }
}
