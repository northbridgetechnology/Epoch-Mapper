'use client'

import { cn } from '@/lib/utils'
import type { MapData } from '@/lib/types'
import { THEMES, getTheme } from '@/lib/themes'

interface SettingsWorkspaceProps {
  maps: MapData[]
  onThemeChange: (mapIdx: number, themeId: string) => void
  onDarkChange?: (mapIdx: number, dark: boolean) => void
}

export function SettingsWorkspace({ maps, onThemeChange, onDarkChange }: SettingsWorkspaceProps) {
  if (maps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
        No maps yet — create one in the Map workspace.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">
        <div>
          <h2 className="text-sm font-semibold text-white/70 mb-1">Visual Themes</h2>
          <p className="text-xs text-white/35 leading-relaxed">
            Each map can have its own visual theme — colours drive both the 2D editor and the first-person renderer.
          </p>
        </div>

        {maps.map((map, idx) => {
          const activeTheme = getTheme(map.theme)
          return (
            <div key={map.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  {map.name}
                </span>
                <span className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/25">{activeTheme.name}</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {THEMES.map(t => {
                  const active = t.id === activeTheme.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => onThemeChange(idx, t.id)}
                      title={t.description}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all',
                        active
                          ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                          : 'border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/8',
                      )}
                    >
                      {/* Mini preview swatch */}
                      <div
                        className="w-full rounded-md overflow-hidden"
                        style={{ aspectRatio: '4/3', background: t.fogColor }}
                      >
                        <div className="h-full flex flex-col">
                          {/* Ceiling strip */}
                          <div className="flex-1" style={{ background: `hsl(${t.ceilHue} ${t.ceilSat}% ${t.ceilLBase}%)` }} />
                          {/* Wall strip */}
                          <div className="flex-[2]" style={{ background: `hsl(${t.wallHue} ${t.wallSat}% ${t.wallLBase}%)` }} />
                          {/* Floor strip */}
                          <div className="flex-1" style={{ background: `hsl(${t.floorHue} ${t.floorSat}% ${t.floorLBase}%)` }} />
                        </div>
                      </div>

                      <span className="text-base leading-none">{t.icon}</span>
                      <span className={cn(
                        'text-[10px] font-medium leading-tight text-center',
                        active ? 'text-white/90' : 'text-white/50',
                      )}>
                        {t.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              {onDarkChange && (
                <label className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2 cursor-pointer hover:border-white/15">
                  <input
                    type="checkbox"
                    checked={!!map.dark}
                    onChange={e => onDarkChange(idx, e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  <span className="text-xs text-white/70">🌑 Dark map</span>
                  <span className="text-[10px] text-white/30">
                    View collapses to the party&apos;s light — torches, lanterns, and light magic matter here.
                  </span>
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
