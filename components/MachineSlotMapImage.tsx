'use client'

import * as RadixTooltip from '@radix-ui/react-tooltip'
import MachineChassisStrip from '@/components/MachineChassisStrip'
import type { ProposalRecommendedModule, ProposalRowDiff } from '@/components/configurator/proposalTypes'
import { cn } from '@/lib/cn'
import type { SlotMapMachineContext } from '@/lib/slotMapStorage'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

type CategoryColor = { bg: string; border: string; text: string; label: string; ring: string; chip: string; dot: string }

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  analog:        { bg: 'bg-blue-50/85',    border: 'border-blue-300/80',    text: 'text-blue-800',    label: 'Analog',    ring: 'ring-blue-400',    chip: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
  digital:       { bg: 'bg-emerald-50/85', border: 'border-emerald-300/80', text: 'text-emerald-800', label: 'Digital',   ring: 'ring-emerald-400', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
  communication: { bg: 'bg-amber-50/85',   border: 'border-amber-300/80',   text: 'text-amber-800',   label: 'Comm',      ring: 'ring-amber-400',   chip: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' },
  motion:        { bg: 'bg-fuchsia-50/85', border: 'border-fuchsia-300/80', text: 'text-fuchsia-800', label: 'Motion',    ring: 'ring-fuchsia-400', chip: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700', dot: 'bg-fuchsia-500' },
  interface:     { bg: 'bg-slate-100/85',  border: 'border-slate-300/90',   text: 'text-slate-700',   label: 'Interface', ring: 'ring-slate-400',   chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-500' },
}

const FALLBACK_COLOR: CategoryColor = {
  bg: 'bg-slate-100/85', border: 'border-slate-300/90', text: 'text-slate-700',
  label: 'Other', ring: 'ring-slate-300', chip: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-500',
}
const CATEGORY_LEGEND_ORDER = ['analog', 'digital', 'communication', 'motion', 'interface'] as const

type SlotEntry = {
  moduleId: string
  friendlyName: string
  categoryId: string
}

type MachineSlotMapImageProps = {
  machine: SlotMapMachineContext
  modules: ProposalRecommendedModule[] | null
  rowDiffs: ProposalRowDiff[] | null
  showDetails?: boolean
}

type PerformanceSlotPreset = {
  slotCount: number
  topPx: number
  heightPx: number
  leftPx: number
  slotPitchPx: number
  slotBoxWidthPx: number
  slotInsetPx: number
  jumpBeforeSlot: number
  jumpPx: number
  jumpMarkerOffsetPx: number
}

const PERFORMANCE_SLOT_PRESET: PerformanceSlotPreset = {
  slotCount: 12,
  // Geometry anchored to machine-performance.png (3585 x 2115).
  // Slot #8 starts after an extra spacer (jump) following slot #7.
  topPx: 862,
  heightPx: 622,
  leftPx: 1606,
  slotPitchPx: 105,
  slotBoxWidthPx: 96,
  slotInsetPx: 4,
  jumpBeforeSlot: 8,
  jumpPx: 48,
  // Fine-tune only the visual jump marker so slot placement stays untouched.
  jumpMarkerOffsetPx: -37,
}

const PERF_IMAGE_WIDTH = 3585
const PERF_IMAGE_HEIGHT = 2115
const EASTER_HOTSPOT = {
  // Tuned to sit on the front-panel power button.
  leftPx: 907,
  topPx: 1118,
  widthPx: 76,
  heightPx: 76,
}
const EASTER_TRIGGER_CLICKS = 3
const EASTER_CLICK_WINDOW_MS = 900
const EASTER_DURATION_MS = 2100
const EASTER_SPARKS = [
  { x: -20, y: -12, delay: 0, hue: 0 },
  { x: 4, y: -22, delay: 45, hue: 35 },
  { x: 20, y: -10, delay: 90, hue: 65 },
  { x: 24, y: 10, delay: 130, hue: 95 },
  { x: 12, y: 22, delay: 170, hue: 125 },
  { x: -8, y: 24, delay: 210, hue: 165 },
  { x: -24, y: 10, delay: 250, hue: 200 },
  { x: -26, y: -4, delay: 290, hue: 255 },
] as const

function toXPct(px: number): string {
  return `${(px / PERF_IMAGE_WIDTH) * 100}%`
}

function toYPct(px: number): string {
  return `${(px / PERF_IMAGE_HEIGHT) * 100}%`
}

function getSlotLeftPx(index: number): number {
  const jump = index >= PERFORMANCE_SLOT_PRESET.jumpBeforeSlot ? PERFORMANCE_SLOT_PRESET.jumpPx : 0
  return (
    PERFORMANCE_SLOT_PRESET.leftPx +
    index * PERFORMANCE_SLOT_PRESET.slotPitchPx +
    PERFORMANCE_SLOT_PRESET.slotInsetPx +
    jump
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCategoryMap(rowDiffs: ProposalRowDiff[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const diff of rowDiffs) {
    for (const ref of diff.moduleRefs) {
      if (!map.has(ref)) map.set(ref, diff.categoryId)
    }
  }
  return map
}

function buildModuleRowsMap(rowDiffs: ProposalRowDiff[]): Map<string, ProposalRowDiff[]> {
  const map = new Map<string, ProposalRowDiff[]>()
  for (const diff of rowDiffs) {
    for (const ref of diff.moduleRefs) {
      const arr = map.get(ref) ?? []
      arr.push(diff)
      map.set(ref, arr)
    }
  }
  return map
}

function expandModules(
  modules: ProposalRecommendedModule[],
  categoryMap: Map<string, string>
): SlotEntry[] {
  const children = new Map<string, ProposalRecommendedModule[]>()
  const parents: ProposalRecommendedModule[] = []

  for (const mod of modules) {
    if (mod.interfaceForModule) {
      const nested = children.get(mod.interfaceForModule) ?? []
      nested.push(mod)
      children.set(mod.interfaceForModule, nested)
      continue
    }
    parents.push(mod)
  }

  const order = ['analog', 'digital', 'communication', 'motion', 'interface']
  const sortedParents = [...parents].sort((left, right) => {
    const leftCat = categoryMap.get(left.moduleId) ?? 'interface'
    const rightCat = categoryMap.get(right.moduleId) ?? 'interface'
    const li = order.indexOf(leftCat)
    const ri = order.indexOf(rightCat)
    return (li === -1 ? 99 : li) - (ri === -1 ? 99 : ri)
  })

  const slots: SlotEntry[] = []
  for (const mod of sortedParents) {
    const categoryId = categoryMap.get(mod.moduleId) ?? 'interface'
    for (let i = 0; i < mod.quantity; i += 1) {
      slots.push({ moduleId: mod.moduleId, friendlyName: mod.friendlyName, categoryId })
    }
    const nested = children.get(mod.moduleId) ?? []
    for (const child of nested) {
      for (let i = 0; i < child.quantity; i += 1) {
        slots.push({ moduleId: child.moduleId, friendlyName: child.friendlyName, categoryId: 'interface' })
      }
    }
  }

  for (const mod of modules) {
    if (mod.interfaceForModule && !parents.some((p) => p.moduleId === mod.interfaceForModule)) {
      for (let i = 0; i < mod.quantity; i += 1) {
        slots.push({ moduleId: mod.moduleId, friendlyName: mod.friendlyName, categoryId: 'interface' })
      }
    }
  }

  return slots
}

// ─── Slot tooltip ─────────────────────────────────────────────────────────────

function SlotTooltipContent({
  index,
  slot,
  rowDiffs,
  moduleRowsMap,
}: {
  index: number
  slot: SlotEntry | undefined
  rowDiffs: ProposalRowDiff[] | null
  moduleRowsMap: Map<string, ProposalRowDiff[]>
}) {
  if (!slot) {
    return (
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-semibold text-slate-400">Slot {index} — Empty</p>
      </div>
    )
  }

  const colors = CATEGORY_COLORS[slot.categoryId] ?? FALLBACK_COLOR
  const coveredRows = moduleRowsMap.get(slot.moduleId) ?? []
  const showRows = coveredRows.slice(0, 4)
  const extraRows = coveredRows.length - showRows.length

  return (
    <div className="w-52 space-y-2 p-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-bold leading-tight ${colors.text}`}>{slot.moduleId}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{slot.friendlyName}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${colors.chip}`}>
          {colors.label}
        </span>
      </div>

      {/* Covered rows */}
      {rowDiffs && showRows.length > 0 && (
        <div className="border-t border-slate-100 pt-1.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Covers</p>
          <ul className="space-y-0.5">
            {showRows.map((diff, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors.bg.replace('/85', '')} border ${colors.border.replace('/80', '')}`} />
                <span className="text-[10px] text-slate-600">
                  {diff.categoryId} · {diff.subId} ({diff.quantityRequested} ch)
                </span>
              </li>
            ))}
            {extraRows > 0 && (
              <li className="text-[10px] text-slate-400">+{extraRows} more row{extraRows > 1 ? 's' : ''}</li>
            )}
          </ul>
        </div>
      )}

      {/* Slot badge */}
      <div className="border-t border-slate-100 pt-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Slot {index}</p>
      </div>
    </div>
  )
}

export default function MachineSlotMapImage({
  machine,
  modules,
  rowDiffs,
  showDetails = true,
}: MachineSlotMapImageProps) {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [easterActive, setEasterActive] = useState(false)
  const [easterBurst, setEasterBurst] = useState(0)
  const [achievementVisible, setAchievementVisible] = useState(false)
  const legendRefs = useRef<(HTMLDivElement | null)[]>([])
  const easterClickRef = useRef<number[]>([])
  const easterTimeoutRef = useRef<number | null>(null)
  const achievementTimeoutRef = useRef<number | null>(null)
  const categoryMap = rowDiffs ? buildCategoryMap(rowDiffs) : new Map<string, string>()
  const moduleRowsMap = rowDiffs ? buildModuleRowsMap(rowDiffs) : new Map<string, ProposalRowDiff[]>()
  const expandedSlots = modules ? expandModules(modules, categoryMap) : []

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (hoveredSlot !== null) {
      legendRefs.current[hoveredSlot]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [hoveredSlot])

  useEffect(() => {
    return () => {
      if (easterTimeoutRef.current !== null) window.clearTimeout(easterTimeoutRef.current)
      if (achievementTimeoutRef.current !== null) window.clearTimeout(achievementTimeoutRef.current)
    }
  }, [])

  if (machine.id !== 'performance') {
    return (
      <MachineChassisStrip
        maxSlots={machine.maxSlots}
        maxSlotsExpanded={machine.maxSlotsExpanded}
        machineName={machine.name}
        modules={modules}
        rowDiffs={rowDiffs}
        variants={machine.variants}
        showDetails={showDetails}
      />
    )
  }

  const visibleSlots = expandedSlots.slice(0, PERFORMANCE_SLOT_PRESET.slotCount)
  const overflowCount = Math.max(0, expandedSlots.length - PERFORMANCE_SLOT_PRESET.slotCount)
  const usedSlots = visibleSlots.length
  const emptySlots = Math.max(0, PERFORMANCE_SLOT_PRESET.slotCount - usedSlots)
  const categoryCounts = new Map<string, number>()
  for (const slot of visibleSlots) {
    categoryCounts.set(slot.categoryId, (categoryCounts.get(slot.categoryId) ?? 0) + 1)
  }
  const jumpMarkerEnabled =
    PERFORMANCE_SLOT_PRESET.jumpPx > 0 &&
    PERFORMANCE_SLOT_PRESET.jumpBeforeSlot > 0 &&
    PERFORMANCE_SLOT_PRESET.jumpBeforeSlot < PERFORMANCE_SLOT_PRESET.slotCount
  const jumpMarkerLeftPx = jumpMarkerEnabled
    ? getSlotLeftPx(PERFORMANCE_SLOT_PRESET.jumpBeforeSlot) - (PERFORMANCE_SLOT_PRESET.jumpPx / 2) + PERFORMANCE_SLOT_PRESET.jumpMarkerOffsetPx
    : 0
  const performanceImageSrc = machine.image?.trim() || `${BASE_PATH}/assets/machine-performance.png`
  const cropPerformanceForCompactPreview = !showDetails
  const compactPreviewScale = 1.43
  const compactPreviewShiftX = '-2.6%'
  const triggerEasterEgg = () => {
    setEasterActive(true)
    setEasterBurst((prev) => prev + 1)
    setAchievementVisible(true)
    if (easterTimeoutRef.current !== null) window.clearTimeout(easterTimeoutRef.current)
    if (achievementTimeoutRef.current !== null) window.clearTimeout(achievementTimeoutRef.current)
    easterTimeoutRef.current = window.setTimeout(() => {
      setEasterActive(false)
    }, EASTER_DURATION_MS)
    achievementTimeoutRef.current = window.setTimeout(() => {
      setAchievementVisible(false)
    }, EASTER_DURATION_MS + 800)
  }
  const onEasterHotspotClick = () => {
    const now = Date.now()
    const recentClicks = easterClickRef.current.filter((ts) => now - ts <= EASTER_CLICK_WINDOW_MS)
    recentClicks.push(now)
    easterClickRef.current = recentClicks
    if (recentClicks.length >= EASTER_TRIGGER_CLICKS) {
      easterClickRef.current = []
      triggerEasterEgg()
    }
  }

  return (
    <RadixTooltip.Provider delayDuration={120} skipDelayDuration={0}>
      <div className={showDetails ? 'space-y-3' : undefined}>
        {/* ── Machine image with slot overlay ────────────────────────────── */}
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:p-3',
            easterActive && 'ring-2 ring-cyan-300/60',
          )}
          style={{
            animation: easterActive
              ? `sgEggFrame 720ms cubic-bezier(0.28,0.9,0.45,1) ${easterBurst % 2}ms 1 both, sgEggColorShift 1850ms linear 1 both`
              : undefined,
          }}
        >
          <div className={cn('relative aspect-[3585/2115] w-full', cropPerformanceForCompactPreview && 'overflow-hidden')}>
            <div
              className="relative h-full w-full"
              style={
                cropPerformanceForCompactPreview
                  ? {
                      transform: `translateX(${compactPreviewShiftX}) scale(${compactPreviewScale})`,
                      transformOrigin: '50% 52%',
                    }
                  : undefined
              }
            >
              <Image
                src={performanceImageSrc}
                alt={`${machine.name} front panel slot map`}
                fill
                className="object-contain"
                sizes="(max-width: 1200px) 100vw, 1200px"
                priority
              />

              {/* Triple-click easter-egg hotspot (power button area). */}
              <button
                type="button"
                onClick={onEasterHotspotClick}
                aria-label="Hidden machine easter egg trigger"
                className="absolute z-[22] cursor-default rounded-full bg-transparent focus:outline-none"
                style={{
                  left: toXPct(EASTER_HOTSPOT.leftPx),
                  top: toYPct(EASTER_HOTSPOT.topPx),
                  width: toXPct(EASTER_HOTSPOT.widthPx),
                  height: toYPct(EASTER_HOTSPOT.heightPx),
                }}
              />

            {easterActive && (
              <div key={`egg-burst-${easterBurst}`} className="pointer-events-none absolute inset-0 z-[21]" aria-hidden>
                <div
                  className="absolute inset-0 opacity-70 mix-blend-screen"
                  style={{
                    background:
                      'linear-gradient(120deg, rgba(255,56,56,0.45), rgba(255,184,0,0.42), rgba(114,255,114,0.4), rgba(88,208,255,0.42), rgba(143,108,255,0.44), rgba(255,88,189,0.42), rgba(255,56,56,0.45))',
                    backgroundSize: '300% 300%',
                    animation: 'sgRainbowShift 1150ms linear infinite',
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-200/0 via-cyan-200/15 to-fuchsia-200/0 animate-[sgEggGlow_420ms_ease-out_1]" />
                <div
                  className="absolute inset-y-0 w-[23%] bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
                  style={{ animation: 'sgEggSweep 980ms ease-out 1 both' }}
                />
                <div
                  className="absolute inset-y-0 w-[18%] bg-gradient-to-r from-transparent via-fuchsia-300/32 to-transparent"
                  style={{ animation: 'sgEggSweepAlt 880ms ease-out 130ms 1 both' }}
                />
                <div
                  className="absolute rounded-full border-2 border-cyan-400/70 bg-cyan-300/18"
                  style={{
                    left: toXPct(EASTER_HOTSPOT.leftPx),
                    top: toYPct(EASTER_HOTSPOT.topPx),
                    width: toXPct(EASTER_HOTSPOT.widthPx),
                    height: toYPct(EASTER_HOTSPOT.heightPx),
                    animation: 'sgEggPulse 980ms cubic-bezier(0.18,0.88,0.24,1) 0ms 1 both',
                  }}
                />
                <div
                  className="absolute rounded-full border border-blue-300/80 bg-blue-200/12"
                  style={{
                    left: toXPct(EASTER_HOTSPOT.leftPx - 16),
                    top: toYPct(EASTER_HOTSPOT.topPx - 12),
                    width: toXPct(EASTER_HOTSPOT.widthPx + 32),
                    height: toYPct(EASTER_HOTSPOT.heightPx + 24),
                    animation: 'sgEggPulse 1200ms cubic-bezier(0.18,0.88,0.24,1) 120ms 1 both',
                  }}
                />
                <div
                  className="absolute rounded-full border border-fuchsia-300/75 bg-fuchsia-200/10"
                  style={{
                    left: toXPct(EASTER_HOTSPOT.leftPx - 32),
                    top: toYPct(EASTER_HOTSPOT.topPx - 28),
                    width: toXPct(EASTER_HOTSPOT.widthPx + 64),
                    height: toYPct(EASTER_HOTSPOT.heightPx + 56),
                    animation: 'sgEggPulse 1450ms cubic-bezier(0.12,0.92,0.25,1) 220ms 1 both',
                  }}
                />
                {EASTER_SPARKS.map((spark, index) => (
                  <span
                    key={`spark-${index}`}
                    className="absolute h-2 w-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.85)]"
                    style={{
                      left: toXPct(EASTER_HOTSPOT.leftPx + EASTER_HOTSPOT.widthPx / 2 + spark.x),
                      top: toYPct(EASTER_HOTSPOT.topPx + EASTER_HOTSPOT.heightPx / 2 + spark.y),
                      filter: `hue-rotate(${spark.hue}deg)`,
                      animation: `sgEggSpark 860ms cubic-bezier(0.22,0.82,0.24,1) ${spark.delay}ms 1 both`,
                    }}
                  />
                ))}
              </div>
            )}

            {achievementVisible && (
              <div className="pointer-events-none absolute left-1/2 top-[7.2%] z-[24] -translate-x-1/2 animate-[sgAchievementPop_860ms_cubic-bezier(0.18,0.85,0.24,1)_1]">
                <div className="rounded-2xl border border-white/30 bg-black/78 px-4 py-2 shadow-[0_14px_30px_rgba(0,0,0,0.36)] backdrop-blur-[1px] sm:px-5 sm:py-2.5">
                  <p className="text-center text-[clamp(11px,1.15vw,16px)] font-extrabold uppercase tracking-[0.16em] text-sky-200">
                    Achievement Unlocked
                  </p>
                  <div className="mx-auto mt-1 w-fit rounded-lg border border-yellow-200/35 bg-gradient-to-r from-[#ff9e00] via-[#ffd249] to-[#fff07a] px-3 py-0.5 sm:px-4">
                    <p className="text-center text-[clamp(16px,2.6vw,34px)] font-black uppercase leading-none tracking-tight text-white [text-shadow:-2px_-2px_0_#111,2px_-2px_0_#111,-2px_2px_0_#111,2px_2px_0_#111]">
                      You Are The GOAT
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Fake slot bay background to mask the real chassis details */}
            <div className="pointer-events-none" aria-hidden>
              {Array.from({ length: PERFORMANCE_SLOT_PRESET.slotCount }).map((_, index) => {
                const leftPx = getSlotLeftPx(index)
                return (
                  // eslint-disable-next-line react/forbid-dom-props
                  <div
                    key={`fake-slot-bg-${index}`}
                    className="absolute z-0 rounded-[4px] border border-slate-300/80 bg-[#F4F1F1] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                    style={{
                      left: toXPct(leftPx),
                      top: toYPct(PERFORMANCE_SLOT_PRESET.topPx),
                      width: toXPct(PERFORMANCE_SLOT_PRESET.slotBoxWidthPx),
                      height: toYPct(PERFORMANCE_SLOT_PRESET.heightPx),
                    }}
                  />
                )
              })}
            </div>

            {jumpMarkerEnabled && (
              // Spacer between slot #7 and #8 on this chassis layout.
              <div
                className="pointer-events-none absolute z-[5] border-l border-dashed border-slate-500/60"
                style={{
                  left: toXPct(jumpMarkerLeftPx),
                  top: toYPct(PERFORMANCE_SLOT_PRESET.topPx),
                  height: toYPct(PERFORMANCE_SLOT_PRESET.heightPx),
                }}
              />
            )}

              {Array.from({ length: PERFORMANCE_SLOT_PRESET.slotCount }).map((_, index) => {
                const slot = visibleSlots[index]
                const colors = slot ? (CATEGORY_COLORS[slot.categoryId] ?? FALLBACK_COLOR) : null
                const isHovered = hoveredSlot === index
                const leftPx = getSlotLeftPx(index)

                return (
                  <RadixTooltip.Root key={index}>
                    <RadixTooltip.Trigger asChild>
                      {/* eslint-disable-next-line react/forbid-dom-props */}
                      <div
                        className={cn(
                          'absolute z-10 flex min-h-0 cursor-pointer flex-col overflow-visible rounded-[3px] border p-[2px] shadow-sm transition-all duration-150',
                          slot
                            ? `${colors?.bg} ${colors?.border} backdrop-blur-[1px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]`
                            : 'border-slate-300/70 bg-transparent shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]',
                          isHovered && slot && `ring-2 ring-offset-[1px] ${colors?.ring} z-10 shadow-lg`,
                          isHovered && !slot && 'ring-1 ring-slate-300/90 ring-offset-[1px]',
                          mounted ? 'opacity-100' : 'opacity-0',
                        )}
                        style={{
                          left: toXPct(leftPx),
                          top: toYPct(PERFORMANCE_SLOT_PRESET.topPx),
                          width: toXPct(PERFORMANCE_SLOT_PRESET.slotBoxWidthPx),
                          height: toYPct(PERFORMANCE_SLOT_PRESET.heightPx),
                          transitionDelay: `${index * 35}ms`,
                          animation: easterActive
                            ? `sgEggSlotFlash 640ms cubic-bezier(0.2,0.9,0.25,1) ${index * 26 + (easterBurst % 2)}ms 1 both, sgEggSlotWobble 560ms ease-out ${index * 18}ms 1, sgIoDance 760ms cubic-bezier(0.16,0.9,0.24,1) ${index * 28}ms 2`
                            : undefined,
                        }}
                        onMouseEnter={() => setHoveredSlot(index)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <span className="w-fit rounded-sm bg-white/80 px-0.5 py-px text-[6px] font-bold leading-none text-slate-500">#{index}</span>
                        {slot ? (
                          <>
                            <p
                              className={cn('mt-0.5 text-[8px] font-bold leading-none', colors?.text)}
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {slot.moduleId}
                            </p>
                            <span className={cn('mt-auto h-1 w-1 rounded-full', colors?.dot)} />
                          </>
                        ) : (
                          <span className="mt-auto h-1 w-4 rounded-full bg-slate-300/80" />
                        )}
                      </div>
                    </RadixTooltip.Trigger>

                    <RadixTooltip.Portal>
                      <RadixTooltip.Content
                        side="top"
                        sideOffset={6}
                        className="z-50 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95"
                      >
                        <SlotTooltipContent
                          index={index}
                          slot={slot}
                          rowDiffs={rowDiffs}
                          moduleRowsMap={moduleRowsMap}
                        />
                        <RadixTooltip.Arrow className="fill-white drop-shadow-sm" />
                      </RadixTooltip.Content>
                    </RadixTooltip.Portal>
                  </RadixTooltip.Root>
                )
              })}
            </div>
          </div>
        </div>

        {showDetails && (
          <>
            {/* ── Slot usage + legend ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                Slots: {usedSlots}/{PERFORMANCE_SLOT_PRESET.slotCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-[#F4F1F1] px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Empty: {emptySlots}
              </span>
              {CATEGORY_LEGEND_ORDER.map((categoryId) => {
                const count = categoryCounts.get(categoryId) ?? 0
                const colors = CATEGORY_COLORS[categoryId] ?? FALLBACK_COLOR
                return (
                  <span
                    key={categoryId}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      colors.chip,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                    {colors.label}: {count}
                  </span>
                )
              })}
              {overflowCount > 0 && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  +{overflowCount} modules not shown in image slots
                </span>
              )}
            </div>

            {/* ── Slot legend grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: PERFORMANCE_SLOT_PRESET.slotCount }).map((_, index) => {
                const slot = visibleSlots[index]
                const colors = slot ? (CATEGORY_COLORS[slot.categoryId] ?? FALLBACK_COLOR) : null
                const isHovered = hoveredSlot === index
                const coveredRows = slot ? (moduleRowsMap.get(slot.moduleId) ?? []) : []

                return (
                  <div
                    key={`legend-${index}`}
                    ref={(el) => { legendRefs.current[index] = el }}
                    className={cn(
                      'cursor-default rounded-md border px-2 py-1.5 transition-all duration-150',
                      slot ? `${colors?.bg} ${colors?.border}` : 'border-slate-300/80 bg-[#F4F1F1]',
                      isHovered && slot && `ring-2 ring-offset-1 ${colors?.ring} shadow-sm`,
                    )}
                    onMouseEnter={() => setHoveredSlot(index)}
                    onMouseLeave={() => setHoveredSlot(null)}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[9px] font-semibold text-slate-500">Slot {index}</p>
                      {slot && (
                        <span className={cn('rounded-full border px-1 py-px text-[8px] font-semibold', colors?.chip)}>
                          {colors?.label}
                        </span>
                      )}
                    </div>
                    {slot ? (
                      <>
                        <p className={cn('mt-0.5 text-[11px] font-bold leading-tight', colors?.text)}>{slot.moduleId}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{slot.friendlyName}</p>
                        {coveredRows.length > 0 && (
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            {coveredRows.length} row{coveredRows.length > 1 ? 's' : ''} covered
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-slate-400">Empty</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </RadixTooltip.Provider>
  )
}
