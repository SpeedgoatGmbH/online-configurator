'use client'

import ConfiguratorV1 from '@/components/ConfiguratorV1'
import ConfiguratorV2 from '@/components/ConfiguratorV2'
import ConfiguratorV3 from '@/components/ConfiguratorV3'
import ConfiguratorV3_2 from '@/components/ConfiguratorV3_2'
import ConfiguratorV3_3 from '@/components/ConfiguratorV3_3'
import { CompactButton, CompactCard, CompactChip, CompactSectionLabel } from '@/components/ui/compact'
import { cn } from '@/lib/cn'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const MACHINE_OPTIONS = [
  {
    id: 'performance',
    name: 'Performance',
    keywords: 'High performance • Maximum expansion',
    blurb: 'For office and lab use.',
    image: '/assets/machine-performance.png',
  },
  {
    id: 'pulse',
    name: 'Pulse',
    keywords: 'Scalable desktop • Controller testing',
    blurb: 'Control design and validation.',
    image: '/assets/machine-pulse.png',
  },
  {
    id: 'mobile',
    name: 'Mobile',
    keywords: 'Rugged • Field testing',
    blurb: 'Withstands shock and vibration.',
    image: '/assets/machine-mobile.png',
  },
  {
    id: 'baseline',
    name: 'Baseline',
    keywords: 'Entry level • Compact',
    blurb: 'For office to in-vehicle use.',
    image: '/assets/machine-baseline.png',
  },
  {
    id: 'unit',
    name: 'Unit',
    keywords: 'Small form factor • Flexible',
    blurb: 'For field and confined spaces.',
    image: '/assets/machine-unit.png',
  },
  {
    id: 'rack',
    name: 'Tailored Rack-System',
    keywords: 'Modular rack • Customizable',
    blurb: 'Built for advanced setups.',
    image: '/assets/machine-rack.svg',
  },
]

type ConfiguratorSummary = {
  totalSignals: number
  rowCount: number
  categoryTotals: Record<string, number>
}

const EMPTY_SUMMARY: ConfiguratorSummary = {
  totalSignals: 0,
  rowCount: 0,
  categoryTotals: {},
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeVersion, setActiveVersion] = useState<'v1' | 'v2' | 'v3' | 'v3_2' | 'v3_3'>('v3')
  const [isV1SummaryHovered, setIsV1SummaryHovered] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState<string>(MACHINE_OPTIONS[0].id)
  const [configuratorSummary, setConfiguratorSummary] = useState<ConfiguratorSummary>(EMPTY_SUMMARY)

  const selectedMachine = MACHINE_OPTIONS.find((m) => m.id === selectedMachineId) ?? MACHINE_OPTIONS[0]
  const activeCategories = Object.entries(configuratorSummary.categoryTotals).filter(([, total]) => total > 0)
  const groupLabel = configuratorSummary.rowCount === 1 ? 'group' : 'groups'

  const inferredSystemClass =
    configuratorSummary.totalSignals >= 96
      ? 'Performance class likely required'
      : configuratorSummary.totalSignals >= 32
      ? 'Mid-range class likely sufficient'
      : 'Entry class likely sufficient'

  const coreSignalTotal =
    (configuratorSummary.categoryTotals['Analog'] || 0) +
    (configuratorSummary.categoryTotals['Digital'] || 0) +
    (configuratorSummary.categoryTotals['Communication'] || 0) +
    (configuratorSummary.categoryTotals['Motion & Position'] || 0)

  const hasMinimumInputs = coreSignalTotal > 0
  const missingItems: string[] = []
  if (!hasMinimumInputs) missingItems.push('Add at least one I/O variant')
  const canGenerateProposal = missingItems.length === 0
  const handleVersionChange = (nextVersion: 'v1' | 'v2' | 'v3' | 'v3_2' | 'v3_3') => {
    if (nextVersion === activeVersion) return
    setConfiguratorSummary(EMPTY_SUMMARY)
    setIsV1SummaryHovered(false)
    setActiveVersion(nextVersion)
  }

  const renderSummaryStrip = () => (
    <CompactCard className="space-y-2 p-[var(--ui-pad-2)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CompactSectionLabel>04 Summary</CompactSectionLabel>
          <p className="mt-0.5 text-xs text-slate-600">
            {configuratorSummary.totalSignals} total signals · {configuratorSummary.rowCount} groups
          </p>
          <p className="text-xs font-semibold text-slate-700">{inferredSystemClass}</p>
        </div>

        <CompactButton
          type="button"
          disabled={!canGenerateProposal}
          variant={canGenerateProposal ? 'primary' : 'secondary'}
          className={cn('w-full sm:w-auto', !canGenerateProposal && 'text-slate-400')}
        >
          Generate System Proposal
        </CompactButton>
      </div>

      <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
        <CompactChip>
          Machine: <span className="font-semibold text-slate-900">{selectedMachine.name}</span>
        </CompactChip>
        {activeCategories.map(([label, total]) => (
          <CompactChip key={label}>
            {label}: <span className="font-semibold text-slate-900">{total}</span>
          </CompactChip>
        ))}
        {activeCategories.length === 0 && <p className="text-xs text-slate-500">No I/O groups selected yet.</p>}
      </div>

      {!canGenerateProposal && (
        <div className="rounded-[var(--ui-radius-sm)] border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          {missingItems.join(' · ')}
        </div>
      )}
    </CompactCard>
  )

  const renderV2OverviewPanel = () => (
    <CompactCard className="space-y-2 p-[var(--ui-pad-2)] min-[1200px]:sticky min-[1200px]:top-20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CompactSectionLabel>04 Summary</CompactSectionLabel>
          <p className="mt-0.5 text-xs text-slate-600">
            {configuratorSummary.totalSignals} total signals · {configuratorSummary.rowCount} groups
          </p>
          <p className="text-xs font-semibold text-slate-700">{inferredSystemClass}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
        <CompactChip>
          Machine: <span className="font-semibold text-slate-900">{selectedMachine.name}</span>
        </CompactChip>
        {activeCategories.map(([label, total]) => (
          <CompactChip key={label}>
            {label}: <span className="font-semibold text-slate-900">{total}</span>
          </CompactChip>
        ))}
        {activeCategories.length === 0 && <p className="text-xs text-slate-500">No I/O groups selected yet.</p>}
      </div>

      {!canGenerateProposal && (
        <div className="rounded-[var(--ui-radius-sm)] border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          {missingItems.join(' · ')}
        </div>
      )}

      <CompactButton
        type="button"
        disabled={!canGenerateProposal}
        variant={canGenerateProposal ? 'primary' : 'secondary'}
        className={cn('w-full', !canGenerateProposal && 'text-slate-400')}
      >
        Generate System Proposal
      </CompactButton>
    </CompactCard>
  )

  const renderV3ReviewContent = () => (
    <>
      <div>
        <CompactSectionLabel>04 Review & Generate</CompactSectionLabel>
        <p className="mt-0.5 text-xs text-slate-600">
          {configuratorSummary.totalSignals} configured channels · {configuratorSummary.rowCount} {groupLabel}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target machine</p>
        <p className="text-sm font-semibold text-slate-800">{selectedMachine.name}</p>
      </div>

      <div className="space-y-1 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-slate-50 p-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review status</p>
        {missingItems.length === 0 ? (
          <p className="text-xs font-semibold text-green-700">Ready to generate proposal.</p>
        ) : (
          <div className="space-y-1">
            {missingItems.map((item) => (
              <p key={item} className="text-xs text-amber-800">
                • {item}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1 rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white p-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected I/O</p>
        <div className="space-y-1 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <span>Machine</span>
            <span className="font-semibold text-slate-900">{selectedMachine.name}</span>
          </div>
          {activeCategories.map(([label, total]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <span className="font-semibold text-slate-900">{total}</span>
            </div>
          ))}
          {activeCategories.length === 0 && (
            <p className="text-xs text-slate-500">No I/O selected yet. Use + Add in a section to start.</p>
          )}
        </div>
      </div>

      <CompactButton
        type="button"
        disabled={!canGenerateProposal}
        variant={canGenerateProposal ? 'primary' : 'secondary'}
        className={cn('w-full', !canGenerateProposal && 'text-slate-400')}
      >
        Generate System Proposal
      </CompactButton>
    </>
  )

  const renderV3OverviewPanel = () => (
    <CompactCard className="space-y-2 p-[var(--ui-pad-2)] min-[1200px]:sticky min-[1200px]:top-20">
      {renderV3ReviewContent()}
    </CompactCard>
  )

  const renderV3SummaryStrip = () => (
    <CompactCard className="space-y-2 p-[var(--ui-pad-2)]">{renderV3ReviewContent()}</CompactCard>
  )

  const renderV1HoverSummaryOverlay = () => (
    <div className="pointer-events-none fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 min-[1200px]:block">
      <div
        className="pointer-events-auto relative"
        onMouseEnter={() => setIsV1SummaryHovered(true)}
        onMouseLeave={() => setIsV1SummaryHovered(false)}
      >
        <div
          className={cn(
            'absolute right-12 top-1/2 w-[320px] -translate-y-1/2 rounded-[var(--ui-radius-lg)] border border-white/60 bg-white/70 p-[var(--ui-pad-2)] shadow-xl backdrop-blur-md transition-all duration-200',
            isV1SummaryHovered ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'
          )}
        >
          <div className="space-y-2">
            <div>
              <CompactSectionLabel>04 Summary</CompactSectionLabel>
              <p className="mt-0.5 text-xs text-slate-600">
                {configuratorSummary.totalSignals} total signals · {configuratorSummary.rowCount} groups
              </p>
              <p className="text-xs font-semibold text-slate-700">{inferredSystemClass}</p>
            </div>

            <div className="flex flex-wrap gap-[var(--ui-gap-1)]">
              <CompactChip>
                Machine: <span className="font-semibold text-slate-900">{selectedMachine.name}</span>
              </CompactChip>
              {activeCategories.map(([label, total]) => (
                <CompactChip key={label}>
                  {label}: <span className="font-semibold text-slate-900">{total}</span>
                </CompactChip>
              ))}
              {activeCategories.length === 0 && <p className="text-xs text-slate-500">No I/O groups selected yet.</p>}
            </div>

            {!canGenerateProposal && (
              <div className="rounded-[var(--ui-radius-sm)] border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                {missingItems.join(' · ')}
              </div>
            )}

            <CompactButton
              type="button"
              disabled={!canGenerateProposal}
              variant={canGenerateProposal ? 'primary' : 'secondary'}
              className={cn('w-full', !canGenerateProposal && 'text-slate-400')}
            >
              Generate System Proposal
            </CompactButton>
          </div>
        </div>

        <div className="flex h-40 w-11 items-center justify-center rounded-l-[var(--ui-radius-md)] border border-[rgb(var(--speedgoat-blue))]/80 bg-[rgb(var(--speedgoat-blue))]/90 shadow-md">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold tracking-wide text-white">
            SUMMARY
          </span>
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

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
        <div className="mx-auto w-full max-w-[1400px] px-4 md:px-8 lg:px-12">
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

      <main className="min-h-screen">
        <section className="bg-gradient-to-b from-slate-50 to-white px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-[1320px]">
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--speedgoat-accent))]">
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
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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

            <div className="space-y-4">
              <CompactCard className="space-y-3 p-[var(--ui-pad-3)]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">01 Select Target System</h2>
                </div>

                <>
                  <CompactCard variant="subtle" className="flex items-center gap-3 p-[var(--ui-pad-2)]">
                    <div className="relative h-9 w-14 overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
                      <Image src={selectedMachine.image} alt={selectedMachine.name} fill className="object-contain p-1" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedMachine.name}</p>
                      <p className="text-xs text-slate-600">{selectedMachine.keywords}</p>
                    </div>
                  </CompactCard>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                    {MACHINE_OPTIONS.map((machine) => {
                      const isActive = selectedMachineId === machine.id
                      return (
                        <button
                          key={machine.id}
                          type="button"
                          onClick={() => setSelectedMachineId(machine.id)}
                          className={cn(
                            'rounded-[var(--ui-radius-md)] border p-[var(--ui-pad-2)] text-left transition',
                            isActive
                              ? 'border-[rgb(var(--speedgoat-blue))] bg-blue-50/60 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          )}
                        >
                          <div className="relative mb-2 h-12 overflow-hidden rounded-[var(--ui-radius-sm)] border border-slate-200 bg-white">
                            <Image src={machine.image} alt={machine.name} fill className="object-contain p-1.5" />
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{machine.name}</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-600">{machine.keywords}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{machine.blurb}</p>
                        </button>
                      )
                    })}
                  </div>
                </>
              </CompactCard>

              <div className="mx-auto w-full max-w-[1240px] space-y-3">
                <CompactCard className="p-[var(--ui-pad-2)]">
                  <div className="inline-flex items-center rounded-[var(--ui-radius-md)] border border-slate-200 bg-slate-100 p-1">
                    <CompactButton
                      type="button"
                      variant={activeVersion === 'v1' ? 'primary' : 'ghost'}
                      onClick={() => handleVersionChange('v1')}
                      className={cn('h-8 px-3 text-xs', activeVersion !== 'v1' && 'text-slate-600')}
                    >
                      V1
                    </CompactButton>
                    <CompactButton
                      type="button"
                      variant={activeVersion === 'v2' ? 'primary' : 'ghost'}
                      onClick={() => handleVersionChange('v2')}
                      className={cn('h-8 px-3 text-xs', activeVersion !== 'v2' && 'text-slate-600')}
                    >
                      V2
                    </CompactButton>
                    <CompactButton
                      type="button"
                      variant={activeVersion === 'v3' ? 'primary' : 'ghost'}
                      onClick={() => handleVersionChange('v3')}
                      className={cn('h-8 px-3 text-xs', activeVersion !== 'v3' && 'text-slate-600')}
                    >
                      V3
                    </CompactButton>
                    <CompactButton
                      type="button"
                      variant={activeVersion === 'v3_2' ? 'primary' : 'ghost'}
                      onClick={() => handleVersionChange('v3_2')}
                      className={cn('h-8 px-3 text-xs', activeVersion !== 'v3_2' && 'text-slate-600')}
                    >
                      V3.2
                    </CompactButton>
                    <CompactButton
                      type="button"
                      variant={activeVersion === 'v3_3' ? 'primary' : 'ghost'}
                      onClick={() => handleVersionChange('v3_3')}
                      className={cn('h-8 px-3 text-xs', activeVersion !== 'v3_3' && 'text-slate-600')}
                    >
                      V3.3
                    </CompactButton>
                  </div>
                </CompactCard>

                {activeVersion === 'v1' ? (
                  <div className="relative">
                    <ConfiguratorV1 key="v1" onSummaryChange={setConfiguratorSummary} />
                    {renderV1HoverSummaryOverlay()}
                    <div className="mt-3 min-[1200px]:hidden">{renderSummaryStrip()}</div>
                  </div>
                ) : activeVersion === 'v2' ? (
                  <div className="grid grid-cols-1 gap-3 min-[1200px]:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] min-[1200px]:items-start">
                    <ConfiguratorV2 key="v2" onSummaryChange={setConfiguratorSummary} />
                    <div className="hidden min-[1200px]:block">{renderV2OverviewPanel()}</div>
                    <div className="min-[1200px]:hidden">{renderSummaryStrip()}</div>
                  </div>
                ) : activeVersion === 'v3' ? (
                  <div className="grid grid-cols-1 gap-3 min-[1200px]:grid-cols-[minmax(0,1fr)_280px] min-[1200px]:items-start">
                    <ConfiguratorV3 key="v3" onSummaryChange={setConfiguratorSummary} />
                    <div className="hidden min-[1200px]:block">{renderV3OverviewPanel()}</div>
                    <div className="min-[1200px]:hidden">{renderV3SummaryStrip()}</div>
                  </div>
                ) : activeVersion === 'v3_2' ? (
                  <div className="grid grid-cols-1 gap-3 min-[1200px]:grid-cols-[minmax(0,1fr)_280px] min-[1200px]:items-start">
                    <ConfiguratorV3_2 key="v3_2" onSummaryChange={setConfiguratorSummary} />
                    <div className="hidden min-[1200px]:block">{renderV3OverviewPanel()}</div>
                    <div className="min-[1200px]:hidden">{renderV3SummaryStrip()}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 min-[1200px]:grid-cols-[minmax(0,1fr)_280px] min-[1200px]:items-start">
                    <ConfiguratorV3_3 key="v3_3" onSummaryChange={setConfiguratorSummary} />
                    <div className="hidden min-[1200px]:block">{renderV3OverviewPanel()}</div>
                    <div className="min-[1200px]:hidden">{renderV3SummaryStrip()}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-5">
          <div className="mx-auto max-w-[1320px] px-4 md:px-8">
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

      <footer className="border-t border-slate-200 bg-slate-50 py-7">
        <div className="mx-auto max-w-[1320px] px-4 md:px-8">
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
            <p className="text-xs text-slate-500">© Speedgoat 2026 - All Rights Reserved.</p>
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
    </>
  )
}
