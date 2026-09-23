//! **사내 ComfyUI 로 생성** — 로컬 엔진(`local.rs`)과 같은 요청을 사내 ComfyUI 서버들에 보냅니다.
//!
//! 로컬 엔진은 이 컴퓨터의 GPU 로 돕니다. 노트북 GPU 로는 Qwen-Image 20B·MiniMax H3 같은
//! 모델이 못 올라가거나 한 편에 수십 분이 걸립니다. 회사에는 같은 모델을 이미 올려 둔 ComfyUI
//! 가 여러 대 있으니, **프런트가 `local_run` 에 보내던 요청을 그대로** 받아 거기서 뽑고
//! 결과를 같은 자리(프로젝트 폴더)에 놓습니다.
//!
//! # 워크플로는 앱이 들고 있습니다
//!
//! 엔진마다 API 형식 그래프 하나(`comfy_workflows/*.json`)를 품습니다. 사용자가 고를 일이
//! 없게 하려는 것입니다 — 업스케일 다리(`comfy.rs`)는 사용자가 워크플로 파일을 고르지만,
//! 생성은 엔진이 곧 워크플로라 고를 것이 없습니다. 파일마다 `bind` 가 «어느 노드의 어느
//! 입력에 무엇을 넣는가» 를 적어 두고, 여기서는 그 표대로 채우기만 합니다.
//! 그래프는 전부 사내 서버에서 실제로 돌려 본 것입니다(공식 템플릿을 API 형식으로 옮긴 것).
//!
//! # 서버 고르기
//!
//! 등록된 주소를 한꺼번에 물어(`/system_stats`·`/queue`) 살아 있는 것 중 **대기열이 가장
//! 짧은** 곳을 고릅니다. 이 앱이 방금 보낸 것도 셉니다(`RESERVED`) — 여러 카드를 한꺼번에
//! 누르면 서버가 대기열에 올리기 전이라 모두 같은 서버를 고르게 되기 때문입니다.
//! 서버가 워크플로를 거절하면(모델·노드 없음) 다음 서버로 넘어갑니다 — 거절은 큐에 들어가지
//! 않은 것이라 두 번 뽑힐 걱정이 없습니다. **받아들인 뒤에는 옮기지 않습니다.**

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter};

use crate::comfy::{comfy_base, comfy_net_err};
use crate::upscale::{job_tag, known_engine, reserve_free_path, GenerateResult, LOCAL};
use crate::{err, Res};

/// 영상 한 편이 수 분입니다. 로컬과 같은 한도를 씁니다.
const DEFAULT_TIMEOUT_SECS: u64 = 3600;

/// 엔진 id → 워크플로 파일. 한 엔진에 갈래가 여럿이면(텍스트·첫 프레임·레퍼런스) `pick_workflow` 가 고릅니다.
const WORKFLOWS: &[(&str, &str)] = &[
    ("zimage", include_str!("comfy_workflows/zimage.json")),
    ("krea2", include_str!("comfy_workflows/krea2.json")),
    ("qwenimage", include_str!("comfy_workflows/qwenimage.json")),
    ("wanvideo_t2v", include_str!("comfy_workflows/wanvideo_t2v.json")),
    ("wanvideo_i2v", include_str!("comfy_workflows/wanvideo_i2v.json")),
    ("ltx25_t2v", include_str!("comfy_workflows/ltx25_t2v.json")),
    ("ltx25_i2v", include_str!("comfy_workflows/ltx25_i2v.json")),
    ("minimaxh3_t2v", include_str!("comfy_workflows/minimaxh3_t2v.json")),
    ("minimaxh3_i2v", include_str!("comfy_workflows/minimaxh3_i2v.json")),
    ("minimaxh3_r2v", include_str!("comfy_workflows/minimaxh3_r2v.json")),
    ("acestep", include_str!("comfy_workflows/acestep.json")),
];

/// 사내 ComfyUI 로 뽑을 수 있는 엔진. 프런트가 «원격으로 쓸 수 있는가» 를 이것으로 압니다.
pub const REMOTE_ENGINES: &[&str] = &["qwenimage", "zimage", "krea2", "minimaxh3", "wanvideo", "ltx25", "acestep"];

fn workflow_doc(name: &str) -> Res<Value> {
    let text = WORKFLOWS
        .iter()
        .find(|(id, _)| *id == name)
        .map(|(_, text)| *text)
        .ok_or_else(|| format!("워크플로가 없습니다: {name}"))?;
    serde_json::from_str(text).map_err(|e| err("내장 워크플로를 읽지 못했습니다", e))
}

fn non_empty<'a>(opts: &'a Value, key: &str) -> Option<&'a str> {
    opts.get(key).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty())
}

/// 레퍼런스 중 **그림**만. 영상·소리 레퍼런스는 아직 싣지 않습니다(결과에 적어 알립니다).
fn image_references(opts: &Value) -> Vec<String> {
    opts.get("references")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| item.get("kind").and_then(Value::as_str) == Some("image"))
                .filter_map(|item| non_empty(item, "path").map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// 엔진과 요청으로 워크플로를 고릅니다. 첫 프레임이 있으면 그림→영상, 레퍼런스가 있으면(H3) 레퍼런스→영상.
pub(crate) fn pick_workflow(engine: &str, opts: &Value) -> Res<&'static str> {
    let has_image = non_empty(opts, "image").is_some();
    let has_refs = !image_references(opts).is_empty();
    Ok(match engine {
        "zimage" => "zimage",
        "krea2" => "krea2",
        "qwenimage" => "qwenimage",
        "acestep" => "acestep",
        "wanvideo" if has_image => "wanvideo_i2v",
        "wanvideo" => "wanvideo_t2v",
        "ltx25" if has_image => "ltx25_i2v",
        "ltx25" => "ltx25_t2v",
        // H3 의 ref2va 는 키프레임을 받지 않습니다 — 레퍼런스가 있으면 그쪽이 이깁니다.
        "minimaxh3" if has_refs => "minimaxh3_r2v",
        "minimaxh3" if has_image => "minimaxh3_i2v",
        "minimaxh3" => "minimaxh3_t2v",
        _ => return Err(format!("{engine} 은(는) 사내 ComfyUI 로 뽑을 수 없는 엔진입니다.")),
    })
}

/// 채운 결과. 그래프와 함께 «무엇을 넣었는가» 를 남겨 결과 메타로 돌려줍니다.
pub(crate) struct Filled {
    pub graph: Map<String, Value>,
    pub values: Map<String, Value>,
    pub output_node: String,
    pub output_key: String,
}

fn num(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_f64).filter(|v| v.is_finite() && *v > 0.0)
}

fn snap(value: f64, step: u64) -> u64 {
    let step = step.max(1);
    (((value / step as f64).round() as u64) * step).clamp(step, 4096)
}

/// 초 → 프레임 수. 모델마다 받는 프레임 수의 꼴이 다릅니다.
/// - Wan(4n+1)·LTX(8n+1): `frame_step`
/// - H3: 17n+5 (공식 템플릿의 식 `max(5, round(s*24)) + (5 - n % 17) % 17` 그대로)
fn frames_for(defaults: &Value, seconds: f64, fps: f64) -> Option<u64> {
    if defaults.get("frame_rule").and_then(Value::as_str) == Some("h3") {
        let n = ((seconds * fps).round() as u64).max(5);
        return Some(n + (5 + 17 - n % 17) % 17);
    }
    let step = defaults.get("frame_step").and_then(Value::as_u64)?;
    let units = ((seconds * fps / step as f64).round() as u64).max(1);
    Some(units * step + 1)
}

/// 워크플로를 요청 값으로 채웁니다. 네트워크를 쓰지 않는 순수 함수라 시험으로 붙들어 둡니다.
///
/// - `image` 는 서버에 올린 뒤의 이름(없으면 첫 프레임 없음)
/// - `refs` 는 서버에 올린 레퍼런스 그림 이름들(차례가 곧 뜻입니다)
pub(crate) fn fill(doc: &Value, opts: &Value, image: Option<&str>, refs: &[String], prefix: &str, seed: u64) -> Res<Filled> {
    let defaults = doc.get("defaults").cloned().unwrap_or_else(|| json!({}));
    let mut graph = doc
        .get("graph")
        .and_then(Value::as_object)
        .cloned()
        .ok_or("워크플로에 graph 가 없습니다.")?;

    let prompt = non_empty(opts, "prompt").ok_or("보낼 프롬프트가 없습니다.")?;
    let mut values = Map::new();
    values.insert("prompt".into(), json!(prompt));
    if let Some(negative) = non_empty(opts, "negative").or_else(|| non_empty(&defaults, "negative")) {
        values.insert("negative".into(), json!(negative));
    }

    let step = defaults.get("size_step").and_then(Value::as_u64).unwrap_or(16);
    let width = snap(num(opts.get("width")).or(num(defaults.get("width"))).unwrap_or(1024.0), step);
    let height = snap(num(opts.get("height")).or(num(defaults.get("height"))).unwrap_or(1024.0), step);
    values.insert("width".into(), json!(width));
    values.insert("height".into(), json!(height));
    // LTX 는 절반 크기로 뽑고 잠재 공간에서 두 배로 올립니다.
    values.insert("half_width".into(), json!(width / 2));
    values.insert("half_height".into(), json!(height / 2));

    let fixed_fps = defaults.get("fps_fixed").and_then(Value::as_bool).unwrap_or(false);
    let default_fps = num(defaults.get("fps")).unwrap_or(24.0);
    let fps = if fixed_fps { default_fps } else { num(opts.get("fps")).unwrap_or(default_fps) };
    // 정수면 정수로 넣습니다 — 정수 입력(INT)을 받는 노드가 24.0 을 거절하지 않게.
    values.insert("fps".into(), if fps.fract() == 0.0 { json!(fps as u64) } else { json!(fps) });

    let max_seconds = num(defaults.get("max_seconds")).unwrap_or(10.0);
    let seconds = num(opts.get("seconds"))
        .or(num(defaults.get("seconds")))
        .unwrap_or(5.0)
        .clamp(1.0, max_seconds);
    values.insert("seconds".into(), json!(seconds));
    if let Some(frames) = frames_for(&defaults, seconds, fps) {
        values.insert("frames".into(), json!(frames));
    }

    values.insert("seed".into(), json!(seed));
    // 가사가 비면 연주곡입니다(로컬 ACE-Step 워커와 같은 약속).
    values.insert("lyrics".into(), json!(non_empty(opts, "lyrics").unwrap_or("[inst]")));
    values.insert("prefix".into(), json!(prefix));
    if let Some(image) = image {
        values.insert("image".into(), json!(image));
    }

    let bind = doc.get("bind").and_then(Value::as_object).ok_or("워크플로에 bind 가 없습니다.")?;
    for (key, targets) in bind {
        let Some(value) = values.get(key) else { continue };
        for target in targets.as_array().into_iter().flatten() {
            let node = target.get(0).and_then(Value::as_str).ok_or("bind 의 노드 번호가 비었습니다.")?;
            let input = target.get(1).and_then(Value::as_str).ok_or("bind 의 입력 이름이 비었습니다.")?;
            let inputs = graph
                .get_mut(node)
                .and_then(|n| n.get_mut("inputs"))
                .and_then(Value::as_object_mut)
                .ok_or_else(|| format!("bind 가 없는 노드를 가리킵니다: {node}"))?;
            inputs.insert(input.to_string(), value.clone());
        }
    }
    if bind.contains_key("image") && image.is_none() {
        return Err("이 워크플로는 첫 프레임 그림이 있어야 합니다.".into());
    }

    if let (Some(spec), false) = (doc.get("references"), refs.is_empty()) {
        let max = spec.get("max").and_then(Value::as_u64).unwrap_or(1) as usize;
        let start = spec.get("start").and_then(Value::as_u64).unwrap_or(1) as usize;
        let node = spec.pointer("/input/0").and_then(Value::as_str).ok_or("references.input 이 비었습니다.")?.to_string();
        let pattern = spec.pointer("/input/1").and_then(Value::as_str).ok_or("references.input 이 비었습니다.")?.to_string();
        for (offset, name) in refs.iter().take(max).enumerate() {
            let n = start + offset;
            let id = format!("ref{n}");
            graph.insert(id.clone(), json!({ "class_type": "LoadImage", "inputs": { "image": name } }));
            if let Some(inputs) = graph.get_mut(&node).and_then(|v| v.get_mut("inputs")).and_then(Value::as_object_mut) {
                inputs.insert(pattern.replace("{n}", &n.to_string()), json!([id, 0]));
            }
        }
        for extra in spec.get("extra").and_then(Value::as_array).into_iter().flatten() {
            let (Some(n), Some(input), Some(value)) = (extra.get(0).and_then(Value::as_str), extra.get(1).and_then(Value::as_str), extra.get(2)) else {
                continue;
            };
            if let Some(inputs) = graph.get_mut(n).and_then(|v| v.get_mut("inputs")).and_then(Value::as_object_mut) {
                inputs.insert(input.to_string(), value.clone());
            }
        }
        values.insert("references".into(), json!(refs.len().min(max)));
    }

    let output_node = doc.pointer("/output/node").and_then(Value::as_str).ok_or("워크플로에 output.node 가 없습니다.")?.to_string();
    let output_key = doc.pointer("/output/key").and_then(Value::as_str).unwrap_or("images").to_string();
    Ok(Filled { graph, values, output_node, output_key })
}

/// 서버에 같은 이름이 있는 로라만 겁니다. `after` 노드의 모델 출력 뒤에 줄줄이 달고, `into` 가 그 끝을 받게 합니다.
///
/// 로컬 로라는 이 컴퓨터의 파일 경로라 서버가 읽을 수 없습니다. 파일 이름이 서버의
/// `models/loras` 목록에 있는 것만 싣고, 나머지는 이름을 돌려줘 «못 실었다» 고 알립니다.
pub(crate) fn attach_loras(doc: &Value, graph: &mut Map<String, Value>, loras: &[(String, f64)], remote: &[String]) -> (Vec<String>, Vec<String>) {
    let mut used = Vec::new();
    let mut dropped = Vec::new();
    let Some(spec) = doc.get("loras") else {
        dropped.extend(loras.iter().map(|(name, _)| name.clone()));
        return (used, dropped);
    };
    let Some(after) = spec.get("after").and_then(Value::as_str) else {
        return (used, dropped);
    };
    let base_name = |s: &str| s.rsplit(['/', '\\']).next().unwrap_or(s).to_ascii_lowercase();
    let mut last = json!([after, 0]);
    for (index, (path, weight)) in loras.iter().enumerate() {
        let wanted = base_name(path);
        let Some(found) = remote.iter().find(|r| base_name(r) == wanted) else {
            dropped.push(wanted);
            continue;
        };
        let id = format!("lora{index}");
        graph.insert(
            id.clone(),
            json!({ "class_type": "LoraLoaderModelOnly", "inputs": { "model": last, "lora_name": found, "strength_model": weight } }),
        );
        last = json!([id, 0]);
        used.push(found.clone());
    }
    if !used.is_empty() {
        for target in spec.get("into").and_then(Value::as_array).into_iter().flatten() {
            let (Some(node), Some(input)) = (target.get(0).and_then(Value::as_str), target.get(1).and_then(Value::as_str)) else {
                continue;
            };
            if let Some(inputs) = graph.get_mut(node).and_then(|v| v.get_mut("inputs")).and_then(Value::as_object_mut) {
                inputs.insert(input.to_string(), last.clone());
            }
        }
    }
    (used, dropped)
}

// ─────────────────────────────────────────────────────────────────────────────
// 서버 상태
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EndpointStatus {
    pub url: String,
    pub ok: bool,
    pub error: Option<String>,
    pub device: String,
    pub vram_total_gb: f64,
    pub vram_free_gb: f64,
    pub running: u64,
    pub pending: u64,
    /// 이 앱이 보냈지만 아직 끝나지 않은 것.
    pub reserved: u64,
    pub latency_ms: u64,
}

/// 이 앱이 서버마다 보내 둔 작업 수. 서버의 대기열에 뜨기 전의 틈을 메웁니다.
fn reserved_map() -> &'static Mutex<HashMap<String, u64>> {
    static RESERVED: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();
    RESERVED.get_or_init(|| Mutex::new(HashMap::new()))
}

fn reserved_on(base: &str) -> u64 {
    reserved_map().lock().map(|m| m.get(base).copied().unwrap_or(0)).unwrap_or(0)
}

/// 작업 하나가 서버 하나를 잡고 있다는 표. 떨어지면(끝·실패·취소) 저절로 풀립니다.
struct Reservation(String);

impl Reservation {
    fn take(base: &str) -> Self {
        if let Ok(mut map) = reserved_map().lock() {
            *map.entry(base.to_string()).or_insert(0) += 1;
        }
        Reservation(base.to_string())
    }
}

impl Drop for Reservation {
    fn drop(&mut self) {
        if let Ok(mut map) = reserved_map().lock() {
            if let Some(count) = map.get_mut(&self.0) {
                *count = count.saturating_sub(1);
            }
        }
    }
}

/// 서버를 줄 세우고 **1순위를 그 자리에서 예약**합니다 — 둘을 한 잠금 안에서 합니다.
///
/// 2026-09-23 앱 안 시험에서 드러났습니다. 작업 열 개를 한꺼번에 보내자 **전부 한 서버(8192)로**
/// 갔습니다. 요청마다 서버 상태를 거의 같은 순간에 물어 모두 «대기열 0» 을 보았고, 동점에서
/// VRAM 이 가장 빈 서버를 똑같이 골랐습니다. 예약 표는 있었지만 줄을 세운 **뒤에** 잡아서,
/// 뒤따르는 요청이 앞의 예약을 보지 못했습니다. 그래서 줄을 세우는 순간의 예약 수를 읽고
/// 1순위를 곧바로 예약합니다 — 다음 요청은 그 예약을 보고 다른 서버를 고릅니다.
fn rank_and_reserve(statuses: &[EndpointStatus]) -> (Vec<EndpointStatus>, Option<Reservation>) {
    let Ok(mut map) = reserved_map().lock() else {
        return (rank(statuses), None);
    };
    let fresh: Vec<EndpointStatus> = statuses
        .iter()
        .cloned()
        .map(|mut status| {
            status.reserved = map.get(&status.url).copied().unwrap_or(0);
            status
        })
        .collect();
    let ranked = rank(&fresh);
    let first = ranked.first().map(|status| {
        *map.entry(status.url.clone()).or_insert(0) += 1;
        Reservation(status.url.clone())
    });
    (ranked, first)
}

async fn probe(client: &reqwest::Client, url: &str) -> EndpointStatus {
    let base = comfy_base(url);
    let started = Instant::now();
    let mut status = EndpointStatus {
        url: base.clone(),
        ok: false,
        error: None,
        device: String::new(),
        vram_total_gb: 0.0,
        vram_free_gb: 0.0,
        running: 0,
        pending: 0,
        reserved: reserved_on(&base),
        latency_ms: 0,
    };
    let stats = client.get(format!("{base}/system_stats")).timeout(Duration::from_secs(5)).send().await;
    let stats: Value = match stats {
        Ok(response) if response.status().is_success() => match response.json().await {
            Ok(value) => value,
            Err(e) => {
                status.error = Some(err("system_stats 를 읽지 못했습니다", e));
                return status;
            }
        },
        Ok(response) => {
            status.error = Some(format!("ComfyUI 가 {} 로 답했습니다.", response.status()));
            return status;
        }
        Err(e) => {
            status.error = Some(comfy_net_err(&base, e));
            return status;
        }
    };
    status.latency_ms = started.elapsed().as_millis() as u64;
    let gb = |v: Option<&Value>| v.and_then(Value::as_f64).unwrap_or(0.0) / 1_073_741_824.0;
    status.device = stats.pointer("/devices/0/name").and_then(Value::as_str).unwrap_or("").to_string();
    status.vram_total_gb = gb(stats.pointer("/devices/0/vram_total"));
    status.vram_free_gb = gb(stats.pointer("/devices/0/vram_free"));
    match client.get(format!("{base}/queue")).timeout(Duration::from_secs(5)).send().await {
        Ok(response) => {
            let queue: Value = response.json().await.unwrap_or_default();
            let count = |key: &str| queue.get(key).and_then(Value::as_array).map(|a| a.len() as u64).unwrap_or(0);
            status.running = count("queue_running");
            status.pending = count("queue_pending");
            status.ok = true;
        }
        Err(e) => status.error = Some(comfy_net_err(&base, e)),
    }
    status
}

fn http_client() -> Res<reqwest::Client> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| err("HTTP 클라이언트를 만들지 못했습니다", e))
}

/// 주소를 정리하고 같은 것을 한 번만 남깁니다.
fn normalize_endpoints(endpoints: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for url in endpoints {
        if url.trim().is_empty() {
            continue;
        }
        let base = comfy_base(url);
        if !out.contains(&base) {
            out.push(base);
        }
    }
    out
}

/// 등록된 서버를 한꺼번에 물어봅니다(설정 화면의 «연결 확인»).
#[tauri::command]
pub async fn comfy_fleet_status(endpoints: Vec<String>) -> Res<Vec<EndpointStatus>> {
    let client = http_client()?;
    let endpoints = normalize_endpoints(&endpoints);
    Ok(futures_util::future::join_all(endpoints.iter().map(|url| probe(&client, url))).await)
}

/// 사내 ComfyUI 로 뽑을 수 있는 엔진 id.
#[tauri::command]
pub fn comfy_remote_engines() -> Vec<String> {
    REMOTE_ENGINES.iter().map(|id| id.to_string()).collect()
}

/// 살아 있는 서버를 한가한 차례로 줄 세웁니다. 짐 = 실행 + 대기 + 이 앱이 보낸 것.
/// 짐이 같으면 VRAM 이 많이 빈 쪽, 그것도 같으면 등록한 차례.
pub(crate) fn rank(statuses: &[EndpointStatus]) -> Vec<EndpointStatus> {
    let mut alive: Vec<(usize, EndpointStatus)> = statuses.iter().cloned().enumerate().filter(|(_, s)| s.ok).collect();
    alive.sort_by(|(ia, a), (ib, b)| {
        let load_a = a.running + a.pending + a.reserved;
        let load_b = b.running + b.pending + b.reserved;
        load_a
            .cmp(&load_b)
            .then(b.vram_free_gb.partial_cmp(&a.vram_free_gb).unwrap_or(std::cmp::Ordering::Equal))
            .then(ia.cmp(ib))
    });
    alive.into_iter().map(|(_, s)| s).collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// 올리기 · 받기
// ─────────────────────────────────────────────────────────────────────────────

/// 그림 하나를 서버의 input 폴더에 올리고 워크플로에 넣을 이름을 돌려줍니다.
///
/// 이름은 **작업 번호로 새로 짓습니다** — 프로젝트 파일 이름은 한글이고, 서버 input 폴더는
/// 여러 사람이 같이 쓰므로 같은 이름(`소녀_001.png`)을 올리면 남의 그림을 덮습니다.
async fn upload_image(client: &reqwest::Client, base: &str, path: &str, tag: &str) -> Res<String> {
    let source = PathBuf::from(path);
    let bytes = fs::read(&source).map_err(|e| err(&format!("그림을 읽지 못했습니다 ({path})"), e))?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_else(|| "png".into());
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    };
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(format!("aimoviestorage_{tag}.{ext}"))
        .mime_str(mime)
        .map_err(|e| err("업로드 형식을 만들지 못했습니다", e))?;
    let form = reqwest::multipart::Form::new().part("image", part).text("overwrite", "true");
    let response = client
        .post(format!("{base}/upload/image"))
        .multipart(form)
        .timeout(Duration::from_secs(180))
        .send()
        .await
        .map_err(|e| comfy_net_err(base, e))?;
    if !response.status().is_success() {
        return Err(format!("그림 올리기를 ComfyUI 가 거절했습니다 ({}).", response.status()));
    }
    let uploaded: Value = response.json().await.map_err(|e| err("업로드 응답을 읽지 못했습니다", e))?;
    let name = uploaded.get("name").and_then(Value::as_str).ok_or("업로드 응답에 파일 이름이 없습니다.")?;
    let subfolder = uploaded.get("subfolder").and_then(Value::as_str).unwrap_or("");
    Ok(if subfolder.is_empty() { name.to_string() } else { format!("{subfolder}/{name}") })
}

async fn remote_loras(client: &reqwest::Client, base: &str) -> Vec<String> {
    match client.get(format!("{base}/models/loras")).timeout(Duration::from_secs(15)).send().await {
        Ok(response) => response.json::<Vec<String>>().await.unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// flac → 16비트 wav. ComfyUI 는 wav 로 저장하지 못하는데 앱의 음악 자리는 wav 입니다.
pub(crate) fn flac_to_wav(bytes: &[u8]) -> Res<Vec<u8>> {
    let mut reader = claxon::FlacReader::new(std::io::Cursor::new(bytes)).map_err(|e| err("flac 을 읽지 못했습니다", e))?;
    let info = reader.streaminfo();
    let channels = info.channels as u16;
    let rate = info.sample_rate;
    let bits = info.bits_per_sample;
    let mut data: Vec<u8> = Vec::new();
    for sample in reader.samples() {
        let sample = sample.map_err(|e| err("flac 을 풀지 못했습니다", e))?;
        let value = if bits > 16 { sample >> (bits - 16) } else { sample << (16 - bits) };
        data.extend_from_slice(&(value.clamp(i16::MIN as i32, i16::MAX as i32) as i16).to_le_bytes());
    }
    let block_align = channels * 2;
    let mut wav = Vec::with_capacity(44 + data.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&channels.to_le_bytes());
    wav.extend_from_slice(&rate.to_le_bytes());
    wav.extend_from_slice(&(rate * block_align as u32).to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&(data.len() as u32).to_le_bytes());
    wav.extend_from_slice(&data);
    Ok(wav)
}

fn emit_progress(app: &AppHandle, engine: &str, message: &str) {
    let _ = app.emit(
        LOCAL.event,
        json!({
            "engine": engine,
            "stage": "run",
            "percent": Value::Null,
            "message": message,
            "done": false,
            "error": Value::Null,
        }),
    );
}

fn host_of(base: &str) -> &str {
    base.trim_start_matches("http://").trim_start_matches("https://")
}

/// 시간이 다 됐을 때 **우리가 보낸 것만** 거둡니다. 대기 중이면 빼고, 돌고 있으면 그것만 멈춥니다.
async fn withdraw(client: &reqwest::Client, base: &str, prompt_id: &str) {
    let _ = client
        .post(format!("{base}/queue"))
        .json(&json!({ "delete": [prompt_id] }))
        .timeout(Duration::from_secs(10))
        .send()
        .await;
    let _ = client
        .post(format!("{base}/interrupt"))
        .json(&json!({ "prompt_id": prompt_id }))
        .timeout(Duration::from_secs(10))
        .send()
        .await;
}

/// 서버 하나에 보낼 요청의 재료. 서버를 바꿔 다시 보낼 때 같은 값을 그대로 씁니다.
struct Submission<'a> {
    doc: &'a Value,
    opts: &'a Value,
    image_path: Option<&'a str>,
    reference_paths: &'a [String],
    loras: &'a [(String, f64)],
    prefix: &'a str,
    tag: &'a str,
    seed: u64,
}

/// 서버 하나에 그림을 올리고 워크플로를 큐에 넣습니다. 받아 주면 `(prompt_id, 채운 것, 실은 로라, 못 실은 로라)`.
async fn submit(client: &reqwest::Client, base: &str, request: &Submission<'_>) -> Res<(String, Filled, Vec<String>, Vec<String>)> {
    let tag = request.tag;
    let image = match request.image_path {
        Some(path) => Some(upload_image(client, base, path, &format!("{tag}_first")).await?),
        None => None,
    };
    let mut refs = Vec::new();
    for (index, path) in request.reference_paths.iter().enumerate() {
        refs.push(upload_image(client, base, path, &format!("{tag}_ref{index}")).await?);
    }
    let mut filled = fill(request.doc, request.opts, image.as_deref(), &refs, request.prefix, request.seed)?;
    let (used, dropped) = if request.loras.is_empty() {
        (Vec::new(), Vec::new())
    } else {
        let remote = remote_loras(client, base).await;
        attach_loras(request.doc, &mut filled.graph, request.loras, &remote)
    };
    let response = client
        .post(format!("{base}/prompt"))
        .json(&json!({ "prompt": filled.graph, "client_id": format!("aimoviestorage-{tag}") }))
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| comfy_net_err(base, e))?;
    let code = response.status();
    let text = response.text().await.unwrap_or_default();
    if !code.is_success() {
        let brief: String = text.chars().take(600).collect();
        return Err(format!("워크플로를 받지 않았습니다 ({code}): {brief}"));
    }
    let queued: Value = serde_json::from_str(&text).map_err(|e| err("큐 응답을 읽지 못했습니다", e))?;
    let prompt_id = queued
        .get("prompt_id")
        .and_then(Value::as_str)
        .ok_or("큐 응답에 prompt_id 가 없습니다.")?
        .to_string();
    Ok((prompt_id, filled, used, dropped))
}

// ─────────────────────────────────────────────────────────────────────────────
// 취소
// ─────────────────────────────────────────────────────────────────────────────
//
// 원격 작업은 앱이 꺼져도 서버에서 계속 돕니다(2026-09-23 시험 중 앱이 메모리 부족으로 꺼졌을 때
// H3 영상 넷이 끝까지 돌았습니다). 사람이 «멈추기» 를 누르면 **우리가 보낸 그 작업만** 대기열에서
// 빼거나 실행을 멈춥니다. 서버를 같이 쓰는 다른 사람의 작업은 건드리지 않습니다.

#[derive(Default)]
struct JobState {
    /// 받아 준 서버와 그 작업 번호. 제출 전이면 비어 있습니다.
    submitted: Option<(String, String)>,
    cancelled: bool,
}

fn jobs() -> &'static Mutex<HashMap<String, JobState>> {
    static JOBS: OnceLock<Mutex<HashMap<String, JobState>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 작업 하나를 표에 올려 두고, 끝나면(성공·실패·취소) 저절로 내립니다.
struct JobEntry(Option<String>);

impl JobEntry {
    fn register(job_id: Option<String>) -> Self {
        if let (Some(id), Ok(mut map)) = (&job_id, jobs().lock()) {
            map.insert(id.clone(), JobState::default());
        }
        JobEntry(job_id)
    }

    fn cancelled(&self) -> bool {
        let Some(id) = &self.0 else { return false };
        jobs().lock().map(|m| m.get(id).map(|j| j.cancelled).unwrap_or(false)).unwrap_or(false)
    }

    fn submitted(&self, base: &str, prompt_id: &str) {
        let Some(id) = &self.0 else { return };
        if let Ok(mut map) = jobs().lock() {
            if let Some(job) = map.get_mut(id) {
                job.submitted = Some((base.to_string(), prompt_id.to_string()));
            }
        }
    }
}

impl Drop for JobEntry {
    fn drop(&mut self) {
        if let (Some(id), Ok(mut map)) = (&self.0, jobs().lock()) {
            map.remove(id);
        }
    }
}

const CANCELLED: &str = "멈췄습니다.";

/// «멈추기» — 그 작업을 표시하고, 이미 서버에 올라갔으면 곧바로 거둡니다.
/// 돌려주는 값은 «그런 작업이 아직 있었는가» 입니다(이미 끝났으면 false).
#[tauri::command]
pub async fn comfy_cancel(job_id: String) -> Res<bool> {
    let submitted = {
        let mut map = jobs().lock().map_err(|_| "작업 표를 읽지 못했습니다.".to_string())?;
        let Some(job) = map.get_mut(&job_id) else { return Ok(false) };
        job.cancelled = true;
        job.submitted.clone()
    };
    if let Some((base, prompt_id)) = submitted {
        withdraw(&http_client()?, &base, &prompt_id).await;
    }
    Ok(true)
}

/// 파일 하나를 사내 ComfyUI 로 만듭니다 — `local_run` 과 같은 인자·같은 결과 꼴입니다.
///
/// `endpoints` 는 설정에 등록한 서버 주소들입니다. 결과는 `output_path` 자리(이미 있으면 번호를
/// 올린 새 자리)에 놓고, 어느 서버에서 어떤 값으로 뽑았는지를 `meta` 에 담습니다.
#[tauri::command]
pub async fn comfy_generate(
    app: AppHandle,
    engine: String,
    output_path: String,
    opts: Option<Value>,
    endpoints: Vec<String>,
    timeout_secs: Option<u64>,
    job_id: Option<String>,
) -> Res<GenerateResult> {
    let started = Instant::now();
    // 프런트가 번호를 주면 «멈추기»(`comfy_cancel`)로 찾을 수 있게 표에 올립니다.
    let job = JobEntry::register(job_id);
    let engine = known_engine(&engine)?.to_string();
    let opts = opts.unwrap_or_else(|| json!({}));
    let workflow = pick_workflow(&engine, &opts)?;
    let doc = workflow_doc(workflow)?;

    let out = PathBuf::from(&output_path);
    let out_ext = out.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if out_ext.is_empty() {
        return Err("결과 자리에 확장자가 없습니다.".into());
    }
    let Some(out_dir) = out.parent().filter(|p| p.is_dir()).map(Path::to_path_buf) else {
        return Err("결과를 놓을 폴더가 없습니다.".into());
    };

    let endpoints = normalize_endpoints(&endpoints);
    if endpoints.is_empty() {
        return Err("사내 ComfyUI 주소가 없습니다. 설정 → 사내 ComfyUI 에서 주소를 넣으세요.".into());
    }
    let client = http_client()?;
    emit_progress(&app, &engine, "사내 ComfyUI 서버 상태를 확인하는 중…");
    let statuses = futures_util::future::join_all(endpoints.iter().map(|url| probe(&client, url))).await;
    // 1순위는 여기서 바로 예약됩니다 — 동시에 들어온 다른 요청이 같은 서버로 몰리지 않게(`rank_and_reserve`).
    let (ranked, mut first_reservation) = rank_and_reserve(&statuses);
    if ranked.is_empty() {
        let why: Vec<String> = statuses
            .iter()
            .map(|s| format!("{} — {}", host_of(&s.url), s.error.clone().unwrap_or_default()))
            .collect();
        return Err(format!("응답하는 사내 ComfyUI 가 없습니다.\n{}", why.join("\n")));
    }

    let tag = job_tag().replace('-', "_");
    let seed = opts.get("seed").and_then(Value::as_u64).unwrap_or_else(|| {
        // 시드를 안 주면 매번 다른 그림이 나와야 합니다. 시각과 작업 번호를 섞습니다.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        nanos ^ (std::process::id() as u64).rotate_left(32)
    }) % 1_125_899_906_842_624;
    let prefix = format!("aimoviestorage/{engine}_{tag}");
    let image_path = non_empty(&opts, "image").map(str::to_string);
    let reference_paths = if doc.get("references").is_some() { image_references(&opts) } else { Vec::new() };
    let loras: Vec<(String, f64)> = opts
        .get("loras")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let path = non_empty(item, "path")?.to_string();
                    let weight = item.get("weight").and_then(Value::as_f64).unwrap_or(1.0);
                    Some((path, weight))
                })
                .collect()
        })
        .unwrap_or_default();

    // 받아 준 서버를 찾을 때까지 한가한 차례로 보냅니다. 거절 사유는 모아 두었다가 전부 실패하면 보여 줍니다.
    let mut rejections: Vec<String> = Vec::new();
    let mut accepted: Option<(String, String, Filled, Vec<String>, Vec<String>, Reservation)> = None;
    for status in &ranked {
        if job.cancelled() {
            return Err(CANCELLED.into());
        }
        let base = status.url.clone();
        // 1순위는 이미 예약해 두었습니다. 거절당해 다음 서버로 넘어갈 때는 그 서버를 새로 예약합니다.
        let reservation = first_reservation.take().unwrap_or_else(|| Reservation::take(&base));
        emit_progress(&app, &engine, &format!("{} 에 요청을 올리는 중…", host_of(&base)));
        let request = Submission {
            doc: &doc,
            opts: &opts,
            image_path: image_path.as_deref(),
            reference_paths: &reference_paths,
            loras: &loras,
            prefix: &prefix,
            tag: &tag,
            seed,
        };
        match submit(&client, &base, &request).await {
            Ok((prompt_id, filled, used, dropped)) => {
                accepted = Some((base, prompt_id, filled, used, dropped, reservation));
                break;
            }
            Err(e) => {
                // 파일을 못 읽은 것은 서버를 바꿔도 같습니다 — 바로 돌려줍니다.
                if e.starts_with("그림을 읽지 못했습니다") || e == "보낼 프롬프트가 없습니다." {
                    return Err(e);
                }
                rejections.push(format!("{} — {e}", host_of(&base)));
            }
        }
    }
    let Some((base, prompt_id, filled, lora_used, lora_dropped, _reservation)) = accepted else {
        return Err(format!("어느 사내 ComfyUI 도 요청을 받지 않았습니다.\n{}", rejections.join("\n")));
    };
    let host = host_of(&base).to_string();
    job.submitted(&base, &prompt_id);
    // 올리는 사이에 멈추기를 눌렀으면 방금 올린 것을 바로 거둡니다.
    if job.cancelled() {
        withdraw(&client, &base, &prompt_id).await;
        return Err(CANCELLED.into());
    }

    // 끝날 때까지 기다립니다. 대기열에 있으면 몇 번째인지, 돌고 있으면 얼마나 지났는지 알립니다.
    let deadline = Instant::now() + Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));
    let queued_at = Instant::now();
    let mut running_since: Option<Instant> = None;
    let outputs = loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        // 거두기는 `comfy_cancel` 이 이미 했습니다. 여기서는 기다리기만 그만둡니다.
        if job.cancelled() {
            return Err(CANCELLED.into());
        }
        if Instant::now() > deadline {
            withdraw(&client, &base, &prompt_id).await;
            return Err(format!("사내 ComfyUI({host})에서 시간 안에 끝나지 않아 요청을 거뒀습니다."));
        }
        let history: Value = match client.get(format!("{base}/history/{prompt_id}")).timeout(Duration::from_secs(15)).send().await {
            Ok(response) => response.json().await.unwrap_or_default(),
            // 잠깐 끊긴 것은 실패가 아닙니다 — 기다리던 서버에 다시 묻습니다.
            Err(_) => continue,
        };
        if let Some(entry) = history.get(&prompt_id) {
            if entry.pointer("/status/status_str").and_then(Value::as_str) == Some("error") {
                let detail = entry
                    .pointer("/status/messages")
                    .and_then(Value::as_array)
                    .and_then(|messages| {
                        messages.iter().find_map(|m| {
                            (m.get(0).and_then(Value::as_str) == Some("execution_error"))
                                .then(|| m.pointer("/1/exception_message").and_then(Value::as_str).unwrap_or("").to_string())
                        })
                    })
                    .unwrap_or_default();
                let brief: String = detail.chars().take(400).collect();
                return Err(format!("사내 ComfyUI({host})가 실행 중 실패했습니다: {brief}"));
            }
            let completed = entry.pointer("/status/completed").and_then(Value::as_bool).unwrap_or(false);
            if completed {
                break entry.get("outputs").cloned().unwrap_or_default();
            }
        }
        // 아직이면 대기열에서 몇 번째인지 봅니다.
        let queue: Value = match client.get(format!("{base}/queue")).timeout(Duration::from_secs(10)).send().await {
            Ok(response) => response.json().await.unwrap_or_default(),
            Err(_) => Value::Null,
        };
        let has = |key: &str| {
            queue.get(key).and_then(Value::as_array).map(|items| {
                items.iter().position(|item| item.get(1).and_then(Value::as_str) == Some(prompt_id.as_str()))
            })
        };
        let message = if matches!(has("queue_running"), Some(Some(_))) {
            let since = *running_since.get_or_insert_with(Instant::now);
            format!("사내 ComfyUI({host})에서 만드는 중… {}초", since.elapsed().as_secs())
        } else if let Some(Some(index)) = has("queue_pending") {
            let running = queue.get("queue_running").and_then(Value::as_array).map(|a| a.len()).unwrap_or(0);
            format!("사내 ComfyUI({host}) 대기열 {}번째 · {}초째 기다리는 중", index + running + 1, queued_at.elapsed().as_secs())
        } else {
            format!("사내 ComfyUI({host})에서 마무리하는 중…")
        };
        emit_progress(&app, &engine, &message);
    };

    let item = outputs
        .pointer(&format!("/{}/{}/0", filled.output_node, filled.output_key))
        .cloned()
        .ok_or("결과 파일이 없습니다. 워크플로가 아무것도 저장하지 않았습니다.")?;
    let filename = item.get("filename").and_then(Value::as_str).ok_or("결과에 파일 이름이 없습니다.")?.to_string();
    let subfolder = item.get("subfolder").and_then(Value::as_str).unwrap_or("").to_string();
    let kind = item.get("type").and_then(Value::as_str).unwrap_or("output").to_string();
    emit_progress(&app, &engine, &format!("사내 ComfyUI({host})에서 결과를 받는 중…"));
    let response = client
        .get(format!("{base}/view"))
        .query(&[("filename", filename.as_str()), ("subfolder", subfolder.as_str()), ("type", kind.as_str())])
        .timeout(Duration::from_secs(900))
        .send()
        .await
        .map_err(|e| comfy_net_err(&base, e))?;
    if !response.status().is_success() {
        return Err(format!("결과 파일을 받지 못했습니다 ({}).", response.status()));
    }
    let mut bytes = response.bytes().await.map_err(|e| err("결과 파일을 받지 못했습니다", e))?.to_vec();
    if bytes.is_empty() {
        return Err("결과 파일이 비어 있습니다.".into());
    }
    let remote_ext = Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if out_ext == "wav" && remote_ext == "flac" {
        bytes = flac_to_wav(&bytes)?;
    }

    // 로컬과 같은 규칙: 자리를 잡고, 임시 파일에 쓴 뒤 이름을 바꿉니다(반쪽짜리가 남지 않게).
    let stem = out.file_stem().and_then(|n| n.to_str()).unwrap_or("결과").to_string();
    let mut reserved = reserve_free_path(&out, &out_dir, &stem, &out_ext)?;
    let final_path = reserved.path.clone();
    let final_stem = final_path.file_stem().and_then(|n| n.to_str()).unwrap_or(&stem).to_string();
    let temp = out_dir.join(format!(".{final_stem}.생성중.{tag}.{out_ext}"));
    if let Err(e) = fs::write(&temp, &bytes) {
        let _ = fs::remove_file(&temp);
        return Err(err("결과를 쓰지 못했습니다", e));
    }
    if let Err(e) = fs::rename(&temp, &final_path) {
        let _ = fs::remove_file(&temp);
        return Err(err("결과 파일로 바꾸지 못했습니다", e));
    }
    reserved.keep();

    // 원격에서는 못 하는 것들 — 조용히 버리지 않고 결과에 적습니다.
    let mut ignored: Vec<&str> = Vec::new();
    if non_empty(&opts, "motion_mask").is_some() {
        ignored.push("움직임 마스크");
    }
    if opts.get("control").is_some_and(|v| !v.is_null()) {
        ignored.push("동작 기준(포즈)");
    }
    let all_refs = opts.get("references").and_then(Value::as_array).map(|a| a.len()).unwrap_or(0);
    let sent_refs = filled.values.get("references").and_then(Value::as_u64).unwrap_or(0) as usize;
    let mut meta = filled.values.clone();
    meta.remove("prefix");
    meta.insert("backend".into(), json!("comfy"));
    meta.insert("endpoint".into(), json!(base));
    meta.insert("prompt_id".into(), json!(prompt_id));
    meta.insert("workflow".into(), json!(workflow));
    meta.insert("references_dropped".into(), json!(all_refs.saturating_sub(sent_refs)));
    meta.insert("loras_used".into(), json!(lora_used));
    meta.insert("loras_dropped".into(), json!(lora_dropped));
    meta.insert("ignored".into(), json!(ignored));
    if !rejections.is_empty() {
        meta.insert("rejected_by".into(), json!(rejections));
    }
    Ok(GenerateResult {
        output: final_path.to_string_lossy().to_string(),
        seconds: started.elapsed().as_secs_f64(),
        meta: Value::Object(meta),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn filled(name: &str, opts: Value, image: Option<&str>, refs: &[String]) -> Filled {
        fill(&workflow_doc(name).unwrap(), &opts, image, refs, "aimoviestorage/test", 7).unwrap()
    }

    /// 모든 링크가 그래프 안의 노드를 가리키는가 — 틀린 번호 하나면 서버가 통째로 거절합니다.
    fn assert_links_resolve(graph: &Map<String, Value>) {
        for (id, node) in graph {
            assert!(node.get("class_type").and_then(Value::as_str).is_some(), "{id} 에 class_type 이 없습니다");
            for (input, value) in node["inputs"].as_object().unwrap() {
                if let Some([target, slot]) = value.as_array().map(|a| a.as_slice()) {
                    if let (Some(target), Some(_)) = (target.as_str(), slot.as_u64()) {
                        assert!(graph.contains_key(target), "{id}.{input} 이 없는 노드 {target} 를 가리킵니다");
                    }
                }
            }
        }
    }

    #[test]
    fn every_workflow_fills_and_links_resolve() {
        let opts = json!({ "prompt": "a cat", "seconds": 3, "lyrics": "" });
        for (name, _) in WORKFLOWS {
            let doc = workflow_doc(name).unwrap();
            let needs_image = doc["bind"].get("image").is_some();
            let refs = if doc.get("references").is_some() { vec!["a.png".to_string()] } else { vec![] };
            let result = fill(&doc, &opts, needs_image.then_some("first.png"), &refs, "p", 1).unwrap();
            assert_links_resolve(&result.graph);
            assert!(result.graph.contains_key(&result.output_node), "{name} 의 출력 노드가 없습니다");
        }
    }

    #[test]
    fn every_remote_engine_has_a_workflow() {
        for engine in REMOTE_ENGINES {
            let name = pick_workflow(engine, &json!({})).unwrap();
            assert!(workflow_doc(name).is_ok(), "{engine} → {name}");
        }
    }

    #[test]
    fn picks_variant_by_inputs() {
        assert_eq!(pick_workflow("minimaxh3", &json!({})).unwrap(), "minimaxh3_t2v");
        assert_eq!(pick_workflow("minimaxh3", &json!({ "image": "a.png" })).unwrap(), "minimaxh3_i2v");
        // 레퍼런스가 있으면 첫 프레임보다 레퍼런스가 이깁니다(ref2va 는 키프레임을 받지 않습니다).
        let both = json!({ "image": "a.png", "references": [{ "kind": "image", "path": "b.png" }] });
        assert_eq!(pick_workflow("minimaxh3", &both).unwrap(), "minimaxh3_r2v");
        // 소리 레퍼런스만 있으면 그림 레퍼런스가 아닙니다.
        let audio_only = json!({ "references": [{ "kind": "audio", "path": "b.wav" }] });
        assert_eq!(pick_workflow("minimaxh3", &audio_only).unwrap(), "minimaxh3_t2v");
        assert_eq!(pick_workflow("wanvideo", &json!({ "image": " " })).unwrap(), "wanvideo_t2v");
        assert!(pick_workflow("sam3dbody", &json!({})).is_err());
    }

    #[test]
    fn prompt_size_and_seed_land_in_graph() {
        let result = filled("qwenimage", json!({ "prompt": "hello", "width": 1000, "height": 563 }), None, &[]);
        assert_eq!(result.graph["452"]["inputs"]["prompt"], "hello");
        assert_eq!(result.graph["456"]["inputs"]["width"], 1008);
        assert_eq!(result.graph["456"]["inputs"]["height"], 560);
        assert_eq!(result.graph["458"]["inputs"]["seed"], 7);
        assert_eq!(result.graph["460"]["inputs"]["filename_prefix"], "aimoviestorage/test");
        // 네거티브를 안 주면 워크플로의 기본값이 들어갑니다.
        assert!(result.graph["452"]["inputs"]["negative_prompt"].as_str().unwrap().contains("watermark"));
    }

    #[test]
    fn qwen_references_become_numbered_image_inputs() {
        let refs = vec!["x.png".to_string(), "y.png".to_string()];
        let result = filled("qwenimage", json!({ "prompt": "p" }), None, &refs);
        assert_eq!(result.graph["452"]["inputs"]["images.image_1"], json!(["ref1", 0]));
        assert_eq!(result.graph["452"]["inputs"]["images.image_2"], json!(["ref2", 0]));
        assert_eq!(result.graph["ref2"]["inputs"]["image"], "y.png");
        assert_eq!(result.graph["452"]["inputs"]["vae"], json!(["39", 0]));
    }

    #[test]
    fn h3_references_start_at_zero_and_frames_follow_17n_plus_5() {
        let refs = vec!["x.png".to_string()];
        let result = filled("minimaxh3_r2v", json!({ "prompt": "p", "seconds": 3, "fps": 16 }), None, &refs);
        assert_eq!(result.graph["104"]["inputs"]["ref_images.ref_image_0"], json!(["ref0", 0]));
        // 3초 × 24fps = 72 → 17n+5 로 올리면 73. fps 는 H3 가 24 로 고정합니다.
        assert_eq!(result.graph["104"]["inputs"]["length"], 73);
        assert_eq!(result.values["fps"], 24);
        let five = filled("minimaxh3_t2v", json!({ "prompt": "p", "seconds": 5 }), None, &[]);
        assert_eq!(five.graph["104"]["inputs"]["length"], 124);
    }

    #[test]
    fn video_frames_follow_model_step() {
        let wan = filled("wanvideo_t2v", json!({ "prompt": "p", "seconds": 3 }), None, &[]);
        assert_eq!(wan.graph["74"]["inputs"]["length"], 49);
        let ltx = filled("ltx25_t2v", json!({ "prompt": "p", "seconds": 3, "width": 1024, "height": 576 }), None, &[]);
        assert_eq!(ltx.graph["356"]["inputs"]["length"], 73);
        assert_eq!(ltx.graph["366"]["inputs"]["frames_number"], 73);
        // 절반 크기로 뽑고 두 배로 올립니다.
        assert_eq!(ltx.graph["356"]["inputs"]["width"], 512);
        assert_eq!(ltx.graph["356"]["inputs"]["height"], 288);
        // 길이는 워크플로의 상한에서 자릅니다.
        let long = filled("wanvideo_t2v", json!({ "prompt": "p", "seconds": 60 }), None, &[]);
        assert_eq!(long.graph["74"]["inputs"]["length"], 161);
    }

    #[test]
    fn first_frame_is_required_for_i2v() {
        let doc = workflow_doc("wanvideo_i2v").unwrap();
        assert!(fill(&doc, &json!({ "prompt": "p" }), None, &[], "p", 1).is_err());
        let ok = fill(&doc, &json!({ "prompt": "p" }), Some("first.png"), &[], "p", 1).unwrap();
        assert_eq!(ok.graph["97"]["inputs"]["image"], "first.png");
    }

    #[test]
    fn empty_prompt_is_refused() {
        let doc = workflow_doc("zimage").unwrap();
        assert!(fill(&doc, &json!({ "prompt": "   " }), None, &[], "p", 1).is_err());
    }

    #[test]
    fn music_uses_lyrics_or_instrumental() {
        let inst = filled("acestep", json!({ "prompt": "lofi", "seconds": 20 }), None, &[]);
        assert_eq!(inst.graph["94"]["inputs"]["lyrics"], "[inst]");
        assert_eq!(inst.graph["94"]["inputs"]["duration"], 20.0);
        assert_eq!(inst.graph["98"]["inputs"]["seconds"], 20.0);
        let sung = filled("acestep", json!({ "prompt": "pop", "lyrics": "[verse]\nhi" }), None, &[]);
        assert_eq!(sung.graph["94"]["inputs"]["lyrics"], "[verse]\nhi");
    }

    #[test]
    fn loras_attach_only_when_server_has_them() {
        let doc = workflow_doc("qwenimage").unwrap();
        let mut result = fill(&doc, &json!({ "prompt": "p" }), None, &[], "p", 1).unwrap();
        let loras = vec![
            ("C:\\loras\\Qwen-Image-Lightning-4steps-V1.0.safetensors".to_string(), 0.8),
            ("C:\\loras\\mine.safetensors".to_string(), 1.0),
        ];
        let remote = vec!["Lunark/image/Qwen-Image-Lightning-4steps-V1.0.safetensors".to_string()];
        let (used, dropped) = attach_loras(&doc, &mut result.graph, &loras, &remote);
        assert_eq!(used, remote);
        assert_eq!(dropped, vec!["mine.safetensors".to_string()]);
        assert_eq!(result.graph["lora0"]["inputs"]["model"], json!(["37", 0]));
        assert_eq!(result.graph["458"]["inputs"]["model"], json!(["lora0", 0]));
        assert_links_resolve(&result.graph);
    }

    #[test]
    fn rank_prefers_idle_then_free_vram_and_skips_dead() {
        let status = |url: &str, ok: bool, running: u64, pending: u64, reserved: u64, free: f64| EndpointStatus {
            url: url.into(),
            ok,
            error: None,
            device: String::new(),
            vram_total_gb: 24.0,
            vram_free_gb: free,
            running,
            pending,
            reserved,
            latency_ms: 1,
        };
        let ranked = rank(&[
            status("a", true, 1, 3, 0, 20.0),
            status("b", false, 0, 0, 0, 24.0),
            status("c", true, 0, 0, 1, 10.0),
            status("d", true, 0, 0, 0, 5.0),
            status("e", true, 0, 0, 0, 7.0),
        ]);
        let order: Vec<&str> = ranked.iter().map(|s| s.url.as_str()).collect();
        assert_eq!(order, vec!["e", "d", "c", "a"]);
    }

    /// 동시에 들어온 요청이 같은 상태를 보더라도, 앞의 예약을 보고 다른 서버로 흩어집니다.
    #[test]
    fn simultaneous_requests_spread_across_servers() {
        let idle = |url: &str| EndpointStatus {
            url: url.into(),
            ok: true,
            error: None,
            device: String::new(),
            vram_total_gb: 24.0,
            vram_free_gb: 20.0,
            running: 0,
            pending: 0,
            reserved: 0,
            latency_ms: 1,
        };
        let statuses = vec![idle("spread-a"), idle("spread-b"), idle("spread-c")];
        let (first, r1) = rank_and_reserve(&statuses);
        let (second, r2) = rank_and_reserve(&statuses);
        let (third, r3) = rank_and_reserve(&statuses);
        let picked = [&first[0].url, &second[0].url, &third[0].url];
        assert_eq!(picked, [&"spread-a".to_string(), &"spread-b".to_string(), &"spread-c".to_string()]);
        // 끝난 작업의 예약은 풀려서, 그 서버가 다시 1순위가 됩니다.
        drop(r1);
        let (fourth, r4) = rank_and_reserve(&statuses);
        assert_eq!(fourth[0].url, "spread-a");
        drop((r2, r3, r4));
    }

    /// 멈추기 표: 올라간 작업만 찾히고, 끝나면 표에서 내려갑니다.
    #[test]
    fn cancel_marks_only_registered_jobs() {
        let job = JobEntry::register(Some("cancel-test".into()));
        assert!(!job.cancelled());
        job.submitted("http://server", "prompt-1");
        assert_eq!(
            jobs().lock().unwrap()["cancel-test"].submitted,
            Some(("http://server".to_string(), "prompt-1".to_string()))
        );
        // 서버를 부르지 않고, 표시가 되는지만 봅니다.
        jobs().lock().unwrap().get_mut("cancel-test").unwrap().cancelled = true;
        assert!(job.cancelled());
        drop(job);
        assert!(!jobs().lock().unwrap().contains_key("cancel-test"));
        // 번호 없이 부른 작업은 표에 오르지 않고, 멈출 수도 없습니다.
        let anonymous = JobEntry::register(None);
        assert!(!anonymous.cancelled());
        assert!(!tauri::async_runtime::block_on(comfy_cancel("no-such-job".into())).unwrap());
    }

    #[test]
    fn endpoints_are_normalized_and_deduplicated() {
        let list = normalize_endpoints(&[
            "192.168.0.136:8191/".into(),
            "http://192.168.0.136:8191".into(),
            " ".into(),
            "https://gpu.example:443".into(),
        ]);
        assert_eq!(list, vec!["http://192.168.0.136:8191", "https://gpu.example:443"]);
    }
}
