use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use rbl_core::CoreError;
use rbl_core::apply::{ApplyOutcome, ExpectedSelection};
use rbl_core::auto_import::{ApplyIdentity, Context, Effect, Event, Machine, Pick, Status, choose_build};
use rbl_core::prefs::{DefaultBuild, Preferences, Role};
use serde_json::json;

struct Harness {
    machine: Machine,
    now: Instant,
    builds: HashMap<(String, Option<Role>), String>,
    revision: String,
}

fn pick(champion: &str, id: i64, role: Option<Role>) -> Pick {
    Pick { champion_id: id, champion: champion.into(), role }
}

impl Harness {
    fn new(enabled: bool) -> Self {
        let mut builds = HashMap::new();
        for (champion, role, plan) in [
            ("Cassiopeia", Some(Role::Mid), "authored:Cassiopeia:reference"),
            ("Ahri", Some(Role::Mid), "meta:Ahri:mid:opgg"),
            ("Ahri", Some(Role::Support), "meta:Ahri:support:opgg"),
            ("Thresh", Some(Role::Support), "meta:Thresh:support:opgg"),
        ] {
            builds.insert((champion.to_string(), role), plan.to_string());
        }
        Harness { machine: Machine::new(enabled), now: Instant::now(), builds, revision: "rev-a".into() }
    }
    fn send(&mut self, event: Event) -> Vec<Effect> {
        let builds = self.builds.clone();
        let choose = move |p: &Pick| builds.get(&(p.champion.clone(), p.role)).cloned();
        let ctx = Context { now: self.now, revision: &self.revision, choose: &choose };
        self.machine.step(event, &ctx)
    }
    fn after(&mut self, ms: u64) -> Vec<Effect> {
        self.now += Duration::from_millis(ms);
        self.send(Event::Tick)
    }
    /// Enable, connect as account 42 and enter champ select.
    fn in_champ_select() -> Self {
        let mut h = Harness::new(true);
        h.send(Event::ClientFound { account: 42 });
        h.send(Event::Phase("ChampSelect".into()));
        h
    }
    fn lock(&mut self, champion: &str, id: i64, role: Option<Role>) -> Vec<Effect> {
        self.send(Event::Session { game_id: 900, pick: Some(pick(champion, id, role)) })
    }
    /// Locks a champion and waits until the machine decides.
    fn lock_and_wait(&mut self, champion: &str, id: i64, role: Option<Role>) -> Vec<Effect> {
        let mut effects = self.lock(champion, id, role);
        effects.extend(self.after(1600));
        effects
    }
    fn finish(&mut self, effects: &[Effect], outcome: ApplyOutcome) -> Vec<Effect> {
        let [Effect::Apply(identity)] = effects else { panic!("expected one apply, got {effects:?}") };
        self.send(Event::ApplyFinished { identity: identity.clone(), outcome })
    }
}

fn verified() -> ApplyOutcome {
    ApplyOutcome::Verified { backup: PathBuf::from("b.json") }
}
fn applied_plans(effects: &[Effect]) -> Vec<String> {
    effects.iter().map(|Effect::Apply(i)| i.plan_id.clone()).collect()
}

#[test]
fn disabled_monitoring_never_polls_or_reacts() {
    let mut h = Harness::new(false);
    assert_eq!(h.machine.poll_interval(), None);
    for event in [Event::ClientFound { account: 1 }, Event::Phase("ChampSelect".into()), Event::Tick, Event::Reapply] {
        assert!(h.send(event).is_empty());
    }
    h.send(Event::Session { game_id: 1, pick: Some(pick("Ahri", 103, Some(Role::Mid))) });
    assert!(h.after(5000).is_empty());
    assert_eq!(h.machine.status(), Status::Disabled);
}

#[test]
fn discovery_backs_off_and_polling_follows_the_client_phase() {
    let mut h = Harness::new(true);
    assert_eq!(h.machine.status(), Status::Connecting);
    let mut intervals = vec![h.machine.poll_interval()];
    for _ in 0..4 {
        h.send(Event::ClientLost);
        intervals.push(h.machine.poll_interval());
    }
    let s = |n| Some(Duration::from_secs(n));
    assert_eq!(intervals, vec![s(0), s(15), s(30), s(60), s(60)]);
    assert_eq!(h.machine.status(), Status::LeagueClosed);
    h.send(Event::ClientFound { account: 42 });
    assert_eq!(h.machine.poll_interval(), s(5));
    h.send(Event::Phase("Lobby".into()));
    assert_eq!(h.machine.status(), Status::Connected { phase: "Lobby".into() });
    h.send(Event::Phase("ChampSelect".into()));
    assert_eq!(h.machine.poll_interval(), s(1));
    assert_eq!(h.machine.status(), Status::ChampSelect { champion: None, role: None });
}

#[test]
fn waits_for_a_stable_locked_pick_then_applies_once_with_a_full_identity() {
    let mut h = Harness::in_champ_select();
    assert!(h.lock("Ahri", 103, Some(Role::Mid)).is_empty());
    assert!(h.after(1000).is_empty(), "not stable yet");
    let effects = h.after(600);
    let [Effect::Apply(identity)] = effects.as_slice() else { panic!("{effects:?}") };
    assert_eq!(
        (identity.account, identity.champion_id, identity.role, identity.plan_id.as_str()),
        (42, 103, Some(Role::Mid), "meta:Ahri:mid:opgg")
    );
    assert_eq!(identity.revision, "rev-a");
    assert!(!identity.explicit);
    assert_eq!(identity.expected(), ExpectedSelection { summoner_id: 42, champion_id: 103 });
    assert_eq!(h.machine.status(), Status::Applying);
    assert!(h.after(5000).is_empty(), "no second apply while one is in flight");

    assert!(h.finish(&effects, verified()).is_empty());
    assert_eq!(h.machine.status(), Status::Applied { plan_id: "meta:Ahri:mid:opgg".into(), verified: true });
    for _ in 0..5 {
        assert!(h.lock("Ahri", 103, Some(Role::Mid)).is_empty(), "duplicate snapshots are no-ops");
        assert!(h.after(2000).is_empty());
    }
}

#[test]
fn a_swap_creates_a_new_identity_but_returning_respects_manual_changes_until_reapply() {
    let mut h = Harness::in_champ_select();
    let first = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.finish(&first, verified());
    let swapped = h.lock_and_wait("Cassiopeia", 69, Some(Role::Mid));
    assert_eq!(applied_plans(&swapped), vec!["authored:Cassiopeia:reference"]);
    h.finish(&swapped, verified());
    assert!(h.lock_and_wait("Ahri", 103, Some(Role::Mid)).is_empty(), "already applied in this session");

    let explicit = h.send(Event::Reapply);
    let [Effect::Apply(identity)] = explicit.as_slice() else { panic!("{explicit:?}") };
    assert!(identity.explicit && identity.plan_id == "meta:Ahri:mid:opgg");

    let mut h = Harness::in_champ_select();
    let mid = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.finish(&mid, verified());
    assert_eq!(applied_plans(&h.lock_and_wait("Ahri", 103, Some(Role::Support))), vec!["meta:Ahri:support:opgg"], "role change");
}

#[test]
fn a_new_selection_session_allows_the_same_champion_again() {
    let mut h = Harness::in_champ_select();
    let first = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.finish(&first, verified());
    h.send(Event::Phase("Lobby".into()));
    h.send(Event::Phase("ChampSelect".into()));
    assert_eq!(applied_plans(&h.lock_and_wait("Ahri", 103, Some(Role::Mid))), vec!["meta:Ahri:mid:opgg"]);

    let mut h = Harness::in_champ_select();
    let first = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.finish(&first, verified());
    h.send(Event::Session { game_id: 901, pick: Some(pick("Ahri", 103, Some(Role::Mid))) });
    let again = h.after(1600);
    let [Effect::Apply(identity)] = again.as_slice() else { panic!("{again:?}") };
    assert_ne!(identity.session, first_session(&first), "a new game id is a new selection session");
}

fn first_session(effects: &[Effect]) -> rbl_core::auto_import::SessionKey {
    let [Effect::Apply(identity)] = effects else { unreachable!() };
    identity.session
}

#[test]
fn account_changes_game_start_and_unknown_phases_block_imports() {
    let mut h = Harness::in_champ_select();
    let pending = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.send(Event::ClientFound { account: 7 });
    assert_eq!(h.machine.status(), Status::Connected { phase: "None".into() });
    assert!(h.finish(&pending, verified()).is_empty());
    assert!(h.lock_and_wait("Ahri", 103, Some(Role::Mid)).is_empty(), "no champ-select context for the new account yet");

    for phase in ["InProgress", "GameStart", "Reconnect", "SomethingNew"] {
        let mut h = Harness::in_champ_select();
        h.lock("Ahri", 103, Some(Role::Mid));
        h.send(Event::Phase(phase.into()));
        assert!(h.after(2000).is_empty(), "{phase}");
        assert!(h.send(Event::Reapply).is_empty(), "{phase}");
    }

    let mut h = Harness::in_champ_select();
    h.lock("Ahri", 103, Some(Role::Mid));
    h.send(Event::ClientLost);
    assert!(h.after(2000).is_empty());
    assert_eq!(h.machine.status(), Status::LeagueClosed);
}

#[test]
fn uncertain_or_rejected_results_need_attention_and_are_never_retried_automatically() {
    for outcome in [
        ApplyOutcome::Partial { error: CoreError::PartialApply { failures: "items".into() }, backup: PathBuf::new() },
        ApplyOutcome::Partial { error: CoreError::ReadbackMismatch, backup: PathBuf::new() },
        ApplyOutcome::Rejected { error: CoreError::RuneCapacity },
        ApplyOutcome::RolledBack { error: CoreError::Rejected { status: 500 }, backup: PathBuf::new() },
    ] {
        let mut h = Harness::in_champ_select();
        let effects = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
        h.finish(&effects, outcome.clone());
        let Status::NeedsAttention { error } = h.machine.status() else { panic!("{outcome:?}") };
        assert_eq!(
            Some(&error),
            match &outcome {
                ApplyOutcome::Partial { error, .. } | ApplyOutcome::Rejected { error } | ApplyOutcome::RolledBack { error, .. } =>
                    Some(error),
                _ => None,
            }
        );
        assert!(h.after(5000).is_empty());
        assert!(h.lock_and_wait("Cassiopeia", 69, Some(Role::Mid)).is_empty(), "no further automatic writes this session");
        assert_eq!(applied_plans(&h.send(Event::Reapply)), vec!["authored:Cassiopeia:reference"], "the user may retry explicitly");
    }

    let mut h = Harness::in_champ_select();
    let effects = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.finish(&effects, ApplyOutcome::AppliedUnverified { backup: PathBuf::new() });
    assert_eq!(h.machine.status(), Status::Applied { plan_id: "meta:Ahri:mid:opgg".into(), verified: false });
}

#[test]
fn missing_builds_wait_for_a_choice_instead_of_guessing() {
    let mut h = Harness::in_champ_select();
    assert!(h.lock_and_wait("Zed", 238, Some(Role::Mid)).is_empty());
    assert_eq!(h.machine.status(), Status::NeedsAttention { error: CoreError::NoBuildForRole });
    assert!(h.after(5000).is_empty());
    h.builds.insert(("Zed".into(), Some(Role::Mid)), "authored:Zed:reference".into());
    assert_eq!(applied_plans(&h.send(Event::PrefsChanged)), vec!["authored:Zed:reference"]);

    let mut h = Harness::in_champ_select();
    assert!(h.lock_and_wait("Ahri", 103, None).is_empty(), "blind pick has no role to choose a build for");
    assert_eq!(h.machine.status(), Status::NeedsAttention { error: CoreError::NoBuildForRole });
}

#[test]
fn a_data_revision_change_never_reapplies_in_the_same_session() {
    let mut h = Harness::in_champ_select();
    let effects = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.finish(&effects, verified());
    h.revision = "rev-b".into();
    h.send(Event::PrefsChanged);
    assert!(h.after(2000).is_empty());
    let explicit = h.send(Event::Reapply);
    let [Effect::Apply(identity)] = explicit.as_slice() else { panic!() };
    assert_eq!(identity.revision, "rev-b", "an explicit reapply uses the new revision");
}

#[test]
fn pause_stops_polling_and_writes_and_resume_keeps_session_memory() {
    let mut h = Harness::in_champ_select();
    let effects = h.lock_and_wait("Ahri", 103, Some(Role::Mid));
    h.send(Event::Pause);
    assert_eq!((h.machine.status(), h.machine.poll_interval()), (Status::Paused, None));
    h.finish(&effects, verified());
    assert!(h.lock_and_wait("Cassiopeia", 69, Some(Role::Mid)).is_empty());
    assert!(h.send(Event::Reapply).is_empty());
    h.send(Event::Resume);
    assert!(h.lock_and_wait("Ahri", 103, Some(Role::Mid)).is_empty(), "the apply that finished while paused is remembered");
    assert_eq!(applied_plans(&h.lock_and_wait("Cassiopeia", 69, Some(Role::Mid))), vec!["authored:Cassiopeia:reference"]);

    h.send(Event::Disable);
    assert_eq!((h.machine.status(), h.machine.poll_interval()), (Status::Disabled, None));
    h.send(Event::Enable);
    assert_eq!(h.machine.status(), Status::Connecting);
}

#[test]
fn chooses_preferences_first_then_only_an_opted_in_role_specific_meta_plan() {
    let mut prefs = Preferences::default();
    let default = |plan: &str| DefaultBuild { plan_id: plan.into(), patch: "26.20".into(), bundle_sha256: "x".into(), bundle: json!({}) };
    prefs.defaults.insert("Ahri|mid".into(), default("experiment:Ahri:odd"));
    let meta = |champion: &str, role: Role| Some(format!("meta:{champion}:{}:opgg", role.as_str()));
    let ahri = |role| pick("Ahri", 103, role);
    assert_eq!(choose_build(&prefs, &ahri(Some(Role::Mid)), meta).as_deref(), Some("experiment:Ahri:odd"), "an explicit choice wins");
    assert_eq!(choose_build(&prefs, &ahri(Some(Role::Support)), meta), None, "meta fallback is off by default");
    prefs.auto_import.meta_fallback = true;
    assert_eq!(choose_build(&prefs, &ahri(Some(Role::Support)), meta).as_deref(), Some("meta:Ahri:support:opgg"));
    assert_eq!(choose_build(&prefs, &ahri(None), meta), None, "never guess a role");
    assert_eq!(choose_build(&prefs, &ahri(Some(Role::Top)), |_, _| None), None, "no qualified meta plan for this role");
    prefs.needs_review.insert("Ahri|top".into(), default("authored:Ahri:x"));
    assert_eq!(choose_build(&prefs, &ahri(Some(Role::Top)), |_, _| None), None, "defaults needing review are not used");
}

#[allow(dead_code)]
fn _identity_is_cloneable(identity: &ApplyIdentity) -> ApplyIdentity {
    identity.clone()
}

#[test]
fn status_serializes_to_the_typescript_connection_state() {
    assert_eq!(Status::Disabled.to_json(), json!({"kind": "disabled"}));
    assert_eq!(Status::ChampSelect { champion: None, role: None }.to_json(), json!({"kind": "champ-select"}));
    assert_eq!(
        Status::ChampSelect { champion: Some("Ahri".into()), role: Some(Role::Adc) }.to_json(),
        json!({"kind": "champ-select", "champion": "Ahri", "role": "adc"})
    );
    assert_eq!(
        Status::Applied { plan_id: "meta:Ahri:mid:opgg".into(), verified: false }.to_json(),
        json!({"kind": "applied", "build": "meta:Ahri:mid:opgg", "verified": false})
    );
    let attention = Status::NeedsAttention { error: CoreError::RuneCapacity }.to_json();
    assert_eq!(attention["code"], "rune-capacity");
    assert!(attention["recovery"].as_str().unwrap().contains("rune page slot"));
    for status in [Status::Connecting, Status::LeagueClosed, Status::Applying, Status::Paused, Status::Connected { phase: "Lobby".into() }]
    {
        let kind = status.to_json()["kind"].as_str().unwrap().to_owned();
        assert!(["connecting", "league-closed", "applying", "paused", "connected"].contains(&kind.as_str()));
    }
}
