//! Rift Build Lab native core.
//!
//! Everything here is testable without a window: bundle validation, the League Client
//! boundary, managed writes, the auto-import state machine and data revisions. The Tauri
//! application crate only wires these modules to IPC, tray and window lifecycle.

pub mod apply;
pub mod auto_import;
pub mod backup;
pub mod bundle;
pub mod catalog;
pub mod data;
pub mod deeplink;
pub mod error;
pub mod fsx;
pub mod ipc;
pub mod json;
pub mod lcu;
pub mod library;
pub mod monitor;
pub mod net;
pub mod paths;
pub mod prefs;

pub use error::CoreError;

/// Name of the one managed rune page and the prefix of managed item-set titles.
pub const MANAGED_NAME: &str = "Rift Build Lab";
