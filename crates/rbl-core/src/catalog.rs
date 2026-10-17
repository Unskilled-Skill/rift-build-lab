//! The champion/item/rune subset needed to validate League imports.
//!
//! Desktop validates against the catalog of its active data revision (`catalog.json`), filtered
//! exactly like `scripts/prepare-companion-data.mjs` builds `companion/catalog.json`.

use std::collections::HashMap;

use serde::Deserialize;

use crate::CoreError;

/// Stat-shard rows (offense, flex, defense) accepted by League.
pub const SHARD_ROWS: [[i64; 3]; 3] = [[5005, 5007, 5008], [5008, 5010, 5001], [5011, 5013, 5001]];

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Champion {
    pub id: i64,
    pub alias: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Item {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct RuneRef {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Slot {
    pub runes: Vec<RuneRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Tree {
    pub id: i64,
    pub name: String,
    pub slots: Vec<Slot>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Catalog {
    pub patch: String,
    pub data_version: String,
    pub champions: Vec<Champion>,
    pub items: Vec<Item>,
    pub trees: Vec<Tree>,
    pub shard_rows: [[i64; 3]; 3],
    item_names: HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompanionCatalog {
    patch: String,
    data_version: String,
    champions: Vec<Champion>,
    items: Vec<Item>,
    trees: Vec<Tree>,
    shard_rows: [[i64; 3]; 3],
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishedItem {
    id: i64,
    name: String,
    maps: HashMap<String, bool>,
    shop_listed_by_source: bool,
}

#[derive(Deserialize)]
struct PublishedCatalog {
    patch: String,
    version: String,
    champions: Vec<Champion>,
    items: Vec<PublishedItem>,
    trees: Vec<Tree>,
}

const INVALID: CoreError =
    CoreError::DataIncompatible { reason: "The installed build data is invalid. Check for data updates or reinstall Rift Build Lab." };

/// Items with these six-digit prefixes are mode-specific variants, never Summoner's Rift exports.
fn mode_variant(id: i64) -> bool {
    (320_000..330_000).contains(&id) || (660_000..670_000).contains(&id)
}

impl Catalog {
    fn new(
        patch: String,
        data_version: String,
        champions: Vec<Champion>,
        items: Vec<Item>,
        trees: Vec<Tree>,
        shard_rows: [[i64; 3]; 3],
    ) -> Self {
        let item_names = items.iter().map(|i| (i.id.to_string(), i.name.clone())).collect();
        Catalog { patch, data_version, champions, items, trees, shard_rows, item_names }
    }

    /// Parses the companion's reduced catalog format.
    pub fn from_companion_json(text: &str) -> Result<Self, CoreError> {
        let c: CompanionCatalog = serde_json::from_str(text).map_err(|_| INVALID)?;
        Ok(Self::new(c.patch, c.data_version, c.champions, c.items, c.trees, c.shard_rows))
    }

    /// Parses the published website catalog, keeping only Summoner's Rift shop items.
    pub fn from_published_json(text: &str) -> Result<Self, CoreError> {
        let c: PublishedCatalog = serde_json::from_str(text).map_err(|_| INVALID)?;
        let items = c
            .items
            .into_iter()
            .filter(|i| i.maps.get("11").copied().unwrap_or(false) && i.shop_listed_by_source && !mode_variant(i.id))
            .map(|i| Item { id: i.id, name: i.name })
            .collect();
        Ok(Self::new(c.patch, c.version, c.champions, items, c.trees, SHARD_ROWS))
    }

    pub fn champion(&self, id: i64) -> Option<&Champion> {
        self.champions.iter().find(|c| c.id == id)
    }

    pub fn tree(&self, id: i64) -> Option<&Tree> {
        self.trees.iter().find(|t| t.id == id)
    }

    /// Item name by its League string identifier.
    pub fn item_name(&self, id: &str) -> Option<&str> {
        self.item_names.get(id).map(String::as_str)
    }

    /// Rune and shard display names by perk identifier.
    pub fn rune_name(&self, id: i64) -> Option<&str> {
        let shard = match id {
            5005 => Some("Attack speed"),
            5007 => Some("Ability haste"),
            5008 => Some("Adaptive force"),
            5010 => Some("Move speed"),
            5001 => Some("Scaling health"),
            5011 => Some("Health"),
            5013 => Some("Tenacity and slow resistance"),
            _ => None,
        };
        shard.or_else(|| self.trees.iter().flat_map(|t| &t.slots).flat_map(|s| &s.runes).find(|r| r.id == id).map(|r| r.name.as_str()))
    }
}
