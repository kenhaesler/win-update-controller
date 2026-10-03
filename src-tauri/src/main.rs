#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::os::windows::process::CommandExt;
use std::{
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
};
use tauri::{Emitter, Manager};
mod window_state;

struct OperationLock(AtomicBool);
struct Reset<'a>(&'a AtomicBool);
struct ResetTray(tauri::AppHandle);
impl Drop for ResetTray {
    fn drop(&mut self) {
        if let Some(tray) = self.0.tray_by_id("controller") {
            let _ = tray.set_tooltip(Some("Update Controller"));
        }
    }
}
impl Drop for Reset<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
async fn windows_request(app: tauri::AppHandle, request: Value) -> Result<Value, String> {
    let command = request
        .get("command")
        .and_then(Value::as_str)
        .ok_or("Missing command")?;
    if ![
        "status",
        "scan",
        "history",
        "reconcile",
        "driverRules", "excludeDriver", "removeDriverRule",
        "review",
        "notes",
        "appRelease",
        "autoDefender",
        "download",
        "install",
        "hide",
        "unhide",
        "enableManual",
        "restorePolicy",
    ]
    .contains(&command)
    {
        return Err("Unsupported operation".into());
    }
    let mutation = ["download", "install", "autoDefender", "hide", "unhide", "enableManual", "restorePolicy", "excludeDriver", "removeDriverRule"].contains(&command);
    let state = app.state::<OperationLock>();
    if mutation && state.0.swap(true, Ordering::SeqCst) {
        return Err("Another operation is running".into());
    }
    let _reset = if mutation {
        Some(Reset(&state.0))
    } else {
        None
    };
    let helper = if cfg!(debug_assertions) {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("helper/UpdateController.Helper.exe")
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("helper/UpdateController.Helper.exe")
    };
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _reset_tray = ResetTray(app.clone());
        let mut child = Command::new(helper).creation_flags(0x08000000).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|e| format!("Could not start Windows helper: {e}"))?;
        let mut input = child.stdin.take().ok_or("Missing helper input")?;
        writeln!(input, "{}", request).map_err(|e| e.to_string())?;
        drop(input);
        let stdout = child.stdout.take().ok_or("Missing helper output")?;
        let mut response = None;
        for line in BufReader::new(stdout).lines() {
            let line = line.map_err(|e| e.to_string())?;
            let frame: Value = serde_json::from_str(&line).map_err(|_| "Windows helper returned an invalid message. Check history before retrying.")?;
            if frame["event"].as_str() == Some("progress") {
                let progress = &frame["data"];
                if let (Some(action), Some(count)) = (progress["action"].as_str(), progress["count"].as_u64()) {
                    if ["download", "install"].contains(&action) && count > 0 && count <= 100 {
                        let _ = app.emit("operation-progress", progress);
                        if let Some(tray) = app.tray_by_id("controller") {
                            let percent = progress["percent"].as_u64().filter(|p| *p <= 100).map(|p| format!(" {p}%")).unwrap_or_default();
                            let _ = tray.set_tooltip(Some(format!("Update Controller: {action}{percent}")));
                        }
                    }
                }
            } else { response = Some(frame); }
        }
        let result = child.wait().map_err(|e| e.to_string())?;
        let response = response.ok_or_else(|| format!("Windows helper returned no final result (exit {:?}). Check history before retrying.", result.code()))?;
        if matches!(request["command"].as_str(), Some("download" | "install" | "autoDefender")) {
            use tauri_plugin_notification::NotificationExt;
            let success = response["ok"].as_bool() == Some(true) && response["data"]["state"].as_str() == Some("completed");
            let body = if response["data"]["restartRequired"].as_bool() == Some(true) { "Windows reported a restart requirement. Open Update Controller to review the results." }
                else { "Open Update Controller to review the per-package results in History." };
            let _ = app.notification().builder().title(if success { "Update operation completed" } else { "Update operation needs attention" }).body(body).show();
        }
        if response["ok"].as_bool() != Some(true) { return Err(format!("{} ({})", response["error"].as_str().unwrap_or("Windows operation failed"), response["code"].as_str().unwrap_or("unknown"))); }
        Ok(response["data"].clone())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_official_url(url: String) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|_| "Invalid URL")?;
    let host = parsed.host_str().unwrap_or("");
    if parsed.scheme() != "https"
        || !(host == "microsoft.com" || host.ends_with(".microsoft.com"))
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Only official Microsoft HTTPS links are allowed".into());
    }
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_controller_release() -> Result<(), String> {
    open::that("https://github.com/kenhaesler/win-update-controller/releases/latest").map_err(|e| e.to_string())
}

#[tauri::command]
fn notify_policy_change(app: tauri::AppHandle, message: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    if message.is_empty() || message.chars().count() > 400 { return Err("Invalid policy notification".into()); }
    app.notification().builder().title("Update control changed").body(message).show().map_err(|e| e.to_string())
}
#[tauri::command]
fn notify_review_due(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    if count == 0 || count > 1000 { return Err("Invalid reminder count".into()); }
    app.notification().builder().title("Updates ready for your review")
        .body(format!("{count} update reminder(s) are due. Open Update Controller to review them; no installation was started."))
        .show().map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(OperationLock(AtomicBool::new(false)))
        .manage(window_state::WindowState::default())
        .invoke_handler(tauri::generate_handler![windows_request, open_official_url, open_controller_release, notify_policy_change, notify_review_due])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window_state::restore(&window);
                window_state::capture(&window);
            }
            use tauri::{
                menu::{Menu, MenuItem},
                tray::TrayIconBuilder,
            };
            let show =
                MenuItem::with_id(app, "show", "Open Update Controller", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::with_id("controller")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Update Controller")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "show" {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    if event.id.as_ref() == "quit" {
                        if app.state::<OperationLock>().0.load(Ordering::SeqCst) {
                            let _ = app.emit("operation-active", ());
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        } else {
                            if let Some(window) = app.get_webview_window("main") { window_state::save(&window); }
                            app.exit(0);
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) { window_state::capture(&webview); }
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) { window_state::save(&webview); }
                if window
                    .app_handle()
                    .state::<OperationLock>()
                    .0
                    .load(Ordering::SeqCst)
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Unable to start Update Controller");
}
