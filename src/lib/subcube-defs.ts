export interface SubcubeKindDef {
  kind: string
  label: string
  icon: string
  category: 'light' | 'decor' | 'furniture' | 'creature' | 'nature'
  color: string
}

export const SUBCUBE_KIND_DEFS: SubcubeKindDef[] = [
  { kind: 'torch',      label: 'Torch',      icon: '🔥', category: 'light',     color: '#ff6b35' },
  { kind: 'sconce',     label: 'Sconce',     icon: '🕯️', category: 'light',     color: '#ffd700' },
  { kind: 'chandelier', label: 'Chandelier', icon: '🪔', category: 'light',     color: '#fff8cc' },
  { kind: 'banner',     label: 'Banner',     icon: '🚩', category: 'decor',     color: '#8b0000' },
  { kind: 'chains',     label: 'Chains',     icon: '⛓️', category: 'decor',     color: '#a0a0a0' },
  { kind: 'cobweb',     label: 'Cobweb',     icon: '🕸️', category: 'decor',     color: '#c8c8c8' },
  { kind: 'barrel',     label: 'Barrel',     icon: '🛢️', category: 'furniture', color: '#8b4513' },
  { kind: 'crate',      label: 'Crate',      icon: '📦', category: 'furniture', color: '#d2691e' },
  { kind: 'pillar',     label: 'Pillar',     icon: '🏛️', category: 'furniture', color: '#b8a88a' },
  { kind: 'altar',      label: 'Altar',      icon: '⛩️', category: 'furniture', color: '#6a5acd' },
  { kind: 'bones',      label: 'Bones',      icon: '🦴', category: 'nature',    color: '#e8e8d0' },
  { kind: 'stalactite', label: 'Stalactite', icon: '🔻', category: 'nature',    color: '#9b8b7b' },
  { kind: 'bat',        label: 'Bat',        icon: '🦇', category: 'creature',  color: '#4a3060' },
  { kind: 'rat',        label: 'Rat',        icon: '🐀', category: 'creature',  color: '#7a6050' },
  { kind: 'spider',     label: 'Spider',     icon: '🕷️', category: 'creature',  color: '#202020' },
]

export function getSubcubeDef(kind: string): SubcubeKindDef | undefined {
  return SUBCUBE_KIND_DEFS.find(d => d.kind === kind)
}
