'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = machines.find((m) => m.id === selectedId) ?? machines[0]

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
      setOpen(false)
    },
    [onSelect]
  )

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse') {
      e.preventDefault()
    }
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onPointerDown={handlePointerDown}
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

      {open && (
        <div className="absolute z-30 mt-1.5 max-h-[340px] w-full overflow-auto rounded-[var(--ui-radius-md)] border border-slate-200 bg-white p-1.5 shadow-xl">
          <div role="listbox" aria-label="Target machine options" className="space-y-1">
            {machines.map((machine) => {
              const isActive = machine.id === selectedId
              return (
                <button
                  key={machine.id}
                  type="button"
                  onClick={() => handleSelect(machine.id)}
                  onPointerDown={handlePointerDown}
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
        </div>
      )}
    </div>
  )
}

export default memo(MachineDropdown)
