# Distributing a finished game

A built Epoch game is fully self-contained: the ruleset, every map, uploaded
audio (baked in), and sprite uploads all live inside one `.epochmap` file, and
the engine is pure client-side code with no server. So a game can ship three
ways, all from the same **player-only build** — the engine booted straight into
play with every editor surface hidden (`DungeonMapper distribution`, wrapped by
`<GamePlayer>`).

Build the player once:

```bash
npm install            # dev dependencies must be present (esbuild, tailwindcss)
npm run build:player
```

> `build:player` uses esbuild and the Tailwind CLI — both **devDependencies**.
> On a server where `NODE_ENV=production`, a plain `npm install` skips them; use
> `npm install --include=dev`. You don't need any of this to use the editor's
> in-app **Export Standalone HTML** button (the Docker image already builds the
> template), or to run the app via Docker — only for the CLI build below.

This produces:

- `dist-player/player.html` — the single-file template (engine + CSS inlined,
  an empty game placeholder).
- `dist-player/web/index.html` — the same, for hosting; it loads a sidecar
  `./game.epochmap` (or `?game=<url>`).
- `public/player-template.html` — the copy the editor's **Export Standalone
  HTML** button fetches.

---

## A — Single self-contained HTML file (double-click to play)

The most shareable format: one `.html` with the game embedded. Works offline in
any browser; upload it to itch.io as an HTML5 game.

**From the editor:** File → **Export Standalone HTML…** downloads
`<your-game>.html` with the current session baked in. (Nothing else needed —
the button injects the game into the template.)

**From the CLI:**

```bash
npm run build:player                    # once
node scripts/bake-game.mjs my-game.epochmap MyGame.html
```

Caveat — **saves on `file://`.** A double-clicked HTML file has an opaque
browser origin, so in-game save slots may not persist reliably between sessions
(browser-dependent). For dependable saves, host it (Option B) or ship it as a
desktop app (Option C). Players can always export/import a `.epochsave` file as
a portable save.

Caveat — **size.** The engine is ~1.6 MB; uploaded audio/sprites add their
base64 size (+33%). Games leaning on the built-in chiptunes and pixel sprites
stay small.

---

## B — Hosted web build (itch.io, GitHub Pages, Netlify, any static host)

Serve a folder; saves work reliably because the page has a real origin.

```bash
npm run build:player
cp my-game.epochmap dist-player/web/game.epochmap
# deploy the dist-player/web/ folder to any static host
```

`index.html` loads `./game.epochmap` automatically. To host several games from
one deploy, drop multiple `.epochmap` files and link with
`index.html?game=<name>.epochmap`.

itch.io: zip `dist-player/web/`, upload as an HTML5 project, set
`index.html` as the launch file.

---

## C — Native desktop app (Windows / macOS / Linux)

[Tauri](https://tauri.app) wraps the same `dist-player/web` folder into a small
native binary (~3–10 MB — it uses the OS webview, unlike Electron). The scaffold
lives in `src-tauri/`.

**Prerequisites** (on the machine you build on):

- [Rust](https://rustup.rs) toolchain.
- Tauri's system deps for your OS — see
  <https://tauri.app/start/prerequisites/>.

**Build:**

```bash
cp my-game.epochmap dist-player/web/game.epochmap   # bundle your game
npm run desktop:icon -- path/to/icon.png            # generate app icons (once)
npm run desktop:build                               # → installers
```

Output installers land in `src-tauri/target/release/bundle/`
(`.msi`/`.exe`, `.dmg`/`.app`, `.deb`/`.AppImage`). `npm run desktop:dev` runs
it in a live dev window.

Notes inherent to native distribution (not Epoch-specific):

- **Per-OS builds.** A Windows `.exe` builds on Windows, a macOS `.dmg` on
  macOS, etc. Use CI (GitHub Actions has a Tauri action) to produce all three.
- **Code signing.** Unsigned apps trip OS gatekeepers (SmartScreen, Gatekeeper).
  Signing/notarization is configured in `tauri.conf.json` per Tauri's docs.
- Edit `productName`, `version`, and `identifier` in `src-tauri/tauri.conf.json`
  to your game before shipping.

---

## Which to choose

| Want… | Use |
| --- | --- |
| Fastest share / itch.io HTML5 / no install | **A** (single HTML) |
| Reliable saves, a URL, multiple games | **B** (hosted) |
| A "real app", offline, filesystem saves | **C** (desktop) |

All three consume the same player build, so you can ship more than one.
