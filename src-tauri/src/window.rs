//! Window lifecycle, tray and incoming build links.
//!
//! With "keep running in the tray" on, closing the window saves its state, then destroys the
//! webview so only the native process (monitor + tray) remains. Reopening builds a new window.
//! Quitting from the tray exits the process. Without tray mode, closing the window quits.

use std::time::Duration;

use rbl_core::deeplink::{OpenBuild, parse};
use rbl_core::ipc::Core;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::window::Color;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry};
use tauri_plugin_autostart::ManagerExt;

pub const MAIN: &str = "main";
const SAVE_TIMEOUT: Duration = Duration::from_secs(1);

pub fn tray_mode(app: &AppHandle) -> bool {
    app.try_state::<Core>().and_then(|core| core.prefs.lock().ok().map(|p| p.prefs().background.tray_on_close)).unwrap_or(false)
}

/// Shows the main window, creating it if it was destroyed. Returns whether it already existed.
pub fn show(app: &AppHandle) -> bool {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return true;
    }
    if let Some(core) = app.try_state::<Core>()
        && let (Ok(current), Ok(mut pinned)) = (core.data.read(), core.window_data.write())
    {
        *pinned = current.clone();
    }
    let built = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title("Rift Build Lab")
        .inner_size(1280.0, 860.0)
        .min_inner_size(390.0, 600.0)
        .background_color(Color(0x11, 0x19, 0x1c, 0xff))
        .build();
    if let Ok(window) = built {
        let _ = window.set_focus();
    }
    false
}

/// Close requested: in tray mode keep running without a webview, otherwise let the app quit.
pub fn on_close_requested(window: &WebviewWindow<Wry>, api: &tauri::CloseRequestApi) {
    let app = window.app_handle().clone();
    if !tray_mode(&app) {
        return;
    }
    api.prevent_close();
    let window = window.clone();
    tauri::async_runtime::spawn(async move {
        let core = app.state::<Core>();
        let saved = core.ui_saved.notified();
        tokio::pin!(saved);
        saved.as_mut().enable();
        let _ = window.emit("persist-ui-state", ());
        if tokio::time::timeout(SAVE_TIMEOUT, saved).await.is_ok() {
            let _ = window.destroy();
        } else {
            let _ = window.emit("window-save-failed", ());
        }
    });
}

/// A build link: an open window is told directly; a new window collects it at startup.
pub fn open_link(app: &AppHandle, link: OpenBuild) {
    if show(app) {
        let _ = app.emit_to(MAIN, "open-build", &link);
    } else if let Some(core) = app.try_state::<Core>()
        && let Ok(mut pending) = core.pending_open.lock()
    {
        *pending = Some(link);
    }
}

pub fn open_url(app: &AppHandle, url: &str) {
    if let Some(link) = parse(url) {
        open_link(app, link);
    }
}

fn send(app: &AppHandle, pause: bool) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let core = app.state::<Core>();
        let _ = if pause { core.pause().await } else { core.resume().await };
    });
}

pub fn tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Rift Build Lab", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause automatic imports", true, None::<&str>)?;
    let resume = MenuItem::with_id(app, "resume", "Resume automatic imports", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Rift Build Lab", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &pause, &resume, &separator, &quit])?;
    let mut builder = TrayIconBuilder::with_id(MAIN)
        .tooltip("Rift Build Lab")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                show(app);
            }
            "pause" => send(app, true),
            "resume" => send(app, false),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Short tray tooltip for a `status-changed` payload.
pub fn tooltip(status: &serde_json::Value) -> String {
    let text = match status["kind"].as_str().unwrap_or("") {
        "disabled" => "automatic imports off",
        "connecting" => "looking for League",
        "league-closed" => "League closed",
        "connected" => "connected",
        "champ-select" => "champion select",
        "applying" => "importing",
        "applied" if status["verified"] == true => "import confirmed",
        "applied" => "import not confirmed",
        "paused" => "paused",
        "needs-attention" => "needs attention",
        _ => "",
    };
    if text.is_empty() { "Rift Build Lab".into() } else { format!("Rift Build Lab · {text}") }
}

/// Registers or removes the Windows startup entry to match the user's choice.
pub fn sync_autostart(app: &AppHandle, wanted: bool) -> Result<(), rbl_core::CoreError> {
    let launcher = app.autolaunch();
    rbl_core::startup::sync_startup(
        wanted,
        || launcher.is_enabled().map_err(|_| rbl_core::CoreError::Internal),
        |enable| { if enable { launcher.enable() } else { launcher.disable() } }.map_err(|_| rbl_core::CoreError::Internal),
    )
    .map_err(|_| rbl_core::CoreError::InvalidBundle {
        reason: "Windows startup registration could not be changed. Check Windows Startup apps and retry.",
    })
}

/// Supported WebView2 cache management. Low mode preserves page state and scripts;
/// interaction restores Normal. Unsupported older runtimes simply keep their default.
pub async fn set_memory_active(window: WebviewWindow<Wry>, active: bool) -> bool {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL, ICoreWebView2_19,
        };
        use windows_core::Interface;
        let (sender, receiver) = tokio::sync::oneshot::channel();
        let queued = window.with_webview(move |webview| {
            // Tauri dispatches this closure onto the webview's owning UI thread.
            let result = unsafe {
                (|| -> windows_core::Result<()> {
                    let core = webview.controller().CoreWebView2()?;
                    let memory = core.cast::<ICoreWebView2_19>()?;
                    memory.SetMemoryUsageTargetLevel(if active {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                    } else {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                    })
                })()
            };
            let _ = sender.send(result.is_ok());
        });
        if queued.is_err() {
            return false;
        }
        let applied = tokio::time::timeout(Duration::from_secs(2), receiver).await.ok().and_then(Result::ok).unwrap_or(false);
        if std::env::var_os("RBL_MEMORY_DIAGNOSTICS").is_some() {
            let time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
            eprintln!("RBL_MEMORY time={time} target={} applied={applied}", if active { "normal" } else { "low" });
        }
        applied
    }
    #[cfg(not(windows))]
    {
        let _ = (window, active);
        false
    }
}
