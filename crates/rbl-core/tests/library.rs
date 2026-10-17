use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};

use rbl_core::CoreError;
use rbl_core::apply::ApplyOutcome;
use rbl_core::auto_import::{ApplyIdentity, Pick, SessionKey};
use rbl_core::data::{DataStore, FORMULA_COMPAT};
use rbl_core::library::StoreLibrary;
use rbl_core::monitor::Library;
use rbl_core::prefs::{PreferencesPatch, PrefsStore, Role};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

fn repo(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}
fn hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}
fn parity_bundle(n: usize) -> Value {
    let parity: Value = serde_json::from_str(&std::fs::read_to_string(repo("tests/fixtures/bundle-parity.json")).unwrap()).unwrap();
    parity["cases"][n]["bundle"].clone()
}

/// A bundled snapshot with the real catalog and an Ahri meta fallback for mid.
fn snapshot(dir: &Path) {
    let meta = json!({"version": 1, "patch": "26.20", "dataVersion": "16.20.1", "champion": "Ahri",
        "roles": {"mid": {"planId": "meta:Ahri:mid:opgg", "bundle": parity_bundle(1)}}});
    let mut files = vec![
        ("catalog.json".to_string(), std::fs::read(repo("public/data/catalog.json")).unwrap()),
        ("desktop/meta-bundles/Ahri.json".to_string(), serde_json::to_vec(&meta).unwrap()),
    ];
    files.sort();
    for (path, bytes) in &files {
        std::fs::create_dir_all(dir.join(path).parent().unwrap()).unwrap();
        std::fs::write(dir.join(path), bytes).unwrap();
    }
    let revision = hex(files.iter().map(|(p, b)| format!("{p}:{}", hex(b))).collect::<Vec<_>>().join("\n").as_bytes());
    let manifest = json!({"schema": 1, "formulaCompat": FORMULA_COMPAT, "revision": revision, "patch": "26.20", "dataVersion": "16.20.1",
        "generatedAt": "2026-10-17T00:00:00Z", "sourceCheckedAt": {"providers": "2026-10-17", "roles": "2026-10-15"},
        "files": files.iter().map(|(p, b)| json!({"path": p, "bytes": b.len(), "sha256": hex(b)})).collect::<Vec<_>>()});
    std::fs::write(dir.join("desktop/manifest.json"), serde_json::to_vec(&manifest).unwrap()).unwrap();
}

fn pick(champion: &str, id: i64, role: Option<Role>) -> Pick {
    Pick { champion_id: id, champion: champion.into(), role }
}

#[test]
fn chooses_and_supplies_saved_defaults_then_opted_in_meta_fallbacks_and_records_results() {
    let dir = tempfile::tempdir().unwrap();
    snapshot(&dir.path().join("bundled"));
    let data = Arc::new(RwLock::new(DataStore::open(&dir.path().join("data"), &dir.path().join("bundled"), FORMULA_COMPAT).unwrap()));
    let library_catalog_probe = StoreLibrary::new(
        Arc::new(Mutex::new(PrefsStore::load(
            &dir.path().join("unused.json"),
            &rbl_core::catalog::Catalog::from_companion_json(&std::fs::read_to_string(repo("companion/catalog.json")).unwrap()).unwrap(),
        ))),
        data.clone(),
    );
    let catalog = library_catalog_probe.catalog();
    assert_eq!(catalog.patch, "26.20");
    assert!(Arc::ptr_eq(&catalog, &library_catalog_probe.catalog()), "the catalog is parsed once per revision");

    let prefs_path = dir.path().join("preferences.json");
    let prefs = Arc::new(Mutex::new(PrefsStore::load(&prefs_path, &catalog)));
    prefs.lock().unwrap().set_default("Cassiopeia", Role::Mid, "authored:Cassiopeia:reference", &parity_bundle(0), &catalog).unwrap();
    let library = StoreLibrary::new(prefs.clone(), data);

    let cass = pick("Cassiopeia", 69, Some(Role::Mid));
    assert_eq!(library.choose(&cass).as_deref(), Some("authored:Cassiopeia:reference"));
    assert_eq!(library.bundle(&cass, "authored:Cassiopeia:reference").unwrap()["championAlias"], "Cassiopeia");
    assert_eq!(library.bundle(&cass, "meta:Cassiopeia:mid:opgg"), None, "only the chosen plan is supplied");

    let ahri = pick("Ahri", 103, Some(Role::Mid));
    assert_eq!(library.choose(&ahri), None, "meta fallback is off by default");
    let patch: PreferencesPatch =
        serde_json::from_value(json!({"autoImport": {"enabled": true, "metaFallback": true, "runes": false}})).unwrap();
    prefs.lock().unwrap().update(patch).unwrap();
    assert_eq!(library.choose(&ahri).as_deref(), Some("meta:Ahri:mid:opgg"));
    assert_eq!(library.bundle(&ahri, "meta:Ahri:mid:opgg").unwrap()["championAlias"], "Ahri");
    assert_eq!(library.choose(&pick("Ahri", 103, Some(Role::Top))), None, "no qualified plan for that role");
    assert_eq!(library.choose(&pick("../Ahri", 103, Some(Role::Mid))), None, "champion names cannot address other files");
    assert_eq!(library.targets(), (true, false));

    let identity = ApplyIdentity {
        account: 42,
        session: SessionKey { game_id: 1, entry_seq: 1 },
        champion_id: 103,
        champion: "Ahri".into(),
        role: Some(Role::Mid),
        plan_id: "meta:Ahri:mid:opgg".into(),
        revision: library.revision(),
        explicit: false,
    };
    library.record(Some(&identity), &ApplyOutcome::Verified { backup: PathBuf::new() });
    library.record(None, &ApplyOutcome::Rejected { error: CoreError::RuneCapacity });
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(&prefs_path).unwrap()).unwrap();
    assert_eq!(
        (saved["lastApplied"]["planId"].as_str(), saved["lastFailure"]["code"].as_str()),
        (Some("meta:Ahri:mid:opgg"), Some("rune-capacity"))
    );
}
