'use client'

import ConfiguratorV3 from '@/components/ConfiguratorV3'
import ConfiguratorWIP from '@/components/ConfiguratorWIP'
import { getUseCasePreset } from '@/components/configurator/useCasePresets'
import FloatingBottomBar from '@/components/configurator/FloatingBottomBar'
import MachineDropdown from '@/components/configurator/MachineDropdown'
import MachineSlotMapImage from '@/components/MachineSlotMapImage'
import SolutionProposal from '@/components/SolutionProposal'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { CompactButton, CompactCard, CompactChip, CompactTooltip } from '@/components/ui/compact'
import type { SignalRow } from '@/components/configurator/useConfigurator'
import Link from 'next/link'

const DecisionFlowModal = dynamic(() => import('@/components/DecisionFlowModal'), { ssr: false })
import type { ClosedLoopRate, OptimizationProfile, ProposalGenerateRequest, ProposalGenerateResponse, RequirementRow } from '@/components/configurator/proposalTypes'
import { simulateProposal } from '@/lib/proposal/simulator'
import { buildLiveFlowExample } from '@/components/configurator/liveFlowExample'
import type { StarterRow } from '@/components/configurator/industries'
import { cn } from '@/lib/cn'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** basePath for GitHub Pages sub-path deploys; next/image does NOT auto-prepend in static-export mode */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

const MACHINE_OPTIONS = [
  {
    id: 'performance',
    name: 'Performance',
    keywords: 'High performance • Maximum expansion',
    blurb: 'For office and lab use.',
    image: `${BASE_PATH}/assets/machine-performance.png`,
    maxSlots: 7,
    maxSlotsExpanded: 42,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    keywords: 'Scalable desktop • Controller testing',
    blurb: 'Control design and validation.',
    image: `${BASE_PATH}/assets/machine-pulse.png`,
    maxSlots: 3,
    maxSlotsExpanded: 8,
  },
  {
    id: 'mobile',
    name: 'Mobile',
    keywords: 'Rugged • Field testing',
    blurb: 'Withstands shock and vibration.',
    image: `${BASE_PATH}/assets/machine-mobile.png`,
    maxSlots: 5,
    maxSlotsExpanded: 14,
  },
  {
    id: 'baseline',
    name: 'Baseline',
    keywords: 'Entry level • Compact',
    blurb: 'For office to in-vehicle use.',
    image: `${BASE_PATH}/assets/machine-baseline.png`,
    maxSlots: 4,
    maxSlotsExpanded: 6,
    variants: [
      { suffix: 'S', maxSlots: 4 },
      { suffix: 'M', maxSlots: 6 },
    ],
  },
  {
    id: 'unit',
    name: 'Unit',
    keywords: 'Small form factor • Flexible',
    blurb: 'For field and confined spaces.',
    image: `${BASE_PATH}/assets/machine-unit.png`,
    maxSlots: 1,
    maxSlotsExpanded: 1,
  },
  {
    id: 'rack',
    name: 'Tailored Rack-System',
    keywords: 'Modular rack • Customizable',
    blurb: 'Built for advanced setups.',
    image: `${BASE_PATH}/assets/machine-rack.svg`,
    maxSlots: 99,
    maxSlotsExpanded: 99,
  },
]

const CLOSED_LOOP_RATE_OPTIONS: { value: ClosedLoopRate; label: string; summary: string }[] = [
  {
    value: '10k',
    label: 'Up to 10 kHz',
    summary: 'Most control and system applications.',
  },
  {
    value: '100k',
    label: 'Up to 100 kHz',
    summary: 'Motor and power electronics (RCP/HIL), CPU- or FPGA-based execution.',
  },
  {
    value: 'above100k',
    label: 'Above 100 kHz',
    summary: 'Very high-speed power electronics (RCP/HIL), typically FPGA-based execution.',
  },
]

const CLOSED_LOOP_RATE_ORDER: ClosedLoopRate[] = ['10k', '100k', 'above100k']

type ClosedLoopRateMap<T> = Partial<Record<ClosedLoopRate, T>>

const HEADER_NAV_ITEMS = [
  { label: 'Testing Workflows', hasMenu: true },
  { label: 'Test Systems', hasMenu: true },
  { label: 'Industries', hasMenu: true },
  { label: 'Resources', hasMenu: true },
  { label: 'Company', hasMenu: true },
  { label: 'Contact', hasMenu: false },
] as const

const WORKFLOW_LINK_CLASS =
  'text-[rgb(var(--speedgoat-blue))] underline decoration-dotted underline-offset-2 hover:decoration-solid'

const GLASS_CARD_CLASS =
  'relative overflow-visible border-slate-200 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.08)]'

const GLASS_CARD_BG =
  'pointer-events-none absolute inset-0 rounded-[var(--ui-radius-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(249,251,253,0.98))]'

type ConfiguratorSummary = {
  totalSignals: number
  rowCount: number
  categoryTotals: Record<string, number>
}

type PersistedConfiguration = {
  schemaVersion: '1.0.0'
  savedAt: string
  appVersion: string
  machine: {
    id: string
    name: string
  }
  requirements: Array<{
    categoryId: string
    subId: string
    quantity: number
    specs: Record<string, string>
  }>
}

type ConfigTransferStatus = {
  type: 'success' | 'error'
  message: string
} | null

type PersistedDecisionSnapshot = {
  schemaVersion: '1.0.0'
  savedAt: string
  appVersion: string
  machine: {
    id: string
    name: string
    maxSlots: number
    maxSlotsExpanded: number
  }
  summary: ConfiguratorSummary
  requirements: RequirementRow[]
  proposalStatus: 'idle' | 'loading' | 'success' | 'error'
  proposalStale: boolean
  proposal: ProposalGenerateResponse | null
  decisionFlowExample: ReturnType<typeof buildLiveFlowExample> | undefined
}

const EMPTY_SUMMARY: ConfiguratorSummary = {
  totalSignals: 0,
  rowCount: 0,
  categoryTotals: {},
}

type ConfiguratorVariant = 'v3' | 'wip'

function normalizeClosedLoopRateSelection(rates: ClosedLoopRate[]): ClosedLoopRate[] {
  const deduped = Array.from(new Set(rates)).filter((rate): rate is ClosedLoopRate =>
    CLOSED_LOOP_RATE_ORDER.includes(rate)
  )

  if (deduped.length === 0) return ['10k']

  return [...deduped].sort(
    (left, right) =>
      CLOSED_LOOP_RATE_ORDER.indexOf(left) - CLOSED_LOOP_RATE_ORDER.indexOf(right)
  )
}

function getHighestClosedLoopRate(rates: ClosedLoopRate[]): ClosedLoopRate {
  const normalized = normalizeClosedLoopRateSelection(rates)
  return normalized[normalized.length - 1]
}

function mergeConfiguratorSummaries(
  summariesByRate: ClosedLoopRateMap<ConfiguratorSummary>,
  selectedRates: ClosedLoopRate[]
): ConfiguratorSummary {
  return selectedRates.reduce<ConfiguratorSummary>(
    (acc, rate) => {
      const summary = summariesByRate[rate]
      if (!summary) return acc

      acc.totalSignals += summary.totalSignals
      acc.rowCount += summary.rowCount

      for (const [category, count] of Object.entries(summary.categoryTotals)) {
        acc.categoryTotals[category] = (acc.categoryTotals[category] ?? 0) + count
      }

      return acc
    },
    {
      totalSignals: 0,
      rowCount: 0,
      categoryTotals: {},
    }
  )
}

export default function Home() {
  const isDevOptimizationControls = process.env.NODE_ENV !== 'production'
  const isFpgaDevToggleEnabled =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_FPGA_DEV === '1'
  const [configuratorVariant, setConfiguratorVariant] = useState<ConfiguratorVariant>(() => {
    if (typeof window === 'undefined') return 'wip'
    const stored = window.localStorage.getItem('sg.configurator.variant')
    return stored === 'v3' || stored === 'wip' ? stored : 'wip'
  })
  const activeVersion = configuratorVariant
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState<string>(MACHINE_OPTIONS[0].id)
  const [selectedClosedLoopRates, setSelectedClosedLoopRates] = useState<ClosedLoopRate[]>(['10k'])
  const [configuratorSummariesByRate, setConfiguratorSummariesByRate] = useState<ClosedLoopRateMap<ConfiguratorSummary>>({})
  const [requirementsRowsByRate, setRequirementsRowsByRate] = useState<ClosedLoopRateMap<RequirementRow[]>>({})
  const [proposalStatus, setProposalStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [proposalResult, setProposalResult] = useState<ProposalGenerateResponse | null>(null)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [proposalStale, setProposalStale] = useState(false)
  const [showDecisionFlow, setShowDecisionFlow] = useState(false)
  const [optimizationProfile, setOptimizationProfile] = useState<OptimizationProfile>('balanced')
  const [configTransferStatus, setConfigTransferStatus] = useState<ConfigTransferStatus>(null)
  const [showDevFpga, setShowDevFpga] = useState(false)
  const loadTemplateRefs = useRef<ClosedLoopRateMap<(rows: StarterRow[]) => void>>({})
  const proposalSectionRef = useRef<HTMLDivElement | null>(null)
  const lastAutoScrolledProposalIdRef = useRef<string | null>(null)
  const lastGenerateSourceRef = useRef<'manual' | 'auto'>('manual')
  const appliedUseCaseRef = useRef<string | null>(null)
  const [activeUseCaseId, setActiveUseCaseId] = useState<string | null>(null)
  const [requestedUseCaseId, setRequestedUseCaseId] = useState<string | null>(null)

  const selectedMachine = MACHINE_OPTIONS.find((m) => m.id === selectedMachineId) ?? MACHINE_OPTIONS[0]
  const isWipMode = configuratorVariant === 'wip'
  const effectiveClosedLoopRate = useMemo(
    () => getHighestClosedLoopRate(selectedClosedLoopRates),
    [selectedClosedLoopRates]
  )
  const selectedClosedLoopRate =
    CLOSED_LOOP_RATE_OPTIONS.find((option) => option.value === effectiveClosedLoopRate) ?? CLOSED_LOOP_RATE_OPTIONS[0]
  const configuratorSummary = useMemo(
    () => mergeConfiguratorSummaries(configuratorSummariesByRate, selectedClosedLoopRates),
    [configuratorSummariesByRate, selectedClosedLoopRates]
  )
  const requirementsRows = useMemo(
    () => selectedClosedLoopRates.flatMap((rate) => requirementsRowsByRate[rate] ?? []),
    [requirementsRowsByRate, selectedClosedLoopRates]
  )
  const activeUseCasePreset = useMemo(() => getUseCasePreset(activeUseCaseId), [activeUseCaseId])

  // Build live Decision Flow example from current configurator rows (on modal open)
  const liveFlowExample = useMemo(() => {
    if (!showDecisionFlow || requirementsRows.length === 0) return undefined
    return buildLiveFlowExample(
      requirementsRows,
      selectedMachine.id,
      selectedMachine.name,
      selectedMachine.maxSlots,
      selectedMachine.maxSlotsExpanded,
      isDevOptimizationControls ? optimizationProfile : undefined,
    )
  }, [showDecisionFlow, requirementsRows, selectedMachine, isDevOptimizationControls, optimizationProfile])

  const coreSignalTotal =
    (configuratorSummary.categoryTotals['Analog'] || 0) +
    (configuratorSummary.categoryTotals['Digital'] || 0) +
    (configuratorSummary.categoryTotals['Communication'] || 0) +
    (configuratorSummary.categoryTotals['Motion & Position'] || 0)

  const hasMinimumInputs = coreSignalTotal > 0
  const missingItems: string[] = []
  if (!hasMinimumInputs) missingItems.push('Add at least one I/O variant')
  const canGenerateProposal = missingItems.length === 0
  const isGenerating = proposalStatus === 'loading'
  const isSuccess = proposalStatus === 'success'
  const generateButtonLabel = isGenerating
    ? 'Generating...'
    : isSuccess && !proposalStale
    ? '✓ Proposal Generated'
    : proposalStale
    ? '↻ Regenerate Proposal'
    : 'Generate System Proposal'

  const resetProposalState = useCallback(() => {
    setConfiguratorSummariesByRate({})
    setRequirementsRowsByRate({})
    setProposalStatus('idle')
    setProposalResult(null)
    setProposalError(null)
    setProposalStale(false)
  }, [])

  const handleConfiguratorVariantChange = useCallback(
    (nextVariant: ConfiguratorVariant) => {
      if (nextVariant === configuratorVariant) return
      setConfiguratorVariant(nextVariant)
      setConfigTransferStatus(null)
      resetProposalState()
    },
    [configuratorVariant, resetProposalState]
  )

  const handleMachineSelect = (machineId: string) => {
    if (machineId === selectedMachineId) return
    setSelectedMachineId(machineId)
    if (!canGenerateProposal) {
      setProposalStatus('idle')
      setProposalResult(null)
      setProposalStale(false)
    }
    setProposalError(null)
  }

  const handleLoadTemplateRegister = useCallback((rate: ClosedLoopRate, fn: (rows: StarterRow[]) => void) => {
    loadTemplateRefs.current[rate] = fn
  }, [])

  const handleClosedLoopRateToggle = useCallback((rate: ClosedLoopRate) => {
    setSelectedClosedLoopRates((prev) => {
      const isSelected = prev.includes(rate)
      if (isSelected && prev.length === 1) return prev
      return normalizeClosedLoopRateSelection(
        isSelected ? prev.filter((item) => item !== rate) : [...prev, rate]
      )
    })
  }, [])

  const selectedClosedLoopRateLabels = useMemo(
    () =>
      selectedClosedLoopRates.map(
        (rate) => CLOSED_LOOP_RATE_OPTIONS.find((option) => option.value === rate)?.label ?? rate
      ),
    [selectedClosedLoopRates]
  )
  const loadTemplateRegistrars = useMemo<
    ClosedLoopRateMap<(fn: (rows: StarterRow[]) => void) => void>
  >(
    () =>
      Object.fromEntries(
        selectedClosedLoopRates.map((rate) => [
          rate,
          (fn: (rows: StarterRow[]) => void) => handleLoadTemplateRegister(rate, fn),
        ])
      ) as ClosedLoopRateMap<(fn: (rows: StarterRow[]) => void) => void>,
    [handleLoadTemplateRegister, selectedClosedLoopRates]
  )
  const summaryChangeHandlers = useMemo<ClosedLoopRateMap<(summary: ConfiguratorSummary) => void>>(
    () =>
      Object.fromEntries(
        selectedClosedLoopRates.map((rate) => [
          rate,
          (summary: ConfiguratorSummary) =>
            setConfiguratorSummariesByRate((prev) => ({ ...prev, [rate]: summary })),
        ])
      ) as ClosedLoopRateMap<(summary: ConfiguratorSummary) => void>,
    [selectedClosedLoopRates]
  )
  const requirementsChangeHandlers = useMemo<
    ClosedLoopRateMap<(payload: { rows: RequirementRow[] }) => void>
  >(
    () =>
      Object.fromEntries(
        selectedClosedLoopRates.map((rate) => [
          rate,
          ({ rows }: { rows: RequirementRow[] }) => {
            setRequirementsRowsByRate((prev) => ({ ...prev, [rate]: rows }))
            setProposalError(null)
          },
        ])
      ) as ClosedLoopRateMap<(payload: { rows: RequirementRow[] }) => void>,
    [selectedClosedLoopRates]
  )

  const handleSaveConfiguration = useCallback(() => {
    if (requirementsRows.length === 0) {
      setConfigTransferStatus({ type: 'error', message: 'Add at least one configured row before saving.' })
      return
    }

    const payload: PersistedConfiguration = {
      schemaVersion: '1.0.0',
      savedAt: new Date().toISOString(),
      appVersion: activeVersion,
      machine: {
        id: selectedMachine.id,
        name: selectedMachine.name,
      },
      requirements: requirementsRows.map((row) => ({
        categoryId: row.categoryId,
        subId: row.subId,
        quantity: row.quantity,
        specs: row.specs,
      })),
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `speedgoat-config-${activeVersion}-${stamp}.json`
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    setConfigTransferStatus({ type: 'success', message: `Saved ${requirementsRows.length} row(s) to ${fileName}.` })
  }, [activeVersion, requirementsRows, selectedMachine.id, selectedMachine.name])

  const handleDownloadDecisionJson = useCallback(() => {
    if (requirementsRows.length === 0) {
      setConfigTransferStatus({ type: 'error', message: 'No decision data to export yet. Add at least one configured row.' })
      return
    }

    const decisionFlowExample = buildLiveFlowExample(
      requirementsRows,
      selectedMachine.id,
      selectedMachine.name,
      selectedMachine.maxSlots,
      selectedMachine.maxSlotsExpanded,
    )

    const snapshot: PersistedDecisionSnapshot = {
      schemaVersion: '1.0.0',
      savedAt: new Date().toISOString(),
      appVersion: activeVersion,
      machine: {
        id: selectedMachine.id,
        name: selectedMachine.name,
        maxSlots: selectedMachine.maxSlots,
        maxSlotsExpanded: selectedMachine.maxSlotsExpanded,
      },
      summary: configuratorSummary,
      requirements: requirementsRows,
      proposalStatus,
      proposalStale,
      proposal: proposalResult,
      decisionFlowExample,
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `speedgoat-decision-${activeVersion}-${stamp}.json`
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    setConfigTransferStatus({ type: 'success', message: `Saved decision snapshot to ${fileName}.` })
  }, [
    activeVersion,
    configuratorSummary,
    proposalResult,
    proposalStale,
    proposalStatus,
    requirementsRows,
    selectedMachine.id,
    selectedMachine.maxSlots,
    selectedMachine.maxSlotsExpanded,
    selectedMachine.name,
  ])

  const runProposalGeneration = useCallback(
    (source: 'manual' | 'auto') => {
      if (!canGenerateProposal || isGenerating) return

      if (requirementsRows.length === 0) {
        if (source === 'manual') {
          setProposalStatus('error')
          setProposalResult(null)
          setProposalError('No configured I/O rows were found. Add at least one row and try again.')
        } else {
          setProposalStatus('idle')
          setProposalResult(null)
          setProposalError(null)
          setProposalStale(false)
        }
        return
      }

      const payload: ProposalGenerateRequest = {
        machineId: selectedMachine.id,
        machineName: selectedMachine.name,
        version: activeVersion,
        requirements: requirementsRows,
        maxSlots: selectedMachine.maxSlots,
        maxSlotsExpanded: selectedMachine.maxSlotsExpanded,
        ...(isDevOptimizationControls ? { optimizationProfile } : {}),
        closedLoopRate: effectiveClosedLoopRate,
      }

      lastGenerateSourceRef.current = source
      if (source === 'manual') {
        setProposalStatus('loading')
      }
      setProposalStale(false)
      setProposalError(null)

      try {
        // Run proposal simulation client-side (no API route needed for static export)
        const data = simulateProposal(payload)

        setProposalResult(data as ProposalGenerateResponse)
        setProposalStatus('success')
      } catch (error) {
        setProposalStatus('error')
        setProposalResult(null)
        setProposalError(error instanceof Error ? error.message : 'Failed to generate proposal.')
      }
    },
    [
      activeVersion,
      canGenerateProposal,
      effectiveClosedLoopRate,
      isDevOptimizationControls,
      isGenerating,
      optimizationProfile,
      requirementsRows,
      selectedMachine.id,
      selectedMachine.maxSlots,
      selectedMachine.maxSlotsExpanded,
      selectedMachine.name,
    ]
  )

  const handleGenerateProposal = useCallback(() => {
    runProposalGeneration('manual')
  }, [runProposalGeneration])

  const renderGenerateButton = (className: string) => (
    <CompactButton
      type="button"
      onClick={handleGenerateProposal}
      disabled={!canGenerateProposal || isGenerating}
      variant={canGenerateProposal && !isGenerating ? 'primary' : 'secondary'}
      className={cn(
        className,
        'transition-colors duration-500',
        (!canGenerateProposal || isGenerating) && 'text-slate-400',
        isSuccess && !proposalStale && '!bg-green-600 !border-green-600 !text-white hover:!bg-green-700',
        proposalStale && '!bg-amber-500 !border-amber-500 !text-white hover:!bg-amber-600',
      )}
    >
      {isGenerating && (
        <svg className="mr-1.5 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {generateButtonLabel}
    </CompactButton>
  )

  const renderDecisionFlowButton = (className: string) => (
    <button
      type="button"
      onClick={() => setShowDecisionFlow(true)}
      className={cn(
        className,
        'group relative inline-flex items-center gap-1.5 rounded-lg border border-violet-300/60 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition-all hover:shadow-md hover:from-violet-100 hover:to-fuchsia-100',
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[9px] text-white shadow-inner">⚗</span>
      Decision Logic
      <span className="rounded-full bg-violet-200/70 px-1.5 py-px text-[8px] font-bold uppercase tracking-widest text-violet-600">DEV</span>
    </button>
  )


  useEffect(() => {
    window.localStorage.setItem('sg.configurator.variant', configuratorVariant)
  }, [configuratorVariant])

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 160)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    setRequestedUseCaseId(new URLSearchParams(window.location.search).get('useCase'))
  }, [])

  useEffect(() => {
    if (!canGenerateProposal || requirementsRows.length === 0) {
      setProposalStatus('idle')
      setProposalResult(null)
      setProposalError(null)
      setProposalStale(false)
      return
    }
    const timer = window.setTimeout(() => {
      runProposalGeneration('auto')
    }, 220)
    return () => window.clearTimeout(timer)
  }, [canGenerateProposal, requirementsRows.length, runProposalGeneration])

  useEffect(() => {
    if (proposalStatus !== 'success' || !proposalResult) return
    if (lastGenerateSourceRef.current !== 'manual') return
    if (lastAutoScrolledProposalIdRef.current === proposalResult.proposalId) return

    const section = proposalSectionRef.current
    if (!section) return

    lastAutoScrolledProposalIdRef.current = proposalResult.proposalId

    const rect = section.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const isFullyVisible = rect.top >= 80 && rect.bottom <= viewportHeight
    if (isFullyVisible) return

    const targetTop = Math.max(0, rect.top + window.scrollY - 88)
    window.scrollTo({ top: targetTop, behavior: 'smooth' })
  }, [proposalResult, proposalStatus])

  useEffect(() => {
    const useCaseId = requestedUseCaseId
    if (!useCaseId || appliedUseCaseRef.current === useCaseId) return

    const preset = getUseCasePreset(useCaseId)
    if (!preset) return

    if (!selectedClosedLoopRates.includes(preset.closedLoopRate)) {
      setSelectedClosedLoopRates([preset.closedLoopRate])
      return
    }

    const loader = loadTemplateRefs.current[preset.closedLoopRate]
    if (!loader) return

    appliedUseCaseRef.current = useCaseId
    setSelectedMachineId(preset.machineId)
    setSelectedClosedLoopRates([preset.closedLoopRate])
    setActiveUseCaseId(preset.id)
    resetProposalState()
    loader(preset.starterRows)
    setConfigTransferStatus({
      type: 'success',
      message: `Recommended starting point selected for ${preset.title}.`,
    })
  }, [requestedUseCaseId, resetProposalState, selectedClosedLoopRates])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b transition-all duration-300',
          isScrolled
            ? 'border-slate-200 bg-white shadow-[0_12px_30px_rgba(2,23,48,0.08)]'
            : 'border-white/10 bg-[linear-gradient(180deg,rgba(5,18,36,0.82),rgba(5,18,36,0.46))] backdrop-blur-[2px]'
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
              href="/"
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
                <a
                  key={item.label}
                  href="#"
                  className={cn(
                    'inline-flex items-center gap-1.5 transition',
                    isScrolled ? 'hover:text-[rgb(var(--speedgoat-blue))]' : 'hover:text-white/75'
                  )}
                >
                  <span>{item.label}</span>
                  {item.hasMenu && (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </a>
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
                onClick={() => setMenuOpen(!menuOpen)}
                className={cn(
                  'lg:hidden',
                  isScrolled
                    ? 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'border border-white/30 text-white hover:bg-white/10'
                )}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </CompactButton>
            </div>
          </div>
        </div>

        {menuOpen && (
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
                    {item.hasMenu && (
                      <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="min-h-screen pb-14">
        <section className="relative overflow-hidden px-4 pt-28 md:px-8 md:pt-36">
          <div className="absolute inset-0">
            <Image
              src={selectedMachine.image}
              alt=""
              fill
              priority
              className="scale-105 object-cover object-center opacity-[0.4]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(4,24,47,0.9)_0%,rgba(8,47,93,0.74)_34%,rgba(7,25,47,0.34)_68%,rgba(255,255,255,0)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(72,117,255,0.26),transparent_24%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_24%)]" />
          </div>
          <div className="relative mx-auto flex h-[210px] max-w-[1520px] items-end pb-8 md:h-[260px] md:pb-10">
            <p className="text-[15px] font-semibold text-white/88 md:text-[18px]">Test Systems</p>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 pb-10 pt-20 md:px-8 md:pb-12 md:pt-24">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#e8f0f8_0%,#f2f7fb_34%,#f8fbfd_56%,#ffffff_100%)]" />
          <div className="relative mx-auto max-w-[1520px]">
            <div className="mb-8 max-w-3xl">
              <h1 className="mb-2 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
                Configure a Real-Time Test System
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 md:text-base">
                Describe what you need to test. We map your use case to the right I/O and system architecture.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Certified Partner With
                </span>
                <div className="flex items-center gap-2">
                  <CompactChip className="rounded-[var(--ui-radius-md)] bg-white px-2.5 py-1 text-xs font-bold text-[#e26310] shadow-sm">
                    MathWorks
                  </CompactChip>
                  <CompactChip className="rounded-[var(--ui-radius-md)] bg-white px-2.5 py-1 text-xs font-bold text-[#d32f2f] shadow-sm">
                    Simulink®
                  </CompactChip>
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.618fr)_minmax(320px,1fr)]">
              <CompactCard className={cn(GLASS_CARD_CLASS, 'p-4')}>
                <div className={GLASS_CARD_BG} />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_top_right,rgba(0,105,180,0.08),transparent_68%)]" />
                <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Application Examples</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      Find a recommended starting point for your system
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Explore application examples and start from a recommended system direction. You can still adjust
                      the target machine, performance level, and I/O requirements afterward.
                    </p>
                  </div>
                  <Link
                    href="/industry-use-case"
                    className="inline-flex h-9 items-center justify-center rounded-[var(--ui-radius-md)] border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Explore Applications
                  </Link>
                </div>
              </CompactCard>

              {activeUseCasePreset ? (
                <CompactCard className={cn(GLASS_CARD_CLASS, 'p-4')}>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(241,247,252,0.96))]" />
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(180deg,rgba(0,105,180,0.12),rgba(0,105,180,0))]" />
                  <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[rgb(var(--speedgoat-blue))]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--speedgoat-blue))]">
                      Recommended System Direction
                    </span>
                    <span className="text-xs font-medium text-slate-500">Selected from application examples</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">{activeUseCasePreset.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{activeUseCasePreset.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CompactChip className="bg-white text-slate-700">
                      {MACHINE_OPTIONS.find((machine) => machine.id === activeUseCasePreset.machineId)?.name ?? activeUseCasePreset.machineId}
                    </CompactChip>
                    <CompactChip className="bg-white text-slate-700">
                      {CLOSED_LOOP_RATE_OPTIONS.find((option) => option.value === activeUseCasePreset.closedLoopRate)?.label ?? activeUseCasePreset.closedLoopRate}
                    </CompactChip>
                    {activeUseCasePreset.focusTags.map((tag) => (
                      <CompactChip key={tag} className="bg-white text-slate-700">
                        {tag}
                      </CompactChip>
                    ))}
                  </div>
                  </div>
                </CompactCard>
              ) : (
                <CompactCard className={cn(GLASS_CARD_CLASS, 'p-4')}>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,0.98))]" />
                  <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">How It Works</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Choose application', 'Review system direction', 'Adjust details', 'Get recommendation'].map((step) => (
                      <CompactChip key={step} className="bg-white text-slate-700">
                        {step}
                      </CompactChip>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Start with an application example, review the recommended machine and performance level, then
                    refine the I/O details for your project.
                  </p>
                  </div>
                </CompactCard>
              )}
            </div>

            {/* ── TOP BANNER: Machine + Closed-Loop Rate ── */}
            <CompactCard className={cn(GLASS_CARD_CLASS, 'px-5 py-4')}>
              <div className={GLASS_CARD_BG} />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-56 bg-[radial-gradient(circle_at_top_left,rgba(0,105,180,0.08),transparent_72%)]" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_top_right,rgba(208,78,7,0.08),transparent_72%)]" />
              <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 grid gap-3 lg:grid-cols-[minmax(0,1.618fr)_1px_minmax(0,1fr)] lg:items-center">
                {/* ── Machine selector ── */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Target System</h2>
                  </div>
                  <MachineDropdown
                    machines={MACHINE_OPTIONS}
                    selectedId={selectedMachineId}
                    onSelect={handleMachineSelect}
                  />
                </div>

                {/* ── Divider ── */}
                <div className="hidden h-full min-h-[48px] bg-slate-200 lg:block" />

                {/* ── Closed-Loop Rate ── */}
                <div className="space-y-1.5">
                  <div
                    id="closed-loop-rate-label"
                    className={cn(
                      'text-xs font-semibold tracking-wide text-slate-600',
                      isWipMode ? 'leading-snug' : 'uppercase'
                    )}
                  >
                    {isWipMode ? (
                      <>
                        Fastest closed-loop control rate (
                        <a href="#" className={WORKFLOW_LINK_CLASS}>
                          RCP
                        </a>
                        ) / simulation step size (
                        <a href="#" className={WORKFLOW_LINK_CLASS}>
                          HIL
                        </a>
                        )
                      </>
                    ) : (
                      'Closed-Loop Rate'
                    )}
                  </div>
                  <div className="flex items-start gap-1">
                    <div
                      id="closed-loop-rate"
                      role="group"
                      aria-labelledby="closed-loop-rate-label"
                      className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-3"
                    >
                      {CLOSED_LOOP_RATE_OPTIONS.map((option) => {
                        const isActive = selectedClosedLoopRates.includes(option.value)
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => handleClosedLoopRateToggle(option.value)}
                            className={cn(
                              'rounded-[var(--ui-radius-md)] border px-3 py-2 text-left text-sm font-semibold transition',
                              isActive
                                ? 'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                            )}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                    <CompactTooltip
                      className="mt-2 ml-0 shrink-0"
                      content={
                        isWipMode ? (
                          <div className="space-y-2.5 text-[11px]">
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Definition
                              </p>
                              <p className="leading-relaxed text-slate-700">
                                Defines the fastest closed-loop control rate (RCP) or simulation step size (HIL) used to determine the ideal I/O and test system configuration.
                              </p>
                            </div>

                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Typical ranges
                              </p>
                              <ul className="list-inside list-disc space-y-1 text-slate-700">
                                <li>
                                  <strong className="text-slate-900">Up to 10 kHz</strong> - Most control and system applications.
                                </li>
                                <li>
                                  <strong className="text-slate-900">Up to 100 kHz</strong> - Motor and power electronics (RCP &amp; HIL), CPU- or FPGA-based execution.
                                </li>
                                <li>
                                  <strong className="text-slate-900">Up to the MHz range</strong> - Very high-speed power electronics (RCP &amp; HIL), typically FPGA-based execution.
                                </li>
                              </ul>
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Protocol note
                              </p>
                              <p className="leading-relaxed text-slate-600">
                                Protocol sample rates are defined by their respective specifications.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="w-[320px] space-y-2.5 text-[11px]">
                            <div className="rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50/80 p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Definition
                              </p>
                              <p className="leading-relaxed text-slate-700">
                                Defines the fastest closed-loop control rate (RCP) or simulation step size (HIL) used to determine the ideal I/O and test system configuration.
                              </p>
                            </div>

                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Typical ranges
                              </p>
                              <div className="space-y-1.5">
                                <div className="flex items-start gap-2 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white px-2 py-1.5">
                                  <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    Up to 10 kHz
                                  </span>
                                  <p className="leading-relaxed text-slate-700">Most control and system applications.</p>
                                </div>
                                <div className="flex items-start gap-2 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white px-2 py-1.5">
                                  <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    Up to 100 kHz
                                  </span>
                                  <p className="leading-relaxed text-slate-700">
                                    Motor and power electronics (RCP &amp; HIL), CPU- or FPGA-based execution.
                                  </p>
                                </div>
                                <div className="flex items-start gap-2 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white px-2 py-1.5">
                                  <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    Up to MHz range
                                  </span>
                                  <p className="leading-relaxed text-slate-700">
                                    Very high-speed power electronics (RCP &amp; HIL), typically FPGA-based execution.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50/80 px-2 py-1.5">
                              <p className="text-[10px] leading-relaxed text-slate-600">
                                Protocol sample rates are defined by their respective specifications.
                              </p>
                            </div>
                          </div>
                        )
                      }
                    />
                  </div>
                  <p className="text-xs text-slate-600">
                    {selectedClosedLoopRates.length === 1
                      ? selectedClosedLoopRate.summary
                      : `Configure ${selectedClosedLoopRates.length} performance zones below. The highest selected band sets the overall proposal boundary.`}
                  </p>
                  {selectedClosedLoopRates.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedClosedLoopRateLabels.map((label) => (
                        <CompactChip
                          key={label}
                          className="border border-[rgb(var(--speedgoat-blue))]/15 bg-[rgb(var(--speedgoat-blue))]/5 text-[rgb(var(--speedgoat-blue))]"
                        >
                          {label}
                        </CompactChip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* ── Version + Status ── */}
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Version</span>
                  <div className="inline-flex rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50 p-0.5">
                    <Link
                      href="/v2"
                      className="rounded-[var(--ui-radius-sm)] bg-white px-2 py-0.5 text-xs font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                    >
                      V2
                    </Link>
                    <Link
                      href="/v3"
                      className="rounded-[var(--ui-radius-sm)] px-2 py-0.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                    >
                      V3
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Mode</span>
                  <div className="inline-flex rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleConfiguratorVariantChange('v3')}
                      className={cn(
                        'rounded-[var(--ui-radius-sm)] px-2 py-0.5 text-xs font-semibold transition',
                        configuratorVariant === 'v3'
                          ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Stable V3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfiguratorVariantChange('wip')}
                      className={cn(
                        'rounded-[var(--ui-radius-sm)] px-2 py-0.5 text-xs font-semibold transition',
                        configuratorVariant === 'wip'
                          ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      WIP
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {configTransferStatus && (
                    <span
                      className={cn(
                        'text-xs font-medium',
                        configTransferStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                      )}
                    >
                      {configTransferStatus.message}
                    </span>
                  )}
                </div>
              </div>
              </div>
            </CompactCard>

            {/* ── MAIN CONTENT: 2-col grid (single-col in WIP) ── */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.618fr)_minmax(320px,1fr)] lg:items-start">
              {/* ── LEFT COLUMN ── */}
              <div className="space-y-6">
                {selectedClosedLoopRates.map((rate, index) => {
                  const zoneOption =
                    CLOSED_LOOP_RATE_OPTIONS.find((option) => option.value === rate) ?? CLOSED_LOOP_RATE_OPTIONS[0]

                  return (
                    <CompactCard key={`${configuratorVariant}-${rate}`} className={cn(GLASS_CARD_CLASS, 'p-4')}>
                      <div className={GLASS_CARD_BG} />
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(0,105,180,0.08),rgba(0,105,180,0))]" />
                      <div className="relative space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                              Configuration Zone {index + 1}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">{zoneOption.label}</h3>
                            <p className="mt-1 text-sm text-slate-600">{zoneOption.summary}</p>
                          </div>
                          <CompactChip className="border border-[rgb(var(--speedgoat-blue))]/20 bg-[rgb(var(--speedgoat-blue))]/8 text-[rgb(var(--speedgoat-blue))]">
                            Performance Band
                          </CompactChip>
                        </div>

                        {configuratorVariant === 'wip' ? (
                          <ConfiguratorWIP
                            key={`wip-${rate}`}
                            onSummaryChange={summaryChangeHandlers[rate]}
                            onRequirementsChange={requirementsChangeHandlers[rate]}
                            onLoadTemplate={loadTemplateRegistrars[rate]}
                            closedLoopRate={rate}
                          />
                        ) : (
                          <ConfiguratorV3
                            key={`v3-${rate}`}
                            onSummaryChange={summaryChangeHandlers[rate]}
                            onRequirementsChange={requirementsChangeHandlers[rate]}
                            onLoadTemplate={loadTemplateRegistrars[rate]}
                            closedLoopRate={rate}
                          />
                        )}
                      </div>
                    </CompactCard>
                  )
                })}

                {!isWipMode && proposalStatus === 'error' && proposalError && (
                  <CompactCard className="space-y-2 border border-rose-200 bg-rose-50 p-[var(--ui-pad-2)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-rose-700">{proposalError}</p>
                      {renderGenerateButton('w-full sm:w-auto')}
                    </div>
                  </CompactCard>
                )}

                {!isWipMode && proposalStatus === 'success' && proposalResult && (
                  <div ref={proposalSectionRef} className="relative">
                    {proposalStale && (
                      <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800">
                          Configuration changed — proposal may be outdated.
                        </p>
                        {renderGenerateButton('shrink-0')}
                      </div>
                    )}
                    <div className={proposalStale ? 'opacity-60' : undefined}>
                      <SolutionProposal
                        proposal={proposalResult}
                        machine={selectedMachine}
                        summary={configuratorSummary}
                        onSaveConfiguration={handleSaveConfiguration}
                        devMode={showDevFpga}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
                <CompactCard className={cn(GLASS_CARD_CLASS, 'p-4')}>
                  <div className={GLASS_CARD_BG} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(0,105,180,0.08),rgba(0,105,180,0))]" />
                  <div className="relative">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {selectedMachine.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {selectedMachine.keywords}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedMachine.blurb}
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-slate-500">
                    {selectedMachine.maxSlots} slots · up to {selectedMachine.maxSlotsExpanded} with expansion
                  </p>
                  <div className="mt-3">
                    <MachineSlotMapImage
                      machine={selectedMachine}
                      modules={proposalResult?.recommendedModules ?? []}
                      rowDiffs={proposalResult?.rowDiffs ?? []}
                      showDetails={false}
                    />
                  </div>
                  </div>
                </CompactCard>

                {/* ── Configuration Summary ── */}
                <CompactCard className={cn(GLASS_CARD_CLASS, 'p-4')}>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(246,249,252,0.98))]" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-[linear-gradient(180deg,rgba(0,105,180,0.1),rgba(0,105,180,0))]" />
                  <div className="relative">
                  <h3 className="text-sm font-semibold text-slate-900">Configuration</h3>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Performance zones</span>
                      <span className="font-medium text-slate-800">{selectedClosedLoopRates.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Proposal boundary</span>
                      <span className="font-medium text-slate-800">{selectedClosedLoopRate.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Total signals</span>
                      <span className="font-medium text-slate-800">{configuratorSummary.totalSignals}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Signal types</span>
                      <span className="font-medium text-slate-800">{configuratorSummary.rowCount}</span>
                    </div>
                  </div>
                  {Object.keys(configuratorSummary.categoryTotals).length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-2 space-y-1">
                      {selectedClosedLoopRates.length > 1 && (
                        <div className="pb-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Selected bands
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {selectedClosedLoopRateLabels.map((label) => (
                              <CompactChip
                                key={label}
                                className="border border-slate-200 bg-white/80 text-slate-600"
                              >
                                {label}
                              </CompactChip>
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.entries(configuratorSummary.categoryTotals)
                        .filter(([, count]) => count > 0)
                        .map(([category, count]) => (
                          <div key={category} className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">{category}</span>
                            <span className="font-medium text-slate-700">{count} ch</span>
                          </div>
                      ))}
                    </div>
                  )}
                  </div>
                </CompactCard>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-5">
          <div className="mx-auto max-w-[1520px] px-4 md:px-8">
            <div className="grid gap-3 md:grid-cols-3">
              <CompactCard className={cn(GLASS_CARD_CLASS, 'bg-white/92 text-center shadow-[0_12px_30px_rgba(15,23,42,0.08)]')}>
                <p className="text-xl font-bold text-[rgb(var(--speedgoat-blue))]">120+</p>
                <p className="mt-0.5 text-xs text-slate-600">I/O Module Types</p>
              </CompactCard>
              <CompactCard className={cn(GLASS_CARD_CLASS, 'bg-white/92 text-center shadow-[0_12px_30px_rgba(15,23,42,0.08)]')}>
                <p className="text-xl font-bold text-[rgb(var(--speedgoat-blue))]">24</p>
                <p className="mt-0.5 text-xs text-slate-600">Target Machines</p>
              </CompactCard>
              <CompactCard className={cn(GLASS_CARD_CLASS, 'bg-white/92 text-center shadow-[0_12px_30px_rgba(15,23,42,0.08)]')}>
                <p className="text-xl font-bold text-[rgb(var(--speedgoat-blue))]">6-8 weeks</p>
                <p className="mt-0.5 text-xs text-slate-600">Typical Lead Time</p>
              </CompactCard>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-7">
        <div className="mx-auto max-w-[1520px] px-4 md:px-8">
          <div className="grid gap-5 md:grid-cols-5">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">Testing Workflows</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Hardware-In-The-Loop
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Rapid Control Prototyping
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">Test Systems</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Target Machine Overview
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    I/O Connectivity
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Accessories & Software
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">Industries</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Automotive
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Aerospace
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Energy
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Academia
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">Company</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">Resources</h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Knowledge Center
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Success Stories
                  </a>
                </li>
                <li>
                  <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-4 md:flex-row">
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">© Speedgoat 2026 - All Rights Reserved.</p>
              <div className="inline-flex items-center gap-2">
                {renderDecisionFlowButton('h-6 py-0 text-xs')}
                <CompactButton
                  type="button"
                  variant="ghost"
                  onClick={handleDownloadDecisionJson}
                  disabled={requirementsRows.length === 0}
                  className="h-6 border border-slate-200 bg-slate-100 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  title="Download decision data JSON (DEV)"
                >
                  DEV: Decision JSON
                </CompactButton>
              </div>
              {isFpgaDevToggleEnabled && (
                <button
                  type="button"
                  onClick={() => setShowDevFpga((prev) => !prev)}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs font-semibold transition',
                    showDevFpga
                      ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
                      : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                  title="Toggle FPGA resource planning & software recommendations (DEV)"
                >
                  {showDevFpga ? '▾ FPGA Dev' : '▸ FPGA Dev'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href="#"
                className="text-slate-400 transition hover:text-[rgb(var(--speedgoat-blue))]"
                aria-label="LinkedIn"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-slate-400 transition hover:text-[rgb(var(--speedgoat-blue))]"
                aria-label="YouTube"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <FloatingBottomBar
        totalSignals={configuratorSummary.totalSignals}
        rowCount={configuratorSummary.rowCount}
        machineName={selectedMachine.name}
        categoryTotals={configuratorSummary.categoryTotals}
        canGenerate={canGenerateProposal}
        isGenerating={isGenerating}
        isSuccess={isSuccess}
        isStale={proposalStale}
        onGenerate={handleGenerateProposal}
        generateButtonLabel={generateButtonLabel}
      />

      <DecisionFlowModal
        open={showDecisionFlow}
        onClose={() => setShowDecisionFlow(false)}
        liveExample={liveFlowExample}
      />
    </>
  )
}
