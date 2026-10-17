use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rbl_core::CoreError;
use rbl_core::apply::{ApplyOutcome, ApplyRequest, ExpectedSelection, Writer};
use rbl_core::bundle::managed_uid;
use rbl_core::catalog::Catalog;
use rbl_core::lcu::transport::{Lcu, LcuRequest, TransportError};
use serde_json::{Value, json};

fn repo(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}
fn catalog() -> Catalog {
    Catalog::from_companion_json(&std::fs::read_to_string(repo("companion/catalog.json")).unwrap()).unwrap()
}
fn bundle() -> Value {
    let parity: Value = serde_json::from_str(&std::fs::read_to_string(repo("tests/fixtures/bundle-parity.json")).unwrap()).unwrap();
    let case = &parity["cases"][0];
    assert_eq!(case["name"], "real-Cassiopeia");
    case["bundle"].clone()
}

type Hook = Box<dyn Fn(&mut State, &LcuRequest) -> Option<Result<Value, TransportError>> + Send + Sync>;

struct State {
    phase: Value,
    version: Value,
    summoner: Value,
    session: Value,
    sets: Value,
    pages: Vec<Value>,
    writes: Vec<(String, String)>,
    item_writes: usize,
}

struct FakeLcu {
    state: Mutex<State>,
    hook: Option<Hook>,
}

impl FakeLcu {
    fn new() -> Self {
        FakeLcu {
            state: Mutex::new(State {
                phase: json!("Lobby"),
                version: json!("16.20.123.456"),
                summoner: json!({"summonerId": 42}),
                session: json!({"localPlayerCellId": 2, "myTeam": [{"cellId": 1, "championId": 1}, {"cellId": 2, "championId": 69}]}),
                sets: json!({"accountId": 12, "timestamp": 10, "itemSets": [{"uid": "personal", "title": "Keep me", "blocks": []}]}),
                pages: vec![
                    json!({"id": 12, "name": "Rift Build Lab", "isEditable": true, "current": false, "primaryStyleId": 8000, "subStyleId": 8200, "selectedPerkIds": [1]}),
                ],
                writes: vec![],
                item_writes: 0,
            }),
            hook: None,
        }
    }
    fn with(mut self, hook: impl Fn(&mut State, &LcuRequest) -> Option<Result<Value, TransportError>> + Send + Sync + 'static) -> Self {
        self.hook = Some(Box::new(hook));
        self
    }
    fn edit(self, change: impl FnOnce(&mut State)) -> Self {
        change(&mut self.state.lock().unwrap());
        self
    }
}

fn handle(state: &mut State, request: &LcuRequest) -> Result<Value, TransportError> {
    if request.is_write() {
        state.writes.push((request.method().to_string(), request.path()));
    }
    Ok(match request {
        LcuRequest::GetSummoner => state.summoner.clone(),
        LcuRequest::GetPhase => state.phase.clone(),
        LcuRequest::GetGameVersion => state.version.clone(),
        LcuRequest::GetChampSelectSession => state.session.clone(),
        LcuRequest::GetPages => Value::Array(state.pages.clone()),
        LcuRequest::GetItemSets { .. } => state.sets.clone(),
        LcuRequest::PutItemSets { body, .. } => {
            state.item_writes += 1;
            state.sets = body.clone();
            Value::Null
        }
        LcuRequest::PutPage { id, body } => {
            let mut page = body.clone();
            page["id"] = json!(id.get());
            page["isEditable"] = json!(true);
            state.pages.retain(|p| p["id"] != json!(id.get()));
            state.pages.push(page);
            Value::Null
        }
        LcuRequest::PostPage { body } => {
            let mut page = body.clone();
            page["id"] = json!(99);
            page["isEditable"] = json!(true);
            state.pages.push(page);
            json!({"id": 99})
        }
    })
}

impl Lcu for FakeLcu {
    async fn call(&self, request: LcuRequest) -> Result<Value, TransportError> {
        tokio::task::yield_now().await;
        let mut state = self.state.lock().unwrap();
        if let Some(result) = self.hook.as_ref().and_then(|hook| hook(&mut state, &request)) {
            if request.is_write() {
                state.writes.push((request.method().to_string(), request.path()));
            }
            return result;
        }
        handle(&mut state, &request)
    }
}

fn err(error: CoreError, ambiguous: bool) -> TransportError {
    TransportError { error, ambiguous }
}

struct Run {
    outcome: ApplyOutcome,
    writer: Writer<FakeLcu>,
    backups: tempfile::TempDir,
}

impl Run {
    fn state(&self) -> std::sync::MutexGuard<'_, State> {
        self.writer.lcu().state.lock().unwrap()
    }
    fn writes(&self) -> Vec<(String, String)> {
        self.state().writes.clone()
    }
    fn backup_files(&self) -> Vec<PathBuf> {
        std::fs::read_dir(self.backups.path()).map(|d| d.map(|e| e.unwrap().path()).collect()).unwrap_or_default()
    }
}

async fn apply_with(lcu: FakeLcu, bundle: &Value, items: bool, runes: bool, expected: Option<ExpectedSelection>) -> Run {
    let backups = tempfile::tempdir().unwrap();
    let writer = Writer::new(lcu, backups.path().to_path_buf());
    let outcome = writer.apply(&catalog(), ApplyRequest { bundle, items, runes, expected }).await;
    Run { outcome, writer, backups }
}

async fn apply(lcu: FakeLcu) -> Run {
    apply_with(lcu, &bundle(), true, true, None).await
}

fn put(path: &str) -> (String, String) {
    ("PUT".into(), path.into())
}
const SETS: &str = "/lol-item-sets/v1/item-sets/42/sets";

#[tokio::test]
async fn applies_items_and_runes_preserving_unrelated_sets_and_verifies_by_read_back() {
    let run = apply(FakeLcu::new()).await;
    assert!(matches!(run.outcome, ApplyOutcome::Verified { .. }), "{:?}", run.outcome);
    assert_eq!(run.writes(), vec![put(SETS), put("/lol-perks/v1/pages/12")]);
    {
        let state = run.state();
        let sets = state.sets["itemSets"].as_array().unwrap();
        assert_eq!((sets.len(), sets[0]["uid"].clone(), sets[1]["uid"].clone()), (2, json!("personal"), json!(managed_uid(69))));
        assert_eq!(state.pages.len(), 1);
        assert_eq!(state.pages[0]["selectedPerkIds"], bundle()["runePage"]["selectedPerkIds"]);
    }
    let files = run.backup_files();
    assert_eq!(files.len(), 1);
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(&files[0]).unwrap()).unwrap();
    assert_eq!(saved["itemSets"]["itemSets"][0]["uid"], "personal");
    assert_eq!(saved["runePages"][0]["selectedPerkIds"], json!([1]));
    let ApplyOutcome::Verified { backup } = &run.outcome else { unreachable!() };
    assert_eq!(backup, &files[0]);

    let again = run.writer.apply(&catalog(), ApplyRequest { bundle: &bundle(), items: true, runes: false, expected: None }).await;
    assert!(matches!(again, ApplyOutcome::Verified { .. }));
    assert_eq!(run.state().sets["itemSets"].as_array().unwrap().len(), 2, "the managed set is replaced, never duplicated");
    assert_eq!(run.writes().len(), 3);
}

#[tokio::test]
async fn unsafe_phases_and_patch_mismatches_fail_before_any_write_or_backup() {
    for (phase, version, error) in [
        ("InProgress", "16.20.1", CoreError::UnsafePhase { phase: "InProgress".into() }),
        ("Reconnect", "16.20.1", CoreError::UnsafePhase { phase: "Reconnect".into() }),
        ("Unknown", "16.20.1", CoreError::UnsafePhase { phase: "Unknown".into() }),
        ("Lobby", "16.19.1", CoreError::PatchMismatch { client: "16.19".into(), data: "16.20".into() }),
        ("ChampSelect", "garbage", CoreError::PatchMismatch { client: "unknown".into(), data: "16.20".into() }),
    ] {
        let run = apply(FakeLcu::new().edit(|s| {
            s.phase = json!(phase);
            s.version = json!(version);
        }))
        .await;
        assert_eq!(run.outcome, ApplyOutcome::Rejected { error }, "{phase} {version}");
        assert!(run.writes().is_empty() && run.backup_files().is_empty());
    }
}

#[tokio::test]
async fn full_rune_capacity_never_deletes_or_changes_any_page() {
    let lcu = FakeLcu::new()
        .edit(|s| s.pages[0]["name"] = json!("Personal page"))
        .with(|_, r| matches!(r, LcuRequest::PostPage { .. }).then(|| Err(err(CoreError::RuneCapacity, false))));
    let run = apply_with(lcu, &bundle(), false, true, None).await;
    assert_eq!(run.outcome, ApplyOutcome::Rejected { error: CoreError::RuneCapacity });
    assert_eq!(run.writes(), vec![("POST".to_string(), "/lol-perks/v1/pages".to_string())]);
    assert_eq!(run.state().pages[0]["name"], "Personal page");
}

#[tokio::test]
async fn a_failed_rune_write_rolls_items_back() {
    let original = FakeLcu::new().state.lock().unwrap().sets.clone();
    let lcu =
        FakeLcu::new().with(|_, r| matches!(r, LcuRequest::PutPage { .. }).then(|| Err(err(CoreError::Rejected { status: 400 }, false))));
    let run = apply(lcu).await;
    assert!(matches!(&run.outcome, ApplyOutcome::RolledBack { error: CoreError::Rejected { status: 400 }, .. }), "{:?}", run.outcome);
    assert_eq!(run.state().sets, original);
    assert_eq!(run.writes(), vec![put(SETS), put("/lol-perks/v1/pages/12"), put(SETS)]);
}

#[tokio::test]
async fn a_rejected_first_write_reports_rejection_without_unnecessary_rollback() {
    let lcu = FakeLcu::new().with(|_, r| r.is_write().then(|| Err(err(CoreError::Rejected { status: 400 }, false))));
    let run = apply(lcu).await;
    assert_eq!(run.outcome, ApplyOutcome::Rejected { error: CoreError::Rejected { status: 400 } });
    assert_eq!(run.writes().len(), 1);
}

#[tokio::test]
async fn a_failed_rollback_is_reported_as_partial() {
    let lcu = FakeLcu::new().with(|state, r| match r {
        LcuRequest::PutPage { .. } => Some(Err(err(CoreError::Rejected { status: 400 }, false))),
        LcuRequest::PutItemSets { .. } if state.item_writes >= 1 => Some(Err(err(CoreError::ClientUnavailable, true))),
        _ => None,
    });
    let run = apply(lcu).await;
    assert!(
        matches!(&run.outcome, ApplyOutcome::Partial { error: CoreError::PartialApply { failures }, .. } if failures == "items"),
        "{:?}",
        run.outcome
    );
}

#[tokio::test]
async fn an_ambiguous_page_creation_is_partial_and_never_deletes_by_name() {
    let lcu = FakeLcu::new().edit(|s| s.pages.clear()).with(|state, r| match r {
        LcuRequest::PostPage { .. } => {
            let _ = handle(state, r);
            state.writes.pop();
            Some(Err(err(CoreError::ClientUnavailable, true)))
        }
        _ => None,
    });
    let run = apply(lcu).await;
    assert!(
        matches!(&run.outcome, ApplyOutcome::Partial { error: CoreError::PartialApply { failures }, .. } if failures == "runes (creation result unknown)"),
        "{:?}",
        run.outcome
    );
    assert_eq!(run.state().pages.len(), 1, "the possibly created page is left for the player to inspect");
    assert_eq!(run.writes().last().unwrap(), &put(SETS), "items were restored");
}

#[tokio::test]
async fn an_ambiguous_rune_update_restores_the_previous_managed_page() {
    let lcu = FakeLcu::new().with(|state, r| match r {
        LcuRequest::PutPage { body, .. } if body["selectedPerkIds"] != json!([1]) => {
            let _ = handle(state, r);
            state.writes.pop();
            Some(Err(err(CoreError::Rejected { status: 503 }, true)))
        }
        _ => None,
    });
    let run = apply(lcu).await;
    assert!(matches!(&run.outcome, ApplyOutcome::RolledBack { .. }), "{:?}", run.outcome);
    let state = run.state();
    assert_eq!(state.pages[0]["selectedPerkIds"], json!([1]));
    assert_eq!(state.pages[0]["primaryStyleId"], 8000);
}

#[tokio::test]
async fn read_back_failures_are_unverified_and_mismatches_are_never_reported_as_success() {
    let unreadable = FakeLcu::new().with(|state, r| {
        (!r.is_write() && state.item_writes > 0 && matches!(r, LcuRequest::GetItemSets { .. }))
            .then(|| Err(err(CoreError::ClientUnavailable, false)))
    });
    let run = apply(unreadable).await;
    assert!(matches!(run.outcome, ApplyOutcome::AppliedUnverified { .. }), "{:?}", run.outcome);

    let altered = FakeLcu::new().with(|state, r| match r {
        LcuRequest::PutPage { .. } => {
            let _ = handle(state, r);
            state.writes.pop();
            state.pages[0]["selectedPerkIds"][0] = json!(8005);
            Some(Ok(Value::Null))
        }
        _ => None,
    });
    let run = apply(altered).await;
    assert!(matches!(&run.outcome, ApplyOutcome::Partial { error: CoreError::ReadbackMismatch, .. }), "{:?}", run.outcome);
    assert_eq!(run.writes().len(), 2, "no automatic retry after a mismatch");
}

#[tokio::test]
async fn multiple_managed_pages_or_signed_out_clients_block_all_writes() {
    let duplicate = FakeLcu::new().edit(|s| {
        let mut copy = s.pages[0].clone();
        copy["id"] = json!(13);
        s.pages.push(copy);
    });
    let run = apply(duplicate).await;
    assert_eq!(run.outcome, ApplyOutcome::Rejected { error: CoreError::AmbiguousOwnership });
    assert!(run.writes().is_empty());

    let run = apply(FakeLcu::new().edit(|s| s.summoner = json!({}))).await;
    assert_eq!(run.outcome, ApplyOutcome::Rejected { error: CoreError::NotSignedIn });
    assert!(run.writes().is_empty());
}

#[tokio::test]
async fn invalid_bundles_missing_targets_and_failed_backups_change_nothing() {
    let mut broken = bundle();
    broken["championAlias"] = json!("Ahri");
    let run = apply_with(FakeLcu::new(), &broken, true, true, None).await;
    assert!(matches!(run.outcome, ApplyOutcome::Rejected { error: CoreError::InvalidBundle { .. } }));
    assert!(run.writes().is_empty());

    let run = apply_with(FakeLcu::new(), &bundle(), false, false, None).await;
    assert!(matches!(run.outcome, ApplyOutcome::Rejected { error: CoreError::InvalidBundle { .. } }));

    let blocked = tempfile::tempdir().unwrap();
    let file = blocked.path().join("file");
    std::fs::write(&file, "x").unwrap();
    let writer = Writer::new(FakeLcu::new(), file);
    let outcome = writer.apply(&catalog(), ApplyRequest { bundle: &bundle(), items: true, runes: true, expected: None }).await;
    assert_eq!(outcome, ApplyOutcome::Rejected { error: CoreError::BackupFailed });
    assert!(writer.lcu().state.lock().unwrap().writes.is_empty());
}

#[tokio::test]
async fn a_changed_champion_or_account_aborts_before_writing_or_rolls_back_items() {
    let expected = Some(ExpectedSelection { summoner_id: 42, champion_id: 69 });
    let swapped = FakeLcu::new().edit(|s| s.session["myTeam"][1]["championId"] = json!(103));
    let run = apply_with(swapped, &bundle(), true, true, expected).await;
    assert_eq!(run.outcome, ApplyOutcome::Rejected { error: CoreError::SelectionChanged });
    assert!(run.writes().is_empty());

    let other_account = Some(ExpectedSelection { summoner_id: 7, champion_id: 69 });
    let run = apply_with(FakeLcu::new(), &bundle(), true, true, other_account).await;
    assert_eq!(run.outcome, ApplyOutcome::Rejected { error: CoreError::SelectionChanged });

    let swaps_mid_apply = FakeLcu::new().with(|state, r| {
        if matches!(r, LcuRequest::PutItemSets { .. }) && state.item_writes == 0 {
            state.session["myTeam"][1]["championId"] = json!(103);
        }
        None
    });
    let run = apply_with(swaps_mid_apply, &bundle(), true, true, expected).await;
    assert!(matches!(&run.outcome, ApplyOutcome::RolledBack { error: CoreError::SelectionChanged, .. }), "{:?}", run.outcome);
    assert_eq!(run.writes(), vec![put(SETS), put(SETS)]);
}

#[tokio::test]
async fn concurrent_applies_are_serialized_through_one_write_queue() {
    let writer = Arc::new(Writer::new(FakeLcu::new(), tempfile::tempdir().unwrap().keep()));
    let (catalog, bundle) = (catalog(), bundle());
    let request = || ApplyRequest { bundle: &bundle, items: true, runes: true, expected: None };
    let (a, b) = tokio::join!(writer.apply(&catalog, request()), writer.apply(&catalog, request()));
    assert!(matches!(a, ApplyOutcome::Verified { .. }) && matches!(b, ApplyOutcome::Verified { .. }));
    let writes = writer.lcu().state.lock().unwrap().writes.clone();
    assert_eq!(writes, vec![put(SETS), put("/lol-perks/v1/pages/12"), put(SETS), put("/lol-perks/v1/pages/12")]);
}
