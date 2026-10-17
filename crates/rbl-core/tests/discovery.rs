use std::path::PathBuf;

use rbl_core::CoreError;
use rbl_core::lcu::discovery::{candidate_dirs, discover_in};
use rbl_core::lcu::lockfile::parse_lockfile;

const INVALID: CoreError = CoreError::ClientUnavailable;

#[test]
fn parses_valid_lockfiles_and_never_exposes_the_password() {
    for (text, port) in [
        ("LeagueClient:1234:54321:VERY_SECRET:https", 54321),
        ("LeagueClientUx:1:1:a-b_C:https\r\n", 1),
        ("  LeagueClient:0007:65535:x:https  ", 65535),
    ] {
        let credentials = parse_lockfile(text).unwrap();
        assert_eq!(credentials.port(), port, "{text}");
        let shown = format!("{credentials:?}");
        assert!(!shown.contains("VERY_SECRET") && !shown.contains("a-b_C"), "{shown}");
        assert!(shown.contains("redacted"));
    }
}

#[test]
fn rejects_malformed_lockfiles_without_echoing_their_contents() {
    let long = format!("LeagueClient:1:1:{}:https", "a".repeat(257));
    for text in [
        "LeagueClient:123:0:SECRET:https",
        "LeagueClient:123:123:SECRET:http",
        "wrong:123:123:SECRET:https",
        "LeagueClient:0:123:SECRET:https",
        "LeagueClient:-1:123:SECRET:https",
        "LeagueClient:12a:123:SECRET:https",
        "LeagueClient:123:65536:SECRET:https",
        "LeagueClient:123:+80:SECRET:https",
        "LeagueClient:١٢:123:SECRET:https",
        "LeagueClient:123:123:SE CRET:https",
        "LeagueClient:123:123::https",
        "LeagueClient:123:123:SECRET:https:extra",
        "LeagueClient:123:123:SECRET",
        long.as_str(),
        "",
    ] {
        let error = parse_lockfile(text).unwrap_err();
        assert_eq!(error, INVALID, "{text}");
        assert!(!error.to_string().contains("SECRET"));
    }
}

#[test]
fn searches_running_client_directories_then_configured_then_default_without_duplicates() {
    let running = vec![PathBuf::from(r"D:\Games\League\LeagueClientUx.exe"), PathBuf::from(r"D:\Games\League\LeagueClient.exe")];
    let dirs = candidate_dirs(&running, Some(PathBuf::from(r"E:\Riot\League")));
    assert_eq!(
        dirs,
        vec![PathBuf::from(r"D:\Games\League"), PathBuf::from(r"E:\Riot\League"), PathBuf::from(r"C:\Riot Games\League of Legends")]
    );
    assert_eq!(candidate_dirs(&[], None), vec![PathBuf::from(r"C:\Riot Games\League of Legends")]);
}

#[test]
fn uses_the_first_valid_small_lockfile_and_skips_missing_oversized_or_invalid_ones() {
    let root = tempfile::tempdir().unwrap();
    let dir = |name: &str| {
        let path = root.path().join(name);
        std::fs::create_dir_all(&path).unwrap();
        path
    };
    let (missing, large, invalid, good, later) = (dir("missing"), dir("large"), dir("invalid"), dir("good"), dir("later"));
    std::fs::write(large.join("lockfile"), format!("LeagueClient:1:1111:{}:https", "a".repeat(2100))).unwrap();
    std::fs::write(invalid.join("lockfile"), "LeagueClient:1:2222:pw:http").unwrap();
    std::fs::write(good.join("lockfile"), "LeagueClient:1:3333:pw:https").unwrap();
    std::fs::write(later.join("lockfile"), "LeagueClient:1:4444:pw:https").unwrap();
    std::fs::create_dir_all(root.path().join("dir-lock").join("lockfile")).unwrap();
    let order = [missing, root.path().join("dir-lock"), large, invalid, good, later];
    assert_eq!(discover_in(&order).unwrap().port(), 3333);
    assert_eq!(discover_in(&order[..4]).unwrap_err(), CoreError::ClientUnavailable);
    assert_eq!(discover_in(&[]).unwrap_err(), CoreError::ClientUnavailable);
}

#[test]
fn process_enumeration_never_fails_the_caller() {
    // League is not required to be running; the call must return quickly with zero or more absolute paths.
    let paths = rbl_core::lcu::discovery::running_client_paths();
    assert!(paths.iter().all(|p| p.is_absolute()));
}

#[cfg(windows)]
#[test]
fn finds_a_running_process_by_executable_name_with_its_full_path() {
    let me = std::env::current_exe().unwrap();
    let name = me.file_name().unwrap().to_str().unwrap().to_ascii_uppercase();
    let found = rbl_core::lcu::discovery::running_paths_named(&[&name]);
    let canonical = |p: &std::path::Path| std::fs::canonicalize(p).unwrap();
    assert!(found.iter().any(|p| canonical(p) == canonical(&me)), "{found:?} should include {me:?}");
}
