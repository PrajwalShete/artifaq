use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};

use notify::RecommendedWatcher;
use notify_debouncer_full::{Debouncer, FileIdMap};

/// One debounced watcher per pinned folder. Keyed by a u32 id we hand back to JS
/// so it can `unwatch` later. Dropping the entry stops the watcher.
pub struct WatcherEntry {
    pub debouncer: Debouncer<RecommendedWatcher, FileIdMap>,
}

pub struct AppState {
    pub watchers: Mutex<HashMap<u32, WatcherEntry>>,
    next_watcher_id: AtomicU32,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
            next_watcher_id: AtomicU32::new(1),
        }
    }
}

impl AppState {
    pub fn next_id(&self) -> u32 {
        self.next_watcher_id.fetch_add(1, Ordering::Relaxed)
    }
}
