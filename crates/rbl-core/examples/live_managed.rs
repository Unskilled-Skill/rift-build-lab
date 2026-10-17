//! Read-only dump of Rift Build Lab's *own* managed rune page and item sets (plan T23), for comparing
//! what League stores with what was written. Personal pages and sets are never printed. GET only.

use std::num::NonZeroU64;

use rbl_core::lcu::LocalClientSource;
use rbl_core::lcu::transport::{Lcu, LcuRequest};
use rbl_core::monitor::ClientSource;
use serde_json::{Value, json};

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let client = match LocalClientSource::default().connect() {
        Ok(c) => c,
        Err(e) => return println!("{}", json!({"error": e.code()})),
    };
    let pages = client.call(LcuRequest::GetPages).await.ok().and_then(|p| p.as_array().cloned()).unwrap_or_default();
    let managed_pages: Vec<Value> = pages.into_iter().filter(|p| p["name"] == "Rift Build Lab").collect();
    let summoner = client.call(LcuRequest::GetSummoner).await.ok().and_then(|s| s["summonerId"].as_u64()).and_then(NonZeroU64::new);
    let mut managed_sets = Vec::new();
    if let Some(summoner) = summoner
        && let Ok(sets) = client.call(LcuRequest::GetItemSets { summoner }).await
    {
        managed_sets = sets["itemSets"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|s| s["title"].as_str().is_some_and(|t| t.starts_with("Rift Build Lab")))
            .cloned()
            .collect();
    }
    println!("{}", serde_json::to_string_pretty(&json!({"pages": managed_pages, "itemSets": managed_sets})).unwrap());
}
