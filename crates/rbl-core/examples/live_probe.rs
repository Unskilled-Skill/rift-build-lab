//! Read-only League Client diagnostic for live verification (plan T23).
//!
//! `cargo run -p rbl-core --example live_probe` discovers the running client, connects through
//! the production Riot-root TLS transport and performs GET requests only. It prints counts and
//! yes/no answers, never credentials, account identifiers, URLs or page/item-set names.

use rbl_core::lcu::LocalClientSource;
use rbl_core::lcu::champ_select::reduce;
use rbl_core::lcu::transport::{Lcu, LcuRequest};
use rbl_core::monitor::ClientSource;
use serde_json::Value;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let client = match LocalClientSource::default().connect() {
        Ok(client) => client,
        Err(error) => return println!("discovery/TLS setup: FAILED ({})", error.code()),
    };
    println!("discovery: ok (lockfile found, credentials kept in memory)");
    let get = |request| client.call(request);
    match get(LcuRequest::GetGameVersion).await {
        Ok(Value::String(version)) => println!("tls + game version: ok ({version})"),
        Ok(other) => println!("tls + game version: unexpected shape ({})", kind(&other)),
        Err(e) => return println!("tls + game version: FAILED ({}, ambiguous={})", e.error.code(), e.ambiguous),
    }
    let phase = get(LcuRequest::GetPhase).await;
    println!(
        "gameflow phase: {}",
        phase.as_ref().map(|p| p.as_str().unwrap_or("?").to_owned()).unwrap_or_else(|e| format!("FAILED ({})", e.error.code()))
    );
    let summoner = get(LcuRequest::GetSummoner).await.ok();
    let signed_in = summoner.as_ref().and_then(|s| s.get("summonerId")).and_then(Value::as_u64).filter(|id| *id > 0);
    println!("signed in: {}", if signed_in.is_some() { "yes" } else { "no" });
    match get(LcuRequest::GetPages).await {
        Ok(Value::Array(pages)) => {
            let managed = pages.iter().filter(|p| p["name"] == "Rift Build Lab" && p["isEditable"] == true).count();
            let editable = pages.iter().filter(|p| p["isEditable"] == true).count();
            let fields = pages.first().map(|p| {
                ["id", "name", "isEditable", "primaryStyleId", "subStyleId", "selectedPerkIds", "current"]
                    .iter()
                    .all(|k| p.get(*k).is_some())
            });
            println!("rune pages: {} total, {editable} editable, {managed} managed; expected fields present: {fields:?}", pages.len());
        }
        Ok(other) => println!("rune pages: unexpected shape ({})", kind(&other)),
        Err(e) => println!("rune pages: FAILED ({})", e.error.code()),
    }
    if let Some(id) = signed_in.and_then(std::num::NonZeroU64::new) {
        match get(LcuRequest::GetItemSets { summoner: id }).await {
            Ok(sets) => match sets.get("itemSets").and_then(Value::as_array) {
                Some(list) => {
                    let managed = list.iter().filter(|s| s["title"].as_str().is_some_and(|t| t.starts_with("Rift Build Lab"))).count();
                    println!(
                        "item sets: {} total, {managed} managed; uid field present: {}",
                        list.len(),
                        list.iter().all(|s| s.get("uid").is_some())
                    );
                }
                None => println!("item sets: unexpected shape (no itemSets list)"),
            },
            Err(e) => println!("item sets: FAILED ({})", e.error.code()),
        }
    }
    if phase.as_ref().ok().and_then(Value::as_str) == Some("ChampSelect") {
        match get(LcuRequest::GetChampSelectSession).await {
            Ok(session) => match reduce(&session) {
                Some(view) => println!(
                    "champ select: game id present={} locked champion={} role={:?}",
                    view.game_id > 0,
                    view.champion_id.is_some(),
                    view.role
                ),
                None => println!("champ select: session shape not understood (capture a sanitized fixture)"),
            },
            Err(e) => println!("champ select: FAILED ({})", e.error.code()),
        }
    }
}

fn kind(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
