'use client'

import { X } from 'lucide-react'

const KEYS: Array<[string, string]> = [
  ['Arrow keys / WASD', 'Move player (and face that direction)'],
  ['Q / E', 'Turn the first-person view left / right'],
  ['F', 'Toggle fog of war reveal for current cell'],
  ['N', 'Add / edit note on current cell'],
  ['Z / Ctrl+Z', 'Undo last cell edit'],
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
          <h2 className="text-lg font-bold text-white">Welcome to Epoch Mapper</h2>
          <button
            onClick={onClose}
            className="grid place-items-center h-8 w-8 rounded-md text-white/50 hover:text-white hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Section title="What is Epoch Mapper?">
            <p>
              Epoch Mapper is a free, open-source dungeon and world map editor built for retro gaming. Draw room
              layouts, mark shops, inns, bosses, and points of interest as you explore a game. Export your maps as a
              beautifully formatted PDF or as a compact <code className="text-amber-200">.epochmap</code> file you can
              share with other players. If you use the Epoch game library, your maps sync to your profile and are always
              one click away from your game drawer.
            </p>
          </Section>

          <Section title="How maps are organized">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You can have <strong className="text-white/85">multiple maps per session</strong> (e.g., Floor 1, Floor
                2, World Map). Maps are listed in the left panel.
              </li>
              <li>Each map has an infinite grid. You never run out of space — the viewport follows your player marker.</li>
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
                <strong className="text-white/85">Overlays</strong> are icons placed on top of a cell: NPC, Shop, Inn,
                Boss, Chest, Trap, Save Point, Note, and any custom markers you create.
              </li>
              <li>A single cell can hold multiple overlays (e.g., a Boss room with a Chest).</li>
              <li>Each overlay type has a distinct icon and color.</li>
            </ul>
          </Section>

          <Section title="Edges">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-white/85">Edges</strong> mark the borders of a cell: one-way doors, locked
                doors, illusory walls, damage floors, etc.
              </li>
              <li>Each of the four sides (N, S, E, W) can be independently marked.</li>
              <li>Edges appear as colored lines on the cell border.</li>
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

          <Section title="First-person view (crawler)">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Toggle <strong className="text-white/85">Show first-person view</strong> to open a resizable retro
                3D-style viewport that renders the dungeon from the player&apos;s cell and facing — walls, floors, and
                overlays drawn as you explore.
              </li>
              <li>Moving with WASD/arrows faces that direction; <strong className="text-white/85">Q/E</strong> turn in place. Drag the panel&apos;s left edge to resize it.</li>
              <li>
                Flip the panel to <strong className="text-white/85">Explore</strong> mode to enable wall/floor physics:
                you can&apos;t walk through walls or step onto a cell with no floor tile placed. <strong className="text-white/85">Edit</strong> mode keeps placement free.
              </li>
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

          <Section title="Exporting">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-white/85">Export PDF</strong>: a print-ready PDF with a parchment border,
                per-page legend, coordinate rulers, and a notes index. Each map becomes a page.
              </li>
              <li>
                <strong className="text-white/85">Export .epochmap</strong>: a compact binary file containing all your
                maps, custom markers, notes, fog-of-war state, and the game association (title + ROM hash if known).
                Share it with other players.
              </li>
            </ul>
          </Section>

          <Section title="Importing .epochmap files">
            <ul className="list-disc pl-5 space-y-1">
              <li>Drag a .epochmap file onto the app, or use File → Import. Custom marker definitions load automatically.</li>
              <li>
                If you are using Epoch (the game library), importing a map also saves it to your profile database and
                attaches it to the matching game.
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
