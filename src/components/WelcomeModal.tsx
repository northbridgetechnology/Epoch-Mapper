'use client'

import { X } from 'lucide-react'

const KEYS: Array<[string, string]> = [
  ['Arrow keys / WASD', 'Move / turn the player'],
  ['E', 'Interact (Play): doors, switches, NPCs, chests, inscriptions'],
  ['Tab', 'Open the in-game menu (Play): items, magic, equip, party, save…'],
  ['J', 'Open the Journal — quests & lore (Play)'],
  ['M', 'Toggle the full map view (Play) — a minimap is always shown in 3D'],
  ['F', 'Toggle fog of war reveal for current cell (Map editor)'],
  ['N', 'Add / edit note on current cell (Map editor)'],
  ['Z / Ctrl+Z', 'Undo last cell edit (Map editor)'],
  ['Ctrl+S', 'Save current session to .epochmap'],
  ['Ctrl+P', 'Export PDF'],
  ['+ / -', 'Zoom in / out'],
  ['?', 'Open this help modal'],
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-amber-300 font-semibold text-sm tracking-wide">{title}</h3>
      <div className="text-sm text-white/70 leading-relaxed space-y-1.5">{children}</div>
    </section>
  )
}

export function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-amber-500/20 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
          <h2 className="text-lg font-bold text-white">Welcome to Epoch</h2>
          <button
            onClick={onClose}
            className="grid place-items-center h-8 w-8 rounded-md text-white/50 hover:text-white hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Section title="What is Epoch?">
            <p>
              Epoch is a free, open-source first-person dungeon-crawler engine and authoring tool — in the
              tradition of Eye of the Beholder, Shin Megami Tensei, and Wizardry. Draw grid maps, build a full ruleset,
              and <strong className="text-white/85">play the result in a pseudo-3D first-person view</strong> with
              turn-based combat, a party, character progression, music, and exploration hazards. When your game is done,
              hand it out as a <strong className="text-white/85">standalone app</strong> — a single double-click HTML
              file, a hosted web build, or a native desktop binary (see <em>Exporting &amp; distributing</em> below).
            </p>
            <p className="text-white/55">
              The left <strong className="text-white/75">activity bar</strong> switches workspaces:
              🗺 <strong className="text-white/75">Map</strong> (draw), 🗄 <strong className="text-white/75">Database</strong> (content),
              👥 <strong className="text-white/75">Characters</strong> (party &amp; NPCs), ▶ <strong className="text-white/75">Play</strong>,
              and ⚙ <strong className="text-white/75">Settings</strong>.
            </p>
          </Section>

          <Section title="Building your game (Database & Settings)">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                The <strong className="text-white/85">Database</strong> holds every content table with structured
                editors (no raw JSON): classes, races, weapon/armor types, items, spells, spell schools, skills, status
                effects, the <strong className="text-white/85">bestiary</strong> (with weighted ability kits,
                resistances, and one-click Duplicate / Make&nbsp;Elite), encounter &amp; loot tables, shops, events,
                quests, and <strong className="text-white/85">music</strong>. Big lists sort into collapsible groups.
              </li>
              <li>
                Rich defaults ship ready to play: 100+ items, ~60 spells, 30+ skills, 40+ enemies, and 16 built-in
                chiptune tracks — remix them or start from scratch.
              </li>
              <li>
                <strong className="text-white/85">Settings</strong> holds the global Game Rules: the combat system
                (Classic / 1-More / Press-Turn), audio slots, the XP curve, the opening story, and per-map options.
              </li>
            </ul>
          </Section>

          <Section title="Play mode">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Switch to <strong className="text-white/85">Play</strong> (the ▶ activity-bar icon) to walk your dungeon
                in first person: WASD to move/turn, <code className="text-amber-200">E</code> to interact. A minimap
                shows your explored trail; <code className="text-amber-200">M</code> opens the full map.
              </li>
              <li>
                <strong className="text-white/85">Turn-based combat</strong> in one of three systems (a global rule):
                Classic, Persona-style <strong className="text-white/85">1-More</strong>, or full SMT
                <strong className="text-white/85"> Press-Turn</strong> (knockdown + All-Out Attack). Weaknesses,
                resistances, skills, and empower-next moves (Charge / Concentrate) all matter.
              </li>
              <li>
                Press <code className="text-amber-200">Tab</code> for the <strong className="text-white/85">in-game
                menu</strong> — an FF-style hub for Item, Magic, Equip, Status, Party, Journal, Camp, Save, and Config
                (music &amp; sound volume). Full keyboard control.
              </li>
              <li>
                <strong className="text-white/85">Music &amp; sound</strong> play automatically — per-level tracks,
                battle/boss themes with a boss-intro stinger, a victory fanfare, and sound effects. Audio unlocks on
                your first click or keypress (browser autoplay policy).
              </li>
              <li>
                <strong className="text-white/85">Hazards are live.</strong> Traps spring when stepped on, damage edges
                bite every crossing, poison ticks as you walk, and a party wipe triggers game-over. Dark maps collapse
                your view to the party&apos;s light — carry a torch or lantern. Trick tiles (spinners, pits, teleporters,
                anti-magic &amp; darkness zones, safe rooms) lurk in the walls.
              </li>
            </ul>
          </Section>

          <Section title="Story & your hero">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Give your game an <strong className="text-white/85">opening story</strong> (paced slides with
                optional splash art) that plays on New Game — authored in Settings.
              </li>
              <li>
                Players build their <strong className="text-white/85">Main Character</strong> in a Character
                Builder: name, portrait (built-in pixel faces or an upload), pronoun, class, race, and
                <strong className="text-white/85"> point-buy</strong> attributes. The party starts with the hero
                and grows as you play.
              </li>
              <li>
                Address the hero anywhere in dialogue, inscriptions, quests, story, and endings with
                <code className="text-amber-200"> {'{mc}'} </code> and pronoun tokens
                (<code className="text-amber-200">{'{they}'}</code>, <code className="text-amber-200">{'{their}'}</code>…).
                Optionally, the Main Character&apos;s death ends the game — the classic protagonist rule.
              </li>
            </ul>
          </Section>

          <Section title="How maps are organized">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You can have <strong className="text-white/85">multiple maps per session</strong> (e.g., Floor 1, Floor
                2, World Map). Maps are listed in the left panel.
              </li>
              <li>Each map has an infinite grid. You never run out of space — the viewport follows your player marker.</li>
              <li>
                Link maps with stairs/doors (a fade transition with a name card), or connect their
                <strong className="text-white/85"> world edges</strong> in Settings so walking off one edge seamlessly
                crosses into the neighbour — stitch a grid of maps into one large open world.
              </li>
            </ul>
          </Section>

          <Section title="The cell grid">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Every cell can have a <strong className="text-white/85">base type</strong>: Floor, Wall, Door, Stairs
                Up/Down, Water, Lava, Void, or a custom type you define.
              </li>
              <li>
                Cells start hidden (fog of war). Fog lifts in 3×3 <strong className="text-white/85">chunks</strong> as
                your player marker moves to the edge of the revealed area.
              </li>
              <li>Click any cell to set its base type. Right-click (or long-press) for the full cell editor.</li>
            </ul>
          </Section>

          <Section title="Overlays">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-white/85">Overlays</strong> are planning icons placed on top of a cell: Inn,
                Boss, Mini-Boss, Save Point, Player Start, and any custom markers you create.
              </li>
              <li>
                Interactive content (NPCs, shops, chests, <strong className="text-white/85">traps</strong>, levers,
                teleporters, encounters, events) lives as <em>cell entities</em> — add them with the Cell Inspector.
                Traps fire their effects in Play; Save Point cells become functional when the save policy requires them.
              </li>
              <li>A single cell can hold multiple overlays and entities (e.g., a Boss room with a Chest).</li>
            </ul>
          </Section>

          <Section title="Edges">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-white/85">Edges</strong> mark the borders of a cell: standard & one-way walls,
                doors, illusory walls, secret passages, and <strong className="text-white/85">damage edges</strong> that
                deal damage each time the party crosses them in Play.
              </li>
              <li>Doors can be key-locked or sealed behind wall switches; illusory walls reveal on interact.</li>
              <li>Each of the four sides (N, S, E, W) can be independently marked; edges appear as colored lines.</li>
            </ul>
          </Section>

          <Section title="Notes">
            <ul className="list-disc pl-5 space-y-1">
              <li>Any cell can hold a text note (up to 500 characters).</li>
              <li>Notes appear in the cell as a small indicator. Hover the cell to read the full note.</li>
              <li>
                When you export to PDF, all notes are collected into an index at the bottom of each page with their (X,
                Y) coordinates.
              </li>
            </ul>
          </Section>

          <Section title="Player marker and navigation">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                The <strong className="text-white/85">player marker (⊕)</strong> tracks your in-game position. Move it
                with arrow keys or WASD, or click any revealed cell.
              </li>
              <li>The viewport is always centered on the player. The map moves; the viewport does not.</li>
            </ul>
          </Section>

          <Section title="Zoom">
            <p>
              Use the + / − toolbar buttons or scroll wheel to zoom. Zoom scales the cells inside the fixed viewport
              window — the window itself never resizes.
            </p>
          </Section>

          <Section title="Camera pan">
            <p>
              Hold <strong className="text-white/85">middle mouse button</strong> and drag to pan the camera offset
              without moving the player. Useful for checking an area you explored earlier. The camera snaps back to
              center when you move the player.
            </p>
          </Section>

          <Section title="Coordinate rulers">
            <p>
              Thin rulers run along the top and left edges of the viewport showing X and Y coordinates. Coordinates are
              arbitrary — (0,0) is where you placed your first cell. Negative coordinates are valid.
            </p>
          </Section>

          <Section title="Custom markers">
            <ul className="list-disc pl-5 space-y-1">
              <li>Open the Marker Palette (palette icon in toolbar) to define your own cell types and overlay icons.</li>
              <li>Each custom marker has a label (max 32 chars), a color, and an icon (single emoji or ASCII character).</li>
              <li>
                Custom markers are saved into the <code className="text-amber-200">.epochmap</code> file — anyone who
                opens the file sees your custom types correctly.
              </li>
            </ul>
          </Section>

          <Section title="Exporting & distributing a game">
            <p>From the <strong className="text-white/85">File</strong> menu:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-white/85">Save .epochmap</strong>: a compact binary of your whole game —
                every map, the full content ruleset, uploaded audio (baked in), custom markers, notes, and fog. Share
                it with anyone who has the editor.
              </li>
              <li>
                <strong className="text-white/85">Export Standalone HTML</strong>: bakes the game into one
                self-contained <code className="text-amber-200">.html</code> — double-click to play in any browser,
                no install. Great for itch.io.
              </li>
              <li>
                <strong className="text-white/85">Export Web Build (.zip)</strong>: <code className="text-amber-200">index.html</code>
                {' '}+ a sidecar <code className="text-amber-200">game.epochmap</code>. Unzip onto any static host, or
                upload the zip straight to itch.io as an HTML5 game.
              </li>
              <li>
                <strong className="text-white/85">Export PDF</strong>: a print-ready PDF with a parchment border,
                per-page legend, coordinate rulers, and a notes index — one page per map.
              </li>
            </ul>
            <p className="text-white/55">
              A native <strong className="text-white/75">desktop app</strong> (Windows/macOS/Linux) is also possible via
              the Tauri scaffold — see <code className="text-amber-200">docs/DISTRIBUTION.md</code>. Distributed games
              open editor-free: they boot straight to the title screen.
            </p>
          </Section>

          <Section title="Importing .epochmap files">
            <ul className="list-disc pl-5 space-y-1">
              <li>Drag a .epochmap file onto the app, or use File → Import. Custom marker definitions load automatically.</li>
              <li>
                A whole game — every map, the full ruleset, baked audio, and custom markers — rides inside one compact
                <code className="text-amber-200"> .epochmap</code>. Games built on the stock ruleset stay tiny (well
                under 1 KB), so they are easy to share, host, or bake into a standalone build.
              </li>
            </ul>
          </Section>

          <Section title="Keyboard shortcuts">
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {KEYS.map(([key, action], i) => (
                    <tr key={key} className={i % 2 ? 'bg-white/[0.02]' : ''}>
                      <td className="px-3 py-1.5 font-mono text-amber-200 whitespace-nowrap align-top w-44">{key}</td>
                      <td className="px-3 py-1.5 text-white/70">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="sticky bottom-0 px-6 py-4 border-t border-white/10 bg-zinc-950/95 backdrop-blur flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
          >
            Start mapping
          </button>
        </div>
      </div>
    </div>
  )
}
