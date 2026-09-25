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

/// 사내 SeedVR2 업스케일(3B fp8). 생성 엔진이 아니라서 `WORKFLOWS` 와 따로 둡니다.
const UPSCALE_WORKFLOW: &str = include_str!("comfy_workflows/upscale/seedvr2.json");
/// 목표가 원본의 `TWO_PASS_RATIO` 배를 넘으면 두 단계로 올립니다(`upscale_plan`).
const UPSCALE_2PASS_WORKFLOW: &str = include_str!("comfy_workflows/upscale/seedvr2_2pass.json");

/// 한 번에 이보다 크게 올리면 SeedVR2 3B 가 피부에 격자무늬를 지어냅니다(2배는 깨끗, 4배는 무늬).
const TWO_PASS_RATIO: f64 = 2.2;

/// 업스케일을 한 번에 할지 두 번에 할지. 두 번이면 첫 단계의 긴 변(원본의 2배)을 함께 돌려줍니다.
pub(crate) fn upscale_plan(source_long: u32, target_long: u32) -> (&'static str, Option<u32>) {
    if source_long > 0 && target_long as f64 > source_long as f64 * TWO_PASS_RATIO {
        ("seedvr2_upscale_2pass", Some(source_long * 2))
    } else {
        ("seedvr2_upscale", None)
    }
}

/// 사내 ComfyUI 로 뽑을 수 있는 엔진. 프런트가 «원격으로 쓸 수 있는가» 를 이것으로 압니다.
pub const REMOTE_ENGINES: &[&str] = &["qwenimage", "zimage", "krea2", "minimaxh3", "wanvideo", "ltx25", "acestep"];

fn workflow_doc(name: &str) -> Res<Value> {
    let text = if name == "seedvr2_upscale" {
        UPSCALE_WORKFLOW
    } else if name == "seedvr2_upscale_2pass" {
        UPSCALE_2PASS_WORKFLOW
    } else {
        WORKFLOWS
            .iter()
            .find(|(id, _)| *id == name)
            .map(|(_, text)| *text)
            .ok_or_else(|| format!("워크플로가 없습니다: {name}"))?
    };
    serde_json::from_str(text).map_err(|e| err("내장 워크플로를 읽지 못했습니다", e))
}

fn non_empty<'a>(opts: &'a Value, key: &str) -> Option<&'a str> {
    opts.get(key).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty())
}

/// 레퍼런스 — 종류별로 나눠 **차례를 지켜** 담습니다. H3 는 차례대로 `<Picture 1>`·`<Video 1>`·
/// `<Audio 1>` 이라 부르므로, 같은 것을 다른 차례로 주면 다른 요청이 됩니다.
#[derive(Default, Clone, Debug, PartialEq)]
pub(crate) struct Refs {
    pub images: Vec<String>,
    pub videos: Vec<String>,
    pub audios: Vec<String>,
}

impl Refs {
    #[cfg(test)]
    fn of_images(images: &[&str]) -> Self {
        Refs { images: images.iter().map(|s| s.to_string()).collect(), ..Refs::default() }
    }

    fn total(&self) -> usize {
        self.images.len() + self.videos.len() + self.audios.len()
    }
}

/// 요청의 `references` 를 종류별로 가릅니다(로컬 파일 경로).
fn references_of(opts: &Value) -> Refs {
    let mut refs = Refs::default();
    for item in opts.get("references").and_then(Value::as_array).into_iter().flatten() {
        let Some(path) = non_empty(item, "path").map(str::to_string) else { continue };
        match item.get("kind").and_then(Value::as_str) {
            Some("image") => refs.images.push(path),
            Some("video") => refs.videos.push(path),
            Some("audio") => refs.audios.push(path),
            _ => {}
        }
    }
    refs
}

/// 엔진과 요청으로 워크플로를 고릅니다. 첫 프레임이 있으면 그림→영상, 레퍼런스가 있으면(H3) 레퍼런스→영상.
pub(crate) fn pick_workflow(engine: &str, opts: &Value) -> Res<&'static str> {
    let has_image = non_empty(opts, "image").is_some();
    // 소리만으로는 레퍼런스→영상을 돌리지 않습니다 — 볼 것(그림·영상)이 하나는 있어야 합니다.
    let refs = references_of(opts);
    let has_refs = !refs.images.is_empty() || !refs.videos.is_empty();
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
/// - `refs` 는 서버에 올린 레퍼런스 이름들(종류별, 차례가 곧 뜻입니다)
pub(crate) fn fill(doc: &Value, opts: &Value, image: Option<&str>, refs: &Refs, prefix: &str, seed: u64) -> Res<Filled> {
    let defaults = doc.get("defaults").cloned().unwrap_or_else(|| json!({}));
    let mut graph = doc
        .get("graph")
        .and_then(Value::as_object)
        .cloned()
        .ok_or("워크플로에 graph 가 없습니다.")?;

    let bind = doc.get("bind").and_then(Value::as_object).ok_or("워크플로에 bind 가 없습니다.")?;
    let mut values = Map::new();
    // 프롬프트는 워크플로가 받을 때만 필수입니다(업스케일은 글을 받지 않습니다).
    match non_empty(opts, "prompt") {
        Some(prompt) => {
            values.insert("prompt".into(), json!(prompt));
        }
        None if bind.contains_key("prompt") => return Err("보낼 프롬프트가 없습니다.".into()),
        None => {}
    }
    if let Some(long_edge) = num(opts.get("long_edge")) {
        values.insert("long_edge".into(), json!(long_edge.round() as u64));
    }
    if let Some(mid) = num(opts.get("long_edge_mid")) {
        values.insert("long_edge_mid".into(), json!(mid.round() as u64));
    }
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

    /*
      **«빠르게»** — 워크플로가 `fast` 갈래를 선언했고 요청이 `speed: "fast"` 면 터보 로라를 얹고
      스텝을 줄입니다. 사람이 고른 로라는 이 뒤에 잇습니다(`lora_after`).
    */
    let wants_fast = non_empty(opts, "speed") == Some("fast");
    if let (true, Some(fast)) = (wants_fast, doc.get("fast")) {
        let lora = fast.get("lora").and_then(Value::as_str).ok_or("fast.lora 가 비었습니다.")?;
        let after = fast.get("after").and_then(Value::as_str).ok_or("fast.after 가 비었습니다.")?;
        graph.insert(
            "fastlora".into(),
            json!({ "class_type": "LoraLoaderModelOnly", "inputs": { "model": [after, 0], "lora_name": lora, "strength_model": 1.0 } }),
        );
        for target in fast.get("into").and_then(Value::as_array).into_iter().flatten() {
            let (Some(node), Some(input)) = (target.get(0).and_then(Value::as_str), target.get(1).and_then(Value::as_str)) else { continue };
            if let Some(inputs) = graph.get_mut(node).and_then(|v| v.get_mut("inputs")).and_then(Value::as_object_mut) {
                inputs.insert(input.to_string(), json!(["fastlora", 0]));
            }
        }
        let steps = fast.get("step_count").and_then(Value::as_u64).unwrap_or(8);
        for target in fast.get("steps").and_then(Value::as_array).into_iter().flatten() {
            let (Some(node), Some(input)) = (target.get(0).and_then(Value::as_str), target.get(1).and_then(Value::as_str)) else { continue };
            if let Some(inputs) = graph.get_mut(node).and_then(|v| v.get_mut("inputs")).and_then(Value::as_object_mut) {
                inputs.insert(input.to_string(), json!(steps));
            }
        }
        values.insert("speed".into(), json!("fast"));
        values.insert("lora_after".into(), json!("fastlora"));
    } else if doc.get("fast").is_some() {
        values.insert("speed".into(), json!("high"));
    }

    let mut sent = 0;
    sent += attach_refs(&mut graph, doc.get("references"), &refs.images, RefKind::Image)?;
    sent += attach_refs(&mut graph, doc.get("video_references"), &refs.videos, RefKind::Video)?;
    sent += attach_refs(&mut graph, doc.get("audio_references"), &refs.audios, RefKind::Audio)?;
    if sent > 0 {
        values.insert("references".into(), json!(sent));
    }

    let output_node = doc.pointer("/output/node").and_then(Value::as_str).ok_or("워크플로에 output.node 가 없습니다.")?.to_string();
    let output_key = doc.pointer("/output/key").and_then(Value::as_str).unwrap_or("images").to_string();
    Ok(Filled { graph, values, output_node, output_key })
}

#[derive(Clone, Copy)]
enum RefKind {
    Image,
    Video,
    Audio,
}

/// 레퍼런스 한 종류를 그래프에 답니다. 워크플로가 그 종류의 자리를 선언하지 않았으면 싣지 않습니다(0개).
///
/// - 그림: `LoadImage`
/// - 영상: `LoadVideo` → `GetVideoComponents` 의 프레임. H3 는 24fps 프레임을 받습니다
///   (구도잡기 타임라인이 24fps 라 그대로 맞습니다). 영상의 소리는 싣지 않습니다.
/// - 소리: `LoadAudio`
fn attach_refs(graph: &mut Map<String, Value>, spec: Option<&Value>, names: &[String], kind: RefKind) -> Res<usize> {
    let (Some(spec), false) = (spec, names.is_empty()) else { return Ok(0) };
    let max = spec.get("max").and_then(Value::as_u64).unwrap_or(1) as usize;
    let start = spec.get("start").and_then(Value::as_u64).unwrap_or(1) as usize;
    let node = spec.pointer("/input/0").and_then(Value::as_str).ok_or("references.input 이 비었습니다.")?.to_string();
    let pattern = spec.pointer("/input/1").and_then(Value::as_str).ok_or("references.input 이 비었습니다.")?.to_string();
    let count = names.len().min(max);
    for (offset, name) in names.iter().take(max).enumerate() {
        let n = start + offset;
        let link = match kind {
            RefKind::Image => {
                let id = format!("ref{n}");
                graph.insert(id.clone(), json!({ "class_type": "LoadImage", "inputs": { "image": name } }));
                json!([id, 0])
            }
            RefKind::Video => {
                let (load, frames) = (format!("refvideo{n}"), format!("refframes{n}"));
                graph.insert(load.clone(), json!({ "class_type": "LoadVideo", "inputs": { "file": name } }));
                graph.insert(frames.clone(), json!({ "class_type": "GetVideoComponents", "inputs": { "video": [load, 0] } }));
                json!([frames, 0])
            }
            RefKind::Audio => {
                let id = format!("refaudio{n}");
                graph.insert(id.clone(), json!({ "class_type": "LoadAudio", "inputs": { "audio": name } }));
                json!([id, 0])
            }
        };
        let inputs = graph
            .get_mut(&node)
            .and_then(|v| v.get_mut("inputs"))
            .and_then(Value::as_object_mut)
            .ok_or_else(|| format!("레퍼런스 자리가 없는 노드를 가리킵니다: {node}"))?;
        inputs.insert(pattern.replace("{n}", &n.to_string()), link);
    }
    for extra in spec.get("extra").and_then(Value::as_array).into_iter().flatten() {
        let (Some(n), Some(input), Some(value)) = (extra.get(0).and_then(Value::as_str), extra.get(1).and_then(Value::as_str), extra.get(2)) else {
            continue;
        };
        if let Some(inputs) = graph.get_mut(n).and_then(|v| v.get_mut("inputs")).and_then(Value::as_object_mut) {
            inputs.insert(input.to_string(), value.clone());
        }
    }
    Ok(count)
}

/// 서버에 같은 이름이 있는 로라만 겁니다. `after` 노드의 모델 출력 뒤에 줄줄이 달고, `into` 가 그 끝을 받게 합니다.
///
/// 로컬 로라는 이 컴퓨터의 파일 경로라 서버가 읽을 수 없습니다. 파일 이름이 서버의
/// `models/loras` 목록에 있는 것만 싣고, 나머지는 이름을 돌려줘 «못 실었다» 고 알립니다.
pub(crate) fn attach_loras(
    doc: &Value,
    graph: &mut Map<String, Value>,
    loras: &[(String, f64)],
    remote: &[String],
    after_override: Option<&str>,
) -> (Vec<String>, Vec<String>) {
    let mut used = Vec::new();
    let mut dropped = Vec::new();
    let Some(spec) = doc.get("loras") else {
        dropped.extend(loras.iter().map(|(name, _)| name.clone()));
        return (used, dropped);
    };
    // «빠르게» 로 터보 로라를 얹었으면 그 뒤에 잇습니다 — 아니면 사람 로라가 터보 로라를 건너뜁니다.
    let Some(after) = after_override.or_else(|| spec.get("after").and_then(Value::as_str)) else {
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
    /// 이 서버에 **지금 올라가 있을** 모델 파일 — 가장 최근 작업(대기 중인 마지막 것, 없으면 도는 것,
    /// 없으면 기록의 마지막 것)이 쓴 확산 모델. 같은 모델이면 적재(H3 약 130초)를 건너뜁니다.
    pub loaded_models: Vec<String>,
}

/// 모델을 새로 올리는 값을 «대기 중인 작업 몇 개» 로 친 것.
///
/// 2026-09-25 실측(H3 «빠르게», 3초 832×480): 모델이 올라가 있으면 한 편 43초이고 네 대를 동시에 써도
/// 거의 느려지지 않았습니다(처리량 1.41 → 5.28 편/분). 새로 올리면 한 편이 약 130초 더 걸립니다 —
/// 생성 세 편쯤입니다. 그림 모델은 적재가 훨씬 가벼우므로 보수적으로 2 로 잡습니다.
const COLD_LOAD_PENALTY: u64 = 2;

/// 그래프가 올리는 확산 모델(UNET·체크포인트) 파일 이름. 서버에 «이미 올라가 있는가» 를 견줄 때 씁니다.
pub(crate) fn models_of(graph: &Value) -> Vec<String> {
    let mut models: Vec<String> = graph
        .as_object()
        .into_iter()
        .flat_map(|g| g.values())
        .filter_map(|node| {
            let inputs = node.get("inputs")?;
            inputs.get("unet_name").or_else(|| inputs.get("ckpt_name")).and_then(Value::as_str).map(str::to_string)
        })
        .collect();
    models.sort();
    models.dedup();
    models
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
fn rank_and_reserve(statuses: &[EndpointStatus], wanted: &[String]) -> (Vec<EndpointStatus>, Option<Reservation>) {
    let Ok(mut map) = reserved_map().lock() else {
        return (rank(statuses, wanted), None);
    };
    let fresh: Vec<EndpointStatus> = statuses
        .iter()
        .cloned()
        .map(|mut status| {
            status.reserved = map.get(&status.url).copied().unwrap_or(0);
            status
        })
        .collect();
    let ranked = rank(&fresh, wanted);
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
        loaded_models: Vec::new(),
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
            // 대기열의 마지막 것이 끝나면 그 모델이 올라가 있게 됩니다. 비어 있으면 도는 것.
            let last = |key: &str| queue.get(key).and_then(Value::as_array).and_then(|a| a.last()).and_then(|item| item.get(2)).cloned();
            status.loaded_models = last("queue_pending").or_else(|| last("queue_running")).map(|g| models_of(&g)).unwrap_or_default();
        }
        Err(e) => status.error = Some(comfy_net_err(&base, e)),
    }
    if status.ok && status.loaded_models.is_empty() {
        // 한가하면 기록의 마지막 작업이 올려 둔 것입니다.
        if let Ok(response) = client.get(format!("{base}/history?max_items=1")).timeout(Duration::from_secs(5)).send().await {
            let history: Value = response.json().await.unwrap_or_default();
            if let Some(graph) = history.as_object().and_then(|h| h.values().next()).and_then(|e| e.pointer("/prompt/2")) {
                status.loaded_models = models_of(graph);
            }
        }
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

// ─────────────────────────────────────────────────────────────────────────────
// 사전 점검 — 워크플로가 요구하는 노드·모델이 서버에 있는가
// ─────────────────────────────────────────────────────────────────────────────
//
// 서버의 모델 파일 이름이 바뀌거나 노드가 빠지면, 지금까지는 **생성을 눌러야** 알았습니다
// (서버가 워크플로를 거절). «연결 확인» 에서 미리 봅니다. `/object_info` 한 번으로 노드 목록과
// 각 선택지(모델 파일 목록 포함)를 다 받을 수 있습니다.

/// 워크플로 하나가 서버에서 못 도는 까닭들. 비어 있으면 돕니다.
///
/// - 노드 종류가 서버에 없음
/// - 선택지 입력(모델 파일 이름 등)의 값이 서버의 선택지에 없음
///
/// 앱이 채우는 자리(LoadImage 의 파일 이름 등)는 그때그때 올리는 것이라 보지 않습니다.
pub(crate) fn missing_for(graph: &Map<String, Value>, object_info: &Value) -> Vec<String> {
    const FILLED_AT_RUN: &[&str] = &["LoadImage", "LoadVideo", "LoadAudio"];
    let mut missing = Vec::new();
    for node in graph.values() {
        let Some(class) = node.get("class_type").and_then(Value::as_str) else { continue };
        let Some(info) = object_info.get(class) else {
            missing.push(format!("노드 {class}"));
            continue;
        };
        if FILLED_AT_RUN.contains(&class) {
            continue;
        }
        for (name, value) in node.get("inputs").and_then(Value::as_object).into_iter().flatten() {
            let Some(value) = value.as_str() else { continue };
            let spec = info
                .pointer(&format!("/input/required/{name}"))
                .or_else(|| info.pointer(&format!("/input/optional/{name}")));
            let Some(spec) = spec else { continue };
            // 선택지는 두 꼴입니다: `[[값...], {...}]` 또는 `["COMBO", {"options": [값...]}]`.
            let options = spec
                .get(0)
                .and_then(Value::as_array)
                .or_else(|| (spec.get(0).and_then(Value::as_str) == Some("COMBO")).then(|| spec.pointer("/1/options")).flatten().and_then(Value::as_array));
            let Some(options) = options else { continue };
            // 동적 선택지(`{"key": ...}` 목록)는 값이 문자열 목록이 아니라 따로 셉니다.
            let listed = options.iter().any(|o| o.as_str() == Some(value) || o.get("key").and_then(Value::as_str) == Some(value));
            if !listed {
                missing.push(format!("{class}.{name} = {value}"));
            }
        }
    }
    missing.sort();
    missing.dedup();
    missing
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowCheck {
    pub workflow: String,
    pub engine: String,
    pub missing: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EndpointCheck {
    pub url: String,
    /// 서버에 닿지 못했으면 그 까닭. 그때 `workflows` 는 비어 있습니다.
    pub error: Option<String>,
    pub workflows: Vec<WorkflowCheck>,
}

async fn check_endpoint(client: &reqwest::Client, url: &str) -> EndpointCheck {
    let base = comfy_base(url);
    let fetched = client.get(format!("{base}/object_info")).timeout(Duration::from_secs(60)).send().await;
    let object_info: Value = match fetched {
        Ok(response) if response.status().is_success() => match response.json().await {
            Ok(value) => value,
            Err(e) => return EndpointCheck { url: base, error: Some(err("object_info 를 읽지 못했습니다", e)), workflows: vec![] },
        },
        Ok(response) => return EndpointCheck { url: base, error: Some(format!("ComfyUI 가 {} 로 답했습니다.", response.status())), workflows: vec![] },
        Err(e) => {
            let why = comfy_net_err(&base, e);
            return EndpointCheck { url: base, error: Some(why), workflows: vec![] };
        }
    };
    let workflows = WORKFLOWS
        .iter()
        .map(|(name, _)| *name)
        .chain(["seedvr2_upscale", "seedvr2_upscale_2pass"])
        .filter_map(|name| {
            let doc = workflow_doc(name).ok()?;
            let mut graph = doc.get("graph")?.as_object()?.clone();
            // «빠르게»(기본값)가 얹는 터보 로라도 서버에 있어야 합니다 — 그래프에는 없어서 따로 넣어 봅니다.
            if let Some(lora) = doc.pointer("/fast/lora").and_then(Value::as_str) {
                graph.insert(
                    "fastlora_check".into(),
                    json!({ "class_type": "LoraLoaderModelOnly", "inputs": { "lora_name": lora } }),
                );
            }
            Some(WorkflowCheck {
                workflow: name.to_string(),
                engine: doc.get("engine").and_then(Value::as_str).unwrap_or("").to_string(),
                missing: missing_for(&graph, &object_info),
            })
        })
        .collect();
    EndpointCheck { url: base, error: None, workflows }
}

/// 서버마다 내장 워크플로가 전부 도는지 봅니다(설정의 «연결 확인»).
#[tauri::command]
pub async fn comfy_fleet_check(endpoints: Vec<String>) -> Res<Vec<EndpointCheck>> {
    let client = http_client()?;
    let endpoints = normalize_endpoints(&endpoints);
    Ok(futures_util::future::join_all(endpoints.iter().map(|url| check_endpoint(&client, url))).await)
}

/// 사내 ComfyUI 로 뽑을 수 있는 엔진 id.
#[tauri::command]
pub fn comfy_remote_engines() -> Vec<String> {
    REMOTE_ENGINES.iter().map(|id| id.to_string()).collect()
}

/// 살아 있는 서버를 빨리 끝날 차례로 줄 세웁니다.
/// 값 = 짐(실행 + 대기 + 이 앱이 보낸 것) + (이 작업의 모델이 안 올라가 있으면 `COLD_LOAD_PENALTY`).
/// 같으면 VRAM 이 많이 빈 쪽, 그것도 같으면 등록한 차례.
///
/// `wanted` 는 이 작업이 쓰는 확산 모델(`models_of`). 비어 있으면 적재 벌점을 따지지 않습니다.
pub(crate) fn rank(statuses: &[EndpointStatus], wanted: &[String]) -> Vec<EndpointStatus> {
    let cost = |s: &EndpointStatus| {
        let warm = wanted.is_empty() || wanted.iter().any(|m| s.loaded_models.contains(m));
        s.running + s.pending + s.reserved + if warm { 0 } else { COLD_LOAD_PENALTY }
    };
    let mut alive: Vec<(usize, EndpointStatus)> = statuses.iter().cloned().enumerate().filter(|(_, s)| s.ok).collect();
    alive.sort_by(|(ia, a), (ib, b)| {
        cost(a)
            .cmp(&cost(b))
            .then(b.vram_free_gb.partial_cmp(&a.vram_free_gb).unwrap_or(std::cmp::Ordering::Equal))
            .then(ia.cmp(ib))
    });
    alive.into_iter().map(|(_, s)| s).collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// 올리기 · 받기
// ─────────────────────────────────────────────────────────────────────────────

/// 로컬 파일을 못 읽은 것 — 서버를 바꿔도 같으니 다음 서버로 넘기지 않습니다.
const READ_FAILED: &str = "파일을 읽지 못했습니다";

/// 파일 하나(그림·영상·소리)를 서버의 input 폴더에 올리고 워크플로에 넣을 이름을 돌려줍니다.
///
/// 이름은 **작업 번호로 새로 짓습니다** — 프로젝트 파일 이름은 한글이고, 서버 input 폴더는
/// 여러 사람이 같이 쓰므로 같은 이름(`소녀_001.png`)을 올리면 남의 그림을 덮습니다.
async fn upload_file(client: &reqwest::Client, base: &str, path: &str, tag: &str) -> Res<String> {
    let source = PathBuf::from(path);
    let bytes = fs::read(&source).map_err(|e| err(&format!("{READ_FAILED} ({path})"), e))?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_else(|| "png".into());
    // 이름이 `/upload/image` 이지만 영상·소리도 같은 input 폴더로 받습니다(LoadVideo·LoadAudio 가 거기서 읽음).
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
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
        return Err(format!("파일 올리기를 ComfyUI 가 거절했습니다 ({}).", response.status()));
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

/// 진행 줄. 생성은 로컬 모델과 같은 이벤트(`local-progress`)라 카드의 진행 문구가 그대로 움직입니다.
/// 업스케일은 설정 화면(업스케일) 쪽 이벤트로 보냅니다 — 로컬 모델 화면의 진행 줄이 움직이면 안 됩니다.
///
/// `job` 은 프런트가 준 작업 번호입니다. 같은 엔진으로 카드 여러 장을 동시에 돌리면 이벤트의 엔진 이름이
/// 같아서, 번호가 없으면 카드마다 남의 진행 문구(다른 서버·다른 대기 순번)가 뜹니다.
fn emit_progress_on(app: &AppHandle, event: &str, engine: &str, job: Option<&str>, message: &str) {
    let _ = app.emit(
        event,
        json!({
            "engine": engine,
            "job": job,
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

/// **우리가 보낸 것만** 거둡니다. 대기 중이면 대기열에서 빼고, 돌고 있을 때만 멈춥니다.
///
/// `/interrupt` 는 **지금 도는 작업이 우리 것일 때만** 보냅니다. `prompt_id` 를 무시하는 판의 ComfyUI 는
/// `/interrupt` 를 받으면 그 GPU 에서 도는 작업을 무조건 멈추는데, 우리 작업이 대기 중이었다면 그것은
/// 동료의 작업입니다(코드 리뷰 2026-09-25).
async fn withdraw(client: &reqwest::Client, base: &str, prompt_id: &str) {
    let queue: Value = match client.get(format!("{base}/queue")).timeout(Duration::from_secs(10)).send().await {
        Ok(response) => response.json().await.unwrap_or_default(),
        Err(_) => Value::Null,
    };
    let _ = client
        .post(format!("{base}/queue"))
        .json(&json!({ "delete": [prompt_id] }))
        .timeout(Duration::from_secs(10))
        .send()
        .await;
    if is_running(&queue, prompt_id) {
        let _ = client
            .post(format!("{base}/interrupt"))
            .json(&json!({ "prompt_id": prompt_id }))
            .timeout(Duration::from_secs(10))
            .send()
            .await;
    }
}

/// `/queue` 응답에서 이 작업이 지금 도는 중인가.
fn is_running(queue: &Value, prompt_id: &str) -> bool {
    queue
        .get("queue_running")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.get(1).and_then(Value::as_str) == Some(prompt_id)))
}

/// 업로드 이름에 섞을 값 — 작업 번호(프로세스 번호 + 순번)는 **PC 사이에서** 겹칠 수 있습니다.
/// 서버 input 폴더는 모두가 같이 쓰므로, 두 PC 가 같은 이름을 올리면 먼저 올린 사람의 첫 프레임이
/// 덮입니다(코드 리뷰 2026-09-25). 시각과 무작위 해시를 섞어 겹치지 않게 합니다.
fn unique_suffix() -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut hasher = std::collections::hash_map::RandomState::new().build_hasher();
    hasher.write_u128(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0),
    );
    format!("{:012x}", hasher.finish() & 0xffff_ffff_ffff)
}

/// 레퍼런스를 워크플로가 받는 수만큼만 남깁니다 — 받지 않을 파일을 올리지 않게.
fn trim_refs(doc: &Value, asked: Refs) -> Refs {
    let max = |key: &str| doc.pointer(&format!("/{key}/max")).and_then(Value::as_u64).map(|m| m as usize);
    let keep = |list: Vec<String>, key: &str| match (doc.get(key), max(key)) {
        (Some(_), Some(m)) => list.into_iter().take(m).collect(),
        (Some(_), None) => list,
        (None, _) => Vec::new(),
    };
    Refs {
        images: keep(asked.images, "references"),
        videos: keep(asked.videos, "video_references"),
        audios: keep(asked.audios, "audio_references"),
    }
}

/// 서버 하나에 보낼 요청의 재료. 서버를 바꿔 다시 보낼 때 같은 값을 그대로 씁니다.
struct Submission<'a> {
    doc: &'a Value,
    opts: &'a Value,
    image_path: Option<&'a str>,
    reference_paths: &'a Refs,
    loras: &'a [(String, f64)],
    prefix: &'a str,
    tag: &'a str,
    seed: u64,
}

/// 서버 하나에 그림을 올리고 워크플로를 큐에 넣습니다. 받아 주면 `(prompt_id, 채운 것, 실은 로라, 못 실은 로라)`.
async fn submit(client: &reqwest::Client, base: &str, request: &Submission<'_>) -> Res<(String, Filled, Vec<String>, Vec<String>)> {
    let tag = request.tag;
    let image = match request.image_path {
        Some(path) => Some(upload_file(client, base, path, &format!("{tag}_first")).await?),
        None => None,
    };
    let local = request.reference_paths;
    let mut refs = Refs::default();
    for (index, path) in local.images.iter().enumerate() {
        refs.images.push(upload_file(client, base, path, &format!("{tag}_ref{index}")).await?);
    }
    for (index, path) in local.videos.iter().enumerate() {
        refs.videos.push(upload_file(client, base, path, &format!("{tag}_video{index}")).await?);
    }
    for (index, path) in local.audios.iter().enumerate() {
        refs.audios.push(upload_file(client, base, path, &format!("{tag}_audio{index}")).await?);
    }
    let mut filled = fill(request.doc, request.opts, image.as_deref(), &refs, request.prefix, request.seed)?;
    let (used, dropped) = if request.loras.is_empty() {
        (Vec::new(), Vec::new())
    } else {
        let remote = remote_loras(client, base).await;
        let after = filled.values.get("lora_after").and_then(Value::as_str).map(str::to_string);
        attach_loras(request.doc, &mut filled.graph, request.loras, &remote, after.as_deref())
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

    fn id(&self) -> Option<&str> {
        self.0.as_deref()
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

/// 원격 작업 하나의 결과 — 받은 파일과, 어디서 무엇으로 뽑았는지.
struct Remote {
    base: String,
    prompt_id: String,
    filled: Filled,
    lora_used: Vec<String>,
    lora_dropped: Vec<String>,
    /// 받아 주기 전에 거절한 서버와 그 까닭.
    rejections: Vec<String>,
    tag: String,
    /// 서버가 붙인 결과 파일 이름(확장자로 flac 등을 가립니다).
    filename: String,
    bytes: Vec<u8>,
}

/// **서버 고르기 → 올리기 → 제출 → 기다리기 → 받기.** 생성(`comfy_generate`)과
/// 업스케일(`comfy_upscale_fleet`)이 같이 씁니다. 결과를 어디에 놓을지는 부르는 쪽이 정합니다
/// — 생성은 새 번호 자리, 업스케일은 원본 곁(덮어쓰기 또는 번호).
#[allow(clippy::too_many_arguments)]
async fn run_remote(
    app: &AppHandle,
    event: &str,
    engine: &str,
    doc: &Value,
    opts: &Value,
    endpoints: &[String],
    timeout_secs: Option<u64>,
    job: &JobEntry,
) -> Res<Remote> {
    let endpoints = normalize_endpoints(&endpoints);
    if endpoints.is_empty() {
        return Err("사내 ComfyUI 주소가 없습니다. 설정 → 사내 ComfyUI 에서 주소를 넣으세요.".into());
    }
    let client = http_client()?;
    emit_progress_on(app, event, engine, job.id(), "사내 ComfyUI 서버 상태를 확인하는 중…");
    let statuses = futures_util::future::join_all(endpoints.iter().map(|url| probe(&client, url))).await;
    // 1순위는 여기서 바로 예약됩니다 — 동시에 들어온 다른 요청이 같은 서버로 몰리지 않게(`rank_and_reserve`).
    // 이 작업의 모델이 이미 올라가 있는 서버를 우선합니다(`COLD_LOAD_PENALTY`).
    let wanted = doc.get("graph").map(models_of).unwrap_or_default();
    let (ranked, mut first_reservation) = rank_and_reserve(&statuses, &wanted);
    if ranked.is_empty() {
        let why: Vec<String> = statuses
            .iter()
            .map(|s| format!("{} — {}", host_of(&s.url), s.error.clone().unwrap_or_default()))
            .collect();
        return Err(format!("응답하는 사내 ComfyUI 가 없습니다.\n{}", why.join("\n")));
    }

    let tag = format!("{}_{}", job_tag().replace('-', "_"), unique_suffix());
    let seed = opts.get("seed").and_then(Value::as_u64).unwrap_or_else(|| {
        // 시드를 안 주면 매번 다른 그림이 나와야 합니다. 시각과 작업 번호를 섞습니다.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        nanos ^ (std::process::id() as u64).rotate_left(32)
    }) % 1_125_899_906_842_624;
    let prefix = format!("aimoviestorage/{engine}_{tag}");
    let image_path = non_empty(opts, "image").map(str::to_string);
    // 워크플로가 자리를 선언한 종류만, 받는 수만큼만 올립니다 — 나머지는 올리지 않고 «못 실음» 으로 셉니다.
    let reference_paths = trim_refs(doc, references_of(opts));
    /*
      **올리기 전에 한 번 채워 봅니다.** 프롬프트가 없거나 첫 프레임이 빠진 것은 서버를 바꿔도 같은
      실패입니다. 예전에는 파일을 다 올린 뒤에야 알았고, 서버 네 대에 차례로 같은 파일을 올렸습니다.
    */
    let placeholder = |list: &Vec<String>| list.iter().map(|_| "check".to_string()).collect::<Vec<_>>();
    let dry_refs = Refs {
        images: placeholder(&reference_paths.images),
        videos: placeholder(&reference_paths.videos),
        audios: placeholder(&reference_paths.audios),
    };
    fill(doc, opts, image_path.as_deref().map(|_| "check.png"), &dry_refs, &prefix, seed)?;
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
        emit_progress_on(app, event, engine, job.id(), &format!("{} 에 요청을 올리는 중…", host_of(&base)));
        let request = Submission {
            doc,
            opts,
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
                if e.starts_with(READ_FAILED) || e == "보낼 프롬프트가 없습니다." {
                    return Err(e);
                }
                rejections.push(format!("{} — {e}", host_of(&base)));
            }
        }
    }
    let Some((base, prompt_id, filled, lora_used, lora_dropped, reservation)) = accepted else {
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
    /*
      예약은 **서버 대기열에 보일 때까지만** 잡습니다. 보인 뒤에도 잡고 있으면 이 앱의 작업이 대기열과
      예약에서 두 번 세어져, 한가한 서버를 바쁜 서버로 봅니다(코드 리뷰 2026-09-25).
    */
    let mut reservation = Some(reservation);
    // 대기열에도 기록에도 없는 횟수. 서버가 다시 시작되면 작업이 사라져 끝없이 기다리게 됩니다.
    let mut unseen_polls = 0u32;
    let outputs = loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let _ = &reservation;
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
            reservation = None;
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
        let in_queue = |key: &str| {
            queue
                .get(key)
                .and_then(Value::as_array)
                .is_some_and(|items| items.iter().any(|item| item.get(1).and_then(Value::as_str) == Some(prompt_id.as_str())))
        };
        if in_queue("queue_running") || in_queue("queue_pending") {
            reservation = None;
            unseen_polls = 0;
        } else if queue.get("queue_running").is_some() && history.get(&prompt_id).is_none() {
            // 대기열을 제대로 받았는데 어디에도 없습니다. 끝나는 순간의 틈일 수 있어 몇 번 더 봅니다(약 10초).
            unseen_polls += 1;
            if unseen_polls >= 5 {
                return Err(format!(
                    "사내 ComfyUI({host})에서 작업이 사라졌습니다. 서버가 다시 시작되었거나 기록이 지워졌을 수 있습니다 — 다시 뽑아 주세요."
                ));
            }
        }
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
        emit_progress_on(app, event, engine, job.id(), &message);
    };

    let item = outputs
        .pointer(&format!("/{}/{}/0", filled.output_node, filled.output_key))
        .cloned()
        .ok_or("결과 파일이 없습니다. 워크플로가 아무것도 저장하지 않았습니다.")?;
    let filename = item.get("filename").and_then(Value::as_str).ok_or("결과에 파일 이름이 없습니다.")?.to_string();
    let subfolder = item.get("subfolder").and_then(Value::as_str).unwrap_or("").to_string();
    let kind = item.get("type").and_then(Value::as_str).unwrap_or("output").to_string();
    emit_progress_on(app, event, engine, job.id(), &format!("사내 ComfyUI({host})에서 결과를 받는 중…"));
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
    let bytes = response.bytes().await.map_err(|e| err("결과 파일을 받지 못했습니다", e))?.to_vec();
    if bytes.is_empty() {
        return Err("결과 파일이 비어 있습니다.".into());
    }
    Ok(Remote { base, prompt_id, filled, lora_used, lora_dropped, rejections, tag, filename, bytes })
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

    let remote = run_remote(&app, LOCAL.event, &engine, &doc, &opts, &endpoints, timeout_secs, &job).await?;
    let Remote { base, prompt_id, filled, lora_used, lora_dropped, rejections, tag, filename, bytes } = remote;
    let mut bytes = bytes;
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
    let all_refs = references_of(&opts).total();
    let sent_refs = filled.values.get("references").and_then(Value::as_u64).unwrap_or(0) as usize;
    let mut meta = filled.values.clone();
    meta.remove("prefix");
    meta.remove("lora_after");
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

/// 그림 한 장을 **사내 ComfyUI 의 SeedVR2** 로 업스케일합니다.
///
/// 설정의 «외부 — ComfyUI» 엔진이 워크플로 파일 없이 사내 ComfyUI 가 켜져 있을 때 이리로 옵니다
/// (`upscale.ts` 의 `runComfy`). 사용자가 워크플로 파일을 고를 필요가 없습니다.
/// 결과를 놓는 규칙은 기존 다리(`comfy::comfy_upscale_image`)와 같은 한 벌입니다 — 원본과 같은 폴더,
/// `numbered` 면 새 번호, 아니면 덮어쓰기.
///
/// 2026-09-24 사내 서버 실측(768×1024 → 긴 변 2048: 31초, 4096: 46초).
#[tauri::command]
pub async fn comfy_upscale_fleet(
    app: AppHandle,
    image_path: String,
    out_path: String,
    target_size: u32,
    numbered: Option<bool>,
    endpoints: Vec<String>,
    timeout_secs: Option<u64>,
) -> Res<crate::comfy::ComfyUpscaleResult> {
    let source = PathBuf::from(&image_path);
    if !source.is_file() {
        return Err("업스케일할 원본 그림을 찾지 못했습니다.".into());
    }
    let out = PathBuf::from(&out_path);
    let (out_ext, out_dir) = crate::comfy::check_upscale_target(&source, &out)?;
    let target = target_size.clamp(256, 8192);
    // 원본의 2.2배를 넘기면 2배씩 두 번에 나눠 올립니다(격자무늬 방지, `upscale_plan`).
    let source_long = image::image_dimensions(&source).map(|(w, h)| w.max(h)).unwrap_or(0);
    let (workflow, mid) = upscale_plan(source_long, target);
    let doc = workflow_doc(workflow)?;
    let mut opts = json!({ "image": image_path, "long_edge": target });
    if let Some(mid) = mid {
        opts["long_edge_mid"] = json!(mid);
    }
    let job = JobEntry::register(None);
    let remote = run_remote(&app, crate::upscale::UPSCALE.event, "seedvr2", &doc, &opts, &endpoints, timeout_secs, &job).await?;
    let final_path = crate::comfy::place_upscaled(&remote.bytes, &out, &out_dir, &out_ext, numbered.unwrap_or(false))?;
    Ok(crate::comfy::ComfyUpscaleResult {
        path: final_path.to_string_lossy().to_string(),
        seedvr2_resolution: Some(target_size),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn filled(name: &str, opts: Value, image: Option<&str>, refs: &Refs) -> Filled {
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
            let refs = Refs {
                images: if doc.get("references").is_some() { vec!["a.png".into()] } else { vec![] },
                videos: if doc.get("video_references").is_some() { vec!["a.mp4".into()] } else { vec![] },
                audios: if doc.get("audio_references").is_some() { vec!["a.wav".into()] } else { vec![] },
            };
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
        let result = filled("qwenimage", json!({ "prompt": "hello", "width": 1000, "height": 563 }), None, &Refs::default());
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
        let refs = Refs::of_images(&["x.png", "y.png"]);
        let result = filled("qwenimage", json!({ "prompt": "p" }), None, &refs);
        assert_eq!(result.graph["452"]["inputs"]["images.image_1"], json!(["ref1", 0]));
        assert_eq!(result.graph["452"]["inputs"]["images.image_2"], json!(["ref2", 0]));
        assert_eq!(result.graph["ref2"]["inputs"]["image"], "y.png");
        assert_eq!(result.graph["452"]["inputs"]["vae"], json!(["39", 0]));
    }

    #[test]
    fn h3_references_start_at_zero_and_frames_follow_17n_plus_5() {
        let refs = Refs::of_images(&["x.png"]);
        let result = filled("minimaxh3_r2v", json!({ "prompt": "p", "seconds": 3, "fps": 16 }), None, &refs);
        assert_eq!(result.graph["104"]["inputs"]["ref_images.ref_image_0"], json!(["ref0", 0]));
        // 3초 × 24fps = 72 → 17n+5 로 올리면 73. fps 는 H3 가 24 로 고정합니다.
        assert_eq!(result.graph["104"]["inputs"]["length"], 73);
        assert_eq!(result.values["fps"], 24);
        let five = filled("minimaxh3_t2v", json!({ "prompt": "p", "seconds": 5 }), None, &Refs::default());
        assert_eq!(five.graph["104"]["inputs"]["length"], 124);
    }

    /// H3 레퍼런스: 영상은 LoadVideo → 프레임, 소리는 LoadAudio 로 각 자리에 0번부터 붙습니다.
    #[test]
    fn h3_takes_video_and_audio_references() {
        let refs = Refs {
            images: vec!["pic.png".into()],
            videos: vec!["layout.mp4".into(), "motion.mp4".into()],
            audios: vec!["voice.wav".into()],
        };
        let result = filled("minimaxh3_r2v", json!({ "prompt": "p" }), None, &refs);
        let h3 = &result.graph["104"]["inputs"];
        assert_eq!(h3["ref_images.ref_image_0"], json!(["ref0", 0]));
        assert_eq!(h3["ref_videos.ref_video_0"], json!(["refframes0", 0]));
        assert_eq!(h3["ref_videos.ref_video_1"], json!(["refframes1", 0]));
        assert_eq!(h3["ref_audios.ref_audio_0"], json!(["refaudio0", 0]));
        assert_eq!(result.graph["refvideo1"]["inputs"]["file"], "motion.mp4");
        assert_eq!(result.graph["refframes0"]["class_type"], "GetVideoComponents");
        assert_eq!(result.values["references"], 4);
        assert_links_resolve(&result.graph);
        // 영상 레퍼런스만 있어도 레퍼런스→영상입니다. 소리만 있으면 아닙니다.
        let video_only = json!({ "references": [{ "kind": "video", "path": "a.mp4" }] });
        assert_eq!(pick_workflow("minimaxh3", &video_only).unwrap(), "minimaxh3_r2v");
        // Qwen 은 영상·소리 자리가 없습니다 — 그림만 싣습니다.
        let qwen = filled("qwenimage", json!({ "prompt": "p" }), None, &refs);
        assert_eq!(qwen.values["references"], 1);
    }

    /// «빠르게»: 터보 로라를 얹고 8스텝으로 줄이며, 사람 로라는 그 뒤에 잇습니다. 레퍼런스 모델에는 없습니다.
    #[test]
    fn h3_fast_mode_adds_turbo_lora_and_fewer_steps() {
        let high = filled("minimaxh3_t2v", json!({ "prompt": "p" }), None, &Refs::default());
        assert_eq!(high.graph["9"]["inputs"]["steps"], 20);
        assert!(!high.graph.contains_key("fastlora"));
        assert_eq!(high.values["speed"], "high");

        let doc = workflow_doc("minimaxh3_i2v").unwrap();
        let mut fast = fill(&doc, &json!({ "prompt": "p", "speed": "fast" }), Some("f.png"), &Refs::default(), "p", 1).unwrap();
        assert_eq!(fast.graph["9"]["inputs"]["steps"], 8);
        assert_eq!(fast.graph["16"]["inputs"]["model"], json!(["fastlora", 0]));
        assert_eq!(fast.graph["fastlora"]["inputs"]["model"], json!(["6", 0]));
        assert_eq!(fast.values["speed"], "fast");
        let after = fast.values["lora_after"].as_str().map(str::to_string);
        let remote = vec!["minimax_h3/Minimax_H3_Cinematic_Look_v01.safetensors".to_string()];
        let loras = vec![("D:\\loras\\Minimax_H3_Cinematic_Look_v01.safetensors".to_string(), 0.7)];
        attach_loras(&doc, &mut fast.graph, &loras, &remote, after.as_deref());
        assert_eq!(fast.graph["lora0"]["inputs"]["model"], json!(["fastlora", 0]));
        assert_eq!(fast.graph["16"]["inputs"]["model"], json!(["lora0", 0]));
        assert_links_resolve(&fast.graph);

        // 레퍼런스 모델(ref2va)에는 «빠르게» 갈래가 없어 그대로 20스텝입니다.
        let r2v = filled("minimaxh3_r2v", json!({ "prompt": "p", "speed": "fast" }), None, &Refs::of_images(&["a.png"]));
        assert_eq!(r2v.graph["9"]["inputs"]["steps"], 20);
        assert!(!r2v.graph.contains_key("fastlora"));
    }

    #[test]
    fn video_frames_follow_model_step() {
        let wan = filled("wanvideo_t2v", json!({ "prompt": "p", "seconds": 3 }), None, &Refs::default());
        assert_eq!(wan.graph["74"]["inputs"]["length"], 49);
        let ltx = filled("ltx25_t2v", json!({ "prompt": "p", "seconds": 3, "width": 1024, "height": 576 }), None, &Refs::default());
        assert_eq!(ltx.graph["356"]["inputs"]["length"], 73);
        assert_eq!(ltx.graph["366"]["inputs"]["frames_number"], 73);
        // 절반 크기로 뽑고 두 배로 올립니다.
        assert_eq!(ltx.graph["356"]["inputs"]["width"], 512);
        assert_eq!(ltx.graph["356"]["inputs"]["height"], 288);
        // 길이는 워크플로의 상한에서 자릅니다.
        let long = filled("wanvideo_t2v", json!({ "prompt": "p", "seconds": 60 }), None, &Refs::default());
        assert_eq!(long.graph["74"]["inputs"]["length"], 161);
    }

    #[test]
    fn first_frame_is_required_for_i2v() {
        let doc = workflow_doc("wanvideo_i2v").unwrap();
        assert!(fill(&doc, &json!({ "prompt": "p" }), None, &Refs::default(), "p", 1).is_err());
        let ok = fill(&doc, &json!({ "prompt": "p" }), Some("first.png"), &Refs::default(), "p", 1).unwrap();
        assert_eq!(ok.graph["97"]["inputs"]["image"], "first.png");
    }

    #[test]
    fn empty_prompt_is_refused() {
        let doc = workflow_doc("zimage").unwrap();
        assert!(fill(&doc, &json!({ "prompt": "   " }), None, &Refs::default(), "p", 1).is_err());
    }

    #[test]
    fn music_uses_lyrics_or_instrumental() {
        let inst = filled("acestep", json!({ "prompt": "lofi", "seconds": 20 }), None, &Refs::default());
        assert_eq!(inst.graph["94"]["inputs"]["lyrics"], "[inst]");
        assert_eq!(inst.graph["94"]["inputs"]["duration"], 20.0);
        assert_eq!(inst.graph["98"]["inputs"]["seconds"], 20.0);
        let sung = filled("acestep", json!({ "prompt": "pop", "lyrics": "[verse]\nhi" }), None, &Refs::default());
        assert_eq!(sung.graph["94"]["inputs"]["lyrics"], "[verse]\nhi");
    }

    #[test]
    fn loras_attach_only_when_server_has_them() {
        let doc = workflow_doc("qwenimage").unwrap();
        let mut result = fill(&doc, &json!({ "prompt": "p" }), None, &Refs::default(), "p", 1).unwrap();
        let loras = vec![
            ("C:\\loras\\Qwen-Image-Lightning-4steps-V1.0.safetensors".to_string(), 0.8),
            ("C:\\loras\\mine.safetensors".to_string(), 1.0),
        ];
        let remote = vec!["Lunark/image/Qwen-Image-Lightning-4steps-V1.0.safetensors".to_string()];
        let (used, dropped) = attach_loras(&doc, &mut result.graph, &loras, &remote, None);
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
            loaded_models: vec![],
        };
        let ranked = rank(&[
            status("a", true, 1, 3, 0, 20.0),
            status("b", false, 0, 0, 0, 24.0),
            status("c", true, 0, 0, 1, 10.0),
            status("d", true, 0, 0, 0, 5.0),
            status("e", true, 0, 0, 0, 7.0),
        ], &[]);
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
            loaded_models: vec![],
        };
        let statuses = vec![idle("spread-a"), idle("spread-b"), idle("spread-c")];
        let (first, r1) = rank_and_reserve(&statuses, &[]);
        let (second, r2) = rank_and_reserve(&statuses, &[]);
        let (third, r3) = rank_and_reserve(&statuses, &[]);
        let picked = [&first[0].url, &second[0].url, &third[0].url];
        assert_eq!(picked, [&"spread-a".to_string(), &"spread-b".to_string(), &"spread-c".to_string()]);
        // 끝난 작업의 예약은 풀려서, 그 서버가 다시 1순위가 됩니다.
        drop(r1);
        let (fourth, r4) = rank_and_reserve(&statuses, &[]);
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

    /// 사전 점검: 없는 노드·없는 모델 파일을 짚고, 앱이 채우는 자리는 보지 않습니다.
    #[test]
    fn preflight_spots_missing_nodes_and_models() {
        let object_info = json!({
            "UNETLoader": { "input": { "required": {
                "unet_name": [["qwen_image_2.1_int8_convrot.safetensors"], {}],
                "weight_dtype": [["default", "fp8"], {}]
            } } },
            "CLIPLoader": { "input": { "required": {
                "clip_name": ["COMBO", { "options": ["qwen3vl_8b_int8_convrot.safetensors"] }],
                "type": [["qwen_image"], {}]
            }, "optional": { "device": [["default"], {}] } } },
            "LoadImage": { "input": { "required": { "image": [["only-this.png"], {}] } } },
            "SaveVideo": { "input": { "required": { "format": ["COMFY_DYNAMICCOMBO_V3", { "options": [{ "key": "mp4" }] }] } } }
        });
        let graph: Map<String, Value> = serde_json::from_value(json!({
            "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "qwen_image_2.1_int8_convrot.safetensors", "weight_dtype": "default" } },
            "2": { "class_type": "CLIPLoader", "inputs": { "clip_name": "renamed_encoder.safetensors", "type": "qwen_image", "device": "default" } },
            "3": { "class_type": "LoadImage", "inputs": { "image": "" } },
            "4": { "class_type": "SaveVideo", "inputs": { "format": "mp4", "video": ["9", 0] } },
            "5": { "class_type": "TextEncodeQwenImage21", "inputs": { "prompt": "" } }
        }))
        .unwrap();
        let missing = missing_for(&graph, &object_info);
        assert_eq!(missing, vec!["CLIPLoader.clip_name = renamed_encoder.safetensors".to_string(), "노드 TextEncodeQwenImage21".to_string()]);
    }

    /// 업스케일: 프롬프트 없이 채워지고, 목표 긴 변이 크기 조절 노드에 들어갑니다.
    #[test]
    fn upscale_workflow_fills_without_prompt() {
        let doc = workflow_doc("seedvr2_upscale").unwrap();
        let result = fill(&doc, &json!({ "long_edge": 4096 }), Some("src.png"), &Refs::default(), "p", 3).unwrap();
        assert_eq!(result.graph["1"]["inputs"]["image"], "src.png");
        assert_eq!(result.graph["57"]["inputs"]["resize_type.longer_size"], 4096);
        assert_eq!(result.graph["57"]["inputs"]["resize_type"], "scale longer dimension");
        assert_links_resolve(&result.graph);
        // 생성 워크플로는 여전히 프롬프트가 필수입니다.
        assert!(fill(&workflow_doc("zimage").unwrap(), &json!({}), None, &Refs::default(), "p", 1).is_err());
    }

    /// 받는 수보다 많은 레퍼런스는 올리기 전에 잘라 냅니다. 자리가 없는 종류는 통째로 뺍니다.
    #[test]
    fn references_are_trimmed_to_what_the_workflow_takes() {
        let many = Refs {
            images: (0..6).map(|i| format!("{i}.png")).collect(),
            videos: (0..5).map(|i| format!("{i}.mp4")).collect(),
            audios: vec!["a.wav".into()],
        };
        let qwen = trim_refs(&workflow_doc("qwenimage").unwrap(), many.clone());
        assert_eq!(qwen.images.len(), 4);
        assert!(qwen.videos.is_empty() && qwen.audios.is_empty());
        let h3 = trim_refs(&workflow_doc("minimaxh3_r2v").unwrap(), many.clone());
        assert_eq!((h3.images.len(), h3.videos.len(), h3.audios.len()), (6, 3, 1));
        let wan = trim_refs(&workflow_doc("wanvideo_t2v").unwrap(), many);
        assert_eq!(wan.total(), 0);
    }

    /// 대기 중인 작업을 거둘 때는 interrupt 를 보내지 않습니다(돌고 있는 것은 남의 작업).
    #[test]
    fn interrupt_only_when_our_job_is_running() {
        let queue = json!({ "queue_running": [[1, "theirs", {}]], "queue_pending": [[2, "ours", {}]] });
        assert!(!is_running(&queue, "ours"));
        assert!(is_running(&queue, "theirs"));
        assert!(!is_running(&Value::Null, "ours"));
    }

    /// 업로드 이름에 섞는 값은 매번 다릅니다(PC 사이에서 겹치지 않게).
    #[test]
    fn upload_suffix_differs_each_time() {
        let a = unique_suffix();
        let b = unique_suffix();
        assert_ne!(a, b);
        assert_eq!(a.len(), 12);
    }

    /// 모델이 올라가 있는 서버를 우선합니다 — 앞 작업 하나를 기다리는 편이 새로 올리는 것보다 빠릅니다.
    /// 다만 대기가 벌점보다 길면 빈 서버로 갑니다.
    #[test]
    fn warm_server_wins_unless_its_queue_is_long() {
        let s = |url: &str, running: u64, pending: u64, loaded: &[&str]| EndpointStatus {
            url: url.into(),
            ok: true,
            error: None,
            device: String::new(),
            vram_total_gb: 24.0,
            vram_free_gb: 10.0,
            running,
            pending,
            reserved: 0,
            latency_ms: 1,
            loaded_models: loaded.iter().map(|m| m.to_string()).collect(),
        };
        let wanted = vec!["h3.safetensors".to_string()];
        // 모델이 올라간 서버가 하나 돌리는 중(값 1) vs 빈 서버지만 모델 없음(값 2) → 올라간 쪽
        let ranked = rank(&[s("cold", 0, 0, &["qwen.safetensors"]), s("warm", 1, 0, &["h3.safetensors"])], &wanted);
        assert_eq!(ranked[0].url, "warm");
        // 올라간 서버의 대기가 길면(값 3) 빈 서버(값 2)로
        let ranked = rank(&[s("cold", 0, 0, &[]), s("warm", 1, 2, &["h3.safetensors"])], &wanted);
        assert_eq!(ranked[0].url, "cold");
        // 워크플로가 모델을 모르면(업스케일 등) 짐만 봅니다
        let ranked = rank(&[s("a", 1, 0, &[]), s("b", 0, 0, &[])], &[]);
        assert_eq!(ranked[0].url, "b");
        // 그래프에서 확산 모델을 뽑습니다
        let models = models_of(&workflow_doc("minimaxh3_t2v").unwrap()["graph"]);
        assert_eq!(models, vec!["minimax_h3_fl2va_pruned_int8_convrot.safetensors".to_string()]);
        let music = models_of(&workflow_doc("acestep").unwrap()["graph"]);
        assert_eq!(music, vec!["ace_step_1.5_turbo_aio.safetensors".to_string()]);
    }

    /// 2.2배를 넘기면 두 단계로, 첫 단계는 원본의 2배. 두 단계 워크플로도 제대로 채워집니다.
    #[test]
    fn large_upscales_go_in_two_passes() {
        assert_eq!(upscale_plan(1024, 2048), ("seedvr2_upscale", None));
        assert_eq!(upscale_plan(1024, 2252), ("seedvr2_upscale", None));
        assert_eq!(upscale_plan(1024, 4096), ("seedvr2_upscale_2pass", Some(2048)));
        assert_eq!(upscale_plan(0, 4096), ("seedvr2_upscale", None));
        let doc = workflow_doc("seedvr2_upscale_2pass").unwrap();
        let result = fill(&doc, &json!({ "long_edge": 4096, "long_edge_mid": 2048 }), Some("src.png"), &Refs::default(), "p", 1).unwrap();
        assert_eq!(result.graph["s1resize"]["inputs"]["resize_type.longer_size"], 2048);
        assert_eq!(result.graph["s2resize"]["inputs"]["resize_type.longer_size"], 4096);
        assert_eq!(result.graph["s2resize"]["inputs"]["input"], json!(["s1post", 0]));
        assert_links_resolve(&result.graph);
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
