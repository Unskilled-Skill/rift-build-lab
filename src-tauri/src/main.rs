//! Rift Build Lab desktop shell. Everything that touches League, preferences or data lives in
//! `rbl-core`; this crate wires it to the window, IPC, the `rbldata` protocol and (later) the tray.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use rbl_core::CoreError;
use rbl_core::data::{DataStore, DataUpdateResult, FORMULA_COMPAT, RevisionInfo, UpdateStatus};
use rbl_core::ipc::{
    AppUpdateDto, ApplyBuildRequest, ApplyResultDto, Core, DataResponse, DefaultKey, DefaultRequest, ExternalLink, IpcError,
    TestConnectionDto, external_url, serve_data,
};
use rbl_core::lcu::LocalClientSource;
use rbl_core::library::StoreLibrary;
use rbl_core::monitor;
use rbl_core::net::HttpsFetch;
use rbl_core::paths::AppPaths;
use rbl_core::prefs::{Preferences, PreferencesPatch, PrefsStore};
use serde_json::Value;
use tauri::http::{Response, StatusCode, header};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

type Result<T> = std::result::Result<T, IpcError>;
const DATA_CHECK_INTERVAL: Duration = Duration::from_secs(6 * 3600);
/// Origins allowed to read `rbldata`: the bundled window, plus the Vite dev server in debug builds.
const APP_ORIGINS: &[&str] =
    if cfg!(debug_assertions) { &["http://tauri.localhost", "http://127.0.0.1:5175"] } else { &["http://tauri.localhost"] };

fn version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn get_status(core: State<'_, Core>) -> Value {
    core.status()
}

#[tauri::command]
async fn test_connection(core: State<'_, Core>) -> Result<TestConnectionDto> {
    Ok(core.test_connection().await)
}

#[tauri::command]
async fn apply_build(core: State<'_, Core>, request: ApplyBuildRequest) -> Result<ApplyResultDto> {
    core.apply_build(request).await
}

#[tauri::command]
async fn set_default_build(core: State<'_, Core>, request: DefaultRequest) -> Result<()> {
    core.set_default(request).await
}

#[tauri::command]
async fn clear_default_build(core: State<'_, Core>, key: DefaultKey) -> Result<()> {
    core.clear_default(key).await
}

#[tauri::command]
fn get_preferences(core: State<'_, Core>) -> Result<Preferences> {
    core.preferences()
}

#[tauri::command]
async fn update_preferences(core: State<'_, Core>, patch: PreferencesPatch) -> Result<Preferences> {
    core.update_preferences(patch).await
}

#[tauri::command]
async fn pause_auto_import(core: State<'_, Core>) -> Result<()> {
    core.pause().await
}

#[tauri::command]
async fn resume_auto_import(core: State<'_, Core>) -> Result<()> {
    core.resume().await
}

#[tauri::command]
async fn reapply_last(core: State<'_, Core>) -> Result<()> {
    core.reapply().await
}

#[tauri::command]
fn open_backup_folder(app: AppHandle, core: State<'_, Core>) -> Result<()> {
    let folder = core.backup_folder()?;
    app.opener().open_path(folder.to_string_lossy(), None::<&str>).map_err(|_| CoreError::Internal.into())
}

async fn run_data_check(app: &AppHandle) -> Result<DataUpdateResult> {
    let core = app.state::<Core>();
    let result = core.check_data_updates(&HttpsFetch::new(&version(app))).await?;
    if result.status == UpdateStatus::Updated {
        let _ = app.emit("data-revision-changed", core.data_revision()?);
    }
    Ok(result)
}

#[tauri::command]
async fn check_data_updates(app: AppHandle) -> Result<DataUpdateResult> {
    run_data_check(&app).await
}

#[tauri::command]
fn get_data_revision(core: State<'_, Core>) -> Result<RevisionInfo> {
    core.data_revision()
}

#[tauri::command]
fn open_external(app: AppHandle, link: ExternalLink) -> Result<()> {
    let url = external_url(&link)?;
    app.opener().open_url(url, None::<&str>).map_err(|_| CoreError::Internal.into())
}

#[tauri::command]
async fn check_app_update(app: AppHandle, core: State<'_, Core>) -> Result<AppUpdateDto> {
    Ok(core.check_app_update(&HttpsFetch::new(&version(&app))).await)
}

fn setup(app: &mut tauri::App) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let paths = AppPaths::from_env().ok_or("Windows user folders are unavailable.")?;
    let bundled = app.path().resource_dir()?.join("data");
    let data = DataStore::open(&paths.data, &bundled, FORMULA_COMPAT)?;
    let prefs = Arc::new(Mutex::new(PrefsStore::load(&paths.preferences, &data.catalog()?)));
    let enabled = prefs.lock().map(|p| p.prefs().auto_import.enabled).unwrap_or(false);
    let data = Arc::new(RwLock::new(data));
    let library = StoreLibrary::new(prefs.clone(), data.clone());
    let backups = paths.backups.clone();
    let (monitor, _task) =
        tauri::async_runtime::block_on(async move { monitor::spawn(LocalClientSource::default(), library, backups, enabled) });

    let handle = app.handle().clone();
    let mut status = monitor.subscribe();
    tauri::async_runtime::spawn(async move {
        let first = status.borrow_and_update().to_json();
        let _ = handle.emit("status-changed", first);
        while status.changed().await.is_ok() {
            let next = status.borrow_and_update().to_json();
            let _ = handle.emit("status-changed", next);
        }
    });
    app.manage(Core { monitor, prefs, data, paths, bundled, app_version: version(app.handle()) });

    // Data updates: once at launch, then at most every six hours; failures keep the installed data.
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let _ = run_data_check(&handle).await;
            tokio::time::sleep(DATA_CHECK_INTERVAL).await;
        }
    });
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("rbldata", |ctx, request| {
            let not_found = || DataResponse { status: 404, content_type: "text/plain", body: b"Not found".to_vec() };
            let served = match ctx.app_handle().try_state::<Core>() {
                Some(core) if request.method() == "GET" => {
                    core.data.read().map(|store| serve_data(&store, request.uri().path())).unwrap_or_else(|_| not_found())
                }
                _ => not_found(),
            };
            // The window (http://tauri.localhost) reads data cross-origin; only the app's own origin may.
            let origin = request.headers().get(header::ORIGIN).and_then(|o| o.to_str().ok()).filter(|o| APP_ORIGINS.contains(o));
            let mut response = Response::builder()
                .status(StatusCode::from_u16(served.status).unwrap_or(StatusCode::NOT_FOUND))
                .header(header::CONTENT_TYPE, served.content_type)
                .header(header::CACHE_CONTROL, "no-cache");
            if let Some(origin) = origin {
                response = response.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin).header(header::VARY, "Origin");
            }
            response.body(served.body).expect("static response headers are valid")
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            test_connection,
            apply_build,
            set_default_build,
            clear_default_build,
            get_preferences,
            update_preferences,
            pause_auto_import,
            resume_auto_import,
            reapply_last,
            open_backup_folder,
            check_data_updates,
            get_data_revision,
            open_external,
            check_app_update
        ])
        .setup(setup)
        .run(tauri::generate_context!())
        .expect("Rift Build Lab could not start");
}
