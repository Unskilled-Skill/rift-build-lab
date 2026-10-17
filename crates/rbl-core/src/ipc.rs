//! The desktop window's native interface (plan §2.4), independent of Tauri so it can be tested.
//!
//! Every request type rejects unknown fields; bundles are size-limited here and validated again by
//! the writer. Results never contain credentials, client URLs or file contents.

use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::CoreError;
use crate::apply::ApplyOutcome;
use crate::auto_import::Status;
use crate::data::{DataStore, DataUpdateResult, FORMULA_COMPAT, Fetch, RevisionInfo};
use crate::deeplink::OpenBuild;
use crate::monitor::{Command, MonitorHandle};
use crate::net::{RELEASES_API, RELEASES_PAGE};
use crate::paths::AppPaths;
use crate::prefs::{Preferences, PreferencesPatch, PrefsStore, Role};

/// Commands the main window may invoke (each needs an `allow-…` permission in its capability).
pub const COMMANDS: [&str; 19] = [
    "get_status",
    "test_connection",
    "apply_build",
    "set_default_build",
    "clear_default_build",
    "get_preferences",
    "update_preferences",
    "pause_auto_import",
    "resume_auto_import",
    "reapply_last",
    "open_backup_folder",
    "check_data_updates",
    "get_data_revision",
    "open_external",
    "check_app_update",
    "ui_state_saved",
    "take_pending_open",
    "set_window_activity",
    "install_app_update",
];
pub const MAX_BUNDLE_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct IpcError {
    pub code: &'static str,
    pub message: String,
    pub recovery: &'static str,
}

impl From<CoreError> for IpcError {
    fn from(error: CoreError) -> Self {
        IpcError { code: error.code(), message: error.to_string(), recovery: error.recovery() }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ApplyBuildRequest {
    pub bundle: Value,
    pub items: bool,
    pub runes: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DefaultRequest {
    pub champion: String,
    pub role: Role,
    pub plan_id: String,
    pub bundle: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DefaultKey {
    pub champion: String,
    pub role: Role,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum ExternalLink {
    Releases,
    RiotLcuPolicy,
    Website,
    Source { url: String },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResultDto {
    pub outcome: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionDto {
    pub reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_version: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateDto {
    pub current: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_url: Option<String>,
    /// A signed update has been downloaded and verified; it installs on quit or on request.
    pub ready: bool,
}

pub fn apply_result(outcome: &ApplyOutcome) -> ApplyResultDto {
    let (message, backup) = match outcome {
        ApplyOutcome::Verified { backup } => ("League reported the new items and runes back.".to_owned(), Some(backup)),
        ApplyOutcome::AppliedUnverified { backup } => ("League accepted the change but could not be read back.".to_owned(), Some(backup)),
        ApplyOutcome::RolledBack { error, backup } | ApplyOutcome::Partial { error, backup } => (error.to_string(), Some(backup)),
        ApplyOutcome::Rejected { error } => (error.to_string(), None),
    };
    ApplyResultDto { outcome: outcome.kind(), message, backup_path: backup.map(|b| b.display().to_string()) }
}

const SOURCE_HOSTS: [&str; 8] = [
    "op.gg",
    "www.op.gg",
    "lolalytics.com",
    "mobalytics.gg",
    "developer.riotgames.com",
    "www.leagueoflegends.com",
    "github.com",
    "unskilled-skill.github.io",
];

/// The fixed address for a link; source links must be plain HTTPS URLs on known provider hosts.
pub fn external_url(link: &ExternalLink) -> Result<String, IpcError> {
    let invalid = || IpcError::from(CoreError::InvalidBundle { reason: "This link cannot be opened from the app." });
    Ok(match link {
        ExternalLink::Releases => RELEASES_PAGE.to_owned(),
        ExternalLink::RiotLcuPolicy => "https://developer.riotgames.com/docs/lol#league-client-api".to_owned(),
        ExternalLink::Website => "https://unskilled-skill.github.io/rift-build-lab/".to_owned(),
        ExternalLink::Source { url } => {
            let rest = url.strip_prefix("https://").ok_or_else(invalid)?;
            let (host, path) = rest.split_once('/').unwrap_or((rest, ""));
            let safe = url.len() <= 2048
                && SOURCE_HOSTS.contains(&host)
                && path.bytes().all(|b| b.is_ascii_alphanumeric() || b"-._~/?=&%+#".contains(&b));
            if !safe {
                return Err(invalid());
            }
            url.clone()
        }
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct DataResponse {
    pub status: u16,
    pub content_type: &'static str,
    pub body: Vec<u8>,
}

/// Serves `/data/<path>` for the `rbldata` protocol from the active revision only.
pub fn serve_data(store: &DataStore, request_path: &str) -> DataResponse {
    let not_found = DataResponse { status: 404, content_type: "text/plain", body: b"Not found".to_vec() };
    let path = request_path.split(['?', '#']).next().unwrap_or("");
    let Some(file) = path.strip_prefix("/data/").and_then(|relative| store.resolve(relative)) else { return not_found };
    match std::fs::read(file) {
        Ok(body) => DataResponse { status: 200, content_type: "application/json", body },
        Err(_) => not_found,
    }
}

fn version(text: &str) -> Option<(u64, u64, u64)> {
    let mut parts = text.split('.').map(|p| p.parse::<u64>().ok());
    let triple = (parts.next()??, parts.next()??, parts.next()??);
    parts.next().is_none().then_some(triple)
}

/// Shared native state behind the commands.
pub struct Core {
    pub data_updates: tokio::sync::Mutex<()>,
    pub window_data: Arc<RwLock<DataStore>>,
    pub monitor: MonitorHandle,
    pub prefs: Arc<Mutex<PrefsStore>>,
    pub data: Arc<RwLock<DataStore>>,
    pub paths: AppPaths,
    pub bundled: PathBuf,
    pub app_version: String,
    /// Signalled when the window has saved its state before being closed to the tray.
    pub ui_saved: Arc<tokio::sync::Notify>,
    /// A build link received while no window could take it yet.
    pub pending_open: Mutex<Option<OpenBuild>>,
}

impl Core {
    fn prefs(&self) -> Result<std::sync::MutexGuard<'_, PrefsStore>, IpcError> {
        self.prefs.lock().map_err(|_| CoreError::Internal.into())
    }

    pub fn status(&self) -> Value {
        self.monitor.status().to_json()
    }

    pub fn status_value(&self) -> Status {
        self.monitor.status()
    }

    pub async fn test_connection(&self) -> TestConnectionDto {
        match self.monitor.test_connection().await {
            Ok(version) => TestConnectionDto {
                reachable: true,
                message: format!("Connected to League Client {version}."),
                client_version: Some(version),
            },
            Err(error) => TestConnectionDto { reachable: false, client_version: None, message: error.to_string() },
        }
    }

    pub async fn apply_build(&self, request: ApplyBuildRequest) -> Result<ApplyResultDto, IpcError> {
        if serde_json::to_vec(&request.bundle).map_or(true, |b| b.len() > MAX_BUNDLE_BYTES) {
            return Err(CoreError::InvalidBundle { reason: "The build file is too large." }.into());
        }
        Ok(apply_result(&self.monitor.apply_now(request.bundle, request.items, request.runes).await?))
    }

    pub async fn set_default(&self, request: DefaultRequest) -> Result<(), IpcError> {
        if serde_json::to_vec(&request.bundle).map_or(true, |b| b.len() > MAX_BUNDLE_BYTES) {
            return Err(CoreError::InvalidBundle { reason: "The build file is too large." }.into());
        }
        let catalog = self.data.read().map_err(|_| CoreError::Internal)?.catalog()?;
        self.prefs()?.set_default(&request.champion, request.role, &request.plan_id, &request.bundle, &catalog)?;
        self.monitor.send(Command::PrefsChanged).await?;
        Ok(())
    }

    pub async fn clear_default(&self, key: DefaultKey) -> Result<(), IpcError> {
        self.prefs()?.clear_default(&key.champion, key.role)?;
        self.monitor.send(Command::PrefsChanged).await?;
        Ok(())
    }

    pub fn preferences(&self) -> Result<Preferences, IpcError> {
        Ok(self.prefs()?.prefs().clone())
    }

    pub async fn update_preferences(&self, patch: PreferencesPatch) -> Result<Preferences, IpcError> {
        let (before, after) = {
            let mut store = self.prefs()?;
            let before = store.prefs().auto_import.enabled;
            let after = store.update(patch)?.clone();
            (before, after)
        };
        if before != after.auto_import.enabled {
            self.monitor.send(if after.auto_import.enabled { Command::Enable } else { Command::Disable }).await?;
        }
        self.monitor.send(Command::PrefsChanged).await?;
        Ok(after)
    }

    pub async fn pause(&self) -> Result<(), IpcError> {
        Ok(self.monitor.send(Command::Pause).await?)
    }

    pub async fn resume(&self) -> Result<(), IpcError> {
        Ok(self.monitor.send(Command::Resume).await?)
    }

    pub async fn reapply(&self) -> Result<(), IpcError> {
        Ok(self.monitor.send(Command::Reapply).await?)
    }

    /// Creates the backup folder if needed so it can be shown.
    pub fn backup_folder(&self) -> Result<PathBuf, IpcError> {
        std::fs::create_dir_all(&self.paths.backups).map_err(|_| CoreError::BackupFailed)?;
        Ok(self.paths.backups.clone())
    }

    pub fn save_ui_state(&self, state: Value) -> Result<(), IpcError> {
        let result = self.prefs()?.set_ui(state);
        result?;
        self.ui_saved.notify_waiters();
        Ok(())
    }

    pub fn take_pending_open(&self) -> Option<OpenBuild> {
        self.pending_open.lock().ok().and_then(|mut pending| pending.take())
    }

    pub fn data_revision(&self) -> Result<RevisionInfo, IpcError> {
        Ok(self.data.read().map_err(|_| CoreError::Internal)?.revision())
    }

    /// Installs a newer compatible data revision; the shared store is swapped only after success.
    pub async fn check_data_updates<F: Fetch>(&self, fetch: &F) -> Result<DataUpdateResult, IpcError> {
        let _update = self.data_updates.lock().await;
        let mut fresh = DataStore::open(&self.paths.data, &self.bundled, FORMULA_COMPAT)?;
        let pinned = self.window_data.read().map_err(|_| CoreError::Internal)?.revision().revision;
        fresh.retain_revision(&pinned);
        let result = fresh.update(fetch).await;
        if result.status == crate::data::UpdateStatus::Updated {
            *self.data.write().map_err(|_| CoreError::Internal)? = fresh;
            self.monitor.send(Command::PrefsChanged).await?;
        }
        Ok(result)
    }

    /// Compares the newest `desktop-v*` GitHub release with this build; offline checks report no update.
    pub async fn check_app_update<F: Fetch>(&self, fetch: &F) -> AppUpdateDto {
        let none = AppUpdateDto { current: self.app_version.clone(), latest: None, release_url: None, ready: false };
        let Ok(bytes) = fetch.get(RELEASES_API).await else { return none };
        let Ok(release) = serde_json::from_slice::<Value>(&bytes) else { return none };
        let Some(latest) = release.get("tag_name").and_then(Value::as_str).and_then(|t| t.strip_prefix("desktop-v")) else { return none };
        match (version(latest), version(&self.app_version)) {
            (Some(newest), Some(current)) if newest > current => {
                let page = release.get("html_url").and_then(Value::as_str).filter(|u| u.starts_with(&format!("{RELEASES_PAGE}/")));
                AppUpdateDto { latest: Some(latest.to_owned()), release_url: Some(page.unwrap_or(RELEASES_PAGE).to_owned()), ..none }
            }
            (Some(_), Some(_)) => AppUpdateDto { latest: Some(latest.to_owned()), ..none },
            _ => none,
        }
    }
}
