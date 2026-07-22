/**
 * Map visual themes — Tier 1 preset packs.
 * Each theme drives both the 2D editor viewport and the first-person SVG renderer.
 * Zero file-size cost: names are stored in MapData.theme, definitions live here.
 */

import type { MapTextures } from './types'

export interface MapThemeDef {
  id: string
  name: string
  icon: string
  description: string

  /** Recommended builtin texture set — applied to freshly-seeded maps so the
   *  world ships with matching relief out of the box (authors can change or
   *  clear it in Settings). Textures tint to this theme's palette. */
  defaultTextures?: MapTextures

  // ── 2D editor ──────────────────────────────────────────────────────────────
  emptyColor: string    // revealed cell with no base terrain
  fogColor: string      // unrevealed cell background
  gapColor: string      // 1 px grid gap between cells
  floorTint?: string    // optional rgba overlay on painted floor cells

  // ── First-person: wall hue/sat/lightness ramp ─────────────────────────────
  wallHue: number; wallSat: number; wallLBase: number; wallLStep: number
  sideHue: number; sideSat: number; sideLBase: number; sideLStep: number

  // ── First-person: floor and ceiling band colors ───────────────────────────
  floorHue: number; floorSat: number; floorLBase: number
  ceilHue:  number; ceilSat:  number; ceilLBase:  number; ceilLStep: number

  // ── First-person: accent / decoration colors ──────────────────────────────
  gridLineColor: string     // perspective grid lines (floor + ceiling)
  ceilPatternColor: string  // stone-mortar pattern stroke on ceiling
  floorGlowColor: string    // near-floor torch/ambient glow
  ambientTint?: string      // optional full-scene rgba overlay (last before vignette)
}

export const THEMES: MapThemeDef[] = [
  {
    id: 'stone_dungeon',
    name: 'Stone Dungeon',
    icon: '🏰',
    description: 'Classic blue-grey stone halls lit by torchlight.',
    defaultTextures: { wall: 'stone_brick', floor: 'flagstone', ceiling: 'rough_hewn' },
    emptyColor: '#18181b', fogColor: '#0a0a0c', gapColor: '#0a0a0c',
    wallHue: 215, wallSat: 18, wallLBase: 58, wallLStep: 11,
    sideHue: 215, sideSat: 14, sideLBase: 42, sideLStep: 9,
    floorHue: 225, floorSat: 12, floorLBase: 17,
    ceilHue:  28,  ceilSat:  14, ceilLBase: 22, ceilLStep: 3,
    gridLineColor: 'rgba(0,0,0,0.30)',
    ceilPatternColor: 'rgba(0,0,0,0.28)',
    floorGlowColor: 'rgba(180,160,100,0.06)',
  },
  {
    id: 'ice_cave',
    name: 'Ice Cave',
    icon: '🧊',
    description: 'Frozen crystalline caverns — pale blue, bitterly cold.',
    defaultTextures: { wall: 'cave_rock', floor: 'cobblestone', ceiling: 'cave_rock' },
    emptyColor: '#0b1520', fogColor: '#060b12', gapColor: '#060b12',
    floorTint: 'rgba(100,160,220,0.05)',
    wallHue: 195, wallSat: 48, wallLBase: 62, wallLStep: 12,
    sideHue: 195, sideSat: 36, sideLBase: 46, sideLStep: 10,
    floorHue: 205, floorSat: 28, floorLBase: 13,
    ceilHue:  190, ceilSat:  40, ceilLBase: 23, ceilLStep: 4,
    gridLineColor: 'rgba(140,200,240,0.18)',
    ceilPatternColor: 'rgba(140,200,255,0.20)',
    floorGlowColor: 'rgba(120,190,230,0.05)',
    ambientTint: 'rgba(80,140,210,0.05)',
  },
  {
    id: 'lava_fortress',
    name: 'Lava Fortress',
    icon: '🌋',
    description: 'Obsidian walls above rivers of fire.',
    defaultTextures: { wall: 'cut_block', floor: 'metal_panel', ceiling: 'rough_hewn' },
    emptyColor: '#1c0a04', fogColor: '#0a0402', gapColor: '#0a0402',
    floorTint: 'rgba(200,60,10,0.07)',
    wallHue: 12, wallSat: 58, wallLBase: 52, wallLStep: 10,
    sideHue: 10, sideSat: 46, sideLBase: 38, sideLStep: 8,
    floorHue: 18, floorSat: 48, floorLBase: 14,
    ceilHue:  8,  ceilSat:  28, ceilLBase: 12, ceilLStep: 2,
    gridLineColor: 'rgba(180,60,20,0.22)',
    ceilPatternColor: 'rgba(0,0,0,0.36)',
    floorGlowColor: 'rgba(220,80,20,0.12)',
    ambientTint: 'rgba(200,55,10,0.07)',
  },
  {
    id: 'ancient_ruins',
    name: 'Ancient Ruins',
    icon: '🏛️',
    description: 'Weathered sandstone, dust, and forgotten gods.',
    defaultTextures: { wall: 'cut_block', floor: 'flagstone', ceiling: 'cracked_plaster' },
    emptyColor: '#1a1610', fogColor: '#0d0c08', gapColor: '#0d0c08',
    floorTint: 'rgba(180,140,60,0.04)',
    wallHue: 35, wallSat: 22, wallLBase: 56, wallLStep: 11,
    sideHue: 33, sideSat: 17, sideLBase: 40, sideLStep: 9,
    floorHue: 40, floorSat: 18, floorLBase: 16,
    ceilHue:  38, ceilSat:  20, ceilLBase: 20, ceilLStep: 3,
    gridLineColor: 'rgba(0,0,0,0.25)',
    ceilPatternColor: 'rgba(0,0,0,0.22)',
    floorGlowColor: 'rgba(200,160,80,0.07)',
    ambientTint: 'rgba(180,140,60,0.04)',
  },
  {
    id: 'forest_depths',
    name: 'Forest Depths',
    icon: '🌿',
    description: 'Ancient overgrown passages beneath a dark canopy.',
    defaultTextures: { wall: 'cobblestone', floor: 'dirt', ceiling: 'wood_beams' },
    emptyColor: '#0a1209', fogColor: '#040705', gapColor: '#040705',
    floorTint: 'rgba(40,110,30,0.07)',
    wallHue: 130, wallSat: 28, wallLBase: 50, wallLStep: 10,
    sideHue: 128, sideSat: 22, sideLBase: 36, sideLStep: 8,
    floorHue: 120, floorSat: 22, floorLBase: 10,
    ceilHue:  125, ceilSat:  32, ceilLBase: 14, ceilLStep: 2,
    gridLineColor: 'rgba(20,80,20,0.22)',
    ceilPatternColor: 'rgba(0,0,0,0.28)',
    floorGlowColor: 'rgba(40,120,20,0.06)',
    ambientTint: 'rgba(30,100,20,0.05)',
  },
]

export const DEFAULT_THEME_ID = 'stone_dungeon'

export function getTheme(id?: string): MapThemeDef {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}
