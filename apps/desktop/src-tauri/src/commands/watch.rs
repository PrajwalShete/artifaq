use std::path::PathBuf;
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use notify_debouncer_full::{DebounceEventResult, new_debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppError, AppResult};
use crate::state::{AppState, WatcherEntry};

#[derive(Debug, Clone, Serialize)]
pub struct FolderChanged {
    pub watcher_id: u32,
    pub root: PathBuf,
}

const DEBOUNCE: Duration = Duration::from_millis(180);

/// Start watching a folder recursively. Emits `folder:changed` with this watcher's id
/// whenever anything inside the tree changes. Returns the watcher id so the caller
/// can later `unwatch_folder` with it.
#[tauri::command]
pub fn watch_folder(app: AppHandle, root: PathBuf) -> AppResult<u32> {
    if !root.is_dir() {
        return Err(AppError::NotFound(root.display().to_string()));
    }

    let state = app.state::<AppState>();
    let id = state.next_id();
    let root_for_handler = root.clone();
    let app_for_handler = app.clone();

    let mut debouncer = new_debouncer(DEBOUNCE, None, move |result: DebounceEventResult| {
        // Coalesce all debounced events into a single "something changed" ping.
        // The frontend re-walks on receipt.
        if result.is_ok() {
            let payload = FolderChanged {
                watcher_id: id,
                root: root_for_handler.clone(),
            };
            let _ = app_for_handler.emit("folder:changed", &payload);
        }
    })
    .map_err(|e: notify::Error| AppError::Watcher(e.to_string()))?;

    debouncer
        .watcher()
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e: notify::Error| AppError::Watcher(e.to_string()))?;

    state
        .watchers
        .lock()
        .map_err(|_| AppError::Other("state poisoned".into()))?
        .insert(id, WatcherEntry { debouncer });

    Ok(id)
}

/// Stop a watcher started via `watch_folder`.
#[tauri::command]
pub fn unwatch_folder(app: AppHandle, watcher_id: u32) -> AppResult<()> {
    let state = app.state::<AppState>();
    let mut g = state
        .watchers
        .lock()
        .map_err(|_| AppError::Other("state poisoned".into()))?;
    g.remove(&watcher_id);
    Ok(())
}
