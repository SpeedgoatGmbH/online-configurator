import Link from 'next/link'
import { CompactCard, CompactChip } from '@/components/ui/compact'
import { USE_CASE_PRESETS } from '@/components/configurator/useCasePresets'

const RATE_LABELS = {
  '10k': 'Up to 10 kHz',
  '100k': 'Up to 100 kHz',
  above100k: 'Above 100 kHz',
} as const

const MACHINE_LABELS = {
  performance: 'Performance',
  pulse: 'Pulse',
  mobile: 'Mobile',
  baseline: 'Baseline',
  unit: 'Unit',
  rack: 'Tailored Rack-System',
} as const

export default function IndustryUseCasePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <section className="border-b border-slate-200 bg-white/95 px-4 py-4 md:px-8">
        <div className="mx-auto max-w-[1520px]">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <Link href="/" className="hover:text-[rgb(var(--speedgoat-blue))]">
              Solution Configurator
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">Industry Use Case</span>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-[1520px]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-start">
            <div className="min-w-0">
              <div className="max-w-4xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--speedgoat-blue))]">
                  Workflow Introduction
                </p>
                <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
                  Start from a use case. Hand off into a recommended test-system configuration.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  This mock adapts the website flow so a customer can come from a use-case page, open a recommended
                  starting setup, and continue in the configurator with the machine, performance band, and initial I/O
                  profile already in place.
                </p>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                {USE_CASE_PRESETS.map((preset) => (
                  <CompactCard
                    key={preset.id}
                    className="border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {preset.shortLabel}
                        </p>
                        <h2 className="mt-1 text-xl font-semibold text-slate-900">{preset.title}</h2>
                      </div>
                      <CompactChip variant="active">{RATE_LABELS[preset.closedLoopRate]}</CompactChip>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">{preset.summary}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <CompactChip>{MACHINE_LABELS[preset.machineId as keyof typeof MACHINE_LABELS] ?? preset.machineId}</CompactChip>
                      {preset.focusTags.map((tag) => (
                        <CompactChip key={tag}>{tag}</CompactChip>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2">
                      {preset.detailPoints.map((point) => (
                        <p key={point} className="text-sm text-slate-700">
                          {point}
                        </p>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/?useCase=${preset.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-[var(--ui-radius-md)] border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Open Recommended Starting Setup
                      </Link>
                      <Link
                        href="/"
                        className="inline-flex h-10 items-center justify-center rounded-[var(--ui-radius-md)] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Open Blank Configurator
                      </Link>
                    </div>
                  </CompactCard>
                ))}
              </div>
            </div>

            <div className="space-y-4 lg:sticky lg:top-6">
              <CompactCard className="border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Core Journey</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">
                  use case → starting setup → machine → performance needs → refine → proposal
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The mock use-case page should not finish the selection. Its job is to hand the customer into the
                  configurator with a strong starting point.
                </p>
              </CompactCard>

              <CompactCard className="border-dashed border-slate-300 bg-slate-50/80 p-5 shadow-none">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">How This Helps</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>Customers do not need to think in module families first.</p>
                  <p>The configurator receives a clearer signal before detailed requirement capture starts.</p>
                  <p>The handoff still keeps the machine and performance band editable.</p>
                </div>
              </CompactCard>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
