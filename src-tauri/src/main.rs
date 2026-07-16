// Epoch standalone game — a Tauri shell that wraps the static player build
// (dist-player/web) into a native desktop app. All game logic lives in the
// bundled web frontend; this binary just hosts the webview.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Epoch game");
}
