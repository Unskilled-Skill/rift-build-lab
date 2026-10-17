//! Rift Build Lab desktop shell. Everything that touches League, preferences or data lives in
//! `rbl-core`; this crate wires it to the window, IPC and (later) the tray.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex, RwLock};

use rbl_core::catalog::Catalog;
use rbl_core::data::{DataStore, FORMULA_COMPAT};
use rbl_core::lcu::LocalClientSource;
use rbl_core::library::StoreLibrary;
use rbl_core::monitor::{self, MonitorHandle};
use rbl_core::paths::AppPaths;
use rbl_core::prefs::PrefsStore;
use tauri::{Emitter, Manager};

/// Shared native state; commands (plan T15) read it through `tauri::State`.
#[allow(dead_code, reason = "read by the IPC commands added in plan T15")]
pub struct AppState {
    pub monitor: MonitorHandle,
    pub prefs: Arc<Mutex<PrefsStore>>,
    pub data: Arc<RwLock<DataStore>>,
    pub paths: AppPaths,
}

fn active_catalog(data: &DataStore) -> Result<Catalog, Box<dyn std::error::Error>> {
    let file = data.resolve("catalog.json").ok_or("The build data has no catalog.")?;
    Ok(Catalog::from_published_json(&std::fs::read_to_string(file)?)?)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let paths = AppPaths::from_env().ok_or("Windows user folders are unavailable.")?;
            let bundled = app.path().resource_dir()?.join("data");
            let data = DataStore::open(&paths.data, &bundled, FORMULA_COMPAT)?;
            let catalog = active_catalog(&data)?;
            let prefs = Arc::new(Mutex::new(PrefsStore::load(&paths.preferences, &catalog)));
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
            app.manage(AppState { monitor, prefs, data, paths });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Rift Build Lab could not start");
}
