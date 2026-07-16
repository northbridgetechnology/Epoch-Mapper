/** How a dressing object anchors inside its sub-cube cell in the first-person view. */
export type SubcubeMount = 'wall' | 'ceiling' | 'floor' | 'free'

export interface SubcubeKindDef {
  kind: string
  label: string
  icon: string
  category: 'light' | 'decor' | 'furniture' | 'creature' | 'nature'
  color: string
  /** wall: snaps flush to the side wall of its column; ceiling/floor: hangs from / stands on the plane; free: floats at the sub-cube centre. */
  mount: SubcubeMount
  /** Rendered sprite height as a fraction of the full wall height at the object's depth. */
  scale: number
}

export const SUBCUBE_KIND_DEFS: SubcubeKindDef[] = [
  { kind: 'torch',      label: 'Torch',      icon: '🔥', category: 'light',     color: '#ff6b35', mount: 'wall',    scale: 0.35 },
  { kind: 'sconce',     label: 'Sconce',     icon: '🕯️', category: 'light',     color: '#ffd700', mount: 'wall',    scale: 0.28 },
  { kind: 'chandelier', label: 'Chandelier', icon: '🪔', category: 'light',     color: '#fff8cc', mount: 'ceiling', scale: 0.38 },
  { kind: 'banner',     label: 'Banner',     icon: '🚩', category: 'decor',     color: '#8b0000', mount: 'wall',    scale: 0.55 },
  { kind: 'chains',     label: 'Chains',     icon: '⛓️', category: 'decor',     color: '#a0a0a0', mount: 'wall',    scale: 0.50 },
  { kind: 'cobweb',     label: 'Cobweb',     icon: '🕸️', category: 'decor',     color: '#c8c8c8', mount: 'ceiling', scale: 0.30 },
  { kind: 'barrel',     label: 'Barrel',     icon: '🛢️', category: 'furniture', color: '#8b4513', mount: 'floor',   scale: 0.38 },
  { kind: 'crate',      label: 'Crate',      icon: '📦', category: 'furniture', color: '#d2691e', mount: 'floor',   scale: 0.36 },
  { kind: 'pillar',     label: 'Pillar',     icon: '🏛️', category: 'furniture', color: '#b8a88a', mount: 'floor',   scale: 0.92 },
  { kind: 'altar',      label: 'Altar',      icon: '⛩️', category: 'furniture', color: '#6a5acd', mount: 'floor',   scale: 0.45 },
  { kind: 'bones',      label: 'Bones',      icon: '🦴', category: 'nature',    color: '#e8e8d0', mount: 'floor',   scale: 0.22 },
  { kind: 'stalactite', label: 'Stalactite', icon: '🔻', category: 'nature',    color: '#9b8b7b', mount: 'ceiling', scale: 0.42 },
  { kind: 'bat',        label: 'Bat',        icon: '🦇', category: 'creature',  color: '#4a3060', mount: 'free',    scale: 0.22 },
  { kind: 'rat',        label: 'Rat',        icon: '🐀', category: 'creature',  color: '#7a6050', mount: 'floor',   scale: 0.18 },
  { kind: 'spider',     label: 'Spider',     icon: '🕷️', category: 'creature',  color: '#202020', mount: 'free',    scale: 0.22 },
]

export function getSubcubeDef(kind: string): SubcubeKindDef | undefined {
  return SUBCUBE_KIND_DEFS.find(d => d.kind === kind)
}
