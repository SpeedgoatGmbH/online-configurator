/**
 * Unified Module Catalog — single source of truth for the proposal engine.
 *
 * Replaces the monolithic mockCatalog.ts by composing:
 *  - Dedicated (non-FPGA) modules from dedicatedModules.json
 *  - FPGA board entries from fpgaCatalogEntries.json
 *  - Reference maps from fpgaCompat.ts and interfaceBoards.ts
 *
 * All consumers should import from this file instead of mockCatalog.ts.
 */

import dedicatedModulesJson from '@/lib/proposal/data/dedicatedModules.json'
import fpgaModuleSpecsJson from '@/lib/proposal/data/fpgaModuleSpecs.json'
import { FPGA_BOARD_CATALOG } from '@/lib/proposal/data/fpgaBoardCatalog'

// Re-export reference maps from their new homes
export { FPGA_CODE_MODULE_COMPAT, SUB_ID_TO_CODE_MODULES, SUB_ID_EXTENSION_PREFERENCE } from '@/lib/proposal/data/fpgaCompat'
export { IO_INTERFACE_BOARDS, IO_INTERFACE_EXTENSIONS } from '@/lib/proposal/data/interfaceBoards'

/** Summary specs for all FPGA/Configurable modules (from authenticated docs). */
export const FPGA_MODULE_SPECS = fpgaModuleSpecsJson

// ── Type ────────────────────────────────────────────────────────────────────────

/** Module catalog entry type (renamed from MockModuleCatalogEntry). */
export type ModuleCatalogEntry = {
  moduleId: string
  friendlyName: string
  technicalName: string
  categoryCoverage: string
  subCoverage: string[]
  channelCapacity: number
  supportedSpecs: Record<string, string[]>
  protocolSupport?: string[]
  compatibleMachines?: string[]
  /** When set, all catalog entries sharing the same fpgaFamily share physical I/O lines on one board. */
  fpgaFamily?: string

  /* ── Enriched fields (from speedgoat.com product pages + HRM docs) ── */
  formFactor?: 'PMC' | 'XMC' | 'mPCIe' | 'PCIe' | 'TPCE'
  lifecycleStatus?: 'active' | 'recommended' | 'eol' | 'discontinued'
  voltageRange?: { min: number; max: number; unit: string }
  outputVoltageRange?: { min: number; max: number; unit: string }
  currentRange?: { min: number; max: number; unit: string }
  sampleRateHz?: number[]
  resolutionBits?: number
  isolationVoltage?: string
  accuracyClass?: string
  powerConsumptionW?: number
  operatingTempC?: { min: number; max: number }
  samplingMode?: string
  connector?: string
  maxDataRateMbps?: number
  inputChannelSpec?: string
  outputChannelSpec?: string
  webSourcePage?: string
  hrmDocPath?: string

  /* ── Documentation-enriched fields ── */
  docDescription?: string
  fpgaLogicCells?: string
  fpgaCategory?: 'configurable' | 'simulink-programmable'
  fpgaAnalogInputChannels?: string | number
  fpgaAnalogOutputChannels?: number
  fpgaDigitalIOLines?: number
  supportsIOInterfaces?: boolean
  supportsIOExtensions?: boolean
  configPackages?: string[]
  matchingEligibility?: 'normal' | 'research_only' | 'disabled'
  sharedResourceFamily?: string
  resourceProfile?: {
    analogInputsSE?: number
    analogInputsDF?: number
    analogOutputs?: number
    digitalTTL?: number
  }
}

/**
 * Backward-compatible type alias.
 * @deprecated Use `ModuleCatalogEntry` instead.
 */
export type MockModuleCatalogEntry = ModuleCatalogEntry

// ── Catalog ─────────────────────────────────────────────────────────────────────

/** Dedicated (non-FPGA) module catalog entries. */
const DEDICATED_MODULE_CATALOG: ModuleCatalogEntry[] = dedicatedModulesJson as unknown as ModuleCatalogEntry[]

/**
 * Complete module catalog — dedicated + FPGA entries combined.
 * Drop-in replacement for the old MOCK_MODULE_CATALOG.
 */
export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  ...DEDICATED_MODULE_CATALOG,
  ...FPGA_BOARD_CATALOG,
]

/**
 * Backward-compatible alias.
 * @deprecated Use `MODULE_CATALOG` instead.
 */
export const MOCK_MODULE_CATALOG = MODULE_CATALOG
