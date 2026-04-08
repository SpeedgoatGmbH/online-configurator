'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { cn } from '@/lib/cn'

export interface MachineOption {
  id: string
  name: string
  keywords: string
  blurb: string
  image: string
  maxSlots: number
  maxSlotsExpanded: number
  variants?: { suffix: string; maxSlots: number }[]
}

interface MachineDropdownProps {
  machines: readonly MachineOption[]
  selectedId: string
  onSelect: (id: string) => void
}

function MachineDropdown({ machines, selectedId, onSelect }: MachineDropdownProps) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = machines.find((m) => m.id === selectedId) ?? machines[0]

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
      setOpen(false)
    },
    [onSelect]
  )

  const updateMenuRect = useCallback(() => {
    if (!buttonRef.current) return

    const rect = buttonRef.current.getBoundingClientRect()
    const viewportPadding = 12
    const width = Math.min(rect.width, window.innerWidth - rect.left - viewportPadding)

    setMenuRect({
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(width, 240),
    })
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return

    updateMenuRect()

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target
      if (
        target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onLayoutChange = () => updateMenuRect()

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onLayoutChange)
    window.addEventListener('scroll', onLayoutChange, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onLayoutChange)
      window.removeEventListener('scroll', onLayoutChange, true)
    }
  }, [open, updateMenuRect])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-[var(--ui-radius-md)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select target machine"
      >
        <div className="flex items-center gap-2.5 rounded-[var(--ui-radius-md)] border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 transition hover:border-slate-300 hover:bg-slate-50">
          <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
            <Image src={selected.image} alt={selected.name} fill className="object-contain p-1" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
            <p className="text-xs text-slate-600">
              {selected.keywords} · {selected.maxSlots} slots (up to {selected.maxSlotsExpanded})
            </p>
          </div>
          <span className="shrink-0 text-xs text-slate-500">{open ? '▴' : '▾'}</span>
        </div>
      </button>

      {open &&
        menuRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[140] max-h-[340px] overflow-auto rounded-[var(--ui-radius-md)] border border-slate-200 bg-white p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.16)]"
            style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width }}
          >
          <div role="listbox" aria-label="Target machine options" className="space-y-1">
            {machines.map((machine) => {
              const isActive = machine.id === selectedId
              return (
                <button
                  key={machine.id}
                  type="button"
                  onClick={() => handleSelect(machine.id)}
                  className={cn(
                    'w-full rounded-[var(--ui-radius-md)] text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
                    isActive && 'ring-1 ring-[rgb(var(--speedgoat-blue))]'
                  )}
                  role="option"
                  aria-selected={isActive}
                >
                  <div className="flex items-center gap-2.5 rounded-[var(--ui-radius-md)] border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 hover:border-slate-300 hover:bg-slate-50">
                    <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
                      <Image src={machine.image} alt={machine.name} fill className="object-contain p-1" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{machine.name}</p>
                      <p className="text-xs text-slate-600">
                        {machine.keywords} · {machine.maxSlots} slots (up to {machine.maxSlotsExpanded})
                      </p>
                    </div>
                    {isActive && (
                      <span className="shrink-0 text-[11px] font-semibold text-[rgb(var(--speedgoat-blue))]">✓</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default memo(MachineDropdown)
