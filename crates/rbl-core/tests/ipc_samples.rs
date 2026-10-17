//! Cross-language contract: real serialized IPC payloads, checked by the TypeScript guards in
//! `tests/platform-desktop.test.ts`. Regenerate with `UPDATE_FIXTURES=1 cargo test -p rbl-core --test ipc_samples`.

use std::path::PathBuf;

use rbl_core::CoreError;
use rbl_core::apply::ApplyOutcome;
use rbl_core::auto_import::Status;
use rbl_core::data::{DataUpdateResult, RevisionInfo, SourceCheckedAt, UpdateStatus};
use rbl_core::deeplink::OpenBuild;
use rbl_core::ipc::{AppUpdateDto, IpcError, TestConnectionDto, apply_result};
use rbl_core::prefs::{DefaultBuild, LastApplied, LastFailure, Preferences, Role};
use serde_json::{Value, json};

fn samples() -> Value {
    let statuses: Vec<Value> = [
        Status::Disabled,
        Status::Connecting,
        Status::LeagueClosed,
        Status::Connected { phase: "Lobby".into() },
        Status::ChampSelect { champion: None, role: None },
        Status::ChampSelect { champion: Some("Ahri".into()), role: Some(Role::Mid) },
        Status::Applying,
        Status::Applied { plan_id: "meta:Ahri:mid:opgg".into(), verified: true },
        Status::Applied { plan_id: "meta:Ahri:mid:opgg".into(), verified: false },
        Status::Paused,
        Status::NeedsAttention { error: CoreError::NoBuildForRole },
        Status::NeedsAttention { error: CoreError::PartialApply { failures: "items".into() } },
    ]
    .iter()
    .map(Status::to_json)
    .collect();
    let backup = PathBuf::from("C:\\Users\\player\\AppData\\Local\\RiftBuildLab\\backups\\20261017T120000-abc.json");
    let applies: Vec<Value> = [
        ApplyOutcome::Verified { backup: backup.clone() },
        ApplyOutcome::AppliedUnverified { backup: backup.clone() },
        ApplyOutcome::RolledBack { error: CoreError::RuneCapacity, backup: backup.clone() },
        ApplyOutcome::Partial { error: CoreError::ReadbackMismatch, backup },
        ApplyOutcome::Rejected { error: CoreError::NotSignedIn },
    ]
    .iter()
    .map(|o| serde_json::to_value(apply_result(o)).unwrap())
    .collect();
    let mut prefs = Preferences::default();
    let filled = {
        prefs.auto_import.enabled = true;
        prefs.background.tray_on_close = true;
        prefs.defaults.insert(
            "Ahri|mid".into(),
            DefaultBuild {
                plan_id: "meta:Ahri:mid:opgg".into(),
                patch: "26.20".into(),
                bundle_sha256: "0".repeat(64),
                bundle: json!({"version": 1}),
            },
        );
        prefs.needs_review.insert(
            "Zed|mid".into(),
            DefaultBuild { plan_id: "authored:Zed:x".into(), patch: "26.19".into(), bundle_sha256: "1".repeat(64), bundle: json!({}) },
        );
        prefs.last_applied = Some(LastApplied {
            at: "2026-10-17T12:00:00+00:00".into(),
            champion: "Ahri".into(),
            role: Role::Mid,
            plan_id: "meta:Ahri:mid:opgg".into(),
            outcome: "verified".into(),
        });
        prefs.last_failure =
            Some(LastFailure { at: "2026-10-17T12:01:00+00:00".into(), code: "rune-capacity".into(), message: "x".into() });
        prefs.ui = Some(json!({"tab": "Builds"}));
        prefs
    };
    let updates =
        [UpdateStatus::UpToDate, UpdateStatus::Updated, UpdateStatus::Offline, UpdateStatus::Failed, UpdateStatus::AppUpdateRequired].map(
            |status| DataUpdateResult {
                status,
                revision: "a".repeat(64),
                patch: "26.20".into(),
                checked_at: "2026-10-17T12:00:00+00:00".into(),
                message: "m".into(),
            },
        );
    let source = SourceCheckedAt { providers: "2026-10-17".into(), roles: "2026-10-15".into() };
    json!({
        "statuses": statuses,
        "applyResults": applies,
        "preferences": [Preferences::default(), filled],
        "dataUpdates": updates,
        "revisions": [RevisionInfo { revision: "a".repeat(64), patch: "26.20".into(), data_version: "16.20.1".into(), generated_at: "2026-10-17T00:00:00Z".into(), source_checked_at: source, bundled: true }],
        "connections": [TestConnectionDto { reachable: true, client_version: Some("16.20.1".into()), message: "m".into() }, TestConnectionDto { reachable: false, client_version: None, message: "m".into() }],
        "appUpdates": [AppUpdateDto { current: "0.1.0".into(), latest: Some("0.2.0".into()), release_url: Some("https://github.com/Unskilled-Skill/rift-build-lab/releases/tag/desktop-v0.2.0".into()), ready: true }, AppUpdateDto { current: "0.1.0".into(), latest: None, release_url: None, ready: false }],
        "openBuilds": [OpenBuild { champion: "Ahri".into(), plan_id: Some("meta:Ahri:mid:opgg".into()) }, OpenBuild { champion: "Zed".into(), plan_id: None }],
        "errors": [IpcError::from(CoreError::RuneCapacity), IpcError::from(CoreError::SelectionChanged)],
    })
}

#[test]
fn serialized_ipc_payloads_match_the_shared_fixture() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/ipc-samples.json");
    let actual = serde_json::to_string_pretty(&samples()).unwrap() + "\n";
    if std::env::var_os("UPDATE_FIXTURES").is_some() {
        std::fs::write(&path, &actual).unwrap();
    }
    let expected = std::fs::read_to_string(&path).unwrap_or_default().replace("\r\n", "\n");
    assert_eq!(actual, expected, "IPC payloads changed; regenerate the fixture and update the TypeScript guards");
}
