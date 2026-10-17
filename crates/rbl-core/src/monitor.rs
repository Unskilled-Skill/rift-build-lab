//! The background monitor: one tokio task that owns the client connection, polls at the state
//! machine's interval, executes its imports through the shared writer and publishes status.
//!
//! Manual applies are sent to the same task, so every League write is serialized. Dropping the
//! last [`MonitorHandle`] stops the task (used for quit and window-less shutdown).

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinHandle;

use crate::CoreError;
use crate::apply::{ApplyOutcome, ApplyRequest, Writer};
use crate::auto_import::{ApplyIdentity, Context, Effect, Event, Machine, Pick, Status};
use crate::catalog::Catalog;
use crate::lcu::champ_select::reduce;
use crate::lcu::transport::{Lcu, LcuRequest};

/// Connects to the running client (discovery + TLS transport in production).
pub trait ClientSource: Send + Sync + 'static {
    type Client: Lcu + Send + Sync + 'static;
    fn connect(&self) -> Result<Self::Client, CoreError>;
}

/// Builds, preferences and persistence the monitor needs, read fresh on every use.
pub trait Library: Send + Sync + 'static {
    fn catalog(&self) -> Arc<Catalog>;
    fn revision(&self) -> String;
    fn choose(&self, pick: &Pick) -> Option<String>;
    fn bundle(&self, pick: &Pick, plan_id: &str) -> Option<Value>;
    /// Which parts automatic imports change: (items, runes).
    fn targets(&self) -> (bool, bool);
    /// Called after every write attempt; `identity` is `None` for manual applies.
    fn record(&self, identity: Option<&ApplyIdentity>, outcome: &ApplyOutcome);
}

pub enum Command {
    Enable,
    Disable,
    Pause,
    Resume,
    Reapply,
    PrefsChanged,
    ApplyNow { bundle: Value, items: bool, runes: bool, reply: oneshot::Sender<ApplyOutcome> },
    TestConnection { reply: oneshot::Sender<Result<String, CoreError>> },
}

#[derive(Clone)]
pub struct MonitorHandle {
    commands: mpsc::Sender<Command>,
    status: watch::Receiver<Status>,
}

impl MonitorHandle {
    pub async fn send(&self, command: Command) -> Result<(), CoreError> {
        self.commands.send(command).await.map_err(|_| CoreError::Internal)
    }

    pub async fn apply_now(&self, bundle: Value, items: bool, runes: bool) -> Result<ApplyOutcome, CoreError> {
        let (reply, answer) = oneshot::channel();
        self.send(Command::ApplyNow { bundle, items, runes, reply }).await?;
        answer.await.map_err(|_| CoreError::Internal)
    }

    pub async fn test_connection(&self) -> Result<String, CoreError> {
        let (reply, answer) = oneshot::channel();
        self.send(Command::TestConnection { reply }).await?;
        answer.await.map_err(|_| CoreError::Internal)?
    }

    pub fn status(&self) -> Status {
        self.status.borrow().clone()
    }

    pub fn subscribe(&self) -> watch::Receiver<Status> {
        self.status.clone()
    }
}

struct Runtime<S: ClientSource, L: Library> {
    source: S,
    library: L,
    backup_dir: PathBuf,
    machine: Machine,
    writer: Option<Writer<S::Client>>,
    last_phase: String,
    status: watch::Sender<Status>,
}

/// Starts the monitor task. `enabled` is the saved automatic-import setting.
pub fn spawn<S: ClientSource, L: Library>(source: S, library: L, backup_dir: PathBuf, enabled: bool) -> (MonitorHandle, JoinHandle<()>) {
    let machine = Machine::new(enabled);
    let (status, receiver) = watch::channel(machine.status());
    let (commands, inbox) = mpsc::channel(16);
    let runtime = Runtime { source, library, backup_dir, machine, writer: None, last_phase: String::new(), status };
    let task = tokio::spawn(runtime.run(inbox));
    (MonitorHandle { commands, status: receiver }, task)
}

async fn sleep_for(duration: Option<Duration>) {
    match duration {
        Some(duration) => tokio::time::sleep(duration).await,
        None => std::future::pending().await,
    }
}

impl<S: ClientSource, L: Library> Runtime<S, L> {
    async fn run(mut self, mut inbox: mpsc::Receiver<Command>) {
        loop {
            self.status.send_if_modified(|current| {
                let next = self.machine.status();
                (*current != next).then(|| *current = next).is_some()
            });
            tokio::select! {
                command = inbox.recv() => match command {
                    Some(command) => self.command(command).await,
                    None => break,
                },
                _ = sleep_for(self.machine.poll_interval()) => self.poll().await,
            }
        }
    }

    fn step(&mut self, event: Event) -> Vec<Effect> {
        let revision = self.library.revision();
        let library = &self.library;
        let choose = |pick: &Pick| library.choose(pick);
        let ctx = Context { now: tokio::time::Instant::now().into_std(), revision: &revision, choose: &choose };
        self.machine.step(event, &ctx)
    }

    async fn command(&mut self, command: Command) {
        let effects = match command {
            Command::Enable => self.step(Event::Enable),
            Command::Disable => {
                self.writer = None;
                self.step(Event::Disable)
            }
            Command::Pause => self.step(Event::Pause),
            Command::Resume => self.step(Event::Resume),
            Command::Reapply => self.step(Event::Reapply),
            Command::PrefsChanged => self.step(Event::PrefsChanged),
            Command::ApplyNow { bundle, items, runes, reply } => {
                let outcome = match self.ensure_writer().await {
                    Ok(()) => {
                        let catalog = self.library.catalog();
                        let writer = self.writer.as_ref().expect("connected");
                        let account = writer.lcu().call(LcuRequest::GetSummoner).await.ok().and_then(|v| v["summonerId"].as_u64());
                        let phase = writer.lcu().call(LcuRequest::GetPhase).await.ok().and_then(|v| v.as_str().map(str::to_owned));
                        let session = writer.lcu().call(LcuRequest::GetChampSelectSession).await.ok().as_ref().and_then(reduce);
                        if let (Some(account), Some(phase)) = (account, phase) {
                            self.step(Event::ClientFound { account });
                            self.step(Event::Phase(phase));
                            if let Some(view) = session {
                                let pick = view.champion_id.and_then(|id| catalog.champion(id)).map(|c| Pick {
                                    champion_id: c.id,
                                    champion: c.alias.clone(),
                                    role: view.role,
                                });
                                self.step(Event::Session { game_id: view.game_id, pick });
                            }
                        }
                        let writer = self.writer.as_ref().expect("connected");
                        writer.apply(&catalog, ApplyRequest { bundle: &bundle, items, runes, expected: None }).await
                    }
                    Err(error) => ApplyOutcome::Rejected { error },
                };
                if let Some(id) = bundle["championId"].as_i64() {
                    self.machine.record_manual(id, bundle["buildName"].as_str().unwrap_or("Manual build"), &outcome);
                }
                self.library.record(None, &outcome);
                let _ = reply.send(outcome);
                Vec::new()
            }
            Command::TestConnection { reply } => {
                let result = match self.ensure_writer().await {
                    Ok(()) => match self.writer.as_ref().expect("connected").lcu().call(LcuRequest::GetGameVersion).await {
                        Ok(Value::String(version)) => Ok(version),
                        Ok(_) => Err(CoreError::Internal),
                        Err(e) => Err(e.error),
                    },
                    Err(error) => Err(error),
                };
                let _ = reply.send(result);
                Vec::new()
            }
        };
        self.execute(effects).await;
    }

    /// Connects if needed and returns the signed-in account.
    async fn ensure_writer(&mut self) -> Result<(), CoreError> {
        if self.writer.is_some() {
            return Ok(());
        }
        let client = self.source.connect()?;
        let summoner = client.call(LcuRequest::GetSummoner).await.map_err(|e| e.error)?;
        summoner.get("summonerId").and_then(Value::as_u64).filter(|id| *id > 0).ok_or(CoreError::NotSignedIn)?;
        self.writer = Some(Writer::new(client, self.backup_dir.clone()));
        Ok(())
    }

    async fn account(&self) -> Option<u64> {
        let summoner = self.writer.as_ref()?.lcu().call(LcuRequest::GetSummoner).await.ok()?;
        summoner.get("summonerId").and_then(Value::as_u64).filter(|id| *id > 0)
    }

    async fn poll(&mut self) {
        let mut effects = Vec::new();
        if self.writer.is_none() {
            let connected = self.ensure_writer().await.is_ok();
            match self.account().await {
                Some(account) if connected => effects.extend(self.step(Event::ClientFound { account })),
                _ => {
                    self.writer = None;
                    effects.extend(self.step(Event::ClientLost));
                    return self.execute(effects).await;
                }
            }
        }
        let phase = match self.writer.as_ref().expect("connected").lcu().call(LcuRequest::GetPhase).await {
            Ok(value) => value.as_str().unwrap_or("Unknown").to_owned(),
            Err(_) => {
                self.writer = None;
                self.last_phase.clear();
                effects.extend(self.step(Event::ClientLost));
                return self.execute(effects).await;
            }
        };
        if phase == "ChampSelect" && self.last_phase != "ChampSelect" {
            // The account is re-read whenever a selection starts; the writer re-checks it before writing.
            if let Some(account) = self.account().await {
                effects.extend(self.step(Event::ClientFound { account }));
            }
        }
        self.last_phase.clone_from(&phase);
        effects.extend(self.step(Event::Phase(phase.clone())));
        if phase == "ChampSelect" {
            let session = self.writer.as_ref().expect("connected").lcu().call(LcuRequest::GetChampSelectSession).await;
            if let Some(view) = session.ok().as_ref().and_then(reduce) {
                let catalog = self.library.catalog();
                let pick = view.champion_id.and_then(|id| catalog.champion(id)).map(|c| Pick {
                    champion_id: c.id,
                    champion: c.alias.clone(),
                    role: view.role,
                });
                effects.extend(self.step(Event::Session { game_id: view.game_id, pick }));
            }
        }
        effects.extend(self.step(Event::Tick));
        self.execute(effects).await;
    }

    async fn execute(&mut self, effects: Vec<Effect>) {
        let mut queue = effects;
        while let Some(Effect::Apply(identity)) = queue.pop() {
            let outcome = self.import(&identity).await;
            self.library.record(Some(&identity), &outcome);
            queue.extend(self.step(Event::ApplyFinished { identity, outcome }));
        }
    }

    async fn import(&mut self, identity: &ApplyIdentity) -> ApplyOutcome {
        let pick = Pick { champion_id: identity.champion_id, champion: identity.champion.clone(), role: identity.role };
        let Some(bundle) = self.library.bundle(&pick, &identity.plan_id) else {
            return ApplyOutcome::Rejected { error: CoreError::NoBuildForRole };
        };
        let Some(writer) = self.writer.as_ref() else { return ApplyOutcome::Rejected { error: CoreError::ClientUnavailable } };
        let (items, runes) = self.library.targets();
        let catalog = self.library.catalog();
        writer.apply(&catalog, ApplyRequest { bundle: &bundle, items, runes, expected: Some(identity.expected()) }).await
    }
}
