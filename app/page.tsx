'use client'

import Configurator from '@/components/Configurator'
import ConfiguratorV2 from '@/components/ConfiguratorV2'
import { useEffect, useState } from 'react'

export default function Home() {
  const [version, setVersion] = useState<'v1' | 'v2'>('v1')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* Top Banner */}
      <div className="bg-[rgb(var(--speedgoat-blue))] py-2 text-center text-xs text-white">
        <p>
          Featured Event: <strong>Embedded World 2026</strong> | March 10-12, Nuremberg, Germany
        </p>
      </div>

      {/* Main Navigation */}
      <header
        className={`sticky top-0 z-50 border-b transition ${
          isScrolled
            ? 'border-slate-200 bg-white/95 shadow-sm backdrop-blur'
            : 'border-transparent bg-[rgb(var(--speedgoat-blue))] shadow-none'
        }`}
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10 lg:px-20">
          <div className="flex items-center justify-between py-5 transition-[padding] lg:py-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold transition ${
                  isScrolled ? 'bg-[rgb(var(--speedgoat-blue))] text-white' : 'bg-white text-[rgb(var(--speedgoat-blue))]'
                }`}
              >
                SG
              </div>
              <div>
                <p className={`text-lg font-bold ${isScrolled ? 'text-slate-900' : 'text-white'}`}>
                  Speedgoat
                </p>
                <p className={`text-xs ${isScrolled ? 'text-slate-500' : 'text-white/70'}`}>
                  Real-Time Testing
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav
              className={`hidden items-center gap-6 text-sm font-semibold lg:flex ${
                isScrolled ? 'text-slate-700' : 'text-white/90'
              }`}
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

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <div
                className={`hidden items-center gap-2 text-xs font-semibold md:flex ${
                  isScrolled ? 'text-slate-600' : 'text-white/80'
                }`}
              >
                <button className={`transition ${isScrolled ? 'hover:text-slate-900' : 'hover:text-white'}`}>
                  English
                </button>
                <span className={isScrolled ? 'text-slate-300' : 'text-white/40'}>|</span>
                <button className={`transition ${isScrolled ? 'hover:text-slate-900' : 'hover:text-white'}`}>
                  中文
                </button>
              </div>
              <button
                className={`hidden rounded-full border px-4 py-2 text-xs font-semibold transition md:block ${
                  isScrolled
                    ? 'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] text-white hover:bg-blue-700'
                    : 'border-white/80 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Customer Portal
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`rounded-lg border p-2 lg:hidden ${
                  isScrolled ? 'border-slate-200 text-slate-700' : 'border-white/50 text-white'
                }`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-screen">
        {/* Hero Section - Configurator */}
        <section className="bg-gradient-to-b from-slate-50 to-white px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-7xl">
            {/* Breadcrumb & Version Switcher */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
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

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  onClick={() => setVersion('v1')}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                    version === 'v1'
                      ? 'bg-[rgb(var(--speedgoat-blue))] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Layout v1
                </button>
                <button
                  onClick={() => setVersion('v2')}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                    version === 'v2'
                      ? 'bg-[rgb(var(--speedgoat-blue))] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Layout v2
                </button>
              </div>
            </div>

            {/* Page Header */}
            <div className="mb-12 max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--speedgoat-accent))]/30 bg-[rgb(var(--speedgoat-accent))]/5 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[rgb(var(--speedgoat-accent))]"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--speedgoat-accent))]">
                  Interactive Tool
                </span>
              </div>
              <h1 className="mb-4 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
                Use Case to Proposal
              </h1>
              <p className="text-lg text-slate-600">
                Get the exact I/O configuration you need, ready for your quote or project proposal.
              </p>
              
              {/* Partner Logos */}
              <div className="mt-6 flex items-center gap-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Certified Partner With
                </span>
                <div className="flex items-center gap-3">
                  <div className="rounded bg-white px-3 py-1.5 shadow-sm">
                    <span className="text-sm font-bold text-[#e26310]">MathWorks</span>
                  </div>
                  <div className="rounded bg-white px-3 py-1.5 shadow-sm">
                    <span className="text-sm font-bold text-[#d32f2f]">Simulink®</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Configurator Component */}
            {version === 'v1' && <Configurator />}
            {version === 'v2' && <ConfiguratorV2 />}
          </div>
        </section>

        {/* Info Banner */}
        <section className="border-y border-slate-200 bg-white py-8">
          <div className="mx-auto max-w-7xl px-6 md:px-10">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-[rgb(var(--speedgoat-blue))]">120+</p>
                <p className="mt-1 text-sm text-slate-600">I/O Module Types</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[rgb(var(--speedgoat-blue))]">24</p>
                <p className="mt-1 text-sm text-slate-600">Target Machines</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[rgb(var(--speedgoat-blue))]">6-8 weeks</p>
                <p className="mt-1 text-sm text-slate-600">Typical Lead Time</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="grid gap-8 md:grid-cols-5">
            {/* Testing Workflows */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">
                Testing Workflows
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
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

            {/* Test Systems */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">
                Test Systems
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
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

            {/* Industries */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">
                Industries
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
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

            {/* Company */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">
                Company
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
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

            {/* Resources */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">
                Resources
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
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

          {/* Bottom Bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 md:flex-row">
            <p className="text-sm text-slate-500">© Speedgoat 2026 - All Rights Reserved.</p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-slate-400 transition hover:text-[rgb(var(--speedgoat-blue))]"
                aria-label="LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-slate-400 transition hover:text-[rgb(var(--speedgoat-blue))]"
                aria-label="YouTube"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
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
