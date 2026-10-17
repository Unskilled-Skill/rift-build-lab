//! Automatic app updates through Tauri's signed updater.
//!
//! The app checks GitHub's latest release at launch and every six hours. A newer version is
//! downloaded in the background and only kept if its signature matches the public key built into
//! this app. It installs when the user quits (or chooses Restart to update), never mid-session.

use std::sync::Mutex;
use std::time::Duration;

use rbl_core::ipc::AppUpdateDto;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

pub const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 3600);
const RELEASES_PAGE: &str = "https://github.com/Unskilled-Skill/rift-build-lab/releases";

struct Ready {
    update: Update,
    bytes: Vec<u8>,
}

/// A downloaded, signature-verified update waiting to be installed.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Ready>>);

fn dto(app: &AppHandle, latest: Option<String>, ready: bool) -> AppUpdateDto {
    let current = app.package_info().version.to_string();
    let release_url = latest.as_ref().filter(|l| **l != current).map(|l| format!("{RELEASES_PAGE}/tag/desktop-v{l}"));
    AppUpdateDto { current, latest, release_url, ready }
}

/// Checks for a newer release and downloads it. Network failures report "no update" and are retried later.
pub async fn check_and_download(app: &AppHandle) -> AppUpdateDto {
    let pending = app.state::<PendingUpdate>();
    if let Some(version) = pending.0.lock().ok().and_then(|r| r.as_ref().map(|r| r.update.version.clone())) {
        return dto(app, Some(version), true);
    }
    let Ok(updater) = app.updater() else { return dto(app, None, false) };
    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => return dto(app, Some(app.package_info().version.to_string()), false),
        Err(_) => return dto(app, None, false),
    };
    // `download` verifies the signature against the bundled public key before returning the bytes.
    match update.download(|_, _| {}, || {}).await {
        Ok(bytes) => {
            let version = update.version.clone();
            if let Ok(mut slot) = pending.0.lock() {
                *slot = Some(Ready { update, bytes });
            }
            let _ = app.emit("app-update-ready", &version);
            dto(app, Some(version), true)
        }
        Err(_) => dto(app, Some(update.version.clone()), false),
    }
}

/// Runs the downloaded installer (passive mode). On Windows this exits the app; returns false if nothing is ready.
pub fn install_ready(app: &AppHandle) -> bool {
    let Some(ready) = app.try_state::<PendingUpdate>().and_then(|p| p.0.lock().ok().and_then(|mut slot| slot.take())) else {
        return false;
    };
    ready.update.install(&ready.bytes).is_ok()
}

pub fn spawn_checks(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            check_and_download(&app).await;
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}
