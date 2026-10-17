//! Finds the running League Client's lockfile without spawning PowerShell or other processes.

use std::path::{Path, PathBuf};

use super::lockfile::{Credentials, parse_lockfile};
use crate::CoreError;

const MAX_LOCKFILE: u64 = 2048;
const DEFAULT_DIR: &str = r"C:\Riot Games\League of Legends";

/// Directories to search: each running client's folder, then the configured folder, then the default install.
pub fn candidate_dirs(running: &[PathBuf], configured: Option<PathBuf>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    for dir in running.iter().filter_map(|p| p.parent().map(Path::to_path_buf)).chain(configured).chain([PathBuf::from(DEFAULT_DIR)]) {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

/// Returns credentials from the first readable, small and valid lockfile.
pub fn discover_in(dirs: &[PathBuf]) -> Result<Credentials, CoreError> {
    dirs.iter()
        .find_map(|dir| {
            let file = dir.join("lockfile");
            std::fs::metadata(&file).ok().filter(|m| m.is_file() && m.len() <= MAX_LOCKFILE)?;
            parse_lockfile(&std::fs::read_to_string(&file).ok()?).ok()
        })
        .ok_or(CoreError::ClientUnavailable)
}

/// Discovers the local client using running processes and an optional configured install folder.
pub fn discover(configured: Option<PathBuf>) -> Result<Credentials, CoreError> {
    discover_in(&candidate_dirs(&running_client_paths(), configured))
}

/// Full image paths of running `LeagueClient.exe` / `LeagueClientUx.exe` processes.
pub fn running_client_paths() -> Vec<PathBuf> {
    running_paths_named(&["leagueclient.exe", "leagueclientux.exe"])
}

/// Full image paths of running processes whose executable name matches (ASCII case-insensitive).
#[cfg(windows)]
pub fn running_paths_named(names: &[&str]) -> Vec<PathBuf> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
    };

    let wide_name = |raw: &[u16]| OsString::from_wide(&raw[..raw.iter().position(|c| *c == 0).unwrap_or(raw.len())]);
    let mut paths = Vec::new();
    // SAFETY: plain Win32 calls with owned, correctly sized buffers; every opened handle is closed.
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return paths;
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut more = Process32FirstW(snapshot, &mut entry) != 0;
        while more {
            let name = wide_name(&entry.szExeFile).to_string_lossy().to_ascii_lowercase();
            if names.iter().any(|n| n.eq_ignore_ascii_case(&name)) {
                let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, entry.th32ProcessID);
                if !process.is_null() {
                    let mut buffer = [0u16; 1024];
                    let mut size = buffer.len() as u32;
                    if QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, buffer.as_mut_ptr(), &mut size) != 0 {
                        let path = PathBuf::from(OsString::from_wide(&buffer[..size as usize]));
                        if path.is_absolute() && !paths.contains(&path) {
                            paths.push(path);
                        }
                    }
                    CloseHandle(process);
                }
            }
            more = Process32NextW(snapshot, &mut entry) != 0;
        }
        CloseHandle(snapshot);
    }
    paths
}

#[cfg(not(windows))]
pub fn running_paths_named(_names: &[&str]) -> Vec<PathBuf> {
    Vec::new()
}
