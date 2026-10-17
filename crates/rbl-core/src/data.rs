//! Versioned build data for the desktop app (plan §2.6).
//!
//! The app ships a bundled snapshot and can install newer revisions published with the website.
//! A revision is downloaded into staging, checked file by file against the manifest, validated
//! as a whole, and only then activated by an atomic pointer switch. One previous revision is
//! kept; the bundled snapshot is always available. Revisions are never mixed.

use std::collections::{BTreeMap, HashMap};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::CoreError;
use crate::backup::format_utc;
use crate::bundle::validate;
use crate::catalog::Catalog;
use crate::fsx::atomic_write_json;
use crate::json::parse_strict;

/// Must equal `FORMULA_COMPAT` in `src/model-support.ts`; data for another value needs an app update.
pub const FORMULA_COMPAT: u32 = 1;
pub const DATA_BASE: &str = "https://unskilled-skill.github.io/rift-build-lab/data/";
pub const MANIFEST_URL: &str = "https://unskilled-skill.github.io/rift-build-lab/data/desktop/manifest.json";
pub const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 3600);

const MAX_MANIFEST: usize = 2 * 1024 * 1024;
const MAX_FILE: u64 = 16 * 1024 * 1024;
const MAX_TOTAL: u64 = 64 * 1024 * 1024;
const MAX_FILES: usize = 5000;
const ALLOWED: [&str; 11] = [
    "catalog.json",
    "chatgpt-builds.json",
    "champion-meta-plans.json",
    "meta-baselines.json",
    "champions/",
    "champion-builds/",
    "ability-ceilings/",
    "interaction-audit/",
    "provider-research/",
    "provider-roles/",
    "desktop/meta-bundles/",
];
const ROLES: [&str; 5] = ["top", "jungle", "mid", "adc", "support"];

const APP_UPDATE: CoreError = CoreError::DataIncompatible {
    reason: "This build data needs an app update. Download the latest Rift Build Lab release; your installed data is kept.",
};
const INVALID_MANIFEST: CoreError =
    CoreError::DataIncompatible { reason: "The published data manifest is invalid. Your installed data is kept." };
const INVALID_SNAPSHOT: CoreError =
    CoreError::DataIncompatible { reason: "The installed build data is invalid. Reinstall Rift Build Lab to restore it." };

/// Same rule as `isManifestPath` in `scripts/desktop-data/generate.ts`.
pub fn is_manifest_path(path: &str) -> bool {
    !path.is_empty()
        && path.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'/' | b'-'))
        && !path.ends_with('/')
        && !path.split('/').any(|part| part.is_empty() || part == "." || part == "..")
        && ALLOWED.iter().any(|a| if a.ends_with('/') { path.starts_with(a) } else { path == *a })
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

fn is_sha256(text: &str) -> bool {
    text.len() == 64 && text.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManifestFile {
    pub path: String,
    pub bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SourceCheckedAt {
    pub providers: String,
    pub roles: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub schema: u32,
    pub formula_compat: u32,
    pub revision: String,
    pub patch: String,
    pub data_version: String,
    pub generated_at: String,
    pub source_checked_at: SourceCheckedAt,
    pub files: Vec<ManifestFile>,
}

/// Parses and checks a manifest: compatibility first, then paths, hashes, limits and the revision id.
pub fn parse_manifest(bytes: &[u8], formula_compat: u32) -> Result<Manifest, CoreError> {
    if bytes.len() > MAX_MANIFEST {
        return Err(INVALID_MANIFEST);
    }
    let value = std::str::from_utf8(bytes).ok().and_then(|t| parse_strict(t).ok()).ok_or(INVALID_MANIFEST)?;
    if value.get("schema") != Some(&json!(1)) || value.get("formulaCompat") != Some(&json!(formula_compat)) {
        return Err(if value.get("schema").is_some_and(Value::is_u64) && value.get("formulaCompat").is_some_and(Value::is_u64) {
            APP_UPDATE
        } else {
            INVALID_MANIFEST
        });
    }
    let manifest: Manifest = serde_json::from_value(value).map_err(|_| INVALID_MANIFEST)?;
    let files = &manifest.files;
    let sorted_unique = files.windows(2).all(|w| w[0].path < w[1].path);
    let total: u64 = files.iter().map(|f| f.bytes).sum();
    let revision = sha256_hex(files.iter().map(|f| format!("{}:{}", f.path, f.sha256)).collect::<Vec<_>>().join("\n").as_bytes());
    let ok = !files.is_empty()
        && files.len() <= MAX_FILES
        && sorted_unique
        && total <= MAX_TOTAL
        && files.iter().all(|f| is_manifest_path(&f.path) && is_sha256(&f.sha256) && f.bytes <= MAX_FILE)
        && files.iter().any(|f| f.path == "catalog.json")
        && is_sha256(&manifest.revision)
        && manifest.revision == revision;
    if ok { Ok(manifest) } else { Err(INVALID_MANIFEST) }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MetaRole {
    plan_id: String,
    bundle: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MetaBundleFile {
    version: u32,
    patch: String,
    data_version: String,
    champion: String,
    roles: BTreeMap<String, MetaRole>,
}

/// Whole-revision checks beyond hashes: the catalog matches the manifest, every meta fallback
/// bundle validates against it, and every file is well-formed JSON.
fn validate_revision(dir: &Path, manifest: &Manifest) -> Result<(), CoreError> {
    let read = |path: &str| std::fs::read(dir.join(path)).map_err(|_| INVALID_MANIFEST);
    let catalog = Catalog::from_published_json(std::str::from_utf8(&read("catalog.json")?).map_err(|_| INVALID_MANIFEST)?)?;
    if catalog.patch != manifest.patch || catalog.data_version != manifest.data_version {
        return Err(INVALID_MANIFEST);
    }
    for file in &manifest.files {
        let bytes = read(&file.path)?;
        if let Some(name) = file.path.strip_prefix("desktop/meta-bundles/") {
            let meta: MetaBundleFile = serde_json::from_slice(&bytes).map_err(|_| INVALID_MANIFEST)?;
            let valid = meta.version == 1
                && meta.patch == catalog.patch
                && meta.data_version == catalog.data_version
                && name == format!("{}.json", meta.champion)
                && !meta.roles.is_empty()
                && meta.roles.iter().all(|(role, entry)| {
                    ROLES.contains(&role.as_str())
                        && entry.plan_id.starts_with(&format!("meta:{}:{role}:", meta.champion))
                        && entry.bundle["championAlias"] == meta.champion.as_str()
                        && validate(&entry.bundle, &catalog).is_ok()
                });
            if !valid {
                return Err(INVALID_MANIFEST);
            }
        } else if serde_json::from_slice::<serde::de::IgnoredAny>(&bytes).is_err() {
            return Err(INVALID_MANIFEST);
        }
    }
    Ok(())
}

/// Network access for updates; only the fixed publication URLs are ever requested.
pub trait Fetch {
    fn get(&self, url: &str) -> impl Future<Output = Result<Vec<u8>, CoreError>> + Send;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum UpdateStatus {
    UpToDate,
    Updated,
    Offline,
    Failed,
    AppUpdateRequired,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataUpdateResult {
    pub status: UpdateStatus,
    pub revision: String,
    pub patch: String,
    pub checked_at: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionInfo {
    pub revision: String,
    pub patch: String,
    pub data_version: String,
    pub generated_at: String,
    pub source_checked_at: SourceCheckedAt,
    /// True while running from the snapshot shipped with the app.
    pub bundled: bool,
}

#[derive(Serialize, Deserialize)]
struct Pointer {
    revision: String,
    previous: Option<String>,
}

struct Active {
    dir: PathBuf,
    manifest: Manifest,
    hashes: HashMap<String, String>,
    bundled: bool,
}

impl Active {
    fn load(dir: PathBuf, formula_compat: u32, bundled: bool) -> Option<Self> {
        let manifest = parse_manifest(&std::fs::read(dir.join("desktop/manifest.json")).ok()?, formula_compat).ok()?;
        let hashes = manifest.files.iter().map(|f| (f.path.clone(), f.sha256.clone())).collect();
        Some(Active { dir, manifest, hashes, bundled })
    }
}

pub struct DataStore {
    root: PathBuf,
    bundled: PathBuf,
    formula_compat: u32,
    active: Active,
    previous: Option<String>,
}

impl DataStore {
    /// Uses the installed revision, or the bundled snapshot when it is newer or nothing valid is installed.
    pub fn open(root: &Path, bundled: &Path, formula_compat: u32) -> Result<Self, CoreError> {
        let snapshot = Active::load(bundled.to_path_buf(), formula_compat, true).ok_or(INVALID_SNAPSHOT)?;
        let pointer: Option<Pointer> = std::fs::read(root.join("current.json")).ok().and_then(|b| serde_json::from_slice(&b).ok());
        let installed =
            pointer.as_ref().filter(|p| is_sha256(&p.revision)).and_then(|p| Active::load(root.join(&p.revision), formula_compat, false));
        let active = match installed {
            Some(installed) if installed.manifest.generated_at >= snapshot.manifest.generated_at => installed,
            _ => snapshot,
        };
        Ok(DataStore {
            root: root.to_path_buf(),
            bundled: bundled.to_path_buf(),
            formula_compat,
            previous: pointer.and_then(|p| p.previous),
            active,
        })
    }

    pub fn revision(&self) -> RevisionInfo {
        let m = &self.active.manifest;
        RevisionInfo {
            revision: m.revision.clone(),
            patch: m.patch.clone(),
            data_version: m.data_version.clone(),
            generated_at: m.generated_at.clone(),
            source_checked_at: m.source_checked_at.clone(),
            bundled: self.active.bundled,
        }
    }

    /// File for a published data path (relative to `data/`), only if it belongs to the active revision.
    pub fn resolve(&self, path: &str) -> Option<PathBuf> {
        (is_manifest_path(path) && self.active.hashes.contains_key(path)).then(|| self.active.dir.join(path))
    }

    fn result(&self, status: UpdateStatus, message: &str) -> DataUpdateResult {
        DataUpdateResult {
            status,
            revision: self.active.manifest.revision.clone(),
            patch: self.active.manifest.patch.clone(),
            checked_at: format_utc(SystemTime::now()).0,
            message: message.to_owned(),
        }
    }

    fn remove_stale(&self, keep: &[&str]) {
        let Ok(entries) = std::fs::read_dir(&self.root) else { return };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let stale = name.starts_with("staging-") || (is_sha256(&name) && !keep.contains(&name.as_str()));
            if stale && entry.path().is_dir() {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }

    /// Checks the publication and installs a newer compatible revision.
    pub async fn update<F: Fetch>(&mut self, fetch: &F) -> DataUpdateResult {
        let current = self.active.manifest.revision.clone();
        let keep: Vec<String> = [Some(current.clone()), self.previous.clone()].into_iter().flatten().collect();
        self.remove_stale(&keep.iter().map(String::as_str).collect::<Vec<_>>());
        let Ok(bytes) = fetch.get(MANIFEST_URL).await else {
            return self.result(UpdateStatus::Offline, "Could not reach the data server. Using installed data.");
        };
        let manifest = match parse_manifest(&bytes, self.formula_compat) {
            Ok(m) => m,
            Err(error) if error == APP_UPDATE => return self.result(UpdateStatus::AppUpdateRequired, &error.to_string()),
            Err(error) => return self.result(UpdateStatus::Failed, &error.to_string()),
        };
        if manifest.revision == current {
            return self.result(UpdateStatus::UpToDate, "Build data is up to date.");
        }
        let staging = self.root.join(format!("staging-{}", manifest.revision));
        match self.stage(fetch, &manifest, &bytes, &staging).await {
            Ok(()) => {}
            Err(_) => {
                let _ = std::fs::remove_dir_all(&staging);
                return self.result(UpdateStatus::Failed, "The data update could not be verified. Your installed data was kept.");
            }
        }
        let target = self.root.join(&manifest.revision);
        let _ = std::fs::remove_dir_all(&target);
        let previous = (!self.active.bundled).then(|| current.clone());
        let activated = std::fs::rename(&staging, &target)
            .ok()
            .and_then(|_| {
                atomic_write_json(
                    &self.root.join("current.json"),
                    &Pointer { revision: manifest.revision.clone(), previous: previous.clone() },
                )
                .ok()
            })
            .and_then(|_| Active::load(target.clone(), self.formula_compat, false));
        let Some(active) = activated else {
            let _ = std::fs::remove_dir_all(&staging);
            return self.result(UpdateStatus::Failed, "The data update could not be installed. Your installed data was kept.");
        };
        self.active = active;
        self.previous = previous;
        let keep: Vec<&str> = [Some(manifest.revision.as_str()), self.previous.as_deref()].into_iter().flatten().collect();
        self.remove_stale(&keep);
        self.result(UpdateStatus::Updated, "Build data updated.")
    }

    /// Fills `staging` with every manifest file, reusing identical local files, then validates it.
    async fn stage<F: Fetch>(&self, fetch: &F, manifest: &Manifest, manifest_bytes: &[u8], staging: &Path) -> Result<(), CoreError> {
        let _ = std::fs::remove_dir_all(staging);
        let write = |path: &Path, bytes: &[u8]| -> Result<(), CoreError> {
            std::fs::create_dir_all(path.parent().ok_or(CoreError::Internal)?).map_err(|_| CoreError::Internal)?;
            std::fs::write(path, bytes).map_err(|_| CoreError::Internal)
        };
        for file in &manifest.files {
            let local = (self.active.hashes.get(&file.path) == Some(&file.sha256))
                .then(|| std::fs::read(self.active.dir.join(&file.path)).ok())
                .flatten()
                .filter(|bytes| sha256_hex(bytes) == file.sha256);
            let bytes = match local {
                Some(bytes) => bytes,
                None => fetch.get(&format!("{DATA_BASE}{}", file.path)).await?,
            };
            if bytes.len() as u64 != file.bytes || sha256_hex(&bytes) != file.sha256 {
                return Err(INVALID_MANIFEST);
            }
            write(&staging.join(&file.path), &bytes)?;
        }
        write(&staging.join("desktop/manifest.json"), manifest_bytes)?;
        validate_revision(staging, manifest)
    }

    pub fn bundled_dir(&self) -> &Path {
        &self.bundled
    }
}

/// Launch check, then at most once per [`CHECK_INTERVAL`] unless the user asks.
#[derive(Debug, Default)]
pub struct UpdateThrottle {
    last: Option<Instant>,
}

impl UpdateThrottle {
    pub fn due(&mut self, now: Instant, explicit: bool) -> bool {
        let due = explicit || self.last.is_none_or(|last| now.saturating_duration_since(last) >= CHECK_INTERVAL);
        if due {
            self.last = Some(now);
        }
        due
    }
}
