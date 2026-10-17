use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use rbl_core::CoreError;
use rbl_core::data::{
    DATA_BASE, DataStore, FORMULA_COMPAT, Fetch, MANIFEST_URL, UpdateStatus, UpdateThrottle, is_manifest_path, parse_manifest,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

fn repo(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}
fn hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// A published data revision: (relative path, bytes) plus its manifest.
#[derive(Clone)]
struct Revision {
    files: Vec<(String, Vec<u8>)>,
    manifest: Vec<u8>,
    revision: String,
}

fn meta_bundle_file() -> Vec<u8> {
    let parity: Value = serde_json::from_str(&std::fs::read_to_string(repo("tests/fixtures/bundle-parity.json")).unwrap()).unwrap();
    let bundle = parity["cases"][1]["bundle"].clone();
    assert_eq!(bundle["championAlias"], "Ahri");
    serde_json::to_vec(&json!({"version": 1, "patch": "26.20", "dataVersion": "16.20.1", "champion": "Ahri", "roles": {"mid": {"planId": "meta:Ahri:mid:opgg", "bundle": bundle}}})).unwrap()
}

fn revision(marker: &str, compat: u32, generated_at: &str) -> Revision {
    let mut files = vec![
        ("catalog.json".to_string(), std::fs::read(repo("public/data/catalog.json")).unwrap()),
        ("champions/Ahri.json".to_string(), format!("{{\"marker\":\"{marker}\"}}").into_bytes()),
        ("desktop/meta-bundles/Ahri.json".to_string(), meta_bundle_file()),
    ];
    files.sort();
    manifest_for(files, compat, generated_at)
}

fn manifest_for(files: Vec<(String, Vec<u8>)>, compat: u32, generated_at: &str) -> Revision {
    let entries: Vec<Value> = files.iter().map(|(p, b)| json!({"path": p, "bytes": b.len(), "sha256": hex(b)})).collect();
    let revision = hex(files.iter().map(|(p, b)| format!("{p}:{}", hex(b))).collect::<Vec<_>>().join("\n").as_bytes());
    let manifest = json!({"schema": 1, "formulaCompat": compat, "revision": revision, "patch": "26.20", "dataVersion": "16.20.1",
        "generatedAt": generated_at, "sourceCheckedAt": {"providers": "2026-10-17", "roles": "2026-10-15"}, "files": entries});
    Revision { files, manifest: serde_json::to_vec_pretty(&manifest).unwrap(), revision }
}

fn write_tree(dir: &Path, rev: &Revision) {
    for (path, bytes) in &rev.files {
        let target = dir.join(path);
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::write(target, bytes).unwrap();
    }
    std::fs::create_dir_all(dir.join("desktop")).unwrap();
    std::fs::write(dir.join("desktop/manifest.json"), &rev.manifest).unwrap();
}

#[derive(Default)]
struct FakeSite {
    files: Mutex<HashMap<String, Vec<u8>>>,
    requests: Mutex<Vec<String>>,
}

impl FakeSite {
    fn publish(&self, rev: &Revision) {
        let mut files = self.files.lock().unwrap();
        files.clear();
        files.insert(MANIFEST_URL.to_string(), rev.manifest.clone());
        for (path, bytes) in &rev.files {
            files.insert(format!("{DATA_BASE}{path}"), bytes.clone());
        }
    }
    fn tamper(&self, path: &str, bytes: &[u8]) {
        self.files.lock().unwrap().insert(format!("{DATA_BASE}{path}"), bytes.to_vec());
    }
    fn take_requests(&self) -> Vec<String> {
        std::mem::take(&mut self.requests.lock().unwrap())
    }
}

impl Fetch for FakeSite {
    async fn get(&self, url: &str) -> Result<Vec<u8>, CoreError> {
        self.requests.lock().unwrap().push(url.to_string());
        self.files.lock().unwrap().get(url).cloned().ok_or(CoreError::ClientUnavailable)
    }
}

struct Setup {
    _dir: tempfile::TempDir,
    root: PathBuf,
    bundled: PathBuf,
    bundled_rev: Revision,
}

fn setup() -> Setup {
    let dir = tempfile::tempdir().unwrap();
    let (root, bundled) = (dir.path().join("data"), dir.path().join("bundled"));
    let bundled_rev = revision("bundled", FORMULA_COMPAT, "2026-10-17T00:00:00Z");
    write_tree(&bundled, &bundled_rev);
    Setup { _dir: dir, root, bundled, bundled_rev }
}

fn dirs(root: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(root)
        .map(|d| d.filter_map(|e| e.ok()).filter(|e| e.path().is_dir()).map(|e| e.file_name().to_string_lossy().into_owned()).collect())
        .unwrap_or_default();
    names.sort();
    names
}

#[test]
fn formula_compatibility_matches_the_website_build() {
    let ts = std::fs::read_to_string(repo("src/model-support.ts")).unwrap();
    assert!(ts.contains(&format!("export const FORMULA_COMPAT={FORMULA_COMPAT};")), "update FORMULA_COMPAT in both places");
}

#[test]
fn manifest_paths_are_confined_to_the_published_data_tree() {
    for p in [
        "catalog.json",
        "champions/Ahri.json",
        "provider-research/versions/a-1/Ahri.json",
        "desktop/meta-bundles/Ahri.json",
        "chatgpt-builds.json",
    ] {
        assert!(is_manifest_path(p), "{p}");
    }
    for p in [
        "../catalog.json",
        "/catalog.json",
        "champions/../x.json",
        "champions\\Ahri.json",
        "C:/x.json",
        "downloads/x.zip",
        "index.html",
        "champions/",
        "desktop/manifest.json",
        "champions//a.json",
        "champions/./a.json",
        "",
    ] {
        assert!(!is_manifest_path(p), "{p}");
    }
}

#[test]
fn rejects_corrupt_or_unsafe_manifests_and_flags_incompatible_ones() {
    let good = revision("x", FORMULA_COMPAT, "2026-10-17T00:00:00Z");
    assert_eq!(parse_manifest(&good.manifest, FORMULA_COMPAT).unwrap().revision, good.revision);
    let edit = |change: &dyn Fn(&mut Value)| {
        let mut m: Value = serde_json::from_slice(&good.manifest).unwrap();
        change(&mut m);
        serde_json::to_vec(&m).unwrap()
    };
    let invalid = [
        edit(&|m| m["files"][0]["path"] = json!("../catalog.json")),
        edit(&|m| m["files"][1]["path"] = json!("champions\\Ahri.json")),
        edit(&|m| m["files"][2]["path"] = json!("downloads/a.json")),
        edit(&|m| m["files"][0]["sha256"] = json!("ABC")),
        edit(&|m| m["revision"] = json!("0".repeat(64))),
        edit(&|m| m["files"].as_array_mut().unwrap().swap(0, 1)),
        edit(&|m| {
            let first = m["files"][0].clone();
            m["files"].as_array_mut().unwrap().insert(0, first);
        }),
        edit(&|m| m["files"][0]["bytes"] = json!(64 * 1024 * 1024 + 1)),
        b"{\"schema\":1,\"schema\":1}".to_vec(),
        b"not json".to_vec(),
    ];
    for (n, bytes) in invalid.iter().enumerate() {
        assert!(matches!(parse_manifest(bytes, FORMULA_COMPAT), Err(CoreError::DataIncompatible { .. })), "case {n}");
    }
    let newer_schema = edit(&|m| m["schema"] = json!(2));
    let other_formula = revision("x", FORMULA_COMPAT + 1, "2026-10-17T00:00:00Z");
    for bytes in [newer_schema, other_formula.manifest] {
        let Err(CoreError::DataIncompatible { reason }) = parse_manifest(&bytes, FORMULA_COMPAT) else {
            panic!("expected incompatibility")
        };
        assert!(reason.contains("app update"), "{reason}");
    }
}

#[tokio::test]
async fn starts_from_the_bundled_snapshot_and_installs_updates_downloading_only_changed_files() {
    let s = setup();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    assert_eq!(store.revision().revision, s.bundled_rev.revision);
    assert!(store.revision().bundled);
    assert_eq!(store.resolve("catalog.json").unwrap(), s.bundled.join("catalog.json"));
    for bad in ["../catalog.json", "champions/Zed.json", "desktop/manifest.json"] {
        assert!(store.resolve(bad).is_none(), "{bad}");
    }

    let site = FakeSite::default();
    let b = revision("b", FORMULA_COMPAT, "2026-10-18T00:00:00Z");
    site.publish(&b);
    let result = store.update(&site).await;
    assert_eq!(result.status, UpdateStatus::Updated, "{}", result.message);
    assert_eq!(site.take_requests(), vec![MANIFEST_URL.to_string(), format!("{DATA_BASE}champions/Ahri.json")]);
    assert_eq!(store.revision().revision, b.revision);
    let path = store.resolve("champions/Ahri.json").unwrap();
    assert!(path.starts_with(&s.root));
    assert_eq!(std::fs::read_to_string(path).unwrap(), "{\"marker\":\"b\"}");
    assert_eq!(dirs(&s.root), vec![b.revision.clone()]);

    let pointer = s.root.join("current.json");
    let modified = std::fs::metadata(&pointer).unwrap().modified().unwrap();
    let result = store.update(&site).await;
    assert_eq!(result.status, UpdateStatus::UpToDate);
    assert_eq!(site.take_requests(), vec![MANIFEST_URL.to_string()], "an unchanged revision downloads nothing else");
    assert_eq!(std::fs::metadata(&pointer).unwrap().modified().unwrap(), modified, "and writes nothing");

    let reopened = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    assert_eq!(reopened.revision().revision, b.revision);
    assert!(!reopened.revision().bundled);
}

#[tokio::test]
async fn keeps_one_last_known_good_revision_and_prunes_older_ones() {
    let s = setup();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    let site = FakeSite::default();
    let revs: Vec<Revision> =
        ["b", "c", "d"].iter().enumerate().map(|(n, m)| revision(m, FORMULA_COMPAT, &format!("2026-10-{}T00:00:00Z", 18 + n))).collect();
    for rev in &revs {
        site.publish(rev);
        assert_eq!(store.update(&site).await.status, UpdateStatus::Updated);
    }
    let mut expected = vec![revs[1].revision.clone(), revs[2].revision.clone()];
    expected.sort();
    assert_eq!(dirs(&s.root), expected);
    let pointer: Value = serde_json::from_str(&std::fs::read_to_string(s.root.join("current.json")).unwrap()).unwrap();
    assert_eq!(
        (pointer["revision"].as_str().unwrap(), pointer["previous"].as_str().unwrap()),
        (revs[2].revision.as_str(), revs[1].revision.as_str())
    );
}

#[tokio::test]
async fn failed_downloads_offline_checks_and_incompatible_data_keep_the_installed_revision() {
    let s = setup();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    let site = FakeSite::default();

    let result = store.update(&site).await;
    assert_eq!(result.status, UpdateStatus::Offline);

    let b = revision("b", FORMULA_COMPAT, "2026-10-18T00:00:00Z");
    site.publish(&b);
    site.tamper("champions/Ahri.json", b"{\"marker\":\"evil\"}");
    let result = store.update(&site).await;
    assert_eq!(result.status, UpdateStatus::Failed);
    assert!(result.message.contains("kept"), "{}", result.message);
    assert_eq!(store.revision().revision, s.bundled_rev.revision);
    assert!(dirs(&s.root).is_empty(), "no staging or partial revision remains");

    let newer_formula = revision("b", FORMULA_COMPAT + 1, "2026-10-18T00:00:00Z");
    site.publish(&newer_formula);
    site.take_requests();
    assert_eq!(store.update(&site).await.status, UpdateStatus::AppUpdateRequired);
    assert_eq!(site.take_requests(), vec![MANIFEST_URL.to_string()]);
    assert_eq!(store.revision().revision, s.bundled_rev.revision);
}

#[tokio::test]
async fn content_that_matches_its_hashes_but_fails_validation_is_never_activated() {
    let s = setup();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    let site = FakeSite::default();
    let mut files = revision("b", FORMULA_COMPAT, "2026-10-18T00:00:00Z").files;
    let mut meta: Value = serde_json::from_slice(&files[2].1).unwrap();
    meta["roles"]["mid"]["bundle"]["runePage"]["selectedPerkIds"][0] = json!(1);
    files[2].1 = serde_json::to_vec(&meta).unwrap();
    site.publish(&manifest_for(files, FORMULA_COMPAT, "2026-10-18T00:00:00Z"));
    assert_eq!(store.update(&site).await.status, UpdateStatus::Failed);

    let mut files = revision("c", FORMULA_COMPAT, "2026-10-18T00:00:00Z").files;
    files[0].1 = b"{\"patch\":\"26.20\"}".to_vec();
    site.publish(&manifest_for(files, FORMULA_COMPAT, "2026-10-18T00:00:00Z"));
    assert_eq!(store.update(&site).await.status, UpdateStatus::Failed);
    assert_eq!(store.revision().revision, s.bundled_rev.revision);
    assert!(dirs(&s.root).is_empty());
}

#[tokio::test]
async fn interrupted_staging_is_cleaned_and_a_broken_pointer_falls_back_to_the_bundled_snapshot() {
    let s = setup();
    std::fs::create_dir_all(s.root.join("staging-abc").join("champions")).unwrap();
    std::fs::write(s.root.join("staging-abc/champions/Ahri.json"), "partial").unwrap();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    let site = FakeSite::default();
    site.publish(&s.bundled_rev);
    assert_eq!(store.update(&site).await.status, UpdateStatus::UpToDate);
    assert!(dirs(&s.root).is_empty());

    std::fs::create_dir_all(&s.root).unwrap();
    std::fs::write(s.root.join("current.json"), r#"{"revision":"missing","previous":null}"#).unwrap();
    let store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    assert!(store.revision().bundled);
}

#[tokio::test]
async fn a_newer_bundled_snapshot_wins_over_an_older_download_after_an_app_update() {
    let s = setup();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    let site = FakeSite::default();
    site.publish(&revision("b", FORMULA_COMPAT, "2026-10-18T00:00:00Z"));
    assert_eq!(store.update(&site).await.status, UpdateStatus::Updated);
    let newer = revision("app-update", FORMULA_COMPAT, "2026-11-01T00:00:00Z");
    std::fs::remove_dir_all(&s.bundled).unwrap();
    write_tree(&s.bundled, &newer);
    let store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    assert_eq!(store.revision().revision, newer.revision);
}

#[test]
fn checks_at_launch_then_at_most_every_six_hours_unless_asked() {
    let mut throttle = UpdateThrottle::default();
    let start = Instant::now();
    assert!(throttle.due(start, false));
    assert!(!throttle.due(start + Duration::from_secs(60), false));
    assert!(throttle.due(start + Duration::from_secs(120), true));
    assert!(!throttle.due(start + Duration::from_secs(6 * 3600), false));
    assert!(throttle.due(start + Duration::from_secs(6 * 3600 + 121), false));
}

/// Cross-language contract: the manifest and meta bundles written by `npm run build` open in Rust.
/// Skipped when `dist/data` has not been built.
#[test]
fn the_website_build_output_is_a_valid_bundled_snapshot() {
    let dist = repo("dist/data");
    if !dist.join("desktop/manifest.json").exists() {
        eprintln!("skipped: run `npm run build` first");
        return;
    }
    let root = tempfile::tempdir().unwrap();
    let store = DataStore::open(root.path(), &dist, FORMULA_COMPAT).expect("published manifest must parse");
    assert!(store.revision().bundled);
    assert!(store.resolve("catalog.json").is_some() && store.resolve("desktop/meta-bundles/Ahri.json").is_some());
    let manifest = parse_manifest(&std::fs::read(dist.join("desktop/manifest.json")).unwrap(), FORMULA_COMPAT).unwrap();
    for file in &manifest.files {
        let bytes = std::fs::read(dist.join(&file.path)).unwrap();
        assert_eq!((bytes.len() as u64, hex(&bytes)), (file.bytes, file.sha256.clone()), "{}", file.path);
    }
}

#[tokio::test]
async fn never_replaces_newer_data_with_an_older_published_revision() {
    let s = setup();
    let mut store = DataStore::open(&s.root, &s.bundled, FORMULA_COMPAT).unwrap();
    let site = FakeSite::default();
    let older = revision("older", FORMULA_COMPAT, "2026-10-16T00:00:00Z");
    site.publish(&older);
    let result = store.update(&site).await;
    assert_eq!(result.status, UpdateStatus::UpToDate, "{}", result.message);
    assert_eq!(site.take_requests(), vec![MANIFEST_URL.to_string()], "nothing older is downloaded");
    assert_eq!(store.revision().revision, s.bundled_rev.revision);
    assert!(dirs(&s.root).is_empty());
}
