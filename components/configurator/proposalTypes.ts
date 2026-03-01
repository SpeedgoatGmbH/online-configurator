export type RequirementRow = {
  categoryId: string
  categoryLabel: string
  subId: string
  subLabel: string
  rowId: string
  quantity: number
  specs: Record<string, string>
}

export type ProposalGenerateRequest = {
  machineId: string
  machineName: string
  version: string
  requirements: RequirementRow[]
  /** Maximum I/O module slots in the base configuration */
  maxSlots?: number
  /** Maximum I/O module slots with expansion units */
  maxSlotsExpanded?: number
}

export type ProposalSpecDiff = {
  key: string
  requested: string
  provided: string
  status: 'exact' | 'partial' | 'unresolved'
}

export type ProposalRowDiff = {
  rowId: string
  categoryId: string
  subId: string
  categoryLabel: string
  subLabel: string
  quantityRequested: number
  quantityCovered: number
  status: 'exact' | 'partial' | 'unresolved'
  requestedSpecs: Record<string, string>
  providedSpecs: Record<string, string>
  specDiffs: ProposalSpecDiff[]
  moduleRefs: string[]
  notes: string[]
}

export type ProposalRecommendedModule = {
  moduleId: string
  friendlyName: string
  technicalName: string
  quantity: number
  coveredChannels: number
  coveredRows: string[]
  rationale: string
  /* ── Enriched fields (optional, populated from catalog) ── */
  formFactor?: 'PMC' | 'XMC' | 'mPCIe' | 'PCIe' | 'TPCE'
  lifecycleStatus?: 'active' | 'recommended' | 'eol' | 'discontinued'
  voltageRange?: { min: number; max: number; unit: string }
  sampleRateHz?: number[]
  resolutionBits?: number
  fpgaLogicCells?: string
  configPackages?: string[]
  webSourcePage?: string
  /* ── FPGA grouping & category ── */
  fpgaCategory?: 'simulink-programmable' | 'configurable'
  /** Parent module ID when this entry is an IO extension or IO33X-N interface board */
  interfaceForModule?: string
  /** I/O line utilization after FPGA consolidation */
  ioLineUtilization?: { used: number; total: number }
}

export type ProposalUnresolvedRow = {
  rowId: string
  categoryLabel: string
  subLabel: string
  quantity: number
  reason: string
  suggestion: string
}

export type ProposalGenerateResponse = {
  proposalId: string
  generatedAt: string
  summary: {
    requestedChannels: number
    coveredChannels: number
    unresolvedCount: number
    moduleCount: number
  }
  recommendedModules: ProposalRecommendedModule[]
  rowDiffs: ProposalRowDiff[]
  unresolved: ProposalUnresolvedRow[]
  /** Warnings about machine type / slot incompatibility */
  machineWarnings?: string[]
  /** FPGA families swapped to dedicated modules because satellite overhead exceeded savings */
  fpgaOverheadSwaps?: FpgaOverheadSwap[]
}

/** One FPGA-to-dedicated swap performed by the module-count guard */
export type FpgaOverheadSwap = {
  family: string
  fpgaCount: number
  dedicatedCount: number
  /** The dedicated modules that replaced the FPGA family */
  replacements: { moduleId: string; friendlyName: string; units: number }[]
}
