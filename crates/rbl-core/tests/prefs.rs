use std::path::PathBuf;

use rbl_core::CoreError;
use rbl_core::catalog::Catalog;
use rbl_core::prefs::{LoadIssue, Preferences, PreferencesPatch, PrefsStore, Role};
use serde_json::{Value, json};

fn repo(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}
fn catalog() -> Catalog {
    Catalog::from_companion_json(&std::fs::read_to_string(repo("companion/catalog.json")).unwrap()).unwrap()
}
fn bundle(n: usize) -> Value {
    let parity: Value = serde_json::from_str(&std::fs::read_to_string(repo("tests/fixtures/bundle-parity.json")).unwrap()).unwrap();
    parity["cases"][n]["bundle"].clone()
}
fn patch(value: Value) -> PreferencesPatch {
    serde_json::from_value(value).unwrap()
}

#[test]
fn starts_with_automatic_imports_off_and_writes_nothing_until_something_changes() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("preferences.json");
    let store = PrefsStore::load(&path, &catalog());
    assert_eq!(store.issue(), LoadIssue::None);
    let prefs = store.prefs();
    assert!(!prefs.auto_import.enabled && prefs.auto_import.items && prefs.auto_import.runes && !prefs.auto_import.meta_fallback);
    assert!(!prefs.background.tray_on_close && !prefs.background.start_with_windows);
    assert!(prefs.defaults.is_empty() && prefs.last_applied.is_none());
    assert!(!path.exists());
}

#[test]
fn applies_partial_updates_and_round_trips_through_disk() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("preferences.json");
    let mut store = PrefsStore::load(&path, &catalog());
    store.update(patch(json!({"autoImport": {"enabled": true, "metaFallback": true}, "background": {"trayOnClose": true}}))).unwrap();
    let modified = std::fs::metadata(&path).unwrap().modified().unwrap();
    store.update(patch(json!({"autoImport": {"enabled": true}}))).unwrap();
    assert_eq!(std::fs::metadata(&path).unwrap().modified().unwrap(), modified, "unchanged preferences are not rewritten");

    let reloaded = PrefsStore::load(&path, &catalog());
    let prefs = reloaded.prefs();
    assert!(prefs.auto_import.enabled && prefs.auto_import.meta_fallback && prefs.auto_import.items);
    assert!(prefs.background.tray_on_close && !prefs.background.start_with_windows);
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(saved["schema"], 1);
    assert_eq!(saved["autoImport"]["metaFallback"], true);
}

#[test]
fn rejects_unknown_patch_fields_and_automatic_imports_with_nothing_to_import() {
    assert!(serde_json::from_value::<PreferencesPatch>(json!({"autoImport": {"enabled": true, "deleteAll": true}})).is_err());
    assert!(serde_json::from_value::<PreferencesPatch>(json!({"defaults": {}})).is_err());
    let dir = tempfile::tempdir().unwrap();
    let mut store = PrefsStore::load(&dir.path().join("p.json"), &catalog());
    let error = store.update(patch(json!({"autoImport": {"enabled": true, "items": false, "runes": false}}))).unwrap_err();
    assert!(matches!(error, CoreError::InvalidBundle { .. }));
    assert!(!store.prefs().auto_import.enabled, "a rejected patch changes nothing");
}

#[test]
fn stores_validated_defaults_per_champion_and_role() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("preferences.json");
    let catalog = catalog();
    let mut store = PrefsStore::load(&path, &catalog);
    store.set_default("Cassiopeia", Role::Mid, "authored:Cassiopeia:reference", &bundle(0), &catalog).unwrap();
    store.set_default("Ahri", Role::Mid, "meta:Ahri:mid:opgg", &bundle(1), &catalog).unwrap();
    let default = store.default_for("Cassiopeia", Role::Mid).unwrap();
    assert_eq!(
        (default.plan_id.as_str(), default.patch.as_str(), default.bundle_sha256.len()),
        ("authored:Cassiopeia:reference", "26.20", 64)
    );
    assert!(store.default_for("Cassiopeia", Role::Top).is_none());

    for (champion, plan, n) in
        [("Ahri", "authored:Cassiopeia:reference", 0), ("Cassiopeia", "bad id with spaces", 0), ("Nobody", "meta:x", 1)]
    {
        let error = store.set_default(champion, Role::Mid, plan, &bundle(n), &catalog).unwrap_err();
        assert!(matches!(error, CoreError::InvalidBundle { .. }), "{champion} {plan}");
    }
    let mut broken = bundle(0);
    broken["runePage"]["selectedPerkIds"][0] = json!(1);
    assert!(store.set_default("Cassiopeia", Role::Top, "authored:Cassiopeia:x", &broken, &catalog).is_err());

    let reloaded = PrefsStore::load(&path, &catalog);
    assert_eq!(reloaded.prefs().defaults.keys().cloned().collect::<Vec<_>>(), vec!["Ahri|mid", "Cassiopeia|mid"]);
    let mut store = reloaded;
    store.clear_default("Ahri", Role::Mid).unwrap();
    assert!(PrefsStore::load(&path, &catalog).default_for("Ahri", Role::Mid).is_none());
}

#[test]
fn defaults_from_another_patch_or_tampered_files_move_to_needs_review() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("preferences.json");
    let catalog = catalog();
    let mut store = PrefsStore::load(&path, &catalog);
    store.set_default("Cassiopeia", Role::Mid, "authored:Cassiopeia:reference", &bundle(0), &catalog).unwrap();
    store.set_default("Ahri", Role::Mid, "meta:Ahri:mid:opgg", &bundle(1), &catalog).unwrap();
    let mut saved: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    saved["defaults"]["Ahri|mid"]["bundle"]["championAlias"] = json!("Zed");
    std::fs::write(&path, serde_json::to_vec(&saved).unwrap()).unwrap();

    let mut next_patch = catalog.clone();
    next_patch.patch = "26.21".into();
    let store = PrefsStore::load(&path, &next_patch);
    assert!(store.prefs().defaults.is_empty());
    assert_eq!(store.prefs().needs_review.keys().cloned().collect::<Vec<_>>(), vec!["Ahri|mid", "Cassiopeia|mid"]);
    let store = PrefsStore::load(&path, &catalog);
    assert_eq!(store.prefs().defaults.keys().cloned().collect::<Vec<_>>(), vec!["Cassiopeia|mid"]);
    assert_eq!(store.prefs().needs_review.keys().cloned().collect::<Vec<_>>(), vec!["Ahri|mid"]);
}

#[test]
fn never_overwrites_a_newer_or_unreadable_preferences_file() {
    let dir = tempfile::tempdir().unwrap();
    for (name, text, issue) in
        [("newer.json", r#"{"schema": 2, "future": true}"#, LoadIssue::UnknownSchema), ("broken.json", "{not json", LoadIssue::Unreadable)]
    {
        let path = dir.path().join(name);
        std::fs::write(&path, text).unwrap();
        let mut store = PrefsStore::load(&path, &catalog());
        assert_eq!(store.issue(), issue);
        assert_eq!(store.prefs(), &Preferences::default());
        assert!(matches!(store.update(patch(json!({"autoImport": {"enabled": true}}))), Err(CoreError::DataIncompatible { .. })));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), text);
        let kept = store.reset().unwrap();
        assert_eq!(std::fs::read_to_string(&kept).unwrap(), text, "reset keeps a copy of the old file");
        assert_eq!(store.issue(), LoadIssue::None);
        store.update(patch(json!({"autoImport": {"enabled": true}}))).unwrap();
    }
}

#[test]
fn records_the_last_result_and_failure() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("preferences.json");
    let mut store = PrefsStore::load(&path, &catalog());
    store.record_applied("2026-10-17T12:00:00+00:00", "Ahri", Role::Mid, "meta:Ahri:mid:opgg", "verified").unwrap();
    store.record_failure("2026-10-17T12:01:00+00:00", &CoreError::RuneCapacity).unwrap();
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(saved["lastApplied"]["outcome"], "verified");
    assert_eq!(saved["lastFailure"]["code"], "rune-capacity");
    assert!(saved["lastFailure"]["message"].as_str().unwrap().contains("rune page"));
}
