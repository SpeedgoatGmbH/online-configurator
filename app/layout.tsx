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
      </body>
    </html>
  )
}
