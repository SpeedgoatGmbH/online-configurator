/**
 * Spec Extractor — regex-based extraction of structured hardware specs
 * from HRM plain-text sections.
 *
 * Targets: voltage range, current range, sample rate, resolution,
 * isolation, accuracy, power consumption, temperature, form factor.
 */

import type { DocxParseResult, ExtractedModuleSpecs } from './types'
import { DISCONTINUED_MODULE_IDS } from './types'

/* ================================================================== */
/*  Regex patterns                                                     */
/* ================================================================== */

/** Voltage: ±10 V, -10..+10 V, 0-60 V, etc. */
const VOLTAGE_RANGE_RE =
  /([±\-+]?\d+\.?\d*)\s*(?:to|\.{2,3}|–|—|-)\s*([±\-+]?\d+\.?\d*)\s*(m?V)\b/gi
const VOLTAGE_UNI_RE = /[±]\s*(\d+\.?\d*)\s*(m?V)\b/gi

/** Current: 0-20 mA, ±24 mA, 4..20 mA, etc. */
const CURRENT_RANGE_RE =
  /([±\-+]?\d+\.?\d*)\s*(?:to|\.{2,3}|–|—|-)\s*([±\-+]?\d+\.?\d*)\s*(m?A)\b/gi

/** Sample rate: 100 kHz, 1 MS/s, 200 kS/s, 500 SPS, etc. */
const SAMPLE_RATE_RE =
  /(\d+\.?\d*)\s*(k|M|G)?\s*(S\/s|Hz|Sa\/s|SPS|Samples?\s*\/?\s*s(?:ec(?:ond)?)?)\b/gi

/** Resolution: 16-bit, 24 bit, 12-Bit, etc. */
const RESOLUTION_RE = /\b(\d{1,2})\s*[-–]?\s*[Bb]it\b/g

/** Power consumption: 2.5 W, 1.2W, etc. near "power" context */
const POWER_RE = /(\d+\.?\d*)\s*W\b/gi

/** Operating temperature: -40°C to +85°C, 0..50 °C, etc. */
const TEMP_RANGE_RE =
  /(-?\d+)\s*°?\s*C\s*(?:to|\.{2,3}|–|—|-)\s*([+\-]?\d+)\s*°?\s*C/gi

/** Isolation voltage: 1500 Vrms, 500 VDC, etc. */
const ISOLATION_RE = /(\d+)\s*V\s*(rms|RMS|DC|pk|peak)?/gi

/** Accuracy: ±0.01% FSR, ±0.1%, etc. */
const ACCURACY_RE = /[±]\s*(\d+\.?\d*)\s*%\s*(FSR|FS|of\s+range)?/gi

/** Form factor from title/preamble */
const FORM_FACTOR_RE = /\b(PMC|XMC|mPCIe|PCIe|PCI\s*Express|TPCE)\b/i

/* ================================================================== */
/*  Extraction                                                         */
/* ================================================================== */

/**
 * Extract structured specs from a parsed HRM document.
 */
export function extractSpecs(parsed: DocxParseResult): ExtractedModuleSpecs {
  const warnings: string[] = []

  const result: ExtractedModuleSpecs = {
    moduleId: parsed.moduleId,
    hrmFile: parsed.fileName,
    hrmDocPath: parsed.filePath,
    _rawSections: parsed.sections,
    _warnings: warnings,
  }

  const fullText = parsed.fullText
  const sectionKeys = Object.keys(parsed.sections)

  // ── Form factor (from first ~800 chars or preamble) ────────────────
  const preamble = fullText.slice(0, 800)
  result.formFactor = extractFormFactor(preamble)
  if (!result.formFactor) {
    // Also check folder name — often contains TXMC (=XMC), TPMC (=PMC), TMPE (=mPCIe)
    result.formFactor = inferFormFactorFromModuleId(parsed.moduleId, parsed.filePath)
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  result.lifecycleStatus = DISCONTINUED_MODULE_IDS.has(parsed.moduleId)
    ? 'discontinued'
    : 'active'

  // ── Find electrical spec sections ──────────────────────────────────
  const elecText = findSectionText(parsed.sections, sectionKeys, [
    'electrical_specifications', 'electrical_spec', 'specifications',
    'technical_data', 'technical_specifications', 'analog_input',
    'analog_output', 'input_specifications', 'output_specifications',
    'electrical_characteristics',
  ])

  // ── Voltage range ──────────────────────────────────────────────────
  result.voltageRange = extractVoltageRange(elecText || fullText)
  if (!result.voltageRange && elecText) {
    // Try unipolar ±X V notation
    result.voltageRange = extractVoltageUni(elecText)
  }

  // ── Current range ──────────────────────────────────────────────────
  result.currentRange = extractCurrentRange(elecText || fullText)

  // ── Sample rate ────────────────────────────────────────────────────
  const timingText = findSectionText(parsed.sections, sectionKeys, [
    'sampling', 'conversion', 'timing', 'sample_rate', 'data_acquisition',
    'adc', 'dac', 'analog_input', 'performance',
  ])
  result.sampleRateHz = extractSampleRates(timingText || elecText || fullText)

  // ── Resolution ─────────────────────────────────────────────────────
  result.resolutionBits = extractResolution(elecText || fullText)

  // ── Isolation ──────────────────────────────────────────────────────
  const safetyText = findSectionText(parsed.sections, sectionKeys, [
    'safety', 'isolation', 'galvanic', 'protection',
  ])
  result.isolationVoltage = extractIsolation(safetyText || elecText || fullText)

  // ── Accuracy ───────────────────────────────────────────────────────
  result.accuracyClass = extractAccuracy(elecText || fullText)

  // ── Power consumption ──────────────────────────────────────────────
  const powerText = findSectionText(parsed.sections, sectionKeys, [
    'power', 'power_supply', 'power_consumption', 'power_requirements',
  ])
  result.powerConsumptionW = extractPower(powerText || elecText || fullText)

  // ── Operating temperature ──────────────────────────────────────────
  const envText = findSectionText(parsed.sections, sectionKeys, [
    'environmental', 'operating_conditions', 'temperature', 'environment',
  ])
  result.operatingTempC = extractTempRange(envText || elecText || fullText)

  // ── Validation warnings ────────────────────────────────────────────
  if (!result.voltageRange && !result.currentRange) {
    warnings.push('No voltage or current range found')
  }
  if (!result.sampleRateHz || result.sampleRateHz.length === 0) {
    warnings.push('No sample rate found')
  }
  if (!result.powerConsumptionW) {
    warnings.push('No power consumption found')
  }

  return result
}

/* ================================================================== */
/*  Individual extractors                                              */
/* ================================================================== */

function extractFormFactor(text: string): ExtractedModuleSpecs['formFactor'] | undefined {
  const m = text.match(FORM_FACTOR_RE)
  if (!m) return undefined
  const raw = m[0].toUpperCase().replace(/\s+/g, '')
  if (raw === 'PCIEXPRESS' || raw === 'PCIE') return 'PCIe'
  return raw as ExtractedModuleSpecs['formFactor']
}

function inferFormFactorFromModuleId(
  _moduleId: string,
  filePath: string,
): ExtractedModuleSpecs['formFactor'] | undefined {
  const fp = filePath.toUpperCase()
  if (fp.includes('TXMC') || fp.includes('_XMC')) return 'XMC'
  if (fp.includes('TPMC') || fp.includes('_PMC')) return 'PMC'
  if (fp.includes('TMPE') || fp.includes('MPCIE')) return 'mPCIe'
  if (fp.includes('TPCE') || fp.includes('PCIE')) return 'PCIe'
  return undefined
}

function extractVoltageRange(text: string): ExtractedModuleSpecs['voltageRange'] | undefined {
  // Reset regex
  VOLTAGE_RANGE_RE.lastIndex = 0
  const matches: Array<{ min: number; max: number; unit: string }> = []

  let m: RegExpExecArray | null
  while ((m = VOLTAGE_RANGE_RE.exec(text)) !== null) {
    const min = parseFloat(m[1])
    const max = parseFloat(m[2])
    const unit = m[3]
    if (!isNaN(min) && !isNaN(max)) {
      matches.push({ min, max, unit })
    }
  }

  if (matches.length === 0) return undefined
  // Return the widest range found
  return matches.reduce((best, cur) =>
    (cur.max - cur.min) > (best.max - best.min) ? cur : best
  )
}

function extractVoltageUni(text: string): ExtractedModuleSpecs['voltageRange'] | undefined {
  VOLTAGE_UNI_RE.lastIndex = 0
  const m = VOLTAGE_UNI_RE.exec(text)
  if (!m) return undefined
  const v = parseFloat(m[1])
  if (isNaN(v)) return undefined
  return { min: -v, max: v, unit: m[2] }
}

function extractCurrentRange(text: string): ExtractedModuleSpecs['currentRange'] | undefined {
  CURRENT_RANGE_RE.lastIndex = 0
  const matches: Array<{ min: number; max: number; unit: string }> = []

  let m: RegExpExecArray | null
  while ((m = CURRENT_RANGE_RE.exec(text)) !== null) {
    const min = parseFloat(m[1])
    const max = parseFloat(m[2])
    const unit = m[3]
    if (!isNaN(min) && !isNaN(max)) {
      matches.push({ min, max, unit })
    }
  }

  if (matches.length === 0) return undefined
  return matches.reduce((best, cur) =>
    (cur.max - cur.min) > (best.max - best.min) ? cur : best
  )
}

function extractSampleRates(text: string): number[] | undefined {
  SAMPLE_RATE_RE.lastIndex = 0
  const rates = new Set<number>()

  let m: RegExpExecArray | null
  while ((m = SAMPLE_RATE_RE.exec(text)) !== null) {
    let value = parseFloat(m[1])
    const prefix = (m[2] || '').toUpperCase()
    if (prefix === 'K') value *= 1_000
    if (prefix === 'M') value *= 1_000_000
    if (prefix === 'G') value *= 1_000_000_000
    if (value > 0 && value < 1e12) {
      rates.add(value)
    }
  }

  return rates.size > 0 ? [...rates].sort((a, b) => a - b) : undefined
}

function extractResolution(text: string): number | undefined {
  RESOLUTION_RE.lastIndex = 0
  const values = new Set<number>()

  let m: RegExpExecArray | null
  while ((m = RESOLUTION_RE.exec(text)) !== null) {
    const bits = parseInt(m[1], 10)
    if (bits >= 8 && bits <= 32) values.add(bits)
  }

  if (values.size === 0) return undefined
  // Return the highest resolution found
  return Math.max(...values)
}

function extractIsolation(text: string): string | undefined {
  // Only look near "isolation" context
  const context = extractContext(text, /isol/i, 300)
  if (!context) return undefined

  ISOLATION_RE.lastIndex = 0
  let best = ''
  let bestVal = 0

  let m: RegExpExecArray | null
  while ((m = ISOLATION_RE.exec(context)) !== null) {
    const val = parseInt(m[1], 10)
    const suffix = m[2] || ''
    if (val > bestVal && val >= 50) {
      bestVal = val
      best = `${val} V${suffix}`
    }
  }

  return best || undefined
}

function extractAccuracy(text: string): string | undefined {
  ACCURACY_RE.lastIndex = 0
  const m = ACCURACY_RE.exec(text)
  if (!m) return undefined
  const suffix = m[2] ? ` ${m[2]}` : ''
  return `±${m[1]}%${suffix}`
}

function extractPower(text: string): number | undefined {
  // Look near "power" / "consumption" context only to avoid false matches
  const context = extractContext(text, /power|consumption|dissipation/i, 400)
  if (!context) return undefined

  POWER_RE.lastIndex = 0
  const values: number[] = []

  let m: RegExpExecArray | null
  while ((m = POWER_RE.exec(context)) !== null) {
    const w = parseFloat(m[1])
    if (w > 0 && w < 200) values.push(w)
  }

  if (values.length === 0) return undefined
  // Return the typical / max value (largest found near power keyword)
  return Math.max(...values)
}

function extractTempRange(text: string): ExtractedModuleSpecs['operatingTempC'] | undefined {
  TEMP_RANGE_RE.lastIndex = 0
  const m = TEMP_RANGE_RE.exec(text)
  if (!m) return undefined
  const min = parseInt(m[1], 10)
  const max = parseInt(m[2], 10)
  if (min >= -60 && max <= 125 && min < max) {
    return { min, max }
  }
  return undefined
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Find text from sections matching any of the given normalized keys */
function findSectionText(
  sections: Record<string, string>,
  sectionKeys: string[],
  candidates: string[],
): string | undefined {
  for (const candidate of candidates) {
    // Exact match
    if (sections[candidate]) return sections[candidate]
    // Partial match
    const found = sectionKeys.find(k => k.includes(candidate) || candidate.includes(k))
    if (found && sections[found]) return sections[found]
  }
  return undefined
}

/** Extract text around a keyword match (context window) */
function extractContext(text: string, pattern: RegExp, windowSize: number): string | undefined {
  const m = text.match(pattern)
  if (!m || m.index === undefined) return undefined
  const start = Math.max(0, m.index - windowSize)
  const end = Math.min(text.length, m.index + windowSize)
  return text.slice(start, end)
}
