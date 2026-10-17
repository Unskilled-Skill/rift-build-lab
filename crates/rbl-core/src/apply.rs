//! Managed League writes with backup, rollback and read-back verification.
//!
//! A behavioural port of `apply_bundle` in `companion/core.py`, plus: read-back after writing,
//! an optional re-check that the account and locally selected champion are unchanged right
//! before each write, and one write queue shared by manual and automatic imports.

use std::num::NonZeroU64;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use tokio::sync::Mutex;

use crate::backup::{Backup, write_backup};
use crate::bundle::{ValidBundle, validate};
use crate::catalog::Catalog;
use crate::lcu::transport::{Lcu, LcuRequest, TransportError};
use crate::{CoreError, MANAGED_NAME};

/// Client phases in which settings may be changed.
pub const SAFE_PHASES: [&str; 5] = ["None", "Lobby", "Matchmaking", "ReadyCheck", "ChampSelect"];

/// The account and champion an automatic import was prepared for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExpectedSelection {
    pub summoner_id: u64,
    pub champion_id: i64,
}

#[derive(Debug, Clone, Copy)]
pub struct ApplyRequest<'a> {
    /// Untrusted bundle; validated against `catalog` before anything else.
    pub bundle: &'a Value,
    pub items: bool,
    pub runes: bool,
    pub expected: Option<ExpectedSelection>,
}

/// What happened. Only `Verified` means League reported the requested settings back.
#[derive(Debug, Clone, PartialEq)]
pub enum ApplyOutcome {
    Verified {
        backup: PathBuf,
    },
    /// Writes were accepted but reading them back failed.
    AppliedUnverified {
        backup: PathBuf,
    },
    /// A write failed and previous settings were restored.
    RolledBack {
        error: CoreError,
        backup: PathBuf,
    },
    /// League may be in a mixed state (`PartialApply`) or did not report what was written (`ReadbackMismatch`).
    Partial {
        error: CoreError,
        backup: PathBuf,
    },
    /// Nothing was changed.
    Rejected {
        error: CoreError,
    },
}

impl ApplyOutcome {
    /// Outcome name shared with the TypeScript `ApplyResult`.
    pub fn kind(&self) -> &'static str {
        match self {
            ApplyOutcome::Verified { .. } => "verified",
            ApplyOutcome::AppliedUnverified { .. } => "applied-unverified",
            ApplyOutcome::RolledBack { .. } => "rolled-back",
            ApplyOutcome::Partial { .. } => "partial",
            ApplyOutcome::Rejected { .. } => "rejected",
        }
    }
}

/// Owns the client connection and serializes every managed write.
pub struct Writer<L: Lcu> {
    lcu: L,
    backup_dir: PathBuf,
    queue: Mutex<()>,
}

/// `"16.20.123"` → `"16.20"`; anything else is unreadable.
fn major_minor(version: &Value) -> Option<String> {
    let mut parts = version.as_str()?.split('.');
    let (major, minor) = (parts.next()?, parts.next()?);
    let number = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    if !number(major) || !number(minor) {
        return None;
    }
    Some(format!("{}.{}", major.parse::<u64>().ok()?, minor.parse::<u64>().ok()?))
}

/// The locally selected champion in a champ-select session, if any.
pub fn local_champion(session: &Value) -> Option<i64> {
    let cell = session.get("localPlayerCellId")?;
    session.get("myTeam")?.as_array()?.iter().find(|p| p.get("cellId") == Some(cell))?.get("championId")?.as_i64()
}

fn rune_payload(page: &Value) -> Option<Value> {
    let keys = ["name", "primaryStyleId", "subStyleId", "selectedPerkIds", "current"];
    keys.iter().all(|k| page.get(k).is_some()).then(|| {
        json!({
            "name": page["name"], "primaryStyleId": page["primaryStyleId"], "subStyleId": page["subStyleId"],
            "selectedPerkIds": page["selectedPerkIds"], "current": page["current"],
        })
    })
}

enum Step {
    Done,
    Failed(TransportError),
}

impl<L: Lcu> Writer<L> {
    pub fn new(lcu: L, backup_dir: PathBuf) -> Self {
        Writer { lcu, backup_dir, queue: Mutex::new(()) }
    }

    pub fn lcu(&self) -> &L {
        &self.lcu
    }

    pub fn backup_dir(&self) -> &Path {
        &self.backup_dir
    }

    async fn get(&self, request: LcuRequest) -> Result<Value, CoreError> {
        self.lcu.call(request).await.map_err(|e| e.error)
    }

    async fn check_ready(&self, bundle: &ValidBundle, expected: Option<ExpectedSelection>) -> Result<(), CoreError> {
        let phase = self.get(LcuRequest::GetPhase).await?;
        let phase = phase.as_str().unwrap_or("Unknown");
        if !SAFE_PHASES.contains(&phase) {
            return Err(CoreError::UnsafePhase { phase: phase.to_owned() });
        }
        let data = major_minor(&json!(bundle.data_version())).unwrap_or_default();
        match major_minor(&self.get(LcuRequest::GetGameVersion).await?) {
            Some(client) if client == data => {}
            client => return Err(CoreError::PatchMismatch { client: client.unwrap_or_else(|| "unknown".into()), data }),
        }
        if let Some(expected) = expected {
            let summoner = self.get(LcuRequest::GetSummoner).await?;
            let session = self.get(LcuRequest::GetChampSelectSession).await.map_err(|_| CoreError::SelectionChanged)?;
            if summoner.get("summonerId").and_then(Value::as_u64) != Some(expected.summoner_id)
                || local_champion(&session) != Some(expected.champion_id)
            {
                return Err(CoreError::SelectionChanged);
            }
        }
        Ok(())
    }

    /// Validates, backs up and applies a bundle. Concurrent calls run one at a time.
    pub async fn apply(&self, catalog: &Catalog, request: ApplyRequest<'_>) -> ApplyOutcome {
        let _turn = self.queue.lock().await;
        match self.prepare_and_write(catalog, request).await {
            Ok(outcome) | Err(outcome) => outcome,
        }
    }

    async fn prepare_and_write(&self, catalog: &Catalog, request: ApplyRequest<'_>) -> Result<ApplyOutcome, ApplyOutcome> {
        let rejected = |error| ApplyOutcome::Rejected { error };
        if !request.items && !request.runes {
            return Err(rejected(CoreError::InvalidBundle { reason: "Select items, runes, or both." }));
        }
        let bundle = validate(request.bundle, catalog).map_err(rejected)?;
        self.check_ready(&bundle, request.expected).await.map_err(rejected)?;
        let summoner = self.get(LcuRequest::GetSummoner).await.map_err(rejected)?;
        let summoner_id =
            summoner.get("summonerId").and_then(Value::as_u64).and_then(NonZeroU64::new).ok_or(rejected(CoreError::NotSignedIn))?;
        if request.expected.is_some_and(|e| e.summoner_id != summoner_id.get()) {
            return Err(rejected(CoreError::SelectionChanged));
        }
        let original_sets =
            if request.items { Some(self.get(LcuRequest::GetItemSets { summoner: summoner_id }).await.map_err(rejected)?) } else { None };
        let pages = if request.runes { self.get(LcuRequest::GetPages).await.map_err(rejected)? } else { json!([]) };
        let unsupported = || rejected(CoreError::Internal);
        let page_list = pages.as_array().filter(|p| p.iter().all(Value::is_object)).ok_or_else(unsupported)?;
        let owned: Vec<&Value> = page_list.iter().filter(|p| p["name"] == MANAGED_NAME && p["isEditable"] == true).collect();
        if owned.len() > 1 {
            return Err(rejected(CoreError::AmbiguousOwnership));
        }
        let owned = match owned.first() {
            Some(page) => {
                let id = page["id"].as_u64().and_then(NonZeroU64::new).ok_or_else(unsupported)?;
                Some((id, rune_payload(page).ok_or_else(unsupported)?))
            }
            None => None,
        };
        let new_sets = match &original_sets {
            Some(sets) => {
                let list =
                    sets.get("itemSets").and_then(Value::as_array).filter(|l| l.iter().all(Value::is_object)).ok_or_else(unsupported)?;
                let uid = &bundle.item_set()["uid"];
                let mut next = sets.clone();
                next["itemSets"] = list.iter().filter(|s| &s["uid"] != uid).cloned().chain([bundle.item_set().clone()]).collect();
                Some(next)
            }
            None => None,
        };
        let backup = write_backup(
            &self.backup_dir,
            &Backup { summoner_id: summoner_id.get(), item_sets: original_sets.as_ref(), rune_pages: &pages, bundle: bundle.value() },
        )
        .map_err(rejected)?;
        // Recheck immediately before writes; earlier reads are never treated as authority.
        self.check_ready(&bundle, request.expected).await.map_err(rejected)?;

        let (mut items_attempted, mut items_completed, mut runes_attempted) = (false, false, false);
        let failure = async {
            if let Some(sets) = &new_sets {
                items_attempted = true;
                self.lcu.call(LcuRequest::PutItemSets { summoner: summoner_id, body: sets.clone() }).await?;
                items_completed = true;
            }
            if request.runes {
                self.check_ready(&bundle, request.expected).await.map_err(|error| TransportError { error, ambiguous: false })?;
                runes_attempted = true;
                let body = bundle.rune_page().clone();
                match &owned {
                    Some((id, _)) => self.lcu.call(LcuRequest::PutPage { id: *id, body }).await?,
                    None => self.lcu.call(LcuRequest::PostPage { body }).await?,
                };
            }
            Ok::<Step, TransportError>(Step::Done)
        }
        .await
        .unwrap_or_else(Step::Failed);

        if let Step::Failed(failed) = failure {
            let mut failures = Vec::new();
            if runes_attempted && failed.ambiguous {
                match &owned {
                    Some((id, old)) => {
                        if self.lcu.call(LcuRequest::PutPage { id: *id, body: old.clone() }).await.is_err() {
                            failures.push("runes");
                        }
                    }
                    // An uncertain POST has no definitive id. Never infer ownership from a name or delete a page.
                    None => failures.push("runes (creation result unknown)"),
                }
            }
            if items_attempted && (items_completed || failed.ambiguous) {
                let original = original_sets.clone().expect("items were requested");
                if self.lcu.call(LcuRequest::PutItemSets { summoner: summoner_id, body: original }).await.is_err() {
                    failures.push("items");
                }
            }
            return Ok(if !failures.is_empty() {
                ApplyOutcome::Partial { error: CoreError::PartialApply { failures: failures.join(" and ") }, backup }
            } else if items_completed || failed.ambiguous {
                ApplyOutcome::RolledBack { error: failed.error, backup }
            } else {
                ApplyOutcome::Rejected { error: failed.error }
            });
        }

        Ok(match self.read_back(&bundle, summoner_id, request.items, request.runes).await {
            Ok(true) => ApplyOutcome::Verified { backup },
            Ok(false) => ApplyOutcome::Partial { error: CoreError::ReadbackMismatch, backup },
            Err(_) => ApplyOutcome::AppliedUnverified { backup },
        })
    }

    /// Reads the managed set and page back and compares them with what was written.
    async fn read_back(&self, bundle: &ValidBundle, summoner: NonZeroU64, items: bool, runes: bool) -> Result<bool, CoreError> {
        if items {
            let sets = self.get(LcuRequest::GetItemSets { summoner }).await?;
            let expected = bundle.item_set();
            let found = sets.get("itemSets").and_then(Value::as_array).and_then(|l| l.iter().find(|s| s["uid"] == expected["uid"]));
            let matches =
                found.is_some_and(|set| expected.as_object().is_some_and(|fields| fields.iter().all(|(k, v)| set.get(k) == Some(v))));
            if !matches {
                return Ok(false);
            }
        }
        if runes {
            let pages = self.get(LcuRequest::GetPages).await?;
            let expected = bundle.rune_page();
            let owned: Vec<&Value> = pages
                .as_array()
                .map(|p| p.iter().filter(|p| p["name"] == MANAGED_NAME && p["isEditable"] == true).collect())
                .unwrap_or_default();
            let fields = ["primaryStyleId", "subStyleId", "selectedPerkIds"];
            if owned.len() != 1 || !fields.iter().all(|k| owned[0].get(*k) == expected.get(*k)) {
                return Ok(false);
            }
        }
        Ok(true)
    }
}
