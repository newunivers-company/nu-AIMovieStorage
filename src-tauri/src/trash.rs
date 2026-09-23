//! 지운 것을 한 단계 두는 **휴지통**.
//!
//! # 왜 곧바로 없애지 않는가
//!
//! 화면에서 빼는 일과 프로젝트 저장이 따로 돕니다. 파일을 그 자리에서 없애 버리면,
//! 저장이 실패하거나 그 사이에 앱이 닫혔을 때 «목록에는 남아 있는데 파일은 없는»
//! 상태가 되고 되돌릴 길이 아예 없습니다. 그래서 지우기는 프로젝트 폴더 안
//! `.휴지통/` 으로 **옮기는 일**이고, 정말 없애는 것은 며칠 뒤 «비우기» 가 합니다.
//!
//! # 왜 쪽지를 파일마다 따로 적는가
//!
//! 되살리려면 «어디에 있던 것인가» 를 알아야 하는데 옮긴 파일에는 그 자리가 남지
//! 않습니다. 그래서 옮긴 것 옆에 같은 이름 + `.되살리기.json` 으로 적어 둡니다.
//! 한 곳에 모아 적지 않는 것은, 화면에서 여러 장을 한 번에 지우면 이 명령이
//! **동시에** 돌아서 한 파일을 서로 덮어쓰기 때문입니다.
//!
//! # 왜 파일의 시각을 쓰지 않는가
//!
//! 옮겨도 파일의 수정 시각은 «만든 때» 그대로입니다. 그것으로 나이를 재면 오래전에
//! 만든 그림은 지우자마자 비워집니다. 지운 때를 쪽지에 적고 그것으로 잽니다.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::{ensure_dir, ensure_inside, err, project_root, rename_file_safely, LockSafe, Res};

/// 휴지통 폴더 이름.
///
/// **폴더를 훑는 코드는 이 이름을 건너뜁니다.** 딸려 오면 지운 것이 목록에
/// 되살아난 것처럼 보입니다. 이름이 여러 곳에 흩어지면 한 곳만 고치게 되므로
/// 여기 한 벌만 둡니다.
pub(crate) const DIR: &str = ".휴지통";

/// 지운 자리를 적어 두는 쪽지의 꼬리. 옮긴 파일 이름 뒤에 그대로 붙습니다.
const RECORD_SUFFIX: &str = ".되살리기.json";

/// 며칠 지난 것을 정말로 지우는가. 실수를 알아채고 되살리기에 넉넉한 만큼입니다.
const KEEP_DAYS: u64 = 4;

/// 옮긴 것 하나의 쪽지.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrashRecord {
    /// 프로젝트 폴더 기준 상대 경로(`character/냥이/냥이_001.png`).
    ///
    /// 절대 경로로 적지 않는 것은, 저장 폴더를 통째로 옮기거나 이름을 바꿔도
    /// 되살아나야 하기 때문입니다.
    original_path: String,
    /// 지운 때(유닉스 초).
    deleted_at: u64,
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// 쪽지 파일의 자리. `냥이_001.png` → `냥이_001.png.되살리기.json`.
fn record_path(entry: &Path) -> PathBuf {
    let name = entry.file_name().unwrap_or_default().to_string_lossy().to_string();
    entry.with_file_name(format!("{name}{RECORD_SUFFIX}"))
}

fn is_record(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.ends_with(RECORD_SUFFIX))
        .unwrap_or(false)
}

/// 쪽지의 짝이 되는 파일 자리. 짝 없이 남은 쪽지를 치울 때 씁니다.
fn record_owner(record: &Path) -> Option<PathBuf> {
    let name = record.file_name()?.to_str()?;
    let base = name.strip_suffix(RECORD_SUFFIX)?;
    Some(record.with_file_name(base))
}

fn read_record(entry: &Path) -> Option<TrashRecord> {
    let text = fs::read_to_string(record_path(entry)).ok()?;
    serde_json::from_str(&text).ok()
}

/// 경로를 비교하기 좋은 글자로 고릅니다.
///
/// 되살릴 때 원래 파일은 이미 없어서 `canonicalize` 로 펼 수 없습니다. 드라이브
/// 글자의 대소문자와 `/`·`\` 가 섞여 들어와도 같은 자리로 봐야 합니다.
fn path_key(text: &str) -> String {
    text.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

/// 지우기 전 경로가 쪽지의 상대 경로와 같은 자리를 가리키는가.
fn points_at(wanted_key: &str, original: &str) -> bool {
    let tail = path_key(original);
    if tail.is_empty() {
        return false;
    }
    wanted_key == tail || wanted_key.ends_with(&format!("/{tail}"))
}

/// 쪽지에 적힌 자리를 프로젝트 폴더 아래의 실제 경로로 폅니다.
///
/// 쪽지는 사람이 편집기로 열 수 있는 글입니다. 그대로 `join` 하면 `..` 한 조각으로
/// 프로젝트 밖에 파일을 쏟고, 윈도우에서는 `C:` 한 조각이 경로를 통째로 갈아치웁니다.
/// 이 저장소가 생긴 사고가 «의도한 대상은 좁았는데 명령의 사정거리가 넓었다» 였으므로,
/// 조각을 하나씩 보고 이상하면 아예 되살리지 않습니다.
fn resolve_original(root: &Path, original: &str) -> Option<PathBuf> {
    let mut path = root.to_path_buf();
    let mut any = false;
    for part in original.split('/') {
        if part.is_empty() || part == "." || part == ".." || part.contains(':') || part.contains('\\') {
            return None;
        }
        path.push(part);
        any = true;
    }
    if any {
        Some(path)
    } else {
        None
    }
}

/// 이름을 고르고 쪽지를 적는 동안만 잠급니다.
///
/// 화면에서 여러 장을 한 번에 지우면 이 명령이 **동시에** 돕니다. 이름을 고르는 것과
/// 그 자리를 잡는 것 사이가 벌어지면 둘이 같은 이름을 골라 한쪽이 다른 쪽을 덮어씁니다.
static NAMING: Mutex<()> = Mutex::new(());

/// 휴지통 안에서 겹치지 않는 이름을 골라 **그 자리를 잡습니다.**
///
/// 잡는 방법은 쪽지 파일을 **«없을 때만 만들기»(`create_new`)** 로 적는 것입니다.
/// 이건 운영체제가 보장하는 한 걸음이라, 둘이 같은 이름을 고르면 **한쪽만 성공**합니다.
///
/// # 왜 «있나 보고 → 적기» 로는 안 되는가
///
/// 예전에는 `taken()` 으로 비었는지 보고 나서 적었습니다. 그 사이가 열려 있어서 둘이
/// 같은 이름을 고를 수 있었고, 서로 다른 폴더의 같은 이름 파일(`같은그림.png`) 둘을
/// 지우면 **하나만 남았습니다.** 프로세스 안의 자물쇠(`NAMING`)는 앱을 두 벌 띄우면
/// 소용이 없습니다 — 자물쇠가 프로세스마다 따로이기 때문입니다(2026-09-23 검토).
///
/// `next_numbered_path` 를 그대로 쓰지 않는 것은 폴더에는 확장자가 없어서입니다.
/// (`냥이` 가 `냥이_001.` 로 들어가면 탐색기에서 열리지 않습니다.)
fn reserve_dest(bin: &Path, name: &str, note: &str) -> Res<PathBuf> {
    let (stem, ext) = match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => (stem, Some(ext)),
        _ => (name, None),
    };
    let numbered = |tail: Option<String>| match (tail, ext) {
        (None, Some(ext)) => bin.join(format!("{stem}.{ext}")),
        (None, None) => bin.join(stem.to_string()),
        (Some(tail), Some(ext)) => bin.join(format!("{stem}_{tail}.{ext}")),
        (Some(tail), None) => bin.join(format!("{stem}_{tail}")),
    };
    let mut last: Option<std::io::Error> = None;
    for n in 0..10_000u32 {
        let candidate = numbered(if n == 0 { None } else { Some(format!("{:03}", n + 1)) });
        // 옮길 자리에 이미 무엇이 있으면 다음 번호로 — 쪽지만 잡아 놓고 덮으면 안 됩니다.
        if candidate.exists() {
            continue;
        }
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(record_path(&candidate))
        {
            Ok(mut handle) => {
                use std::io::Write;
                handle
                    .write_all(note.as_bytes())
                    .map_err(|e| err("휴지통 쪽지를 적지 못했습니다", e))?;
                return Ok(candidate);
            }
            // 남이 먼저 잡았습니다. 다음 번호를 봅니다.
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => last = Some(e),
        }
    }
    Err(match last {
        Some(e) => err("휴지통에 자리를 잡지 못했습니다", e),
        None => "휴지통에 빈 이름이 없습니다(10000개를 넘었습니다).".to_string(),
    })
}

/// 프로젝트 폴더 안의 파일·폴더를 `.휴지통/` 으로 옮깁니다. 옮긴 자리를 돌려줍니다.
///
/// 부르는 쪽이 이미 `ensure_inside` 로 프로젝트 안임을 확인했더라도 여기서 한 번 더
/// 폅니다 — 지우기는 되돌릴 수 없는 조작이라 사정거리를 두 곳에서 좁힙니다.
pub(crate) fn move_to_trash(root: &Path, target: &Path) -> Res<PathBuf> {
    let root_real = fs::canonicalize(root).map_err(|e| err("프로젝트 폴더를 찾지 못했습니다", e))?;
    let target_real = fs::canonicalize(target).map_err(|e| err("지울 것을 찾지 못했습니다", e))?;
    let relative = target_real
        .strip_prefix(&root_real)
        .map_err(|_| "프로젝트 폴더 밖의 것은 건드리지 않습니다.".to_string())?;
    if relative.as_os_str().is_empty() {
        return Err("프로젝트 폴더 자체는 지우지 않습니다.".into());
    }
    if relative
        .components()
        .next()
        .map(|c| c.as_os_str().to_string_lossy().as_ref() == DIR)
        .unwrap_or(false)
    {
        return Err("이미 휴지통에 있습니다.".into());
    }

    /*
      휴지통 경로는 **펴지 않은 쪽**으로 만듭니다. 윈도우의 `canonicalize` 는 `\\?\` 가
      붙은 경로를 돌려주는데, 그 모양이 화면과 기록에 섞여 들어가면 같은 파일이 다른
      파일로 보입니다.
    */
    let bin = root.join(DIR);
    ensure_dir(&bin)?;
    let name = relative.file_name().unwrap_or_default().to_string_lossy().to_string();
    let record = TrashRecord {
        original_path: relative.to_string_lossy().replace('\\', "/"),
        deleted_at: now_seconds(),
    };
    let text = serde_json::to_string(&record).map_err(|e| err("휴지통 쪽지를 만들지 못했습니다", e))?;

    /*
      쪽지를 **먼저** 적습니다. 두 가지 까닭입니다.
      - 옮긴 뒤에 적다가 실패하면 어디로 되살릴지 모르는 것이 휴지통에 남습니다.
        그건 그냥 지운 것과 다를 바 없습니다.
      - 쪽지가 곧 «이 이름은 내가 잡았다» 는 표시라, 동시에 도는 다른 지우기가
        같은 이름을 고르지 못합니다.
    */
    // 자리 잡기와 쪽지 적기가 **한 걸음**입니다(`reserve_dest`). 프로세스 안의 자물쇠는
    // 같은 앱 안의 두 창을 줄 세우는 값이 있어 그대로 둡니다 — 헛도는 번호 찾기를 줄입니다.
    let dest = {
        let _guard = NAMING.lock_safe();
        reserve_dest(&bin, &name, &text)?
    };
    if let Err(e) = fs::rename(&target_real, &dest) {
        // 옮기지 못했으면 쪽지도 남기지 않습니다 — 짝 없는 쪽지가 쌓입니다.
        let _ = fs::remove_file(record_path(&dest));
        return Err(err("휴지통으로 옮기지 못했습니다", e));
    }
    Ok(dest)
}

/// 휴지통에 둔 것을 **원래 자리로** 되돌립니다.
///
/// `path` 는 지우기 전의 경로입니다 — 화면이 들고 있던 값을 그대로 주면 됩니다.
/// 같은 자리를 여러 번 지웠으면 가장 나중에 지운 것을 되살립니다.
/// 되돌린 자리를 돌려주고, 휴지통에 없으면 `None` 입니다.
#[tauri::command]
pub fn restore_project_media_file(
    base_directory: String,
    project_name: String,
    path: String,
) -> Res<Option<String>> {
    let root = project_root(&base_directory, &project_name);
    let bin = root.join(DIR);
    if !bin.is_dir() {
        return Ok(None);
    }
    let wanted = path_key(&path);

    let mut best: Option<(u64, PathBuf, PathBuf)> = None;
    for entry in fs::read_dir(&bin)
        .map_err(|e| err("휴지통을 읽지 못했습니다", e))?
        .flatten()
    {
        let item = entry.path();
        if is_record(&item) {
            continue;
        }
        let Some(record) = read_record(&item) else {
            continue;
        };
        if !points_at(&wanted, &record.original_path) {
            continue;
        }
        let Some(dest) = resolve_original(&root, &record.original_path) else {
            continue;
        };
        if best
            .as_ref()
            .map(|(when, _, _)| record.deleted_at >= *when)
            .unwrap_or(true)
        {
            best = Some((record.deleted_at, item, dest));
        }
    }
    let Some((_, item, dest)) = best else {
        return Ok(None);
    };

    if let Some(parent) = dest.parent() {
        ensure_dir(parent)?;
    }
    let landed = if item.is_dir() {
        /*
          폴더는 번호를 붙여 되살리지 않습니다. 인물 폴더 이름이 곧 인물이라
          `냥이_002` 로 되살아나면 화면의 인물과 짝이 어긋납니다. 같은 이름이 이미
          있으면 사람이 먼저 정리하도록 여기서 끊습니다.
        */
        if dest.exists() {
            return Err("되살릴 자리에 같은 이름의 폴더가 이미 있습니다.".into());
        }
        fs::rename(&item, &dest).map_err(|e| err("되살리지 못했습니다", e))?;
        dest
    } else {
        // 그 사이 같은 이름이 새로 생겼으면 번호를 올려 놓습니다. **절대 덮어쓰지 않습니다.**
        rename_file_safely(&item, &dest)?
    };
    let _ = fs::remove_file(record_path(&item));
    Ok(Some(landed.to_string_lossy().to_string()))
}

/// 오래 둔 것을 **정말로** 지웁니다. 지운 개수를 돌려줍니다.
///
/// 앱이 뜰 때 프로젝트마다 한 번 부르면 됩니다. `keep_days` 를 주지 않으면 기본값이고,
/// `0` 이면 휴지통을 통째로 비웁니다(사람이 «휴지통 비우기» 를 눌렀을 때).
#[tauri::command]
pub fn empty_project_trash(
    base_directory: String,
    project_name: String,
    keep_days: Option<u64>,
) -> Res<usize> {
    let root = project_root(&base_directory, &project_name);
    let bin = root.join(DIR);
    if !bin.is_dir() {
        return Ok(0);
    }
    // 되돌릴 수 없는 조작이라 사정거리를 못 박습니다 — 이 프로젝트의 휴지통 안에서만.
    let bin_real = ensure_inside(&root, &bin)?;
    let limit = now_seconds().saturating_sub(keep_days.unwrap_or(KEEP_DAYS).saturating_mul(24 * 60 * 60));

    let mut removed = 0usize;
    for entry in fs::read_dir(&bin_real)
        .map_err(|e| err("휴지통을 읽지 못했습니다", e))?
        .flatten()
    {
        let item = entry.path();
        // 휴지통 바로 아래 것만 봅니다. 한 겹 더 들어가면 옮겨 둔 인물 폴더 **안**을
        // 낱개로 지우게 되어, 되살리기가 반쯤 빈 폴더를 돌려줍니다.
        if item.parent() != Some(bin_real.as_path()) {
            continue;
        }
        if is_record(&item) {
            // 짝 없이 남은 쪽지만 치웁니다. 짝이 있는 것은 그 파일과 함께 지웁니다.
            if record_owner(&item).map(|owner| !owner.exists()).unwrap_or(false) {
                let _ = fs::remove_file(&item);
            }
            continue;
        }
        let Some(record) = read_record(&item) else {
            // 쪽지가 없으면 어디로 되살릴지 모릅니다. 우리가 넣은 것이 아니므로 그대로 둡니다.
            continue;
        };
        if record.deleted_at > limit {
            continue;
        }
        let gone = if item.is_dir() {
            fs::remove_dir_all(&item)
        } else {
            fs::remove_file(&item)
        };
        if gone.is_ok() {
            let _ = fs::remove_file(record_path(&item));
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **서로 다른 폴더의 같은 이름 파일 둘을 지우면 둘 다 남아야 합니다.**
    ///
    /// 예전에는 「비었나 보고 → 적기」 였습니다. 그 사이가 열려 있어 둘이 같은 이름을
    /// 고를 수 있었고, 하나가 다른 하나를 덮었습니다. 지금은 쪽지를 «없을 때만 만들기»
    /// 로 적어 운영체제가 한쪽만 통과시킵니다(2026-09-23 검토).
    #[test]
    fn 같은_이름_둘을_지워도_둘_다_남습니다() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("trash-same-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let root = base.join("프로젝트");

        // 폴더는 다르고 이름은 같습니다.
        let mut moved = Vec::new();
        for owner in ["냥이", "멍이"] {
            let dir = root.join("character").join(owner);
            fs::create_dir_all(&dir).unwrap();
            let file = dir.join("같은그림.png");
            fs::write(&file, owner.as_bytes()).unwrap();
            moved.push((owner, move_to_trash(&root, &file).unwrap()));
        }

        assert_ne!(moved[0].1, moved[1].1, "둘이 같은 자리로 갔습니다");
        for (owner, dest) in &moved {
            assert!(dest.exists(), "{owner} 의 것이 사라졌습니다");
            assert_eq!(
                fs::read(dest).unwrap(),
                owner.as_bytes(),
                "{owner} 의 것이 남의 것으로 덮였습니다"
            );
            assert!(record_path(dest).exists(), "{owner} 의 쪽지가 없습니다");
        }
        let _ = fs::remove_dir_all(&base);
    }

    /// 자리를 잡는 일은 **한 걸음**이라, 같은 이름을 여럿이 노려도 서로 다른 자리를 받습니다.
    #[test]
    fn 자리_잡기는_한_번만_성공합니다() {
        let bin = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("trash-reserve-{}", std::process::id()));
        let _ = fs::remove_dir_all(&bin);
        fs::create_dir_all(&bin).unwrap();

        let mut seen = std::collections::HashSet::new();
        for _ in 0..5 {
            let dest = reserve_dest(&bin, "같은그림.png", "{}").unwrap();
            assert!(seen.insert(dest.clone()), "같은 자리를 두 번 내줬습니다: {dest:?}");
        }
        // 확장자가 없는 폴더 이름도 같은 규칙으로.
        let a = reserve_dest(&bin, "냥이", "{}").unwrap();
        let b = reserve_dest(&bin, "냥이", "{}").unwrap();
        assert_ne!(a, b);
        assert!(!a.to_string_lossy().ends_with('.'), "폴더 이름 끝에 점이 붙었습니다: {a:?}");
        let _ = fs::remove_dir_all(&bin);
    }

    /// 지우기 → 되살리기 → 비우기 한 바퀴.
    #[test]
    fn trash_round_trip() {
        // 작업 폴더 안(target/)에서만 합니다. 밖의 폴더는 시험이라도 건드리지 않습니다.
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("trash-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let root = base.join("프로젝트");
        let owner = root.join("character").join("냥이");
        fs::create_dir_all(&owner).unwrap();
        let file = owner.join("냥이_001.png");
        fs::write(&file, b"x").unwrap();

        let moved = move_to_trash(&root, &file).unwrap();
        assert!(!file.exists(), "지운 것은 제자리에 남지 않습니다");
        assert!(moved.exists(), "휴지통에 있어야 합니다");

        let restored = restore_project_media_file(
            base.to_string_lossy().to_string(),
            "프로젝트".into(),
            file.to_string_lossy().to_string(),
        )
        .unwrap();
        assert_eq!(restored, Some(file.to_string_lossy().to_string()));
        assert_eq!(fs::read(&file).unwrap(), b"x");

        // 다시 지웁니다. 방금 지운 것은 비우기가 건드리지 않습니다.
        move_to_trash(&root, &file).unwrap();
        let kept = empty_project_trash(base.to_string_lossy().to_string(), "프로젝트".into(), None).unwrap();
        assert_eq!(kept, 0);
        // 보관 기간을 0 으로 주면 그때 비웁니다.
        let gone = empty_project_trash(base.to_string_lossy().to_string(), "프로젝트".into(), Some(0)).unwrap();
        assert_eq!(gone, 1);
        assert!(!root.join(DIR).join("냥이_001.png").exists());

        let _ = fs::remove_dir_all(&base);
    }

    /// 쪽지가 이상하면 되살리지 않습니다 — 프로젝트 밖에 파일을 쏟는 길을 막습니다.
    #[test]
    fn crooked_record_goes_nowhere() {
        let root = Path::new("D:/프로젝트");
        assert_eq!(
            resolve_original(root, "character/냥이/냥이_001.png"),
            Some(root.join("character").join("냥이").join("냥이_001.png"))
        );
        assert_eq!(resolve_original(root, "../../Windows/system32/x.png"), None);
        assert_eq!(resolve_original(root, "C:/Windows/x.png"), None);
        assert_eq!(resolve_original(root, ""), None);
    }
}
