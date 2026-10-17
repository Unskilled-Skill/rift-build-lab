//! Errors shown to the user. Messages never include upstream response bodies, URLs,
//! credentials or operating-system error text (parity with `companion/core.py`).

use serde::Serialize;

/// Error codes shared with the TypeScript platform contract (`tests/fixtures/error-codes.json`).
pub const ERROR_CODES: [&str; 15] = [
    "client-unavailable",
    "tls",
    "not-signed-in",
    "unsafe-phase",
    "patch-mismatch",
    "rejected",
    "rune-capacity",
    "ambiguous-ownership",
    "partial-apply",
    "readback-mismatch",
    "backup-failed",
    "invalid-bundle",
    "no-build-for-role",
    "data-incompatible",
    "internal",
];

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum CoreError {
    #[error("League Client is not available. Open League of Legends and sign in, then retry.")]
    ClientUnavailable,
    #[error("Could not verify League Client's local certificate. Nothing was changed.")]
    Tls,
    #[error("Sign in to League Client before applying.")]
    NotSignedIn,
    #[error("Apply is unavailable during a game, reconnect, or an unknown client state. Return to the League lobby and retry.")]
    UnsafePhase { phase: String },
    #[error("Client and build patches differ. Update League or the build data before applying.")]
    PatchMismatch { client: String, data: String },
    #[error("The League Client rejected an operation (HTTP {status}). Retry once the client is ready.")]
    Rejected { status: u16 },
    #[error("The client rejected the rune page. Free a rune page slot and retry; no existing pages were deleted.")]
    RuneCapacity,
    #[error("Multiple editable Rift Build Lab rune pages exist. Rename extras in League Client before retrying.")]
    AmbiguousOwnership,
    #[error(
        "PARTIAL APPLY: automatic recovery could not restore {failures}. Check League Client before retrying. Your backup is saved locally."
    )]
    PartialApply { failures: String },
    #[error("League did not report the expected items or runes after applying. Check League Client before playing.")]
    ReadbackMismatch,
    #[error("Could not save a local backup. Nothing was applied. Check disk space and folder permissions.")]
    BackupFailed,
    /// `reason` is the exact companion message for this validation failure.
    #[error("{reason}")]
    InvalidBundle { reason: &'static str },
    #[error("No build is chosen for this champion and role. Choose build to continue.")]
    NoBuildForRole,
    #[error("{reason}")]
    DataIncompatible { reason: &'static str },
    #[error("Something went wrong inside Rift Build Lab. Nothing was changed.")]
    Internal,
}

impl CoreError {
    pub(crate) const fn invalid(reason: &'static str) -> Self {
        CoreError::InvalidBundle { reason }
    }

    /// Stable code matching the serialized `code` tag and the TypeScript `ErrorCode`.
    pub fn code(&self) -> &'static str {
        match self {
            CoreError::ClientUnavailable => "client-unavailable",
            CoreError::Tls => "tls",
            CoreError::NotSignedIn => "not-signed-in",
            CoreError::UnsafePhase { .. } => "unsafe-phase",
            CoreError::PatchMismatch { .. } => "patch-mismatch",
            CoreError::Rejected { .. } => "rejected",
            CoreError::RuneCapacity => "rune-capacity",
            CoreError::AmbiguousOwnership => "ambiguous-ownership",
            CoreError::PartialApply { .. } => "partial-apply",
            CoreError::ReadbackMismatch => "readback-mismatch",
            CoreError::BackupFailed => "backup-failed",
            CoreError::InvalidBundle { .. } => "invalid-bundle",
            CoreError::NoBuildForRole => "no-build-for-role",
            CoreError::DataIncompatible { .. } => "data-incompatible",
            CoreError::Internal => "internal",
        }
    }
}
