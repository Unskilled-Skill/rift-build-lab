//! Rift Build Lab native core.
//!
//! Everything here is testable without a window: bundle validation, the League Client
//! boundary, managed writes, the auto-import state machine and data revisions. The Tauri
//! application crate only wires these modules to IPC, tray and window lifecycle.

pub mod apply;
pub mod backup;
pub mod bundle;
pub mod catalog;
pub mod error;
pub mod fsx;
pub mod json;
pub mod lcu;

pub use error::CoreError;

/// Name of the one managed rune page and the prefix of managed item-set titles.
pub const MANAGED_NAME: &str = "Rift Build Lab";
