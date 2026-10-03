use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, WebviewWindow};

#[derive(Clone, Serialize, Deserialize)]
pub struct Geometry { x: i32, y: i32, width: f64, height: f64, maximized: bool }
#[derive(Default)]
pub struct WindowState(pub Mutex<Option<Geometry>>);

fn path(window: &WebviewWindow) -> Option<std::path::PathBuf> {
    window.app_handle().path().app_data_dir().ok().map(|p| p.join("window-state.json"))
}
pub fn restore(window: &WebviewWindow) {
    let Some(file) = path(window) else { return };
    let Ok(bytes) = std::fs::read(file) else { return };
    let Ok(mut saved) = serde_json::from_slice::<Geometry>(&bytes) else { return };
    if !saved.width.is_finite() || !saved.height.is_finite() || saved.width < 680.0 || saved.height < 560.0 { return }
    let Ok(monitors) = window.available_monitors() else { return };
    let monitor = monitors.iter().find(|m| {
        let p = m.position(); let s = m.size();
        saved.x >= p.x && saved.y >= p.y && i64::from(saved.x) < i64::from(p.x) + i64::from(s.width) && i64::from(saved.y) < i64::from(p.y) + i64::from(s.height)
    }).or_else(|| monitors.first());
    let Some(monitor) = monitor else { return };
    let p = monitor.position(); let s = monitor.size(); let scale = monitor.scale_factor();
    saved.width = saved.width.min((s.width as f64 / scale - 40.0).max(680.0));
    saved.height = saved.height.min((s.height as f64 / scale - 80.0).max(560.0));
    saved.x = saved.x.clamp(p.x, p.x.saturating_add((s.width as f64 - saved.width * scale).max(0.0) as i32));
    saved.y = saved.y.clamp(p.y, p.y.saturating_add((s.height as f64 - saved.height * scale - 40.0).max(0.0) as i32));
    let _ = window.set_size(tauri::LogicalSize::new(saved.width, saved.height));
    let _ = window.set_position(tauri::PhysicalPosition::new(saved.x, saved.y));
    let maximized = saved.maximized;
    *window.app_handle().state::<WindowState>().0.lock().unwrap() = Some(saved);
    if maximized { let _ = window.maximize(); }
}
pub fn capture(window: &WebviewWindow) {
    if window.is_minimized().unwrap_or(true) { return }
    let maximized = window.is_maximized().unwrap_or(false);
    let binding = window.app_handle().state::<WindowState>();
    let Ok(mut state) = binding.0.lock() else { return };
    if maximized {
        if let Some(saved) = state.as_mut() { saved.maximized = true; }
        return;
    }
    if let (Ok(p), Ok(s), Ok(scale)) = (window.outer_position(), window.inner_size(), window.scale_factor()) {
        *state = Some(Geometry { x: p.x, y: p.y, width: s.width as f64 / scale, height: s.height as f64 / scale, maximized: false });
    }
}
pub fn save(window: &WebviewWindow) {
    capture(window);
    let Some(file) = path(window) else { return };
    let state = window.app_handle().state::<WindowState>();
    let Ok(saved) = state.0.lock() else { return };
    if let Some(saved) = saved.as_ref() {
        if let (Some(parent), Ok(bytes)) = (file.parent(), serde_json::to_vec(saved)) {
            if std::fs::create_dir_all(parent).is_ok() { let _ = std::fs::write(file, bytes); }
        }
    }
}
