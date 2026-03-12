import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Speedgoat Product Configurator',
  description: 'Configure your Speedgoat product',
}

const buildSha   = process.env.NEXT_PUBLIC_BUILD_SHA
const buildDate  = process.env.NEXT_PUBLIC_BUILD_DATE
const buildRef   = process.env.NEXT_PUBLIC_BUILD_REF

const buildLabel = buildSha
  ? `build ${buildSha.slice(0, 7)} · ${buildRef ?? 'main'} · ${buildDate ? new Date(buildDate).toISOString().slice(0, 10) : ''}`
  : 'dev'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={archivo.variable}>
        <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
        {children}
        <footer className="sg-build-footer">
          <span>&copy; Speedgoat {new Date().getFullYear()} &mdash; All Rights Reserved</span>
          <span className="sg-build-footer__sha">{buildLabel}</span>
        </footer>
      </body>
    </html>
  )
}
