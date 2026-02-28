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
  confidence: number
  rationale: string
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
}
