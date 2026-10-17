use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use rbl_core::CoreError;
use rbl_core::apply::ApplyOutcome;
use rbl_core::auto_import::Status;
use rbl_core::data::{DATA_BASE, DataStore, FORMULA_COMPAT, Fetch};
use rbl_core::ipc::{
    ApplyBuildRequest, COMMANDS, Core, DefaultKey, DefaultRequest, ExternalLink, IpcError, apply_result, external_url, serve_data,
};
use rbl_core::lcu::transport::LcuClient;
use rbl_core::library::StoreLibrary;
use rbl_core::monitor::{ClientSource, spawn};
use rbl_core::net::{RELEASES_API, allowed};
use rbl_core::paths::AppPaths;
use rbl_core::prefs::{PreferencesPatch, PrefsStore};
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

fn snapshot(dir: &Path) {
    let files = [
        ("catalog.json".to_string(), std::fs::read(repo("public/data/catalog.json")).unwrap()),
        ("champions/Ahri.json".to_string(), b"{\"ok\":true}".to_vec()),
    ];
    for (path, bytes) in &files {
        std::fs::create_dir_all(dir.join(path).parent().unwrap()).unwrap();
        std::fs::write(dir.join(path), bytes).unwrap();
    }
    let revision = hex(files.iter().map(|(p, b)| format!("{p}:{}", hex(b))).collect::<Vec<_>>().join("\n").as_bytes());
    let manifest = json!({"schema": 1, "formulaCompat": FORMULA_COMPAT, "revision": revision, "patch": "26.20", "dataVersion": "16.20.1",
        "generatedAt": "2026-10-17T00:00:00Z", "sourceCheckedAt": {"providers": "2026-10-17", "roles": "2026-10-15"},
        "files": files.iter().map(|(p, b)| json!({"path": p, "bytes": b.len(), "sha256": hex(b)})).collect::<Vec<_>>()});
    std::fs::create_dir_all(dir.join("desktop")).unwrap();
    std::fs::write(dir.join("desktop/manifest.json"), serde_json::to_vec(&manifest).unwrap()).unwrap();
}

/// A client source that never finds League (the commands under test must not need it).
struct NoLeague;
impl ClientSource for NoLeague {
    type Client = LcuClient;
    fn connect(&self) -> Result<LcuClient, CoreError> {
        Err(CoreError::ClientUnavailable)
    }
}

struct Releases(Option<Value>);
impl Fetch for Releases {
    async fn get(&self, url: &str) -> Result<Vec<u8>, CoreError> {
        assert_eq!(url, RELEASES_API);
        self.0.as_ref().map(|v| serde_json::to_vec(v).unwrap()).ok_or(CoreError::ClientUnavailable)
    }
}

fn core(dir: &Path) -> Core {
    let bundled = dir.join("bundled");
    snapshot(&bundled);
    let paths =
        AppPaths { preferences: dir.join("roaming/preferences.json"), data: dir.join("local/data"), backups: dir.join("local/backups") };
    let data = DataStore::open(&paths.data, &bundled, FORMULA_COMPAT).unwrap();
    let prefs = Arc::new(Mutex::new(PrefsStore::load(&paths.preferences, &data.catalog().unwrap())));
    let data = Arc::new(RwLock::new(data));
    let (monitor, _task) = spawn(NoLeague, StoreLibrary::new(prefs.clone(), data.clone()), paths.backups.clone(), false);
    Core { monitor, prefs, data, paths, bundled, app_version: "0.1.0".into(), ui_saved: Default::default(), pending_open: Mutex::new(None) }
}

#[test]
fn request_types_reject_unknown_fields_and_wrong_types() {
    assert!(serde_json::from_value::<ApplyBuildRequest>(json!({"bundle": {}, "items": true, "runes": false})).is_ok());
    for bad in [
        json!({"bundle": {}, "items": true, "runes": false, "path": "C:/x"}),
        json!({"bundle": {}, "items": "yes", "runes": false}),
        json!({"items": true, "runes": true}),
    ] {
        assert!(serde_json::from_value::<ApplyBuildRequest>(bad).is_err());
    }
    assert!(
        serde_json::from_value::<DefaultRequest>(json!({"champion": "Ahri", "role": "mid", "planId": "meta:Ahri:mid:opgg", "bundle": {}}))
            .is_ok()
    );
    for bad in [
        json!({"champion": "Ahri", "role": "middle", "planId": "x", "bundle": {}}),
        json!({"champion": "Ahri", "role": "mid", "planId": "x", "bundle": {}, "extra": 1}),
    ] {
        assert!(serde_json::from_value::<DefaultRequest>(bad).is_err());
    }
    assert!(serde_json::from_value::<DefaultKey>(json!({"champion": "Ahri", "role": "unspecified"})).is_err());
    assert!(serde_json::from_value::<ExternalLink>(json!({"kind": "source", "url": "https://op.gg", "target": "_self"})).is_err());
    assert!(serde_json::from_value::<ExternalLink>(json!({"kind": "file", "url": "C:/Windows"})).is_err());
}

#[test]
fn only_fixed_or_allowlisted_https_links_can_be_opened() {
    assert_eq!(external_url(&ExternalLink::Releases).unwrap(), "https://github.com/Unskilled-Skill/rift-build-lab/releases");
    assert!(external_url(&ExternalLink::RiotLcuPolicy).unwrap().starts_with("https://developer.riotgames.com/"));
    for ok in [
        "https://op.gg/lol/champions/ahri/build",
        "https://lolalytics.com/lol/ahri/build/?lane=middle",
        "https://mobalytics.gg/lol/champions/ahri/build",
    ] {
        assert_eq!(external_url(&ExternalLink::Source { url: ok.into() }).unwrap(), ok);
    }
    for bad in [
        "http://op.gg/x",
        "https://op.gg.evil.test/x",
        "https://evil.test/op.gg",
        "https://user@op.gg/x",
        "https://op.gg:8443/x",
        "file:///C:/Windows/System32/calc.exe",
        "https://op.gg/x\"&calc",
        "javascript:alert(1)",
    ] {
        let error = external_url(&ExternalLink::Source { url: bad.into() }).unwrap_err();
        assert_eq!(error.code, "invalid-bundle", "{bad}");
    }
}

#[tokio::test]
async fn the_data_protocol_serves_only_files_of_the_active_revision() {
    let dir = tempfile::tempdir().unwrap();
    let core = core(dir.path());
    let store = core.data.read().unwrap();
    let ok = serve_data(&store, "/data/champions/Ahri.json?t=123");
    assert_eq!((ok.status, ok.content_type, ok.body.as_slice()), (200, "application/json", b"{\"ok\":true}".as_slice()));
    assert_eq!(serve_data(&store, "/data/catalog.json").status, 200);
    for bad in [
        "/data/../bundled/catalog.json",
        "/data/champions/Zed.json",
        "/catalog.json",
        "/data/desktop/manifest.json",
        "/data/champions%2F..%2Fcatalog.json",
        "/data/",
        "/../../Windows/win.ini",
    ] {
        assert_eq!(serve_data(&store, bad).status, 404, "{bad}");
    }
}

#[test]
fn the_window_capability_grants_only_events_and_the_apps_own_commands() {
    let text = std::fs::read_to_string(repo("src-tauri/capabilities/main.json")).unwrap();
    let capability: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(capability["windows"], json!(["main"]));
    let granted: Vec<String> = capability["permissions"].as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_owned()).collect();
    let mut expected: Vec<String> = COMMANDS.iter().map(|c| format!("allow-{}", c.replace('_', "-"))).collect();
    expected.insert(0, "core:event:default".into());
    assert_eq!(granted, expected);
    for forbidden in ["fs:", "http:", "shell:", "opener:", "process:", "core:default", "remote"] {
        assert!(!text.contains(forbidden), "{forbidden}");
    }
    let build = std::fs::read_to_string(repo("src-tauri/build.rs")).unwrap();
    let main = std::fs::read_to_string(repo("src-tauri/src/main.rs")).unwrap();
    for command in COMMANDS {
        assert!(build.contains(&format!("\"{command}\"")), "{command} missing from the app manifest");
        assert!(main.contains(&format!("fn {command}(")), "{command} has no command handler");
    }
}

#[test]
fn update_requests_only_reach_the_fixed_publication_locations() {
    assert_eq!(
        allowed(&format!("{DATA_BASE}champions/Ahri.json")).unwrap(),
        ("unskilled-skill.github.io", "/rift-build-lab/data/champions/Ahri.json".into())
    );
    assert_eq!(allowed(RELEASES_API).unwrap().0, "api.github.com");
    for bad in [
        "https://unskilled-skill.github.io/rift-build-lab/index.html".to_string(),
        format!("{DATA_BASE}../index.html"),
        format!("{DATA_BASE}a//b.json"),
        format!("{DATA_BASE}a.json?x=1"),
        "https://evil.test/rift-build-lab/data/catalog.json".into(),
        "http://unskilled-skill.github.io/rift-build-lab/data/catalog.json".into(),
    ] {
        assert!(allowed(&bad).is_none(), "{bad}");
    }
}

#[test]
fn apply_results_never_describe_failures_as_success() {
    let backup = PathBuf::from("C:/b/1.json");
    assert_eq!(apply_result(&ApplyOutcome::Verified { backup: backup.clone() }).outcome, "verified");
    let rolled = apply_result(&ApplyOutcome::RolledBack { error: CoreError::RuneCapacity, backup: backup.clone() });
    assert_eq!((rolled.outcome, rolled.backup_path.as_deref()), ("rolled-back", Some("C:/b/1.json")));
    assert!(rolled.message.contains("rune page"));
    let rejected = serde_json::to_value(apply_result(&ApplyOutcome::Rejected { error: CoreError::NotSignedIn })).unwrap();
    assert_eq!(rejected, json!({"outcome": "rejected", "message": "Sign in to League Client before applying."}));
    let error = serde_json::to_value(IpcError::from(CoreError::PartialApply { failures: "items".into() })).unwrap();
    assert_eq!(error["code"], "partial-apply");
    assert!(error["recovery"].as_str().unwrap().contains("backup"));
}

#[tokio::test]
async fn preferences_defaults_and_manual_applies_flow_through_the_core() {
    let dir = tempfile::tempdir().unwrap();
    let core = core(dir.path());
    assert_eq!(core.status(), json!({"kind": "disabled"}));

    let patch: PreferencesPatch = serde_json::from_value(json!({"autoImport": {"enabled": true}})).unwrap();
    assert!(core.update_preferences(patch).await.unwrap().auto_import.enabled);
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(matches!(core.status_value(), Status::Connecting | Status::LeagueClosed), "{:?}", core.status_value());
    core.pause().await.unwrap();
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(core.status_value(), Status::Paused);

    let request: DefaultRequest = serde_json::from_value(
        json!({"champion": "Cassiopeia", "role": "mid", "planId": "authored:Cassiopeia:reference", "bundle": parity_bundle(0)}),
    )
    .unwrap();
    core.set_default(request).await.unwrap();
    assert!(core.preferences().unwrap().defaults.contains_key("Cassiopeia|mid"));
    let wrong: DefaultRequest =
        serde_json::from_value(json!({"champion": "Ahri", "role": "mid", "planId": "x:y", "bundle": parity_bundle(0)})).unwrap();
    assert_eq!(core.set_default(wrong).await.unwrap_err().code, "invalid-bundle");
    core.clear_default(serde_json::from_value(json!({"champion": "Cassiopeia", "role": "mid"})).unwrap()).await.unwrap();
    assert!(core.preferences().unwrap().defaults.is_empty());

    let mut huge = parity_bundle(0);
    huge["buildName"] = json!("x".repeat(70_000));
    let request = ApplyBuildRequest { bundle: huge, items: true, runes: true };
    assert_eq!(core.apply_build(request).await.unwrap_err().code, "invalid-bundle");
    let result = core.apply_build(ApplyBuildRequest { bundle: parity_bundle(0), items: true, runes: true }).await.unwrap();
    assert_eq!((result.outcome, result.message.contains("League")), ("rejected", true), "no client is running");
    let connection = core.test_connection().await;
    assert!(!connection.reachable && connection.client_version.is_none());

    assert!(core.data_revision().unwrap().bundled);
    assert!(core.backup_folder().unwrap().is_dir());
}

#[tokio::test]
async fn app_update_checks_only_announce_newer_desktop_releases() {
    let dir = tempfile::tempdir().unwrap();
    let core = core(dir.path());
    let check = |release: Option<Value>| {
        let core = &core;
        async move { core.check_app_update(&Releases(release)).await }
    };
    let newer = check(Some(
        json!({"tag_name": "desktop-v0.2.0", "html_url": "https://github.com/Unskilled-Skill/rift-build-lab/releases/tag/desktop-v0.2.0"}),
    ))
    .await;
    assert_eq!(
        (newer.latest.as_deref(), newer.release_url.as_deref()),
        (Some("0.2.0"), Some("https://github.com/Unskilled-Skill/rift-build-lab/releases/tag/desktop-v0.2.0"))
    );
    let spoofed = check(Some(json!({"tag_name": "desktop-v9.0.0", "html_url": "https://evil.test/download"}))).await;
    assert_eq!(spoofed.release_url.as_deref(), Some("https://github.com/Unskilled-Skill/rift-build-lab/releases"));
    for release in [
        Some(json!({"tag_name": "desktop-v0.1.0"})),
        Some(json!({"tag_name": "v5.0.0"})),
        Some(json!({"tag_name": "desktop-vlatest"})),
        None,
    ] {
        assert_eq!(check(release).await.release_url, None);
    }
}
