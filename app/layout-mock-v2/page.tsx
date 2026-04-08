'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import MachineSlotMapImage from '@/components/MachineSlotMapImage'
import ConfiguratorWIP from '@/components/ConfiguratorWIP'
import simulinkBackground from '@/assets/Gemini_Generated_Image_c6c1uec6c1uec6c1.png'
import type { ClosedLoopRate, ProposalGenerateResponse, RequirementRow } from '@/components/configurator/proposalTypes'
import type { ConfiguratorSummary } from '@/components/configurator/useConfigurator'
import { CompactButton, CompactCard } from '@/components/ui/compact'
import { cn } from '@/lib/cn'
import { simulateProposal } from '@/lib/proposal/simulator'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''
const VER2_SIMULINK_BACKGROUND = `${BASE_PATH}/assets/Gemini_Generated_Image_4qdl7x4qdl7x4qdl.png`

const HEADER_NAV_ITEMS = [
  { label: 'Testing Workflows', hasMenu: true },
  { label: 'Test Systems', hasMenu: true },
  { label: 'Industries', hasMenu: true },
  { label: 'Resources', hasMenu: true },
  { label: 'Company', hasMenu: true },
  { label: 'Contact', hasMenu: false },
] as const

const HEADER_NAV_TARGETS: Record<(typeof HEADER_NAV_ITEMS)[number]['label'], string> = {
  'Testing Workflows': 'hero-section',
  'Test Systems': 'systems-section',
  'Industries': 'industries-section',
  Resources: 'resources-section',
  Company: 'hero-section',
  Contact: 'contact-section',
}

const VERSION_SELECTOR_NOTES = [
  {
    label: 'Ver 1',
    description: 'Baseline split layout with the original selector flow and cleaner default presentation.',
  },
  {
    label: 'Ver 2',
    description: 'More branded and atmospheric treatment with the same core machine-selection logic as Ver 1.',
  },
  {
    label: 'Ver 3',
    description: 'Recommendation-first layout with one dominant suggested platform and explicit compare states.',
  },
] as const

type PerformanceBand = '10k' | '100k' | 'mhz'
type InterfaceId = 'high-fidelity' | 'general-io' | 'high-speed-daq'
type InteractiveGroupId = 'analog' | 'digital' | 'pwm-position' | 'communication'
type ApplicationProfileId = 'general-control' | 'high-fidelity' | 'measurement'
type DeploymentEnvironment = 'office-lab' | 'field'
type IoVolume = 'lt100' | 'gt100'

const PERFORMANCE_OPTIONS: Array<{
  id: PerformanceBand
  title: string
  shortLabel: string
  summary: string
  detail: string
  advancedNote?: string
  pulseCount: number
  visualMode: 'pulses' | 'dense'
  tierLabel: string
  tierColor: string
  recommendLabel: string
  typicalUse: string
}> = [
  {
    id: '10k',
    title: 'Up to 20 kHz',
    shortLabel: '20 kHz',
    summary: 'General control, monitoring, communication, and slower plant dynamics.',
    detail: 'General timing requirements',
    pulseCount: 2,
    visualMode: 'pulses',
    tierLabel: 'Standard',
    tierColor: 'bg-slate-100 text-slate-600',
    recommendLabel: 'Most common choice',
    typicalUse: 'General HIL/RCP, communication buses, monitoring, mechanical and thermal system behavior.',
  },
  {
    id: '100k',
    title: 'Up to 100 kHz',
    shortLabel: '100 kHz',
    summary: 'Fast control loops for motor drives, inverters, and sharper electromechanical dynamics.',
    detail: 'Fast control and power-stage timing',
    pulseCount: 5,
    visualMode: 'pulses',
    tierLabel: 'High-speed',
    tierColor: 'bg-sky-50 text-sky-700',
    recommendLabel: 'Recommended for motor drives',
    typicalUse: 'Motor control HIL, inverter testing, fast closed-loop power electronics.',
  },
  {
    id: 'mhz',
    title: 'Above 100 kHz into the MHz range',
    shortLabel: '>100 kHz',
    summary: 'Very fast switching effects, converter behavior, and sub-microsecond dynamics.',
    detail: 'Sub-microsecond switching behavior',
    advancedNote:
      'At this timing range, CPU and I/O latency become critical. Fast I/O technologies such as simultaneous-sampling ADCs, DMA acquisition, multi-rate partitioning, or FPGA offload may be required.',
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
    cardDescriptor: 'For office and lab use. Enormous expansion possibilities.',
    selectorImageClassName: 'scale-[1.55] translate-y-[1px]',
    previewImageClassName: 'scale-[1.18] translate-y-[4px]',
    maxSlots: 7,
    maxSlotsExpanded: 42,
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
    id: 'testbench',
    name: 'Testbench',
    image: `${BASE_PATH}/assets/download.jpg`,
    cardDescriptor: 'Modular rack system with customization services to your needs.',
    selectorImageClassName: 'scale-[1.35] translate-y-[2px]',
    previewImageClassName: 'scale-[1.1] translate-y-[4px]',
    maxSlots: 14,
    maxSlotsExpanded: 56,
    score: { '10k': 5, '100k': 4, mhz: 3 } as Record<PerformanceBand, number>,
    officeLab: true,
    rackMount: true,
    field: false,
    expandability: 'Extensive',
    upgradeability: 'Yes',
    fitNote: {
      '10k': 'Ideal for large rack-mount lab setups with maximum I/O density and expansion slots.',
      '100k': 'Strong choice for fast-control rack deployments with high channel counts.',
      mhz: 'Supports high-speed work but Performance may be more suitable for FPGA-intensive applications.',
    } as Record<PerformanceBand, string>,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    image: `${BASE_PATH}/assets/machine-pulse.png`,
    cardDescriptor: 'Scalable desktop system for control design and controller testing.',
    selectorImageClassName: 'scale-[1.42] translate-y-[2px]',
    previewImageClassName: 'scale-[1.12] translate-y-[6px]',
    maxSlots: 3,
    maxSlotsExpanded: 8,
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
    cardDescriptor: 'For field and harsh environments. Withstands shock and vibration.',
    selectorImageClassName: 'scale-[1.32] translate-y-[1px]',
    previewImageClassName: 'scale-[1.1] translate-y-[3px]',
    maxSlots: 5,
    maxSlotsExpanded: 14,
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
    cardDescriptor: 'Entry-level solution for office to in-vehicle operation.',
    selectorImageClassName: 'scale-[1.38] translate-y-[2px]',
    previewImageClassName: 'scale-[1.14] translate-y-[4px]',
    maxSlots: 4,
    maxSlotsExpanded: 6,
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
    cardDescriptor: 'Small form factor for field, in-vehicle, and confined areas.',
    selectorImageClassName: 'scale-[1.44] translate-y-[2px]',
    previewImageClassName: 'scale-[1.16] translate-y-[4px]',
    maxSlots: 1,
    maxSlotsExpanded: 1,
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
    subtitle: '> 20 kHz closed-loop',
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

const APPLICATION_PROFILES: Array<{
  id: ApplicationProfileId
  title: string
  description: string
  performanceBand: PerformanceBand
  interfaces: InterfaceId[]
  badge: string
}> = [
  {
    id: 'general-control',
    title: 'General controls or HIL',
    description: 'Control precision up to roughly 10 kHz with broad communication and standard I/O needs.',
    performanceBand: '10k',
    interfaces: ['general-io'],
    badge: 'General purpose',
  },
  {
    id: 'high-fidelity',
    title: 'High-fidelity controls or HIL',
    description: 'Fast control loops, electrification, power electronics, and sharper dynamic behavior.',
    performanceBand: '100k',
    interfaces: ['high-fidelity', 'general-io'],
    badge: 'High speed',
  },
  {
    id: 'measurement',
    title: 'Test & measurement',
    description: 'No closed control loop. Emphasis on acquisition, signal generation, and measurement interfaces.',
    performanceBand: 'mhz',
    interfaces: ['high-speed-daq', 'general-io'],
    badge: 'DAQ-focused',
  },
] as const

const DEPLOYMENT_OPTIONS: Array<{
  id: DeploymentEnvironment
  title: string
  description: string
}> = [
  {
    id: 'office-lab',
    title: 'Office / Lab',
    description: 'Bench, rack, or engineering-lab deployment with less emphasis on rugged portability.',
  },
  {
    id: 'field',
    title: 'Field',
    description: 'Vehicle-near, mobile, or rugged deployment where portability and field readiness matter.',
  },
] as const

const IO_VOLUME_OPTIONS: Array<{
  id: IoVolume
  title: string
  description: string
}> = [
  {
    id: 'lt100',
    title: 'I/O below 100',
    description: 'Compact and medium configurations with a smaller channel footprint.',
  },
  {
    id: 'gt100',
    title: 'I/O above 100',
    description: 'Higher channel density with stronger expansion and headroom requirements.',
  },
] as const

const EMPTY_CONFIGURATOR_SUMMARY: ConfiguratorSummary = {
  totalSignals: 0,
  rowCount: 0,
  categoryTotals: {},
}

function SectionCard({
  eyebrow,
  title,
  description,
  sectionId,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  description?: string
  sectionId?: string
  children: React.ReactNode
}) {
  return (
    <div id={sectionId} className="scroll-mt-28">
      <CompactCard className={cn(PANEL_CLASS, 'p-4 md:p-5')}>
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1.5 text-lg font-semibold text-slate-900 md:text-xl">{title}</h2>
          {description ? <p className="mt-1.5 max-w-3xl text-sm text-slate-600">{description}</p> : null}
          <div className="mt-4">{children}</div>
        </div>
      </CompactCard>
    </div>
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

function getRecommendedMachineId(
  environment: DeploymentEnvironment,
  ioVolume: IoVolume,
  band: PerformanceBand
): string {
  if (environment === 'office-lab') {
    if (band === 'mhz') return 'performance'
    if (ioVolume === 'gt100') return 'performance'
    return 'pulse'
  }
  // field
  if (band === 'mhz') return 'mobile'
  return ioVolume === 'gt100' ? 'mobile' : 'baseline'
}

/** Score a machine for secondary ranking — does NOT override the primary recommendation. */
function scoreMachine(
  machine: (typeof MACHINE_OPTIONS)[number],
  environment: DeploymentEnvironment,
  ioVolume: IoVolume,
  band: PerformanceBand
): number {
  let s = machine.score[band]

  // Testbench is an optional specialist choice, not a default recommendation target.
  if (machine.id === 'testbench') s -= 100

  // Deployment fit
  if (environment === 'field') {
    s += machine.field ? 2 : -3
  } else {
    s += machine.rackMount ? 1 : 0
  }

  // I/O volume fit
  if (ioVolume === 'gt100') {
    if (machine.expandability === 'Extensive') s += 3
    else if (machine.expandability === 'Moderate') s += 1
    else s -= 1
  } else {
    if (machine.expandability === 'Limited') s += 1
  }

  return s
}

function getMachineReason(
  machine: (typeof MACHINE_OPTIONS)[number],
  application: (typeof APPLICATION_PROFILES)[number],
  environment: DeploymentEnvironment,
  ioVolume: IoVolume
) {
  const reasonParts = [application.description]

  if (environment === 'field') {
    reasonParts.push(machine.field ? 'Supports field-oriented deployment well.' : 'Less ideal for field deployment.')
  } else {
    reasonParts.push(machine.officeLab ? 'Fits office and lab setups well.' : 'Less focused on stationary lab setups.')
  }

  if (ioVolume === 'gt100') {
    reasonParts.push(
      machine.expandability === 'Extensive'
        ? 'Has the expansion headroom expected for larger I/O counts.'
        : 'Expansion headroom is more limited for larger I/O counts.'
    )
  } else {
    reasonParts.push('Works with smaller and mid-size I/O footprints.')
  }

  return reasonParts.join(' ')
}

function getRecommendationRationale(
  machine: (typeof MACHINE_OPTIONS)[number],
  application: (typeof APPLICATION_PROFILES)[number],
  environment: DeploymentEnvironment,
  ioVolume: IoVolume
) {
  const applicationLead =
    application.id === 'measurement'
      ? 'measurement-led workflows'
      : application.id === 'high-fidelity'
      ? 'high-fidelity control and HIL'
      : 'general control and HIL'

  const environmentLead = environment === 'field' ? 'field deployment' : 'office and lab setups'
  const ioLead = ioVolume === 'gt100' ? 'larger I/O counts' : 'sub-100-I/O setups'

  return `${machine.name} is the recommended starting setup for ${applicationLead}, ${environmentLead}, and ${ioLead}.`
}

function getMachineCapacityLabel(machine: (typeof MACHINE_OPTIONS)[number]) {
  if (machine.expandability === 'Extensive' && machine.maxSlotsExpanded >= 14) return 'High'
  if (machine.expandability === 'Extensive' || machine.expandability === 'Moderate') return 'Moderate'
  return 'Compact'
}

function getMachineBestFor(machine: (typeof MACHINE_OPTIONS)[number]) {
  switch (machine.id) {
    case 'performance':
      return 'Advanced / system-level HIL'
    case 'mobile':
      return 'Portable / in-vehicle HIL'
    case 'baseline':
      return 'Compact general-purpose setups'
    case 'unit':
      return 'Embedded deployment'
    case 'testbench':
      return 'Comprehensive rack test setups'
    case 'pulse':
    default:
      return 'Prototyping and entry-level HIL'
  }
}

function getMachineBestForCompact(machine: (typeof MACHINE_OPTIONS)[number]) {
  switch (machine.id) {
    case 'performance':
      return 'Advanced HIL'
    case 'mobile':
      return 'Portable HIL'
    case 'baseline':
      return 'Compact setups'
    case 'unit':
      return 'Embedded'
    case 'testbench':
      return 'Rack systems'
    case 'pulse':
    default:
      return 'Entry HIL'
  }
}

function getMachineStatusLabel(machineId: string, recommendedMachineId: string) {
  if (machineId === recommendedMachineId) return 'Best fit'

  switch (machineId) {
    case 'performance':
      return 'Strong alternative'
    case 'mobile':
      return 'Good for field / in-vehicle'
    case 'baseline':
      return 'Compact option'
    case 'unit':
      return 'Embedded deployment'
    case 'testbench':
      return 'Rack test system'
    case 'pulse':
    default:
      return 'Compact lab option'
  }
}

function getCompactMachineStatusLabel(machineId: string, recommendedMachineId: string) {
  if (machineId === recommendedMachineId) return 'Best fit'

  switch (machineId) {
    case 'performance':
      return 'Alternative'
    case 'mobile':
      return 'Field'
    case 'baseline':
      return 'Compact'
    case 'unit':
      return 'Compact'
    case 'testbench':
      return 'Rack'
    case 'pulse':
    default:
      return 'Lab'
  }
}

function getMachineStatusTone(machineId: string, recommendedMachineId: string) {
  if (machineId === recommendedMachineId) return 'recommended'
  if (machineId === 'performance') return 'alternative'
  return 'neutral'
}

function getComparisonBullets(
  inspecting: (typeof MACHINE_OPTIONS)[number],
  recommended: (typeof MACHINE_OPTIONS)[number],
  environment: DeploymentEnvironment,
  ioVolume: IoVolume
) {
  if (inspecting.id === recommended.id) {
    return [
      `Best aligned with your current ${environment === 'field' ? 'deployment context' : 'office / lab setup'}.`,
      ioVolume === 'gt100'
        ? 'Provides the expansion headroom expected for larger I/O counts.'
        : 'Fits smaller and mid-size I/O footprints without oversizing the system.',
      'Strong default recommendation for the current inputs.',
    ]
  }

  const bullets: string[] = []
  const expandabilityRank = { Limited: 1, Moderate: 2, Extensive: 3 } as const

  if (expandabilityRank[inspecting.expandability as keyof typeof expandabilityRank] > expandabilityRank[recommended.expandability as keyof typeof expandabilityRank]) {
    bullets.push(`More headroom for expansion than ${recommended.name}.`)
  }

  if (inspecting.maxSlotsExpanded > recommended.maxSlotsExpanded) {
    bullets.push(`Better fit when maximum flexibility or future growth matters.`)
  }

  if (environment === 'field' && inspecting.field && !recommended.field) {
    bullets.push(`Better suited to field or vehicle-near deployment than ${recommended.name}.`)
  } else if (environment === 'office-lab' && inspecting.rackMount && !recommended.rackMount) {
    bullets.push(`Stronger fit for structured lab or rack-based setups than ${recommended.name}.`)
  }

  if (inspecting.score['100k'] > recommended.score['100k']) {
    bullets.push(`More comfortable for higher-performance or more complex real-time models.`)
  }

  if (bullets.length < 3) {
    bullets.push(`Tradeoff: likely more system than needed for the current ${ioVolume === 'gt100' ? 'I/O profile' : 'compact I/O footprint'}.`)
  } else {
    bullets.push(`Tradeoff: larger and likely more than needed for the current recommendation inputs.`)
  }

  return bullets.slice(0, 4)
}

function getDecisionSummary(args: {
  recommended: (typeof MACHINE_OPTIONS)[number]
  inspecting: (typeof MACHINE_OPTIONS)[number] | null
  selected: (typeof MACHINE_OPTIONS)[number] | null
  environment: DeploymentEnvironment
  ioVolume: IoVolume
}) {
  const { recommended, inspecting, selected, environment, ioVolume } = args

  if (selected) {
    return `Selected: ${selected.name}. ${recommended.id === selected.id ? `${selected.name} also remains the recommended match for your current selections.` : `${recommended.name} remains the recommended match, while ${selected.name} is your manual selection.`}`
  }

  if (inspecting && inspecting.id !== recommended.id) {
    return `You're viewing ${inspecting.name}. ${recommended.name} remains the recommended match for your current ${environment === 'field' ? 'field-oriented' : 'office / lab'} ${ioVolume === 'gt100' ? 'high-I/O' : 'sub-100-I/O'} setup.`
  }

  return `${recommended.name} is recommended for your current inputs. It best matches the deployment context, performance band, and I/O scale you selected.`
}

function getInspectingSummary(
  inspecting: (typeof MACHINE_OPTIONS)[number] | null,
  recommended: (typeof MACHINE_OPTIONS)[number]
) {
  if (!inspecting) return 'View one machine in detail. Expand a card to see how it differs from the recommended option.'
  if (inspecting.id === recommended.id) return `You're viewing ${inspecting.name}. It remains the recommended match for your current selections.`
  return `You're viewing ${inspecting.name}. ${recommended.name} remains the recommended match for your current selections.`
}

export default function LayoutMockV2Page() {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null)
  const [selectedApplicationId, setSelectedApplicationId] = useState<ApplicationProfileId>('high-fidelity')
  const [selectedEnvironment, setSelectedEnvironment] = useState<DeploymentEnvironment>('office-lab')
  const [selectedIoVolume, setSelectedIoVolume] = useState<IoVolume>('lt100')
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)

  // Reset manual machine override when any filter changes
  useEffect(() => {
    setSelectedMachineId(null)
    setExpandedMachineId(null)
  }, [selectedApplicationId, selectedEnvironment, selectedIoVolume])
  const [configuratorSummary, setConfiguratorSummary] = useState<ConfiguratorSummary>(EMPTY_CONFIGURATOR_SUMMARY)
  const [configuratorRequirements, setConfiguratorRequirements] = useState<RequirementRow[]>([])
  const handleRequirementsChange = useCallback(({ rows }: { rows: RequirementRow[] }) => {
    setConfiguratorRequirements(rows)
  }, [])
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

  const scrollToSection = (sectionId: string) => {
    if (typeof window === 'undefined') return
    setMenuOpen(false)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleHeaderNavClick = (label: (typeof HEADER_NAV_ITEMS)[number]['label']) => {
    scrollToSection(HEADER_NAV_TARGETS[label])
  }

  const openAdvancedConfigurator = () => {
    if (typeof window === 'undefined') return
    setMenuOpen(false)
    window.location.href = '/v2'
  }

  const selectedApplication = useMemo(
    () => APPLICATION_PROFILES.find((option) => option.id === selectedApplicationId) ?? APPLICATION_PROFILES[1],
    [selectedApplicationId]
  )

  const selectedBand = selectedApplication.performanceBand

  const selectedPerformance = useMemo(
    () => PERFORMANCE_OPTIONS.find((option) => option.id === selectedBand) ?? PERFORMANCE_OPTIONS[1],
    [selectedBand]
  )

  const selectedClosedLoopRate = useMemo<ClosedLoopRate>(() => {
    if (selectedBand === 'mhz') return 'above100k'
    return selectedBand
  }, [selectedBand])

  const recommendedMachineId = useMemo(
    () => getRecommendedMachineId(selectedEnvironment, selectedIoVolume, selectedBand),
    [selectedEnvironment, selectedIoVolume, selectedBand]
  )

  const primaryRecommendedMachine = useMemo(
    () => MACHINE_OPTIONS.find((m) => m.id === recommendedMachineId) ?? MACHINE_OPTIONS[0],
    [recommendedMachineId]
  )

  useEffect(() => {
    const nextInterfaces = new Set<InterfaceId>(selectedApplication.interfaces)

    if (selectedIoVolume === 'gt100') {
      nextInterfaces.add('general-io')
    }

    const activeMachineId = selectedMachineId ?? primaryRecommendedMachine?.id

    if (activeMachineId === 'performance') {
      nextInterfaces.add('high-fidelity')
    }

    if (activeMachineId === 'mobile' || activeMachineId === 'pulse') {
      nextInterfaces.add('general-io')
    }

    if (selectedApplicationId === 'measurement') {
      nextInterfaces.add('high-speed-daq')
    }

    setSelectedInterfaces(Array.from(nextInterfaces))
  }, [primaryRecommendedMachine?.id, selectedApplication, selectedApplicationId, selectedIoVolume, selectedMachineId])

  const activeMachine = useMemo(
    () => MACHINE_OPTIONS.find((m) => m.id === selectedMachineId) ?? primaryRecommendedMachine,
    [selectedMachineId, primaryRecommendedMachine]
  )

  const selectedMachine = useMemo(
    () => MACHINE_OPTIONS.find((m) => m.id === selectedMachineId) ?? null,
    [selectedMachineId]
  )

  const isVer2Route = pathname === '/layout-mock-v2-ver2'
  const isVer3Route = pathname === '/layout-mock-v2-ver3'
  const isAltRoute = isVer2Route || isVer3Route

  const machineDisplayCards = useMemo(() => {
    return MACHINE_OPTIONS
      .map((machine) => ({
        ...machine,
        displayName:
          machine.id === 'unit'
            ? 'Unit'
            : machine.name,
        _score: scoreMachine(machine, selectedEnvironment, selectedIoVolume, selectedBand),
      }))
      .sort((a, b) => {
        // Testbench stays available, but always at the end of the list.
        if (a.id === 'testbench' && b.id !== 'testbench') return 1
        if (b.id === 'testbench' && a.id !== 'testbench') return -1
        // Recommended machine always first
        const aRec = a.id === recommendedMachineId ? 1 : 0
        const bRec = b.id === recommendedMachineId ? 1 : 0
        if (aRec !== bRec) return bRec - aRec
        // Then by score descending
        return b._score - a._score
      })
  }, [selectedEnvironment, selectedIoVolume, selectedBand, recommendedMachineId])

  const expandedMachine = useMemo(
    () => machineDisplayCards.find((machine) => machine.id === expandedMachineId) ?? null,
    [expandedMachineId, machineDisplayCards]
  )

  const recommendedDisplayMachine = useMemo(
    () => machineDisplayCards.find((machine) => machine.id === primaryRecommendedMachine.id) ?? machineDisplayCards[0],
    [machineDisplayCards, primaryRecommendedMachine.id]
  )

  const alternativeMachineCards = useMemo(
    () => machineDisplayCards.filter((machine) => machine.id !== primaryRecommendedMachine.id),
    [machineDisplayCards, primaryRecommendedMachine.id]
  )

  const selectedDisplayMachine = useMemo(
    () => machineDisplayCards.find((machine) => machine.id === selectedMachineId) ?? null,
    [machineDisplayCards, selectedMachineId]
  )

  const isRecommendedSelected = selectedMachineId === recommendedDisplayMachine.id
  const isVer2SelectedHero = isVer2Route && Boolean(selectedMachineId)

  const decisionSummary = useMemo(
    () =>
      getDecisionSummary({
        recommended: primaryRecommendedMachine,
        inspecting: expandedMachine,
        selected: selectedMachine,
        environment: selectedEnvironment,
        ioVolume: selectedIoVolume,
      }),
    [primaryRecommendedMachine, expandedMachine, selectedMachine, selectedEnvironment, selectedIoVolume]
  )

  const proposalPreview = useMemo<ProposalGenerateResponse | null>(() => {
    if (!activeMachine || configuratorRequirements.length === 0) return null

    try {
      return simulateProposal({
        machineId: activeMachine.id,
        machineName: activeMachine.name,
        version: 'layout-mock-v2-preview',
        requirements: configuratorRequirements,
        maxSlots: activeMachine.maxSlots,
        maxSlotsExpanded: activeMachine.maxSlotsExpanded,
        closedLoopRate: selectedClosedLoopRate,
      })
    } catch {
      return null
    }
  }, [activeMachine, configuratorRequirements, selectedClosedLoopRate])

  const previewMachineContext = useMemo(() => {
    if (!activeMachine) return null
    return {
      id: activeMachine.id,
      name: activeMachine.name,
      image: activeMachine.image,
      maxSlots: activeMachine.maxSlots,
      maxSlotsExpanded: activeMachine.maxSlotsExpanded,
    }
  }, [activeMachine])

  const recommendedModules = proposalPreview?.recommendedModules ?? []
  const visibleRecommendedModules = recommendedModules.slice(0, 4)

  const configuredCategoryEntries = useMemo(
    () => Object.entries(configuratorSummary.categoryTotals).filter(([, count]) => count > 0),
    [configuratorSummary]
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
                  onClick={() => handleHeaderNavClick(item.label)}
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
                onClick={openAdvancedConfigurator}
                className={cn(
                  'hidden h-10 w-10 items-center justify-center rounded-full transition md:inline-flex',
                  isScrolled
                    ? 'text-slate-700 hover:bg-slate-100 hover:text-[rgb(var(--speedgoat-blue))]'
                    : 'text-white hover:bg-white/10'
                )}
                aria-label="Open advanced configurator"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.125a7.5 7.5 0 0115 0" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('systems-section')}
                className={cn(
                  'hidden h-10 w-10 items-center justify-center rounded-full transition md:inline-flex',
                  isScrolled
                    ? 'text-slate-700 hover:bg-slate-100 hover:text-[rgb(var(--speedgoat-blue))]'
                    : 'text-white hover:bg-white/10'
                )}
                aria-label="Jump to target systems"
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
                    onClick={() => handleHeaderNavClick(item.label)}
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
        <section id="hero-section" className="relative overflow-hidden scroll-mt-28 px-4 pt-20 md:px-8 md:pt-28">
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
          <div className="relative mx-auto flex h-[100px] max-w-[1520px] items-end pb-4 md:h-[100px] md:pb-4">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl">
                Configure your real-time test system
              </h1>
              <div className="mt-4 flex items-center gap-2">
                <div className="inline-flex rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-sm">
                  {!pathname || pathname === '/layout-mock-v2' ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                      Ver 1
                    </span>
                  ) : (
                    <a
                      href={`${BASE_PATH}/layout-mock-v2`}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white/78 transition hover:text-white"
                    >
                      Ver 1
                    </a>
                  )}
                  {isVer2Route ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                      Ver 2
                    </span>
                  ) : (
                    <a
                      href={`${BASE_PATH}/layout-mock-v2-ver2`}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white/78 transition hover:text-white"
                    >
                      Ver 2
                    </a>
                  )}
                  {isVer3Route ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                      Ver 3
                    </span>
                  ) : (
                    <a
                      href={`${BASE_PATH}/layout-mock-v2-ver3`}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white/78 transition hover:text-white"
                    >
                      Ver 3
                    </a>
                  )}
                </div>
                <details className="group relative">
                  <summary
                    aria-label="What differs between versions"
                    className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/78 backdrop-blur-sm transition hover:text-white [&::-webkit-details-marker]:hidden"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <circle cx="10" cy="10" r="7.25" />
                      <path strokeLinecap="round" d="M10 8v4" />
                      <circle cx="10" cy="5.5" r="0.75" fill="currentColor" stroke="none" />
                    </svg>
                  </summary>
                  <div className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Version differences</p>
                    <div className="mt-2 space-y-2.5">
                      {VERSION_SELECTOR_NOTES.map((version) => (
                        <div key={version.label} className="space-y-0.5">
                          <p className="text-[12px] font-semibold text-slate-900">{version.label}</p>
                          <p className="text-[12px] leading-relaxed text-slate-600">{version.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 pt-4 md:px-8">
          <div className="mx-auto max-w-[1520px] space-y-3">
            <div
              className={cn(
                'rounded-2xl border border-slate-200 bg-white px-5 shadow-[0_2px_6px_rgba(15,23,42,0.04)]',
                isAltRoute ? 'py-2' : 'py-4'
              )}
            >
              <h2 className="text-sm font-semibold text-slate-900">Explore Which Speedgoat Test System is Right for You</h2>
            </div>

            {/* ── Step 1 — Simulink background with glass overlay boxes ── */}
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.10)]',
                isAltRoute && 'shadow-[0_10px_28px_rgba(0,0,0,0.08)]'
              )}
            >
              {/* Background — Simulink model, kept visible */}
              <div className="pointer-events-none absolute inset-0">
                <Image
                  src={isAltRoute ? VER2_SIMULINK_BACKGROUND : simulinkBackground}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 1480px, 100vw"
                  className={cn(
                    'object-cover object-center',
                    isVer3Route
                      ? 'scale-[1.01] opacity-[0.22] brightness-[1.02] contrast-[1.02] saturate-[0.05]'
                      : isVer2Route
                      ? 'scale-[1.02] opacity-[0.38] brightness-[1.08] contrast-[1.1] saturate-[0.08]'
                      : 'scale-[1.05]'
                  )}
                />
                <div
                  className={cn(
                    'absolute inset-0',
                    isVer3Route
                      ? 'bg-[linear-gradient(180deg,rgba(248,251,255,0.9),rgba(245,248,252,0.86)_42%,rgba(244,247,251,0.92)_100%)]'
                      : isVer2Route
                      ? 'bg-[linear-gradient(180deg,rgba(250,252,255,0.72),rgba(244,248,255,0.58)_40%,rgba(241,245,249,0.64)_100%)]'
                      : 'bg-gradient-to-br from-slate-950/24 via-slate-950/12 to-slate-950/8'
                  )}
                />
              </div>

              <div
                className={cn(
                  'relative px-4 md:px-6',
                  isAltRoute ? 'pb-2 pt-2 md:pb-2.5 md:pt-2.5' : 'pb-3 pt-3 md:pb-4 md:pt-4'
                )}
              >
                {/* Step header — floats above everything */}
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--speedgoat-blue))] text-[11px] font-bold text-white shadow-[0_0_12px_rgba(0,105,180,0.5)]">
                    1
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] md:text-base">
                    Define your application
                  </h2>
                </div>

                {/* Two-column: Application (left) | Context + Machines (right) */}
                <div
                  className={cn(
                    'grid gap-4',
                    (expandedMachine || isVer2SelectedHero) ? 'grid-cols-1' : 'xl:grid-cols-[276px_minmax(0,1fr)] xl:gap-5'
                  )}
                >

                  {/* ── LEFT: Application type ── */}
                  {(!expandedMachine && !isVer2SelectedHero) ? (
                    <div
                      id="industries-section"
                      className={cn(
                        'scroll-mt-28 rounded-xl',
                        isAltRoute && '2xl:flex 2xl:h-full 2xl:flex-col',
                        isVer3Route
                          ? 'border border-white/70 bg-white/80 p-2.5 shadow-[0_12px_26px_rgba(148,163,184,0.14)]'
                          : isVer2Route
                          ? 'border border-white/52 bg-[linear-gradient(180deg,rgba(255,255,255,0.48),rgba(237,245,255,0.38))] p-2.5 shadow-[0_14px_28px_rgba(148,163,184,0.18)] backdrop-blur-md'
                          : 'border border-white/55 bg-white/72 p-3.5 shadow-[0_10px_36px_rgba(15,23,42,0.14)] backdrop-blur-md'
                      )}
                    >
                      <p className={cn('mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em]', isAltRoute ? 'text-slate-600' : 'text-slate-600')}>
                        Application type
                      </p>
                      <div className={cn(isAltRoute ? 'space-y-1.5 2xl:grid 2xl:flex-1 2xl:auto-rows-fr 2xl:gap-1.5 2xl:space-y-0' : 'space-y-1.5')}>
                        {APPLICATION_PROFILES.map((profile) => {
                          const isActive = profile.id === selectedApplicationId
                          return (
                            <button
                              key={profile.id}
                              type="button"
                              onClick={() => setSelectedApplicationId(profile.id)}
                              className={cn(
                                'group relative block w-full overflow-hidden rounded-lg border px-2.5 text-left transition-all duration-200',
                                isAltRoute && '2xl:h-full',
                                'py-1.5',
                                isActive
                                  ? isVer3Route
                                    ? 'border-[rgb(var(--speedgoat-blue))]/20 bg-white shadow-[0_10px_20px_rgba(148,163,184,0.14)]'
                                    : isVer2Route
                                    ? 'border-[rgb(var(--speedgoat-blue))]/28 bg-white/92 shadow-[0_10px_22px_rgba(148,163,184,0.18)]'
                                    : 'border-[rgb(var(--speedgoat-blue))]/45 bg-white shadow-[0_0_16px_rgba(0,105,180,0.10)]'
                                  : isVer3Route
                                  ? 'border-white/60 bg-white/72 shadow-[0_10px_18px_rgba(148,163,184,0.08)] hover:border-slate-200 hover:bg-white'
                                  : isVer2Route
                                  ? 'border-white/40 bg-[rgba(255,255,255,0.58)] shadow-[0_10px_20px_rgba(148,163,184,0.12)] hover:border-white/70 hover:bg-white/82'
                                  : 'border-slate-200/80 bg-white/42 hover:border-slate-300 hover:bg-white/60'
                              )}
                            >
                              {isActive && (
                                <div className="absolute inset-y-0 left-0 w-[2.5px] rounded-full bg-[rgb(var(--speedgoat-blue))]" />
                              )}
                              <span
                                className={cn(
                                  'inline-block rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.12em]',
                                  isActive
                                    ? 'bg-[rgb(var(--speedgoat-blue))]/20 text-[rgb(var(--speedgoat-blue))]'
                                    : isAltRoute
                                    ? 'bg-slate-200/70 text-slate-600'
                                    : 'bg-slate-100 text-slate-500'
                                )}
                              >
                                {profile.badge}
                              </span>
                              <p className={cn('mt-1 text-[12px] font-semibold leading-snug', isAltRoute ? 'text-slate-900' : isActive ? 'text-slate-900' : 'text-slate-800')}>
                                {profile.title}
                              </p>
                              <p className={cn('mt-0.5 text-[11px] leading-snug', isAltRoute ? 'text-slate-600' : isActive ? 'text-slate-700' : 'text-slate-600')}>
                                {profile.description}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* ── RIGHT column ── */}
                  <div className="flex flex-col gap-2">

                    {/* TOP-RIGHT: Deployment + I/O toggles — hidden when machine selected in ver2 */}
                    {!isVer2SelectedHero && (
                    <div
                      className={cn(
                        'rounded-xl px-4',
                        isVer3Route
                          ? 'border border-white/72 bg-white/82 py-1.5 shadow-[0_10px_22px_rgba(148,163,184,0.12)]'
                          : isVer2Route
                          ? 'border border-white/52 bg-[linear-gradient(180deg,rgba(255,255,255,0.56),rgba(240,247,255,0.46))] py-1.5 shadow-[0_14px_28px_rgba(148,163,184,0.16)] backdrop-blur-md'
                          : 'min-h-[76px] border border-white/55 bg-white/68 py-2 shadow-[0_10px_36px_rgba(15,23,42,0.12)] backdrop-blur-md'
                      )}
                    >
                      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                        <div>
                          <p className={cn('mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]', isAltRoute ? 'text-slate-600' : 'text-slate-600')}>
                            Deployment
                          </p>
                          <div className={cn('inline-flex rounded-lg border p-0.5', isAltRoute ? 'border-slate-200/80 bg-white/90 shadow-sm' : 'border-slate-200/80 bg-white/72')}>
                            {DEPLOYMENT_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedEnvironment(opt.id)}
                                className={cn(
                                  'rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition-all',
                                  selectedEnvironment === opt.id
                                    ? isAltRoute
                                      ? 'bg-slate-900 text-white shadow-sm'
                                      : 'bg-white text-slate-900 shadow-sm'
                                    : isAltRoute
                                    ? 'text-slate-500 hover:text-slate-900'
                                    : 'text-slate-500 hover:text-slate-800'
                                )}
                              >
                                {opt.title}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className={cn('mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]', isAltRoute ? 'text-slate-600' : 'text-slate-600')}>
                            I/O channels
                          </p>
                          <div className={cn('inline-flex rounded-lg border p-0.5', isAltRoute ? 'border-slate-200/80 bg-white/90 shadow-sm' : 'border-slate-200/80 bg-white/72')}>
                            {IO_VOLUME_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedIoVolume(opt.id)}
                                className={cn(
                                  'rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition-all',
                                  selectedIoVolume === opt.id
                                    ? isAltRoute
                                      ? 'bg-slate-900 text-white shadow-sm'
                                      : 'bg-white text-slate-900 shadow-sm'
                                    : isAltRoute
                                    ? 'text-slate-500 hover:text-slate-900'
                                    : 'text-slate-500 hover:text-slate-800'
                                )}
                              >
                                {opt.id === 'lt100' ? '< 100' : '> 100'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="justify-self-start lg:justify-self-end">
                          <p className={cn('mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]', isAltRoute ? 'text-slate-600' : 'text-slate-600')}>
                            Best match
                          </p>
                          <span className={cn('inline-flex min-w-[120px] items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold', isAltRoute ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-300/60 bg-emerald-50 text-emerald-700')}>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
                            {machineDisplayCards.find((machine) => machine.id === primaryRecommendedMachine?.id)?.displayName ?? primaryRecommendedMachine?.name}
                          </span>
                          {isAltRoute ? (
                            <p className="mt-1 text-[10px] leading-snug text-slate-500">
                              {isVer3Route ? 'Recommended platform' : 'Recommended start'}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    )}

                    {/* BOTTOM-RIGHT: Machine recommendation */}
                    <div
                      id="systems-section"
                      className={cn(
                        'flex-1 scroll-mt-28 rounded-xl',
                        isVer3Route
                          ? 'border border-white/68 bg-white/72 p-2.5 shadow-[0_12px_24px_rgba(148,163,184,0.12)]'
                          : isVer2Route
                          ? 'border border-white/52 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),rgba(240,247,255,0.32))] p-3 shadow-[0_14px_28px_rgba(148,163,184,0.16)] backdrop-blur-md'
                          : 'border border-white/55 bg-white/58 p-3.5 shadow-[0_10px_36px_rgba(15,23,42,0.12)] backdrop-blur-md'
                      )}
                    >
                      <div className="mb-2 min-h-[38px] flex items-start justify-between gap-3">
                        <div>
                          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em]', isAltRoute ? 'text-slate-600' : 'text-slate-600')}>
                            Target machine
                          </p>
                          <p className={cn(
                            'mt-1 text-[12px] text-slate-600',
                            isVer2Route && 'inline-flex rounded-md bg-white/78 px-2 py-1 text-slate-600 shadow-[0_8px_18px_rgba(148,163,184,0.16)]'
                          )}>
                            {isVer3Route ? 'Recommended first. Compare alternatives only when you need more detail.' : 'Choose manually or keep the recommended target.'}
                          </p>
                        </div>
                        {expandedMachine ? null : (
                          <p className={cn(
                            'text-[12px] text-slate-500',
                            isVer2Route && 'rounded-md bg-white/78 px-2 py-1 text-slate-500 shadow-[0_8px_18px_rgba(148,163,184,0.16)]'
                          )}>
                            {isVer3Route ? 'Compare one machine in detail when needed.' : 'Expand a card to view details.'}
                          </p>
                        )}
                      </div>

                      {expandedMachine ? (
                        isVer3Route ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_26px_rgba(148,163,184,0.12)]">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                    {expandedMachine.id === recommendedMachineId ? 'Recommended platform detail' : 'Compare with recommended option'}
                                  </span>
                                  {selectedDisplayMachine?.id === expandedMachine.id ? (
                                    <span className="inline-flex items-center rounded-full border border-[rgb(var(--speedgoat-blue))]/20 bg-[rgb(var(--speedgoat-blue))]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--speedgoat-blue))]">
                                      Selected
                                    </span>
                                  ) : null}
                                </div>
                                <div>
                                  <p className="text-lg font-semibold text-slate-900">{expandedMachine.displayName}</p>
                                  <p className="mt-1 text-sm text-slate-600">{getInspectingSummary(expandedMachine, primaryRecommendedMachine)}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedMachineId(null)}
                                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                aria-label="Return to machine grid"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5 8 8m0 0 3 3M8 8l3-3M8 8l-3 3" />
                                </svg>
                                Return
                              </button>
                            </div>

                            <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
                              <div className="space-y-3">
                                <div className="relative min-h-[190px] overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.98))]">
                                  <Image
                                    src={expandedMachine.image}
                                    alt={expandedMachine.displayName}
                                    fill
                                    sizes="(min-width: 1280px) 520px, 100vw"
                                    className={cn(
                                      'object-contain p-4 transition-transform duration-300',
                                      expandedMachine.previewImageClassName,
                                      selectedDisplayMachine?.id === expandedMachine.id && 'scale-[1.05]'
                                    )}
                                  />
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recommended</p>
                                    <p className="mt-1 text-[12px] font-semibold text-slate-900">{recommendedDisplayMachine.displayName}</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Inspecting</p>
                                    <p className="mt-1 text-[12px] font-semibold text-slate-900">{expandedMachine.displayName}</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Selected</p>
                                    <p className="mt-1 text-[12px] font-semibold text-slate-900">{selectedDisplayMachine?.displayName ?? 'None yet'}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                    {expandedMachine.id === recommendedMachineId
                                      ? 'Why it remains recommended'
                                      : `Why choose ${expandedMachine.displayName} instead of ${recommendedDisplayMachine.displayName}?`}
                                  </p>
                                  <ul className="mt-2 space-y-2">
                                    {getComparisonBullets(expandedMachine, primaryRecommendedMachine, selectedEnvironment, selectedIoVolume).map((bullet) => (
                                      <li key={bullet} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-700">
                                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--speedgoat-blue))]" />
                                        <span>{bullet}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Best for</p>
                                    <p className="mt-1 text-[12px] font-semibold text-slate-900">{getMachineBestFor(expandedMachine)}</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">I/O capacity</p>
                                    <p className="mt-1 text-[12px] font-semibold text-slate-900">{getMachineCapacityLabel(expandedMachine)}</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Expandability</p>
                                    <p className="mt-1 text-[12px] font-semibold text-slate-900">{expandedMachine.expandability}</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMachineId(expandedMachine.id)}
                                    className="rounded-md bg-[rgb(var(--speedgoat-blue))] px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-95"
                                  >
                                    {selectedDisplayMachine?.id === expandedMachine.id ? `${expandedMachine.displayName} selected` : `Select ${expandedMachine.displayName}`}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSection('contact-section')}
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                  >
                                    Consult expert
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'rounded-xl',
                              isVer2Route
                                ? 'border border-white/60 bg-white/88 p-4 shadow-[0_16px_28px_rgba(148,163,184,0.18)] backdrop-blur-md'
                                : 'border border-[rgb(var(--speedgoat-blue))]/20 bg-white/88 p-4 shadow-[0_12px_30px_rgba(0,105,180,0.08)]'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={cn('text-lg font-semibold', isVer2Route ? 'text-slate-900' : 'text-slate-900')}>{expandedMachine.displayName}</p>
                                </div>
                                <p className={cn('mt-1 text-sm', isVer2Route ? 'text-slate-600' : 'text-slate-600')}>{expandedMachine.cardDescriptor}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedMachineId(null)}
                                className={cn('inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-sm transition', isVer2Route ? 'border-slate-200 bg-white text-slate-700 hover:text-[rgb(var(--speedgoat-blue))]' : 'border-slate-300 bg-white text-slate-700 hover:text-[rgb(var(--speedgoat-blue))]')}
                                aria-label="Return to machine grid"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5 8 8m0 0 3 3M8 8l3-3M8 8l-3 3" />
                                </svg>
                                Return
                              </button>
                            </div>

                            <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)] xl:items-center">
                              <div className={cn('relative overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.98))]', isVer2Route ? 'min-h-[150px]' : 'min-h-[220px]')}>
                                <Image
                                  src={expandedMachine.image}
                                  alt={expandedMachine.displayName}
                                  fill
                                  sizes="(min-width: 1280px) 520px, 100vw"
                                  className={cn('object-contain p-2.5 transition-transform duration-300', expandedMachine.previewImageClassName)}
                                />
                              </div>
                              <div className="space-y-3">
                                <div className={cn('rounded-xl border p-3', isVer2Route ? 'border-slate-200 bg-slate-50/92' : 'border-slate-200 bg-slate-50/80')}>
                                  <p className={cn('text-[12px] font-semibold uppercase tracking-[0.14em]', isVer2Route ? 'text-slate-600' : 'text-slate-600')}>
                                    Why this machine
                                  </p>
                                  <p className={cn('mt-2 text-sm leading-relaxed', isVer2Route ? 'text-slate-700' : 'text-slate-700')}>
                                    {getMachineReason(expandedMachine, selectedApplication, selectedEnvironment, selectedIoVolume)}
                                  </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div className={cn('rounded-xl border p-3', isVer2Route ? 'border-slate-200 bg-white/92' : 'border-slate-200 bg-white')}>
                                    <p className={cn('text-[12px] font-semibold uppercase tracking-[0.14em]', isVer2Route ? 'text-slate-600' : 'text-slate-600')}>Machine type</p>
                                    <p className={cn('mt-1 text-sm font-semibold', isVer2Route ? 'text-slate-900' : 'text-slate-900')}>{expandedMachine.cardDescriptor}</p>
                                  </div>
                                  <div className={cn('rounded-xl border p-3', isVer2Route ? 'border-slate-200 bg-white/92' : 'border-slate-200 bg-white')}>
                                    <p className={cn('text-[12px] font-semibold uppercase tracking-[0.14em]', isVer2Route ? 'text-slate-600' : 'text-slate-600')}>Expandability</p>
                                    <p className={cn('mt-1 text-sm font-semibold', isVer2Route ? 'text-slate-900' : 'text-slate-900')}>{expandedMachine.expandability}</p>
                                  </div>
                                  <div className={cn('rounded-xl border p-3', isVer2Route ? 'border-slate-200 bg-white/92' : 'border-slate-200 bg-white')}>
                                    <p className={cn('text-[12px] font-semibold uppercase tracking-[0.14em]', isVer2Route ? 'text-slate-600' : 'text-slate-600')}>Upgradeability</p>
                                    <p className={cn('mt-1 text-sm font-semibold', isVer2Route ? 'text-slate-900' : 'text-slate-900')}>{expandedMachine.upgradeability}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMachineId(expandedMachine.id)}
                                    className="rounded-md bg-[rgb(var(--speedgoat-blue))] px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-95"
                                  >
                                    Use this machine
                                  </button>
                                  {!isVer2Route && (
                                  <button
                                    type="button"
                                    onClick={() => scrollToSection('contact-section')}
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                  >
                                    Consult expert
                                  </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      ) : isVer2Route && selectedMachineId ? (
                        /* ── Ver2: Selected machine — image-focused confirmation ── */
                        (() => {
                          const selMachine = machineDisplayCards.find((m) => m.id === selectedMachineId) ?? recommendedDisplayMachine
                          const isRec = selMachine.id === recommendedMachineId
                          return (
                            <div className="relative overflow-hidden rounded-xl border border-sky-200/70 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] shadow-[0_16px_30px_rgba(148,163,184,0.18)] backdrop-blur-md">
                              {/* Large hero image — fills the card */}
                              <div className="relative min-h-[160px] w-full xl:min-h-[180px]">
                                <Image
                                  src={selMachine.image}
                                  alt={selMachine.displayName}
                                  fill
                                  sizes="(min-width: 1280px) 900px, 100vw"
                                  className={cn('object-contain p-6 transition-transform duration-500', selMachine.previewImageClassName)}
                                />
                                {/* Gradient overlay at bottom for text legibility */}
                                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/90 to-transparent" />
                              </div>

                              {/* Compact info bar at the bottom */}
                              <div className="relative -mt-4 flex flex-wrap items-center justify-between gap-3 px-4 pb-3">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    {isRec ? 'Best match' : 'Selected'}
                                  </span>
                                  <p className="text-[17px] font-semibold text-slate-900">{selMachine.displayName}</p>
                                  <span className="hidden text-[12px] text-slate-500 sm:inline">{selMachine.cardDescriptor}</span>
                                  <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:inline">{selMachine.expandability} expansion</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedMachineId(selMachine.id)}
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                  >
                                    Details
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMachineId(null)}
                                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                  >
                                    Change
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })()
                      ) : isVer3Route ? (
                        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.14fr)_minmax(300px,0.86fr)]">
                          <div className="rounded-xl border border-sky-200/60 bg-white p-2.5 shadow-[0_12px_24px_rgba(148,163,184,0.12)]">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended platform</p>
                                <p className="mt-1 text-[16px] font-semibold text-slate-900">{recommendedDisplayMachine.displayName}</p>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Best match
                              </span>
                            </div>

                            <div className="mt-2 grid gap-2.5 lg:grid-cols-[minmax(148px,0.72fr)_minmax(0,1.28fr)] lg:items-center">
                              <button
                                type="button"
                                onClick={() => setSelectedMachineId(recommendedDisplayMachine.id)}
                                className="relative min-h-[104px] overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.98))]"
                                aria-label={`Select ${recommendedDisplayMachine.displayName}`}
                              >
                                <Image
                                  src={recommendedDisplayMachine.image}
                                  alt={recommendedDisplayMachine.displayName}
                                  fill
                                  sizes="(min-width: 1280px) 340px, 100vw"
                                  className={cn(
                                    'object-contain p-2.5 transition-transform duration-300',
                                    recommendedDisplayMachine.previewImageClassName,
                                    isRecommendedSelected && 'scale-[1.08]'
                                  )}
                                />
                              </button>

                              <div className="space-y-2">
                                <div>
                                  <p className="mt-0.5 text-[12px] font-medium text-slate-600">{recommendedDisplayMachine.cardDescriptor}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                  <p className="text-[11px] leading-relaxed text-slate-700">
                                    {getRecommendationRationale(primaryRecommendedMachine, selectedApplication, selectedEnvironment, selectedIoVolume)}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">
                                    Best for: {getMachineBestForCompact(recommendedDisplayMachine)}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">
                                    I/O: {getMachineCapacityLabel(recommendedDisplayMachine)}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMachineId(recommendedDisplayMachine.id)}
                                    className="rounded-md bg-[rgb(var(--speedgoat-blue))] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:brightness-95"
                                  >
                                    {isRecommendedSelected ? `${recommendedDisplayMachine.displayName} selected` : `Select ${recommendedDisplayMachine.displayName}`}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedMachineId(recommendedDisplayMachine.id)}
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                  >
                                    Compare
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white/90 p-2 shadow-[0_12px_22px_rgba(148,163,184,0.1)]">
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">Alternative platforms</p>
                              <span className="text-[11px] font-medium text-slate-500">{alternativeMachineCards.length} options</span>
                            </div>

                            <div className="space-y-1">
                              {alternativeMachineCards.map((machine) => {
                                const isSelected = selectedMachineId === machine.id

                                return (
                                  <div
                                    key={machine.id}
                                    className={cn(
                                      'rounded-xl border px-2 py-1.5 transition-all',
                                      isSelected
                                        ? 'border-[rgb(var(--speedgoat-blue))]/30 bg-[rgb(var(--speedgoat-blue))]/5 shadow-[0_10px_20px_rgba(0,105,180,0.08)]'
                                        : 'border-slate-200 bg-white'
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedMachineId(machine.id)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                        aria-label={`Select ${machine.displayName}`}
                                      >
                                        <span className="relative h-[36px] w-[58px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                          <Image
                                            src={machine.image}
                                            alt={machine.displayName}
                                            fill
                                            sizes="58px"
                                            className={cn(
                                              'object-contain object-center p-1 transition-transform duration-300',
                                              isSelected && 'scale-[1.14]'
                                            )}
                                          />
                                        </span>

                                        <span className="min-w-0 flex-1">
                                          <span className="flex flex-wrap items-center gap-1.5">
                                            <span className="truncate text-[11px] font-semibold text-slate-900">{machine.displayName}</span>
                                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                              {getCompactMachineStatusLabel(machine.id, recommendedMachineId)}
                                            </span>
                                          </span>
                                          <span className="mt-0.5 block truncate text-[10px] text-slate-600">{getMachineBestForCompact(machine)}</span>
                                        </span>
                                      </button>

                                      <div className="flex shrink-0 items-center gap-1.5">
                                        {isSelected ? (
                                          <span className="rounded-md bg-[rgb(var(--speedgoat-blue))]/10 px-1.5 py-1 text-[9px] font-semibold text-[rgb(var(--speedgoat-blue))]">
                                            Selected
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => setExpandedMachineId(machine.id)}
                                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                        >
                                          Compare
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ) : isVer2Route ? (
                        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.12fr)_minmax(300px,0.88fr)]">
                          <div className="rounded-xl border border-sky-200/70 bg-white/88 p-3 shadow-[0_16px_30px_rgba(148,163,184,0.18)] backdrop-blur-md">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended platform</p>
                                <p className="mt-1 text-[16px] font-semibold text-slate-900">{recommendedDisplayMachine.displayName}</p>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Best match
                              </span>
                            </div>
                            <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(160px,0.76fr)_minmax(0,1.12fr)] lg:items-center">
                              <div className="relative min-h-[110px] overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.98))]">
                                <Image
                                  src={recommendedDisplayMachine.image}
                                  alt={recommendedDisplayMachine.displayName}
                                  fill
                                  sizes="(min-width: 1280px) 360px, 100vw"
                                  className={cn(
                                    'object-contain p-2 transition-transform duration-300',
                                    recommendedDisplayMachine.previewImageClassName,
                                    isRecommendedSelected && 'scale-[1.1]'
                                  )}
                                />
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[17px] font-semibold text-slate-900">{recommendedDisplayMachine.displayName}</p>
                                  <p className="mt-0.5 text-[12px] font-medium text-slate-600">{recommendedDisplayMachine.cardDescriptor}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2">
                                  <p className="text-[11px] leading-relaxed text-slate-700">
                                    {getRecommendationRationale(primaryRecommendedMachine, selectedApplication, selectedEnvironment, selectedIoVolume)}
                                  </p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Footprint</p>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-900">{recommendedDisplayMachine.cardDescriptor}</p>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">I/O capacity</p>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-900">{getMachineCapacityLabel(recommendedDisplayMachine)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMachineId(recommendedDisplayMachine.id)}
                                    className="rounded-md bg-[rgb(var(--speedgoat-blue))] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-95"
                                  >
                                    {isRecommendedSelected ? `${recommendedDisplayMachine.displayName} selected` : `Select ${recommendedDisplayMachine.displayName}`}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedMachineId(recommendedDisplayMachine.id)}
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                  >
                                    Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col rounded-xl border border-white/60 bg-white/82 p-2.5 shadow-[0_16px_28px_rgba(148,163,184,0.16)] backdrop-blur-md">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">Alternative platforms</p>
                              <span className="text-[11px] font-medium text-slate-500">{alternativeMachineCards.length} options</span>
                            </div>
                            <div className="grid flex-1 auto-rows-fr gap-1">
                              {alternativeMachineCards.map((machine) => {
                                const isSelected = selectedMachineId === machine.id
                                return (
                                  <div
                                    key={machine.id}
                                    className={cn(
                                      'h-full rounded-xl border bg-white/92 px-2 py-1.5 shadow-[0_8px_16px_rgba(148,163,184,0.12)] transition-all',
                                      isSelected ? 'border-[rgb(var(--speedgoat-blue))]/30 shadow-[0_12px_24px_rgba(0,105,180,0.12)]' : 'border-slate-200'
                                    )}
                                  >
                                    <div className="flex h-full items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedMachineId(machine.id)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                        aria-label={`Select ${machine.displayName}`}
                                      >
                                        <span className="relative h-[40px] w-[68px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                          <Image
                                            src={machine.image}
                                            alt={machine.displayName}
                                            fill
                                            sizes="68px"
                                            className={cn(
                                              'object-contain object-center p-1.5 transition-transform duration-300',
                                              isSelected && 'scale-[1.16]'
                                            )}
                                          />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5">
                                            <p className="truncate text-[11px] font-semibold text-slate-900">{machine.displayName}</p>
                                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                              {getCompactMachineStatusLabel(machine.id, recommendedMachineId)}
                                            </span>
                                          </div>
                                          <p className="mt-0.5 truncate text-[9px] text-slate-500">{getMachineBestForCompact(machine)}</p>
                                        </div>
                                      </button>
                                      <div className="flex shrink-0 items-center gap-1">
                                        {isSelected ? (
                                          <span className="rounded-md bg-[rgb(var(--speedgoat-blue))]/10 px-1.5 py-1 text-[9px] font-semibold text-[rgb(var(--speedgoat-blue))]">
                                            Selected
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedMachineId(machine.id)
                                            setExpandedMachineId(machine.id)
                                          }}
                                          className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[9px] font-semibold text-slate-700 shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]"
                                        >
                                          Details
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={cn('grid auto-rows-fr grid-cols-3 gap-2', isVer2Route && 'gap-1.5')}>
                          {machineDisplayCards.map((machine) => {
                            const isActive = activeMachine?.id === machine.id
                            const isBestFit = primaryRecommendedMachine?.id === machine.id
                            return (
                              <div
                                key={machine.id}
                                className={cn(
                                  'group relative flex flex-col overflow-hidden rounded-lg border px-2.5 text-left transition-all duration-200',
                                  'min-h-[108px] pb-1.5 pt-1.5',
                                  isActive
                                    ? isVer2Route
                                      ? 'border-[rgb(var(--speedgoat-blue))]/44 bg-[rgba(255,255,255,0.1)] shadow-[0_0_14px_rgba(0,105,180,0.12)]'
                                      : 'border-[rgb(var(--speedgoat-blue))]/45 bg-white/92 shadow-[0_0_16px_rgba(0,105,180,0.10)]'
                                    : isVer2Route
                                    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(7,18,34,0.52),rgba(7,18,34,0.28))] shadow-[0_10px_18px_rgba(2,6,23,0.14)] hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(7,18,34,0.62),rgba(7,18,34,0.36))]'
                                    : 'border-slate-200/80 bg-white/55 hover:border-slate-300 hover:bg-white/72'
                                )}
                              >
                                <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                                  {isBestFit ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                                      Fit
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMachineId(machine.id)
                                      setExpandedMachineId(machine.id)
                                    }}
                                    className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border shadow-sm transition', isVer2Route ? 'border-white/12 bg-white/10 text-white/72 hover:text-white' : 'border-slate-300/80 bg-white/90 text-slate-600 hover:text-[rgb(var(--speedgoat-blue))]')}
                                    aria-label={`Expand ${machine.displayName}`}
                                  >
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6 3 3M10 6l3-3M6 10l-3 3M10 10l3 3" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 3H3v2.5M10.5 3H13v2.5M5.5 13H3v-2.5M10.5 13H13v-2.5" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMachineId((prev) => (prev === machine.id ? null : machine.id))}
                                  className="flex h-full w-full flex-col text-left"
                                >
                                  <div className="relative mx-auto h-[48px] w-full overflow-hidden">
                                    <Image
                                      src={machine.image}
                                      alt={machine.displayName}
                                      fill
                                      sizes="180px"
                                      className={cn(
                                        'object-contain transition duration-200',
                                        machine.selectorImageClassName,
                                        isActive ? 'brightness-[1.06]' : 'opacity-80 group-hover:opacity-100'
                                      )}
                                    />
                                  </div>
                                  <div className="mt-1.5 min-h-[20px]">
                                    <p className={cn('text-[13px] font-semibold', isVer2Route ? (isActive ? 'text-white' : 'text-white/88') : isActive ? 'text-slate-900' : 'text-slate-800')}>
                                      {machine.displayName}
                                    </p>
                                  </div>
                                  <p className={cn('mt-1 min-h-[34px] text-[12px] leading-relaxed', isVer2Route ? (isActive ? 'text-white/78' : 'text-white/68') : isActive ? 'text-slate-700' : 'text-slate-600')}>
                                    {machine.cardDescriptor}
                                  </p>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Fit note */}
                      <div className={cn('mt-1.5 flex min-h-[36px] items-center justify-between gap-3 rounded-lg border px-3 py-1', isAltRoute ? 'border-white/60 bg-white/76' : 'border-slate-200/60 bg-white/50 backdrop-blur-sm')}>
                        <p className={cn('min-w-0 text-[12px] leading-relaxed', isAltRoute ? 'text-slate-700' : 'text-slate-700')}>
                          {isVer3Route
                            ? decisionSummary
                            : activeMachine
                            ? getMachineReason(activeMachine, selectedApplication, selectedEnvironment, selectedIoVolume)
                            : null}
                        </p>
                        {!isAltRoute && (
                        <button
                          type="button"
                          onClick={() => scrollToSection('contact-section')}
                          className="shrink-0 rounded-md border border-slate-300 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:text-[rgb(var(--speedgoat-blue))]"
                        >
                          Consult expert
                        </button>
                        )}
                      </div>
                    </div>

                    {/* Consult expert — bottom-right of step 1 (compact alt variants) */}
                    {isAltRoute && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => scrollToSection('contact-section')}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-[11px] font-semibold shadow-sm transition hover:text-[rgb(var(--speedgoat-blue))]',
                            isVer3Route
                              ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              : 'border border-white/60 bg-white/72 text-slate-600 backdrop-blur-md hover:bg-white'
                          )}
                        >
                          Consult expert
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <SectionCard
              sectionId="resources-section"
              eyebrow="Step 2"
              title="Configure your I/O"
            >
              <div className="space-y-4">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.72fr)_minmax(240px,0.7fr)]">
                  <div className="min-w-0">
                    <ConfiguratorWIP
                      onSummaryChange={setConfiguratorSummary}
                      onRequirementsChange={handleRequirementsChange}
                      closedLoopRate={selectedClosedLoopRate}
                      visualVariant="layout-mock-v2"
                    />
                  </div>

                  <div className="xl:border-l xl:border-slate-200 xl:pl-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600">Selected target machine</p>
                        <p className="mt-1 min-h-[24px] text-sm font-semibold text-slate-900">
                          {activeMachine?.name}
                          {activeMachine?.id !== primaryRecommendedMachine?.id ? (
                            <span className="ml-1.5 text-[12px] font-medium text-amber-600">(override)</span>
                          ) : null}
                        </p>
                        <p className="mt-1 min-h-[72px] text-[12px] leading-relaxed text-slate-500">
                          {activeMachine ? getMachineReason(activeMachine, selectedApplication, selectedEnvironment, selectedIoVolume) : null}
                        </p>
                      </div>

                      <div className="min-h-[138px] rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600">Proposed I/O emphasis</p>
                        <div className="mt-2 min-h-[34px] flex flex-wrap gap-1.5">
                          {selectedInterfaces.map((interfaceId) => {
                            const interfaceOption = INTERFACE_OPTIONS.find((option) => option.id === interfaceId)
                            if (!interfaceOption) return null
                            return (
                              <span
                                key={interfaceId}
                                className="inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700"
                              >
                                {interfaceOption.subtitle}
                              </span>
                            )
                          })}
                        </div>
                        <p className="mt-2 min-h-[54px] text-[12px] leading-relaxed text-slate-500">
                          This is the preselection bias for the I/O proposal. It changes when you change application, environment, I/O volume, or machine.
                        </p>
                      </div>

                      <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-[rgb(var(--speedgoat-blue))]/12 bg-[linear-gradient(180deg,rgba(244,247,250,1),rgba(233,239,245,1))]">
                        <div className="pointer-events-none absolute inset-x-6 top-4 h-10 rounded-full bg-[rgb(var(--speedgoat-blue))]/10 blur-2xl" />
                        {activeMachine ? (
                          <Image
                            key={activeMachine.id}
                            src={activeMachine.image}
                            alt={activeMachine.name}
                            fill
                            sizes="320px"
                            className={cn(
                              'object-contain p-1.5 transition-transform duration-500 ease-out',
                              activeMachine.previewImageClassName
                            )}
                          />
                        ) : null}
                      </div>

                      <div className="min-h-[240px] rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600">Suggested modules</p>
                          {proposalPreview ? (
                            <span className="text-[12px] font-medium text-slate-600">
                              {recommendedModules.length} item{recommendedModules.length === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>

                        {proposalPreview && visibleRecommendedModules.length > 0 ? (
                          <div className="mt-2 min-h-[150px] space-y-2">
                            {visibleRecommendedModules.map((module) => (
                              <div
                                key={`${module.moduleId}-${module.interfaceForModule ?? 'base'}`}
                                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-slate-900">{module.moduleId}</p>
                                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                                    {module.friendlyName}
                                  </p>
                                </div>
                                <span className="inline-flex shrink-0 rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[rgb(var(--speedgoat-blue))]">
                                  x{module.quantity}
                                </span>
                              </div>
                            ))}
                            {recommendedModules.length > visibleRecommendedModules.length ? (
                              <p className="text-[12px] text-slate-600">
                                +{recommendedModules.length - visibleRecommendedModules.length} more recommended module
                                {recommendedModules.length - visibleRecommendedModules.length === 1 ? '' : 's'}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 min-h-[150px] text-[12px] leading-relaxed text-slate-500">
                            Add I/O requirements on the left to see suggested hardware modules.
                          </p>
                        )}
                      </div>

                      {activeMachine?.id === 'performance' && proposalPreview && previewMachineContext ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600">Performance slot preview</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                            Compact visual placement of the currently suggested I/O modules for the Performance machine.
                          </p>
                          <div className="mt-2">
                            <MachineSlotMapImage
                              machine={previewMachineContext}
                              modules={proposalPreview.recommendedModules}
                              rowDiffs={proposalPreview.rowDiffs}
                              showDetails={false}
                            />
                          </div>
                        </div>
                      ) : null}

                      {proposalPreview?.unresolved.length ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-amber-800">Unresolved requirements</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                            {proposalPreview.unresolved.length} requirement
                            {proposalPreview.unresolved.length === 1 ? '' : 's'} could not be mapped cleanly to hardware.
                          </p>
                        </div>
                      ) : null}

                      <div className="divide-y divide-slate-100 text-sm">
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-slate-600">Configured signals</span>
                          <span className="font-semibold text-slate-900">{configuratorSummary.totalSignals}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-slate-600">Configured rows</span>
                          <span className="font-semibold text-slate-900">{configuratorSummary.rowCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-slate-600">Timing proxy</span>
                          <span className="font-semibold text-slate-900">{selectedPerformance.title}</span>
                        </div>
                      </div>

                      {configuredCategoryEntries.length > 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Configured categories</p>
                          <div className="mt-2 space-y-1.5">
                            {configuredCategoryEntries.map(([category, count]) => (
                              <div key={category} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-600">{category}</span>
                                <span className="font-semibold text-slate-900">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

              </div>
            </SectionCard>

            <div id="contact-section" className="scroll-mt-28">
              <CompactCard className={cn(PANEL_CLASS, 'p-4 md:p-5')}>
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Let us help you</p>
                  <h2 className="mt-1.5 text-lg font-semibold text-slate-900 md:text-xl">
                    Find the right solution for your project
                  </h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-[13px] font-semibold text-slate-900">Request configuration example</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                        Get a proposal for a real-time target machine configured to your needs.
                      </p>
                      <CompactButton type="button" className="mt-3" onClick={openAdvancedConfigurator}>
                        Request example
                      </CompactButton>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-[13px] font-semibold text-slate-900">Review system choice</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                        Jump back to the system recommendation and refine the application context.
                      </p>
                      <CompactButton type="button" variant="ghost" className="mt-3" onClick={() => scrollToSection('systems-section')}>
                        Review
                      </CompactButton>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-[13px] font-semibold text-slate-900">Have questions?</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                        Talk to our experts about your project and application requirements.
                      </p>
                      <CompactButton type="button" variant="ghost" className="mt-3" onClick={() => scrollToSection('contact-section')}>
                        Contact us
                      </CompactButton>
                    </div>
                  </div>
                </div>
              </CompactCard>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
