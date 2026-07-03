'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, MapPin, Eraser, X, Search, Pipette } from 'lucide-react'
import { toast } from 'sonner'
import { cn, uid } from '@/lib/utils'
import {
  BASE, BASE_PALETTE, BASE_TYPES, CHUNK_SIZE, DEFAULT_CELL, EDGE, EDGE_PALETTE, EDGE_TYPES,
  MAX_CELL, MAX_NOTE_LEN, MIN_CELL, OVERLAY_PALETTE, OVERLAY_TYPES, VIEWPORT_CELLS,
  baseDef, boundaryKey, edgeDef, overlayDef,
} from '@/lib/constants'
import type { CellData, CellMap, CustomMarker, EdgeDir, EpochmapFile, MapData, MarkerDef, SubcubeObject } from '@/lib/types'
import { getTheme } from '@/lib/themes'
import { parseDotEpochmap, serializeDotEpochmap } from '@/lib/epochmap-codec'
import { resolveMarkerImport, remapMapMarkers } from '@/lib/markers'
import { exportMapsAsPdf } from '@/lib/dungeon-export'
import { Map, Database, Users, Play, Settings } from 'lucide-react'
import { Toolbar } from './Toolbar'
import { WelcomeModal } from './WelcomeModal'
import { NewMapModal } from './NewMapModal'
import { buildBaseMap, buildGeneratedWorld, type NewMapConfig } from '@/lib/map-generator'
import { CellTooltip } from './CellTooltip'
import { MarkerPalette } from './MarkerPalette'
import { PartyWorkspace } from './workspaces/PartyWorkspace'
import { DatabaseWorkspace } from './workspaces/DatabaseWorkspace'
import { PlayWorkspace } from './workspaces/PlayWorkspace'
import { SettingsWorkspace } from './workspaces/SettingsWorkspace'
import type { BoundaryData, Character, CellEntity, DoorDef, DoorState, Facing, Formation, ItemInstance, ResolvedEncounter, Ruleset, SwitchDef } from '@/lib/engine-types'
import { makeDefaultRuleset, normalizeRuleset } from '@/lib/default-ruleset'
import { savePartyTemplate, loadPartyTemplate } from '@/lib/save-state'
import { checkCellForEncounter, resolveEncounterTable, visitedFlagKey } from '@/lib/encounter-engine'
import { EncounterModal } from './EncounterModal'
import { DialogueOverlay } from './DialogueOverlay'
import { initCombat, applyCombatOutcome, consumeCombatItems, type CombatState } from '@/lib/combat-engine'
import { CellInspector } from './CellInspector'
import { ShopModal } from './ShopModal'
import { runCellEvents, applyFlagWriteWithReactions, resolveExploreEffects, pickNpcLine, finishNpcLine, getInteractableObjects, objectUsedFlagKey, resolveLootTable, effectiveDoorState, type ExploreEffect, type EventContext } from '@/lib/event-engine'

const DRAFT_KEY = 'epochmapper.draft'
const WELCOME_KEY = 'epochmapper.welcomed'
const NEXTID_KEY = 'epochmapper.nextMarkerId'
const CUSTOM_ID_START = 128

// ── Tool model ─────────────────────────────────────────────────────────────────

type Tool =
  | { kind: 'base'; value: number }
  | { kind: 'overlay'; value: number }
  | { kind: 'edge'; value: number }
  | { kind: 'erase' }
  | { kind: 'player' }
  | { kind: 'inspect' }
  | { kind: 'eyedropper'; sample: CellData | null; sourceKey: string | null }

function toolId(t: Tool): string {
  if (t.kind === 'erase' || t.kind === 'player' || t.kind === 'inspect' || t.kind === 'eyedropper') return t.kind
  return `${t.kind}:${t.value}`
}

function stampCell(sample: CellData): CellData {
  const entities = sample.entities?.map(ent => {
    if (ent.t === 'object') return { ...ent, object: { ...ent.object, id: uid() } }
    if (ent.t === 'event')  return { ...ent, event:  { ...ent.event,  id: uid() } }
    return ent
  })
  const out: CellData = { base: sample.base, overlays: [...sample.overlays] }
  if (entities?.length) out.entities = entities
  if (sample.note) out.note = sample.note
  return out
}

// ── Cell helpers ───────────────────────────────────────────────────────────────

const EMPTY_CELL: CellData = { base: 0, overlays: [] }

function isCellEmpty(c: CellData) {
  return (c.base ?? 0) === 0 && c.overlays.length === 0 && !c.note && !c.entities?.length
}

function getEdgeDir(relX: number, relY: number): EdgeDir | null {
  if (relY < 0.25) return 'N'
  if (relY > 0.75) return 'S'
  if (relX < 0.25) return 'W'
  if (relX > 0.75) return 'E'
  return null
}

// ── Chunk / fog helpers ────────────────────────────────────────────────────────

function cellChunk(x: number, y: number) {
  return { cx: Math.floor(x / CHUNK_SIZE), cy: Math.floor(y / CHUNK_SIZE) }
}
function chunkKey(cx: number, cy: number) {
  return `${cx},${cy}`
}

function newMap(name: string): MapData {
  return { id: uid(), name, cells: {}, playerX: 0, playerY: 0, revealedChunks: [chunkKey(0, 0)] }
}

function newSession(): EpochmapFile {
  return { version: 1, gameTitle: '', romHash: '', customMarkers: [], maps: [newMap('Map 1')] }
}

// ── Edge stripe ────────────────────────────────────────────────────────────────

function EdgeStripe({ dir, type, cellSize, hasSwitch }: { dir: EdgeDir; type: number; cellSize: number; hasSwitch?: boolean }) {
  const color = edgeDef(type).color
  const w = Math.max(2, Math.round(cellSize / 8))
  const gap = type === 0 ? 0 : Math.round(cellSize * 0.18)
  const style: React.CSSProperties = { position: 'absolute', backgroundColor: color, pointerEvents: 'none' }
  if (dir === 'N') Object.assign(style, { top: 0, left: gap, right: gap, height: w })
  if (dir === 'S') Object.assign(style, { bottom: 0, left: gap, right: gap, height: w })
  if (dir === 'W') Object.assign(style, { left: 0, top: gap, bottom: gap, width: w })
  if (dir === 'E') Object.assign(style, { right: 0, top: gap, bottom: gap, width: w })
  if (!hasSwitch) return <div style={style} />
  const dotSize = Math.max(4, Math.round(cellSize / 5))
  const dot: React.CSSProperties = {
    position: 'absolute', width: dotSize, height: dotSize, borderRadius: '9999px',
    backgroundColor: 'hsl(44 90% 55%)', border: '1px solid rgba(0,0,0,0.6)',
    pointerEvents: 'none', zIndex: 12,
  }
  if (dir === 'N') Object.assign(dot, { top: -dotSize / 2 + w / 2, left: '50%', transform: 'translateX(-50%)' })
  if (dir === 'S') Object.assign(dot, { bottom: -dotSize / 2 + w / 2, left: '50%', transform: 'translateX(-50%)' })
  if (dir === 'W') Object.assign(dot, { left: -dotSize / 2 + w / 2, top: '50%', transform: 'translateY(-50%)' })
  if (dir === 'E') Object.assign(dot, { right: -dotSize / 2 + w / 2, top: '50%', transform: 'translateY(-50%)' })
  return <><div style={style} /><div style={dot} /></>
}

function edgeZoneStyle(zone: EdgeDir): React.CSSProperties {
  switch (zone) {
    case 'N': return { top: 0, left: 0, right: 0, height: '25%' }
    case 'S': return { bottom: 0, left: 0, right: 0, height: '25%' }
    case 'W': return { top: 0, left: 0, bottom: 0, width: '25%' }
    case 'E': return { top: 0, right: 0, bottom: 0, width: '25%' }
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface DungeonMapperProps {
  /**
   * `'fill'` (standalone) sizes the grid to the available screen area — zoom
   * changes how many cells are visible. `'fixed'` (default, used when embedding
   * the component, e.g. in Epoch's game drawer) renders the locked 12×12 window.
   */
  layout?: 'fill' | 'fixed'
  /**
   * Seed the editor from an existing session instead of the localStorage draft.
   * When provided, the welcome modal and draft restore are skipped and the host
   * owns persistence (see `onSessionChange`).
   */
  initialSession?: EpochmapFile
  /**
   * Called (debounced) whenever the session changes. When provided, the
   * component does NOT write the localStorage draft — the host persists instead
   * (e.g. Epoch saves to the DungeonMap table).
   */
  onSessionChange?: (session: EpochmapFile) => void
  /** Show the first-visit welcome modal in standalone mode. Default true. */
  welcomeOnFirstVisit?: boolean
}

export function DungeonMapper({
  layout = 'fixed',
  initialSession,
  onSessionChange,
  welcomeOnFirstVisit = true,
}: DungeonMapperProps = {}) {
  const controlled = !!onSessionChange || !!initialSession
  const [gameTitle, setGameTitle] = useState('')
  const [romHash, setRomHash] = useState('')
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([])
  const [maps, setMaps] = useState<MapData[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  const [activeTool, setActiveTool] = useState<Tool>({ kind: 'base', value: BASE.FLOOR })
  const [bumpTrigger, setBumpTrigger] = useState(0)
  const [cellSize, setCellSize] = useState(DEFAULT_CELL)
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  // 'session' = triggered by toolbar New (clears all), 'add' = triggered by map-list +
  const [newMapMode, setNewMapMode] = useState<'session' | 'add' | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteSelectId, setPaletteSelectId] = useState<number | undefined>(undefined)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: CellData; isPlayer: boolean; cellBoundaries?: Partial<Record<EdgeDir, BoundaryData>> } | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; zone: EdgeDir | null } | null>(null)
  const [noteDialog, setNoteDialog] = useState<{ x: number; y: number; text: string } | null>(null)
  const [inspectedBoundary, setInspectedBoundary] = useState<{ bk: string; x: number; y: number; dir: EdgeDir; boundary: BoundaryData } | null>(null)

  const panOriginRef = useRef({ x: 0, y: 0 })
  const pixelAccumRef = useRef({ x: 0, y: 0 })
  const mapperHoveredRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileModeRef = useRef<'open' | 'import'>('open')
  const historyRef = useRef<MapData[][]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextMarkerIdRef = useRef(CUSTOM_ID_START)
  const [canUndo, setCanUndo] = useState(false)
  const [viewportRef, viewportSize] = useElementSize<HTMLElement>()

  // Activity-bar workspace
  type Workspace = 'map' | 'database' | 'party' | 'play' | 'settings'
  const [workspace, setWorkspace] = useState<Workspace>('map')
  const workspaceRef = useRef<Workspace>('map')
  workspaceRef.current = workspace
  const [ruleset, setRuleset] = useState<Ruleset>(() => makeDefaultRuleset())
  const [party, setParty] = useState<Character[]>([])
  const [formation, setFormation] = useState<Formation>({ front: [], back: [] })
  const [inventory, setInventory] = useState<ItemInstance[]>([])
  const [gold, setGold] = useState<number>(100)
  const [flags, setFlags] = useState<Record<string, boolean | number | string>>({})
  const [activeEncounter, setActiveEncounter] = useState<ResolvedEncounter | null>(null)
  const [combatState, setCombatState] = useState<CombatState | null>(null)
  const handleCombatAction = useCallback((next: CombatState) => setCombatState(next), [])
  const [inspectedCell, setInspectedCell] = useState<{ x: number; y: number } | null>(null)
  const [shopId, setShopId] = useState<string | null>(null)
  const [facing, setFacing] = useState<Facing>('N')
  const facingRef = useRef<Facing>('N')
  facingRef.current = facing

  const [revealedBoundaries, setRevealedBoundaries] = useState<Set<string>>(() => new Set())
  const revealedBoundariesRef = useRef<Set<string>>(new Set())
  revealedBoundariesRef.current = revealedBoundaries

  // Refs so the keyboard handler can read current modal state without stale closures
  const combatStateRef = useRef<CombatState | null>(null)
  combatStateRef.current = combatState
  const flagsRef = useRef<Record<string, boolean | number | string>>({})
  flagsRef.current = flags
  const [dialogue, setDialogue] = useState<{ npcId: string; lineId: string } | null>(null)
  const dialogueRef = useRef<typeof dialogue>(null)
  dialogueRef.current = dialogue
  // Barks fire once per session per line (heard-flags handle 'once' lines)
  const sessionBarksRef = useRef<Set<string>>(new Set())

  const shopIdRef = useRef<string | null>(null)
  shopIdRef.current = shopId
  const activeEncounterRef = useRef<ResolvedEncounter | null>(null)
  activeEncounterRef.current = activeEncounter

  // Load persisted party template on mount
  useEffect(() => {
    const saved = loadPartyTemplate()
    if (saved) { setParty(saved.party); setFormation(saved.formation) }
  }, [])

  const activeMap = maps[activeIdx] ?? null

  const customBase = useMemo(() => {
    const t: Record<number, MarkerDef> = {}
    for (const m of customMarkers) if (m.kind === 'base') t[m.id] = { id: m.id, label: m.label, color: m.color, icon: m.icon }
    return t
  }, [customMarkers])
  const customOverlay = useMemo(() => {
    const t: Record<number, MarkerDef> = {}
    for (const m of customMarkers) if (m.kind === 'overlay') t[m.id] = { id: m.id, label: m.label, color: m.color, icon: m.icon }
    return t
  }, [customMarkers])

  const revealedSet = useMemo(() => new Set(activeMap?.revealedChunks ?? []), [activeMap])

  // ── Hydration: host session, restored draft, or fresh ─────────────────────────
  useEffect(() => {
    let restored: EpochmapFile | null = null
    if (initialSession) {
      // Host-provided session (embedded / DB-backed). Ensure at least one map.
      restored = initialSession.maps?.length ? initialSession : { ...initialSession, maps: newSession().maps }
    } else {
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as EpochmapFile
          if (parsed?.maps?.length) restored = parsed
        }
      } catch {
        /* ignore corrupt draft */
      }
    }
    const session = restored ?? newSession()
    setGameTitle(session.gameTitle ?? '')
    setRomHash(session.romHash ?? '')
    setCustomMarkers(session.customMarkers ?? [])
    setMaps(session.maps)
    if (session.ruleset) setRuleset(normalizeRuleset(session.ruleset))
    setActiveIdx(0)
    // Custom marker IDs are monotonic within a session and never reused (§5.3).
    // Recover the counter from a persisted value, falling back to max(used)+1.
    const usedMax = (session.customMarkers ?? []).reduce((mx, m) => Math.max(mx, m.id), CUSTOM_ID_START - 1)
    let stored = CUSTOM_ID_START
    try {
      stored = parseInt(localStorage.getItem(NEXTID_KEY) ?? '', 10)
      if (!Number.isFinite(stored)) stored = CUSTOM_ID_START
    } catch {
      stored = CUSTOM_ID_START
    }
    nextMarkerIdRef.current = Math.max(stored, usedMax + 1, CUSTOM_ID_START)
    setHydrated(true)
    if (restored && !initialSession) {
      setTimeout(() => toast('Restored unsaved session'), 50)
    }
    if (!controlled && welcomeOnFirstVisit) {
      try {
        if (!localStorage.getItem(WELCOME_KEY)) setShowWelcome(true)
      } catch {
        /* ignore */
      }
    }
    // Mount-once hydration; props captured intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-save (debounced 500ms): host callback, else localStorage draft ────────
  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const session: EpochmapFile = { version: 2, gameTitle, romHash, customMarkers, maps, ruleset }
      if (onSessionChange) {
        onSessionChange(session)
        return
      }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(session))
      } catch {
        /* storage full / unavailable */
      }
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [maps, gameTitle, romHash, customMarkers, ruleset, hydrated, onSessionChange])

  // ── Map mutation helpers ──────────────────────────────────────────────────────

  const updateActiveMap = useCallback(
    (patch: Partial<MapData> | ((m: MapData) => Partial<MapData>)) => {
      setMaps((prev) =>
        prev.map((m, i) => {
          if (i !== activeIdx) return m
          const p = typeof patch === 'function' ? patch(m) : patch
          return { ...m, ...p }
        }),
      )
    },
    [activeIdx],
  )

  const recordHistory = useCallback(() => {
    historyRef.current.push(maps)
    if (historyRef.current.length > 60) historyRef.current.shift()
    setCanUndo(true)
  }, [maps])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (prev) {
      setMaps(prev)
      setCanUndo(historyRef.current.length > 0)
    }
  }, [])

  // ── Fog reveal ────────────────────────────────────────────────────────────────

  const revealAround = useCallback((map: MapData, x: number, y: number): string[] => {
    const { cx, cy } = cellChunk(x, y)
    const lx = x - cx * CHUNK_SIZE
    const ly = y - cy * CHUNK_SIZE
    const toReveal = [chunkKey(cx, cy)]
    if (lx === 0) toReveal.push(chunkKey(cx - 1, cy))
    if (lx === CHUNK_SIZE - 1) toReveal.push(chunkKey(cx + 1, cy))
    if (ly === 0) toReveal.push(chunkKey(cx, cy - 1))
    if (ly === CHUNK_SIZE - 1) toReveal.push(chunkKey(cx, cy + 1))
    const set = new Set(map.revealedChunks ?? [])
    let changed = false
    for (const k of toReveal) if (!set.has(k)) { set.add(k); changed = true }
    return changed ? [...set] : (map.revealedChunks ?? [])
  }, [])

  const applyExploreEffect = useCallback((result: ExploreEffect) => {
    if (Object.keys(result.flagSets).length > 0) {
      setFlags(prev => ({ ...prev, ...result.flagSets }))
    }
    result.messages.forEach(msg => toast(msg))
    if (result.goldDelta !== 0) {
      setGold(g => g + result.goldDelta)
    }
    if (result.itemsGained.length > 0) {
      setInventory(prev => {
        let inv = [...prev]
        for (const { item, qty } of result.itemsGained) {
          const idx = inv.findIndex(i => i.def === item)
          if (idx >= 0) inv[idx] = { ...inv[idx], qty: inv[idx].qty + qty }
          else inv = [...inv, { def: item, qty }]
        }
        return inv
      })
    }
    if (result.itemsLost.length > 0) {
      setInventory(prev =>
        prev
          .map(i => {
            const lost = result.itemsLost.find(l => l.item === i.def)
            return lost ? { ...i, qty: i.qty - lost.qty } : i
          })
          .filter(i => i.qty > 0),
      )
    }
    if (result.teleportTo) {
      const { x, y } = result.teleportTo
      updateActiveMap((m) => ({ playerX: x, playerY: y, revealedChunks: revealAround(m, x, y) }))
      setCameraOffset({ x: 0, y: 0 })
    }
    if (result.openShop) {
      setShopId(result.openShop)
    }
    if (result.dialogueNode) {
      const def = (ruleset.npcs ?? []).find(n => n.id === result.dialogueNode)
      if (def) {
        const mergedCtx = { ...makeEventContext(), flags: { ...flagsRef.current, ...result.flagSets } }
        const line = pickNpcLine(def, mergedCtx)
        if (line) setDialogue({ npcId: def.id, lineId: line.id })
      }
    }
    for (const qu of result.questUpdates) {
      const q = (ruleset.quests ?? []).find(x => x.id === qu.quest)
      const done = q && qu.stage >= q.stages.length
      toast(done ? `📜 Quest complete — ${q?.name ?? qu.quest}` : `📜 Journal updated — ${q?.name ?? qu.quest}`)
    }
    if (result.npcMoves.length > 0) {
      setMaps(prev => prev.map(m => {
        let changed = false
        const cells = { ...m.cells }
        let carried: import('@/lib/engine-types').CellEntity | null = null
        // Strip the NPC from any cell it currently occupies
        for (const move of result.npcMoves) {
          for (const [key, cell] of Object.entries(cells)) {
            const idx = (cell.entities ?? []).findIndex(
              e => e.t === 'object' && e.object.kind === 'npc' && e.object.npc === move.npc,
            )
            if (idx >= 0) {
              carried = cell.entities![idx]
              cells[key] = { ...cell, entities: cell.entities!.filter((_, i) => i !== idx) }
              changed = true
            }
          }
          // Insert at destination if this map is the target
          const targetHere = move.mapId ? m.id === move.mapId : m.id === (prev.find(mm => mm.id === m.id)?.id)
          const isDest = move.mapId ? m.id === move.mapId : true
          if (isDest && carried) {
            const dk = `${move.x},${move.y}`
            const dest = cells[dk] ?? { base: 1, overlays: [] }
            cells[dk] = { ...dest, entities: [...(dest.entities ?? []), carried] }
            carried = null
            changed = true
          }
          void targetHere
        }
        return changed ? { ...m, cells } : m
      }))
    }
    if (result.startCombat) {
      const tableId = result.startCombat
      const table = ruleset.encounterTables.find(t => t.id === tableId)
      if (table) {
        const enemies = resolveEncounterTable(table, ruleset, Math.random)
        if (enemies.length > 0) {
          setActiveEncounter({
            tableId: table.id,
            tableName: table.name,
            enemies,
            xpReward: enemies.reduce((s, e) => s + e.xp, 0),
            goldReward: enemies.reduce((s, e) => s + e.gold, 0),
          })
        }
      }
    }
    // Reveal a radius around the player (e.g. a "light" spell effect)
    if (result.revealRadius && result.revealRadius > 0) {
      updateActiveMap(m => {
        let chunks = new Set(m.revealedChunks ?? [])
        const r = result.revealRadius!
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) + Math.abs(dy) <= r) {
              const nx = m.playerX + dx; const ny = m.playerY + dy
              const { cx, cy } = { cx: Math.floor(nx / CHUNK_SIZE), cy: Math.floor(ny / CHUNK_SIZE) }
              chunks = new Set([...chunks, `${cx},${cy}`])
            }
          }
        }
        return { revealedChunks: [...chunks] }
      })
    }
    // Out-of-combat healing effects: fullHeal / heal / restoreMp
    if (result.flagSets['_fullHeal']) {
      setParty(prev => prev.map(c => c.alive ? { ...c, hp: c.maxHp, mp: c.maxMp } : c))
    } else {
      const healAmt  = result.flagSets['_heal']    ? Number(result.flagSets['_heal'])    : 0
      const mpAmt    = result.flagSets['_restoreMp'] ? Number(result.flagSets['_restoreMp']) : 0
      if (healAmt > 0 || mpAmt > 0) {
        setParty(prev => prev.map(c => {
          if (!c.alive) return c
          return {
            ...c,
            hp: healAmt  > 0 ? Math.min(c.maxHp, c.hp + healAmt)  : c.hp,
            mp: mpAmt    > 0 ? Math.min(c.maxMp, c.mp + mpAmt)    : c.mp,
          }
        }))
      }
    }
  }, [updateActiveMap, revealAround, ruleset, setInventory, setGold, setFlags, setShopId, setActiveEncounter, setParty, setMaps])

  const makeEventContext = useCallback((): EventContext => ({
    flags,
    party,
    inventory,
    gold,
  }), [flags, party, inventory, gold])

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      if (!activeMap) return

      // Block movement through impassable boundaries (walls, closed/locked doors)
      const moveDir: EdgeDir | null = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : dy === -1 ? 'N' : null
      if (moveDir !== null && activeMap.boundaries) {
        const bk = boundaryKey(activeMap.playerX, activeMap.playerY, moveDir)
        const b = activeMap.boundaries[bk]
        if (b) {
          const illusoryRevealed = b.wall === EDGE.ILLUSORY && revealedBoundariesRef.current.has(bk)
          const isDoorEdge = b.wall === EDGE.DOOR
          const doorOpen = b.door ? effectiveDoorState(b.door, flagsRef.current) === 'open' : false
          const wallBlocked = b.wall !== undefined && b.wall !== EDGE.ILLUSORY && !(isDoorEdge && doorOpen)
          const illusoryBlocked = b.wall === EDGE.ILLUSORY && !illusoryRevealed
          const doorBlocked = !isDoorEdge && b.door !== undefined && !doorOpen
          if (wallBlocked || illusoryBlocked || doorBlocked) return
        }
      }

      const nx = activeMap.playerX + dx
      const ny = activeMap.playerY + dy

      // Block movement into impassable terrain cells
      const destBase = activeMap.cells[`${nx},${ny}`]?.base ?? 0
      const TERRAIN_MSG: Partial<Record<number, string>> = {
        [BASE.WATER]: 'The water blocks your path.',
        [BASE.LAVA]:  'You cannot enter the lava!',
        [BASE.VOID]:  'Only darkness lies below.',
        [BASE.WALL]:  'Something invisible stops you.',
      }
      if (destBase in TERRAIN_MSG) {
        toast(TERRAIN_MSG[destBase]!)
        setBumpTrigger(t => t + 1)
        return
      }

      updateActiveMap((m) => ({ playerX: nx, playerY: ny, revealedChunks: revealAround(m, nx, ny) }))
      setCameraOffset({ x: 0, y: 0 })

      const cellKey = `${nx},${ny}`
      const cell = activeMap.cells[cellKey]
      if (cell) {
        // Encounter check
        const encounter = checkCellForEncounter(cell, flags, ruleset, Math.random)
        if (encounter) {
          setActiveEncounter(encounter)
          const visitedKey = visitedFlagKey(encounter.tableId, nx, ny)
          setFlags(prev => ({ ...prev, [visitedKey]: true }))
        }

        // mapLink: teleport to another map
        const mapLink = cell.entities?.find(e => e.t === 'mapLink')
        if (mapLink && mapLink.t === 'mapLink') {
          const targetIdx = maps.findIndex(m => m.id === mapLink.mapId)
          if (targetIdx >= 0) {
            setActiveIdx(targetIdx)
            setMaps(prev => prev.map((m, i) => {
              if (i !== targetIdx) return m
              return { ...m, playerX: mapLink.x, playerY: mapLink.y, revealedChunks: revealAround(m, mapLink.x, mapLink.y) }
            }))
            if (mapLink.facing) setFacing(mapLink.facing)
            setCameraOffset({ x: 0, y: 0 })
            return
          }
        }

        // onEnter events — sequential, with reactive onFlag expansion
        const ctx = makeEventContext()
        applyExploreEffect(runCellEvents(cell, 'onEnter', ctx, ruleset))
      }
    },
    [activeMap, maps, updateActiveMap, revealAround, ruleset, flags, makeEventContext, applyExploreEffect, setActiveIdx, setFacing],
  )

  // ── Blobber movement ──────────────────────────────────────────────────────────

  const TURN_LEFT: Record<Facing, Facing> = { N: 'W', W: 'S', S: 'E', E: 'N' }
  const TURN_RIGHT: Record<Facing, Facing> = { N: 'E', E: 'S', S: 'W', W: 'N' }
  const FORWARD_DXY: Record<Facing, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }

  const turnLeft = useCallback(() => setFacing(f => TURN_LEFT[f]), [])
  const turnRight = useCallback(() => setFacing(f => TURN_RIGHT[f]), [])
  const stepForward = useCallback(() => {
    const [dx, dy] = FORWARD_DXY[facingRef.current]
    movePlayer(dx, dy)
  }, [movePlayer])
  const stepBack = useCallback(() => {
    const [dx, dy] = FORWARD_DXY[facingRef.current]
    movePlayer(-dx, -dy)
  }, [movePlayer])

  // ── NPC barks: ambient lines when an NPC comes into view (cell ahead) ───────
  useEffect(() => {
    if (!activeMap || combatStateRef.current || dialogueRef.current) return
    const [fdx, fdy] = FORWARD_DXY[facing]
    const aheadCell = activeMap.cells[`${activeMap.playerX + fdx},${activeMap.playerY + fdy}`]
    if (!aheadCell?.entities?.length) return
    for (const ent of aheadCell.entities) {
      if (ent.t !== 'object' || ent.object.kind !== 'npc' || !ent.object.npc) continue
      const def = (ruleset.npcs ?? []).find(n => n.id === ent.object.npc)
      if (!def) continue
      const ctx = makeEventContext()
      const line = pickNpcLine(def, ctx, { bark: true })
      if (!line) continue
      const sessionKey = `${def.id}.${line.id}`
      if (sessionBarksRef.current.has(sessionKey)) continue
      sessionBarksRef.current.add(sessionKey)
      toast(`${def.portrait ?? '🧑'} ${def.name}: “${line.text[0]}”`)
      applyExploreEffect(finishNpcLine(def, line, aheadCell, ctx, ruleset))
      break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMap?.playerX, activeMap?.playerY, facing])

  const handleInteract = useCallback(() => {
    if (!activeMap) return

    const facingDir = facingRef.current as EdgeDir
    const bk = boundaryKey(activeMap.playerX, activeMap.playerY, facingDir)
    const boundary = activeMap.boundaries?.[bk]

    // ── Priority 1: facing boundary ───────────────────────────────────────────
    if (boundary) {
      // Illusory wall reveal
      if (boundary.wall === 3 && !revealedBoundariesRef.current.has(bk)) {
        setRevealedBoundaries(prev => { const s = new Set(prev); s.add(bk); return s })
        toast('The wall shimmers and fades...')
        return
      }
      // Wall switch — usable from the mounted side only
      if (boundary.switch) {
        const sw = boundary.switch
        const OPP: Record<EdgeDir, EdgeDir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
        if (sw.facing === OPP[facingDir]) {
          const wasOn = !!flags[sw.flag]
          if (sw.mode === 'once' && wasOn) {
            toast('The lever is stuck fast.')
            return
          }
          const curCell = activeMap.cells[`${activeMap.playerX},${activeMap.playerY}`] ?? null
          applyExploreEffect(applyFlagWriteWithReactions(sw.flag, !wasOn, curCell, makeEventContext(), ruleset))
          toast(wasOn
            ? 'You hear a heavy thud echo through the halls…'
            : 'You hear something click in the distance…')
          return
        }
      }

      // Door interaction
      if (boundary.door) {
        const door = boundary.door
        const eff = effectiveDoorState(door, flags)
        // Switch-sealed doors are driven by their flags, not manual opening
        if ((door.requiredFlags?.length || door.keyFlag) && door.state !== 'open') {
          if (eff === 'open') {
            toast('The door is held open by some mechanism.')
          } else if (door.keyItem && inventory.some(item => item.def === door.keyItem)) {
            updateActiveMap(m => ({
              boundaries: { ...(m.boundaries ?? {}), [bk]: { ...boundary, door: { ...door, state: 'open' as const } } }
            }))
            toast('Door unlocked!')
          } else {
            toast('The door is sealed shut. Something must unlock it…')
          }
          return
        }
        if (door.state === 'closed') {
          updateActiveMap(m => ({
            boundaries: { ...(m.boundaries ?? {}), [bk]: { ...boundary, door: { ...door, state: 'open' as const } } }
          }))
          toast('The door creaks open.')
          return
        } else if (door.state === 'open') {
          updateActiveMap(m => ({
            boundaries: { ...(m.boundaries ?? {}), [bk]: { ...boundary, door: { ...door, state: 'closed' as const } } }
          }))
          toast('The door swings shut.')
          return
        } else if (door.state === 'locked') {
          if (door.keyItem && inventory.some(item => item.def === door.keyItem)) {
            updateActiveMap(m => ({
              boundaries: { ...(m.boundaries ?? {}), [bk]: { ...boundary, door: { ...door, state: 'open' as const } } }
            }))
            toast('Door unlocked!')
          } else {
            toast('This door is locked.')
          }
          return
        }
      }
    }

    const [fdx, fdy] = FORWARD_DXY[facingRef.current]
    const aheadX = activeMap.playerX + fdx
    const aheadY = activeMap.playerY + fdy
    const aheadKey = `${aheadX},${aheadY}`
    const aheadCell = activeMap.cells[aheadKey]
    const ctx = makeEventContext()

    // ── Priority 2: cell one step ahead — objects (chests, NPCs, shops, levers) ─
    if (aheadCell) {
      const aheadObjects = getInteractableObjects(aheadCell)
      for (const obj of aheadObjects) {
        // Chest
        if (obj.kind === 'chest') {
          const flagKey = objectUsedFlagKey(obj.id)
          if (flags[flagKey]) {
            toast('The chest is empty.')
            return
          }
          if (obj.locked?.key) {
            const hasKey = inventory.some(i => i.def === obj.locked!.key)
            if (!hasKey) {
              const keyName = ruleset.items.find(i => i.id === obj.locked!.key)?.name ?? obj.locked.key
              toast(`This chest requires: ${keyName}`)
              return
            }
          }
          if (!obj.loot) {
            setFlags(prev => ({ ...prev, [flagKey]: true }))
            toast('The chest is empty.')
            return
          }
          const result = resolveLootTable(obj.loot, ruleset)
          setFlags(prev => ({ ...prev, [flagKey]: true }))
          if (result.gold > 0) setGold(g => g + result.gold)
          if (result.items.length > 0) {
            setInventory(prev => {
              let inv = [...prev]
              for (const { item, qty } of result.items) {
                const idx = inv.findIndex(i => i.def === item)
                if (idx >= 0) inv[idx] = { ...inv[idx], qty: inv[idx].qty + qty }
                else inv = [...inv, { def: item, qty }]
              }
              return inv
            })
          }
          const parts: string[] = []
          for (const { item, qty } of result.items) {
            const def = ruleset.items.find(i => i.id === item)
            parts.push(`${qty > 1 ? `${qty}× ` : ''}${def?.name ?? item}`)
          }
          if (result.gold > 0) parts.push(`${result.gold} gold`)
          toast(parts.length > 0 ? `Found: ${parts.join(', ')}!` : 'The chest is empty.')
          return
        }
        // Generic onInteract effects
        if (obj.onInteract?.length) {
          const result = resolveExploreEffects(obj.onInteract, ctx, Math.random, ruleset)
          applyExploreEffect(result)
          return
        }
        if (obj.kind === 'npc' && obj.npc) {
          const def = (ruleset.npcs ?? []).find(n => n.id === obj.npc)
          if (def) {
            const line = pickNpcLine(def, ctx)
            if (line) setDialogue({ npcId: def.id, lineId: line.id })
            else toast(`${def.name} has nothing more to say.`)
            return
          }
        }
        if (obj.shop) { setShopId(obj.shop); return }
        if (obj.dialogue) { toast(obj.dialogue); return }
      }
    }

    // ── Priority 3: current cell — onInteract events ──────────────────────────
    const cellKey = `${activeMap.playerX},${activeMap.playerY}`
    const cell = activeMap.cells[cellKey]
    if (!cell) return

    const interactResult = runCellEvents(cell, 'onInteract', ctx, ruleset)
    const interactedSomething =
      Object.keys(interactResult.flagSets).length > 0 ||
      interactResult.messages.length > 0 ||
      interactResult.goldDelta !== 0 ||
      interactResult.itemsGained.length > 0 ||
      interactResult.teleportTo !== undefined ||
      interactResult.startCombat !== undefined ||
      interactResult.openShop !== undefined ||
      interactResult.dialogueNode !== undefined
    if (interactedSomething) {
      applyExploreEffect(interactResult)
      return
    }

    // Current cell objects (fallback)
    const objects = getInteractableObjects(cell)
    for (const obj of objects) {
      if (obj.onInteract?.length) {
        const result = resolveExploreEffects(obj.onInteract, ctx, Math.random, ruleset)
        applyExploreEffect(result)
      } else if (obj.shop) {
        setShopId(obj.shop)
      } else if (obj.dialogue) {
        toast(obj.dialogue)
      }
      break
    }
  }, [activeMap, makeEventContext, applyExploreEffect, updateActiveMap, inventory, flags, ruleset, setGold, setInventory, setFlags])

  const isCellRevealed = useCallback(
    (x: number, y: number) => {
      const { cx, cy } = cellChunk(x, y)
      return revealedSet.has(chunkKey(cx, cy))
    },
    [revealedSet],
  )

  const toggleReveal = useCallback(
    (x: number, y: number) => {
      const { cx, cy } = cellChunk(x, y)
      const key = chunkKey(cx, cy)
      updateActiveMap((m) => {
        const set = new Set(m.revealedChunks ?? [])
        if (set.has(key)) set.delete(key)
        else set.add(key)
        return { revealedChunks: [...set] }
      })
    },
    [updateActiveMap],
  )

  // ── Cell editing ──────────────────────────────────────────────────────────────

  const writeCell = useCallback(
    (key: string, next: CellData) => {
      recordHistory()
      updateActiveMap((m) => {
        const cells: CellMap = { ...m.cells }
        if (isCellEmpty(next)) delete cells[key]
        else cells[key] = next
        return { cells }
      })
    },
    [recordHistory, updateActiveMap],
  )

  const writeBoundary = useCallback(
    (bk: string, next: BoundaryData | null) => {
      recordHistory()
      updateActiveMap((m) => {
        const boundaries = { ...(m.boundaries ?? {}) }
        if (next === null) delete boundaries[bk]
        else boundaries[bk] = next
        return { boundaries }
      })
    },
    [recordHistory, updateActiveMap],
  )

  // ── Eyedropper flash cells ────────────────────────────────────────────────────
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flashTimersRef = useRef<any>({})

  function addFlash(key: string) {
    if (flashTimersRef.current[key]) clearTimeout(flashTimersRef.current[key])
    setFlashCells(prev => new Set([...prev, key]))
    flashTimersRef.current[key] = setTimeout(() => {
      setFlashCells(prev => { const next = new Set(prev); next.delete(key); return next })
      delete flashTimersRef.current[key]
    }, 650)
  }

  // ── Drag-paint support (base / overlay / erase / eyedropper) ─────────────────
  const isPaintingRef     = useRef(false)
  const paintedCellsRef   = useRef(new Set<string>())
  const dragHistoryRef    = useRef(false)

  function applyPaintTool(x: number, y: number) {
    if (!activeMap) return
    const tool = activeTool
    if (tool.kind !== 'base' && tool.kind !== 'overlay' && tool.kind !== 'erase') return
    if (!isCellRevealed(x, y)) return
    const key = `${x},${y}`
    if (paintedCellsRef.current.has(key)) return
    paintedCellsRef.current.add(key)
    if (!dragHistoryRef.current) { dragHistoryRef.current = true; recordHistory() }
    updateActiveMap((m) => {
      const cells = { ...m.cells }
      const cur = cells[key] ?? EMPTY_CELL
      if (tool.kind === 'erase') {
        delete cells[key]
      } else if (tool.kind === 'base') {
        const next = { ...cur, base: tool.value }
        if (tool.value === 0 && cur.overlays.length === 0 && !cur.note && !cur.entities?.length) delete cells[key]
        else cells[key] = next
      } else {
        const isFirstCell = paintedCellsRef.current.size === 0
        const has = cur.overlays.includes(tool.value)
        if (has && isFirstCell) {
          // Single-click toggle: remove if already present
          cells[key] = { ...cur, overlays: cur.overlays.filter(o => o !== tool.value) }
        } else if (!has) {
          cells[key] = { ...cur, overlays: [...cur.overlays, tool.value] }
        }
      }
      return { cells }
    })
  }

  function applyStampTool(x: number, y: number, sample: CellData) {
    if (!activeMap || !isCellRevealed(x, y)) return
    const key = `${x},${y}`
    if (paintedCellsRef.current.has(key)) return
    paintedCellsRef.current.add(key)
    if (!dragHistoryRef.current) { dragHistoryRef.current = true; recordHistory() }
    addFlash(key)
    updateActiveMap((m) => {
      const cells = { ...m.cells }
      const stamped = stampCell(sample)
      if (isCellEmpty(stamped)) delete cells[key]
      else cells[key] = stamped
      return { cells }
    })
  }

  function handleCellMouseDown(e: React.MouseEvent<HTMLDivElement>, x: number, y: number) {
    if (e.button !== 0) return
    const tool = activeTool

    if (tool.kind === 'eyedropper') {
      if (!activeMap || !isCellRevealed(x, y)) return
      e.preventDefault()
      if (tool.sample === null) {
        const key = `${x},${y}`
        const cell = activeMap.cells[key] ?? EMPTY_CELL
        setActiveTool({ kind: 'eyedropper', sample: cell, sourceKey: key })
        toast('Cell sampled — click or drag to stamp')
        return
      }
      isPaintingRef.current  = true
      dragHistoryRef.current = false
      paintedCellsRef.current = new Set()
      applyStampTool(x, y, tool.sample)
      return
    }

    if (tool.kind !== 'base' && tool.kind !== 'overlay' && tool.kind !== 'erase') return
    e.preventDefault()
    isPaintingRef.current  = true
    dragHistoryRef.current = false
    paintedCellsRef.current = new Set()
    applyPaintTool(x, y)
  }

  function handleCellMouseEnter(x: number, y: number) {
    if (!isPaintingRef.current) return
    if (activeTool.kind === 'eyedropper' && activeTool.sample) {
      applyStampTool(x, y, activeTool.sample)
    } else {
      applyPaintTool(x, y)
    }
  }

  function handlePaintEnd() {
    isPaintingRef.current = false
    paintedCellsRef.current.clear()
    dragHistoryRef.current = false
  }

  function handleCellClick(e: React.MouseEvent<HTMLDivElement>, x: number, y: number) {
    if (!activeMap || !isCellRevealed(x, y)) return
    // Painting tools are handled by mousedown+drag; skip here to avoid double-history
    if (activeTool.kind === 'base' || activeTool.kind === 'overlay' || activeTool.kind === 'erase') return
    const key = `${x},${y}`
    const cur = activeMap.cells[key] ?? EMPTY_CELL

    if (activeTool.kind === 'player') {
      updateActiveMap((m) => ({ playerX: x, playerY: y, revealedChunks: revealAround(m, x, y) }))
      setCameraOffset({ x: 0, y: 0 })
      return
    }

    if (activeTool.kind === 'inspect') {
      setInspectedCell({ x, y })
      return
    }

    if (activeTool.kind === 'edge') {
      const rect = e.currentTarget.getBoundingClientRect()
      const dir = getEdgeDir((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
      if (!dir) return
      const bk = boundaryKey(x, y, dir)
      const existing = activeMap.boundaries?.[bk]
      if (existing?.wall === EDGE.DOOR) {
        // Clicking an existing door opens the boundary inspector instead of toggling
        setInspectedBoundary({ bk, x, y, dir, boundary: existing })
        return
      }
      if (activeTool.value === EDGE.DOOR) {
        // Place door with initial closed state; open inspector to configure
        const newBoundary: BoundaryData = { wall: EDGE.DOOR, door: { state: 'closed' } }
        writeBoundary(bk, newBoundary)
        setInspectedBoundary({ bk, x, y, dir, boundary: newBoundary })
      } else {
        writeBoundary(bk, existing?.wall === activeTool.value ? null : { wall: activeTool.value })
      }
      return
    }

  }

  function handleCellRightClick(e: React.MouseEvent<HTMLDivElement>, x: number, y: number) {
    e.preventDefault()
    if (!activeMap || !isCellRevealed(x, y)) return
    const key = `${x},${y}`
    const cur = activeMap.cells[key]
    if (!cur) return

    if (activeTool.kind === 'edge') {
      const rect = e.currentTarget.getBoundingClientRect()
      const dir = getEdgeDir((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
      if (!dir) return
      writeBoundary(boundaryKey(x, y, dir), null)
      return
    }
    // FILO: remove last entity → last overlay → base → clear
    if (cur.entities?.length) {
      writeCell(key, { ...cur, entities: cur.entities.length > 1 ? cur.entities.slice(0, -1) : undefined })
    } else if (cur.overlays.length) {
      writeCell(key, { ...cur, overlays: cur.overlays.slice(0, -1) })
    } else if (cur.base !== 0) {
      const next = { ...cur, base: 0 }
      if (isCellEmpty(next)) writeCell(key, EMPTY_CELL)
      else writeCell(key, next)
    } else {
      writeCell(key, EMPTY_CELL)
    }
  }

  function handleCellMouseMove(e: React.MouseEvent<HTMLDivElement>, x: number, y: number) {
    if (activeTool.kind !== 'edge') {
      if (hoverInfo) setHoverInfo(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const zone = getEdgeDir((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
    if (!hoverInfo || hoverInfo.x !== x || hoverInfo.y !== y || hoverInfo.zone !== zone) {
      setHoverInfo({ x, y, zone })
    }
  }

  // ── Note dialog ───────────────────────────────────────────────────────────────

  const openNoteForPlayer = useCallback(() => {
    if (!activeMap) return
    const key = `${activeMap.playerX},${activeMap.playerY}`
    setNoteDialog({ x: activeMap.playerX, y: activeMap.playerY, text: activeMap.cells[key]?.note ?? '' })
  }, [activeMap])

  function saveNote() {
    if (!noteDialog || !activeMap) return
    const key = `${noteDialog.x},${noteDialog.y}`
    const cur = activeMap.cells[key] ?? EMPTY_CELL
    const text = noteDialog.text.trim().slice(0, MAX_NOTE_LEN)
    writeCell(key, { ...cur, note: text || undefined })
    setNoteDialog(null)
  }

  // ── Map list ops ──────────────────────────────────────────────────────────────

  function addMap() {
    setNewMapMode('add')
  }

  function deleteMap(idx: number) {
    setMaps((prev) => {
      if (prev.length <= 1) {
        toast.error('A session needs at least one map')
        return prev
      }
      const next = prev.filter((_, i) => i !== idx)
      setActiveIdx((cur) => Math.max(0, Math.min(cur, next.length - 1)))
      return next
    })
  }

  // ── Custom markers ────────────────────────────────────────────────────────────

  const allocMarkerId = useCallback(() => {
    const id = nextMarkerIdRef.current
    nextMarkerIdRef.current = id + 1
    try {
      localStorage.setItem(NEXTID_KEY, String(nextMarkerIdRef.current))
    } catch {
      /* ignore */
    }
    return id
  }, [])

  const addMarker = useCallback(
    (kind: 'base' | 'overlay' = 'overlay'): number => {
      const id = allocMarkerId()
      const marker: CustomMarker = {
        id,
        kind,
        label: kind === 'base' ? 'New Terrain' : 'New Overlay',
        icon: kind === 'base' ? '▦' : '★',
        color: '#f59e0b',
      }
      setCustomMarkers((prev) => [...prev, marker])
      return id
    },
    [allocMarkerId],
  )

  // Open the Marker Palette focused on a brand-new marker of the given kind —
  // the inline "+" affordances on the Terrain / Overlays palette groups.
  const addCustomAndEdit = useCallback(
    (kind: 'base' | 'overlay') => {
      const id = addMarker(kind)
      setPaletteSelectId(id)
      setShowPalette(true)
    },
    [addMarker],
  )

  const updateMarker = useCallback((id: number, patch: Partial<Omit<CustomMarker, 'id'>>) => {
    setCustomMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const markerUsage = useCallback(
    (marker: CustomMarker): number => {
      let n = 0
      for (const map of maps) {
        for (const cell of Object.values(map.cells)) {
          if (marker.kind === 'base') {
            if (cell.base === marker.id) n++
          } else if (cell.overlays.includes(marker.id)) n++
        }
      }
      return n
    },
    [maps],
  )

  const deleteMarker = useCallback(
    (id: number) => {
      const marker = customMarkers.find((m) => m.id === id)
      if (!marker) return
      // Revert any cells that used the deleted marker (§5.2).
      historyRef.current.push(maps)
      if (historyRef.current.length > 60) historyRef.current.shift()
      setCanUndo(true)
      setMaps((prev) =>
        prev.map((map) => {
          let changed = false
          const cells: CellMap = {}
          for (const [key, cell] of Object.entries(map.cells)) {
            let next = cell
            if (marker.kind === 'base' && cell.base === id) {
              next = { ...cell, base: 0 }
              changed = true
            } else if (marker.kind === 'overlay' && cell.overlays.includes(id)) {
              next = { ...cell, overlays: cell.overlays.filter((o) => o !== id) }
              changed = true
            }
            if (!isCellEmpty(next)) cells[key] = next
          }
          return changed ? { ...map, cells } : map
        }),
      )
      setCustomMarkers((prev) => prev.filter((m) => m.id !== id))
      // If the active tool referenced this marker, fall back to a safe default.
      setActiveTool((t) =>
        (t.kind === 'base' || t.kind === 'overlay') && t.value === id ? { kind: 'base', value: BASE.FLOOR } : t,
      )
    },
    [customMarkers, maps],
  )

  // ── File operations ───────────────────────────────────────────────────────────

  const doNew = useCallback(() => { setNewMapMode('session') }, [])

  const handleNewMapConfirm = useCallback((config: NewMapConfig) => {
    const world = config.generate ? buildGeneratedWorld(config.name, config, ruleset) : null
    const map = world ? world.map : buildBaseMap(config.name, config)

    // Generated story content (NPCs, quest, events) joins the ruleset so the
    // map's dialogue, levers, and journal entries work out of the box
    if (world && (world.npcs.length || world.quests.length || world.events.length)) {
      setRuleset(r => ({
        ...r,
        npcs: [...(r.npcs ?? []).filter(n => !world.npcs.some(w => w.id === n.id)), ...world.npcs],
        quests: [...(r.quests ?? []).filter(q => !world.quests.some(w => w.id === q.id)), ...world.quests],
        events: [...(r.events ?? []).filter(e => !world.events.some(w => w.id === e.id)), ...world.events],
      }))
    }

    if (newMapMode === 'session') {
      historyRef.current = []
      setCanUndo(false)
      setGameTitle('')
      setRomHash('')
      setCustomMarkers([])
      setMaps([map])
      setActiveIdx(0)
    } else {
      setMaps(prev => {
        const next = [...prev, map]
        setActiveIdx(next.length - 1)
        return next
      })
    }
    setNewMapMode(null)
  }, [newMapMode, ruleset])

  const loadFile = useCallback(
    async (file: File, mode: 'open' | 'import') => {
      try {
        const buf = await file.arrayBuffer()
        const parsed = parseDotEpochmap(buf)
        const loaded = parsed.maps.map((m) => ({ ...m, id: uid() }))
        if (mode === 'open') {
          historyRef.current = []
          setCanUndo(false)
          setGameTitle(parsed.gameTitle)
          setRomHash(parsed.romHash)
          setCustomMarkers(parsed.customMarkers)
          setMaps(loaded)
          setActiveIdx(0)
          const maxId = parsed.customMarkers.reduce((mx, m) => Math.max(mx, m.id), CUSTOM_ID_START - 1)
          nextMarkerIdRef.current = Math.max(nextMarkerIdRef.current, maxId + 1)
          try {
            localStorage.setItem(NEXTID_KEY, String(nextMarkerIdRef.current))
          } catch {
            /* ignore */
          }
          toast.success(`Opened ${loaded.length} map${loaded.length === 1 ? '' : 's'}`)
        } else {
          recordHistory()
          // §5.3 — the imported file's marker table takes precedence on free IDs;
          // a collision with a *different* definition reassigns the imported marker
          // to the next free ID and remaps the affected cells in the imported maps.
          const { merged, remap } = resolveMarkerImport(customMarkers, parsed.customMarkers, allocMarkerId)
          const remapped = remap.size > 0 ? loaded.map((m) => remapMapMarkers(m, remap)) : loaded
          setCustomMarkers(merged)
          const maxId = merged.reduce((mx, m) => Math.max(mx, m.id), CUSTOM_ID_START - 1)
          nextMarkerIdRef.current = Math.max(nextMarkerIdRef.current, maxId + 1)
          try {
            localStorage.setItem(NEXTID_KEY, String(nextMarkerIdRef.current))
          } catch {
            /* ignore */
          }
          setMaps((prev) => {
            const next = [...prev, ...remapped]
            setActiveIdx(prev.length)
            return next
          })
          if (!gameTitle && parsed.gameTitle) setGameTitle(parsed.gameTitle)
          const note = remap.size > 0 ? ` (${remap.size} marker ID${remap.size === 1 ? '' : 's'} reassigned)` : ''
          toast.success(`Imported ${remapped.length} map${remapped.length === 1 ? '' : 's'}${note}`)
        }
      } catch (err) {
        toast.error((err as Error).message || 'Could not read .epochmap file')
      }
    },
    [gameTitle, recordHistory, customMarkers, allocMarkerId],
  )

  function pickFile(mode: 'open' | 'import') {
    fileModeRef.current = mode
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file, fileModeRef.current)
    e.target.value = ''
  }

  const saveEpochmap = useCallback(() => {
    const file: EpochmapFile = { version: 2, gameTitle, romHash, customMarkers, maps, ruleset }
    const bytes = serializeDotEpochmap(file)
    const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safe = (gameTitle || 'maps').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    a.href = url
    a.download = `${safe}.epochmap`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Saved .epochmap')
  }, [gameTitle, romHash, customMarkers, maps])

  const exportPdf = useCallback(async () => {
    if (maps.length === 0) return
    setExporting(true)
    try {
      await exportMapsAsPdf(maps, gameTitle, customMarkers)
    } catch {
      toast.error('PDF export failed')
    } finally {
      setExporting(false)
    }
  }, [maps, gameTitle, customMarkers])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase()
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'

      // Global shortcuts (work even when not hovering the grid)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveEpochmap()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        exportPdf()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (typing) return
      if (e.key === '?') {
        setShowWelcome(true)
        return
      }

      if (!mapperHoveredRef.current && workspaceRef.current !== 'play') return

      if (workspaceRef.current === 'play') {
        // Block movement while any overlay (combat/shop/encounter) is active — those handle keys themselves
        if (combatStateRef.current || shopIdRef.current || activeEncounterRef.current || dialogueRef.current) return
        // Blobber controls: W=forward, S=back, A=turn-left, D=turn-right
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { e.preventDefault(); stepForward(); return }
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { e.preventDefault(); stepBack(); return }
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { e.preventDefault(); turnLeft(); return }
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { e.preventDefault(); turnRight(); return }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); handleInteract(); return }
        return
      }

      // Map-mode absolute WASD / arrow keys
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      }
      if (moves[e.key]) {
        e.preventDefault()
        movePlayer(moves[e.key][0], moves[e.key][1])
        return
      }
      if (e.key === 'f' || e.key === 'F') {
        if (activeMap) toggleReveal(activeMap.playerX, activeMap.playerY)
        return
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        handleInteract()
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        openNoteForPlayer()
        return
      }
      if (e.key === 'z' || e.key === 'Z') {
        undo()
        return
      }
      if (e.key === '+' || e.key === '=') {
        setCellSize((s) => Math.min(MAX_CELL, s + 4))
        return
      }
      if (e.key === '-' || e.key === '_') {
        setCellSize((s) => Math.max(MIN_CELL, s - 4))
        return
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [activeMap, movePlayer, stepForward, stepBack, turnLeft, turnRight, toggleReveal, handleInteract, openNoteForPlayer, undo, saveEpochmap, exportPdf])

  function closeWelcome() {
    setShowWelcome(false)
    try {
      localStorage.setItem(WELCOME_KEY, 'true')
    } catch {
      /* ignore */
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const activeToolId = toolId(activeTool)
  const isEdgeTool = activeTool.kind === 'edge'
  const zoomPct = Math.round((cellSize / DEFAULT_CELL) * 100)

  // Standalone fills the viewport; embedded fills whatever container the host sizes.
  const rootSize = layout === 'fill' ? 'h-screen w-screen' : 'h-full w-full'

  if (!hydrated) {
    return <div className={cn(rootSize, 'grid place-items-center bg-zinc-950 text-white/40 text-sm')}>Loading…</div>
  }

  const WORKSPACES: { id: Workspace; icon: React.ReactNode; label: string }[] = [
    { id: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
    { id: 'database', icon: <Database className="w-5 h-5" />, label: 'Database' },
    { id: 'party', icon: <Users className="w-5 h-5" />, label: 'Party' },
    { id: 'play', icon: <Play className="w-5 h-5" />, label: 'Play' },
    { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
  ]

  return (
    <div
      className={cn(rootSize, 'flex bg-zinc-950 text-white overflow-hidden')}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file?.name.endsWith('.epochmap')) loadFile(file, 'open')
      }}
    >
      {/* Activity bar */}
      <nav className="w-12 flex-shrink-0 flex flex-col items-center gap-1 py-2 border-r border-white/10 bg-zinc-950 z-10">
        {WORKSPACES.map(ws => (
          <button
            key={ws.id}
            title={ws.label}
            onClick={() => setWorkspace(ws.id)}
            className={cn(
              'w-9 h-9 grid place-items-center rounded-lg transition-colors',
              workspace === ws.id
                ? 'bg-amber-600/20 text-amber-400'
                : 'text-white/40 hover:text-white hover:bg-white/10',
            )}
          >
            {ws.icon}
          </button>
        ))}
      </nav>

      {/* Party workspace */}
      {workspace === 'party' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-white/10 text-sm font-semibold text-white/70">Party Builder</div>
          <div className="flex-1 min-h-0">
            <PartyWorkspace
              ruleset={ruleset}
              party={party}
              formation={formation}
              inventory={inventory}
              gold={gold}
              onPartyChange={(p, f) => {
                setParty(p)
                setFormation(f)
                savePartyTemplate(p, f)
              }}
              onInventoryChange={(inv, g) => {
                setInventory(inv)
                setGold(g)
              }}
            />
          </div>
        </div>
      )}

      {/* Database workspace */}
      {workspace === 'database' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-white/10 text-sm font-semibold text-white/70">Database</div>
          <div className="flex-1 min-h-0">
            <DatabaseWorkspace ruleset={ruleset} onRulesetChange={setRuleset} />
          </div>
        </div>
      )}

      {/* Play workspace */}
      {workspace === 'play' && (
        <div className="flex-1 flex flex-col min-h-0">
          <PlayWorkspace
            activeMap={activeMap}
            party={party}
            gold={gold}
            facing={facing}
            customBase={customBase}
            customOverlay={customOverlay}
            isCellRevealed={isCellRevealed}
            revealedBoundaries={revealedBoundaries}
            bumpTrigger={bumpTrigger}
            flags={flags}
            combat={combatState}
            ruleset={ruleset}
            inventory={inventory}
            onCombatAction={handleCombatAction}
            onCombatEnd={() => {
              if (!combatState) return
              const { party: updatedParty, levelUps } = applyCombatOutcome(party, combatState, ruleset)
              setParty(updatedParty)
              setInventory(inv => consumeCombatItems(inv, combatState))
              if (combatState.phase === 'victory') {
                setGold(g => g + combatState.goldReward)
                if (combatState.drops.length > 0) {
                  setInventory(prev => {
                    let inv = [...prev]
                    for (const { item, qty } of combatState.drops) {
                      const idx = inv.findIndex(i => i.def === item)
                      if (idx >= 0) inv[idx] = { ...inv[idx], qty: inv[idx].qty + qty }
                      else inv = [...inv, { def: item, qty }]
                    }
                    return inv
                  })
                }
              }
              savePartyTemplate(updatedParty, formation)
              levelUps.forEach(name => toast.success(`${name} leveled up!`))
              setCombatState(null)
            }}
            onMoveForward={stepForward}
            onMoveBack={stepBack}
            onTurnLeft={turnLeft}
            onTurnRight={turnRight}
            onInteract={handleInteract}
          />
        </div>
      )}

      {/* Settings workspace */}
      {workspace === 'settings' && (
        <SettingsWorkspace
          maps={maps}
          onThemeChange={(idx, themeId) =>
            setMaps(prev => prev.map((m, i) => i === idx ? { ...m, theme: themeId } : m))
          }
        />
      )}

      {/* Map workspace (the existing editor) */}
      <div className={cn('flex-1 flex flex-col min-h-0', workspace !== 'map' && 'hidden')}>
      <input ref={fileInputRef} type="file" accept=".epochmap" className="hidden" onChange={onFileChange} />

      <Toolbar
        gameTitle={gameTitle}
        mapName={activeMap?.name ?? ''}
        zoomPct={zoomPct}
        canUndo={canUndo}
        exporting={exporting}
        onNew={doNew}
        onOpen={() => pickFile('open')}
        onSave={saveEpochmap}
        onImport={() => pickFile('import')}
        onExportPdf={exportPdf}
        onUndo={undo}
        onZoomIn={() => setCellSize((s) => Math.min(MAX_CELL, s + 4))}
        onZoomOut={() => setCellSize((s) => Math.max(MIN_CELL, s - 4))}
        onOpenPalette={() => {
          setPaletteSelectId(undefined)
          setShowPalette(true)
        }}
        onOpenHelp={() => setShowWelcome(true)}
        onRenameMap={(name) => updateActiveMap({ name })}
        onRenameGame={setGameTitle}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: map list + tool palette */}
        <aside className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-zinc-950 overflow-y-auto">
          {/* Maps */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-white/55 uppercase tracking-wider">Maps</span>
              <button onClick={addMap} title="Add map" className="grid place-items-center h-7 w-7 rounded text-white/60 hover:text-white hover:bg-white/10">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {maps.map((m, i) => (
                <div
                  key={m.id}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm cursor-pointer',
                    i === activeIdx ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30' : 'text-white/70 hover:bg-white/5',
                  )}
                  onClick={() => setActiveIdx(i)}
                >
                  <MapPin className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{m.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMap(i)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-rose-400"
                    title="Delete map"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Game title field */}
          <div className="p-4 border-b border-white/10">
            <label className="text-xs font-semibold text-white/55 uppercase tracking-wider">Game title</label>
            <input
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="e.g. Dragon Quest"
              className="mt-2 w-full h-9 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          {/* Tool palette */}
          <div className="p-4 space-y-5">
            <PaletteGroup title="Terrain" onAdd={() => addCustomAndEdit('base')} addLabel="Add custom terrain">
              <div className="grid grid-cols-2 gap-1.5">
                {BASE_PALETTE.map((id) => (
                  <ToolButton
                    key={id}
                    active={activeToolId === `base:${id}`}
                    color={BASE_TYPES[id]?.color}
                    label={BASE_TYPES[id]?.label ?? `#${id}`}
                    icon={BASE_TYPES[id]?.icon}
                    onClick={() => setActiveTool({ kind: 'base', value: id })}
                  />
                ))}
                {customMarkers
                  .filter((m) => m.kind === 'base')
                  .map((m) => (
                    <ToolButton
                      key={m.id}
                      active={activeToolId === `base:${m.id}`}
                      color={m.color}
                      label={m.label}
                      icon={m.icon}
                      custom
                      onClick={() => setActiveTool({ kind: 'base', value: m.id })}
                    />
                  ))}
              </div>
            </PaletteGroup>

            <PaletteGroup title="Overlays" hint="(toggle)" onAdd={() => addCustomAndEdit('overlay')} addLabel="Add custom overlay">
              <div className="grid grid-cols-2 gap-1.5">
                {OVERLAY_PALETTE.map((id) => (
                  <ToolButton
                    key={id}
                    active={activeToolId === `overlay:${id}`}
                    color={OVERLAY_TYPES[id]?.color}
                    label={OVERLAY_TYPES[id]?.label ?? `#${id}`}
                    icon={OVERLAY_TYPES[id]?.icon}
                    onClick={() => setActiveTool({ kind: 'overlay', value: id })}
                  />
                ))}
                {customMarkers
                  .filter((m) => m.kind === 'overlay')
                  .map((m) => (
                    <ToolButton
                      key={m.id}
                      active={activeToolId === `overlay:${m.id}`}
                      color={m.color}
                      label={m.label}
                      icon={m.icon}
                      custom
                      onClick={() => setActiveTool({ kind: 'overlay', value: m.id })}
                    />
                  ))}
              </div>
            </PaletteGroup>

            <PaletteGroup title="Edges" hint="(click cell border)">
              <div className="grid grid-cols-2 gap-1.5">
                {EDGE_PALETTE.map((id) => (
                  <ToolButton
                    key={id}
                    active={activeToolId === `edge:${id}`}
                    color={EDGE_TYPES[id]?.color}
                    label={EDGE_TYPES[id]?.label ?? `#${id}`}
                    onClick={() => setActiveTool({ kind: 'edge', value: id })}
                  />
                ))}
              </div>
            </PaletteGroup>

            <div className="flex gap-1.5">
              <button
                onClick={() => setActiveTool({ kind: 'erase' })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium border transition',
                  activeToolId === 'erase'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80',
                )}
              >
                <Eraser className="h-3.5 w-3.5" /> Erase
              </button>
              <button
                onClick={() => setActiveTool({ kind: 'player' })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium border transition',
                  activeToolId === 'player'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80',
                )}
              >
                <MapPin className="h-3.5 w-3.5" /> Place ⊕
              </button>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setActiveTool({ kind: 'inspect' })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium border transition',
                  activeToolId === 'inspect'
                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80',
                )}
              >
                <Search className="h-3.5 w-3.5" /> Inspect Cell
              </button>
              <button
                onClick={() => setActiveTool({ kind: 'eyedropper', sample: null, sourceKey: null })}
                title={activeTool.kind === 'eyedropper' && activeTool.sample ? 'Eyedropper (sample loaded — click to stamp)' : 'Eyedropper (click cell to sample)'}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium border transition',
                  activeToolId === 'eyedropper'
                    ? activeTool.kind === 'eyedropper' && activeTool.sample
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80',
                )}
              >
                <Pipette className="h-3.5 w-3.5" />
                {activeTool.kind === 'eyedropper' && activeTool.sample ? 'Stamp' : 'Sample'}
              </button>
            </div>

            <p className="text-xs text-white/45 leading-relaxed">
              Arrow keys / WASD move ⊕ · E interacts · F toggles fog · N adds a note · right-click removes last item · middle-drag pans.
            </p>
          </div>
        </aside>

        {/* Right: Cell Inspector panel */}
        {inspectedCell && activeMap && (
          <aside className="w-80 shrink-0 border-l border-white/10 flex flex-col bg-zinc-950 overflow-y-auto">
            <CellInspector
              x={inspectedCell.x}
              y={inspectedCell.y}
              cell={activeMap.cells[`${inspectedCell.x},${inspectedCell.y}`] ?? { base: 0, overlays: [] }}
              maps={maps}
              ruleset={ruleset}
              onChange={(entities: CellEntity[]) => {
                const key = `${inspectedCell.x},${inspectedCell.y}`
                const cur = activeMap.cells[key] ?? { base: 0, overlays: [] }
                writeCell(key, { ...cur, entities: entities.length ? entities : undefined })
              }}
              onSubcubeChange={(objs: SubcubeObject[]) => {
                const key = `${inspectedCell.x},${inspectedCell.y}`
                const cur = activeMap.cells[key] ?? { base: 0, overlays: [] }
                writeCell(key, { ...cur, subcubeObjects: objs.length ? objs : undefined })
              }}
              onClose={() => setInspectedCell(null)}
            />
          </aside>
        )}

        {/* Right: Boundary Inspector panel (door configuration) */}
        {inspectedBoundary && activeMap && (
          <BoundaryInspector
            bk={inspectedBoundary.bk}
            x={inspectedBoundary.x}
            y={inspectedBoundary.y}
            dir={inspectedBoundary.dir}
            boundary={activeMap.boundaries?.[inspectedBoundary.bk] ?? inspectedBoundary.boundary}
            ruleset={ruleset}
            onChange={(bk, data) => {
              writeBoundary(bk, data)
              if (data === null) setInspectedBoundary(null)
              else setInspectedBoundary(prev => prev ? { ...prev, boundary: data } : null)
            }}
            onClose={() => setInspectedBoundary(null)}
          />
        )}

        {/* Center: viewport */}
        <main
          ref={viewportRef}
          className="flex-1 min-w-0 grid place-items-center bg-zinc-900/40 overflow-hidden"
          onMouseEnter={() => (mapperHoveredRef.current = true)}
          onMouseLeave={() => {
            mapperHoveredRef.current = false
            setHoverInfo(null)
            setTooltip(null)
          }}
        >
          {activeMap && (
            <Viewport
              layout={layout}
              availW={viewportSize.width}
              availH={viewportSize.height}
              map={activeMap}
              ruleset={ruleset}
              cellSize={cellSize}
              cameraOffset={cameraOffset}
              isPanning={isPanning}
              isEdgeTool={isEdgeTool}
              isPlayerTool={activeTool.kind === 'player'}
              hoverInfo={hoverInfo}
              customBase={customBase}
              customOverlay={customOverlay}
              isCellRevealed={isCellRevealed}
              eyedropperSource={activeTool.kind === 'eyedropper' ? activeTool.sourceKey : null}
              flashCells={flashCells}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
              onCellMouseDown={handleCellMouseDown}
              onCellMouseEnter={handleCellMouseEnter}
              onCellMouseMove={handleCellMouseMove}
              onCellHoverEnd={() => setTooltip(null)}
              onTooltip={setTooltip}
              onWheel={(delta) => setCellSize((s) => Math.max(MIN_CELL, Math.min(MAX_CELL, s - Math.sign(delta) * 2)))}
              onPanStart={(x, y) => {
                setIsPanning(true)
                setTooltip(null)
                panOriginRef.current = { x, y }
                pixelAccumRef.current = { x: 0, y: 0 }
              }}
              onPanMove={(x, y) => {
                if (!isPanning) return
                const step = cellSize + 1
                pixelAccumRef.current.x += x - panOriginRef.current.x
                pixelAccumRef.current.y += y - panOriginRef.current.y
                panOriginRef.current = { x, y }
                const cx = Math.trunc(pixelAccumRef.current.x / step)
                const cy = Math.trunc(pixelAccumRef.current.y / step)
                if (cx !== 0 || cy !== 0) {
                  pixelAccumRef.current.x -= cx * step
                  pixelAccumRef.current.y -= cy * step
                  setCameraOffset((prev) => ({ x: prev.x - cx, y: prev.y - cy }))
                }
              }}
              onPanEnd={() => setIsPanning(false)}
              onPaintEnd={handlePaintEnd}
            />
          )}
        </main>
      </div>

      {tooltip && (
        <CellTooltip
          x={tooltip.x}
          y={tooltip.y}
          cell={tooltip.cell}
          isPlayer={tooltip.isPlayer}
          customBase={customBase}
          customOverlay={customOverlay}
          cellBoundaries={tooltip.cellBoundaries}
        />
      )}

      {noteDialog && (
        <NoteDialog
          x={noteDialog.x}
          y={noteDialog.y}
          text={noteDialog.text}
          onChange={(text) => setNoteDialog((d) => (d ? { ...d, text } : d))}
          onSave={saveNote}
          onClose={() => setNoteDialog(null)}
        />
      )}

      {showWelcome && <WelcomeModal onClose={closeWelcome} />}

      {newMapMode && (
        <NewMapModal
          defaultName={newMapMode === 'add' ? `Map ${maps.length + 1}` : 'Map 1'}
          onConfirm={handleNewMapConfirm}
          onClose={() => setNewMapMode(null)}
        />
      )}
      {showPalette && (
        <MarkerPalette
          markers={customMarkers}
          initialSelectedId={paletteSelectId}
          onAdd={addMarker}
          onUpdate={updateMarker}
          onDelete={deleteMarker}
          usageCount={markerUsage}
          onClose={() => setShowPalette(false)}
        />
      )}
      </div>{/* end Map workspace */}

      {/* NPC dialogue (listening) overlay */}
      {dialogue && activeMap && (() => {
        const npcDef = (ruleset.npcs ?? []).find(n => n.id === dialogue.npcId)
        const line = npcDef?.lines.find(l => l.id === dialogue.lineId)
        if (!npcDef || !line) return null
        return (
          <DialogueOverlay
            npc={npcDef}
            line={line}
            onFinish={() => {
              const cell = activeMap.cells[`${activeMap.playerX},${activeMap.playerY}`] ?? null
              applyExploreEffect(finishNpcLine(npcDef, line, cell, makeEventContext(), ruleset))
              setDialogue(null)
            }}
          />
        )
      })()}

      {/* Encounter modal (shown over any workspace) */}
      {activeEncounter && (
        <EncounterModal
          encounter={activeEncounter}
          onFight={() => {
            setCombatState(initCombat(party, activeEncounter, { formation, ruleset }))
            setActiveEncounter(null)
            setWorkspace('play')   // battles play out in the first-person view
          }}
          onFlee={() => setActiveEncounter(null)}
        />
      )}

      {/* Shop modal */}
      {shopId && (() => {
        const shop = ruleset.shops.find(s => s.id === shopId)
        if (!shop) return null
        return (
          <ShopModal
            shop={shop}
            ruleset={ruleset}
            inventory={inventory}
            gold={gold}
            onClose={() => setShopId(null)}
            onTransaction={(inv, g) => {
              setInventory(inv)
              setGold(g)
            }}
          />
        )
      })()}
    </div>
  )
}

// ── Eyedropper stamp flash overlay ───────────────────────────────────────────────

function FlashOverlay() {
  const [faded, setFaded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setFaded(true), 30)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      className="absolute inset-0 pointer-events-none z-40"
      style={{
        background: 'rgba(34,211,238,0.50)',
        opacity: faded ? 0 : 1,
        transition: faded ? 'opacity 0.55s ease-out' : 'none',
      }}
    />
  )
}

// ── Viewport (camera window) ────────────────────────────────────────────────────

// ── Cell entity badges (editor map view) ─────────────────────────────────────
// Zone encounters are everywhere, so they get a faint dot; deliberate content
// (fixed encounters, objects, events) gets a kind-specific glyph strip.
const OBJECT_GLYPHS: Record<string, string> = {
  chest: '📦', npc: '🧑', shop: '🏪', sign: '🪧',
  trap: '☠️', teleporter: '🌀', lever: '🎚️', door: '🚪',
}

function cellEntityBadges(cell: CellData, ruleset: Ruleset): { zoneEncounter: boolean; glyphs: string[] } {
  const glyphs: string[] = []
  let zoneEncounter = false
  for (const ent of cell.entities ?? []) {
    switch (ent.t) {
      case 'encounter':
        if (ent.mode === 'zone') zoneEncounter = true
        else glyphs.push('⚔️')
        break
      case 'partyStart': glyphs.push('🏁'); break
      case 'mapLink':    glyphs.push('🚪'); break
      case 'event':      glyphs.push('⚡'); break
      case 'object': {
        if (ent.object.kind === 'npc' && ent.object.npc) {
          glyphs.push((ruleset.npcs ?? []).find(n => n.id === ent.object.npc)?.portrait ?? '🧑')
        } else {
          glyphs.push(OBJECT_GLYPHS[ent.object.kind] ?? '📦')
        }
        break
      }
    }
  }
  return { zoneEncounter, glyphs }
}

interface ViewportProps {
  layout: 'fill' | 'fixed'
  availW: number
  availH: number
  map: MapData
  ruleset: Ruleset
  cellSize: number
  cameraOffset: { x: number; y: number }
  isPanning: boolean
  isEdgeTool: boolean
  isPlayerTool: boolean
  hoverInfo: { x: number; y: number; zone: EdgeDir | null } | null
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  eyedropperSource: string | null
  flashCells: Set<string>
  onCellClick: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellRightClick: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellMouseDown: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellMouseEnter: (x: number, y: number) => void
  onCellMouseMove: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellHoverEnd: () => void
  onTooltip: (t: { x: number; y: number; cell: CellData; isPlayer: boolean; cellBoundaries?: Partial<Record<EdgeDir, BoundaryData>> }) => void
  onWheel: (delta: number) => void
  onPanStart: (x: number, y: number) => void
  onPanMove: (x: number, y: number) => void
  onPanEnd: () => void
  onPaintEnd: () => void
}

// ── Boundary Inspector (door configuration panel) ────────────────────────────

function BoundaryInspector({ bk, x, y, dir, boundary, ruleset, onChange, onClose }: {
  bk: string; x: number; y: number; dir: EdgeDir
  boundary: BoundaryData; ruleset: Ruleset
  onChange: (bk: string, data: BoundaryData | null) => void
  onClose: () => void
}) {
  const door: DoorDef = boundary.door ?? { state: 'closed' }
  const isLocked = door.state === 'locked'

  function setDoorState(state: DoorState) {
    const newDoor: DoorDef = state === 'locked'
      ? { ...door, state: 'locked' }
      : { state: 'closed' }
    onChange(bk, { ...boundary, door: newDoor })
  }

  function setKeyItem(itemId: string) {
    onChange(bk, { ...boundary, door: { ...door, keyItem: itemId || undefined } })
  }

  function setRequiredFlags(raw: string) {
    const requiredFlags = raw.split(',').map(f => f.trim()).filter(Boolean)
    onChange(bk, { ...boundary, door: { ...door, requiredFlags: requiredFlags.length ? requiredFlags : undefined } })
  }

  const OPP: Record<EdgeDir, EdgeDir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
  function setSwitch(sw: SwitchDef | null) {
    const next = { ...boundary } as BoundaryData
    if (sw) next.switch = sw
    else delete next.switch
    onChange(bk, next)
  }

  return (
    <aside className="w-72 shrink-0 border-l border-white/10 flex flex-col bg-zinc-950">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="text-lg">🚪</span>
        <div>
          <div className="text-sm font-semibold text-white/80">Door</div>
          <div className="text-xs text-white/30 font-mono">({x}, {y}) — {dir} face</div>
        </div>
        <button onClick={onClose} className="ml-auto p-1 rounded text-white/40 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Lock state */}
        <div>
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Mode</div>
          <div className="flex gap-2">
            {(['closed', 'locked'] as const).map(state => (
              <button
                key={state}
                onClick={() => setDoorState(state)}
                className={cn(
                  'flex-1 py-1.5 rounded text-xs font-medium border transition-colors',
                  door.state === state
                    ? state === 'locked'
                      ? 'bg-red-900/30 border-red-500/50 text-red-300'
                      : 'bg-amber-900/30 border-amber-500/50 text-amber-300'
                    : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/30',
                )}
              >
                {state === 'closed' ? '🚪 Open/Close' : '🔒 Locked'}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/25 mt-1.5 leading-relaxed">
            {isLocked
              ? 'Player must carry the key item to open this door.'
              : 'Player can open and close this door freely.'}
          </p>
        </div>

        {/* Key item picker */}
        {isLocked && (
          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Key Item</div>
            <select
              value={door.keyItem ?? ''}
              onChange={e => setKeyItem(e.target.value)}
              className="w-full rounded bg-zinc-800 border border-white/10 text-sm text-white/80 px-2 py-1.5 focus:outline-none focus:border-red-500/40"
            >
              <option value="">— none (always locked) —</option>
              {ruleset.items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.icon ? `${item.icon} ` : ''}{item.name}
                </option>
              ))}
            </select>
            {!door.keyItem && !door.requiredFlags?.length && (
              <p className="text-xs text-amber-400/50 mt-1.5">No key or switch flags set — door cannot be opened.</p>
            )}

            <div className="mt-3">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Required Switch Flags</div>
              <input
                type="text"
                value={(door.requiredFlags ?? []).join(', ')}
                onChange={e => setRequiredFlags(e.target.value)}
                placeholder="switch.a, switch.b"
                className="w-full rounded bg-zinc-800 border border-white/10 text-sm text-white/80 px-2 py-1.5 focus:outline-none focus:border-amber-500/40 font-mono"
              />
              <p className="text-xs text-white/25 mt-1.5 leading-relaxed">
                Door stays sealed until ALL flags are on; it re-seals if a toggle
                switch turns one off. A carried key still opens it permanently.
              </p>
            </div>
          </div>
        )}

        {/* Wall switch */}
        <div>
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Wall Switch</div>
          {boundary.switch ? (
            <div className="space-y-2">
              <input
                type="text"
                value={boundary.switch.flag}
                onChange={e => setSwitch({ ...boundary.switch!, flag: e.target.value })}
                placeholder="switch.a"
                className="w-full rounded bg-zinc-800 border border-white/10 text-sm text-white/80 px-2 py-1.5 focus:outline-none focus:border-amber-500/40 font-mono"
              />
              <div className="flex gap-2">
                <select
                  value={boundary.switch.mode}
                  onChange={e => setSwitch({ ...boundary.switch!, mode: e.target.value as 'toggle' | 'once' })}
                  className="flex-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/80 px-2 py-1.5 focus:outline-none"
                >
                  <option value="toggle">Toggle (flips back)</option>
                  <option value="once">Once (latches on)</option>
                </select>
                <select
                  value={boundary.switch.facing}
                  onChange={e => setSwitch({ ...boundary.switch!, facing: e.target.value as EdgeDir })}
                  className="flex-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/80 px-2 py-1.5 focus:outline-none"
                >
                  <option value={OPP[dir]}>This side ({OPP[dir]}-facing)</option>
                  <option value={dir}>Far side ({dir}-facing)</option>
                </select>
              </div>
              <button
                onClick={() => setSwitch(null)}
                className="w-full py-1 rounded text-xs border border-red-500/20 text-red-400/60 hover:text-red-300 hover:border-red-500/40 transition-colors"
              >
                Remove Switch
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSwitch({ id: `sw_${x}_${y}_${dir}`, flag: `switch.${x}_${y}`, mode: 'toggle', facing: OPP[dir] })}
              className="w-full py-1.5 rounded text-xs font-medium border border-amber-500/20 text-amber-300/70 hover:text-amber-200 hover:border-amber-500/40 transition-colors"
            >
              + Add Switch (mounted this side)
            </button>
          )}
          <p className="text-xs text-white/25 mt-1.5 leading-relaxed">
            A lever on the wall face. Interact from the mounted side to flip its flag.
          </p>
        </div>

        {/* Remove */}
        <div className="pt-3 border-t border-white/8">
          <button
            onClick={() => { onChange(bk, null); onClose() }}
            className="w-full py-1.5 rounded text-xs font-medium border border-red-500/20 text-red-400/60 hover:text-red-300 hover:border-red-500/40 transition-colors"
          >
            Remove Door
          </button>
        </div>
      </div>
    </aside>
  )
}

function Viewport(props: ViewportProps) {
  const { map, cellSize, cameraOffset, layout, availW, availH } = props
  const theme = getTheme(map.theme)
  const rulerSize = 18
  const step = cellSize + 1

  // 'fixed' keeps the locked 12×12 window (embedded). 'fill' renders as many
  // cells as fit the available area — zooming changes the count, not the window.
  const cols =
    layout === 'fixed' ? VIEWPORT_CELLS : Math.max(8, Math.floor((Math.max(availW, step) - rulerSize - 1) / step))
  const rows =
    layout === 'fixed' ? VIEWPORT_CELLS : Math.max(8, Math.floor((Math.max(availH, step) - rulerSize - 1) / step))

  const px = map.playerX
  const py = map.playerY
  const minX = px - Math.floor(cols / 2) + cameraOffset.x
  const minY = py - Math.floor(rows / 2) + cameraOffset.y
  const gridW = cols * step - 1
  const gridH = rows * step - 1

  return (
    <div
      className={cn('overflow-hidden select-none', props.isPanning ? 'cursor-grabbing' : 'cursor-default')}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          props.onPanStart(e.clientX, e.clientY)
        }
      }}
      onMouseMove={(e) => props.onPanMove(e.clientX, e.clientY)}
      onMouseUp={(e) => {
        if (e.button === 1) props.onPanEnd()
        if (e.button === 0) props.onPaintEnd()
      }}
      onMouseLeave={() => { props.onPanEnd(); props.onPaintEnd() }}
      onWheel={(e) => props.onWheel(e.deltaY)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col" style={{ width: gridW + rulerSize + 1, height: gridH + rulerSize + 1 }}>
        {/* X ruler */}
        <div className="flex shrink-0" style={{ marginLeft: rulerSize + 1 }}>
          {Array.from({ length: cols }, (_, ci) => (
            <div key={ci} className="text-center text-[9px] text-white/35 shrink-0 overflow-hidden" style={{ width: cellSize, marginRight: 1 }}>
              {minX + ci}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Y ruler */}
          <div className="flex flex-col shrink-0" style={{ width: rulerSize, marginTop: 1 }}>
            {Array.from({ length: rows }, (_, ri) => (
              <div
                key={ri}
                className="flex items-center justify-end pr-[3px] text-[9px] text-white/35 shrink-0 overflow-hidden"
                style={{ height: cellSize, marginBottom: 1 }}
              >
                {minY + ri}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
              gap: '1px',
              backgroundColor: theme.gapColor,
            }}
          >
            {Array.from({ length: rows }, (_, ri) => {
              const y = minY + ri
              return Array.from({ length: cols }, (_, ci) => {
                const x = minX + ci
                const key = `${x},${y}`
                const isPlayer = x === px && y === py
                const revealed = props.isCellRevealed(x, y)
                const cell = map.cells[key] ?? EMPTY_CELL
                const isHovered = props.hoverInfo?.x === x && props.hoverInfo?.y === y
                const isEyedropSource = props.eyedropperSource === key
                const isFlashing = props.flashCells.has(key)

                if (!revealed) {
                  return <div key={key} style={{ width: cellSize, height: cellSize, background: theme.fogColor }} />
                }

                const bg = (cell.base ?? 0) !== 0 ? baseDef(cell.base, props.customBase).color : theme.emptyColor

                return (
                  <div
                    key={key}
                    className={cn(
                      'relative overflow-hidden',
                      props.isPlayerTool ? 'cursor-cell' : 'cursor-crosshair',
                      isPlayer ? 'ring-1 ring-inset ring-amber-300 z-10' : '',
                      isEyedropSource ? 'ring-2 ring-inset ring-cyan-400 z-10' : '',
                    )}
                    style={{ width: cellSize, height: cellSize, background: bg }}
                    onClick={(e) => props.onCellClick(e, x, y)}
                    onMouseDown={(e) => props.onCellMouseDown(e, x, y)}
                    onMouseEnter={() => props.onCellMouseEnter(x, y)}
                    onContextMenu={(e) => props.onCellRightClick(e, x, y)}
                    onMouseMove={(e) => {
                      props.onCellMouseMove(e, x, y)
                      const cellBoundaries = (['N', 'S', 'E', 'W'] as EdgeDir[]).reduce<Partial<Record<EdgeDir, BoundaryData>>>((acc, dir) => {
                        const b = map.boundaries?.[boundaryKey(x, y, dir)]
                        if (b) acc[dir] = b
                        return acc
                      }, {})
                      props.onTooltip({ x: e.clientX, y: e.clientY, cell, isPlayer, cellBoundaries })
                    }}
                    onMouseLeave={props.onCellHoverEnd}
                  >
                    {theme.floorTint && (cell.base ?? 0) !== 0 && (
                      <div className="absolute inset-0 pointer-events-none" style={{ background: theme.floorTint }} />
                    )}
                    {isPlayer && (
                      <div className="absolute inset-0 grid place-items-center pointer-events-none z-20">
                        <div className="rounded-full bg-amber-300 shadow shadow-amber-400" style={{ width: Math.max(6, cellSize * 0.3), height: Math.max(6, cellSize * 0.3) }} />
                      </div>
                    )}

                    {/* overlay icons */}
                    {cell.overlays.length > 0 && (
                      <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-[1px] pointer-events-none z-10 leading-none">
                        {cell.overlays.map((o) => {
                          const def = overlayDef(o, props.customOverlay)
                          return (
                            <span key={o} style={{ color: def?.color, fontSize: Math.max(7, cellSize * 0.42) }}>
                              {def?.icon ?? '•'}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* note indicator */}
                    {cell.note && (
                      <span className="absolute top-0 right-0 z-10 block w-0 h-0 border-t-[6px] border-l-[6px] border-t-amber-300 border-l-transparent" />
                    )}

                    {/* entity badges: zone-encounter dot + kind glyph strip */}
                    {cell.entities && cell.entities.length > 0 && (() => {
                      const b = cellEntityBadges(cell, props.ruleset)
                      const dotSize = Math.max(3, Math.round(cellSize * 0.16))
                      return (
                        <>
                          {b.zoneEncounter && (
                            <span
                              title="Encounter zone"
                              className="absolute top-[1px] left-[1px] z-10 rounded-full pointer-events-none"
                              style={{ width: dotSize, height: dotSize, backgroundColor: 'rgba(239,68,68,0.75)' }}
                            />
                          )}
                          {b.glyphs.length > 0 && (cellSize >= 14 ? (
                            <span
                              className="absolute bottom-0 left-0 z-10 flex items-end leading-none pointer-events-none"
                              style={{ fontSize: Math.max(7, cellSize * 0.28) }}
                            >
                              {b.glyphs.slice(0, 2).join('')}
                              {b.glyphs.length > 2 && (
                                <span className="text-white/80 font-semibold" style={{ fontSize: Math.max(6, cellSize * 0.2) }}>
                                  +{b.glyphs.length - 2}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span
                              className="absolute bottom-[1px] left-[1px] z-10 rounded-full pointer-events-none"
                              style={{ width: dotSize, height: dotSize, backgroundColor: 'rgba(34,211,238,0.8)' }}
                            />
                          ))}
                        </>
                      )
                    })()}

                    {/* quest reference marker (editor-only aid — never shown in play) */}
                    {cell.entities && cellSize >= 14 && JSON.stringify(cell.entities).includes('questStage') && (
                      <span
                        title="References a quest"
                        className="absolute bottom-0 right-0 z-10 leading-none pointer-events-none"
                        style={{ fontSize: Math.max(7, cellSize * 0.3) }}
                      >📜</span>
                    )}

                    {/* boundary edges */}
                    {(['N', 'S', 'E', 'W'] as EdgeDir[]).map((dir) => {
                      const b = map.boundaries?.[boundaryKey(x, y, dir)]
                      if (!b) return null
                      const type = b.wall !== undefined ? b.wall : b.door ? 1 : 0
                      return <EdgeStripe key={dir} dir={dir} type={type} cellSize={cellSize} hasSwitch={!!b.switch} />
                    })}

                    {/* edge hover highlight */}
                    {props.isEdgeTool && isHovered && props.hoverInfo?.zone && (
                      <div className="absolute pointer-events-none z-30 bg-white/20" style={edgeZoneStyle(props.hoverInfo.zone)} />
                    )}

                    {/* eyedropper source pulse */}
                    {isEyedropSource && (
                      <div className="absolute inset-0 pointer-events-none z-30 bg-cyan-400/25" />
                    )}

                    {/* stamp flash — mounts at full opacity, fades out */}
                    {isFlashing && <FlashOverlay key={key} />}
                  </div>
                )
              })
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────────────

/**
 * Tracks an element's content size via ResizeObserver (used by `fill` layout).
 * Uses a callback ref so the observer attaches whenever the node mounts — the
 * viewport `<main>` only renders after hydration, so an effect with `[]` deps
 * would run too early (while the loading placeholder is shown) and never attach.
 */
function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)
  const refCallback = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ width: r.width, height: r.height })
    })
    ro.observe(node)
    observerRef.current = ro
    // Measure immediately so the first paint isn't stuck at the 8×8 minimum.
    setSize({ width: node.clientWidth, height: node.clientHeight })
  }, [])
  return [refCallback, size] as const
}

function PaletteGroup({
  title,
  hint,
  onAdd,
  addLabel,
  children,
}: {
  title: string
  hint?: string
  onAdd?: () => void
  addLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-white/55 uppercase tracking-wider">
          {title}
          {hint && <span className="ml-1 normal-case font-normal text-white/35 tracking-normal">{hint}</span>}
        </p>
        {onAdd && (
          <button
            onClick={onAdd}
            title={addLabel ?? 'Add custom'}
            className="flex items-center gap-1 px-1.5 h-6 rounded text-[11px] font-medium text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function ToolButton({
  active,
  color,
  label,
  icon,
  custom,
  onClick,
}: {
  active: boolean
  color?: string
  label: string
  icon?: string
  custom?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium leading-tight transition border min-w-0',
        active ? 'border-white/60 text-white bg-white/10' : 'border-white/10 text-white/65 hover:border-white/30 hover:text-white',
      )}
    >
      <span className="h-3 w-3 rounded-sm shrink-0 grid place-items-center text-[8px]" style={{ background: color }}>
        {custom && icon ? icon : ''}
      </span>
      <span className="truncate">{!custom && icon ? `${icon} ` : ''}{label}</span>
    </button>
  )
}

function NoteDialog({
  x,
  y,
  text,
  onChange,
  onSave,
  onClose,
}: {
  x: number
  y: number
  text: string
  onChange: (t: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">
            Note at ({x}, {y})
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={text}
          autoFocus
          maxLength={MAX_NOTE_LEN}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave()
          }}
          rows={4}
          placeholder="Up to 500 characters…"
          className="w-full rounded-md border border-white/15 bg-transparent p-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-white/30">{text.length}/{MAX_NOTE_LEN} · Ctrl+Enter to save</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm text-white/60 hover:bg-white/10">
              Cancel
            </button>
            <button onClick={onSave} className="px-3 py-1.5 rounded-md text-sm bg-amber-600 hover:bg-amber-500 text-white font-medium">
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

