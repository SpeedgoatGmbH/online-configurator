export type RequirementRow = {
  categoryId: string
  categoryLabel: string
  subId: string
  subLabel: string
  rowId: string
  quantity: number
  specs: Record<string, string>
}

export type OptimizationProfile = 'balanced' | 'min_modules' | 'prefer_fpga'

export type FitResourceKey = 'slices' | 'lut' | 'register' | 'ram16' | 'ram8' | 'dsp'

export type FitGateReason =
  | 'missing_fit_data'
  | 'board_not_found'
  | 'insufficient_base_channels'
  | 'insufficient_signal_channels'
  | 'unsupported_plugin'
  | 'unsupported_extension'
  | 'code_module_incompatible'
  | 'fpga_resource_exceeded'
  | 'unknown_mapping'

export type ProposalFitDiagnosticRejectedCandidate = {
  moduleId: string
  reasons: FitGateReason[]
}

export type ProposalFitDiagnosticRow = {
  rowId: string
  evaluated: number
  passed: number
  failOpen: number
  rejectionsByReason: Partial<Record<FitGateReason, number>>
  sampleRejectedCandidates: ProposalFitDiagnosticRejectedCandidate[]
}

export type ProposalFitDiagnostics = {
  policy: {
    enforcement: 'hard_gate'
    scope: 'all_modules'
    missingDataPolicy: 'fail_open'
    costMode: 'none'
    dataSource: 'mat_fit_model_v1'
  }
  summary: {
    rows: number
    candidatesEvaluated: number
    candidatesRejected: number
    failOpenCount: number
    rowsHardRejected: number
  }
  rows: ProposalFitDiagnosticRow[]
}

export type ProposalFpgaResourcePlanningFamily = {
  family: string
  boardModel: string
  boardsUsed: number
  /** 1-based index when the same family spans multiple boards (e.g. IO316 #1, IO316 #2) */
  boardIndex?: number
  coveredRows: string[]
  /** Extension / interface board IDs attached to this board (e.g. ["IO316-21"]) */
  extensions?: string[]
  resources: Array<{
    key: FitResourceKey
    used: number
    available: number
    headroom: number
    utilizationPct: number
  }>
  bottleneckResource: FitResourceKey
  headroomPctMin: number
  confidence: 'high' | 'partial'
}

export type ProposalFpgaResourcePlanning = {
  familiesUsed: number
  boardsUsed: number
  generatedFrom: 'mat_fit_model_v1'
  families: ProposalFpgaResourcePlanningFamily[]
}

export type ClosedLoopRate = '10k' | '100k' | 'above100k'

export type ProposalGenerateRequest = {
  machineId: string
  machineName: string
  version: string
  requirements: RequirementRow[]
  /** Maximum I/O module slots in the base configuration */
  maxSlots?: number
  /** Maximum I/O module slots with expansion units */
  maxSlotsExpanded?: number
  /** Optional optimization profile (defaults to balanced/current behavior). */
  optimizationProfile?: OptimizationProfile
  /** Fastest closed-loop control rate (RCP) / simulation step size (HIL) */
  closedLoopRate?: ClosedLoopRate
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
  /** The best-matching config package for this module given the requirement context */
  selectedConfigPackage?: string
  /** Warning if the selected config package cannot satisfy channel requirements */
  configPackageWarning?: string
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
  /** Optimization profile that was applied by the simulator. */
  optimizationProfileApplied?: OptimizationProfile
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
  /** Candidate fit-gate diagnostics sourced from MAT-derived fit model. */
  fitDiagnostics?: ProposalFitDiagnostics
  /** FPGA per-family resource planning summary and headroom. */
  fpgaResourcePlanning?: ProposalFpgaResourcePlanning
  /** FPGA families swapped to dedicated modules because satellite overhead exceeded savings */
  fpgaOverheadSwaps?: FpgaOverheadSwap[]
  /** Software / service recommendations (custom configs, HCIP, blocksets) */
  softwareRecommendations?: SoftwareRecommendation[]
}

/** One FPGA-to-dedicated swap performed by the module-count guard */
export type FpgaOverheadSwap = {
  family: string
  fpgaCount: number
  dedicatedCount: number
  /** The dedicated modules that replaced the FPGA family */
  replacements: { moduleId: string; friendlyName: string; units: number }[]
}

/**
 * A software / service recommendation emitted when the pre-built config
 * package cannot satisfy channel demands.  Two flavours:
 *   - "custom-config" — Speedgoat creates a custom bitstream
 *   - "hcip"          — customer self-service HDL Coder Integration Package
 *   - "blockset"       — HDL I/O Blockset (303MOT / 303COM)
 */
export type SoftwareRecommendation = {
  /** Item code (e.g. "3A34IP", "303MOT", or synthetic like "CUSTOM-IO335") */
  itemCode: string
  /** Human-readable name */
  name: string
  /** Recommendation category */
  category: 'custom-config' | 'hcip' | 'blockset'
  /** Why this is recommended */
  reason: string
  /** Which FPGA module triggered this recommendation */
  forModuleId: string
  /** FPGA family name */
  forFpgaFamily: string
}
