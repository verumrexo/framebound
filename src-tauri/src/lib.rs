use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::ErrorKind;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAX_SAVE_BYTES: usize = 8 * 1024 * 1024;
const MAX_SIGNAL_FORGE_PACK_BYTES: usize = 48 * 1024 * 1024;
const MAX_SMOKE_REPORT_BYTES: usize = 64 * 1024;
const SAVE_FILE_NAME: &str = "run-save-v2.json";
const SIGNAL_FORGE_PACK_FILE_NAME: &str = "signal-forge-pack-v1.json";
const DEV_SERVER_PORT: u16 = 5173;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromotionPack {
    version: u32,
    modified_at: String,
    sounds: Vec<PromotionSound>,
    bindings: Vec<PromotionBinding>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromotionSound {
    id: String,
    schema_version: u32,
    jfxr_version: String,
    name: String,
    recipe: serde_json::Value,
    wav_base64: String,
    sample_rate: u32,
    channels: u32,
    duration: f64,
    peak: f64,
    created_at: String,
    modified_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PromotionBinding {
    event_key: String,
    sound_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PromotedManifest {
    version: u32,
    modified_at: String,
    sounds: Vec<PromotedSound>,
    bindings: Vec<PromotionBinding>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PromotedSound {
    id: String,
    schema_version: u32,
    jfxr_version: String,
    name: String,
    recipe: serde_json::Value,
    asset: String,
    sample_rate: u32,
    channels: u32,
    duration: f64,
    peak: f64,
    created_at: String,
    modified_at: String,
}

fn is_allowed_navigation(url: &tauri::Url, development: bool) -> bool {
    match (url.scheme(), url.host_str(), url.port_or_known_default()) {
        ("tauri", Some("localhost"), _) => true,
        ("http" | "https", Some("tauri.localhost"), _) => true,
        ("http", Some("127.0.0.1" | "localhost"), Some(DEV_SERVER_PORT))
            if development =>
        {
            true
        }
        _ => false,
    }
}

fn navigation_guard<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|_, url| {
            is_allowed_navigation(url, cfg!(debug_assertions))
        })
        .build()
}

fn save_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(SAVE_FILE_NAME))
        .map_err(|error| error.to_string())
}

fn signal_forge_pack_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(SIGNAL_FORGE_PACK_FILE_NAME))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_run_save(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = save_path(&app)?;
    Ok(read_save_candidates(&path))
}

#[tauri::command]
fn write_run_save(app: tauri::AppHandle, raw: String) -> Result<(), String> {
    let path = save_path(&app)?;
    write_save_file(&path, &raw)
}

#[tauri::command]
fn clear_run_save(app: tauri::AppHandle) -> Result<(), String> {
    let path = save_path(&app)?;
    remove_if_present(&path)?;
    remove_if_present(&temporary_save_path(&path))?;
    remove_if_present(&backup_save_path(&path))
}

#[tauri::command]
fn load_signal_forge_pack(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = signal_forge_pack_path(&app)?;
    Ok(read_bounded_candidates(
        &path,
        MAX_SIGNAL_FORGE_PACK_BYTES,
        "signal forge pack",
    ))
}

#[tauri::command]
fn write_signal_forge_pack(
    app: tauri::AppHandle,
    raw: String,
) -> Result<(), String> {
    let path = signal_forge_pack_path(&app)?;
    write_bounded_file(
        &path,
        &raw,
        MAX_SIGNAL_FORGE_PACK_BYTES,
        "signal forge pack",
    )
}

#[tauri::command]
fn promote_signal_forge_pack(raw: String) -> Result<String, String> {
    if !cfg!(debug_assertions) {
        return Err("sound pack promotion is available only in development builds".into());
    }
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "project source root is missing".to_string())?
        .join("public")
        .join("generated-sounds");
    promote_signal_forge_pack_to(&source_root, &raw)?;
    Ok(source_root.to_string_lossy().into_owned())
}

fn promote_signal_forge_pack_to(root: &Path, raw: &str) -> Result<(), String> {
    if raw.len() > MAX_SIGNAL_FORGE_PACK_BYTES {
        return Err("signal forge pack exceeds size limit".into());
    }
    let mut pack: PromotionPack = serde_json::from_str(raw)
        .map_err(|error| format!("invalid signal forge pack: {error}"))?;
    if pack.version != 1 || pack.sounds.len() > 128 || pack.bindings.len() > 512 {
        return Err("unsupported signal forge pack".into());
    }
    pack.sounds.sort_by(|a, b| a.id.cmp(&b.id));
    pack.bindings.sort_by(|a, b| a.event_key.cmp(&b.event_key));
    fs::create_dir_all(root).map_err(|error| error.to_string())?;

    let mut manifest_sounds = Vec::with_capacity(pack.sounds.len());
    let mut sound_ids = std::collections::HashSet::new();
    for sound in pack.sounds {
        if !is_safe_generated_sound_id(&sound.id) || !sound_ids.insert(sound.id.clone()) {
            return Err("signal forge pack contains an invalid sound id".into());
        }
        let wav = BASE64
            .decode(&sound.wav_base64)
            .map_err(|_| "signal forge pack contains invalid wav data".to_string())?;
        if wav.len() <= 44
            || wav.len() > 2 * 1024 * 1024
            || wav.get(0..4) != Some(b"RIFF")
            || wav.get(8..12) != Some(b"WAVE")
        {
            return Err("signal forge pack contains an invalid wav file".into());
        }
        let filename = format!("{}.wav", sound.id);
        write_bounded_bytes(&root.join(&filename), &wav, 2 * 1024 * 1024)?;
        manifest_sounds.push(PromotedSound {
            id: sound.id,
            schema_version: sound.schema_version,
            jfxr_version: sound.jfxr_version,
            name: sound.name,
            recipe: sound.recipe,
            asset: format!("./generated-sounds/{filename}"),
            sample_rate: sound.sample_rate,
            channels: sound.channels,
            duration: sound.duration,
            peak: sound.peak,
            created_at: sound.created_at,
            modified_at: sound.modified_at,
        });
    }
    if pack
        .bindings
        .iter()
        .any(|binding| !sound_ids.contains(&binding.sound_id))
    {
        return Err("signal forge pack contains a dangling binding".into());
    }

    let manifest = PromotedManifest {
        version: pack.version,
        modified_at: pack.modified_at,
        sounds: manifest_sounds,
        bindings: pack.bindings,
    };
    let manifest_raw = serde_json::to_string_pretty(&manifest)
        .map_err(|error| error.to_string())?;
    write_bounded_file(
        &root.join("sound-pack.json"),
        &manifest_raw,
        8 * 1024 * 1024,
        "promoted sound manifest",
    )
}

fn is_safe_generated_sound_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .enumerate()
            .all(|(index, byte)| byte.is_ascii_lowercase() || byte.is_ascii_digit() || (byte == b'-' && index > 0))
}

fn write_bounded_bytes(path: &Path, bytes: &[u8], max_bytes: usize) -> Result<(), String> {
    if bytes.len() > max_bytes {
        return Err("generated sound exceeds size limit".into());
    }
    let directory = path
        .parent()
        .ok_or_else(|| "generated sound path has no parent".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("wav.tmp");
    let result = (|| {
        let mut file = File::create(&temporary).map_err(|error| error.to_string())?;
        file.write_all(bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        replace_save_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[tauri::command]
fn write_peer_smoke_report(raw: String) -> Result<(), String> {
    let path = std::env::var("FRAMEBOUND_PEER_SMOKE_REPORT")
        .map(PathBuf::from)
        .map_err(|_| "peer smoke reporting is not enabled".to_string())?;
    eprintln!("[peer smoke] {raw}");
    write_peer_smoke_report_to(&path, &raw)
}

fn write_peer_smoke_report_to(path: &Path, raw: &str) -> Result<(), String> {
    if raw.len() > MAX_SMOKE_REPORT_BYTES {
        return Err("peer smoke report exceeds size limit".into());
    }
    let temporary_root = std::env::temp_dir();
    if !path.is_absolute() || !path.starts_with(&temporary_root) {
        return Err("peer smoke report must stay inside the temp directory".into());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "peer smoke report has no parent".to_string())?;
    if !parent.is_dir() {
        return Err("peer smoke report directory does not exist".into());
    }
    fs::write(path, raw).map_err(|error| error.to_string())
}

fn peer_smoke_url_from_environment() -> Result<Option<tauri::Url>, String> {
    let Ok(role) = std::env::var("FRAMEBOUND_PEER_SMOKE_ROLE") else {
        return Ok(None);
    };
    let code = std::env::var("FRAMEBOUND_PEER_SMOKE_CODE").ok();
    let resume = std::env::var("FRAMEBOUND_PEER_SMOKE_RESUME").ok();
    peer_smoke_url_for(&role, code.as_deref(), resume.as_deref()).map(Some)
}

fn peer_smoke_url_for(
    role: &str,
    code: Option<&str>,
    resume: Option<&str>,
) -> Result<tauri::Url, String> {
    if !matches!(role, "host" | "guest") {
        return Err("peer smoke role must be host or guest".into());
    }
    let normalized_code = code.map(|value| value.trim().to_ascii_uppercase());
    if role == "guest"
        && !normalized_code.as_deref().is_some_and(|value| {
            value.len() == 6 && value.bytes().all(|byte| byte.is_ascii_alphanumeric())
        })
    {
        return Err("guest peer smoke requires a six-character code".into());
    }
    if resume.is_some_and(|value| {
        value.is_empty()
            || value.len() > 128
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    }) {
        return Err("peer smoke resume token is invalid".into());
    }

    let mut url = tauri::Url::parse("tauri://localhost/")
        .map_err(|error| error.to_string())?;
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("peer-session-smoke", role);
        if let Some(code) = normalized_code {
            query.append_pair("code", &code);
        }
        if let Some(resume) = resume {
            query.append_pair("resume", resume);
        }
    }
    Ok(url)
}

#[cfg(test)]
fn read_save_file(path: &Path) -> Result<Option<String>, String> {
    Ok(read_save_candidates(path).into_iter().next())
}

fn read_save_candidates(path: &Path) -> Vec<String> {
    read_bounded_candidates(path, MAX_SAVE_BYTES, "native save")
}

fn read_bounded_candidates(
    path: &Path,
    max_bytes: usize,
    label: &str,
) -> Vec<String> {
    [
        path.to_path_buf(),
        temporary_save_path(path),
        backup_save_path(path),
    ]
    .iter()
    .filter_map(|candidate| {
        read_single_bounded_file(candidate, max_bytes, label)
            .ok()
            .flatten()
    })
    .collect()
}

fn read_single_bounded_file(
    path: &Path,
    max_bytes: usize,
    label: &str,
) -> Result<Option<String>, String> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.len() > max_bytes as u64 => {
            return Err(format!("{label} exceeds size limit"));
        }
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    }

    fs::read_to_string(path)
        .map(Some)
        .map_err(|error| error.to_string())
}

fn write_save_file(path: &Path, raw: &str) -> Result<(), String> {
    write_bounded_file(path, raw, MAX_SAVE_BYTES, "native save")
}

fn write_bounded_file(
    path: &Path,
    raw: &str,
    max_bytes: usize,
    label: &str,
) -> Result<(), String> {
    if raw.len() > max_bytes {
        return Err(format!("{label} exceeds size limit"));
    }
    let directory = path
        .parent()
        .ok_or_else(|| "native save path has no parent".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;

    let temporary = temporary_save_path(path);
    let result = (|| {
        let mut file = File::create(&temporary)
            .map_err(|error| error.to_string())?;
        file.write_all(raw.as_bytes())
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        replace_save_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn temporary_save_path(path: &Path) -> PathBuf {
    path.with_extension("json.tmp")
}

fn backup_save_path(path: &Path) -> PathBuf {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("data");
    path.with_extension(format!("{extension}.bak"))
}

#[cfg(not(windows))]
fn replace_save_file(temporary: &Path, path: &Path) -> Result<(), String> {
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[cfg(windows)]
fn replace_save_file(temporary: &Path, path: &Path) -> Result<(), String> {
    let backup = backup_save_path(path);
    remove_if_present(&backup)?;
    let had_primary = path.exists();
    if had_primary {
        fs::rename(path, &backup).map_err(|error| error.to_string())?;
    }

    match fs::rename(temporary, path) {
        Ok(()) => {
            remove_if_present(&backup)?;
            Ok(())
        }
        Err(replace_error) => {
            if had_primary {
                if let Err(restore_error) = fs::rename(&backup, path) {
                    return Err(format!(
                        "{replace_error}; previous save restore failed: \
                         {restore_error}"
                    ));
                }
            }
            Err(replace_error.to_string())
        }
    }
}

fn remove_if_present(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(navigation_guard())
        .setup(|app| {
            if let Some(url) = peer_smoke_url_from_environment()
                .map_err(std::io::Error::other)?
            {
                let window = app
                    .get_webview_window("main")
                    .ok_or_else(|| std::io::Error::other("main window is missing"))?;
                window.navigate(url)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_run_save,
            write_run_save,
            clear_run_save,
            load_signal_forge_pack,
            write_signal_forge_pack,
            promote_signal_forge_pack,
            write_peer_smoke_report
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Framebound");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_PATH_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn test_path(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        let sequence = TEST_PATH_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir()
            .join(format!(
                "framebound-save-{}-{nonce}-{sequence}",
                std::process::id()
            ))
            .join(name)
    }

    #[test]
    fn native_save_replaces_complete_files() {
        let path = test_path("run-save-v2.json");
        write_save_file(&path, "{\"version\":2}")
            .expect("initial write should succeed");
        write_save_file(&path, "{\"version\":2,\"floor\":3}")
            .expect("replacement should succeed");

        assert_eq!(
            read_save_file(&path).expect("read should succeed"),
            Some("{\"version\":2,\"floor\":3}".into())
        );
        assert!(!temporary_save_path(&path).exists());
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn oversized_native_save_does_not_replace_existing_data() {
        let path = test_path("run-save-v2.json");
        write_save_file(&path, "{\"version\":2}")
            .expect("initial write should succeed");
        let oversized = "x".repeat(MAX_SAVE_BYTES + 1);

        assert!(write_save_file(&path, &oversized).is_err());
        assert_eq!(
            read_save_file(&path).expect("old save should remain readable"),
            Some("{\"version\":2}".into())
        );
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn signal_forge_pack_uses_bounded_atomic_replacement() {
        let path = test_path("signal-forge-pack-v1.json");
        write_bounded_file(&path, "{\"version\":1}", 64, "signal forge pack")
            .expect("initial sound pack should write");
        assert!(write_bounded_file(
            &path,
            &"x".repeat(65),
            64,
            "signal forge pack",
        )
        .is_err());
        assert_eq!(
            read_bounded_candidates(&path, 64, "signal forge pack"),
            vec!["{\"version\":1}"],
        );
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn signal_forge_promotion_writes_only_fixed_manifest_and_wav_paths() {
        let root = test_path("generated-sounds");
        let mut wav = b"RIFF\x28\x00\x00\x00WAVE".to_vec();
        wav.resize(48, 0);
        let raw = serde_json::json!({
            "version": 1,
            "modifiedAt": "2026-08-03T12:00:00.000Z",
            "sounds": [{
                "id": "laser-zap",
                "schemaVersion": 1,
                "jfxrVersion": "0.13.0",
                "name": "laser zap",
                "recipe": { "_version": 1 },
                "wavBase64": BASE64.encode(wav),
                "sampleRate": 44100,
                "channels": 1,
                "duration": 0.1,
                "peak": 1.0,
                "createdAt": "2026-08-03T12:00:00.000Z",
                "modifiedAt": "2026-08-03T12:00:00.000Z"
            }],
            "bindings": [{
                "eventKey": "global:dash",
                "soundId": "laser-zap"
            }]
        })
        .to_string();

        promote_signal_forge_pack_to(&root, &raw)
            .expect("valid sound pack should promote");
        assert!(root.join("laser-zap.wav").is_file());
        let manifest = fs::read_to_string(root.join("sound-pack.json"))
            .expect("promoted manifest should be readable");
        assert!(manifest.contains("./generated-sounds/laser-zap.wav"));
        assert!(!manifest.contains("wavBase64"));
        fs::remove_dir_all(root.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn complete_temporary_save_recovers_when_primary_is_missing() {
        let path = test_path("run-save-v2.json");
        let temporary = temporary_save_path(&path);
        fs::create_dir_all(path.parent().unwrap())
            .expect("test directory should be created");
        fs::write(&temporary, "{\"version\":2,\"floor\":4}")
            .expect("temporary save should be written");

        assert_eq!(
            read_save_file(&path).expect("temporary save should recover"),
            Some("{\"version\":2,\"floor\":4}".into())
        );
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn complete_backup_recovers_when_primary_and_temporary_are_missing() {
        let path = test_path("run-save-v2.json");
        let backup = backup_save_path(&path);
        fs::create_dir_all(path.parent().unwrap())
            .expect("backup directory should be created");
        fs::write(&backup, "{\"version\":2,\"floor\":5}")
            .expect("backup save should be written");

        assert_eq!(
            read_save_file(&path).expect("backup save should recover"),
            Some("{\"version\":2,\"floor\":5}".into())
        );
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn native_load_candidates_preserve_recovery_priority() {
        let path = test_path("run-save-v2.json");
        fs::create_dir_all(path.parent().unwrap())
            .expect("candidate directory should be created");
        fs::write(&path, "primary").expect("primary should be written");
        fs::write(temporary_save_path(&path), "temporary")
            .expect("temporary should be written");
        fs::write(backup_save_path(&path), "backup")
            .expect("backup should be written");

        assert_eq!(
            read_save_candidates(&path),
            vec!["primary", "temporary", "backup"]
        );
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }

    #[test]
    fn navigation_guard_allows_only_app_and_exact_dev_origins() {
        for allowed in [
            "tauri://localhost/",
            "http://tauri.localhost/",
            "https://tauri.localhost/",
        ] {
            assert!(is_allowed_navigation(
                &tauri::Url::parse(allowed).unwrap(),
                false
            ));
        }

        assert!(is_allowed_navigation(
            &tauri::Url::parse("http://127.0.0.1:5173/").unwrap(),
            true
        ));
        assert!(!is_allowed_navigation(
            &tauri::Url::parse("http://127.0.0.1:5174/").unwrap(),
            true
        ));
        assert!(!is_allowed_navigation(
            &tauri::Url::parse("https://example.com/").unwrap(),
            true
        ));
        assert!(!is_allowed_navigation(
            &tauri::Url::parse("javascript:alert(1)").unwrap(),
            true
        ));
    }

    #[test]
    fn peer_smoke_url_accepts_only_bounded_test_roles_and_codes() {
        let guest = peer_smoke_url_for(
            "guest",
            Some("ab12cd"),
            Some("resume_token-1"),
        )
        .expect("valid guest smoke url should build");
        assert_eq!(guest.scheme(), "tauri");
        assert_eq!(guest.host_str(), Some("localhost"));
        assert_eq!(
            guest.query(),
            Some(
                "peer-session-smoke=guest&code=AB12CD&resume=resume_token-1"
            )
        );

        assert!(peer_smoke_url_for("host", None, None).is_ok());
        assert!(peer_smoke_url_for("spectator", None, None).is_err());
        assert!(peer_smoke_url_for("guest", Some("bad"), None).is_err());
        assert!(peer_smoke_url_for(
            "guest",
            Some("ABC123"),
            Some("../escape"),
        )
        .is_err());
    }

    #[test]
    fn peer_smoke_reports_are_bounded_to_the_temp_directory() {
        let path = test_path("peer-smoke.json");
        fs::create_dir_all(path.parent().unwrap())
            .expect("test directory should be created");

        write_peer_smoke_report_to(&path, "{\"status\":\"round_trip\"}")
            .expect("temp report should be written");
        assert_eq!(
            fs::read_to_string(&path).expect("report should be readable"),
            "{\"status\":\"round_trip\"}"
        );
        assert!(write_peer_smoke_report_to(
            Path::new("/peer-smoke.json"),
            "{}",
        )
        .is_err());
        assert!(write_peer_smoke_report_to(
            &path,
            &"x".repeat(MAX_SMOKE_REPORT_BYTES + 1),
        )
        .is_err());

        fs::remove_file(&path).expect("test report should be removable");
        fs::remove_dir_all(path.parent().unwrap())
            .expect("test directory should be removable");
    }
}
