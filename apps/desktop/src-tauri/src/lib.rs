mod commands;
mod error;
mod state;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

use state::AppState;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::dialog::open_folder,
            commands::walk::walk_html,
            commands::watch::watch_folder,
            commands::watch::unwatch_folder,
        ])
        .setup(|app| {
            apply_window_chrome(app)?;
            install_menu(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn apply_window_chrome(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    #[cfg(target_os = "macos")]
    {
        apply_vibrancy(
            &win,
            NSVisualEffectMaterial::Sidebar,
            Some(NSVisualEffectState::Active),
            Some(10.0),
        )
        .ok();
    }

    let _ = win.show();
    Ok(())
}

fn install_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(
            &MenuItemBuilder::with_id("open_folder", "Open Folder…")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("publish_focused", "Publish")
                .accelerator("CmdOrCtrl+Return")
                .build(handle)?,
        )
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(
            &MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
                .accelerator("CmdOrCtrl+\\")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("focus_filter", "Filter Files")
                .accelerator("CmdOrCtrl+F")
                .build(handle)?,
        )
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(handle, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let help_menu = SubmenuBuilder::new(handle, "Help")
        .item(
            &MenuItemBuilder::with_id("keyboard_help", "Keyboard Shortcuts")
                .accelerator("?")
                .build(handle)?,
        )
        .build()?;

    let menu = MenuBuilder::new(handle)
        .items(&[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        let _ = app.emit("menu", event.id().0.clone());
    });

    Ok(())
}
