'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CompactButton, CompactCard, CompactChip, CompactTooltip } from '@/components/ui/compact'
import { cn } from '@/lib/cn'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

const HEADER_NAV_ITEMS = [
  { label: 'Testing Workflows', hasMenu: true },
  { label: 'Test Systems', hasMenu: true },
  { label: 'Industries', hasMenu: true },
  { label: 'Resources', hasMenu: true },
  { label: 'Company', hasMenu: true },
  { label: 'Contact', hasMenu: false },
] as const

type PerformanceBand = '10k' | '100k' | 'mhz'
type InterfaceId = 'high-fidelity' | 'general-io' | 'high-speed-daq'
type InteractiveGroupId = 'analog' | 'digital' | 'pwm-position' | 'communication'

const PERFORMANCE_OPTIONS: Array<{
  id: PerformanceBand
  title: string
  shortLabel: string
  summary: string
  detail: string
  pulseCount: number
  visualMode: 'pulses' | 'dense'
  tierLabel: string
  tierColor: string
  recommendLabel: string
  typicalUse: string
}> = [
  {
    id: '10k',
    title: 'Up to 10 kHz',
    shortLabel: '10 kHz',
    summary: 'Sufficient for most control loops outside power electronics.',
    detail: 'Best for general control & monitoring',
    pulseCount: 2,
    visualMode: 'pulses',
    tierLabel: 'Standard',
    tierColor: 'bg-slate-100 text-slate-600',
    recommendLabel: 'Most common choice',
    typicalUse: 'General HIL, communication buses, monitoring, system-level behavior.',
  },
  {
    id: '100k',
    title: 'Up to 100 kHz',
    shortLabel: '100 kHz',
    summary: 'Fast loops, typically required for motor controls and power electronics.',
    detail: 'Best for fast motor & power control',
    pulseCount: 5,
    visualMode: 'pulses',
    tierLabel: 'High-speed',
    tierColor: 'bg-sky-50 text-sky-700',
    recommendLabel: 'Recommended for motor drives',
    typicalUse: 'Motor control HIL, inverter testing, fast closed-loop power electronics.',
  },
  {
    id: 'mhz',
    title: 'Above 100 kHz up to MHz',
    shortLabel: '>100 kHz',
    summary: 'High-performance power electronics HIL and sub-microsecond behavior.',
    detail: 'Best for sub-microsecond dynamics',
    pulseCount: 24,
    visualMode: 'dense',
    tierLabel: 'Ultra-fast',
    tierColor: 'bg-amber-50 text-amber-700',
    recommendLabel: 'For advanced power electronics',
    typicalUse: 'Switching physics, GaN/SiC device modeling, high-fidelity power stage HIL.',
  },
]

const MACHINE_OPTIONS = [
  {
    id: 'performance',
    name: 'Performance',
    image: `${BASE_PATH}/assets/machine-performance.png`,
    score: { '10k': 3, '100k': 5, mhz: 5 } as Record<PerformanceBand, number>,
    officeLab: true,
    rackMount: true,
    field: false,
    expandability: 'Extensive',
    upgradeability: 'Yes',
    fitNote: {
      '10k': 'Recommended when you expect broader lab use, larger I/O configurations, or future expansion.',
      '100k': 'Recommended for faster closed-loop control with broader I/O headroom and expansion capacity.',
      mhz: 'Recommended for FPGA-based, high-speed power electronics work with maximum I/O expansion.',
    } as Record<PerformanceBand, string>,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    image: `${BASE_PATH}/assets/machine-pulse.png`,
    score: { '10k': 4, '100k': 4, mhz: 2 } as Record<PerformanceBand, number>,
    officeLab: true,
    rackMount: false,
    field: true,
    expandability: 'Extensive',
    upgradeability: 'Yes',
    fitNote: {
      '10k': 'Good fit for compact control systems that still need strong I/O expansion potential.',
      '100k': 'Good fit for fast control applications without moving immediately to the highest expansion class.',
      mhz: 'Possible for narrower high-speed cases, but not the preferred standard recommendation.',
    } as Record<PerformanceBand, string>,
  },
  {
    id: 'mobile',
    name: 'Mobile',
    image: `${BASE_PATH}/assets/machine-mobile.png`,
    score: { '10k': 4, '100k': 4, mhz: 3 } as Record<PerformanceBand, number>,
    officeLab: true,
    rackMount: false,
    field: true,
    expandability: 'Moderate',
    upgradeability: 'No',
    fitNote: {
      '10k': 'Strong option when mobility or rugged field deployment matters more than maximum expansion.',
      '100k': 'Good fit for faster control applications in rugged or vehicle-near environments.',
      mhz: 'Relevant when high-speed work must stay mobile, but still secondary to Performance.',
    } as Record<PerformanceBand, string>,
  },
  {
    id: 'baseline',
    name: 'Baseline',
    image: `${BASE_PATH}/assets/machine-baseline.png`,
    score: { '10k': 5, '100k': 2, mhz: 0 } as Record<PerformanceBand, number>,
    officeLab: true,
    rackMount: false,
    field: true,
    expandability: 'Limited',
    upgradeability: 'No',
    fitNote: {
      '10k': 'Recommended for general control, monitoring, and communication without oversizing the system.',
      '100k': 'Can support lighter fast-control requirements, but with limited headroom.',
      mhz: 'Not recommended for this performance band.',
    } as Record<PerformanceBand, string>,
  },
  {
    id: 'unit',
    name: 'Unit',
    image: `${BASE_PATH}/assets/machine-unit.png`,
    score: { '10k': 2, '100k': 1, mhz: 0 } as Record<PerformanceBand, number>,
    officeLab: true,
    rackMount: false,
    field: true,
    expandability: 'Limited',
    upgradeability: 'No',
    fitNote: {
      '10k': 'Recommended only for compact, light-duty systems with tight space constraints.',
      '100k': 'Possible only for very narrow compact requirements.',
      mhz: 'Not recommended for this band.',
    } as Record<PerformanceBand, string>,
  },
] as const

const INTERFACE_BOARD_COLUMNS: Array<
  Array<{
    id: string
    label: string
    counts: Record<InterfaceId, number>
  }>
> = [
  [
    {
      id: 'analog',
      label: 'Analog',
      counts: { 'high-fidelity': 20, 'general-io': 8, 'high-speed-daq': 16 },
    },
    {
      id: 'pwm-position',
      label: 'PWM & Position',
      counts: { 'high-fidelity': 8, 'general-io': 0, 'high-speed-daq': 0 },
    },
    {
      id: 'temperature',
      label: 'Temperature',
      counts: { 'high-fidelity': 2, 'general-io': 4, 'high-speed-daq': 0 },
    },
    {
      id: 'fault-insertion',
      label: 'Fault Insertion',
      counts: { 'high-fidelity': 0, 'general-io': 3, 'high-speed-daq': 0 },
    },
    {
      id: 'resistor-simulation',
      label: 'Resistor Simulation',
      counts: { 'high-fidelity': 0, 'general-io': 2, 'high-speed-daq': 0 },
    },
    {
      id: 'general-purpose',
      label: 'General Purpose',
      counts: { 'high-fidelity': 1, 'general-io': 5, 'high-speed-daq': 1 },
    },
  ],
  [
    {
      id: 'digital',
      label: 'Digital',
      counts: { 'high-fidelity': 16, 'general-io': 10, 'high-speed-daq': 4 },
    },
    {
      id: 'communication',
      label: 'Communication',
      counts: { 'high-fidelity': 0, 'general-io': 6, 'high-speed-daq': 3 },
    },
    {
      id: 'strain-vibration',
      label: 'Strain & Vibration',
      counts: { 'high-fidelity': 0, 'general-io': 2, 'high-speed-daq': 6 },
    },
    {
      id: 'high-voltage',
      label: 'High Voltage',
      counts: { 'high-fidelity': 4, 'general-io': 2, 'high-speed-daq': 4 },
    },
    {
      id: 'battery-management',
      label: 'Battery Management',
      counts: { 'high-fidelity': 2, 'general-io': 2, 'high-speed-daq': 0 },
    },
    {
      id: 'signal-generation',
      label: 'Signal Generation',
      counts: { 'high-fidelity': 0, 'general-io': 0, 'high-speed-daq': 5 },
    },
  ],
]

const INTERACTIVE_GROUPS: InteractiveGroupId[] = ['analog', 'digital', 'pwm-position', 'communication']

const GROUP_TITLES: Record<string, string> = {
  analog: 'Analog',
  digital: 'Digital',
  'pwm-position': 'PWM & Position',
  communication: 'Communication',
}

const INTERFACE_OPTIONS: Array<{
  id: InterfaceId
  title: string
  subtitle: string
  description: string
  chips: readonly string[]
}> = [
  {
    id: 'high-fidelity',
    title: 'Analog & digital for high-fidelity controls & simulation',
    subtitle: '> 10 kHz closed-loop',
    description: 'Covers fast analog, digital, PWM, capture, and encoder I/O for high-fidelity control and simulation.',
    chips: ['Analog In/Out', 'Digital In/Out', 'PWM', 'Capture', 'Encoder'],
  },
  {
    id: 'general-io',
    title: 'General I/O & protocols',
    subtitle: 'All other control, communication, and monitoring',
    description: 'Covers communication, temperature, switching, and general-purpose I/O for broader system integration.',
    chips: ['CAN / LIN', 'Ethernet', 'Serial', 'Digital I/O', 'Monitoring'],
  },
  {
    id: 'high-speed-daq',
    title: 'High-speed DAQ & signal generation',
    subtitle: 'DSP, communications I/O, RF, radar, and similar',
    description: 'Covers signal generation, vibration, strain, and DAQ-oriented measurement interfaces.',
    chips: ['DAQ', 'Signal Generation', 'DSP', 'Communications I/O', 'RF / Radar'],
  },
] as const

const PANEL_CLASS =
  'relative overflow-hidden border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]'

const TIMELINE_STEPS = [
  {
    number: '1',
    title: 'Sample Rate',
    subtitle: 'Fastest closed-loop rate',
  },
  {
    number: '2',
    title: 'Target Machine',
    subtitle: 'Recommended real-time system',
  },
  {
    number: '3',
    title: 'I/O Configuration',
    subtitle: 'Interfaces & protocols',
  },
] as const

function renderStars(score: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const isActive = index < score
    return (
      <span
        key={`${score}-${index}`}
        className={cn('text-sm', isActive ? 'text-amber-400' : 'text-slate-200')}
      >
        ★
      </span>
    )
  })
}

function BooleanCell({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
    </span>
  ) : (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 text-slate-300">
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
    </span>
  )
}

const EXPANDABILITY_LEVELS: Record<string, { bars: number; label: string }> = {
  Extensive: { bars: 4, label: 'Extensive' },
  Moderate: { bars: 3, label: 'Moderate' },
  Basic: { bars: 2, label: 'Basic' },
  Limited: { bars: 1, label: 'Limited' },
}

const EXPANDABILITY_MODULE_COLORS = ['#0069B4', '#1E88D7', '#29A8DD', '#46B8D5'] as const

function ExpandabilityCell({ level }: { level: string }) {
  const config = EXPANDABILITY_LEVELS[level] ?? { bars: 1, label: level }
  return (
    <div className="inline-flex min-w-[92px] flex-col items-center gap-1">
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: 4 }, (_, i) => {
          const isActive = i < config.bars
          const h = 8 + i * 4
          return (
            <div
              key={i}
              className="rounded-sm"
              style={{
                width: 6,
                height: h,
                backgroundColor: isActive ? EXPANDABILITY_MODULE_COLORS[Math.min(i, EXPANDABILITY_MODULE_COLORS.length - 1)] : '#E2E8F0',
                opacity: isActive ? 0.85 : 0.5,
              }}
            />
          )
        })}
      </div>
      <span className="text-[11px] font-semibold text-slate-700">{config.label}</span>
    </div>
  )
}

function selectedColumnFrame(position: 'header' | 'body' | 'footer') {
  const frame = [
    'inset 1px 0 0 rgba(0,105,180,0.24)',
    'inset -1px 0 0 rgba(0,105,180,0.24)',
  ]

  if (position === 'header') {
    frame.push('inset 0 2px 0 rgb(0,105,180)')
  }

  if (position === 'footer') {
    frame.push('inset 0 -2px 0 rgb(0,105,180)')
  }

  return { boxShadow: frame.join(', ') }
}

function PerformanceVisual({
  pulseCount,
  visualMode,
  active,
}: {
  pulseCount: number
  visualMode: 'pulses' | 'dense'
  active: boolean
}) {
  // Show the underlying analog waveform plus the sampled points/stems.
  const w = 200
  const h = 74
  const left = 6
  const right = w - 6
  const mid = 37
  const amplitude = 30
  const cycles = 1.75
  const phase = -Math.PI / 4
  const sampleCount = visualMode === 'dense' ? 15 : pulseCount <= 2 ? 4 : 8
  const sampleXs = Array.from({ length: sampleCount }, (_, index) => {
    if (sampleCount <= 1) return w / 2
    return left + ((right - left) / (sampleCount - 1)) * index
  })
  const signalY = (x: number) => {
    const normalizedX = (x - left) / (right - left)
    return mid - amplitude * Math.sin(normalizedX * cycles * 2 * Math.PI + phase)
  }
  const waveformPath = Array.from({ length: 72 }, (_, index) => {
    const x = left + ((right - left) / 71) * index
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${signalY(x).toFixed(2)}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[76px] w-full"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <line
        x1={left}
        y1={mid}
        x2={right}
        y2={mid}
        vectorEffect="non-scaling-stroke"
        strokeWidth={0.9}
        strokeDasharray="2.5 4"
        className={cn(
          'transition-colors duration-200',
          active ? 'stroke-[rgba(0,105,180,0.16)]' : 'stroke-slate-200'
        )}
      />
      <path
        d={waveformPath}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeWidth={1.55}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'transition-colors duration-200',
          active ? 'stroke-[rgba(0,105,180,0.55)]' : 'stroke-slate-300'
        )}
      />
      {sampleXs.map((x, index) => (
        <g key={`${x}-${index}`}>
          <line
            x1={x}
            y1={mid}
            x2={x}
            y2={signalY(x)}
            vectorEffect="non-scaling-stroke"
            strokeWidth={visualMode === 'dense' ? 1 : 0.95}
            strokeLinecap="round"
            className={cn(
              'transition-colors duration-200',
              active ? 'stroke-[rgba(0,105,180,0.85)]' : 'stroke-slate-400'
            )}
          />
          <circle
            cx={x}
            cy={signalY(x)}
            r={visualMode === 'dense' ? 1.7 : 1.85}
            className={cn(
              'transition-colors duration-200',
              active ? 'fill-[rgba(0,105,180,1)]' : 'fill-slate-500'
            )}
          />
        </g>
      ))}
    </svg>
  )
}

function StepTimeline() {
  return (
    <CompactCard className={cn(PANEL_CLASS, 'p-3 md:p-4')}>
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <div className="shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Configuration flow</p>
          <p className="mt-1 text-sm font-medium text-slate-700">Define speed, choose system, configure I/O</p>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-[640px] items-center">
            {TIMELINE_STEPS.map((step, index) => (
              <div key={step.number} className="flex min-w-0 flex-1 items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      index === 0
                        ? 'bg-[rgb(var(--speedgoat-blue))] text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    )}
                  >
                    {step.number}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="text-xs text-slate-500">{step.subtitle}</p>
                  </div>
                </div>
                {index < TIMELINE_STEPS.length - 1 ? (
                  <div className="mx-4 h-px flex-1 bg-[linear-gradient(90deg,rgba(0,105,180,0.32),rgba(148,163,184,0.3))]" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </CompactCard>
  )
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  description?: string
  children: React.ReactNode
}) {
  return (
    <CompactCard className={cn(PANEL_CLASS, 'p-4 md:p-5')}>
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-1.5 text-lg font-semibold text-slate-900 md:text-xl">{title}</h2>
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-slate-600">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </CompactCard>
  )
}

function InlineConfigRow({
  label,
  quantity,
  quantityOptions,
  onQuantityChange,
  unit = 'ch',
  specs,
  dimmed = false,
}: {
  label: string
  quantity: number
  quantityOptions: number[]
  onQuantityChange: (value: number) => void
  unit?: string
  specs: Array<{
    value: string
    options: string[]
    onChange: (value: string) => void
    ariaLabel: string
  }>
  dimmed?: boolean
}) {
  return (
    <div
      className={cn(
        'grid items-center gap-x-2 gap-y-2 rounded-2xl px-3 py-2.5 md:grid-cols-[minmax(120px,1.1fr)_58px_28px_minmax(0,1.8fr)]',
        dimmed && 'opacity-45'
      )}
    >
      <span className="truncate text-[13px] font-semibold text-slate-900">{label}</span>

      <span className="relative">
        <select
          value={String(quantity)}
          onChange={(e) => onQuantityChange(Number(e.target.value))}
          aria-label={`${label} quantity`}
          className="h-6 w-full cursor-pointer appearance-none rounded-[6px] border border-transparent bg-slate-50/90 py-0 pl-1 pr-3.5 text-right text-[13px] font-medium tabular-nums text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none"
        >
          {quantityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-400">▾</span>
      </span>

      <span className="text-[11px] text-slate-500">{unit}</span>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {specs.map((spec, index) => (
          <span key={`${label}-${spec.ariaLabel}`} className="inline-flex min-w-0 items-center gap-1.5">
            {index > 0 ? <span className="text-[10px] text-slate-300">•</span> : null}
            <span className="relative inline-flex min-w-0 max-w-[118px] items-center">
              <select
                aria-label={spec.ariaLabel}
                value={spec.value}
                onChange={(e) => spec.onChange(e.target.value)}
                className="h-6 w-full cursor-pointer appearance-none rounded-[6px] border border-transparent bg-slate-50/90 py-0 pl-1.5 pr-4 text-[11px] text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 hover:text-[rgb(var(--speedgoat-blue))] focus:outline-none"
              >
                {spec.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-0.5 text-[7px] text-slate-400">▾</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function LayoutMockV2Page() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedBand, setSelectedBand] = useState<PerformanceBand>('100k')
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [selectedInterfaces, setSelectedInterfaces] = useState<InterfaceId[]>(['high-fidelity'])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [groupConfig, setGroupConfig] = useState({
    analog: {
      inputs: 4,
      outputs: 0,
      inputRange: '±10 V',
      inputResolution: '16-bit',
      acquisition: '1 MS/s',
      outputRange: '±10 V',
      outputResolution: '16-bit',
      settling: '2 µs',
    },
    digital: {
      inputs: 0,
      outputs: 0,
      level: 'TTL',
      timing: '100 kHz',
    },
    'pwm-position': {
      pwm: 0,
      capture: 0,
      encoder: 0,
      resolver: 0,
    },
    communication: {
      can: 0,
      lin: 0,
      serial: 0,
      ethernet: 0,
    },
  })

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 160)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const selectedPerformance = useMemo(
    () => PERFORMANCE_OPTIONS.find((option) => option.id === selectedBand) ?? PERFORMANCE_OPTIONS[1],
    [selectedBand]
  )

  const sortedMachines = useMemo(() => {
    return [...MACHINE_OPTIONS].sort((left, right) => right.score[selectedBand] - left.score[selectedBand])
  }, [selectedBand])

  const primaryRecommendedMachine = sortedMachines[0]

  const activeMachine = useMemo(
    () => MACHINE_OPTIONS.find((m) => m.id === selectedMachineId) ?? primaryRecommendedMachine,
    [selectedMachineId, primaryRecommendedMachine]
  )

  const alternativeMachines = useMemo(
    () =>
      sortedMachines
        .slice(1)
        .filter((machine) => machine.score[selectedBand] >= 3)
        .slice(0, 2),
    [selectedBand, sortedMachines]
  )

  const configuredGroupCounts = useMemo(
    () => ({
      analog: groupConfig.analog.inputs + groupConfig.analog.outputs,
      digital: groupConfig.digital.inputs + groupConfig.digital.outputs,
      'pwm-position':
        groupConfig['pwm-position'].pwm +
        groupConfig['pwm-position'].capture +
        groupConfig['pwm-position'].encoder +
        groupConfig['pwm-position'].resolver,
      communication:
        groupConfig.communication.can +
        groupConfig.communication.lin +
        groupConfig.communication.serial +
        groupConfig.communication.ethernet,
    }),
    [groupConfig]
  )

  const activeBoardCounts = useMemo(() => {
    return Object.fromEntries(
      INTERFACE_BOARD_COLUMNS.flat().map((group) => [
        group.id,
        selectedInterfaces.reduce((sum, interfaceId) => sum + group.counts[interfaceId], 0),
      ])
    ) as Record<string, number>
  }, [selectedInterfaces])

  const boardDisplayCounts = useMemo(
    () => ({
      ...activeBoardCounts,
      ...configuredGroupCounts,
    }),
    [activeBoardCounts, configuredGroupCounts]
  )

  const activeBoardGroupCount = useMemo(
    () => Object.values(boardDisplayCounts).filter((count) => count > 0).length,
    [boardDisplayCounts]
  )

  const updateGroupConfig = <T extends keyof typeof groupConfig>(
    group: T,
    patch: Partial<(typeof groupConfig)[T]>
  ) => {
    setGroupConfig((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        ...patch,
      },
    }))
  }

  const renderInlineGroupEditor = (groupId: string) => {
    if (groupId === 'analog') {
      return (
        <div className="border-t border-slate-100 px-2 pb-2 pt-3">
          <div className="space-y-1">
            <InlineConfigRow
              label="Inputs"
              quantity={groupConfig.analog.inputs}
              quantityOptions={[0, 1, 2, 4, 8, 16, 32]}
              onQuantityChange={(value) => updateGroupConfig('analog', { inputs: value })}
              specs={[
                {
                  value: groupConfig.analog.inputRange,
                  options: ['±10V', '±5V', '0-10V'],
                  onChange: (value) => updateGroupConfig('analog', { inputRange: value }),
                  ariaLabel: 'Analog input range',
                },
                {
                  value: groupConfig.analog.inputResolution,
                  options: ['16-bit', '18-bit'],
                  onChange: (value) => updateGroupConfig('analog', { inputResolution: value }),
                  ariaLabel: 'Analog input resolution',
                },
                {
                  value: groupConfig.analog.acquisition,
                  options: ['100kHz', '500kHz', '1MS/s'],
                  onChange: (value) => updateGroupConfig('analog', { acquisition: value }),
                  ariaLabel: 'Analog input acquisition',
                },
              ]}
              dimmed={groupConfig.analog.inputs === 0}
            />
            <InlineConfigRow
              label="Outputs"
              quantity={groupConfig.analog.outputs}
              quantityOptions={[0, 1, 2, 4, 8, 16, 32]}
              onQuantityChange={(value) => updateGroupConfig('analog', { outputs: value })}
              specs={[
                {
                  value: groupConfig.analog.outputRange,
                  options: ['±10V', '0-10V'],
                  onChange: (value) => updateGroupConfig('analog', { outputRange: value }),
                  ariaLabel: 'Analog output range',
                },
                {
                  value: groupConfig.analog.outputResolution,
                  options: ['16-bit', '18-bit'],
                  onChange: (value) => updateGroupConfig('analog', { outputResolution: value }),
                  ariaLabel: 'Analog output resolution',
                },
                {
                  value: groupConfig.analog.settling,
                  options: ['2µs', '10µs', '25µs'],
                  onChange: (value) => updateGroupConfig('analog', { settling: value }),
                  ariaLabel: 'Analog output settling',
                },
              ]}
              dimmed={groupConfig.analog.outputs === 0}
            />
          </div>
          <button
            type="button"
            onClick={() => updateGroupConfig('analog', { inputs: groupConfig.analog.inputs + 1 })}
            className="mt-2 text-sm font-semibold text-slate-400 transition hover:text-[rgb(var(--speedgoat-blue))]"
          >
            + Add analog
          </button>
        </div>
      )
    }

    if (groupId === 'digital') {
      return (
        <div className="border-t border-slate-100 px-2 pb-2 pt-3">
          <div className="space-y-1">
            <InlineConfigRow
              label="Inputs"
              quantity={groupConfig.digital.inputs}
              quantityOptions={[0, 1, 2, 4, 8, 16, 32]}
              onQuantityChange={(value) => updateGroupConfig('digital', { inputs: value })}
              specs={[
                {
                  value: groupConfig.digital.level,
                  options: ['TTL', '24V', 'RS422'],
                  onChange: (value) => updateGroupConfig('digital', { level: value }),
                  ariaLabel: 'Digital input level',
                },
                {
                  value: groupConfig.digital.timing,
                  options: ['100kHz', '1MHz', '5MHz'],
                  onChange: (value) => updateGroupConfig('digital', { timing: value }),
                  ariaLabel: 'Digital input timing',
                },
              ]}
              dimmed={groupConfig.digital.inputs === 0}
            />
            <InlineConfigRow
              label="Outputs"
              quantity={groupConfig.digital.outputs}
              quantityOptions={[0, 1, 2, 4, 8, 16, 32]}
              onQuantityChange={(value) => updateGroupConfig('digital', { outputs: value })}
              specs={[
                {
                  value: groupConfig.digital.level,
                  options: ['TTL', '24V', 'RS422'],
                  onChange: (value) => updateGroupConfig('digital', { level: value }),
                  ariaLabel: 'Digital output level',
                },
                {
                  value: groupConfig.digital.timing,
                  options: ['100kHz', '1MHz', '5MHz'],
                  onChange: (value) => updateGroupConfig('digital', { timing: value }),
                  ariaLabel: 'Digital output timing',
                },
              ]}
              dimmed={groupConfig.digital.outputs === 0}
            />
          </div>
          <button
            type="button"
            onClick={() => updateGroupConfig('digital', { inputs: groupConfig.digital.inputs + 1 })}
            className="mt-2 text-sm font-semibold text-slate-400 transition hover:text-[rgb(var(--speedgoat-blue))]"
          >
            + Add digital
          </button>
        </div>
      )
    }

    if (groupId === 'pwm-position') {
      return (
        <div className="border-t border-slate-100 px-2 pb-2 pt-3">
          <div className="space-y-1">
            <InlineConfigRow
              label="PWM"
              quantity={groupConfig['pwm-position'].pwm}
              quantityOptions={[0, 1, 2, 4, 8, 16]}
              onQuantityChange={(value) => updateGroupConfig('pwm-position', { pwm: value })}
              specs={[]}
              dimmed={groupConfig['pwm-position'].pwm === 0}
            />
            <InlineConfigRow
              label="Capture"
              quantity={groupConfig['pwm-position'].capture}
              quantityOptions={[0, 1, 2, 4, 8, 16]}
              onQuantityChange={(value) => updateGroupConfig('pwm-position', { capture: value })}
              specs={[]}
              dimmed={groupConfig['pwm-position'].capture === 0}
            />
            <InlineConfigRow
              label="Encoder"
              quantity={groupConfig['pwm-position'].encoder}
              quantityOptions={[0, 1, 2, 4, 8, 16]}
              onQuantityChange={(value) => updateGroupConfig('pwm-position', { encoder: value })}
              specs={[]}
              dimmed={groupConfig['pwm-position'].encoder === 0}
            />
            <InlineConfigRow
              label="Resolver"
              quantity={groupConfig['pwm-position'].resolver}
              quantityOptions={[0, 1, 2, 4, 8, 16]}
              onQuantityChange={(value) => updateGroupConfig('pwm-position', { resolver: value })}
              specs={[]}
              dimmed={groupConfig['pwm-position'].resolver === 0}
            />
          </div>
        </div>
      )
    }

    if (groupId === 'communication') {
      return (
        <div className="border-t border-slate-100 px-2 pb-2 pt-3">
          <div className="space-y-1">
            <InlineConfigRow
              label="CAN / CAN FD"
              quantity={groupConfig.communication.can}
              quantityOptions={[0, 1, 2, 4, 8]}
              onQuantityChange={(value) => updateGroupConfig('communication', { can: value })}
              unit="nodes"
              specs={[]}
              dimmed={groupConfig.communication.can === 0}
            />
            <InlineConfigRow
              label="LIN"
              quantity={groupConfig.communication.lin}
              quantityOptions={[0, 1, 2, 4, 8]}
              onQuantityChange={(value) => updateGroupConfig('communication', { lin: value })}
              unit="nodes"
              specs={[]}
              dimmed={groupConfig.communication.lin === 0}
            />
            <InlineConfigRow
              label="Serial"
              quantity={groupConfig.communication.serial}
              quantityOptions={[0, 1, 2, 4, 8]}
              onQuantityChange={(value) => updateGroupConfig('communication', { serial: value })}
              unit="ports"
              specs={[]}
              dimmed={groupConfig.communication.serial === 0}
            />
            <InlineConfigRow
              label="Ethernet"
              quantity={groupConfig.communication.ethernet}
              quantityOptions={[0, 1, 2, 4, 8]}
              onQuantityChange={(value) => updateGroupConfig('communication', { ethernet: value })}
              unit="ports"
              specs={[]}
              dimmed={groupConfig.communication.ethernet === 0}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="border-t border-slate-100 px-2 pb-3 pt-3">
        <p className="text-sm leading-relaxed text-slate-500">
          This group can stay dense for now. If needed, it can use the same inline row pattern.
        </p>
      </div>
    )
  }

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b transition-all duration-300',
          isScrolled
            ? 'border-slate-200 bg-white shadow-[0_12px_30px_rgba(2,23,48,0.08)]'
            : 'border-white/10 bg-[linear-gradient(180deg,rgba(7,27,52,0.54),rgba(7,27,52,0.18))] backdrop-blur-[1px]'
        )}
      >
        <div className="mx-auto w-full max-w-[1520px] px-4 md:px-8 lg:px-12">
          <div
            className={cn(
              'flex items-center justify-between transition-all duration-300',
              isScrolled ? 'py-4' : 'py-6'
            )}
          >
            <Link
              href="/layout-mock-v2"
              className={cn(
                'shrink-0 text-xl font-black uppercase tracking-[0.12em] transition md:text-[2rem]',
                isScrolled ? 'text-[rgb(var(--speedgoat-blue))]' : 'text-white'
              )}
            >
              Speedgoat
            </Link>

            <nav
              className={cn(
                'hidden items-center gap-8 text-[13px] font-semibold lg:flex',
                isScrolled ? 'text-slate-800' : 'text-white'
              )}
            >
              {HEADER_NAV_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1.5 transition',
                    isScrolled ? 'hover:text-[rgb(var(--speedgoat-blue))]' : 'hover:text-white/75'
                  )}
                >
                  <span>{item.label}</span>
                  {item.hasMenu ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={cn(
                  'hidden h-10 w-10 items-center justify-center rounded-full transition md:inline-flex',
                  isScrolled
                    ? 'text-slate-700 hover:bg-slate-100 hover:text-[rgb(var(--speedgoat-blue))]'
                    : 'text-white hover:bg-white/10'
                )}
                aria-label="Account"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.125a7.5 7.5 0 0115 0" />
                </svg>
              </button>
              <button
                type="button"
                className={cn(
                  'hidden h-10 w-10 items-center justify-center rounded-full transition md:inline-flex',
                  isScrolled
                    ? 'text-slate-700 hover:bg-slate-100 hover:text-[rgb(var(--speedgoat-blue))]'
                    : 'text-white hover:bg-white/10'
                )}
                aria-label="Search"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path strokeLinecap="round" d="M16 16l4.5 4.5" />
                </svg>
              </button>

              <CompactButton
                type="button"
                variant="ghost"
                onClick={() => setMenuOpen((prev) => !prev)}
                className={cn(
                  'lg:hidden',
                  isScrolled
                    ? 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'border border-white/30 text-white hover:bg-white/10'
                )}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </CompactButton>
            </div>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/10 bg-white/96 shadow-[0_12px_30px_rgba(2,23,48,0.08)] backdrop-blur-xl lg:hidden">
            <div className="mx-auto w-full max-w-[1520px] px-4 py-3 md:px-8 lg:px-12">
              <div className="space-y-1">
                {HEADER_NAV_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  >
                    <span>{item.label}</span>
                    {item.hasMenu ? (
                      <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="min-h-screen bg-[linear-gradient(180deg,#f4f7fa_0%,#f8fafc_28%,#ffffff_100%)] pb-14">
        <section className="relative overflow-hidden px-4 pt-20 md:px-8 md:pt-28">
          <div className="absolute inset-0">
            <Image
              src={`${BASE_PATH}/assets/machine-performance.png`}
              alt=""
              fill
              priority
              className="scale-105 object-cover object-center opacity-[0.56]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(7,31,57,0.68)_0%,rgba(7,31,57,0.38)_36%,rgba(7,31,57,0.14)_62%,rgba(255,255,255,0)_100%)]" />
          </div>
          <div className="relative mx-auto flex h-[140px] max-w-[1520px] items-end pb-6 md:h-[180px] md:pb-8">
            <div className="max-w-3xl">
              <p className="text-[15px] font-semibold text-white/88 md:text-[18px]">Test System Configurator</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">
                Configure your real-time test system
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/82 md:text-base">
                Define your sample rate, get a recommended target machine, then configure the I/O and protocols you need.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 pt-6 md:px-8">
          <div className="mx-auto max-w-[1520px] space-y-4">
            <StepTimeline />

            <CompactCard className={cn(PANEL_CLASS, 'overflow-visible p-3.5 md:p-4')}>
              <div className="relative">
                <div className="flex items-center gap-x-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Step 1</p>
                </div>
                <div className="mt-1 flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--speedgoat-blue))]/8">
                    <svg className="h-3.5 w-3.5 text-[rgb(var(--speedgoat-blue))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                      What is your fastest sample rate?
                      <CompactTooltip
                        className="ml-1.5"
                        content={
                          <div className="space-y-1.5 text-[11px]">
                            <p>Fastest closed-loop control rate (RCP) or simulation step size (HIL).</p>
                            <p className="text-slate-500">This drives the recommended target machine and I/O architecture.</p>
                          </div>
                        }
                      />
                    </h2>
                    <p className="mt-0.5 text-[12px] text-slate-500">Choose the highest closed-loop speed your application requires.</p>
                  </div>
                </div>

                <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1fr_220px]">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PERFORMANCE_OPTIONS.map((option) => {
                      const isActive = option.id === selectedBand
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedBand(option.id)}
                          className={cn(
                            'group relative flex min-h-[188px] flex-col overflow-hidden rounded-xl border-2 px-3 pb-0 pt-2.5 text-left transition-all duration-200',
                            isActive
                              ? 'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))]/[0.03] shadow-[0_0_0_3px_rgba(0,105,180,0.08)]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]'
                          )}
                        >
                          {/* Check icon */}
                          <div className={cn(
                            'absolute right-2 top-2 flex h-4.5 w-4.5 items-center justify-center rounded-full transition-all duration-200',
                            isActive
                              ? 'bg-[rgb(var(--speedgoat-blue))] text-white scale-100'
                              : 'border border-slate-200 bg-white scale-90 opacity-60 group-hover:opacity-100 group-hover:scale-100'
                          )}>
                            {isActive ? (
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className={cn(
                                  'block text-[17px] font-bold tracking-tight transition',
                                  isActive ? 'text-[rgb(var(--speedgoat-blue))]' : 'text-slate-900'
                                )}>
                                  {option.shortLabel}
                                </span>
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{option.title}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                                option.tierColor
                              )}>
                                {option.tierLabel}
                              </span>
                              {isActive ? (
                                <span className="inline-flex rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--speedgoat-blue))]">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className={cn(
                              'mt-auto -mx-3 mb-0 rounded-b-[10px] px-2.5 pb-2 pt-2.5',
                              isActive
                                ? 'bg-[linear-gradient(180deg,rgba(0,105,180,0)_0%,rgba(0,105,180,0.045)_100%)]'
                                : 'bg-[linear-gradient(180deg,rgba(248,250,252,0)_0%,rgba(241,245,249,0.8)_100%)]'
                            )}
                          >
                            <PerformanceVisual pulseCount={option.pulseCount} visualMode={option.visualMode} active={isActive} />
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Recommendation panel */}
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-3 py-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--speedgoat-blue))]/8">
                        <svg className="h-3.5 w-3.5 text-[rgb(var(--speedgoat-blue))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-[rgb(var(--speedgoat-blue))]">{selectedPerformance.recommendLabel}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-900">{selectedPerformance.detail}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{selectedPerformance.summary}</p>
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Typical use cases</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 line-clamp-2">{selectedPerformance.typicalUse}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CompactCard>

            <SectionCard
              eyebrow="Step 2"
              title="Choose your real-time target machine"
              description="Based on your sample rate, we recommend the best-fit target machine. Alternatives are shown for comparison."
            >
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <CompactChip className="border border-[rgb(var(--speedgoat-blue))]/15 bg-[rgb(var(--speedgoat-blue))]/6 text-[rgb(var(--speedgoat-blue))]">
                  {selectedPerformance.shortLabel} sample rate
                </CompactChip>
                <CompactChip className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Best fit: {primaryRecommendedMachine?.name}
                </CompactChip>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full table-fixed border-collapse">
                    <thead>
                      <tr>
                        <th className="w-[200px] border-b border-slate-100 bg-white px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        </th>
                        {MACHINE_OPTIONS.map((machine) => {
                          const isRec = primaryRecommendedMachine?.id === machine.id
                          const isSel = activeMachine?.id === machine.id
                          return (
                            <th
                              key={machine.id}
                              className={cn(
                                'cursor-pointer border-b border-slate-100 px-4 py-2.5 text-center transition',
                                isSel
                                  ? 'bg-[rgb(var(--speedgoat-blue))]/[0.045]'
                                  : isRec
                                  ? 'bg-[rgb(var(--speedgoat-blue))]/[0.02]'
                                  : 'bg-white hover:bg-slate-50/80'
                              )}
                              style={isSel ? selectedColumnFrame('header') : undefined}
                              onClick={() => setSelectedMachineId(machine.id)}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn('text-sm font-semibold', isSel ? 'text-[rgb(var(--speedgoat-blue))]' : 'text-slate-900')}>{machine.name}</span>
                                <div className="flex items-center gap-1.5">
                                  {isRec ? (
                                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                      Best fit
                                    </span>
                                  ) : null}
                                  {isSel ? (
                                    <span className="inline-flex rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--speedgoat-blue))]">
                                      Selected
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="bg-white px-4 py-2.5 text-sm font-medium text-slate-600">System</td>
                        {MACHINE_OPTIONS.map((machine) => {
                          const isSel = activeMachine?.id === machine.id
                          return (
                            <td
                              key={machine.id}
                              className={cn('px-3 py-2', isSel ? 'bg-[rgb(var(--speedgoat-blue))]/[0.02]' : 'bg-white')}
                              style={isSel ? selectedColumnFrame('body') : undefined}
                            >
                              <div
                                className={cn(
                                  'flex h-14 items-center justify-center overflow-hidden rounded-md border bg-[linear-gradient(180deg,#fbfcfd_0%,#f6f8fa_100%)]',
                                  isSel ? 'border-[rgb(var(--speedgoat-blue))]/20' : 'border-slate-100'
                                )}
                              >
                                <Image src={machine.image} alt="" width={320} height={160} className="h-[42px] w-auto max-w-[85%] object-contain" />
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                      <tr>
                        <td className="bg-white px-4 py-2.5 text-sm font-medium text-slate-600">Fit score</td>
                        {MACHINE_OPTIONS.map((machine) => {
                          const isSel = activeMachine?.id === machine.id
                          return (
                            <td
                              key={machine.id}
                              className={cn('px-4 py-2.5 text-center', isSel ? 'bg-[rgb(var(--speedgoat-blue))]/[0.03]' : 'bg-white')}
                              style={isSel ? selectedColumnFrame('body') : undefined}
                            >
                              <div className="inline-flex items-center gap-0.5">{renderStars(machine.score[selectedBand])}</div>
                            </td>
                          )
                        })}
                      </tr>
                      {([
                        { label: 'Office / lab', key: 'officeLab' },
                        { label: 'Rack-mountable', key: 'rackMount' },
                        { label: 'Field-deployable', key: 'field' },
                      ] as const).map((row) => (
                        <tr key={row.key}>
                          <td className="bg-white px-4 py-2 text-sm font-medium text-slate-600">
                            {row.label}
                          </td>
                          {MACHINE_OPTIONS.map((machine) => {
                            const isSel = activeMachine?.id === machine.id
                            return (
                              <td
                                key={machine.id}
                                className={cn('px-4 py-2 text-center', isSel ? 'bg-[rgb(var(--speedgoat-blue))]/[0.02]' : 'bg-white')}
                                style={isSel ? selectedColumnFrame('body') : undefined}
                              >
                                <BooleanCell value={machine[row.key]} />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className="bg-white px-4 py-2 text-sm font-medium text-slate-600">I/O expandability</td>
                        {MACHINE_OPTIONS.map((machine) => {
                          const isSel = activeMachine?.id === machine.id
                          return (
                            <td
                              key={machine.id}
                              className={cn('px-4 py-2.5 text-center', isSel ? 'bg-[rgb(var(--speedgoat-blue))]/[0.02]' : 'bg-white')}
                              style={isSel ? selectedColumnFrame('body') : undefined}
                            >
                              <ExpandabilityCell level={machine.expandability} />
                            </td>
                          )
                        })}
                      </tr>
                      <tr>
                        <td className="bg-white px-4 py-2 text-sm font-medium text-slate-600">Field-upgradeable</td>
                        {MACHINE_OPTIONS.map((machine) => {
                          const isSel = activeMachine?.id === machine.id
                          return (
                            <td
                              key={machine.id}
                              className={cn('px-4 py-2 text-center', isSel ? 'bg-[rgb(var(--speedgoat-blue))]/[0.03]' : 'bg-white')}
                              style={isSel ? selectedColumnFrame('footer') : undefined}
                            >
                              <BooleanCell value={machine.upgradeability === 'Yes'} />
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="mt-3 text-[13px] text-slate-500">
                {activeMachine?.fitNote[selectedBand]}
                {activeMachine?.id !== primaryRecommendedMachine?.id ? (
                  <span className="ml-1 text-amber-600">You overrode the recommended machine ({primaryRecommendedMachine?.name}).</span>
                ) : null}
              </p>
            </SectionCard>

            <SectionCard
              eyebrow="Step 3"
              title="Configure your I/O"
            >
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.95fr)_minmax(200px,0.58fr)]">
                  <div className="min-w-0 md:pr-2">
                    <div className="grid gap-x-8 md:grid-cols-2">
                      {INTERFACE_BOARD_COLUMNS.map((column, columnIndex) => (
                        <div
                          key={`interface-column-${columnIndex}`}
                          className={cn(columnIndex === 1 ? 'md:border-l md:border-slate-200 md:pl-8' : '')}
                        >
                          <div>
                            {column.map((group, rowIndex) => {
                              const count = (boardDisplayCounts as Record<string, number>)[group.id] ?? 0
                              const isConfiguredInteractive = INTERACTIVE_GROUPS.includes(group.id as InteractiveGroupId)
                              const isAvailable = ((activeBoardCounts as Record<string, number>)[group.id] ?? 0) > 0 || isConfiguredInteractive
                              const isActive = activeGroupId === group.id
                              return (
                                <div
                                  key={group.id}
                                  className={cn(rowIndex !== column.length - 1 ? 'border-b border-slate-200' : '')}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setActiveGroupId((prev) => (prev === group.id ? null : group.id))}
                                    className={cn(
                                      'flex w-full items-center justify-between gap-4 px-0 py-3 text-left transition-colors',
                                      isActive
                                        ? 'text-slate-900'
                                        : isAvailable
                                        ? 'text-slate-900 hover:text-[rgb(var(--speedgoat-blue))]'
                                        : 'text-slate-400'
                                    )}
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      <span
                                        className={cn(
                                          'text-sm',
                                          isActive
                                            ? 'text-[rgb(var(--speedgoat-blue))]'
                                            : isAvailable
                                            ? 'text-slate-400'
                                            : 'text-slate-300'
                                        )}
                                      >
                                        {isActive ? '⌄' : '›'}
                                      </span>
                                      <span className="truncate text-[13px] font-semibold uppercase tracking-[0.15em]">
                                        {group.label}
                                      </span>
                                    </span>
                                    <span
                                      className={cn(
                                        'inline-flex min-w-7 items-center justify-end text-[12px] font-semibold tabular-nums',
                                        count > 0
                                          ? 'text-[rgb(var(--speedgoat-blue))]'
                                          : 'text-slate-300'
                                      )}
                                    >
                                      {count > 0 ? count : '—'}
                                    </span>
                                  </button>
                                  {isActive ? renderInlineGroupEditor(group.id) : null}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="xl:border-l xl:border-slate-200 xl:pl-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected target machine</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {activeMachine?.name}
                          {activeMachine?.id !== primaryRecommendedMachine?.id ? (
                            <span className="ml-1.5 text-[11px] font-medium text-amber-600">(override)</span>
                          ) : null}
                        </p>
                      </div>

                      <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-[linear-gradient(180deg,rgba(244,247,250,1),rgba(233,239,245,1))]">
                        {activeMachine ? (
                          <Image
                            src={activeMachine.image}
                            alt={activeMachine.name}
                            fill
                            sizes="220px"
                            className="object-contain p-2.5"
                          />
                        ) : null}
                      </div>

                      <div className="divide-y divide-slate-100 text-sm">
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-slate-600">Active I/O sections</span>
                          <span className="font-semibold text-slate-900">{activeBoardGroupCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-slate-600">Performance band</span>
                          <span className="font-semibold text-slate-900">{selectedPerformance.shortLabel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-slate-600">Next step</span>
                          <span className="font-semibold text-slate-900">Refine I/O below</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </SectionCard>
          </div>
        </section>
      </main>
    </>
  )
}
