//! Local backups of the player's League settings, written before every managed change.
//!
//! The format matches the companion's (`format: 1`) so existing backups stay readable. Client
//! credentials are never part of a backup.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;

use crate::CoreError;
use crate::fsx::atomic_write_json;

#[derive(Debug, Clone, Copy)]
pub struct Backup<'a> {
    pub summoner_id: u64,
    /// Original item sets, or `None` when items were not part of the change.
    pub item_sets: Option<&'a Value>,
    /// Original rune pages (empty when runes were not part of the change).
    pub rune_pages: &'a Value,
    /// The validated bundle being applied.
    pub bundle: &'a Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile<'a> {
    format: u8,
    created_at: String,
    summoner_id: u64,
    item_sets: Option<&'a Value>,
    rune_pages: &'a Value,
    bundle: &'a Value,
}

/// Default folder: `%LOCALAPPDATA%\RiftBuildLab\backups`.
pub fn default_backup_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|base| PathBuf::from(base).join("RiftBuildLab").join("backups"))
}

/// Returns (`isoformat()` with `+00:00`, `YYYYMMDDTHHMMSS`) for a UTC instant, as Python formats them.
pub fn format_utc(time: SystemTime) -> (String, String) {
    let since = time.duration_since(UNIX_EPOCH).unwrap_or_default();
    let (days, seconds) = ((since.as_secs() / 86_400) as i64, since.as_secs() % 86_400);
    // Civil-from-days (Howard Hinnant), proleptic Gregorian calendar.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    let (hour, minute, second) = (seconds / 3600, seconds / 60 % 60, seconds % 60);
    let micros = since.subsec_micros();
    let fraction = if micros == 0 { String::new() } else { format!(".{micros:06}") };
    (
        format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}{fraction}+00:00"),
        format!("{year:04}{month:02}{day:02}T{hour:02}{minute:02}{second:02}"),
    )
}

/// Atomically writes a uniquely named backup into `dir` and returns its path.
pub fn write_backup(dir: &Path, backup: &Backup<'_>) -> Result<PathBuf, CoreError> {
    let (created_at, stamp) = format_utc(SystemTime::now());
    let path = dir.join(format!("{stamp}-{}.json", uuid::Uuid::new_v4().simple()));
    let file = BackupFile {
        format: 1,
        created_at,
        summoner_id: backup.summoner_id,
        item_sets: backup.item_sets,
        rune_pages: backup.rune_pages,
        bundle: backup.bundle,
    };
    atomic_write_json(&path, &file).map_err(|_| CoreError::BackupFailed)?;
    Ok(path)
}
