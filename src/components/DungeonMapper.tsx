'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, MapPin, Eraser, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, uid } from '@/lib/utils'
import {
  BASE, BASE_PALETTE, BASE_TYPES, CHUNK_SIZE, DEFAULT_CELL, EDGE_PALETTE, EDGE_TYPES,
  MAX_CELL, MAX_NOTE_LEN, MIN_CELL, OVERLAY_PALETTE, OVERLAY_TYPES, VIEWPORT_CELLS,
  baseDef, edgeDef, overlayDef,
} from '@/lib/constants'
import type { CellData, CellMap, CustomMarker, EdgeDir, EpochmapFile, MapData, MarkerDef } from '@/lib/types'
import { parseDotEpochmap, serializeDotEpochmap } from '@/lib/epochmap-codec'
import { resolveMarkerImport, remapMapMarkers } from '@/lib/markers'
import { exportMapsAsPdf } from '@/lib/dungeon-export'
import { Map, Database, Users, Play, Settings } from 'lucide-react'
import { Toolbar } from './Toolbar'
import { WelcomeModal } from './WelcomeModal'
import { CellTooltip } from './CellTooltip'
import { MarkerPalette } from './MarkerPalette'
import { PartyWorkspace } from './workspaces/PartyWorkspace'
import { DatabaseWorkspace } from './workspaces/DatabaseWorkspace'
import type { Character, Formation, ItemInstance, ResolvedEncounter, Ruleset } from '@/lib/engine-types'
import { makeDefaultRuleset } from '@/lib/default-ruleset'
import { savePartyTemplate, loadPartyTemplate } from '@/lib/save-state'
import { checkCellForEncounter, visitedFlagKey } from '@/lib/encounter-engine'
import { EncounterModal } from './EncounterModal'

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

function toolId(t: Tool): string {
  return t.kind === 'erase' || t.kind === 'player' ? t.kind : `${t.kind}:${t.value}`
}

// ── Cell helpers ───────────────────────────────────────────────────────────────

const EMPTY_CELL: CellData = { base: 0, overlays: [], edges: {} }

function isCellEmpty(c: CellData) {
  return (c.base ?? 0) === 0 && c.overlays.length === 0 && Object.keys(c.edges).length === 0 && !c.note
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

function EdgeStripe({ dir, type, cellSize }: { dir: EdgeDir; type: number; cellSize: number }) {
  const color = edgeDef(type).color
  const w = Math.max(2, Math.round(cellSize / 8))
  const gap = type === 0 ? 0 : Math.round(cellSize * 0.18)
  const style: React.CSSProperties = { position: 'absolute', backgroundColor: color, pointerEvents: 'none' }
  if (dir === 'N') Object.assign(style, { top: 0, left: gap, right: gap, height: w })
  if (dir === 'S') Object.assign(style, { bottom: 0, left: gap, right: gap, height: w })
  if (dir === 'W') Object.assign(style, { left: 0, top: gap, bottom: gap, width: w })
  if (dir === 'E') Object.assign(style, { right: 0, top: gap, bottom: gap, width: w })
  return <div style={style} />
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
  const [cellSize, setCellSize] = useState(DEFAULT_CELL)
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteSelectId, setPaletteSelectId] = useState<number | undefined>(undefined)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: CellData; isPlayer: boolean } | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; zone: EdgeDir | null } | null>(null)
  const [noteDialog, setNoteDialog] = useState<{ x: number; y: number; text: string } | null>(null)

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
  const [ruleset, setRuleset] = useState<Ruleset>(() => makeDefaultRuleset())
  const [party, setParty] = useState<Character[]>([])
  const [formation, setFormation] = useState<Formation>({ front: [], back: [] })
  const [inventory, setInventory] = useState<ItemInstance[]>([])
  const [gold, setGold] = useState<number>(100)
  const [flags, setFlags] = useState<Record<string, boolean | number | string>>({})
  const [activeEncounter, setActiveEncounter] = useState<ResolvedEncounter | null>(null)

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
      const session: EpochmapFile = { version: 1, gameTitle, romHash, customMarkers, maps }
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
  }, [maps, gameTitle, romHash, customMarkers, hydrated, onSessionChange])

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

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      if (!activeMap) return
      const nx = activeMap.playerX + dx
      const ny = activeMap.playerY + dy
      updateActiveMap((m) => ({ playerX: nx, playerY: ny, revealedChunks: revealAround(m, nx, ny) }))
      setCameraOffset({ x: 0, y: 0 })

      // Encounter check
      const cellKey = `${nx},${ny}`
      const cell = activeMap.cells[cellKey]
      if (cell) {
        const encounter = checkCellForEncounter(cell, flags, ruleset, Math.random)
        if (encounter) {
          setActiveEncounter(encounter)
          const visitedKey = visitedFlagKey(encounter.tableId, nx, ny)
          setFlags(prev => ({ ...prev, [visitedKey]: true }))
        }
      }
    },
    [activeMap, updateActiveMap, revealAround, ruleset, flags],
  )

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

  function handleCellClick(e: React.MouseEvent<HTMLDivElement>, x: number, y: number) {
    if (!activeMap || !isCellRevealed(x, y)) return
    const key = `${x},${y}`
    const cur = activeMap.cells[key] ?? EMPTY_CELL

    if (activeTool.kind === 'player') {
      updateActiveMap((m) => ({ playerX: x, playerY: y, revealedChunks: revealAround(m, x, y) }))
      setCameraOffset({ x: 0, y: 0 })
      return
    }

    if (activeTool.kind === 'edge') {
      const rect = e.currentTarget.getBoundingClientRect()
      const dir = getEdgeDir((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
      if (!dir) return
      const edges = { ...cur.edges }
      if (edges[dir] === activeTool.value) delete edges[dir]
      else edges[dir] = activeTool.value
      writeCell(key, { ...cur, edges })
      return
    }

    if (activeTool.kind === 'erase') {
      writeCell(key, EMPTY_CELL)
      return
    }

    if (activeTool.kind === 'base') {
      writeCell(key, { ...cur, base: activeTool.value })
      return
    }

    // overlay: toggle
    const has = cur.overlays.includes(activeTool.value)
    const overlays = has ? cur.overlays.filter((o) => o !== activeTool.value) : [...cur.overlays, activeTool.value]
    writeCell(key, { ...cur, overlays })
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
      const edges = { ...cur.edges }
      delete edges[dir]
      writeCell(key, { ...cur, edges })
      return
    }
    writeCell(key, EMPTY_CELL)
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
    setMaps((prev) => {
      const next = [...prev, newMap(`Map ${prev.length + 1}`)]
      setActiveIdx(next.length - 1)
      return next
    })
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

  const doNew = useCallback(() => {
    const s = newSession()
    historyRef.current = []
    setCanUndo(false)
    setGameTitle('')
    setRomHash('')
    setCustomMarkers([])
    setMaps(s.maps)
    setActiveIdx(0)
  }, [])

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
    const file: EpochmapFile = { version: 1, gameTitle, romHash, customMarkers, maps }
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

      if (!mapperHoveredRef.current) return
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
  }, [activeMap, movePlayer, toggleReveal, openNoteForPlayer, undo, saveEpochmap, exportPdf])

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

      {/* Play workspace (stub) */}
      {workspace === 'play' && (
        <div className="flex-1 flex items-center justify-center text-white/20 text-sm flex-col gap-2">
          <Play className="w-8 h-8 opacity-30" />
          <span>Play — Phase E4</span>
          <span className="text-xs text-white/15">Build your party first, then run the dungeon</span>
        </div>
      )}

      {/* Settings workspace (stub) */}
      {workspace === 'settings' && (
        <div className="flex-1 flex items-center justify-center text-white/20 text-sm flex-col gap-2">
          <Settings className="w-8 h-8 opacity-30" />
          <span>Settings — coming soon</span>
        </div>
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

            <p className="text-xs text-white/45 leading-relaxed">
              Arrow keys / WASD move ⊕ · F toggles fog · N adds a note · right-click erases · middle-drag pans.
            </p>
          </div>
        </aside>

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
              cellSize={cellSize}
              cameraOffset={cameraOffset}
              isPanning={isPanning}
              isEdgeTool={isEdgeTool}
              isPlayerTool={activeTool.kind === 'player'}
              hoverInfo={hoverInfo}
              customBase={customBase}
              customOverlay={customOverlay}
              isCellRevealed={isCellRevealed}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
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

      {/* Encounter modal (shown over any workspace) */}
      {activeEncounter && (
        <EncounterModal
          encounter={activeEncounter}
          onFight={() => {
            toast('Combat — Phase E4')
            setActiveEncounter(null)
          }}
          onFlee={() => setActiveEncounter(null)}
        />
      )}
    </div>
  )
}

// ── Viewport (camera window) ────────────────────────────────────────────────────

interface ViewportProps {
  layout: 'fill' | 'fixed'
  availW: number
  availH: number
  map: MapData
  cellSize: number
  cameraOffset: { x: number; y: number }
  isPanning: boolean
  isEdgeTool: boolean
  isPlayerTool: boolean
  hoverInfo: { x: number; y: number; zone: EdgeDir | null } | null
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  onCellClick: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellRightClick: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellMouseMove: (e: React.MouseEvent<HTMLDivElement>, x: number, y: number) => void
  onCellHoverEnd: () => void
  onTooltip: (t: { x: number; y: number; cell: CellData; isPlayer: boolean }) => void
  onWheel: (delta: number) => void
  onPanStart: (x: number, y: number) => void
  onPanMove: (x: number, y: number) => void
  onPanEnd: () => void
}

function Viewport(props: ViewportProps) {
  const { map, cellSize, cameraOffset, layout, availW, availH } = props
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
      }}
      onMouseLeave={props.onPanEnd}
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
              backgroundColor: '#0a0a0c',
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

                if (!revealed) {
                  return <div key={key} style={{ width: cellSize, height: cellSize, background: '#0a0a0c' }} />
                }

                const bg = (cell.base ?? 0) !== 0 ? baseDef(cell.base, props.customBase).color : '#18181b'

                return (
                  <div
                    key={key}
                    className={cn(
                      'relative overflow-hidden',
                      props.isPlayerTool ? 'cursor-cell' : 'cursor-crosshair',
                      isPlayer ? 'ring-1 ring-inset ring-amber-300 z-10' : '',
                    )}
                    style={{ width: cellSize, height: cellSize, background: bg }}
                    onClick={(e) => props.onCellClick(e, x, y)}
                    onContextMenu={(e) => props.onCellRightClick(e, x, y)}
                    onMouseMove={(e) => {
                      props.onCellMouseMove(e, x, y)
                      props.onTooltip({ x: e.clientX, y: e.clientY, cell, isPlayer })
                    }}
                    onMouseLeave={props.onCellHoverEnd}
                  >
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

                    {/* edges */}
                    {(Object.keys(cell.edges) as EdgeDir[]).map((dir) => (
                      <EdgeStripe key={dir} dir={dir} type={cell.edges[dir]!} cellSize={cellSize} />
                    ))}

                    {/* edge hover highlight */}
                    {props.isEdgeTool && isHovered && props.hoverInfo?.zone && (
                      <div className="absolute pointer-events-none z-30 bg-white/20" style={edgeZoneStyle(props.hoverInfo.zone)} />
                    )}
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

