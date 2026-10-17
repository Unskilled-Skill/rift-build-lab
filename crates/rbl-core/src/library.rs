//! The production [`Library`]: saved preferences plus the active data revision.
//!
//! Data updates replace the shared [`DataStore`] wholesale (an updater opens its own store, runs
//! the async update, then swaps it in), so no lock is ever held across an await.

use std::sync::{Arc, Mutex, RwLock};
use std::time::SystemTime;

use serde_json::Value;

use crate::apply::ApplyOutcome;
use crate::auto_import::{ApplyIdentity, Pick, choose_build};
use crate::backup::format_utc;
use crate::catalog::Catalog;
use crate::data::DataStore;
use crate::monitor::Library;
use crate::prefs::{PrefsStore, Role};

pub struct StoreLibrary {
    prefs: Arc<Mutex<PrefsStore>>,
    data: Arc<RwLock<DataStore>>,
    catalog: RwLock<Option<(String, Arc<Catalog>)>>,
}

impl StoreLibrary {
    pub fn new(prefs: Arc<Mutex<PrefsStore>>, data: Arc<RwLock<DataStore>>) -> Self {
        StoreLibrary { prefs, data, catalog: RwLock::new(None) }
    }

    fn read_data(&self, path: &str) -> Option<Vec<u8>> {
        let file = self.data.read().ok()?.resolve(path)?;
        std::fs::read(file).ok()
    }

    /// The meta fallback entry `(planId, bundle)` for a champion and role in the active revision.
    fn meta_entry(&self, champion: &str, role: Role) -> Option<(String, Value)> {
        if !champion.bytes().all(|b| b.is_ascii_alphanumeric()) {
            return None;
        }
        let file: Value = serde_json::from_slice(&self.read_data(&format!("desktop/meta-bundles/{champion}.json"))?).ok()?;
        let entry = file.get("roles")?.get(role.as_str())?;
        Some((entry.get("planId")?.as_str()?.to_owned(), entry.get("bundle")?.clone()))
    }
}

impl Library for StoreLibrary {
    fn catalog(&self) -> Arc<Catalog> {
        let revision = self.revision();
        if let Some((cached, catalog)) = self.catalog.read().ok().and_then(|c| c.clone())
            && cached == revision
        {
            return catalog;
        }
        let catalog = self
            .read_data("catalog.json")
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .and_then(|text| Catalog::from_published_json(&text).ok())
            .map(Arc::new)
            .expect("the active data revision was validated with its catalog");
        if let Ok(mut cache) = self.catalog.write() {
            *cache = Some((revision, catalog.clone()));
        }
        catalog
    }

    fn revision(&self) -> String {
        self.data.read().map(|d| d.revision().revision).unwrap_or_default()
    }

    fn choose(&self, pick: &Pick) -> Option<String> {
        let prefs = self.prefs.lock().ok()?;
        choose_build(prefs.prefs(), pick, |champion, role| self.meta_entry(champion, role).map(|(id, _)| id))
    }

    fn bundle(&self, pick: &Pick, plan_id: &str) -> Option<Value> {
        let role = pick.role?;
        if let Some(default) = self.prefs.lock().ok()?.default_for(&pick.champion, role).filter(|d| d.plan_id == plan_id) {
            return Some(default.bundle.clone());
        }
        self.meta_entry(&pick.champion, role).filter(|(id, _)| id == plan_id).map(|(_, bundle)| bundle)
    }

    fn targets(&self) -> (bool, bool) {
        self.prefs.lock().map(|p| (p.prefs().auto_import.items, p.prefs().auto_import.runes)).unwrap_or((false, false))
    }

    fn record(&self, identity: Option<&ApplyIdentity>, outcome: &ApplyOutcome) {
        let Ok(mut prefs) = self.prefs.lock() else { return };
        let at = format_utc(SystemTime::now()).0;
        let failure = match outcome {
            ApplyOutcome::RolledBack { error, .. } | ApplyOutcome::Partial { error, .. } | ApplyOutcome::Rejected { error } => Some(error),
            ApplyOutcome::Verified { .. } | ApplyOutcome::AppliedUnverified { .. } => None,
        };
        // Saving can fail only when preferences are locked by a newer version; the UI already shows that.
        let _ = match (failure, identity.and_then(|i| i.role.map(|role| (i, role)))) {
            (Some(error), _) => prefs.record_failure(&at, error),
            (None, Some((identity, role))) => prefs.record_applied(&at, &identity.champion, role, &identity.plan_id, outcome.kind()),
            (None, None) => Ok(()),
        };
    }
}
