'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ShoppingCart, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShopDef, ItemDef, ItemInstance, Ruleset } from '@/lib/engine-types'

interface ShopModalProps {
  shop: ShopDef
  ruleset: Ruleset
  inventory: ItemInstance[]
  gold: number
  onClose: () => void
  onTransaction: (inventory: ItemInstance[], gold: number) => void
}

function findItemDef(ruleset: Ruleset, id: string): ItemDef | undefined {
  return ruleset.items.find(i => i.id === id)
}

function addToInventory(inventory: ItemInstance[], itemId: string, qty: number): ItemInstance[] {
  const idx = inventory.findIndex(i => i.def === itemId)
  if (idx >= 0) {
    const next = [...inventory]
    next[idx] = { ...next[idx], qty: next[idx].qty + qty }
    return next
  }
  return [...inventory, { def: itemId, qty }]
}

function removeFromInventory(inventory: ItemInstance[], itemId: string, qty: number): ItemInstance[] {
  return inventory
    .map(i => i.def === itemId ? { ...i, qty: i.qty - qty } : i)
    .filter(i => i.qty > 0)
}

export function ShopModal({
  shop, ruleset, inventory, gold, onClose, onTransaction,
}: ShopModalProps) {
  const [tab, setTab]           = useState<'buy' | 'sell'>('buy')
  const [localInv, setLocalInv] = useState<ItemInstance[]>(inventory)
  const [localGold, setLocalGold] = useState(gold)
  const [message, setMessage]   = useState<string | null>(null)
  const [cursor, setCursor]     = useState(0)

  // Reset cursor when tab changes
  useEffect(() => { setCursor(0) }, [tab])

  const sellableItems = localInv.filter(inst => {
    const def = findItemDef(ruleset, inst.def)
    return def && (def.value ?? 0) > 0
  })

  function flashMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(null), 2000)
  }

  function handleBuy(itemId: string, price: number) {
    if (localGold < price) { flashMessage('Not enough gold!'); return }
    const newInv  = addToInventory(localInv, itemId, 1)
    const newGold = localGold - price
    setLocalInv(newInv); setLocalGold(newGold)
    onTransaction(newInv, newGold)
    flashMessage(`Bought ${findItemDef(ruleset, itemId)?.name ?? itemId}`)
  }

  function handleSell(itemId: string, qty: number) {
    const def = findItemDef(ruleset, itemId)
    if (!def) return
    const sellPrice = Math.max(1, Math.floor((def.value ?? 0) * shop.sellModifier))
    const newInv  = removeFromInventory(localInv, itemId, qty)
    const newGold = localGold + sellPrice * qty
    setLocalInv(newInv); setLocalGold(newGold)
    onTransaction(newInv, newGold)
    flashMessage(`Sold ${def.name} for ${sellPrice}g`)
  }

  // Keyboard navigation — ref pattern for always-fresh closures
  const kbRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  kbRef.current = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName ?? '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }

    // Switch tabs
    if ((e.key === 'Tab' || e.key === 'q' || e.key === 'Q') && shop.buys) {
      e.preventDefault()
      setTab(t => t === 'buy' ? 'sell' : 'buy')
      return
    }

    const list = tab === 'buy' ? shop.stock : sellableItems
    const listLen = list.length

    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault(); setCursor(c => Math.min(listLen - 1, c + 1))
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault(); setCursor(c => Math.max(0, c - 1))
    } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault()
      const c = Math.min(cursor, listLen - 1)
      if (tab === 'buy') {
        const entry = shop.stock[c]
        if (entry) {
          const price = entry.price ?? (findItemDef(ruleset, entry.item)?.value ?? 0)
          handleBuy(entry.item, price)
        }
      } else {
        const inst = sellableItems[c]
        if (inst) handleSell(inst.def, 1)
      }
    }
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => kbRef.current?.(e)
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-[520px] max-h-[80vh] flex flex-col rounded-xl border border-amber-500/20 bg-zinc-900 shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10 bg-zinc-950/60">
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white/90">{shop.name}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-mono text-amber-300">🪙 {localGold}g</span>
            <button onClick={onClose} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Flash message */}
        {message && (
          <div className="px-5 py-2 bg-amber-600/20 text-amber-300 text-sm text-center border-b border-amber-500/20">
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-zinc-950/40">
          <button
            onClick={() => setTab('buy')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              tab === 'buy' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-white/40 hover:text-white/70',
            )}
          >
            Buy
          </button>
          {shop.buys && (
            <button
              onClick={() => setTab('sell')}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                tab === 'sell' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-white/40 hover:text-white/70',
              )}
            >
              Sell
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {tab === 'buy' && (
            <div className="space-y-1.5">
              {shop.stock.length === 0 && (
                <div className="text-center text-white/25 text-sm py-8">This shop has no stock.</div>
              )}
              {shop.stock.map((entry, idx) => {
                const def      = findItemDef(ruleset, entry.item)
                if (!def) return null
                const price    = entry.price ?? def.value ?? 0
                const canAfford = localGold >= price
                const isSelected = idx === cursor
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/60 border transition-colors',
                      isSelected ? 'border-amber-500/50 bg-amber-950/20' : 'border-white/5',
                    )}
                  >
                    {isSelected && <span className="text-amber-300 text-xs flex-shrink-0">▶</span>}
                    <span className="text-xl w-8 text-center flex-shrink-0">{def.icon ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90 truncate">{def.name}</div>
                      <div className="text-xs text-white/35 capitalize">{def.kind}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-sm font-mono font-medium', canAfford ? 'text-amber-300' : 'text-white/30')}>
                        {price}g
                      </span>
                      <button
                        onClick={() => handleBuy(entry.item, price)}
                        disabled={!canAfford}
                        className="px-3 py-1 rounded text-xs font-medium bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Buy {isSelected && <span className="text-[9px] opacity-50">[↵]</span>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'sell' && (
            <div className="space-y-1.5">
              {sellableItems.length === 0 && (
                <div className="text-center text-white/25 text-sm py-8 flex flex-col items-center gap-2">
                  <Package className="w-6 h-6 opacity-30" />
                  <span>Nothing to sell.</span>
                </div>
              )}
              {sellableItems.map((inst, idx) => {
                const def       = findItemDef(ruleset, inst.def)
                if (!def) return null
                const sellPrice = Math.max(1, Math.floor((def.value ?? 0) * shop.sellModifier))
                const isSelected = idx === cursor
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/60 border transition-colors',
                      isSelected ? 'border-amber-500/50 bg-amber-950/20' : 'border-white/5',
                    )}
                  >
                    {isSelected && <span className="text-amber-300 text-xs flex-shrink-0">▶</span>}
                    <span className="text-xl w-8 text-center flex-shrink-0">{def.icon ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/90 truncate">{def.name}</div>
                      <div className="text-xs text-white/35">Qty: {inst.qty}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-medium text-green-400">{sellPrice}g</span>
                      <button
                        onClick={() => handleSell(inst.def, 1)}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-600/20 text-green-300 hover:bg-green-600/40 transition-colors"
                      >
                        Sell {isSelected && <span className="text-[9px] opacity-50">[↵]</span>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-zinc-950/40 flex items-center justify-between">
          <span className="text-[9px] text-white/20 font-mono">
            ↑↓ navigate · ↵ / Z confirm{shop.buys ? ' · Q / Tab switch tab' : ''} · Esc leave
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm text-white/70 hover:text-white border border-white/10 hover:border-white/30"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
