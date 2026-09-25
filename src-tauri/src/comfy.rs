//! **ComfyUI 업스케일 다리** — 2026-09-18 에 `lib.rs` 에서 떼어 냈습니다.
//!
//! 앱이 품은 로컬 엔진(`upscale.rs`)과는 별개입니다. 이쪽은 «사용자가 이미 돌리고 있는
//! 바깥 ComfyUI» 에 그림만 갈아 끼워 큐에 넣고 결과를 받아 오는 길입니다.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::{err, next_numbered_path, safe_name, Res};

// ─────────────────────────────────────────────────────────────────────────────
// ComfyUI 업스케일 다리
// ─────────────────────────────────────────────────────────────────────────────
//
// (2026-09-08).
//
// 모델을 앱에 품지 않습니다. 사용자가 이미 ComfyUI 를 돌리고 있으니, 거기서 만든 워크플로
// (Save (API Format) JSON) 에 그림만 갈아 끼워 큐에 넣고 결과를 받아 옵니다.
// 웹뷰에서 직접 부르지 않는 이유: ComfyUI 는 기본으로 CORS 헤더를 안 주어서
// 브라우저 fetch 가 막힙니다. LLM 호출과 같은 이유로 여기서 합니다.

/// 업스케일 결과로 쓸 수 있는 그림 확장자. 다른 확장자는 쓰지 않습니다 —
/// 프런트가 경로를 잘못 넘겨도 그림이 아닌 파일이 덮이면 안 됩니다.
pub const UPSCALE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyWorkflowInfo {
    node_count: usize,
    load_image_nodes: usize,
    save_image_nodes: usize,
    /// `class_type` 에 "SeedVR2" 가 들어가고 `inputs.new_resolution` 이 있는 노드 수.
    /// 0 이면 목표 크기를 못 넣고 워크플로 그대로 돌립니다.
    seedvr2_nodes: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUpscaleResult {
    /// 결과가 놓인 자리 (덮어썼으면 out_path 그대로, 번호를 붙였으면 새 경로)
    pub(crate) path: String,
    /// SeedVR2 노드에 넣은 짧은 변 값. None 이면 워크플로를 손대지 않았습니다.
    pub(crate) seedvr2_resolution: Option<u32>,
}

/// 업스케일 결과 자리를 **보내기 전에** 확인합니다 — 그림 확장자, 폴더가 있음, 원본과 같은 폴더.
/// 돌려주는 값은 (결과 확장자, 결과 폴더).
///
/// 사내 ComfyUI 업스케일(`comfy_gen::comfy_upscale_fleet`)도 이 한 벌을 씁니다 — 같은 명령의
/// 두 갈래가 서로 다른 검사를 하면, 느슨한 쪽이 «디스크 어디든 덮어쓰는» 길이 됩니다.
pub(crate) fn check_upscale_target(source: &PathBuf, out: &PathBuf) -> Res<(String, PathBuf)> {
    let out_ext = out
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !UPSCALE_EXTENSIONS.contains(&out_ext.as_str()) {
        return Err("결과 자리는 png·jpg·webp 그림 경로여야 합니다.".into());
    }
    let Some(out_dir) = out.parent().filter(|p| p.is_dir()) else {
        return Err("결과를 놓을 폴더가 없습니다.".into());
    };
    let source_dir = source
        .parent()
        .and_then(|p| p.canonicalize().ok())
        .ok_or("원본 그림의 폴더를 확인하지 못했습니다.")?;
    let target_dir = out_dir
        .canonicalize()
        .map_err(|e| err("결과 폴더를 확인하지 못했습니다", e))?;
    if source_dir != target_dir {
        return Err("업스케일 결과는 원본과 같은 폴더에만 놓을 수 있습니다.".into());
    }
    Ok((out_ext, out_dir.to_path_buf()))
}

/// 받은 결과 그림을 자리에 놓습니다 — 임시 파일에 쓴 뒤 이름 바꾸기(받다 끊겨도 원본이 반쪽이 되지 않게).
/// `numbered` 면 `<stem>_001` 식으로 새 파일, 아니면 `out` 을 덮어씁니다. 확장자가 png 가 아니면 다시 인코딩합니다.
pub(crate) fn place_upscaled(result_bytes: &[u8], out: &PathBuf, out_dir: &PathBuf, out_ext: &str, numbered: bool) -> Res<PathBuf> {
    let final_path = if numbered {
        let stem = out
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|s| !s.is_empty())
            .ok_or("결과 파일 이름이 비어 있습니다.")?;
        next_numbered_path(out_dir, &safe_name(stem), out_ext)
    } else {
        out.clone()
    };
    let temp = out_dir.join(format!(
        ".{}.업스케일중",
        final_path.file_name().and_then(|n| n.to_str()).unwrap_or("결과")
    ));
    let written: Result<(), String> = if out_ext == "png" {
        // ComfyUI SaveImage 는 png 를 냅니다. 그대로 씁니다.
        fs::write(&temp, result_bytes).map_err(|e| err("결과를 쓰지 못했습니다", e))
    } else {
        // 원본이 jpg·webp 면 확장자에 맞춰 다시 인코딩합니다 — 내용은 png 인데 이름만
        // jpg 면 나중에 `image::open` 이 확장자를 믿고 읽다 실패합니다.
        image::load_from_memory(result_bytes)
            .map_err(|e| err("결과 그림을 읽지 못했습니다", e))
            .and_then(|decoded| {
                let format = image::ImageFormat::from_extension(out_ext).unwrap_or(image::ImageFormat::Png);
                decoded.save_with_format(&temp, format).map_err(|e| err("결과를 쓰지 못했습니다", e))
            })
    };
    // 쓰다 실패하면(디스크 가득·권한) 반쪽짜리 `.…업스케일중` 이 주인 폴더에 남습니다. 목록에는
    // 안 뜨지만 폴더 이름 바꾸기가 훑는 범위 안에 «앱이 만든 정체 모를 파일» 이 쌓이니
    // 우리가 만든 것은 우리가 치웁니다(rename 실패 갈래와 같은 처리).
    if let Err(e) = written {
        let _ = fs::remove_file(&temp);
        return Err(e);
    }
    if let Err(e) = fs::rename(&temp, &final_path) {
        let _ = fs::remove_file(&temp);
        return Err(err("결과 파일로 바꾸지 못했습니다", e));
    }
    Ok(final_path)
}

/// 주소를 정리합니다. 비면 기본 자리, 끝의 `/` 는 뗍니다.
pub fn comfy_base(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return "http://127.0.0.1:8188".to_string();
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    }
}

/// 연결 오류를 사람 말로. «연결 안 됨» 과 «시간 초과» 는 원인이 달라 따로 말합니다.
pub fn comfy_net_err(base: &str, e: reqwest::Error) -> String {
    if e.is_connect() {
        format!("ComfyUI 에 연결하지 못했습니다 ({base}). ComfyUI 가 켜져 있는지, 주소가 맞는지 확인하세요.")
    } else if e.is_timeout() {
        "ComfyUI 응답이 없습니다 (시간 초과).".to_string()
    } else {
        err("ComfyUI 요청이 실패했습니다", e)
    }
}

/// Save (API Format) JSON 을 읽습니다. `{ "번호": { class_type, inputs } }` 꼴이어야 합니다.
pub fn read_comfy_workflow(path: &str) -> Res<serde_json::Map<String, serde_json::Value>> {
    let text = fs::read_to_string(path).map_err(|e| err("워크플로 파일을 읽지 못했습니다", e))?;
    let value: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| err("워크플로 JSON 을 읽지 못했습니다", e))?;
    let Some(map) = value.as_object() else {
        return Err("워크플로 JSON 의 맨 바깥이 객체가 아닙니다.".into());
    };
    // 메뉴의 일반 Save 는 { nodes: [...], links: [...] } 꼴이라 큐에 넣을 수 없습니다.
    // 헷갈리기 쉬운 실수라 이유를 바로 말해 줍니다.
    if map.contains_key("nodes") && map.contains_key("links") {
        return Err("일반 저장 JSON 입니다. ComfyUI 메뉴의 Save (API Format) 로 다시 저장해 고르세요.".into());
    }
    if !map.values().any(|node| node.get("class_type").is_some()) {
        return Err("class_type 이 있는 노드가 없습니다. Save (API Format) 로 저장한 JSON 이 맞는지 확인하세요.".into());
    }
    Ok(map.clone())
}

pub fn inspect_comfy_workflow(map: &serde_json::Map<String, serde_json::Value>) -> ComfyWorkflowInfo {
    let class_of = |node: &serde_json::Value| node.get("class_type").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let has_new_resolution = |node: &serde_json::Value| {
        node.get("inputs")
            .and_then(|v| v.as_object())
            .map(|inputs| inputs.contains_key("new_resolution"))
            .unwrap_or(false)
    };
    ComfyWorkflowInfo {
        node_count: map.len(),
        load_image_nodes: map.values().filter(|n| class_of(n) == "LoadImage").count(),
        save_image_nodes: map.values().filter(|n| class_of(n) == "SaveImage").count(),
        seedvr2_nodes: map
            .values()
            .filter(|n| class_of(n).contains("SeedVR2") && has_new_resolution(n))
            .count(),
    }
}

/// 설정 화면에서 고른 워크플로가 쓸 만한지 미리 봅니다.
#[tauri::command]
pub fn comfy_inspect_workflow(workflow_path: String) -> Res<ComfyWorkflowInfo> {
    let map = read_comfy_workflow(&workflow_path)?;
    Ok(inspect_comfy_workflow(&map))
}

/// «연결 확인» — GET /system_stats. 판과 장치 이름을 한 줄로 돌려줍니다.
#[tauri::command]
pub async fn comfy_check_connection(base_url: String) -> Res<String> {
    let base = comfy_base(&base_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .map_err(|e| err("HTTP 클라이언트를 만들지 못했습니다", e))?;
    let response = client
        .get(format!("{base}/system_stats"))
        .send()
        .await
        .map_err(|e| comfy_net_err(&base, e))?;
    if !response.status().is_success() {
        return Err(format!("ComfyUI 가 {} 로 답했습니다. 주소가 ComfyUI 가 맞는지 확인하세요.", response.status()));
    }
    let stats: serde_json::Value = response
        .json()
        .await
        .map_err(|e| err("system_stats 를 읽지 못했습니다", e))?;
    let version = stats
        .pointer("/system/comfyui_version")
        .and_then(|v| v.as_str())
        .unwrap_or("판 미상");
    let device = stats
        .pointer("/devices/0/name")
        .and_then(|v| v.as_str())
        .unwrap_or("장치 미상");
    let vram = stats
        .pointer("/devices/0/vram_total")
        .and_then(|v| v.as_u64())
        .map(|bytes| format!(" · VRAM {:.0} GB", bytes as f64 / 1_073_741_824.0))
        .unwrap_or_default();
    Ok(format!("ComfyUI {version} · {device}{vram}"))
}

/// 그림 한 장을 ComfyUI 워크플로에 태워 업스케일하고 결과를 `out_path` 에 씁니다.
///
/// 흐름: 워크플로 읽기 → `/upload/image` 로 그림 올리기 → 유일한 LoadImage 노드의
/// `inputs.image` 에 올린 이름 넣기 → (target_size 가 있고 SeedVR2 노드가 있으면
/// `new_resolution` 채우기) → `/prompt` 큐 → `/history/{id}` 1초 폴링 → 첫 결과 그림을
/// `/view` 로 받아 임시 파일에 쓴 뒤 이름 바꾸기.
///
/// - `out_path` 는 그림 확장자여야 하고 그 폴더가 이미 있어야 합니다. 원본과 같은 경로를
/// 주면 **덮어씁니다** — 6면 세트는 이름이 곧 세트라 이름을 지켜야 합니다.
/// - `numbered` 가 true 면 `out_path` 를 `<폴더>/<stem>.<ext>` 틀로 보고 `_001`… 번호를
/// 붙여 새 파일로 만듭니다(저장 규칙과 같음 — 덮어쓰지 않음). «업스케일 단추» 용.
/// - `target_size` 는 목표 **긴 변**. SeedVR2 의 `new_resolution` 은 짧은 변이라
/// 원본 비율로 환산해 16 의 배수로 넣습니다. 다른 업스케일 노드면 손대지 않습니다.
/// - 임시 파일을 거치는 이유: 받다가 끊기면 원본이 반쪽짜리로 덮입니다.
#[tauri::command]
pub async fn comfy_upscale_image(
    base_url: String,
    workflow_path: String,
    image_path: String,
    out_path: String,
    timeout_secs: Option<u64>,
    target_size: Option<u32>,
    numbered: Option<bool>,
) -> Res<ComfyUpscaleResult> {
    use std::time::{Duration, Instant};

    let base = comfy_base(&base_url);
    let mut workflow = read_comfy_workflow(&workflow_path)?;

    let source = PathBuf::from(&image_path);
    if !source.is_file() {
        return Err("업스케일할 원본 그림을 찾지 못했습니다.".into());
    }
    let out = PathBuf::from(&out_path);
    /*
      **결과는 원본과 같은 폴더에만 씁니다.**

      2026-09-18 점검에서 드러났습니다 — 여기에는 폴더 범위 검사가 **하나도 없었습니다.**
      방어라고는 확장자와 «부모 폴더가 있는가» 둘뿐이라, `numbered` 가 꺼져 있으면
      결과를 놓는 이름 바꾸기가 **디스크 어디에 있는 png·jpg 든 말없이 덮어썼습니다.**

      같은 파일의 `delete_project_media_file`·`claim_project_inbox_file`·
      `resolve_image_files` 는 모두 `ensure_inside` 를 거칩니다. 여기만 빠져 있었습니다.

      이 명령에는 저장 폴더 인자가 없어서 `ensure_inside` 를 그대로 쓸 수 없습니다.
      대신 **부르는 쪽이 늘 지키는 사실**을 못 박습니다 — 업스케일 결과는 원본 곁에
      놓습니다(`upscale.ts` 의 `runComfy`). 이러면 원본이 프로젝트 폴더 안에 있는 한
      결과도 그 안입니다. 검사는 `check_upscale_target` 한 벌입니다.

      CLAUDE.md: 「의도한 대상은 좁았는데 실제 명령의 사정거리가 넓었다」.
    */
    let (out_ext, out_dir) = check_upscale_target(&source, &out)?;

    // LoadImage 는 하나여야 합니다. 여럿이면 어느 것에 넣을지 알 수 없습니다.
    let load_ids: Vec<String> = workflow
        .iter()
        .filter(|(_, node)| node.get("class_type").and_then(|v| v.as_str()) == Some("LoadImage"))
        .map(|(id, _)| id.clone())
        .collect();
    let load_id = match load_ids.as_slice() {
        [one] => one.clone(),
        [] => return Err("워크플로에 LoadImage 노드가 없습니다. 원본을 받을 LoadImage 노드 하나가 필요합니다.".into()),
        _ => return Err(format!("워크플로에 LoadImage 노드가 {}개입니다. 하나만 남기세요.", load_ids.len())),
    };

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| err("HTTP 클라이언트를 만들지 못했습니다", e))?;

    // 1) 올리기 — ComfyUI 의 input 폴더로. overwrite 를 켜서 같은 이름을 다시 보내도 새 판이 쓰입니다.
    let bytes = fs::read(&source).map_err(|e| err("원본 그림을 읽지 못했습니다", e))?;
    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("frameforge.png")
        .to_string();
    let mime = match source.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "image/png",
    };
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(file_name)
        .mime_str(mime)
        .map_err(|e| err("업로드 형식을 만들지 못했습니다", e))?;
    let form = reqwest::multipart::Form::new()
        .part("image", part)
        .text("overwrite", "true");
    let uploaded = client
        .post(format!("{base}/upload/image"))
        .multipart(form)
        .timeout(Duration::from_secs(180))
        .send()
        .await
        .map_err(|e| comfy_net_err(&base, e))?;
    if !uploaded.status().is_success() {
        return Err(format!("그림 올리기를 ComfyUI 가 거절했습니다 ({}).", uploaded.status()));
    }
    let uploaded: serde_json::Value = uploaded
        .json()
        .await
        .map_err(|e| err("업로드 응답을 읽지 못했습니다", e))?;
    let name = uploaded
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("업로드 응답에 파일 이름이 없습니다.")?;
    let subfolder = uploaded.get("subfolder").and_then(|v| v.as_str()).unwrap_or("");
    let image_ref = if subfolder.is_empty() { name.to_string() } else { format!("{subfolder}/{name}") };
    workflow[&load_id]["inputs"]["image"] = serde_json::json!(image_ref);

    // 2) 목표 크기 — SeedVR2 에만. 짧은 변 = 목표 × 짧은변/긴변, 16 의 배수.
    let mut seedvr2_resolution = None;
    if let Some(target) = target_size.filter(|t| *t > 0) {
        if let Ok((width, height)) = image::image_dimensions(&source) {
            let long = width.max(height).max(1) as f64;
            let short = width.min(height) as f64;
            let value = (((target as f64) * short / long) / 16.0).round().max(1.0) as u32 * 16;
            for node in workflow.values_mut() {
                let is_seedvr2 = node
                    .get("class_type")
                    .and_then(|v| v.as_str())
                    .map(|c| c.contains("SeedVR2"))
                    .unwrap_or(false);
                if !is_seedvr2 {
                    continue;
                }
                if let Some(inputs) = node.get_mut("inputs").and_then(|v| v.as_object_mut()) {
                    if inputs.contains_key("new_resolution") {
                        inputs.insert("new_resolution".into(), serde_json::json!(value));
                        seedvr2_resolution = Some(value);
                    }
                }
            }
        }
    }

    // 3) 큐에 넣기
    let client_id = format!(
        "frameforge-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );
    let queued = client
        .post(format!("{base}/prompt"))
        .json(&serde_json::json!({ "prompt": workflow, "client_id": client_id }))
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| comfy_net_err(&base, e))?;
    let status = queued.status();
    let text = queued.text().await.unwrap_or_default();
    if !status.is_success() {
        // 노드 오류(모델 없음 등)는 본문에 들어 있습니다. 길면 앞만.
        let brief: String = text.chars().take(400).collect();
        return Err(format!("ComfyUI 가 워크플로를 받지 않았습니다 ({status}): {brief}"));
    }
    let queued: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| err("큐 응답을 읽지 못했습니다", e))?;
    let prompt_id = queued
        .get("prompt_id")
        .and_then(|v| v.as_str())
        .ok_or("큐 응답에 prompt_id 가 없습니다.")?
        .to_string();

    // 4) 끝날 때까지 1초마다 물어봅니다. 업스케일은 몇 분씩 걸리니 기본 한도를 넉넉히.
    let deadline = Instant::now() + Duration::from_secs(timeout_secs.unwrap_or(900));
    let outputs = loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
        if Instant::now() > deadline {
            return Err("업스케일이 시간 안에 끝나지 않았습니다 (시간 초과). ComfyUI 큐를 확인하세요.".into());
        }
        let history: serde_json::Value = client
            .get(format!("{base}/history/{prompt_id}"))
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| comfy_net_err(&base, e))?
            .json()
            .await
            .map_err(|e| err("진행 상태를 읽지 못했습니다", e))?;
        let Some(entry) = history.get(&prompt_id) else { continue };
        if let Some(status) = entry.get("status") {
            if status.get("status_str").and_then(|v| v.as_str()) == Some("error") {
                let detail = status
                    .get("messages")
                    .map(|m| m.to_string())
                    .unwrap_or_default();
                let brief: String = detail.chars().take(400).collect();
                return Err(format!("ComfyUI 가 실행 중 실패했습니다: {brief}"));
            }
        }
        if let Some(outputs) = entry.get("outputs").and_then(|v| v.as_object()) {
            let done = entry
                .pointer("/status/completed")
                .and_then(|v| v.as_bool())
                .unwrap_or(!outputs.is_empty());
            if done {
                break outputs.clone();
            }
        }
    };

    // 5) 첫 결과 그림
    let image = outputs
        .values()
        .find_map(|node| node.get("images").and_then(|v| v.as_array()).and_then(|a| a.first()).cloned())
        .ok_or("결과 그림이 없습니다. 워크플로에 SaveImage 노드가 있는지 확인하세요.")?;
    let filename = image
        .get("filename")
        .and_then(|v| v.as_str())
        .ok_or("결과 그림에 파일 이름이 없습니다.")?;
    let result_subfolder = image.get("subfolder").and_then(|v| v.as_str()).unwrap_or("");
    let result_type = image.get("type").and_then(|v| v.as_str()).unwrap_or("output");
    let result = client
        .get(format!("{base}/view"))
        .query(&[("filename", filename), ("subfolder", result_subfolder), ("type", result_type)])
        .timeout(Duration::from_secs(600))
        .send()
        .await
        .map_err(|e| comfy_net_err(&base, e))?;
    if !result.status().is_success() {
        return Err(format!("결과 그림을 받지 못했습니다 ({}).", result.status()));
    }
    let result_bytes = result
        .bytes()
        .await
        .map_err(|e| err("결과 그림을 받지 못했습니다", e))?;
    if result_bytes.is_empty() {
        return Err("결과 그림이 비어 있습니다.".into());
    }

    // 6) 임시 파일 → 이름 바꾸기. numbered 면 저장 규칙대로 번호를 붙입니다.
    let final_path = place_upscaled(&result_bytes, &out, &out_dir, &out_ext, numbered.unwrap_or(false))?;

    Ok(ComfyUpscaleResult {
        path: final_path.to_string_lossy().to_string(),
        seedvr2_resolution,
    })
}
