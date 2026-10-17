use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rbl_core::CoreError;
use rbl_core::apply::ApplyOutcome;
use rbl_core::auto_import::{ApplyIdentity, Pick, Status};
use rbl_core::catalog::Catalog;
use rbl_core::lcu::transport::{Lcu, LcuRequest, TransportError};
use rbl_core::monitor::{ClientSource, Command, Library, spawn};
use rbl_core::prefs::Role;
use serde_json::{Value, json};

fn repo(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}
fn catalog() -> Arc<Catalog> {
    Arc::new(Catalog::from_companion_json(&std::fs::read_to_string(repo("companion/catalog.json")).unwrap()).unwrap())
}
fn parity_bundle(n: usize) -> Value {
    let parity: Value = serde_json::from_str(&std::fs::read_to_string(repo("tests/fixtures/bundle-parity.json")).unwrap()).unwrap();
    parity["cases"][n]["bundle"].clone()
}

/// A minimal League Client whose state the test edits between polls.
struct Client {
    up: bool,
    phase: &'static str,
    session: Value,
    summoner: u64,
    sets: Value,
    pages: Vec<Value>,
    writes: usize,
    calls: usize,
}

#[derive(Clone)]
struct Fake(Arc<Mutex<Client>>);

impl Fake {
    fn new() -> Self {
        Fake(Arc::new(Mutex::new(Client {
            up: true,
            phase: "None",
            session: json!(null),
            summoner: 42,
            sets: json!({"itemSets": []}),
            pages: vec![],
            writes: 0,
            calls: 0,
        })))
    }
    fn set(&self, change: impl FnOnce(&mut Client)) {
        change(&mut self.0.lock().unwrap());
    }
    fn writes(&self) -> usize {
        self.0.lock().unwrap().writes
    }
    fn calls(&self) -> usize {
        self.0.lock().unwrap().calls
    }
}

fn lock(champion_id: i64, position: &str) -> Value {
    json!({"gameId": 77, "localPlayerCellId": 0, "myTeam": [{"cellId": 0, "championId": champion_id, "assignedPosition": position}],
        "actions": [[{"actorCellId": 0, "championId": champion_id, "completed": true, "type": "pick"}]]})
}

impl Lcu for Fake {
    async fn call(&self, request: LcuRequest) -> Result<Value, TransportError> {
        let mut c = self.0.lock().unwrap();
        c.calls += 1;
        if !c.up {
            return Err(TransportError { error: CoreError::ClientUnavailable, ambiguous: false });
        }
        Ok(match request {
            LcuRequest::GetSummoner => json!({"summonerId": c.summoner}),
            LcuRequest::GetPhase => json!(c.phase),
            LcuRequest::GetGameVersion => json!("16.20.555.1"),
            LcuRequest::GetChampSelectSession => c.session.clone(),
            LcuRequest::GetPages => Value::Array(c.pages.clone()),
            LcuRequest::GetItemSets { .. } => c.sets.clone(),
            LcuRequest::PutItemSets { body, .. } => {
                c.writes += 1;
                c.sets = body;
                Value::Null
            }
            LcuRequest::PostPage { mut body } => {
                c.writes += 1;
                body["id"] = json!(99);
                body["isEditable"] = json!(true);
                c.pages.push(body);
                json!({"id": 99})
            }
            LcuRequest::PutPage { id, mut body } => {
                c.writes += 1;
                body["id"] = json!(id.get());
                body["isEditable"] = json!(true);
                c.pages.retain(|p| p["id"] != json!(id.get()));
                c.pages.push(body);
                Value::Null
            }
        })
    }
}

impl ClientSource for Fake {
    type Client = Fake;
    fn connect(&self) -> Result<Fake, CoreError> {
        if self.0.lock().unwrap().up { Ok(self.clone()) } else { Err(CoreError::ClientUnavailable) }
    }
}

/// (plan id for automatic imports, outcome kind) per recorded write.
type Records = Vec<(Option<String>, &'static str)>;

#[derive(Clone)]
struct Books {
    catalog: Arc<Catalog>,
    plans: HashMap<(String, Role), (String, Value)>,
    records: Arc<Mutex<Records>>,
}

impl Books {
    fn new() -> Self {
        let mut plans = HashMap::new();
        plans.insert(("Cassiopeia".into(), Role::Mid), ("authored:Cassiopeia:reference".into(), parity_bundle(0)));
        plans.insert(("Ahri".into(), Role::Mid), ("meta:Ahri:mid:opgg".into(), parity_bundle(1)));
        Books { catalog: catalog(), plans, records: Arc::default() }
    }
    fn records(&self) -> Records {
        self.records.lock().unwrap().clone()
    }
}

impl Library for Books {
    fn catalog(&self) -> Arc<Catalog> {
        self.catalog.clone()
    }
    fn revision(&self) -> String {
        "rev".into()
    }
    fn choose(&self, pick: &Pick) -> Option<String> {
        self.plans.get(&(pick.champion.clone(), pick.role?)).map(|(id, _)| id.clone())
    }
    fn bundle(&self, pick: &Pick, plan_id: &str) -> Option<Value> {
        self.plans.get(&(pick.champion.clone(), pick.role?)).filter(|(id, _)| id == plan_id).map(|(_, b)| b.clone())
    }
    fn targets(&self) -> (bool, bool) {
        (true, true)
    }
    fn record(&self, identity: Option<&ApplyIdentity>, outcome: &ApplyOutcome) {
        self.records.lock().unwrap().push((identity.map(|i| i.plan_id.clone()), outcome.kind()));
    }
}

async fn wait(seconds: u64) {
    tokio::time::sleep(Duration::from_secs(seconds)).await;
}

#[tokio::test(start_paused = true)]
async fn follows_a_full_selection_and_imports_exactly_once_per_pick() {
    let client = Fake::new();
    let books = Books::new();
    let backups = tempfile::tempdir().unwrap();
    let (monitor, _task) = spawn(client.clone(), books.clone(), backups.path().to_path_buf(), true);

    wait(1).await;
    assert_eq!(monitor.status(), Status::Connected { phase: "None".into() });
    client.set(|c| c.phase = "Lobby");
    wait(6).await;
    assert_eq!(monitor.status(), Status::Connected { phase: "Lobby".into() });

    client.set(|c| {
        c.phase = "ChampSelect";
        c.session = json!({"gameId": 77, "localPlayerCellId": 0, "myTeam": [{"cellId": 0, "championId": 0, "championPickIntent": 103, "assignedPosition": "middle"}],
            "actions": [[{"actorCellId": 0, "championId": 103, "completed": false, "type": "pick"}]]});
    });
    wait(6).await;
    assert_eq!(client.writes(), 0, "hovering never imports");

    client.set(|c| c.session = lock(103, "middle"));
    wait(4).await;
    assert_eq!(client.writes(), 2, "items and runes for Ahri");
    assert_eq!(monitor.status(), Status::Applied { plan_id: "meta:Ahri:mid:opgg".into(), verified: true });

    client.set(|c| c.session = lock(69, "middle"));
    wait(4).await;
    assert_eq!(client.writes(), 4, "a swap imports the new champion");

    wait(20).await;
    assert_eq!(client.writes(), 4, "repeated snapshots never write again");

    client.set(|c| c.phase = "InProgress");
    wait(10).await;
    assert_eq!(client.writes(), 4);
    assert_eq!(monitor.status(), Status::Connected { phase: "InProgress".into() });
    assert_eq!(
        books.records(),
        vec![(Some("meta:Ahri:mid:opgg".into()), "verified"), (Some("authored:Cassiopeia:reference".into()), "verified")]
    );
    assert_eq!(std::fs::read_dir(backups.path()).unwrap().count(), 2);
}

#[tokio::test(start_paused = true)]
async fn disabled_monitoring_makes_no_client_calls_but_manual_apply_still_works() {
    let client = Fake::new();
    client.set(|c| {
        c.phase = "ChampSelect";
        c.session = lock(103, "middle");
    });
    let books = Books::new();
    let backups = tempfile::tempdir().unwrap();
    let (monitor, _task) = spawn(client.clone(), books.clone(), backups.path().to_path_buf(), false);
    wait(120).await;
    assert_eq!((client.calls(), monitor.status()), (0, Status::Disabled));

    let outcome = monitor.apply_now(parity_bundle(0), true, false).await.unwrap();
    assert_eq!(outcome.kind(), "verified");
    assert_eq!(client.writes(), 1, "items only");
    assert_eq!(monitor.test_connection().await.unwrap(), "16.20.555.1");
    assert_eq!(books.records(), vec![(None, "verified")]);

    monitor.send(Command::Enable).await.unwrap();
    wait(4).await;
    assert_eq!(client.writes(), 3, "enabling imports the current locked pick");
}

#[tokio::test(start_paused = true)]
async fn pausing_stops_polling_and_losing_the_client_backs_off() {
    let client = Fake::new();
    let backups = tempfile::tempdir().unwrap();
    let (monitor, task) = spawn(client.clone(), Books::new(), backups.path().to_path_buf(), true);
    wait(1).await;
    monitor.send(Command::Pause).await.unwrap();
    wait(1).await;
    let calls = client.calls();
    wait(300).await;
    assert_eq!((client.calls(), monitor.status()), (calls, Status::Paused));

    monitor.send(Command::Resume).await.unwrap();
    client.set(|c| c.up = false);
    wait(6).await;
    assert_eq!(monitor.status(), Status::LeagueClosed);
    let calls = client.calls();
    wait(14).await;
    assert_eq!(client.calls(), calls, "no retry before the 15 s backoff");
    client.set(|c| c.up = true);
    wait(2).await;
    assert_eq!(monitor.status(), Status::Connected { phase: "None".into() });

    let outcome = monitor.apply_now(json!({"not": "a bundle"}), true, true).await.unwrap();
    assert!(matches!(outcome, ApplyOutcome::Rejected { error: CoreError::InvalidBundle { .. } }));
    assert_eq!(client.writes(), 0);

    drop(monitor);
    tokio::time::timeout(Duration::from_secs(5), task).await.expect("dropping the handle stops the monitor").unwrap();
}
