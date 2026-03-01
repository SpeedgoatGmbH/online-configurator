/**
 * DOCX Parser — reads Hardware Reference Manual .docx files using mammoth.
 *
 * ONLY processes files whose name includes "Hardware Reference Manual".
 * Explicitly EXCLUDES OEM manuals, Product Briefs, Training docs, etc.
 */

import * as fs from 'fs'
import * as path from 'path'
import mammoth from 'mammoth'
import type { DocxParseResult, HrmFileMap } from './types'

/** Filename must include this (case-insensitive) */
const HRM_INCLUDE_PATTERN = /hardware\s*reference\s*manual/i

/** Filenames containing these are excluded */
const EXCLUDE_PATTERNS = [
  /oem/i,
  /product\s*brief/i,
  /training/i,
  /unsupported/i,
  /template/i,
]

/**
 * Scan the IO Modules directory and build a map of moduleId → HRM DOCX path.
 * Only picks the "best" HRM if multiple versions exist (prefers unnumbered filename).
 */
export function discoverHrmFiles(ioModulesRoot: string): HrmFileMap {
  const map: HrmFileMap = new Map()

  if (!fs.existsSync(ioModulesRoot)) {
    console.error(`[parseDocx] IO Modules root not found: ${ioModulesRoot}`)
    return map
  }

  const entries = fs.readdirSync(ioModulesRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    // Extract moduleId from folder name (e.g. "IO130_TPMC530-20R" → "IO130")
    const match = entry.name.match(/^(IO\d{3})/i)
    if (!match) continue
    const moduleId = match[1].toUpperCase()

    // Look for Documentation/ subfolder
    const docDir = path.join(ioModulesRoot, entry.name, 'Documentation')
    if (!fs.existsSync(docDir)) continue

    // Scan for HRM DOCX files (non-recursive — HRMs live directly in Documentation/)
    const docFiles = readdirSafe(docDir)
    const hrmFiles = docFiles.filter(f => {
      if (!f.toLowerCase().endsWith('.docx')) return false
      if (!HRM_INCLUDE_PATTERN.test(f)) return false
      if (EXCLUDE_PATTERNS.some(p => p.test(f))) return false
      return true
    })

    if (hrmFiles.length === 0) continue

    // Pick best: prefer file without version number suffix (v1.0, 1, 2, etc.)
    const best = pickBestHrm(hrmFiles)
    map.set(moduleId, {
      path: path.join(docDir, best),
      fileName: best,
    })
  }

  console.log(`[parseDocx] Discovered ${map.size} HRM DOCX files`)
  return map
}

/** Pick the "best" HRM file when multiple exist (prefer unnumbered) */
function pickBestHrm(files: string[]): string {
  // Prefer file that does NOT end with a version number before .docx
  const unnumbered = files.filter(f => !/(?:v?\d+\.?\d*|[ _]\d)\.docx$/i.test(f))
  if (unnumbered.length > 0) return unnumbered[0]
  // Otherwise pick the one with highest version or just first
  return files.sort().reverse()[0]
}

function readdirSafe(dir: string): string[] {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

/**
 * Parse a single HRM DOCX file → plain text + section map.
 */
export async function parseHrmDocx(
  moduleId: string,
  filePath: string,
  fileName: string,
): Promise<DocxParseResult> {
  const buffer = fs.readFileSync(filePath)
  const result = await mammoth.extractRawText({ buffer })
  const fullText = result.value

  // Split into sections by heading-like lines
  const sections = splitIntoSections(fullText)

  return { moduleId, fileName, filePath, fullText, sections }
}

/**
 * Split document text into named sections based on heading patterns.
 * Sections are keyed by normalized heading text.
 */
function splitIntoSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = text.split('\n')

  let currentKey = '_preamble'
  let currentLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect section headings: numbered sections (e.g. "3.1 Electrical Specifications")
    // or all-caps short lines, or lines matching common HRM heading patterns
    const headingMatch = trimmed.match(
      /^(?:(\d+\.?\d*\.?\d*)\s+)?([A-Z][A-Za-z &/,\-]{3,60})\s*$/
    )
    const isHeading =
      headingMatch &&
      trimmed.length < 80 &&
      !trimmed.includes('.') // avoid matching sentences ending with period; section headings don't
        ? trimmed.slice(-1) !== '.'
        : false

    if (isHeading && headingMatch) {
      // Save previous section
      if (currentLines.length > 0) {
        sections[currentKey] = currentLines.join('\n').trim()
      }
      currentKey = normalizeHeading(headingMatch[2] || trimmed)
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  // Save last section
  if (currentLines.length > 0) {
    sections[currentKey] = currentLines.join('\n').trim()
  }

  return sections
}

function normalizeHeading(heading: string): string {
  return heading.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}
