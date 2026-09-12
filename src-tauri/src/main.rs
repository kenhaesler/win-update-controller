#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::os::windows::process::CommandExt;
use std::{
    io::Write,
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
};
use tauri::{Emitter, Manager};

struct OperationLock(AtomicBool);
struct Reset<'a>(&'a AtomicBool);
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
        "review",
        "notes",
        "download",
        "install",
        "enableManual",
        "restorePolicy",
    ]
    .contains(&command)
    {
        return Err("Unsupported operation".into());
    }
    let mutation = ["download", "install", "enableManual", "restorePolicy"].contains(&command);
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
    tauri::async_runtime::spawn_blocking(move || {
        let mut child = Command::new(helper).creation_flags(0x08000000).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e| format!("Could not start Windows helper: {e}"))?;
        let mut input = child.stdin.take().ok_or("Missing helper input")?;
        writeln!(input, "{}", request).map_err(|e| e.to_string())?;
        drop(input);
        let result = child.wait_with_output().map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&result.stdout);
        let response: Value = serde_json::from_str(text.trim()).map_err(|_| format!("Windows helper returned no valid result (exit {:?}). Check history before retrying.", result.status.code()))?;
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

fn main() {
    tauri::Builder::default()
        .manage(OperationLock(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![windows_request, open_official_url])
        .setup(|app| {
            use tauri::{
                menu::{Menu, MenuItem},
                tray::TrayIconBuilder,
            };
            let show =
                MenuItem::with_id(app, "show", "Open Update Controller", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            TrayIconBuilder::new()
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
                            app.exit(0);
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
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
