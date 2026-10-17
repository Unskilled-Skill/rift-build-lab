//! Read-only champ-select observer for live verification (plan T23).
//!
//! `cargo run -p rbl-core --example live_champ_select -- <seconds>` polls the gameflow phase once a
//! second and, during champion select, prints what the reducer derives plus the session's field
//! structure (key names only) so provisional fixtures can be checked. GET requests only; no IDs,
//! names, credentials or URLs are printed.

use std::collections::BTreeSet;
use std::time::{Duration, Instant};

use rbl_core::lcu::LocalClientSource;
use rbl_core::lcu::champ_select::reduce;
use rbl_core::lcu::transport::{Lcu, LcuRequest};
use rbl_core::monitor::ClientSource;
use serde_json::Value;

fn keys(value: Option<&Value>) -> Vec<String> {
    value.and_then(Value::as_object).map(|m| m.keys().cloned().collect()).unwrap_or_default()
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let seconds: u64 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(240);
    let client = match LocalClientSource::default().connect() {
        Ok(c) => c,
        Err(e) => return println!("connect failed: {}", e.code()),
    };
    let deadline = Instant::now() + Duration::from_secs(seconds);
    let (mut last_phase, mut last_view, mut shape_printed) = (String::new(), None, false);
    while Instant::now() < deadline {
        let phase = client.call(LcuRequest::GetPhase).await.ok().and_then(|p| p.as_str().map(str::to_owned)).unwrap_or_else(|| "?".into());
        if phase != last_phase {
            println!("[{:>4}s] phase: {phase}", seconds - deadline.saturating_duration_since(Instant::now()).as_secs());
            last_phase.clone_from(&phase);
        }
        if phase == "ChampSelect"
            && let Ok(session) = client.call(LcuRequest::GetChampSelectSession).await
        {
            if !shape_printed {
                shape_printed = true;
                println!("session keys: {:?}", keys(Some(&session)));
                println!("myTeam[0] keys: {:?}", keys(session["myTeam"].get(0)));
                let action_keys: BTreeSet<String> = session["actions"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_array)
                    .flatten()
                    .flat_map(|a| keys(Some(a)))
                    .collect();
                println!("action keys: {action_keys:?}");
                let types: BTreeSet<&str> = session["actions"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_array)
                    .flatten()
                    .filter_map(|a| a["type"].as_str())
                    .collect();
                println!(
                    "action types: {types:?}; localPlayerCellId is number: {}; gameId nonzero: {}",
                    session["localPlayerCellId"].is_i64(),
                    session["gameId"].as_u64().is_some_and(|g| g > 0)
                );
            }
            let view = reduce(&session).map(|v| (v.champion_id.is_some(), v.role));
            if view != last_view {
                println!("  reducer: understood={} locked={:?} role={:?}", view.is_some(), view.map(|v| v.0), view.and_then(|v| v.1));
                last_view = view;
            }
        }
        if phase == "InProgress" || phase == "GameStart" {
            println!("game started; stopping observer");
            break;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
