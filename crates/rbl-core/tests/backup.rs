use std::path::Path;
use std::time::{Duration, UNIX_EPOCH};

use rbl_core::CoreError;
use rbl_core::backup::{Backup, format_utc, write_backup};
use rbl_core::fsx::atomic_write_json;
use serde::{Serialize, Serializer};
use serde_json::{Value, json};

struct Fails;
impl Serialize for Fails {
    fn serialize<S: Serializer>(&self, _: S) -> Result<S::Ok, S::Error> {
        Err(serde::ser::Error::custom("refuse"))
    }
}

fn names(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    names.sort();
    names
}

#[test]
fn atomic_writes_create_parents_replace_existing_files_and_leave_no_temporary_files() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("nested").join("preferences.json");
    atomic_write_json(&path, &json!({"schema": 1, "name": "café"})).unwrap();
    atomic_write_json(&path, &json!({"schema": 1, "name": "second"})).unwrap();
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(saved, json!({"schema": 1, "name": "second"}));
    assert_eq!(names(&dir.path().join("nested")), vec!["preferences.json"]);
}

#[test]
fn a_failed_write_keeps_the_previous_file_intact_and_cleans_up() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("preferences.json");
    atomic_write_json(&path, &json!({"keep": true})).unwrap();
    assert!(atomic_write_json(&path, &Fails).is_err());
    assert_eq!(std::fs::read_to_string(&path).unwrap().replace([' ', '\n', '\r'], ""), r#"{"keep":true}"#);
    assert_eq!(names(dir.path()), vec!["preferences.json"]);

    let blocker = dir.path().join("not-a-folder");
    std::fs::write(&blocker, "x").unwrap();
    assert!(atomic_write_json(&blocker.join("file.json"), &json!({})).is_err());

    // The final rename fails after the temporary file was written and synced: it must be removed.
    let occupied = dir.path().join("occupied.json");
    std::fs::create_dir(&occupied).unwrap();
    std::fs::write(occupied.join("inside"), "x").unwrap();
    assert!(atomic_write_json(&occupied, &json!({"x": 1})).is_err());
    assert_eq!(names(dir.path()), vec!["not-a-folder", "occupied.json", "preferences.json"]);
}

#[test]
fn formats_utc_timestamps_like_python_isoformat() {
    for (seconds, micros, iso, stamp) in [
        (0, 0, "1970-01-01T00:00:00+00:00", "19700101T000000"),
        (1_792_245_837, 123_456, "2026-10-17T14:03:57.123456+00:00", "20261017T140357"),
        (951_782_400, 1, "2000-02-29T00:00:00.000001+00:00", "20000229T000000"),
        (4_102_444_799, 999_999, "2099-12-31T23:59:59.999999+00:00", "20991231T235959"),
    ] {
        let time = UNIX_EPOCH + Duration::from_secs(seconds) + Duration::from_micros(micros);
        assert_eq!(format_utc(time), (iso.to_string(), stamp.to_string()));
    }
}

#[test]
fn backups_use_the_companion_format_unique_names_and_no_credentials() {
    let dir = tempfile::tempdir().unwrap();
    let sets = json!({"accountId": 12, "itemSets": [{"uid": "personal", "title": "Keep me"}]});
    let pages = json!([{"id": 12, "name": "Rift Build Lab"}]);
    let bundle = json!({"championAlias": "Cassiopeia"});
    let backup = Backup { summoner_id: 42, item_sets: Some(&sets), rune_pages: &pages, bundle: &bundle };
    let first = write_backup(dir.path(), &backup).unwrap();
    let second = write_backup(dir.path(), &Backup { item_sets: None, ..backup }).unwrap();
    assert_ne!(first, second);
    for path in [&first, &second] {
        let name = path.file_name().unwrap().to_str().unwrap();
        let (stamp, rest) = name.split_once('-').unwrap();
        assert!(stamp.len() == 15 && stamp.as_bytes()[8] == b'T', "{name}");
        assert!(rest.len() == 37 && rest.ends_with(".json") && rest[..32].bytes().all(|b| b.is_ascii_hexdigit()), "{name}");
    }
    let saved: Value = serde_json::from_str(&std::fs::read_to_string(&first).unwrap()).unwrap();
    let keys: Vec<&str> = saved.as_object().unwrap().keys().map(String::as_str).collect();
    assert_eq!(keys.len(), 6);
    for key in ["format", "createdAt", "summonerId", "itemSets", "runePages", "bundle"] {
        assert!(keys.contains(&key), "{key}");
    }
    assert_eq!((saved["format"].clone(), saved["summonerId"].clone(), saved["itemSets"].clone()), (json!(1), json!(42), sets));
    assert!(saved["createdAt"].as_str().unwrap().ends_with("+00:00"));
    let second: Value = serde_json::from_str(&std::fs::read_to_string(&second).unwrap()).unwrap();
    assert_eq!(second["itemSets"], Value::Null);
}

#[test]
fn an_unwritable_backup_folder_is_reported_as_backup_failed() {
    let dir = tempfile::tempdir().unwrap();
    let blocker = dir.path().join("file");
    std::fs::write(&blocker, "x").unwrap();
    let empty = json!([]);
    let backup = Backup { summoner_id: 1, item_sets: None, rune_pages: &empty, bundle: &empty };
    assert_eq!(write_backup(&blocker, &backup), Err(CoreError::BackupFailed));
}
