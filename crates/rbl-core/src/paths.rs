//! Per-user storage locations. Settings roam with `%APPDATA%`; data, backups and caches stay in
//! `%LOCALAPPDATA%`. Uninstalling the app leaves both in place.

use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    pub preferences: PathBuf,
    pub data: PathBuf,
    pub backups: PathBuf,
}

impl AppPaths {
    pub fn from_env() -> Option<Self> {
        let roaming = PathBuf::from(std::env::var_os("APPDATA")?).join("RiftBuildLab");
        let local = PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join("RiftBuildLab");
        Some(AppPaths { preferences: roaming.join("preferences.json"), data: local.join("data"), backups: local.join("backups") })
    }
}
