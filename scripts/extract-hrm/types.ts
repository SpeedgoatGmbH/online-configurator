/**
 * Types for the HRM extraction pipeline.
 * Mirrors the enrichment fields added to MockModuleCatalogEntry.
 */

export interface ExtractedModuleSpecs {
  moduleId: string
  /** Source HRM filename */
  hrmFile: string
  /** Full path to the HRM document */
  hrmDocPath: string

  /* ── Extracted fields ── */
  formFactor?: 'PMC' | 'XMC' | 'mPCIe' | 'PCIe' | 'TPCE'
  lifecycleStatus?: 'active' | 'recommended' | 'eol' | 'discontinued'
  voltageRange?: { min: number; max: number; unit: string }
  currentRange?: { min: number; max: number; unit: string }
  sampleRateHz?: number[]
  resolutionBits?: number
  isolationVoltage?: string
  accuracyClass?: string
  powerConsumptionW?: number
  operatingTempC?: { min: number; max: number }

  /** Raw text sections extracted for debugging / manual review */
  _rawSections?: Record<string, string>
  /** Extraction warnings or notes */
  _warnings?: string[]
}

/** Result of processing one DOCX file */
export interface DocxParseResult {
  moduleId: string
  fileName: string
  filePath: string
  /** Full plain text of the document */
  fullText: string
  /** Text split by detected section headings */
  sections: Record<string, string>
}

/** Map of known HRM file locations (moduleId → path) */
export type HrmFileMap = Map<string, { path: string; fileName: string }>

/** The 17 discontinued modules from the Discontinued/ folder */
export const DISCONTINUED_MODULE_IDS = new Set([
  'IO119', 'IO120', 'IO121', 'IO180', 'IO181', 'IO201',
  'IO301', 'IO302', 'IO303', 'IO304',
  'IO401', 'IO501', 'IO502',
  'IO702', 'IO703', 'IO707',
])
