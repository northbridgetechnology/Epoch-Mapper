'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, FilePlus2, FolderOpen, Save, Upload, FileDown, Undo2, ZoomIn, ZoomOut,
  Palette, HelpCircle, Map as MapIcon, Check, Edit2, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolbarProps {
  gameTitle: string
  mapName: string
  zoomPct: number
  canUndo: boolean
  exporting: boolean
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onImport: () => void
  onExportPdf: () => void
  onUndo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onOpenPalette: () => void
  onOpenHelp: () => void
  onRenameMap: (name: string) => void
  onRenameGame: (title: string) => void
}

export function Toolbar(props: ToolbarProps) {
  const [fileOpen, setFileOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const fileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) setFileOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function fileAction(fn: () => void) {
    setFileOpen(false)
    fn()
  }

  function commitName() {
    if (nameInput.trim()) props.onRenameMap(nameInput.trim())
    setEditingName(false)
  }

  return (
    <header className="flex items-center gap-2 px-3 h-13 py-2 border-b border-white/10 bg-zinc-950 shrink-0">
      {/* Left: brand + file menu */}
      <div className="flex items-center gap-2">
        <MapIcon className="h-5 w-5 text-amber-400 shrink-0" />
        <span className="hidden sm:block font-bold text-white text-sm tracking-wide">Epoch Mapper</span>

        <div className="relative ml-1" ref={fileMenuRef}>
          <button
            onClick={() => setFileOpen((v) => !v)}
            className="flex items-center gap-1 px-2.5 h-8 rounded-md text-sm text-white/70 hover:bg-white/10"
          >
            File <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {fileOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-white/10 bg-zinc-900 shadow-xl py-1">
              <MenuItem icon={<FilePlus2 className="h-4 w-4" />} label="New session" onClick={() => fileAction(props.onNew)} />
              <MenuItem icon={<FolderOpen className="h-4 w-4" />} label="Open .epochmap…" onClick={() => fileAction(props.onOpen)} />
              <MenuItem icon={<Upload className="h-4 w-4" />} label="Import .epochmap…" onClick={() => fileAction(props.onImport)} />
              <div className="my-1 h-px bg-white/10" />
              <MenuItem icon={<Save className="h-4 w-4" />} label="Save .epochmap" hint="Ctrl+S" onClick={() => fileAction(props.onSave)} />
              <MenuItem icon={<FileDown className="h-4 w-4" />} label="Export PDF" hint="Ctrl+P" onClick={() => fileAction(props.onExportPdf)} />
            </div>
          )}
        </div>
      </div>

      {/* Center: editable map name */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              autoFocus
              className="h-7 text-sm bg-white/10 border border-white/20 rounded px-2 text-white text-center outline-none"
            />
            <button onClick={commitName} className="text-emerald-400 hover:text-emerald-300">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            className="group flex items-center gap-1.5 text-sm font-semibold text-white hover:text-amber-300 max-w-full"
            onClick={() => {
              setNameInput(props.mapName)
              setEditingName(true)
            }}
            title="Rename map"
          >
            <span className="truncate">{props.mapName || 'Untitled map'}</span>
            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
          </button>
        )}
        {props.gameTitle && <span className="text-[11px] text-white/35 truncate max-w-full">{props.gameTitle}</span>}
      </div>

      {/* Right: zoom / undo / export / palette / help */}
      <div className="flex items-center gap-0.5">
        <IconBtn title="Zoom out (-)" onClick={props.onZoomOut}><ZoomOut className="h-4 w-4" /></IconBtn>
        <span className="text-[11px] text-white/40 w-10 text-center tabular-nums">{props.zoomPct}%</span>
        <IconBtn title="Zoom in (+)" onClick={props.onZoomIn}><ZoomIn className="h-4 w-4" /></IconBtn>
        <Divider />
        <IconBtn title="Undo (Z / Ctrl+Z)" onClick={props.onUndo} disabled={!props.canUndo}><Undo2 className="h-4 w-4" /></IconBtn>
        <IconBtn title="Export PDF (Ctrl+P)" onClick={props.onExportPdf} disabled={props.exporting}>
          {props.exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        </IconBtn>
        <IconBtn title="Marker Palette" onClick={props.onOpenPalette}><Palette className="h-4 w-4" /></IconBtn>
        <IconBtn title="Help (?)" onClick={props.onOpenHelp}><HelpCircle className="h-4 w-4" /></IconBtn>
      </div>
    </header>
  )
}

function MenuItem({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10 hover:text-white"
    >
      <span className="text-white/50">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-[10px] text-white/30 font-mono">{hint}</span>}
    </button>
  )
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid place-items-center h-8 w-8 rounded-md text-white/55 transition',
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-white/10 mx-1" />
}
