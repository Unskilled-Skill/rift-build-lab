//! Automatic import decisions as a pure state machine (plan §2.7).
//!
//! No I/O happens here: the desktop monitor feeds events (client discovery, gameflow phase,
//! champ-select snapshots, apply results, user actions) with the current time, executes the
//! returned effects through the shared writer, and polls at [`Machine::poll_interval`].
//!
//! Guarantees: nothing is written while disabled or paused, outside champ select, or before the
//! local pick has been stable for [`STABLE_FOR`]; each champion/role/build is applied at most once
//! per selection session (manual changes afterwards are respected until the user asks to
//! reapply); an uncertain or failed write blocks further automatic writes in that session.

use std::time::{Duration, Instant};

use crate::CoreError;
use crate::apply::{ApplyOutcome, ExpectedSelection};
use crate::prefs::{Preferences, Role};

/// How long the locked pick must stay unchanged before importing.
pub const STABLE_FOR: Duration = Duration::from_millis(1500);
const CONNECTED_POLL: Duration = Duration::from_secs(5);
const CHAMP_SELECT_POLL: Duration = Duration::from_secs(1);

/// The local player's locked champion (alias resolved from the catalog) and assigned role.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pick {
    pub champion_id: i64,
    pub champion: String,
    pub role: Option<Role>,
}

/// Identifies one selection session: the client's game id (0 in customs) plus a local entry counter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionKey {
    pub game_id: u64,
    pub entry_seq: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplyIdentity {
    pub account: u64,
    pub session: SessionKey,
    pub champion_id: i64,
    pub champion: String,
    pub role: Option<Role>,
    pub plan_id: String,
    pub revision: String,
    /// Requested by the user (Reapply) rather than decided automatically.
    pub explicit: bool,
}

impl ApplyIdentity {
    /// What the writer must re-check immediately before writing.
    pub fn expected(&self) -> ExpectedSelection {
        ExpectedSelection { summoner_id: self.account, champion_id: self.champion_id }
    }
}

#[derive(Debug, Clone)]
pub enum Event {
    Enable,
    Disable,
    Pause,
    Resume,
    /// Time advanced (sent on every poll).
    Tick,
    ClientFound {
        account: u64,
    },
    ClientLost,
    Phase(String),
    /// Champ-select snapshot; `pick` is `None` until the local player has locked a champion.
    Session {
        game_id: u64,
        pick: Option<Pick>,
    },
    ApplyFinished {
        identity: ApplyIdentity,
        outcome: ApplyOutcome,
    },
    /// Defaults or the meta-fallback setting changed.
    PrefsChanged,
    /// The user asked to apply the current selection again.
    Reapply,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Effect {
    Apply(ApplyIdentity),
}

/// Mirrors the TypeScript `ConnectionState`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Status {
    Disabled,
    Connecting,
    LeagueClosed,
    Connected { phase: String },
    ChampSelect { champion: Option<String>, role: Option<Role> },
    Applying,
    Applied { plan_id: String, verified: bool },
    Paused,
    NeedsAttention { error: CoreError },
}

impl Status {
    /// The TypeScript `ConnectionState` shape sent to the window.
    pub fn to_json(&self) -> serde_json::Value {
        use serde_json::json;
        match self {
            Status::Disabled => json!({"kind": "disabled"}),
            Status::Connecting => json!({"kind": "connecting"}),
            Status::LeagueClosed => json!({"kind": "league-closed"}),
            Status::Connected { phase } => json!({"kind": "connected", "phase": phase}),
            Status::ChampSelect { champion, role } => {
                let mut value = json!({"kind": "champ-select"});
                if let Some(champion) = champion {
                    value["champion"] = json!(champion);
                }
                if let Some(role) = role {
                    value["role"] = json!(role.as_str());
                }
                value
            }
            Status::Applying => json!({"kind": "applying"}),
            Status::Applied { plan_id, verified } => json!({"kind": "applied", "build": plan_id, "verified": verified}),
            Status::Paused => json!({"kind": "paused"}),
            Status::NeedsAttention { error } => {
                json!({"kind": "needs-attention", "code": error.code(), "message": error.to_string(), "recovery": error.recovery()})
            }
        }
    }
}

pub struct Context<'a> {
    pub now: Instant,
    /// Active data revision, recorded with each import.
    pub revision: &'a str,
    /// Build for a pick, normally [`choose_build`] over current preferences and meta plans.
    pub choose: &'a dyn Fn(&Pick) -> Option<String>,
}

/// A saved default for the champion and role, else (only when opted in and the role is known) the
/// qualified meta plan for that role. Experiments are never chosen unless the user saved them.
pub fn choose_build(prefs: &Preferences, pick: &Pick, meta_plan: impl Fn(&str, Role) -> Option<String>) -> Option<String> {
    let role = pick.role?;
    if let Some(default) = prefs.defaults.get(&format!("{}|{}", pick.champion, role.as_str())) {
        return Some(default.plan_id.clone());
    }
    if prefs.auto_import.meta_fallback { meta_plan(&pick.champion, role).filter(|id| id.starts_with("meta:")) } else { None }
}

type PickKey = (i64, Option<Role>);

#[derive(Debug, Clone)]
struct Selection {
    account: u64,
    key: SessionKey,
    pick: Option<Pick>,
    stable_since: Option<Instant>,
    considered: Option<PickKey>,
    in_flight: Option<ApplyIdentity>,
    applied: Vec<(i64, Option<Role>, String)>,
    last: Option<(PickKey, String, bool)>,
    attention: Option<CoreError>,
    /// Set after a failed or uncertain write: only an explicit reapply may write again this session.
    blocked: bool,
}

#[derive(Debug, Clone)]
enum State {
    Disabled,
    Waiting { attempt: u32 },
    Connected { account: u64, phase: String, attention: Option<CoreError> },
    ChampSelect(Box<Selection>),
    Paused(Box<State>),
}

pub struct Machine {
    state: State,
    entry_seq: u64,
}

fn pick_key(pick: &Pick) -> PickKey {
    (pick.champion_id, pick.role)
}

fn failure(outcome: &ApplyOutcome) -> Option<&CoreError> {
    match outcome {
        ApplyOutcome::Verified { .. } | ApplyOutcome::AppliedUnverified { .. } => None,
        ApplyOutcome::RolledBack { error, .. } | ApplyOutcome::Partial { error, .. } | ApplyOutcome::Rejected { error } => Some(error),
    }
}

impl Selection {
    fn new(account: u64, key: SessionKey) -> Self {
        Selection {
            account,
            key,
            pick: None,
            stable_since: None,
            considered: None,
            in_flight: None,
            applied: Vec::new(),
            last: None,
            attention: None,
            blocked: false,
        }
    }

    fn identity(&self, pick: &Pick, plan_id: String, ctx: &Context, explicit: bool) -> ApplyIdentity {
        ApplyIdentity {
            account: self.account,
            session: self.key,
            champion_id: pick.champion_id,
            champion: pick.champion.clone(),
            role: pick.role,
            plan_id,
            revision: ctx.revision.to_owned(),
            explicit,
        }
    }

    fn evaluate(&mut self, ctx: &Context) -> Vec<Effect> {
        let Some(pick) = self.pick.clone() else { return vec![] };
        let stable = self.stable_since.is_some_and(|since| ctx.now.saturating_duration_since(since) >= STABLE_FOR);
        if self.blocked || self.in_flight.is_some() || !stable || self.considered == Some(pick_key(&pick)) {
            return vec![];
        }
        self.considered = Some(pick_key(&pick));
        let Some(plan_id) = (ctx.choose)(&pick) else {
            self.attention = Some(CoreError::NoBuildForRole);
            return vec![];
        };
        self.attention = None;
        if self.applied.iter().any(|(id, role, plan)| (*id, *role) == pick_key(&pick) && *plan == plan_id) {
            return vec![];
        }
        let identity = self.identity(&pick, plan_id, ctx, false);
        self.in_flight = Some(identity.clone());
        vec![Effect::Apply(identity)]
    }

    fn reapply(&mut self, ctx: &Context) -> Vec<Effect> {
        let Some(pick) = self.pick.clone() else { return vec![] };
        if self.in_flight.is_some() {
            return vec![];
        }
        let Some(plan_id) = (ctx.choose)(&pick) else {
            self.attention = Some(CoreError::NoBuildForRole);
            return vec![];
        };
        self.blocked = false;
        self.attention = None;
        self.considered = Some(pick_key(&pick));
        let identity = self.identity(&pick, plan_id, ctx, true);
        self.in_flight = Some(identity.clone());
        vec![Effect::Apply(identity)]
    }

    fn finish(&mut self, identity: &ApplyIdentity, outcome: &ApplyOutcome) {
        if self.in_flight.as_ref() == Some(identity) {
            self.in_flight = None;
        }
        if identity.account != self.account || identity.session != self.key {
            return;
        }
        let key = (identity.champion_id, identity.role);
        self.applied.push((key.0, key.1, identity.plan_id.clone()));
        match failure(outcome) {
            None => {
                self.last = Some((key, identity.plan_id.clone(), matches!(outcome, ApplyOutcome::Verified { .. })));
                self.attention = None;
            }
            Some(error) => {
                self.attention = Some(error.clone());
                self.blocked = true;
            }
        }
    }
}

fn record_outside_session(state: &mut State, identity: &ApplyIdentity, outcome: &ApplyOutcome) {
    match state {
        State::ChampSelect(selection) => selection.finish(identity, outcome),
        State::Connected { account, attention, .. } if *account == identity.account => {
            if let Some(error) = failure(outcome) {
                *attention = Some(error.clone());
            }
        }
        State::Paused(prior) => record_outside_session(prior, identity, outcome),
        _ => {}
    }
}

impl Machine {
    pub fn new(enabled: bool) -> Self {
        Machine { state: if enabled { State::Waiting { attempt: 0 } } else { State::Disabled }, entry_seq: 0 }
    }

    fn enter_champ_select(&mut self, account: u64, game_id: u64) -> State {
        self.entry_seq += 1;
        State::ChampSelect(Box::new(Selection::new(account, SessionKey { game_id, entry_seq: self.entry_seq })))
    }

    pub fn step(&mut self, event: Event, ctx: &Context) -> Vec<Effect> {
        let state = std::mem::replace(&mut self.state, State::Disabled);
        let (next, effects) = self.transition(state, event, ctx);
        self.state = next;
        effects
    }

    fn transition(&mut self, state: State, event: Event, ctx: &Context) -> (State, Vec<Effect>) {
        let none = Vec::new;
        match (state, event) {
            (_, Event::Disable) => (State::Disabled, none()),
            (State::Disabled, Event::Enable) => (State::Waiting { attempt: 0 }, none()),
            (State::Disabled, _) => (State::Disabled, none()),
            (State::Paused(prior), Event::Resume) => (*prior, none()),
            (State::Paused(mut prior), Event::ApplyFinished { identity, outcome }) => {
                record_outside_session(&mut prior, &identity, &outcome);
                (State::Paused(prior), none())
            }
            (state @ State::Paused(_), _) => (state, none()),
            (state, Event::Pause) => (State::Paused(Box::new(state)), none()),

            (State::Waiting { .. }, Event::ClientFound { account }) => {
                (State::Connected { account, phase: "None".into(), attention: None }, none())
            }
            (State::Waiting { attempt }, Event::ClientLost) => (State::Waiting { attempt: attempt.saturating_add(1) }, none()),
            (state @ State::Waiting { .. }, _) => (state, none()),

            (State::Connected { .. }, Event::ClientLost) | (State::ChampSelect(_), Event::ClientLost) => {
                (State::Waiting { attempt: 1 }, none())
            }

            (State::Connected { account, phase, attention }, event) => match event {
                Event::ClientFound { account: other } if other != account => {
                    (State::Connected { account: other, phase: "None".into(), attention: None }, none())
                }
                Event::Phase(p) if p == "ChampSelect" => (self.enter_champ_select(account, 0), none()),
                Event::Phase(p) => (State::Connected { account, phase: p, attention }, none()),
                Event::ApplyFinished { identity, outcome } => {
                    let mut state = State::Connected { account, phase, attention };
                    record_outside_session(&mut state, &identity, &outcome);
                    (state, none())
                }
                _ => (State::Connected { account, phase, attention }, none()),
            },

            (State::ChampSelect(mut s), event) => match event {
                Event::ClientFound { account } if account != s.account => {
                    (State::Connected { account, phase: "None".into(), attention: None }, none())
                }
                Event::Phase(p) if p != "ChampSelect" => {
                    let attention = if s.blocked { s.attention.clone() } else { None };
                    (State::Connected { account: s.account, phase: p, attention }, none())
                }
                Event::Session { game_id, pick } => {
                    if game_id != 0 && s.key.game_id != 0 && game_id != s.key.game_id {
                        let account = s.account;
                        let State::ChampSelect(fresh) = self.enter_champ_select(account, game_id) else { unreachable!() };
                        s = fresh;
                    } else if s.key.game_id == 0 {
                        s.key.game_id = game_id;
                    }
                    if s.pick.as_ref().map(pick_key) != pick.as_ref().map(pick_key) {
                        s.stable_since = pick.as_ref().map(|_| ctx.now);
                        s.pick = pick;
                        s.considered = None;
                        if !s.blocked {
                            s.attention = None;
                        }
                    }
                    let effects = s.evaluate(ctx);
                    (State::ChampSelect(s), effects)
                }
                Event::Tick => {
                    let effects = s.evaluate(ctx);
                    (State::ChampSelect(s), effects)
                }
                Event::PrefsChanged => {
                    s.considered = None;
                    let effects = s.evaluate(ctx);
                    (State::ChampSelect(s), effects)
                }
                Event::Reapply => {
                    let effects = s.reapply(ctx);
                    (State::ChampSelect(s), effects)
                }
                Event::ApplyFinished { identity, outcome } => {
                    s.finish(&identity, &outcome);
                    (State::ChampSelect(s), none())
                }
                _ => (State::ChampSelect(s), none()),
            },
        }
    }

    pub fn status(&self) -> Status {
        match &self.state {
            State::Disabled => Status::Disabled,
            State::Paused(_) => Status::Paused,
            State::Waiting { attempt: 0 } => Status::Connecting,
            State::Waiting { .. } => Status::LeagueClosed,
            State::Connected { attention: Some(error), .. } => Status::NeedsAttention { error: error.clone() },
            State::Connected { phase, .. } => Status::Connected { phase: phase.clone() },
            State::ChampSelect(s) => {
                if let Some(error) = &s.attention {
                    Status::NeedsAttention { error: error.clone() }
                } else if s.in_flight.is_some() {
                    Status::Applying
                } else if let Some((_, plan_id, verified)) = s.last.as_ref().filter(|(key, ..)| s.pick.as_ref().map(pick_key) == Some(*key))
                {
                    Status::Applied { plan_id: plan_id.clone(), verified: *verified }
                } else {
                    Status::ChampSelect {
                        champion: s.pick.as_ref().map(|p| p.champion.clone()),
                        role: s.pick.as_ref().and_then(|p| p.role),
                    }
                }
            }
        }
    }

    /// When to poll the client next; `None` means do not poll (disabled or paused).
    pub fn poll_interval(&self) -> Option<Duration> {
        match &self.state {
            State::Disabled | State::Paused(_) => None,
            State::Waiting { attempt } => Some(Duration::from_secs(match attempt {
                0 => 0,
                1 => 15,
                2 => 30,
                _ => 60,
            })),
            State::Connected { .. } => Some(CONNECTED_POLL),
            State::ChampSelect(_) => Some(CHAMP_SELECT_POLL),
        }
    }
}
