//! Validation of items + runes bundles (`CompanionBundle` v1) before any League write.
//!
//! A line-for-line behavioural port of `validate_bundle` and `load_input` in
//! `companion/core.py`, checked against `tests/fixtures/bundle-parity.json`. The frontend
//! validates too, but nothing reaching the native boundary is trusted.

use std::collections::HashSet;
use std::path::Path;

use serde_json::{Map, Value};
use uuid::Uuid;

use crate::catalog::Catalog;
use crate::json::{MAX_INPUT, parse_strict};
use crate::{CoreError, MANAGED_NAME};

const INVALID: &str = "Invalid build bundle.";

/// A bundle that passed validation, with its managed item-set id and catalog labels applied.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidBundle(Value);

impl ValidBundle {
    pub fn value(&self) -> &Value {
        &self.0
    }
    pub fn into_value(self) -> Value {
        self.0
    }
    pub fn champion_id(&self) -> i64 {
        self.0["championId"].as_i64().expect("validated")
    }
    pub fn data_version(&self) -> &str {
        self.0["dataVersion"].as_str().expect("validated")
    }
    pub fn item_set(&self) -> &Value {
        &self.0["itemSet"]
    }
    pub fn rune_page(&self) -> &Value {
        &self.0["runePage"]
    }
}

/// Deterministic item-set id: one managed set per champion.
pub fn managed_uid(champion_id: i64) -> String {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, format!("https://riftbuildlab.local/item-set/{champion_id}").as_bytes()).to_string()
}

fn require(condition: bool, reason: &'static str) -> Result<(), CoreError> {
    if condition { Ok(()) } else { Err(CoreError::invalid(reason)) }
}

fn object<'a>(value: &'a Value, required: &[&str], optional: &[&str]) -> Result<&'a Map<String, Value>, CoreError> {
    let map = value.as_object().ok_or(CoreError::invalid(INVALID))?;
    let ok = required.iter().all(|k| map.contains_key(*k))
        && map.keys().all(|k| required.contains(&k.as_str()) || optional.contains(&k.as_str()));
    require(ok, INVALID)?;
    Ok(map)
}

/// Python `type(v) is int and low <= v <= high`: booleans and floats are never integers.
fn integer(value: &Value, low: i128, high: i128) -> Result<i64, CoreError> {
    let n = match value {
        Value::Number(n) if n.is_i64() => n.as_i64().map(i128::from),
        Value::Number(n) if n.is_u64() => n.as_u64().map(i128::from),
        _ => None,
    };
    match n {
        Some(n) if (low..=high).contains(&n) => i64::try_from(n).map_err(|_| CoreError::invalid(INVALID)),
        _ => Err(CoreError::invalid(INVALID)),
    }
}

/// Python `0 < len(v.strip()) <= limit and no ord(c) < 32`, counting code points.
fn short_text(value: &Value, limit: usize) -> Result<&str, CoreError> {
    let text = value.as_str().ok_or(CoreError::invalid(INVALID))?;
    let length = text.trim().chars().count();
    require(length > 0 && length <= limit && !text.chars().any(|c| (c as u32) < 32), INVALID)?;
    Ok(text)
}

/// Accepts the textual UUID forms Python's `uuid.UUID` accepts for ordinary input
/// (optional `urn:`/`uuid:` prefix, braces, hyphens). Exotic forms Python's `int()` would
/// tolerate (signs, underscores, inner whitespace) are rejected; the id is replaced anyway.
fn valid_uuid(value: &Value) -> bool {
    let Some(text) = value.as_str() else { return false };
    let hex: String = text.replace("urn:", "").replace("uuid:", "").trim_matches(|c| c == '{' || c == '}').replace('-', "");
    hex.len() == 32 && hex.chars().all(|c| c.is_ascii_hexdigit())
}

fn ids(slot: &crate::catalog::Slot) -> HashSet<i64> {
    slot.runes.iter().map(|r| r.id).collect()
}

/// Validates an untrusted bundle against the active catalog.
pub fn validate(bundle: &Value, catalog: &Catalog) -> Result<ValidBundle, CoreError> {
    let top = object(
        bundle,
        &["version", "patch", "dataVersion", "championId", "championAlias", "buildName", "itemSet", "runePage", "labels"],
        &[],
    )?;
    require(integer(&top["version"], 1, 1).is_ok(), "Unsupported build format.")?;
    require(
        top["patch"] == catalog.patch.as_str() && top["dataVersion"] == catalog.data_version.as_str(),
        "This build uses a different data patch. Export it again from the current website.",
    )?;
    let champion_id = integer(&top["championId"], 1, 2_147_483_647)?;
    let champion = catalog.champion(champion_id);
    require(champion.is_some_and(|c| top["championAlias"] == c.alias.as_str()), "Champion ID and alias do not match the bundled catalog.")?;
    short_text(&top["buildName"], 120)?;

    let item_set = object(
        &top["itemSet"],
        &["title", "associatedMaps", "associatedChampions", "map", "mode", "type", "sortrank", "blocks"],
        &["uid"],
    )?;
    require(short_text(&item_set["title"], 120)?.starts_with(MANAGED_NAME), INVALID)?;
    let only_int = |value: &Value, expected: i64| {
        value.as_array().is_some_and(|a| a.len() == 1 && integer(&a[0], expected.into(), expected.into()).is_ok())
    };
    require(
        only_int(&item_set["associatedMaps"], 11)
            && only_int(&item_set["associatedChampions"], champion_id)
            && item_set["map"] == "SR"
            && item_set["mode"] == "any"
            && item_set["type"] == "custom",
        INVALID,
    )?;
    integer(&item_set["sortrank"], 0, 0)?;
    if let Some(uid) = item_set.get("uid") {
        require(valid_uuid(uid), "Invalid item set identifier.")?;
    }
    let blocks = item_set["blocks"].as_array().filter(|b| (1..=20).contains(&b.len())).ok_or(CoreError::invalid(INVALID))?;
    let mut item_labels = Map::new();
    for block in blocks {
        let block = object(block, &["type", "items"], &[])?;
        short_text(&block["type"], 80)?;
        let items = block["items"].as_array().filter(|i| (1..=30).contains(&i.len())).ok_or(CoreError::invalid(INVALID))?;
        for item in items {
            let item = object(item, &["id", "count"], &[])?;
            let name = item["id"]
                .as_str()
                .and_then(|id| catalog.item_name(id))
                .ok_or(CoreError::invalid("An item is absent from the bundled catalog."))?;
            integer(&item["count"], 1, 9)?;
            item_labels.insert(item["id"].as_str().expect("checked").to_owned(), Value::from(name));
        }
    }

    let page = object(&top["runePage"], &["name", "primaryStyleId", "subStyleId", "selectedPerkIds", "current"], &[])?;
    require(page["name"] == MANAGED_NAME && page["current"] == Value::Bool(true), INVALID)?;
    let primary_id = integer(&page["primaryStyleId"], 1, 2_147_483_647)?;
    let secondary_id = integer(&page["subStyleId"], 1, 2_147_483_647)?;
    let (primary, secondary) = match (catalog.tree(primary_id), catalog.tree(secondary_id)) {
        (Some(p), Some(s)) if primary_id != secondary_id => (p, s),
        _ => return Err(CoreError::invalid("Choose two different legal rune trees.")),
    };
    let perks = page["selectedPerkIds"].as_array().filter(|p| p.len() == 9).ok_or(CoreError::invalid(INVALID))?;
    let perks = perks.iter().map(|p| integer(p, 1, 2_147_483_647)).collect::<Result<Vec<_>, _>>()?;
    require(
        primary.slots.len() >= 4 && (0..4).all(|n| ids(&primary.slots[n]).contains(&perks[n])),
        "Primary runes must include one rune from each row.",
    )?;
    let rows: Vec<HashSet<i64>> = secondary.slots.iter().skip(1).map(ids).collect();
    let row = |perk: i64| rows.iter().position(|r| r.contains(&perk));
    require(
        matches!((row(perks[4]), row(perks[5])), (Some(a), Some(b)) if a != b),
        "Secondary runes must come from two different minor rows.",
    )?;
    require((0..3).all(|n| catalog.shard_rows[n].contains(&perks[n + 6])), "A stat shard is invalid for its row.")?;

    // Labels are untrusted presentation hints. Replace them with catalog names.
    let labels = object(&top["labels"], &["items", "runes"], &[])?;
    require(labels.values().all(|v| v.as_object().is_some_and(|m| m.len() <= 300)), INVALID)?;

    let mut result = bundle.clone();
    result["itemSet"]["uid"] = Value::from(managed_uid(champion_id));
    let rune_labels: Map<String, Value> = perks
        .iter()
        .map(|p| (p.to_string(), Value::from(catalog.rune_name(*p).map(str::to_owned).unwrap_or_else(|| p.to_string()))))
        .collect();
    result["labels"] = serde_json::json!({"items": item_labels, "runes": rune_labels});
    Ok(ValidBundle(result))
}

/// Browser downloads may append ` (n)` before the extension on repeat downloads.
fn is_bundle_filename(name: &str) -> bool {
    let lower = name.to_lowercase();
    let Some(stem) = lower.strip_suffix(".json") else { return false };
    if stem.ends_with(".riftbuild") {
        return true;
    }
    let Some((prefix, counter)) = stem.strip_suffix(')').and_then(|s| s.rsplit_once(" (")) else { return false };
    prefix.ends_with(".riftbuild") && counter.starts_with(|c: char| ('1'..='9').contains(&c)) && counter.chars().all(|c| c.is_ascii_digit())
}

/// Reads an untrusted `.riftbuild.json` file (not yet validated against a catalog).
pub fn load_file(path: &Path) -> Result<Value, CoreError> {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    require(is_bundle_filename(name), "Choose an items + runes .riftbuild.json file.")?;
    let unreadable = || CoreError::invalid("Could not read this build import.");
    let size = std::fs::metadata(path).map_err(|_| unreadable())?.len();
    require(size <= MAX_INPUT as u64, "The build file is too large.")?;
    let raw = std::fs::read(path).map_err(|_| unreadable())?;
    parse_bytes(&raw)
}

/// Decodes and parses at most [`MAX_INPUT`] bytes of UTF-8 (an initial BOM is ignored).
pub fn parse_bytes(raw: &[u8]) -> Result<Value, CoreError> {
    require(raw.len() <= MAX_INPUT, INVALID)?;
    let raw = raw.strip_prefix(b"\xef\xbb\xbf").unwrap_or(raw);
    let text = std::str::from_utf8(raw).map_err(|_| CoreError::invalid("Could not read this build import."))?;
    parse_strict(text)
}
