'use client'

import ConfiguratorV3 from '@/components/ConfiguratorV3'
import ConfiguratorWIP from '@/components/ConfiguratorWIP'
import FloatingBottomBar from '@/components/configurator/FloatingBottomBar'
import MachineDropdown from '@/components/configurator/MachineDropdown'
import MachineSlotMapImage from '@/components/MachineSlotMapImage'
import SolutionProposal from '@/components/SolutionProposal'
import dynamic from 'next/dynamic'
import { CompactButton, CompactCard, CompactChip, CompactField, CompactTooltip } from '@/components/ui/compact'
import type { SignalRow } from '@/components/configurator/useConfigurator'

const DecisionFlowModal = dynamic(() => import('@/components/DecisionFlowModal'), { ssr: false })
import type { ClosedLoopRate, OptimizationProfile, ProposalGenerateRequest, ProposalGenerateResponse, RequirementRow } from '@/components/configurator/proposalTypes'
import { simulateProposal } from '@/lib/proposal/simulator'
import { buildLiveFlowExample } from '@/components/configurator/liveFlowExample'
import type { StarterRow } from '@/components/configurator/industries'
import { cn } from '@/lib/cn'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'

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

const WORKFLOW_LINK_CLASS =
  'text-[rgb(var(--speedgoat-blue))] underline decoration-dotted underline-offset-2 hover:decoration-solid'

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
  const [configuratorSummary, setConfiguratorSummary] = useState<ConfiguratorSummary>(EMPTY_SUMMARY)
  const [requirementsRows, setRequirementsRows] = useState<RequirementRow[]>([])
  const [proposalStatus, setProposalStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [proposalResult, setProposalResult] = useState<ProposalGenerateResponse | null>(null)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [proposalStale, setProposalStale] = useState(false)
  const [showDecisionFlow, setShowDecisionFlow] = useState(false)
  const [optimizationProfile, setOptimizationProfile] = useState<OptimizationProfile>('balanced')
  const [configTransferStatus, setConfigTransferStatus] = useState<ConfigTransferStatus>(null)
  const [showDevFpga, setShowDevFpga] = useState(false)
  const loadTemplateRef = useRef<((rows: StarterRow[]) => void) | null>(null)
  const configImportInputRef = useRef<HTMLInputElement | null>(null)
  const proposalSectionRef = useRef<HTMLDivElement | null>(null)
  const lastAutoScrolledProposalIdRef = useRef<string | null>(null)
  const lastGenerateSourceRef = useRef<'manual' | 'auto'>('manual')
  const [signalRowsSnapshot, setSignalRowsSnapshot] = useState<Record<string, Record<string, SignalRow[]>>>({})
  const [closedLoopRate, setClosedLoopRate] = useState<ClosedLoopRate>('10k')

  const selectedMachine = MACHINE_OPTIONS.find((m) => m.id === selectedMachineId) ?? MACHINE_OPTIONS[0]
  const isWipMode = configuratorVariant === 'wip'
  const selectedClosedLoopRate =
    CLOSED_LOOP_RATE_OPTIONS.find((option) => option.value === closedLoopRate) ?? CLOSED_LOOP_RATE_OPTIONS[0]

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
    setRequirementsRows([])
    setProposalStatus('idle')
    setProposalResult(null)
    setProposalError(null)
    setProposalStale(false)
  }, [])

  const handleConfiguratorVariantChange = useCallback(
    (nextVariant: ConfiguratorVariant) => {
      if (nextVariant === configuratorVariant) return
      setConfiguratorVariant(nextVariant)
      setConfiguratorSummary(EMPTY_SUMMARY)
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

  const handleLoadTemplateRegister = useCallback((fn: (rows: StarterRow[]) => void) => {
    loadTemplateRef.current = fn
  }, [])

  const handleRequirementsChange = useCallback((payload: { rows: RequirementRow[] }) => {
    setRequirementsRows(payload.rows)
    if (payload.rows.length === 0) {
      setProposalStatus('idle')
      setProposalResult(null)
      setProposalStale(false)
    }
    setProposalError(null)
  }, [])

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

  const handleOpenConfigurationFile = useCallback(() => {
    if (!loadTemplateRef.current) {
      setConfigTransferStatus({
        type: 'error',
        message: 'Configuration loading is not available in the current view.',
      })
      return
    }
    if (!configImportInputRef.current) return
    configImportInputRef.current.value = ''
    configImportInputRef.current.click()
  }, [])

  const handleImportConfiguration = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Invalid configuration file format.')
        }

        const config = parsed as Record<string, unknown>
        const rawRows = Array.isArray(config.requirements)
          ? config.requirements
          : Array.isArray(config.rows)
          ? config.rows
          : null

        if (!rawRows) {
          throw new Error('No requirements array found in the configuration file.')
        }

        const starterRows: StarterRow[] = rawRows
          .map((raw) => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
            const row = raw as Record<string, unknown>
            if (typeof row.categoryId !== 'string' || typeof row.subId !== 'string') return null

            const quantity =
              typeof row.quantity === 'number'
                ? row.quantity
                : typeof row.quantity === 'string'
                ? Number.parseInt(row.quantity, 10)
                : NaN
            if (!Number.isFinite(quantity) || quantity <= 0) return null

            const rawSpecs = row.specs
            const specs: Record<string, string> = {}
            if (rawSpecs && typeof rawSpecs === 'object' && !Array.isArray(rawSpecs)) {
              Object.entries(rawSpecs as Record<string, unknown>).forEach(([key, value]) => {
                if (typeof value === 'string' && value.length > 0) {
                  specs[key] = value
                }
              })
            }

            return {
              categoryId: row.categoryId,
              subId: row.subId,
              quantity,
              specs,
            } satisfies StarterRow
          })
          .filter((row): row is StarterRow => Boolean(row))

        if (starterRows.length === 0) {
          throw new Error('No valid rows were found in the configuration file.')
        }

        const machineRecord =
          config.machine && typeof config.machine === 'object' && !Array.isArray(config.machine)
            ? (config.machine as Record<string, unknown>)
            : null
        const importedMachineId =
          typeof config.machineId === 'string'
            ? config.machineId
            : machineRecord && typeof machineRecord.id === 'string'
            ? machineRecord.id
            : null
        if (importedMachineId && MACHINE_OPTIONS.some((machine) => machine.id === importedMachineId)) {
          setSelectedMachineId(importedMachineId)
        }

        const loader = loadTemplateRef.current
        if (!loader) {
          throw new Error('Loader is not available for the current configurator.')
        }

        resetProposalState()
        loader(starterRows)
        setConfigTransferStatus({ type: 'success', message: `Loaded ${starterRows.length} row(s) from ${file.name}.` })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load configuration JSON.'
        setConfigTransferStatus({ type: 'error', message })
      } finally {
        event.target.value = ''
      }
    },
    [resetProposalState]
  )

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
        closedLoopRate,
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
      closedLoopRate,
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
    const onScroll = () => setIsScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
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

  return (
    <>
      <div className="bg-[rgb(var(--speedgoat-blue))] py-1.5 text-center text-[11px] text-white">
        <p>
          Featured Event: <strong>Embedded World 2026</strong> | March 10-12, Nuremberg, Germany
        </p>
      </div>

      <header
        className={cn(
          'sticky top-0 z-50 border-b transition',
          isScrolled
            ? 'border-slate-200 bg-white/95 shadow-sm backdrop-blur'
            : 'border-transparent bg-[rgb(var(--speedgoat-blue))] shadow-none'
        )}
      >
        <div className="mx-auto w-full max-w-[1520px] px-4 md:px-8 lg:px-12">
          <div className="flex items-center justify-between py-3 md:py-4">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-md)] text-xs font-bold transition',
                  isScrolled
                    ? 'bg-[rgb(var(--speedgoat-blue))] text-white'
                    : 'bg-white text-[rgb(var(--speedgoat-blue))]'
                )}
              >
                SG
              </div>
              <div>
                <p className={cn('text-base font-bold', isScrolled ? 'text-slate-900' : 'text-white')}>Speedgoat</p>
                <p className={cn('text-[11px]', isScrolled ? 'text-slate-500' : 'text-white/75')}>
                  Real-Time Testing
                </p>
              </div>
            </div>

            <nav
              className={cn(
                'hidden items-center gap-4 text-[13px] font-semibold lg:flex',
                isScrolled ? 'text-slate-700' : 'text-white/90'
              )}
            >
              <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                Testing Workflows
              </a>
              <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                Test Systems
              </a>
              <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                Industries
              </a>
              <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                Resources
              </a>
              <a href="#" className="transition hover:text-[rgb(var(--speedgoat-blue))]">
                Company
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'hidden items-center gap-1.5 text-[11px] font-semibold md:flex',
                  isScrolled ? 'text-slate-600' : 'text-white/80'
                )}
              >
                <button className={cn('transition', isScrolled ? 'hover:text-slate-900' : 'hover:text-white')}>
                  English
                </button>
                <span className={isScrolled ? 'text-slate-300' : 'text-white/50'}>|</span>
                <button className={cn('transition', isScrolled ? 'hover:text-slate-900' : 'hover:text-white')}>
                  中文
                </button>
              </div>

              <CompactButton
                type="button"
                variant="secondary"
                className={cn(
                  'hidden md:inline-flex',
                  isScrolled
                    ? 'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] text-white hover:bg-blue-700'
                    : 'border-white/80 bg-white/10 text-white hover:bg-white/20'
                )}
              >
                Customer Portal
              </CompactButton>

              <CompactButton
                type="button"
                variant="ghost"
                onClick={() => setMenuOpen(!menuOpen)}
                className={cn(
                  'lg:hidden',
                  isScrolled
                    ? 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'border border-white/50 text-white hover:bg-white/10'
                )}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </CompactButton>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-screen pb-14">
        <section className="bg-gradient-to-b from-slate-50 to-white px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-[1520px]">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <a href="#" className="hover:text-[rgb(var(--speedgoat-blue))]">
                Home
              </a>
              <span>/</span>
              <a href="#" className="hover:text-[rgb(var(--speedgoat-blue))]">
                Test Systems
              </a>
              <span>/</span>
              <span className="font-semibold text-slate-900">Solution Configurator</span>
            </div>

            <div className="mb-7 max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--speedgoat-accent))]/30 bg-[rgb(var(--speedgoat-accent))]/5 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--speedgoat-accent))]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--speedgoat-accent))]">
                  Interactive Tool
                </span>
              </div>
              <h1 className="mb-2 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
                Configure a Real-Time Test System
              </h1>
              <p className="text-sm text-slate-600 md:text-base">
                Describe what you need to test. We map your use case to the right I/O and system architecture.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Certified Partner With
                </span>
                <div className="flex items-center gap-2">
                  <CompactChip className="rounded-[var(--ui-radius-md)] bg-white px-2.5 py-1 text-xs font-bold text-[#e26310]">
                    MathWorks
                  </CompactChip>
                  <CompactChip className="rounded-[var(--ui-radius-md)] bg-white px-2.5 py-1 text-xs font-bold text-[#d32f2f]">
                    Simulink®
                  </CompactChip>
                </div>
              </div>
            </div>

            {/* ── TOP BANNER: Machine + Closed-Loop Rate + Import ── */}
            <CompactCard className="border-slate-200 bg-white px-5 py-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
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
                  <label
                    htmlFor="closed-loop-rate"
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
                  </label>
                  <div className="flex items-center gap-1">
                    <CompactField
                      as="select"
                      id="closed-loop-rate"
                      value={closedLoopRate}
                      onChange={(event) => setClosedLoopRate(event.target.value as ClosedLoopRate)}
                      className="h-9 text-sm"
                    >
                      {CLOSED_LOOP_RATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </CompactField>
                    <CompactTooltip
                      className="ml-0 shrink-0"
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
                  <p className="text-xs text-slate-600">{selectedClosedLoopRate.summary}</p>
                </div>
              </div>
              {/* ── Version + Import ── */}
              <div className="flex shrink-0 flex-col items-end gap-2">
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
                <CompactButton
                  type="button"
                  variant="ghost"
                  onClick={handleOpenConfigurationFile}
                  className="h-7 w-auto whitespace-nowrap border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-3-3m3 3l3-3M4 20h16" />
                  </svg>
                  Import
                </CompactButton>
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
                {configuratorVariant === 'wip' ? (
                  <ConfiguratorWIP
                    key="wip"
                    onSummaryChange={setConfiguratorSummary}
                    onRequirementsChange={handleRequirementsChange}
                    onLoadTemplate={handleLoadTemplateRegister}
                    onSignalRowsChange={setSignalRowsSnapshot}
                    closedLoopRate={closedLoopRate}
                  />
                ) : (
                  <ConfiguratorV3
                    key="v3"
                    onSummaryChange={setConfiguratorSummary}
                    onRequirementsChange={handleRequirementsChange}
                    onLoadTemplate={handleLoadTemplateRegister}
                    onSignalRowsChange={setSignalRowsSnapshot}
                    closedLoopRate={closedLoopRate}
                  />
                )}

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
                <CompactCard className="border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
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
                </CompactCard>

                {/* ── Configuration Summary ── */}
                <CompactCard className="border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
                  <h3 className="text-sm font-semibold text-slate-900">Configuration</h3>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Closed-loop rate</span>
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
                </CompactCard>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-5">
          <div className="mx-auto max-w-[1520px] px-4 md:px-8">
            <div className="grid gap-3 md:grid-cols-3">
              <CompactCard className="text-center">
                <p className="text-xl font-bold text-[rgb(var(--speedgoat-blue))]">120+</p>
                <p className="mt-0.5 text-xs text-slate-600">I/O Module Types</p>
              </CompactCard>
              <CompactCard className="text-center">
                <p className="text-xl font-bold text-[rgb(var(--speedgoat-blue))]">24</p>
                <p className="mt-0.5 text-xs text-slate-600">Target Machines</p>
              </CompactCard>
              <CompactCard className="text-center">
                <p className="text-xl font-bold text-[rgb(var(--speedgoat-blue))]">6-8 weeks</p>
                <p className="mt-0.5 text-xs text-slate-600">Typical Lead Time</p>
              </CompactCard>
            </div>
          </div>
        </section>
      </main>

      <input
        ref={configImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportConfiguration}
      />

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
