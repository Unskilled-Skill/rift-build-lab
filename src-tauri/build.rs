// Commands are declared in the app manifest so each one needs an explicit `allow-...` permission
// in a capability; the list must match `rbl_core::ipc::COMMANDS` (checked by rbl-core tests).
const COMMANDS: &[&str] = &[
    "get_status",
    "test_connection",
    "apply_build",
    "set_default_build",
    "clear_default_build",
    "get_preferences",
    "update_preferences",
    "pause_auto_import",
    "resume_auto_import",
    "reapply_last",
    "open_backup_folder",
    "check_data_updates",
    "get_data_revision",
    "open_external",
    "check_app_update",
];

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)))
        .expect("tauri-build failed");
}
