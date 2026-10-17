//! Read-only fingerprint of the player's own League settings (plan T23).
//!
//! `cargo run -p rbl-core --example live_snapshot` prints SHA-256 fingerprints of every rune page and
//! item set that Rift Build Lab does not manage, plus counts and the gameflow phase. Comparing the
//! output before and after an import shows personal settings were left untouched without printing
//! names, identifiers or contents. GET requests only.

use std::num::NonZeroU64;

use rbl_core::lcu::LocalClientSource;
use rbl_core::lcu::transport::{Lcu, LcuRequest};
use rbl_core::monitor::ClientSource;
use serde_json::Value;
use sha2::{Digest, Sha256};

fn fingerprint(values: &[&Value]) -> String {
    let mut hasher = Sha256::new();
    for value in values {
        hasher.update(serde_json::to_vec(value).expect("JSON values serialize"));
        hasher.update(b"\n");
    }
    hasher.finalize().iter().take(8).map(|b| format!("{b:02x}")).collect()
}

/// Page fields the player controls (ignores volatile flags such as `current` or timestamps).
fn page_core(page: &Value) -> Value {
    serde_json::json!({"id": page["id"], "name": page["name"], "primaryStyleId": page["primaryStyleId"], "subStyleId": page["subStyleId"], "selectedPerkIds": page["selectedPerkIds"]})
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let client = match LocalClientSource::default().connect() {
        Ok(c) => c,
        Err(e) => return println!("connect failed: {}", e.code()),
    };
    let phase = client.call(LcuRequest::GetPhase).await.ok().and_then(|p| p.as_str().map(str::to_owned)).unwrap_or_else(|| "?".into());
    println!("phase: {phase}");
    let pages = client.call(LcuRequest::GetPages).await.ok().and_then(|p| p.as_array().cloned()).unwrap_or_default();
    let (managed, personal): (Vec<&Value>, Vec<&Value>) =
        pages.iter().partition(|p| p["name"] == "Rift Build Lab" && p["isEditable"] == true);
    let personal_cores: Vec<Value> = personal.iter().map(|p| page_core(p)).collect();
    println!(
        "rune pages: {} personal (fingerprint {}), {} managed",
        personal.len(),
        fingerprint(&personal_cores.iter().collect::<Vec<_>>()),
        managed.len()
    );
    let current_is_managed = pages.iter().any(|p| p["current"] == true && p["name"] == "Rift Build Lab");
    println!("current rune page is the managed page: {current_is_managed}");
    let summoner = client.call(LcuRequest::GetSummoner).await.ok().and_then(|s| s["summonerId"].as_u64()).and_then(NonZeroU64::new);
    if let Some(summoner) = summoner {
        let sets = client.call(LcuRequest::GetItemSets { summoner }).await.ok();
        let list = sets.as_ref().and_then(|s| s["itemSets"].as_array()).cloned().unwrap_or_default();
        let (managed, personal): (Vec<&Value>, Vec<&Value>) =
            list.iter().partition(|s| s["title"].as_str().is_some_and(|t| t.starts_with("Rift Build Lab")));
        println!("item sets: {} personal (fingerprint {}), {} managed", personal.len(), fingerprint(&personal), managed.len());
        for set in managed {
            let blocks = set["blocks"].as_array().map_or(0, Vec::len);
            println!(
                "  managed set: {} blocks, champions {}, uid present {}",
                blocks,
                set["associatedChampions"],
                set.get("uid").is_some()
            );
        }
    } else {
        println!("item sets: not signed in");
    }
}
