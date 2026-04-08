'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CompactButton, CompactCard, CompactChip } from '@/components/ui/compact'
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

const PANEL_CLASS =
  'relative overflow-hidden border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.08)]'

function PlaceholderLines({
  widths,
  className,
}: {
  widths: string[]
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {widths.map((width, index) => (
        <div
          key={`${width}-${index}`}
          className="h-3 rounded-full bg-slate-200/80"
          style={{ width }}
        />
      ))}
    </div>
  )
}

function LayoutPanel({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <CompactCard className={cn(PANEL_CLASS, 'p-5', className)}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,251,253,0.96))]" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </CompactCard>
  )
}

export default function LayoutMockPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 160)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
              href="/layout-mock"
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

      <main className="min-h-screen bg-[linear-gradient(180deg,#eef4f9_0%,#f6f9fc_36%,#ffffff_100%)] pb-14">
        <section className="relative overflow-hidden px-4 pt-28 md:px-8 md:pt-36">
          <div className="absolute inset-0">
            <Image
              src={`${BASE_PATH}/assets/machine-performance.png`}
              alt=""
              fill
              priority
              className="scale-105 object-cover object-center opacity-[0.38]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(4,24,47,0.9)_0%,rgba(8,47,93,0.74)_34%,rgba(7,25,47,0.34)_68%,rgba(255,255,255,0)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(72,117,255,0.28),transparent_24%),radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_24%)]" />
          </div>

          <div className="relative mx-auto flex h-[210px] max-w-[1520px] items-end pb-8 md:h-[260px] md:pb-10">
            <p className="text-[15px] font-semibold text-white/88 md:text-[18px]">Test Systems</p>
          </div>
        </section>

        <section className="relative px-4 pb-12 pt-20 md:px-8 md:pt-24">
          <div className="mx-auto max-w-[1520px]">
            <div className="mb-8 max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <CompactChip className="border border-[rgb(var(--speedgoat-blue))]/15 bg-[rgb(var(--speedgoat-blue))]/6 text-[rgb(var(--speedgoat-blue))]">
                  Layout-Only Mock
                </CompactChip>
                <CompactChip className="border border-slate-200 bg-white text-slate-600">
                  No configurator logic
                </CompactChip>
              </div>
              <h1 className="mb-2 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
                Configure a Real-Time Test System
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 md:text-base">
                This copy is only for layout exploration: header behavior, hero spacing, content hierarchy, panel rhythm,
                and overall page composition.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Certified Partner With
                </span>
                <CompactChip className="rounded-[var(--ui-radius-md)] bg-white px-2.5 py-1 text-xs font-bold text-[#e26310] shadow-sm">
                  MathWorks
                </CompactChip>
                <CompactChip className="rounded-[var(--ui-radius-md)] bg-white px-2.5 py-1 text-xs font-bold text-[#d32f2f] shadow-sm">
                  Simulink®
                </CompactChip>
              </div>
            </div>

            <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
              <LayoutPanel
                eyebrow="Application Entry"
                title="Application-first starting point"
                description="Use this area to test hero-adjacent cards, CTA weight, copy density, and overall alignment."
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <PlaceholderLines widths={['92%', '80%', '66%']} />
                  </div>
                  <CompactButton
                    type="button"
                    className="h-10 border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Explore Applications
                  </CompactButton>
                </div>
              </LayoutPanel>

              <LayoutPanel
                eyebrow="How It Works"
                title="Compact process rail"
                description="A lightweight explainer block for the journey from application entry into the configurator."
              >
                <div className="flex flex-wrap gap-2">
                  {['Choose application', 'Review direction', 'Adjust details', 'Get recommendation'].map((step) => (
                    <CompactChip key={step} className="border border-slate-200 bg-white text-slate-600 shadow-sm">
                      {step}
                    </CompactChip>
                  ))}
                </div>
              </LayoutPanel>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(320px,1fr)] lg:items-start">
              <div className="space-y-6">
                <LayoutPanel
                  eyebrow="System Direction"
                  title="Recommended starting setup"
                  description="Static composition block for the system direction card, key chips, and summary copy."
                >
                  <div className="flex flex-wrap gap-2">
                    {['Performance target machine', 'Up to 100 kHz', 'Analog I/O', 'Digital I/O'].map((item) => (
                      <CompactChip key={item} className="border border-slate-200 bg-white text-slate-700">
                        {item}
                      </CompactChip>
                    ))}
                  </div>
                  <PlaceholderLines widths={['88%', '78%', '56%']} className="mt-4" />
                </LayoutPanel>

                {[
                  {
                    label: 'Configuration Zone 1',
                    title: 'Up to 10 kHz',
                    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  },
                  {
                    label: 'Configuration Zone 2',
                    title: 'Up to 100 kHz',
                    accent: 'bg-blue-50 text-blue-700 border-blue-200',
                  },
                  {
                    label: 'Configuration Zone 3',
                    title: 'Above 100 kHz',
                    accent: 'bg-violet-50 text-violet-700 border-violet-200',
                  },
                ].map((zone) => (
                  <LayoutPanel
                    key={zone.title}
                    eyebrow={zone.label}
                    title={zone.title}
                    description="Placeholder grid only. This section is meant for layout iteration, not behavior or business logic."
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <CompactChip className={cn('border', zone.accent)}>Performance Band</CompactChip>
                      <span className="text-xs font-medium text-slate-500">Layout placeholder</span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Primary Controls</p>
                        <PlaceholderLines widths={['82%', '92%', '68%', '76%']} className="mt-4" />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Secondary Controls</p>
                        <PlaceholderLines widths={['74%', '88%', '64%', '79%']} className="mt-4" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inputs</p>
                        <PlaceholderLines widths={['72%', '58%']} className="mt-3" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Outputs</p>
                        <PlaceholderLines widths={['70%', '54%']} className="mt-3" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</p>
                        <PlaceholderLines widths={['90%', '78%']} className="mt-3" />
                      </div>
                    </div>
                  </LayoutPanel>
                ))}
              </div>

              <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
                <LayoutPanel
                  eyebrow="Machine Visual"
                  title="Target machine panel"
                  description="Use this to refine how the image card and summary stack should feel next to the main layout."
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#f6f9fc_0%,#eef4f8_100%)] p-3">
                    <div className="relative h-52 overflow-hidden rounded-xl">
                      <Image
                        src={`${BASE_PATH}/assets/machine-performance.png`}
                        alt=""
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                </LayoutPanel>

                <LayoutPanel
                  eyebrow="Right Rail"
                  title="Summary and recommendation stack"
                  description="Static block for spacing, sticky behavior, and visual hierarchy on the secondary column."
                >
                  <div className="space-y-3">
                    {['Selected performance bands', 'Machine summary', 'Proposal preview', 'Contact / CTA'].map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item}</p>
                        <PlaceholderLines widths={['88%', '68%']} className="mt-3" />
                      </div>
                    ))}
                  </div>
                </LayoutPanel>

                <LayoutPanel
                  eyebrow="Mock Notes"
                  title="What to review here"
                >
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>Header transition timing</li>
                    <li>Hero-to-content handoff</li>
                    <li>Top card composition</li>
                    <li>Left column rhythm across zones</li>
                    <li>Right rail stickiness and weight</li>
                  </ul>
                </LayoutPanel>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
