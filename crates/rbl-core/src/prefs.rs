//! Desktop preferences (`%APPDATA%\RiftBuildLab\preferences.json`, schema 1).
//!
//! Stored outside WebView storage so background imports work with the window closed. Writes are
//! atomic and happen only when content changes. A file written by a newer version, or one that
//! cannot be read, is never overwritten unless the user explicitly resets it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::CoreError;
use crate::bundle::validate;
use crate::catalog::Catalog;
use crate::fsx::atomic_write_json;

pub const SCHEMA: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Top,
    Jungle,
    Mid,
    Adc,
    Support,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Role::Top => "top",
            Role::Jungle => "jungle",
            Role::Mid => "mid",
            Role::Adc => "adc",
            Role::Support => "support",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoImport {
    pub enabled: bool,
    pub items: bool,
    pub runes: bool,
    pub meta_fallback: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Background {
    pub tray_on_close: bool,
    pub start_with_windows: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultBuild {
    pub plan_id: String,
    pub patch: String,
    pub bundle_sha256: String,
    pub bundle: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastApplied {
    pub at: String,
    pub champion: String,
    pub role: Role,
    pub plan_id: String,
    pub outcome: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFailure {
    pub at: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub schema: u32,
    pub auto_import: AutoImport,
    pub background: Background,
    /// Keyed `Champion|role`.
    pub defaults: BTreeMap<String, DefaultBuild>,
    /// Defaults that no longer validate against the installed data (another patch, or edited files).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub needs_review: BTreeMap<String, DefaultBuild>,
    pub last_applied: Option<LastApplied>,
    pub last_failure: Option<LastFailure>,
}

impl Default for Preferences {
    fn default() -> Self {
        Preferences {
            schema: SCHEMA,
            auto_import: AutoImport { enabled: false, items: true, runes: true, meta_fallback: false },
            background: Background::default(),
            defaults: BTreeMap::new(),
            needs_review: BTreeMap::new(),
            last_applied: None,
            last_failure: None,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AutoImportPatch {
    pub enabled: Option<bool>,
    pub items: Option<bool>,
    pub runes: Option<bool>,
    pub meta_fallback: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BackgroundPatch {
    pub tray_on_close: Option<bool>,
    pub start_with_windows: Option<bool>,
}

/// The only settings the UI may change directly; defaults go through [`PrefsStore::set_default`].
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreferencesPatch {
    pub auto_import: Option<AutoImportPatch>,
    pub background: Option<BackgroundPatch>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadIssue {
    None,
    /// Written by a newer version; kept untouched.
    UnknownSchema,
    /// Not readable as preferences; kept untouched.
    Unreadable,
}

pub struct PrefsStore {
    path: PathBuf,
    prefs: Preferences,
    issue: LoadIssue,
    saved: Option<Vec<u8>>,
}

const LOCKED: CoreError = CoreError::DataIncompatible {
    reason: "Your preferences file was written by a newer version or could not be read. Reset preferences to continue; a copy of the old file is kept.",
};

fn key(champion: &str, role: Role) -> String {
    format!("{champion}|{}", role.as_str())
}

fn valid_plan_id(id: &str) -> bool {
    (1..=300).contains(&id.len()) && id.contains(':') && id.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b':' | b'_' | b'-'))
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// A stored default is usable only if it validates against the installed catalog unchanged.
fn still_valid(stored_key: &str, default: &DefaultBuild, catalog: &Catalog) -> bool {
    let Some((champion, _)) = stored_key.split_once('|') else { return false };
    default.patch == catalog.patch
        && default.bundle["championAlias"] == champion
        && validate(&default.bundle, catalog)
            .is_ok_and(|v| sha256_hex(&serde_json::to_vec(v.value()).unwrap_or_default()) == default.bundle_sha256)
}

impl PrefsStore {
    /// Loads preferences and moves defaults that no longer validate to `needs_review`.
    pub fn load(path: &Path, catalog: &Catalog) -> Self {
        let (prefs, issue, saved) = match std::fs::read(path) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => (Preferences::default(), LoadIssue::None, None),
            Err(_) => (Preferences::default(), LoadIssue::Unreadable, None),
            Ok(bytes) => match serde_json::from_slice::<Value>(&bytes) {
                Ok(value) if value.get("schema").and_then(Value::as_u64) != Some(u64::from(SCHEMA)) && value.get("schema").is_some() => {
                    (Preferences::default(), LoadIssue::UnknownSchema, None)
                }
                Ok(value) => match serde_json::from_value::<Preferences>(value) {
                    Ok(prefs) => (prefs, LoadIssue::None, Some(bytes)),
                    Err(_) => (Preferences::default(), LoadIssue::Unreadable, None),
                },
                Err(_) => (Preferences::default(), LoadIssue::Unreadable, None),
            },
        };
        let mut store = PrefsStore { path: path.to_path_buf(), prefs, issue, saved };
        let defaults = std::mem::take(&mut store.prefs.defaults);
        let review = std::mem::take(&mut store.prefs.needs_review);
        for (stored_key, default) in defaults.into_iter().chain(review) {
            if still_valid(&stored_key, &default, catalog) {
                store.prefs.defaults.insert(stored_key, default);
            } else {
                store.prefs.needs_review.insert(stored_key, default);
            }
        }
        store
    }

    pub fn prefs(&self) -> &Preferences {
        &self.prefs
    }

    pub fn issue(&self) -> LoadIssue {
        self.issue
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn save(&mut self) -> Result<(), CoreError> {
        if self.issue != LoadIssue::None {
            return Err(LOCKED);
        }
        let bytes = serde_json::to_vec_pretty(&self.prefs).map_err(|_| CoreError::Internal)?;
        if self.saved.as_ref() == Some(&bytes) {
            return Ok(());
        }
        atomic_write_json(&self.path, &self.prefs).map_err(|_| CoreError::Internal)?;
        self.saved = Some(bytes);
        Ok(())
    }

    /// Runs `change` on a copy and keeps it only if it is valid and saved.
    fn change(&mut self, change: impl FnOnce(&mut Preferences) -> Result<(), CoreError>) -> Result<&Preferences, CoreError> {
        if self.issue != LoadIssue::None {
            return Err(LOCKED);
        }
        let previous = self.prefs.clone();
        let result = change(&mut self.prefs).and_then(|_| self.save());
        if result.is_err() {
            self.prefs = previous;
        }
        result.map(|_| &self.prefs)
    }

    pub fn update(&mut self, patch: PreferencesPatch) -> Result<&Preferences, CoreError> {
        self.change(|prefs| {
            if let Some(p) = patch.auto_import {
                let a = &mut prefs.auto_import;
                a.enabled = p.enabled.unwrap_or(a.enabled);
                a.items = p.items.unwrap_or(a.items);
                a.runes = p.runes.unwrap_or(a.runes);
                a.meta_fallback = p.meta_fallback.unwrap_or(a.meta_fallback);
            }
            if let Some(p) = patch.background {
                let b = &mut prefs.background;
                b.tray_on_close = p.tray_on_close.unwrap_or(b.tray_on_close);
                b.start_with_windows = p.start_with_windows.unwrap_or(b.start_with_windows);
            }
            if prefs.auto_import.enabled && !prefs.auto_import.items && !prefs.auto_import.runes {
                return Err(CoreError::InvalidBundle { reason: "Choose items, runes, or both for automatic imports." });
            }
            Ok(())
        })
    }

    /// Stores `bundle` as the automatic default for a champion and role after validating it.
    pub fn set_default(&mut self, champion: &str, role: Role, plan_id: &str, bundle: &Value, catalog: &Catalog) -> Result<(), CoreError> {
        if !valid_plan_id(plan_id) {
            return Err(CoreError::InvalidBundle { reason: "Invalid build identifier." });
        }
        let valid = validate(bundle, catalog)?;
        if catalog.champions.iter().all(|c| c.alias != champion) || valid.value()["championAlias"] != champion {
            return Err(CoreError::InvalidBundle { reason: "This build is for a different champion." });
        }
        let bytes = serde_json::to_vec(valid.value()).map_err(|_| CoreError::Internal)?;
        let default = DefaultBuild {
            plan_id: plan_id.to_owned(),
            patch: catalog.patch.clone(),
            bundle_sha256: sha256_hex(&bytes),
            bundle: valid.into_value(),
        };
        self.change(|prefs| {
            let k = key(champion, role);
            prefs.needs_review.remove(&k);
            prefs.defaults.insert(k, default);
            Ok(())
        })
        .map(|_| ())
    }

    pub fn clear_default(&mut self, champion: &str, role: Role) -> Result<(), CoreError> {
        self.change(|prefs| {
            let k = key(champion, role);
            prefs.defaults.remove(&k);
            prefs.needs_review.remove(&k);
            Ok(())
        })
        .map(|_| ())
    }

    pub fn default_for(&self, champion: &str, role: Role) -> Option<&DefaultBuild> {
        self.prefs.defaults.get(&key(champion, role))
    }

    pub fn record_applied(&mut self, at: &str, champion: &str, role: Role, plan_id: &str, outcome: &str) -> Result<(), CoreError> {
        let entry = LastApplied { at: at.into(), champion: champion.into(), role, plan_id: plan_id.into(), outcome: outcome.into() };
        self.change(|prefs| {
            prefs.last_applied = Some(entry);
            Ok(())
        })
        .map(|_| ())
    }

    pub fn record_failure(&mut self, at: &str, error: &CoreError) -> Result<(), CoreError> {
        let entry = LastFailure { at: at.into(), code: error.code().into(), message: error.to_string() };
        self.change(|prefs| {
            prefs.last_failure = Some(entry);
            Ok(())
        })
        .map(|_| ())
    }

    /// Explicit user reset: keeps the old file as `preferences.json.old-<n>` and starts from defaults.
    pub fn reset(&mut self) -> Result<PathBuf, CoreError> {
        let name = self.path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "preferences.json".into());
        let kept =
            (1..1000).map(|n| self.path.with_file_name(format!("{name}.old-{n}"))).find(|p| !p.exists()).ok_or(CoreError::Internal)?;
        if self.path.exists() {
            std::fs::copy(&self.path, &kept).map_err(|_| CoreError::Internal)?;
        }
        self.prefs = Preferences::default();
        self.issue = LoadIssue::None;
        self.saved = None;
        self.save()?;
        Ok(kept)
    }
}
