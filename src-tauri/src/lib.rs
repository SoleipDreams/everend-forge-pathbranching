mod story_storage;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::menu::{
    Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFilePayload {
    path: String,
    content: String,
    modified_ms: Option<u128>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UniverseFilePayload {
    relative_path: String,
    absolute_path: String,
    content: String,
    modified_ms: Option<u128>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UniverseReadError {
    relative_path: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UniverseReadResult {
    root_path: String,
    files: Vec<UniverseFilePayload>,
    directories: Vec<String>,
    errors: Vec<UniverseReadError>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteResult {
    ok: bool,
    path: String,
    modified_ms: Option<u128>,
    message: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeStatus {
    ok: bool,
    runtime: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EverendBridgeCommandResult {
    ok: bool,
    message: String,
    pid: Option<u32>,
    port: Option<u16>,
    output: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BridgeBundleFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetMetadata {
    name: String,
    path: String,
    kind: String,
    extension: Option<String>,
    size: Option<u64>,
}

fn menu_item(
    app: &tauri::AppHandle,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<tauri::Wry>> {
    MenuItem::with_id(app, id, label, true, accelerator)
}

fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &menu_item(app, "pb:file:open", "Open Universe...", Some("CmdOrCtrl+O"))?,
            &menu_item(app, "pb:file:save", "Save Event Edits", Some("CmdOrCtrl+S"))?,
            &PredefinedMenuItem::separator(app)?,
            &menu_item(
                app,
                "pb:file:export-runtime",
                "Export Runtime Package...",
                Some("CmdOrCtrl+E"),
            )?,
            &menu_item(app, "pb:file:export-ink", "Export Ink...", None)?,
            &menu_item(
                app,
                "pb:file:export-game-data",
                "Export SINPO GameData...",
                None,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &menu_item(app, "pb:edit:undo", "Undo", Some("CmdOrCtrl+Z"))?,
            &menu_item(app, "pb:edit:redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let style_menu = Submenu::with_items(
        app,
        "Style",
        true,
        &[
            &menu_item(app, "pb:style:worldnotion", "WorldNotion", None)?,
            &menu_item(app, "pb:style:github", "GitHub", None)?,
            &menu_item(app, "pb:style:one", "One Pro", None)?,
            &menu_item(app, "pb:style:dracula", "Dracula", None)?,
            &menu_item(app, "pb:style:owl", "Owl", None)?,
            &menu_item(app, "pb:style:material", "Material", None)?,
            &PredefinedMenuItem::separator(app)?,
            &menu_item(
                app,
                "pb:style:toggle-mode",
                "Toggle Light/Dark",
                Some("CmdOrCtrl+Shift+T"),
            )?,
        ],
    )?;

    let view_menu = Submenu::with_items(
      app,
      "View",
      true,
      &[
            &menu_item(app, "pb:view:reload", "Reload View", Some("CmdOrCtrl+R"))?,
            &PredefinedMenuItem::separator(app)?,
            &menu_item(app, "pb:view:home", "Home", Some("CmdOrCtrl+1"))?,
            &menu_item(app, "pb:view:workspace", "Workspace", Some("CmdOrCtrl+2"))?,
            &PredefinedMenuItem::separator(app)?,
            &menu_item(
                app,
                "pb:view:toggle-explorer",
                "Toggle Explorer Panel",
                Some("CmdOrCtrl+Shift+C"),
            )?,
            &menu_item(
                app,
                "pb:view:toggle-outline",
                "Toggle Story Outline Panel",
                Some("CmdOrCtrl+Shift+F"),
            )?,
            &menu_item(
                app,
                "pb:view:toggle-assets",
                "Toggle Assets Panel",
                Some("CmdOrCtrl+Shift+D"),
            )?,
            &menu_item(
                app,
                "pb:view:toggle-logic",
                "Toggle Logic Panel",
                Some("CmdOrCtrl+Shift+L"),
            )?,
            &menu_item(
                app,
                "pb:view:toggle-export",
                "Toggle Export Panel",
                Some("CmdOrCtrl+Shift+E"),
            )?,
            &menu_item(app, "pb:view:toggle-connect", "Toggle Connect Panel", None)?,
            &PredefinedMenuItem::separator(app)?,
            &style_menu,
            &PredefinedMenuItem::separator(app)?,
            &menu_item(app, "pb:view:reset-layout", "Reset Layout", None)?,
        ],
    )?;

    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::close_window(app, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::bring_all_to_front(app, None)?,
        ],
    )?;

    let help_menu = Submenu::with_id_and_items(
        app,
        HELP_SUBMENU_ID,
        "Help",
        true,
        &[
            &menu_item(app, "pb:help:about", "About Everend PathBranching", None)?,
            &menu_item(app, "pb:help:docs", "Everend Docs", None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
    )
}

fn modified_ms(path: &Path) -> Option<u128> {
    fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
}

fn write_text_file(path: &Path, content: &str) -> WriteResult {
    let result = story_storage::write_atomic(path, content);
    WriteResult {
        ok: result.is_ok(),
        path: path.to_string_lossy().to_string(),
        modified_ms: modified_ms(path),
        message: result.err(),
    }
}

fn open_in_system(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Opening folders is not supported on this platform.".to_string())
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn normalize_relative_path(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty()
        || path.contains('\0')
        || path.contains('\\')
        || path.starts_with('/')
        || path.contains(':')
    {
        return Err("Universe paths must be safe relative paths.".to_string());
    }
    let mut normalized = PathBuf::new();
    for segment in path.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("Universe paths cannot contain empty or traversal segments.".to_string());
        }
        normalized.push(segment);
    }
    Ok(normalized)
}

fn should_read_universe_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|value| value.to_str()),
        Some("md" | "json" | "yaml" | "yml" | "evpath")
    )
}

fn should_walk_universe_dir(root: &Path, path: &Path) -> bool {
    let relative = relative_path(root, path);
    if relative == "." {
        return true;
    }
    if relative == ".everend" {
        return true;
    }
    if relative.starts_with(".everend/.pathbranching/.transactions") { return false; }
    if relative.starts_with(".everend/.pathbranching") {
        return true;
    }
    if relative.starts_with(".everend/templates") {
        return true;
    }
    if relative.starts_with(".everend/settings") {
        return true;
    }
    if relative.starts_with(".everend/assets") {
        return true;
    }

    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    !name.starts_with('.')
}

fn asset_kind(path: &Path) -> &'static str {
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    match extension.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "avif" => "image",
        "mp4" | "mov" | "webm" | "mkv" | "avi" => "video",
        "mp3" | "wav" | "ogg" | "m4a" | "flac" | "aac" => "audio",
        "md" | "markdown" | "txt" | "pdf" | "doc" | "docx" | "rtf" | "odt" => "document",
        _ => "other",
    }
}

fn asset_metadata(root: &Path, path: &Path) -> AssetMetadata {
    AssetMetadata {
        name: path.file_name().and_then(|value| value.to_str()).unwrap_or("asset").to_string(),
        path: relative_path(root, path),
        kind: asset_kind(path).to_string(),
        extension: path.extension().and_then(|value| value.to_str()).map(|value| value.to_ascii_lowercase()),
        size: fs::metadata(path).ok().map(|metadata| metadata.len()),
    }
}

fn walk_canon_assets(root: &Path, current: &Path, assets: &mut Vec<AssetMetadata>) {
    let Ok(entries) = fs::read_dir(current) else { return; };
    for entry in entries.flatten() {
        let path = entry.path();
        let relative = relative_path(root, &path);
        if relative.starts_with(".everend") { continue; }
        if path.is_dir() {
            walk_canon_assets(root, &path, assets);
        } else {
            assets.push(asset_metadata(root, &path));
        }
    }
}

fn walk_universe(
    root: &Path,
    current: &Path,
    files: &mut Vec<UniverseFilePayload>,
    directories: &mut Vec<String>,
    errors: &mut Vec<UniverseReadError>,
) {
    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(error) => {
            errors.push(UniverseReadError {
                relative_path: relative_path(root, current),
                message: error.to_string(),
            });
            return;
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                errors.push(UniverseReadError {
                    relative_path: relative_path(root, current),
                    message: error.to_string(),
                });
                continue;
            }
        };
        let path = entry.path();
        if path.is_dir() {
            if !should_walk_universe_dir(root, &path) {
                continue;
            }
            directories.push(relative_path(root, &path));
            walk_universe(root, &path, files, directories, errors);
            continue;
        }
        if !should_read_universe_file(&path) {
            continue;
        }
        match fs::read_to_string(&path) {
            Ok(content) => files.push(UniverseFilePayload {
                relative_path: relative_path(root, &path),
                absolute_path: path.to_string_lossy().to_string(),
                content,
                modified_ms: modified_ms(&path),
            }),
            Err(error) => errors.push(UniverseReadError {
                relative_path: relative_path(root, &path),
                message: error.to_string(),
            }),
        }
    }
}

fn read_universe(root: PathBuf) -> Result<UniverseReadResult, String> {
    if !root.exists() {
        return Err(format!("Universe path does not exist: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(format!("Universe path is not a directory: {}", root.display()));
    }

    let _storage_guard = story_storage::lock()?;
    let _universe_guard = story_storage::lock_universe(&root)?;
    story_storage::recover_locked(&root)?;
    let mut files = Vec::new();
    let mut directories = Vec::new();
    let mut errors = Vec::new();
    walk_universe(&root, &root, &mut files, &mut directories, &mut errors);
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    directories.sort();

    Ok(UniverseReadResult {
        root_path: root.to_string_lossy().to_string(),
        files,
        directories,
        errors,
    })
}

fn allow_universe_asset_scope(app: &tauri::AppHandle, root: &Path) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(root, true)
        .map_err(|error| format!("Could not allow universe assets: {error}"))
}

#[tauri::command]
fn bridge_status() -> BridgeStatus {
    BridgeStatus {
        ok: true,
        runtime: "tauri".to_string(),
        message: "Everend PathBranching desktop bridge is available.".to_string(),
    }
}

#[tauri::command]
fn everend_bridge_start(
    app: tauri::AppHandle,
    executable: String,
    port: u16,
    show_terminal: bool,
    project_id: Option<String>,
    story_id: Option<String>,
) -> Result<EverendBridgeCommandResult, String> {
    let executable = resolve_bridge_executable(&app, &executable)?;
    let mut command = bridge_command(&executable);
    #[cfg(target_os = "windows")]
    if !show_terminal {
        command.creation_flags(0x08000000);
    }
    command.arg("start").arg("--port").arg(port.to_string());
    if let Some(project_id) = project_id.filter(|value| !value.trim().is_empty()) {
        command.arg("--project-id").arg(project_id);
    }
    if let Some(story_id) = story_id.filter(|value| !value.trim().is_empty()) {
        command.arg("--story-id").arg(story_id);
    }
    let child = command
        .spawn()
        .map_err(|error| format!("Could not start Everend Forge Bridge: {error}"))?;
    Ok(EverendBridgeCommandResult {
        ok: true,
        message: format!("Everend Forge Bridge start requested (pid {}) using {}.", child.id(), executable),
        pid: Some(child.id()),
        port: Some(port),
        output: None,
    })
}

#[tauri::command]
fn everend_bridge_stop(app: tauri::AppHandle, executable: String, port: u16) -> Result<EverendBridgeCommandResult, String> {
    let executable = resolve_bridge_executable(&app, &executable)?;
    let child = bridge_command(&executable)
        .arg("stop")
        .arg("--port")
        .arg(port.to_string())
        .spawn()
        .map_err(|error| format!("Could not stop Everend Forge Bridge: {error}"))?;
    Ok(EverendBridgeCommandResult {
        ok: true,
        message: format!("Everend Forge Bridge stop requested (pid {}) using {}.", child.id(), executable),
        pid: Some(child.id()),
        port: Some(port),
        output: None,
    })
}

fn resolve_bridge_executable(app: &tauri::AppHandle, configured: &str) -> Result<String, String> {
    if !configured.trim().is_empty() {
        return Ok(configured.trim().to_string());
    }

    let current_dir = std::env::current_dir()
        .map_err(|error| format!("Could not determine the PathBranching directory: {error}"))?;
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("bridge-runtime").join("everend-forge-bridge.cmd"));
        candidates.push(resource_dir.join("everend-forge-bridge.cmd"));
    }
    candidates.extend([
        current_dir.join("bridge-runtime").join("everend-forge-bridge.cmd"),
        current_dir.join("everend-forge-bridge.cmd"),
        current_dir.join("..").join("everend-forge-bridge").join("everend-forge-bridge.cmd"),
        current_dir.join("..").join("..").join("everend-forge-bridge").join("everend-forge-bridge.cmd"),
        current_dir.join("..").join("..").join("..").join("products").join("everend").join("forge").join("repos").join("everend-forge-bridge").join("everend-forge-bridge.cmd"),
    ]);

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate.to_string_lossy().into_owned());
        }
    }

    Err("Bridge daemon executable not found automatically. Configure everend-forge-bridge.cmd in the Connection tab.".to_string())
}

fn bridge_command(executable: &str) -> Command {
    #[cfg(target_os = "windows")]
    {
        if Path::new(executable)
            .extension()
            .map(|extension| extension.eq_ignore_ascii_case("cmd"))
            .unwrap_or(false)
        {
            let mut command = Command::new("cmd.exe");
            command.arg("/d").arg("/c").arg(executable);
            return command;
        }
    }
    Command::new(executable)
}

#[tauri::command]
fn everend_bridge_status(port: u16) -> Result<EverendBridgeCommandResult, String> {
    let mut last_error = String::new();
    for offset in 0..=25_u16 {
        let candidate = port.saturating_add(offset);
        match query_everend_bridge(candidate) {
            Ok(result) if result.ok => return Ok(result),
            Ok(_) => last_error = format!("Bridge on port {candidate} did not return HTTP 200."),
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

fn query_everend_bridge(port: u16) -> Result<EverendBridgeCommandResult, String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .map_err(|error| format!("Everend Forge Bridge is not reachable on 127.0.0.1:{port}: {error}"))?;
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(2)))
        .map_err(|error| error.to_string())?;
    stream
        .write_all(format!("GET /v1/session HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").as_bytes())
        .map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|error| error.to_string())?;
    let output = response.split("\r\n\r\n").nth(1).unwrap_or_default().to_string();
    Ok(EverendBridgeCommandResult {
        ok: response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200"),
        message: "Everend Forge Bridge session queried.".to_string(),
        pid: None,
        port: Some(port),
        output: Some(output),
    })
}

#[tauri::command]
async fn open_universe_dialog(app: tauri::AppHandle) -> Result<Option<UniverseReadResult>, String> {
    let Some(folder_path) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = folder_path.into_path().map_err(|error| error.to_string())?;
    let result = read_universe(path.clone())?;
    allow_universe_asset_scope(&app, &path)?;
    Ok(Some(result))
}

#[tauri::command]
fn read_universe_folder(app: tauri::AppHandle, path: String) -> Result<UniverseReadResult, String> {
    let root = PathBuf::from(path);
    let result = read_universe(root.clone())?;
    allow_universe_asset_scope(&app, &root)?;
    Ok(result)
}

#[tauri::command]
fn index_canon_assets(universe_path: String) -> Result<Vec<AssetMetadata>, String> {
    let root = PathBuf::from(universe_path);
    if !root.is_dir() {
        return Err("Universe path must be an existing directory.".to_string());
    }
    let mut assets = Vec::new();
    walk_canon_assets(&root, &root, &mut assets);
    assets.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(assets)
}

#[tauri::command]
async fn import_universe_assets(
    app: tauri::AppHandle,
    universe_path: String,
) -> Result<Vec<AssetMetadata>, String> {
    let root = PathBuf::from(universe_path);
    if !root.is_dir() {
        return Err("Universe path must be an existing directory.".to_string());
    }
    let Some(files) = app.dialog().file().blocking_pick_files() else {
        return Ok(Vec::new());
    };
    let mut imported = Vec::new();
    for file in files {
        let source = file.into_path().map_err(|error| error.to_string())?;
        if !source.is_file() { continue; }
        let file_name = source.file_name().ok_or_else(|| "Imported files need a file name.".to_string())?;
        let kind = asset_kind(&source);
        let target_dir = root.join(".everend").join("assets").join(kind);
        fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
        let stem = source.file_stem().and_then(|value| value.to_str()).unwrap_or("asset");
        let extension = source.extension().and_then(|value| value.to_str());
        let mut target = target_dir.join(file_name);
        let mut suffix = 1_u32;
        while target.exists() {
            let name = match extension {
                Some(extension) => format!("{}-{}.{}", stem, suffix, extension),
                None => format!("{}-{}", stem, suffix),
            };
            target = target_dir.join(name);
            suffix += 1;
        }
        fs::copy(&source, &target).map_err(|error| error.to_string())?;
        imported.push(asset_metadata(&root, &target));
    }
    Ok(imported)
}

#[tauri::command]
async fn import_scene_images(
    app: tauri::AppHandle,
    universe_path: String,
) -> Result<Vec<AssetMetadata>, String> {
    let root = PathBuf::from(universe_path);
    if !root.is_dir() {
        return Err("Universe path must be an existing directory.".to_string());
    }
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("Scene images", &["png", "jpg", "jpeg"])
        .blocking_pick_file()
    else {
        return Ok(Vec::new());
    };
    let mut imported = Vec::new();
    let source = file.into_path().map_err(|error| error.to_string())?;
    if !source.is_file() || asset_kind(&source) != "image" {
        return Ok(imported);
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    if !matches!(extension.as_deref(), Some("png" | "jpg" | "jpeg")) {
        return Ok(imported);
    }
    let file_name = source.file_name().ok_or_else(|| "Imported images need a file name.".to_string())?;
    let target_dir = root.join(".everend").join("assets").join("image");
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
    let stem = source.file_stem().and_then(|value| value.to_str()).unwrap_or("scene-image");
    let mut target = target_dir.join(file_name);
    let mut suffix = 1_u32;
    while target.exists() {
        let name = match extension.as_deref() {
            Some(extension) => format!("{}-{}.{}", stem, suffix, extension),
            None => format!("{}-{}", stem, suffix),
        };
        target = target_dir.join(name);
        suffix += 1;
    }
    fs::copy(&source, &target).map_err(|error| error.to_string())?;
    imported.push(asset_metadata(&root, &target));
    Ok(imported)
}

#[tauri::command]
fn save_universe_story_batch(universe_path: String, files: Vec<story_storage::BatchFile>) -> Result<story_storage::BatchResult, String> {
    story_storage::save_batch(Path::new(&universe_path), files)
}

#[tauri::command]
fn save_universe_text_file(
    universe_path: String,
    relative_path: String,
    content: String,
    expected_modified_ms: Option<u128>,
) -> Result<WriteResult, String> {
    let root = PathBuf::from(&universe_path);
    if !root.exists() {
        return Err(format!("Universe path does not exist: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(format!("Universe path is not a directory: {}", root.display()));
    }
    let _storage_guard = story_storage::lock()?;
    let _universe_guard = story_storage::lock_universe(&root)?;
    story_storage::recover_locked(&root)?;
    let relative = normalize_relative_path(&relative_path)?;
    let path = root.join(relative);
    if let Some(expected) = expected_modified_ms {
        if Some(expected) != modified_ms(&path) {
            return Ok(WriteResult {
                ok: false,
                path: path.to_string_lossy().to_string(),
                modified_ms: modified_ms(&path),
                message: Some("Universe file changed on disk. Reopen before overwriting.".to_string()),
            });
        }
    }
    Ok(write_text_file(&path, &content))
}

#[tauri::command]
async fn open_project_dialog(app: tauri::AppHandle) -> Result<Option<ProjectFilePayload>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("PathBranching Project", &["pathbranching.json", "json"])
        .blocking_pick_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|error| error.to_string())?;
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;

    Ok(Some(ProjectFilePayload {
        path: path.to_string_lossy().to_string(),
        content,
        modified_ms: modified_ms(&path),
    }))
}

#[tauri::command]
fn save_project_file(
    path: String,
    content: String,
    expected_modified_ms: Option<u128>,
) -> Result<WriteResult, String> {
    let path_ref = Path::new(&path);
    if let Some(expected) = expected_modified_ms {
        if Some(expected) != modified_ms(path_ref) {
            return Ok(WriteResult {
                ok: false,
                path: path.clone(),
                modified_ms: modified_ms(path_ref),
                message: Some(
                    "Project file changed on disk. Save into a universe or reopen before overwriting."
                        .to_string(),
                ),
            });
        }
    }
    Ok(write_text_file(path_ref, &content))
}

#[tauri::command]
fn read_project_file(path: String) -> Result<ProjectFilePayload, String> {
    let path = Path::new(&path);
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(ProjectFilePayload {
        path: path.to_string_lossy().to_string(),
        content,
        modified_ms: modified_ms(path),
    })
}

#[tauri::command]
fn reveal_universe(path: String) -> Result<WriteResult, String> {
    let path_ref = Path::new(&path);
    if !path_ref.is_dir() {
        return Err(format!("Universe path is not a directory: {}", path_ref.display()));
    }
    open_in_system(path_ref)?;
    Ok(WriteResult {
        ok: true,
        path,
        modified_ms: None,
        message: None,
    })
}

#[tauri::command]
async fn save_project_as_dialog(
    app: tauri::AppHandle,
    content: String,
    default_name: String,
) -> Result<Option<WriteResult>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("PathBranching Project", &["pathbranching.json", "json"])
        .set_file_name(default_name)
        .blocking_save_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|error| error.to_string())?;
    Ok(Some(write_text_file(&path, &content)))
}

#[tauri::command]
async fn export_runtime_dialog(
    app: tauri::AppHandle,
    content: String,
    default_name: String,
) -> Result<Option<WriteResult>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Export file", &["json", "ink", "html"])
        .set_file_name(default_name)
        .blocking_save_file();

    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|error| error.to_string())?;
    Ok(Some(write_text_file(&path, &content)))
}

#[tauri::command]
async fn export_bridge_bundle_dialog(
    app: tauri::AppHandle,
    files: Vec<BridgeBundleFile>,
) -> Result<Option<WriteResult>, String> {
    let Some(folder_path) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let root = folder_path.into_path().map_err(|error| error.to_string())?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    for file in files {
        let relative = normalize_relative_path(&file.path)?;
        let target = root.join(relative);
        let result = write_text_file(&target, &file.content);
        if !result.ok {
            return Err(result.message.unwrap_or_else(|| format!("Could not write {}.", target.display())));
        }
    }
    Ok(Some(WriteResult { ok: true, path: root.to_string_lossy().to_string(), modified_ms: modified_ms(&root), message: Some("Everend Forge offline bundle exported.".to_string()) }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(build_app_menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id.starts_with("pb:") {
                let _ = app.emit("pathbranching-menu", id);
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default()
            .with_denylist(&["pathbranching-preview", "pathbranching-debug"])
            .build())
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                for label in ["pathbranching-preview", "pathbranching-debug"] {
                    if let Some(auxiliary) = window.app_handle().get_webview_window(label) {
                    let _ = auxiliary.destroy();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            bridge_status,
            everend_bridge_start,
            everend_bridge_stop,
            everend_bridge_status,
            open_universe_dialog,
            read_universe_folder,
            index_canon_assets,
            import_universe_assets,
            import_scene_images,
            save_universe_text_file,
            save_universe_story_batch,
            open_project_dialog,
            read_project_file,
            save_project_file,
            save_project_as_dialog,
            reveal_universe,
            export_runtime_dialog,
            export_bridge_bundle_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Everend PathBranching");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH as STD_UNIX_EPOCH};

    fn temp_universe() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(STD_UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "pathbranching-read-universe-test-{}-{}",
            std::process::id(),
            suffix
        ));
        fs::create_dir_all(&path).expect("temp universe should be created");
        path
    }

    fn write_fixture(root: &Path, relative: &str, content: &str) {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("fixture parent should be created");
        }
        fs::write(path, content).expect("fixture file should be written");
    }

    fn read_paths(root: &Path) -> Vec<String> {
        read_universe(root.to_path_buf())
            .expect("universe should be readable")
            .files
            .into_iter()
            .map(|file| file.relative_path)
            .collect()
    }

    #[test]
    fn read_universe_includes_pathbranching_metadata() {
        let root = temp_universe();
        write_fixture(&root, ".everend/universe.json", r#"{"name":"Test Universe"}"#);
        write_fixture(
            &root,
            ".everend/.pathbranching/manifest.json",
            r#"{"version":"0.2","activeStoryId":"story-a","stories":[{"id":"story-a","name":"Story A","path":".everend/.pathbranching/stories/story-a/story.json"}]}"#,
        );
        write_fixture(
            &root,
            ".everend/.pathbranching/stories/story-a/story.json",
            r#"{"storageVersion":"0.2","storyId":"story-a","sequenceIds":["sequence-a"]}"#,
        );
        write_fixture(
            &root,
            ".everend/.pathbranching/stories/story-a/sequences/sequence-a/sequence.json",
            r#"{"storageVersion":"0.2","sequence":{"id":"sequence-a","name":"Sequence A","entryEventId":"event-a","eventIds":["event-a"],"branchIds":["branch-a"]}}"#,
        );
        write_fixture(
            &root,
            ".everend/.pathbranching/stories/story-a/sequences/sequence-a/events/event-a.json",
            r#"{"storageVersion":"0.2","event":{"id":"event-a","name":"Event A","type":"normal","text":{"format":"plain","content":"Hello"},"canonRefs":[],"transitions":[]}}"#,
        );
        write_fixture(
            &root,
            ".everend/.pathbranching/stories/story-a/sequences/sequence-a/branches/branch-a.json",
            r#"{"storageVersion":"0.2","branch":{"id":"branch-a","title":"Branch A","eventIds":["event-a"]}}"#,
        );
        write_fixture(
            &root,
            ".everend/.pathbranching/stories/story-a/authoring/canvas.json",
            r#"{"storageVersion":"0.2","storyId":"story-a","canvas":{"activeSequenceId":"sequence-a"}}"#,
        );
        write_fixture(
            &root,
            ".everend/.pathbranching/working-copies/lore-origin.md",
            "# Working copy\n",
        );

        let paths = read_paths(&root);
        fs::remove_dir_all(&root).ok();

        assert!(paths.contains(&".everend/universe.json".to_string()));
        assert!(paths.contains(&".everend/.pathbranching/manifest.json".to_string()));
        assert!(paths.contains(&".everend/.pathbranching/stories/story-a/story.json".to_string()));
        assert!(paths.contains(
            &".everend/.pathbranching/stories/story-a/sequences/sequence-a/sequence.json"
                .to_string()
        ));
        assert!(paths.contains(
            &".everend/.pathbranching/stories/story-a/sequences/sequence-a/events/event-a.json"
                .to_string()
        ));
        assert!(paths.contains(
            &".everend/.pathbranching/stories/story-a/sequences/sequence-a/branches/branch-a.json"
                .to_string()
        ));
        assert!(paths.contains(
            &".everend/.pathbranching/stories/story-a/authoring/canvas.json".to_string()
        ));
        assert!(paths.contains(
            &".everend/.pathbranching/working-copies/lore-origin.md".to_string()
        ));
    }

    #[test]
    fn read_universe_ignores_unapproved_hidden_directories() {
        let root = temp_universe();
        write_fixture(&root, "Lore/Origin.md", "# Origin\n");
        write_fixture(&root, ".git/config.json", r#"{"private":true}"#);
        write_fixture(&root, ".cache/cache.json", r#"{"private":true}"#);
        write_fixture(&root, ".hidden/data.json", r#"{"private":true}"#);
        write_fixture(&root, ".everend/.secret/data.json", r#"{"private":true}"#);
        write_fixture(&root, ".everend/.pathbranching/manifest.json", r#"{"stories":[]}"#);

        let paths = read_paths(&root);
        fs::remove_dir_all(&root).ok();

        assert!(paths.contains(&"Lore/Origin.md".to_string()));
        assert!(paths.contains(&".everend/.pathbranching/manifest.json".to_string()));
        assert!(!paths.iter().any(|path| path.starts_with(".git/")));
        assert!(!paths.iter().any(|path| path.starts_with(".cache/")));
        assert!(!paths.iter().any(|path| path.starts_with(".hidden/")));
        assert!(!paths.iter().any(|path| path.starts_with(".everend/.secret/")));
    }
}
