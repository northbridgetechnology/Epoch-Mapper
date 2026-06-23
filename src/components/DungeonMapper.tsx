'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, MapPin, Eraser, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, uid } from '@/lib/utils'
import {
  BASE, BASE_PALETTE, BASE_TYPES, CHUNK_SIZE, DEFAULT_CELL, EDGE_PALETTE, EDGE_TYPES,
  MAX_CELL, MAX_NOTE_LEN, MIN_CELL, OVERLAY_PALETTE, OVERLAY_TYPES, VIEWPORT_CELLS, VIEWPORT_PX,
  baseDef, edgeDef, overlayDef,
} from '@/lib/constants'
import type { CellData, CellMap, CustomMarker, EdgeDir, EpochmapFile, MapData, MarkerDef } from '@/lib/types'
import { parseDotEpochmap, serializeDotEpochmap } from '@/lib/epochmap-codec'
import { exportMapsAsPdf } from '@/lib/dungeon-export'
import { Toolbar } from './Toolbar'
import { WelcomeModal } from './WelcomeModal'
import { CellTooltip } from './CellTooltip'

const DRAFT_KEY = 'epochmapper.draft'
const WELCOME_KEY = 'epochmapper.welcomed'

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

export function DungeonMapper() {
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
  const [canUndo, setCanUndo] = useState(false)

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

  // ── Hydration: restore draft or start fresh ───────────────────────────────────
  useEffect(() => {
    let restored: EpochmapFile | null = null
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as EpochmapFile
        if (parsed?.maps?.length) restored = parsed
      }
    } catch {
      /* ignore corrupt draft */
    }
    const session = restored ?? newSession()
    setGameTitle(session.gameTitle ?? '')
    setRomHash(session.romHash ?? '')
    setCustomMarkers(session.customMarkers ?? [])
    setMaps(session.maps)
    setActiveIdx(0)
    setHydrated(true)
    if (restored) {
      setTimeout(() => toast('Restored unsaved session'), 50)
    }
    if (!localStorage.getItem(WELCOME_KEY)) setShowWelcome(true)
  }, [])

  // ── Draft auto-save (debounced 500ms) ─────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        const session: EpochmapFile = { version: 1, gameTitle, romHash, customMarkers, maps }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(session))
      } catch {
        /* storage full / unavailable */
      }
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [maps, gameTitle, romHash, customMarkers, hydrated])

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
    },
    [activeMap, updateActiveMap, revealAround],
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
          toast.success(`Opened ${loaded.length} map${loaded.length === 1 ? '' : 's'}`)
        } else {
          recordHistory()
          setCustomMarkers((prev) => mergeMarkers(prev, parsed.customMarkers))
          setMaps((prev) => {
            const next = [...prev, ...loaded]
            setActiveIdx(prev.length)
            return next
          })
          if (!gameTitle && parsed.gameTitle) setGameTitle(parsed.gameTitle)
          toast.success(`Imported ${loaded.length} map${loaded.length === 1 ? '' : 's'}`)
        }
      } catch (err) {
        toast.error((err as Error).message || 'Could not read .epochmap file')
      }
    },
    [gameTitle, recordHistory],
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

  if (!hydrated) {
    return <div className="h-screen w-screen grid place-items-center bg-zinc-950 text-white/40 text-sm">Loading…</div>
  }

  return (
    <div
      className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file?.name.endsWith('.epochmap')) loadFile(file, 'open')
      }}
    >
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
        onOpenPalette={() => setShowPalette(true)}
        onOpenHelp={() => setShowWelcome(true)}
        onRenameMap={(name) => updateActiveMap({ name })}
        onRenameGame={setGameTitle}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: map list + tool palette */}
        <aside className="w-64 shrink-0 border-r border-white/10 flex flex-col bg-zinc-950 overflow-y-auto">
          {/* Maps */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Maps</span>
              <button onClick={addMap} title="Add map" className="grid place-items-center h-6 w-6 rounded text-white/50 hover:text-white hover:bg-white/10">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {maps.map((m, i) => (
                <div
                  key={m.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer',
                    i === activeIdx ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30' : 'text-white/60 hover:bg-white/5',
                  )}
                  onClick={() => setActiveIdx(i)}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{m.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMap(i)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-rose-400"
                    title="Delete map"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Game title field */}
          <div className="p-3 border-b border-white/10">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Game title</label>
            <input
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="e.g. Dragon Quest"
              className="mt-1.5 w-full h-8 rounded-md border border-white/15 bg-transparent px-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          {/* Tool palette */}
          <div className="p-3 space-y-4">
            <PaletteGroup title="Terrain">
              <div className="grid grid-cols-3 gap-1">
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
              </div>
            </PaletteGroup>

            <PaletteGroup title="Overlays (toggle)">
              <div className="grid grid-cols-3 gap-1">
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
              </div>
            </PaletteGroup>

            <PaletteGroup title="Edges (click cell border)">
              <div className="grid grid-cols-2 gap-1">
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
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium border transition',
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
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium border transition',
                  activeToolId === 'player'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80',
                )}
              >
                <MapPin className="h-3.5 w-3.5" /> Place ⊕
              </button>
            </div>

            <p className="text-[10px] text-white/30 leading-relaxed">
              Arrow keys / WASD move ⊕ · F toggles fog · N adds a note · right-click erases · middle-drag pans.
            </p>
          </div>
        </aside>

        {/* Center: viewport */}
        <main
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
      {showPalette && <MarkerPalettePlaceholder onClose={() => setShowPalette(false)} />}
    </div>
  )
}

// ── Viewport (camera window) ────────────────────────────────────────────────────

interface ViewportProps {
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
  const { map, cellSize, cameraOffset } = props
  const half = Math.floor(VIEWPORT_CELLS / 2)
  const px = map.playerX
  const py = map.playerY
  const minX = px - half + cameraOffset.x
  const minY = py - half + cameraOffset.y
  const rulerSize = 18

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
      <div className="flex flex-col" style={{ width: VIEWPORT_PX + rulerSize + 1, height: VIEWPORT_PX + rulerSize + 1 }}>
        {/* X ruler */}
        <div className="flex shrink-0" style={{ marginLeft: rulerSize + 1 }}>
          {Array.from({ length: VIEWPORT_CELLS }, (_, ci) => (
            <div key={ci} className="text-center text-[8px] text-white/30 shrink-0 overflow-hidden" style={{ width: cellSize, marginRight: 1 }}>
              {minX + ci}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Y ruler */}
          <div className="flex flex-col shrink-0" style={{ width: rulerSize, marginTop: 1 }}>
            {Array.from({ length: VIEWPORT_CELLS }, (_, ri) => (
              <div
                key={ri}
                className="flex items-center justify-end pr-[3px] text-[8px] text-white/30 shrink-0 overflow-hidden"
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
              gridTemplateColumns: `repeat(${VIEWPORT_CELLS}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${VIEWPORT_CELLS}, ${cellSize}px)`,
              gap: '1px',
              backgroundColor: '#0a0a0c',
            }}
          >
            {Array.from({ length: VIEWPORT_CELLS }, (_, ri) => {
              const y = minY + ri
              return Array.from({ length: VIEWPORT_CELLS }, (_, ci) => {
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

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{title}</p>
      {children}
    </div>
  )
}

function ToolButton({
  active,
  color,
  label,
  icon,
  onClick,
}: {
  active: boolean
  color?: string
  label: string
  icon?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium leading-tight transition border min-w-0',
        active ? 'border-white/60 text-white bg-white/10' : 'border-white/10 text-white/55 hover:border-white/30 hover:text-white/85',
      )}
    >
      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
      <span className="truncate">{icon ? `${icon} ` : ''}{label}</span>
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

// Phase 2 builds the full Marker Palette (custom cell types & overlays). This
// placeholder keeps the toolbar button wired so the help text stays accurate.
function MarkerPalettePlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-900 p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-2">Marker Palette</h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Custom cell types and overlay icons arrive in Phase 2. The <code className="text-amber-200">.epochmap</code>{' '}
          format and codec already round-trip custom markers, so saved files are forward-compatible.
        </p>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium">
          Got it
        </button>
      </div>
    </div>
  )
}

// ── Marker merge (used on import) ────────────────────────────────────────────────

function mergeMarkers(existing: CustomMarker[], incoming: CustomMarker[]): CustomMarker[] {
  const byId = new Map(existing.map((m) => [m.id, m]))
  for (const m of incoming) if (!byId.has(m.id)) byId.set(m.id, m)
  return [...byId.values()]
}
