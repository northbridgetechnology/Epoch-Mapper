# App icons

Tauri needs platform icons here before a desktop build. Generate them all from
one square PNG (1024×1024 recommended):

    npm run desktop:icon -- path/to/icon.png

That writes `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` (macOS),
and `icon.ico` (Windows) into this folder — the paths `tauri.conf.json` expects.
