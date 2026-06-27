import type { ShopDef, FieldSchema } from './engine-types'

export const SHOP_SCHEMA: FieldSchema[] = [
  { key: 'name',          label: 'Name',                        type: 'text' },
  { key: 'icon',          label: 'Icon',                        type: 'icon',    optional: true },
  { key: 'color',         label: 'Color',                       type: 'color',   optional: true },
  { key: 'description',   label: 'Description',                 type: 'textarea', optional: true },
  { key: 'buys',          label: 'Buys from Player',            type: 'boolean' },
  { key: 'sellModifier',  label: 'Player Sell Price (0–1 × value)', type: 'number', min: 0, max: 1 },
]

export function blankShop(id: string): ShopDef {
  return {
    id,
    name: 'New Shop',
    buys: true,
    sellModifier: 0.5,
    stock: [],
  }
}
