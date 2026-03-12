import {
  MOCK_MODULE_CATALOG,
  type MockModuleCatalogEntry,
  FPGA_CODE_MODULE_COMPAT,
  SUB_ID_TO_CODE_MODULES,
  SUB_ID_EXTENSION_PREFERENCE,
  IO_INTERFACE_EXTENSIONS,
  IO_INTERFACE_BOARDS,
} from '@/lib/proposal/catalog'
import { createSeededRandom, hashObject, hashString } from '@/lib/proposal/seed'
import { evaluateModuleFit, isFitCodeModuleCompatibleWithBoard, getEffectiveSignalCapacity, resolveFitCodeModuleForRow } from '@/lib/proposal/fit/evaluator'
import {
  selectBestConfigPackage,
  validateConfigPackageChannels,
  PROTOCOL_TO_SUB_ID,
  FPGA_CODE_MODULE_PROTOCOLS,
  PROGRAMMABLE_ONLY_FAMILIES,
  FPGA_FAMILY_HCIP,
  CODE_MODULE_BLOCKSET,
} from '@/lib/proposal/configPackages'
import { computeFpgaResourcePlanning } from '@/lib/proposal/fit/resourcePlanning'
import { getBoardModel } from '@/lib/proposal/fit/model'
import boardExtensionsOverride from '@/lib/proposal/data/boardExtensionsOverride.json'
import {
  buildFitDiagnostics,
  createFitDiagnosticsAccumulator,
  getTopFitRejectionReasons,
  recordFitEvaluation,
  wasRowHardRejectedByFit,
  type FitDiagnosticsAccumulator,
} from '@/lib/proposal/fit/types'
import type {
  OptimizationProfile,
  ProposalGenerateRequest,
  ProposalGenerateResponse,
  ProposalRecommendedModule,
  ProposalRowDiff,
  ProposalSpecDiff,
  ProposalUnresolvedRow,
  RequirementRow,
  FpgaOverheadSwap,
  SoftwareRecommendation,
} from '@/components/configurator/proposalTypes'

export type CandidateScore = {
  module: MockModuleCatalogEntry
  units: number
  /** Estimated accessory boards (IO33X/extensions) introduced by this candidate for the row. */
  estimatedAccessoryUnits: number
  /** Estimated total physical items for this row candidate (main + accessory units). */
  estimatedTotalItems: number
  /** Prefer smaller modules (fewer total channels) when scores tie */
  channelCapacity: number
  tieBreaker: number
  exactCount: number
  compatibleCount: number
  mismatchCount: number
  missingCount: number
  exactPoints: number
  compatiblePoints: number
  mismatchPoints: number
  missingPoints: number
  unitsPenaltyPoints: number
  score: number
  providedSpecs: Record<string, string>
  specDiffs: ProposalSpecDiff[]
  /** Bonus from consolidation (reuse of same module for multiple rows) */
  consolidationBonus: number
  /** Bonus from machine compatibility */
  machineBonus: number
  /** Proactive bonus for FPGA families that cover multiple requirement rows */
  fpgaLookAheadBonus: number
  /** Penalty for end-of-life / discontinued modules */
  lifecyclePenalty: number
  /** Bonus when module config packages match the requirement signal context */
  configPackageBonus: number
  /** Name of the best-matching config package for this candidate, if any */
  selectedConfigPackage?: string
  /** Bonus for simulink-programmable (+3) or configurable (+1) FPGA category */
  fpgaCategoryBonus: number
  /** Bonus for dedicated (non-FPGA) modules: simpler deployment, no accessories */
  dedicatedSimplicityBonus: number
  /** Penalty for expected interface/extension overhead introduced by this candidate. */
  interfaceOverheadPenalty: number
}

type OptimizationPolicy = {
  profile: OptimizationProfile
  sortMode: 'legacy' | 'min_modules' | 'prefer_fpga'
  fpgaSwapMode: 'strict' | 'aggressive' | 'conservative'
  weights: {
    exact: number
    compatible: number
    mismatch: number
    missing: number
    unitsPenalty: number
    consolidationBonus: number
    fpgaLookAheadPerExtraRow: number
    machineBonus: number
    lifecycleDiscontinuedPenalty: number
    lifecycleEolPenalty: number
    configPackageBonus: number
    fpgaCategorySimulinkBonus: number
    fpgaCategoryConfigurableBonus: number
    dedicatedSimplicityBonus: number
    interfaceOverheadPenalty: number
  }
}

const DEFAULT_OPTIMIZATION_PROFILE: OptimizationProfile = 'balanced'

const OPTIMIZATION_POLICIES: Record<OptimizationProfile, OptimizationPolicy> = {
  balanced: {
    profile: 'balanced',
    sortMode: 'legacy',
    fpgaSwapMode: 'strict',
    weights: {
      exact: 12,
      compatible: 6,
      mismatch: 10,
      missing: 8,
      unitsPenalty: 2,
      consolidationBonus: 10,
      fpgaLookAheadPerExtraRow: 8,
      machineBonus: 5,
      lifecycleDiscontinuedPenalty: 20,
      lifecycleEolPenalty: 10,
      configPackageBonus: 4,
      fpgaCategorySimulinkBonus: 0,   // DISABLED — programmable vs configurable is a customer decision, not a scoring factor (see §16 in copilot-instructions)
      fpgaCategoryConfigurableBonus: 0, // DISABLED — same reason
      dedicatedSimplicityBonus: 4,
      interfaceOverheadPenalty: 3,
    },
  },
  min_modules: {
    profile: 'min_modules',
    sortMode: 'min_modules',
    fpgaSwapMode: 'aggressive',
    weights: {
      exact: 12,
      compatible: 6,
      mismatch: 10,
      missing: 8,
      unitsPenalty: 4,
      consolidationBonus: 6,
      fpgaLookAheadPerExtraRow: 4,
      machineBonus: 4,
      lifecycleDiscontinuedPenalty: 22,
      lifecycleEolPenalty: 12,
      configPackageBonus: 2,
      fpgaCategorySimulinkBonus: 0,
      fpgaCategoryConfigurableBonus: 0,
      dedicatedSimplicityBonus: 6,
      interfaceOverheadPenalty: 8,
    },
  },
  prefer_fpga: {
    profile: 'prefer_fpga',
    sortMode: 'prefer_fpga',
    fpgaSwapMode: 'conservative',
    weights: {
      exact: 12,
      compatible: 6,
      mismatch: 10,
      missing: 8,
      unitsPenalty: 1,
      consolidationBonus: 12,
      fpgaLookAheadPerExtraRow: 12,
      machineBonus: 5,
      lifecycleDiscontinuedPenalty: 18,
      lifecycleEolPenalty: 8,
      configPackageBonus: 4,
      fpgaCategorySimulinkBonus: 0,   // DISABLED — programmable vs configurable is a customer decision, not a scoring factor
      fpgaCategoryConfigurableBonus: 0, // DISABLED — same reason
      dedicatedSimplicityBonus: 0,
      interfaceOverheadPenalty: 1,
    },
  },
}

function resolveOptimizationPolicy(profile?: OptimizationProfile): OptimizationPolicy {
  if (!profile) return OPTIMIZATION_POLICIES[DEFAULT_OPTIMIZATION_PROFILE]
  return OPTIMIZATION_POLICIES[profile] ?? OPTIMIZATION_POLICIES[DEFAULT_OPTIMIZATION_PROFILE]
}

type SpecMatch = {
  status: 'exact' | 'compatible' | 'mismatch' | 'missing'
  provided: string
}

/**
 * Config-profile aliases (e.g. IO3xx-Enc / IO3xx-Res) represent a software
 * configuration on a physical FPGA family board. For BOM/model presentation,
 * canonicalize them to the physical board family ID.
 */
function getCanonicalModuleId(module: MockModuleCatalogEntry): string {
  if (module.fpgaFamily && /^IO3xx-/i.test(module.moduleId)) return module.fpgaFamily
  return module.moduleId
}

function getRecommendedDisplayModule(module: MockModuleCatalogEntry): MockModuleCatalogEntry {
  const canonicalId = getCanonicalModuleId(module)
  if (canonicalId === module.moduleId) return module
  return {
    ...module,
    moduleId: canonicalId,
    technicalName: canonicalId,
    friendlyName: `Configurable FPGA I/O (${canonicalId})`,
  }
}

function estimateAccessoryUnitsForCandidate(row: RequirementRow, module: MockModuleCatalogEntry, units: number): number {
  if (!module.fpgaFamily || units <= 0) return 0

  let accessoryPerUnit = 0
  const specsText = Object.values(row.specs).join(' ').toLowerCase()
  const hasRS422orRS485 = specsText.includes('rs422') || specsText.includes('rs485')

  // IO332/IO333 and similar blank-slate boards need one IO33X interface board per base board.
  if (module.supportsIOInterfaces === true) {
    accessoryPerUnit += 1
  }

  // Optional extension estimation for profile-aware ranking.
  if (module.supportsIOExtensions !== false) {
    const supported = module.fpgaFamily ? getSupportedExtensionsForFamily(module.fpgaFamily) : new Set<string>()
    if (row.subId === 'resolver' && (supported.size === 0 || supported.has('-24'))) accessoryPerUnit += 1 // -24
    if (hasRS422orRS485 && module.supportsIOInterfaces !== true && (supported.size === 0 || supported.has('-22'))) accessoryPerUnit += 1 // -22
    if (row.categoryId === 'analog' && module.supportsIOInterfaces !== true && (supported.size === 0 || supported.has('-120'))) accessoryPerUnit += 1 // -120
    if (SUB_ID_EXTENSION_PREFERENCE[row.subId]) accessoryPerUnit += 1
  }

  return accessoryPerUnit * units
}

function compareCandidatesByPolicy(left: CandidateScore, right: CandidateScore, policy: OptimizationPolicy): number {
  if (policy.sortMode === 'legacy') {
    if (left.units !== right.units) return left.units - right.units
    if (left.score !== right.score) return right.score - left.score
    if (left.channelCapacity !== right.channelCapacity) return left.channelCapacity - right.channelCapacity
    if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker
    return left.module.moduleId.localeCompare(right.module.moduleId)
  }

  if (policy.sortMode === 'min_modules') {
    if (left.estimatedTotalItems !== right.estimatedTotalItems) return left.estimatedTotalItems - right.estimatedTotalItems
    if (left.units !== right.units) return left.units - right.units
    if (left.score !== right.score) return right.score - left.score
    if (left.channelCapacity !== right.channelCapacity) return left.channelCapacity - right.channelCapacity
    if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker
    return left.module.moduleId.localeCompare(right.module.moduleId)
  }

  // prefer_fpga: prioritize score signal first, then footprint.
  if (left.score !== right.score) return right.score - left.score
  if (left.estimatedTotalItems !== right.estimatedTotalItems) return left.estimatedTotalItems - right.estimatedTotalItems
  if (left.units !== right.units) return left.units - right.units
  if (left.channelCapacity !== right.channelCapacity) return left.channelCapacity - right.channelCapacity
  if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker
  return left.module.moduleId.localeCompare(right.module.moduleId)
}

export function simulateProposal(request: ProposalGenerateRequest): ProposalGenerateResponse {
  const policy = resolveOptimizationPolicy(request.optimizationProfile)
  const normalizedRequirements = normalizeRequirements(request.requirements)
  const seedInput = buildSeedInput({ ...request, requirements: normalizedRequirements })
  const seededRandom = createSeededRandom(seedInput)
  const moduleUsage = new Map<string, number>()
  const fitAccumulator = createFitDiagnosticsAccumulator(normalizedRequirements)

  // ── FPGA look-ahead: pre-scan all rows to find multi-row FPGA coverage ──
  const fpgaCoverageMap = computeFpgaCoverageMap(normalizedRequirements, request.machineId)

  const recommended = new Map<
    string,
    {
      module: MockModuleCatalogEntry
      quantity: number
      coveredChannels: number
      coveredRows: Set<string>
      rationale: Set<string>
      /** Set during consolidation — physical I/O line usage for FPGA modules */
      ioLineUtilization?: { used: number; total: number }
      /** For synthetic interface/extension entries: the parent FPGA module ID */
      interfaceForModule?: string
      /** Best-matching config package, propagated from candidate scoring */
      selectedConfigPackage?: string
      /** Warning if config package channel limits exceeded */
      configPackageWarning?: string
    }
  >()

  const rowDiffs: ProposalRowDiff[] = []
  const unresolved: ProposalUnresolvedRow[] = []
  const machineWarnings: string[] = []
  let coveredChannels = 0

  normalizedRequirements.forEach((row) => {
    const candidate = selectBestCandidate(
      row,
      moduleUsage,
      seededRandom,
      policy,
      request.machineId,
      fpgaCoverageMap,
      /* excludeFpga */ false,
      fitAccumulator
    )
    if (!candidate) {
      const unresolvedEntry = buildUnresolvedRow(row, fitAccumulator)
      unresolved.push(unresolvedEntry)
      rowDiffs.push({
        rowId: row.rowId,
        categoryId: row.categoryId,
        subId: row.subId,
        categoryLabel: row.categoryLabel,
        subLabel: row.subLabel,
        quantityRequested: row.quantity,
        quantityCovered: 0,
        status: 'unresolved',
        requestedSpecs: row.specs,
        providedSpecs: {},
        specDiffs: Object.entries(row.specs).map(([key, requested]) => ({
          key,
          requested,
          provided: 'Not available',
          status: 'unresolved',
        })),
        moduleRefs: [],
        notes: [unresolvedEntry.reason],
      })
      return
    }

    coveredChannels += row.quantity
    const moduleKey = getCanonicalModuleId(candidate.module)
    const displayModule = getRecommendedDisplayModule(candidate.module)
    moduleUsage.set(moduleKey, (moduleUsage.get(moduleKey) || 0) + candidate.units)

    const rowStatus: ProposalRowDiff['status'] =
      candidate.mismatchCount === 0 && candidate.missingCount === 0 ? 'exact' : 'partial'
    const notes: string[] = []
    if (candidate.units > 1) {
      notes.push(`Split across ${candidate.units} modules due to channel capacity.`)
    }
    if (candidate.mismatchCount > 0 || candidate.missingCount > 0) {
      notes.push('Some requested specs were approximated.')
    }

    rowDiffs.push({
      rowId: row.rowId,
      categoryId: row.categoryId,
      subId: row.subId,
      categoryLabel: row.categoryLabel,
      subLabel: row.subLabel,
      quantityRequested: row.quantity,
      quantityCovered: row.quantity,
      status: rowStatus,
      requestedSpecs: row.specs,
      providedSpecs: candidate.providedSpecs,
      specDiffs: candidate.specDiffs,
      moduleRefs: [moduleKey],
      notes,
    })

    const moduleState = recommended.get(moduleKey)
    const rationale = buildRationale(row, candidate)
    if (moduleState) {
      moduleState.quantity += candidate.units
      moduleState.coveredChannels += row.quantity
      moduleState.coveredRows.add(row.rowId)
      moduleState.rationale.add(rationale)
    } else {
      recommended.set(moduleKey, {
        module: displayModule,
        quantity: candidate.units,
        coveredChannels: row.quantity,
        coveredRows: new Set([row.rowId]),
        rationale: new Set([rationale]),
        selectedConfigPackage: candidate.selectedConfigPackage,
      })
    }
  })

  // --- FPGA post-processing: consolidate boards & add smart interfaces ------
  consolidateFpgaModules(rowDiffs, recommended)
  addFpgaInterfaceBoards(recommended, rowDiffs)
  // --- Config package channel validation: warn if selected config can't cover demands ---
  validateConfigPackageChannelLimits(recommended, rowDiffs)
  // --- Software / service recommendations (custom config, HCIP, blocksets) ---
  const softwareRecommendations = generateSoftwareRecommendations(recommended, rowDiffs)
  // --- FPGA overhead guard: swap to dedicated when satellite count exceeds savings ---
  const fpgaOverheadSwaps = validateFpgaOverhead(
    recommended,
    rowDiffs,
    normalizedRequirements,
    moduleUsage,
    seededRandom,
    policy,
    request.machineId,
    fpgaCoverageMap
  )
  // --- Dedicated module consolidation: merge identical dedicated modules ---
  consolidateDedicatedModules(recommended)

  const recommendedModules: ProposalRecommendedModule[] = Array.from(recommended.values())
    .map((entry) => ({
      moduleId: entry.module.moduleId,
      friendlyName: entry.module.friendlyName,
      technicalName: entry.module.technicalName,
      quantity: entry.quantity,
      coveredChannels: entry.coveredChannels,
      coveredRows: Array.from(entry.coveredRows),
      rationale: Array.from(entry.rationale).join(' '),
      // Enriched fields from catalog
      ...(entry.module.formFactor && { formFactor: entry.module.formFactor }),
      ...(entry.module.lifecycleStatus && { lifecycleStatus: entry.module.lifecycleStatus }),
      ...(entry.module.voltageRange && { voltageRange: entry.module.voltageRange }),
      ...(entry.module.sampleRateHz && { sampleRateHz: entry.module.sampleRateHz }),
      ...(entry.module.resolutionBits && { resolutionBits: entry.module.resolutionBits }),
      ...(entry.module.fpgaLogicCells && { fpgaLogicCells: entry.module.fpgaLogicCells }),
      ...(entry.module.configPackages && { configPackages: entry.module.configPackages }),
      ...(entry.selectedConfigPackage && { selectedConfigPackage: entry.selectedConfigPackage }),
      ...(entry.configPackageWarning && { configPackageWarning: entry.configPackageWarning }),
      ...(entry.module.webSourcePage && { webSourcePage: entry.module.webSourcePage }),
      // FPGA grouping & utilization
      ...(entry.module.fpgaCategory && { fpgaCategory: entry.module.fpgaCategory as 'simulink-programmable' | 'configurable' }),
      ...(entry.interfaceForModule && { interfaceForModule: entry.interfaceForModule }),
      ...(entry.ioLineUtilization && { ioLineUtilization: entry.ioLineUtilization }),
    }))
    .sort((left, right) => {
      if (left.quantity !== right.quantity) return left.quantity - right.quantity
      return left.friendlyName.localeCompare(right.friendlyName)
    })

  const requestedChannels = normalizedRequirements.reduce((sum, row) => sum + row.quantity, 0)
  const moduleCount = recommendedModules.reduce((sum, module) => sum + module.quantity, 0)
  const proposalHash = hashObject({ seedInput, requestedChannels, moduleCount, unresolved: unresolved.length })

  // Machine slot warnings
  const maxSlots = request.maxSlots ?? 99
  const maxSlotsExpanded = request.maxSlotsExpanded ?? 99
  if (moduleCount > maxSlotsExpanded) {
    machineWarnings.push(
      `This configuration requires ${moduleCount} module slots, but ${request.machineName} supports a maximum of ${maxSlotsExpanded} (with expansion). Consider a larger machine or reducing I/O requirements.`
    )
  } else if (moduleCount > maxSlots) {
    machineWarnings.push(
      `This configuration requires ${moduleCount} module slots. ${request.machineName} has ${maxSlots} base slots — you will need an expansion unit (up to ${maxSlotsExpanded} slots available).`
    )
  }

  const fitDiagnostics = buildFitDiagnostics(fitAccumulator, normalizedRequirements.length)
  const fpgaResourcePlanning = computeFpgaResourcePlanning(
    Array.from(recommended.values()).map((entry) => ({
      moduleId: entry.module.moduleId,
      fpgaFamily: entry.module.fpgaFamily,
      quantity: entry.quantity,
      coveredRows: entry.coveredRows,
      interfaceForModule: entry.interfaceForModule,
    })),
    rowDiffs
  )

  return {
    proposalId: `SP-${proposalHash.toString(16).toUpperCase().slice(0, 8)}`,
    generatedAt: new Date().toISOString(),
    optimizationProfileApplied: policy.profile,
    summary: {
      requestedChannels,
      coveredChannels,
      unresolvedCount: unresolved.length,
      moduleCount,
    },
    recommendedModules,
    rowDiffs,
    unresolved,
    machineWarnings: machineWarnings.length > 0 ? machineWarnings : undefined,
    fitDiagnostics,
    fpgaResourcePlanning,
    fpgaOverheadSwaps: fpgaOverheadSwaps.length > 0 ? fpgaOverheadSwaps : undefined,
    softwareRecommendations: softwareRecommendations.length > 0 ? softwareRecommendations : undefined,
  }
}

// ─── Extended simulation: expose all candidates per row ─────────────────────

export type PerRowCandidates = {
  rowId: string
  categoryId: string
  subId: string
  categoryLabel: string
  subLabel: string
  quantity: number
  allCandidates: CandidateScore[]
  winner: CandidateScore | null
}

export type SimulationWithCandidates = {
  response: ProposalGenerateResponse
  perRow: PerRowCandidates[]
  fpgaConsolidation: { before: number; after: number } | null
  fpgaOverheadSwaps: FpgaOverheadSwap[]
  catalogSize: number
}

/**
 * Run the full proposal simulator AND return per-row candidate lists,
 * FPGA consolidation before/after, and catalog metadata.
 */
export function simulateProposalWithCandidates(request: ProposalGenerateRequest): SimulationWithCandidates {
  const policy = resolveOptimizationPolicy(request.optimizationProfile)
  const response = simulateProposal(request)

  // Re-run candidate selection to capture ALL scored candidates per row
  const normalizedRequirements = normalizeRequirements(request.requirements)
  const seedInput = buildSeedInput({ ...request, requirements: normalizedRequirements })
  const seededRandom = createSeededRandom(seedInput)
  const moduleUsage = new Map<string, number>()
  const fpgaCoverageMap = computeFpgaCoverageMap(normalizedRequirements, request.machineId)
  const perRow: PerRowCandidates[] = []

  for (const row of normalizedRequirements) {
    const { allCandidates, winner } = selectAllCandidates(row, moduleUsage, seededRandom, policy, request.machineId, fpgaCoverageMap)
    perRow.push({
      rowId: row.rowId,
      categoryId: row.categoryId,
      subId: row.subId,
      categoryLabel: row.categoryLabel,
      subLabel: row.subLabel,
      quantity: row.quantity,
      allCandidates,
      winner,
    })
    // Track usage the same way as the main loop so consolidation bonuses are consistent
    if (winner) {
      const moduleKey = getCanonicalModuleId(winner.module)
      moduleUsage.set(moduleKey, (moduleUsage.get(moduleKey) || 0) + winner.units)
    }
  }

  // Calculate FPGA consolidation before/after
  let fpgaConsolidation: { before: number; after: number } | null = null
  const fpgaModules = response.recommendedModules.filter((m) => {
    const catEntry = MOCK_MODULE_CATALOG.find((c) => c.moduleId === m.moduleId)
    return catEntry?.fpgaFamily
  })
  if (fpgaModules.length > 0) {
    // "Before" = sum of units each FPGA-backed row would need individually
    let beforeCount = 0
    for (const pr of perRow) {
      if (pr.winner) {
        const catEntry = MOCK_MODULE_CATALOG.find((c) => c.moduleId === pr.winner!.module.moduleId)
        if (catEntry?.fpgaFamily) beforeCount += pr.winner.units
      }
    }
    const afterCount = fpgaModules.reduce((sum, m) => sum + m.quantity, 0)
    if (beforeCount > afterCount) {
      fpgaConsolidation = { before: beforeCount, after: afterCount }
    }
  }

  return {
    response,
    perRow,
    fpgaConsolidation,
    fpgaOverheadSwaps: response.fpgaOverheadSwaps ?? [],
    catalogSize: MOCK_MODULE_CATALOG.length,
  }
}

function selectAllCandidates(
  row: RequirementRow,
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  policy: OptimizationPolicy,
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>,
  excludeFpga?: boolean,
  fitAccumulator?: FitDiagnosticsAccumulator
): { allCandidates: CandidateScore[]; winner: CandidateScore | null } {
  const isFpgaProtocol = isFpgaCodeModuleProtocolRow(row)
  const fpgaProtocolSubId = getFpgaProtocolSubId(row)

  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (excludeFpga && entry.fpgaFamily) return false
    if (!isMachineCompatible(entry, machineId)) return false

    // For FPGA code-module protocols (SPI, I2C, etc.): include FPGA modules
    // that support the equivalent sub-ID, in addition to dedicated comms boards
    if (isFpgaProtocol && entry.fpgaFamily && fpgaProtocolSubId) {
      const codeModules = SUB_ID_TO_CODE_MODULES[fpgaProtocolSubId]
      if (codeModules && codeModules.length > 0) {
        const remappedRow: RequirementRow = { ...row, subId: fpgaProtocolSubId }
        if (isFpgaCodeModuleCompatible(entry, remappedRow)) return true
      }
    }

    // Standard category/sub filter
    if (entry.categoryCoverage !== row.categoryId) return false
    if (!entry.subCoverage.includes(row.subId)) return false
    return true
  })

  if (candidates.length === 0) return { allCandidates: [], winner: null }

  const scoredCandidates = candidates
    .map((candidate) =>
      evaluateCandidate(row, candidate, moduleUsage, seededRandom, policy, machineId, fpgaCoverageMap, fitAccumulator)
    )
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))

  if (scoredCandidates.length === 0) return { allCandidates: [], winner: null }

  scoredCandidates.sort((left, right) => compareCandidatesByPolicy(left, right, policy))

  // Deduplicate by moduleId — the same physical board can appear via multiple
  // catalog entries (e.g. IO316 as digital + motion). Keep only the highest-
  // scoring entry per module (first occurrence after sort).
  const seenIds = new Set<string>()
  const deduped = scoredCandidates.filter(c => {
    if (seenIds.has(c.module.moduleId)) return false
    seenIds.add(c.module.moduleId)
    return true
  })

  return { allCandidates: deduped, winner: deduped[0] }
}

function normalizeRequirements(requirements: RequirementRow[]): RequirementRow[] {
  return requirements
    .filter((row) => row.quantity > 0)
    .map((row) => ({
      ...row,
      specs: Object.fromEntries(
        Object.entries(row.specs)
          .filter(([, value]) => Boolean(value))
          .sort(([left], [right]) => left.localeCompare(right))
      ),
    }))
    .sort((left, right) => {
      const categoryCompare = left.categoryId.localeCompare(right.categoryId)
      if (categoryCompare !== 0) return categoryCompare
      const subCompare = left.subId.localeCompare(right.subId)
      if (subCompare !== 0) return subCompare
      const quantityCompare = left.quantity - right.quantity
      if (quantityCompare !== 0) return quantityCompare
      return left.rowId.localeCompare(right.rowId)
    })
}

function buildSeedInput(request: ProposalGenerateRequest): string {
  return JSON.stringify({
    machineId: request.machineId,
    machineName: request.machineName,
    version: request.version,
    optimizationProfile: request.optimizationProfile ?? DEFAULT_OPTIMIZATION_PROFILE,
    requirements: request.requirements,
  })
}

/**
 * Check if a communication/protocols row requests an FPGA code-module protocol
 * (SPI, I2C, Serial, SENT, Dshot). These protocols are implemented via FPGA
 * bitstreams, not dedicated hardware, so they need to be routed to FPGA modules.
 */
function isFpgaCodeModuleProtocolRow(row: RequirementRow): boolean {
  if (row.categoryId !== 'communication' || row.subId !== 'protocols') return false
  const protocol = row.specs.range || row.specs.resolution || ''
  return FPGA_CODE_MODULE_PROTOCOLS.has(protocol)
}

/**
 * For FPGA code-module protocol rows, return the equivalent sub-ID that maps
 * to SUB_ID_TO_CODE_MODULES (e.g. 'SPI' → 'spi'). Returns undefined if not a
 * code-module protocol.
 */
function getFpgaProtocolSubId(row: RequirementRow): string | undefined {
  if (row.categoryId !== 'communication' || row.subId !== 'protocols') return undefined
  const protocol = row.specs.range || row.specs.resolution || ''
  return PROTOCOL_TO_SUB_ID[protocol]
}

/**
 * Build synthetic supportedSpecs for an FPGA module serving a protocol row.
 *
 * FPGA catalog entries only carry analog/digital hardware specs (e.g. "TTL 5 V",
 * "16-bit"). When an FPGA module wins a Communication/Protocols row (SPI, I2C, etc.),
 * comparing those hardware specs against protocol requirements produces nonsensical
 * results ("Provided: TTL 5 V" for a requested protocol of "SPI").
 *
 * This function synthesizes protocol-appropriate specs from the FPGA family's
 * code-module compatibility so the spec comparison and display are meaningful.
 */
function getFpgaProtocolSpecs(
  module: MockModuleCatalogEntry,
  requestedProtocol: string
): Record<string, string[]> {
  const family = module.fpgaFamily
  const compatModules = family ? FPGA_CODE_MODULE_COMPAT[family] : undefined

  // Build list of protocols this FPGA supports (from code-module compat)
  const supportedProtocols: string[] = []
  for (const [protocol, subId] of Object.entries(PROTOCOL_TO_SUB_ID) as [string, string][]) {
    const codeModules = SUB_ID_TO_CODE_MODULES[subId as keyof typeof SUB_ID_TO_CODE_MODULES]
    if (codeModules && compatModules && codeModules.some((cm: string) => compatModules.has(cm))) {
      supportedProtocols.push(protocol)
    }
  }
  // Deduplicate (UART and Serial both map to 'serial')
  const uniqueProtocols = [...new Set(supportedProtocols)]

  return {
    range: uniqueProtocols,                              // e.g. ["SPI", "I2C", "Serial", ...]
    resolution: [requestedProtocol],                     // Protocol name echoed back (resolution = protocol type for comm rows)
    speed: module.supportedSpecs['speed'] ?? [],         // Keep FPGA's native speed specs (MHz values are reasonable)
  }
}

function selectBestCandidate(
  row: RequirementRow,
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  policy: OptimizationPolicy,
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>,
  excludeFpga?: boolean,
  fitAccumulator?: FitDiagnosticsAccumulator
): CandidateScore | null {
  const isFpgaProtocol = isFpgaCodeModuleProtocolRow(row)
  const fpgaProtocolSubId = getFpgaProtocolSubId(row)

  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (excludeFpga && entry.fpgaFamily) return false
    if (!isMachineCompatible(entry, machineId)) return false

    // For FPGA code-module protocols (SPI, I2C, etc.): include FPGA modules
    // that support the equivalent sub-ID, in addition to dedicated comms boards
    if (isFpgaProtocol && entry.fpgaFamily && fpgaProtocolSubId) {
      const codeModules = SUB_ID_TO_CODE_MODULES[fpgaProtocolSubId]
      if (codeModules && codeModules.length > 0) {
        // Check FPGA code-module compatibility using the remapped sub-ID
        const remappedRow: RequirementRow = { ...row, subId: fpgaProtocolSubId }
        if (isFpgaCodeModuleCompatible(entry, remappedRow)) return true
      }
    }

    // Standard category/sub filter
    if (entry.categoryCoverage !== row.categoryId) return false
    if (!entry.subCoverage.includes(row.subId)) return false
    return true
  })

  if (candidates.length === 0) return null

  const scoredCandidates = candidates
    .map((candidate) =>
      evaluateCandidate(row, candidate, moduleUsage, seededRandom, policy, machineId, fpgaCoverageMap, fitAccumulator)
    )
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))

  if (scoredCandidates.length === 0) return null

  scoredCandidates.sort((left, right) => compareCandidatesByPolicy(left, right, policy))

  // Deduplicate by moduleId — keep only the highest-scoring entry per physical
  // module when multiple catalog entries for the same board pass the filter.
  const seenIds = new Set<string>()
  const deduped = scoredCandidates.filter(c => {
    if (seenIds.has(c.module.moduleId)) return false
    seenIds.add(c.module.moduleId)
    return true
  })

  return deduped[0]
}

/**
 * Check if an FPGA module supports the code module(s) required by a row's sub-ID.
 * Non-FPGA modules always pass. Uses the fit model's FPGA resource data when
 * available; falls back to the hardcoded FPGA_CODE_MODULE_COMPAT map for boards
 * whose fit model data is incomplete (zero resources or missing board entry).
 */
function isFpgaCodeModuleCompatible(module: MockModuleCatalogEntry, row: RequirementRow): boolean {
  if (!module.fpgaFamily) return true
  const requiredCodeModules = SUB_ID_TO_CODE_MODULES[row.subId]
  if (!requiredCodeModules || requiredCodeModules.length === 0) return true

  // Primary path: fit model resource-based compatibility
  const fitResult = isFitCodeModuleCompatibleWithBoard(module.moduleId, row)
    ?? isFitCodeModuleCompatibleWithBoard(module.fpgaFamily, row)
  if (fitResult !== null) return fitResult

  // Fallback: hardcoded compat map (covers data gaps — e.g. IO337 has zero resources)
  const supported = FPGA_CODE_MODULE_COMPAT[module.fpgaFamily]
  if (!supported) return true // unknown family → permissive
  return requiredCodeModules.some(cm => supported.has(cm))
}

/**
 * Hard gate: reject modules whose `compatibleMachines` explicitly excludes
 * the selected target machine. Modules with no `compatibleMachines` are
 * treated as universal (compatible with all machines).
 */
function isMachineCompatible(module: MockModuleCatalogEntry, machineId?: string): boolean {
  if (!machineId) return true
  if (!module.compatibleMachines || module.compatibleMachines.length === 0) return true
  return module.compatibleMachines.includes(machineId)
}

function evaluateCandidate(
  row: RequirementRow,
  module: MockModuleCatalogEntry,
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  policy: OptimizationPolicy,
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>,
  fitAccumulator?: FitDiagnosticsAccumulator
): CandidateScore | null {
  // Protocol gate: for dedicated (non-FPGA) communication modules, check protocolSupport.
  // FPGA modules bypass this — they're gated by code-module compatibility instead.
  if (row.categoryId === 'communication' && !module.fpgaFamily) {
    const requestedProtocol = row.specs.range
    if (requestedProtocol && (!module.protocolSupport || !module.protocolSupport.includes(requestedProtocol))) {
      return null
    }
  }

  // For FPGA modules handling a code-module protocol, use the remapped sub-ID for compat
  const effectiveRow = (module.fpgaFamily && isFpgaCodeModuleProtocolRow(row))
    ? { ...row, subId: getFpgaProtocolSubId(row) ?? row.subId }
    : row

  // Gate: FPGA modules must support the code module required by this row's sub-ID
  if (!isFpgaCodeModuleCompatible(module, effectiveRow)) {
    if (fitAccumulator) {
      recordFitEvaluation(fitAccumulator, row.rowId, module.moduleId, {
        pass: false,
        failOpen: false,
        confidence: 'high',
        reasons: ['code_module_incompatible'],
      })
    }
    return null
  }

  // Compute units needed: use fit model signal capacity when available, else channelCapacity
  const effectiveCap = getEffectiveSignalCapacity(module, row) ?? module.channelCapacity
  // For FPGA modules, also cap effective capacity by the code module's maxChannels.
  // Example: IO316 has 64 digital TTL lines, but SPI code module maxChannels=32
  // → at most 32 SPI channels per board, not 64.
  const resolvedCodeModule = module.fpgaFamily ? resolveFitCodeModuleForRow(effectiveRow) : null
  const cappedCap = resolvedCodeModule?.maxChannels && resolvedCodeModule.maxChannels > 0
    ? Math.min(effectiveCap, resolvedCodeModule.maxChannels)
    : effectiveCap
  const units = Math.max(1, Math.ceil(row.quantity / cappedCap))
  // Pass effectiveRow (with remapped subId for FPGA protocol rows) so the fit
  // evaluator can resolve the correct code module and check FPGA resources.
  const fitResult = evaluateModuleFit(effectiveRow, module, units)
  if (fitAccumulator) {
    recordFitEvaluation(fitAccumulator, row.rowId, module.moduleId, fitResult)
  }
  if (!fitResult.pass) return null

  let exactCount = 0
  let compatibleCount = 0
  let mismatchCount = 0
  let missingCount = 0
  const providedSpecs: Record<string, string> = {}
  const specDiffs: ProposalSpecDiff[] = []

  // For FPGA modules serving a protocol row, synthesize protocol-appropriate specs
  // instead of using the module's native analog/digital supportedSpecs.
  const isProtocolOnFpga = module.fpgaFamily && isFpgaCodeModuleProtocolRow(row)
  const fpgaProtocolSpecs = isProtocolOnFpga
    ? getFpgaProtocolSpecs(module, row.specs.range || row.specs.resolution || '')
    : undefined

  Object.entries(row.specs).forEach(([key, requested]) => {
    // For FPGA protocol rows, use synthesized protocol specs
    // For dedicated comm modules, fall back to protocolSupport for 'range'
    // For everything else, use the module's native supportedSpecs
    const specValues = fpgaProtocolSpecs
      ? fpgaProtocolSpecs[key] ?? module.supportedSpecs[key]
      : key === 'range' && !module.supportedSpecs[key] && module.protocolSupport
        ? module.protocolSupport
        : module.supportedSpecs[key]
    const specMatch = compareSpec(requested, specValues, key)
    providedSpecs[key] = specMatch.provided

    if (specMatch.status === 'exact') exactCount += 1
    if (specMatch.status === 'compatible') compatibleCount += 1
    if (specMatch.status === 'mismatch') mismatchCount += 1
    if (specMatch.status === 'missing') missingCount += 1

    specDiffs.push({
      key,
      requested,
      provided: specMatch.provided,
      status: specMatch.status === 'exact' ? 'exact' : specMatch.status === 'compatible' ? 'partial' : 'partial',
    })
  })

  const hasPriorUsage = moduleUsage.has(getCanonicalModuleId(module))
  // FPGA boards strongly prefer reusing the same board (consolidation will merge later)
  const consolidationBonus =
    (row.categoryId === 'communication' || module.fpgaFamily) && hasPriorUsage
      ? policy.weights.consolidationBonus
      : 0
  // ── FPGA look-ahead bonus: proactive multi-row coverage ──
  // Awards +8 per additional row this FPGA can serve beyond the first, even before it's selected.
  // Solves the chicken-and-egg: FPGA no longer needs to win row #1 on specs alone.
  const fpgaLookAheadBonus = module.fpgaFamily && fpgaCoverageMap
    ? Math.max(0, (fpgaCoverageMap.get(module.fpgaFamily) ?? 1) - 1) * policy.weights.fpgaLookAheadPerExtraRow
    : 0
  // Prefer modules compatible with the selected machine
  const machineBonus = machineId && module.compatibleMachines?.includes(machineId) ? policy.weights.machineBonus : 0
  // Penalize discontinued / end-of-life modules so active alternatives rank higher
  const lifecyclePenalty = module.lifecycleStatus === 'discontinued' ? -policy.weights.lifecycleDiscontinuedPenalty
    : module.lifecycleStatus === 'eol' ? -policy.weights.lifecycleEolPenalty
    : 0
  // Soft bonus for matching configuration packages (e.g. module has "HIL" package for HIL workflow)
  const configPkgResult = selectBestConfigPackage(module.configPackages, module.fpgaFamily, row.subId)
  const configPackageBonus = configPkgResult ? configPkgResult.bonus * policy.weights.configPackageBonus : 0
  const selectedConfigPackage = configPkgResult?.packageName
  // ── fpgaCategory bonus: DISABLED ──
  // Programmable vs configurable is a customer-level workflow decision (HCIP vs pre-built
  // config package), not a hardware quality the algorithm should prefer. The weights are
  // zeroed in all policies. Plumbing is kept so the field still flows to the score breakdown
  // and can be re-enabled if a future "workflow" input is added to the configurator.
  const fpgaCategoryBonus = module.fpgaCategory === 'simulink-programmable' ? policy.weights.fpgaCategorySimulinkBonus
    : module.fpgaCategory === 'configurable' ? policy.weights.fpgaCategoryConfigurableBonus
    : 0
  // ── Dedicated simplicity bonus: non-FPGA modules need no extensions/accessories ──
  const dedicatedSimplicityBonus = (!module.fpgaFamily && !module.fpgaCategory)
    ? policy.weights.dedicatedSimplicityBonus : 0
  const estimatedAccessoryUnits = estimateAccessoryUnitsForCandidate(row, module, units)
  const estimatedTotalItems = units + estimatedAccessoryUnits
  const interfaceOverheadPenalty = -estimatedAccessoryUnits * policy.weights.interfaceOverheadPenalty
  const exactPoints = exactCount * policy.weights.exact
  const compatiblePoints = compatibleCount * policy.weights.compatible
  const mismatchPoints = -mismatchCount * policy.weights.mismatch
  const missingPoints = -missingCount * policy.weights.missing
  const unitsPenaltyPoints = -units * policy.weights.unitsPenalty
  const score =
    exactPoints +
    compatiblePoints +
    mismatchPoints +
    missingPoints +
    unitsPenaltyPoints +
    consolidationBonus +
    fpgaLookAheadBonus +
    machineBonus +
    lifecyclePenalty +
    configPackageBonus +
    fpgaCategoryBonus +
    dedicatedSimplicityBonus +
    interfaceOverheadPenalty

  return {
    module,
    units,
    estimatedAccessoryUnits,
    estimatedTotalItems,
    channelCapacity: module.channelCapacity,
    tieBreaker: seededRandom(),
    exactCount,
    compatibleCount,
    mismatchCount,
    missingCount,
    exactPoints,
    compatiblePoints,
    mismatchPoints,
    missingPoints,
    unitsPenaltyPoints,
    score,
    providedSpecs,
    specDiffs,
    consolidationBonus,
    machineBonus,
    fpgaLookAheadBonus,
    lifecyclePenalty,
    configPackageBonus,
    selectedConfigPackage,
    fpgaCategoryBonus,
    dedicatedSimplicityBonus,
    interfaceOverheadPenalty,
  }
}

function compareSpec(requested: string, supportedValues: string[] | undefined, key: string): SpecMatch {
  if (!supportedValues || supportedValues.length === 0) {
    return {
      status: 'missing',
      provided: 'Not specified',
    }
  }

  if (supportedValues.includes(requested)) {
    return {
      status: 'exact',
      provided: requested,
    }
  }

  const compatible = supportedValues.find((option) => areValuesCompatible(requested, option, key))
  if (compatible) {
    return {
      status: 'compatible',
      provided: compatible,
    }
  }

  return {
    status: 'mismatch',
    provided: supportedValues[0],
  }
}

function areValuesCompatible(requested: string, supported: string, key: string): boolean {
  const normalizedRequested = normalizeValue(requested)
  const normalizedSupported = normalizeValue(supported)

  if (normalizedRequested.includes(normalizedSupported) || normalizedSupported.includes(normalizedRequested)) {
    return true
  }

  if (key === 'resolution') {
    const requestedBits = parseBits(requested)
    const supportedBits = parseBits(supported)
    if (requestedBits !== null && supportedBits !== null) {
      return supportedBits >= requestedBits
    }
  }

  if (key === 'speed') {
    const requestedRate = parseRate(requested)
    const supportedRate = parseRate(supported)
    if (requestedRate !== null && supportedRate !== null) {
      return supportedRate >= requestedRate
    }
  }

  return false
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function parseBits(value: string): number | null {
  const match = value.match(/(\d+)\s*-?\s*bit/i)
  if (!match) return null
  return Number.parseInt(match[1], 10)
}

function parseRate(value: string): number | null {
  const match = value.match(/(\d+(\.\d+)?)\s*(k|m|g)?(bit\/s|hz)/i)
  if (!match) return null
  const magnitude = Number.parseFloat(match[1])
  const prefix = (match[3] || '').toLowerCase()
  const factor = prefix === 'g' ? 1_000_000_000 : prefix === 'm' ? 1_000_000 : prefix === 'k' ? 1_000 : 1
  return magnitude * factor
}

function buildRationale(row: RequirementRow, candidate: CandidateScore): string {
  const exactOrCompatible = candidate.exactCount + candidate.compatibleCount
  const total = candidate.exactCount + candidate.compatibleCount + candidate.mismatchCount + candidate.missingCount
  const splitMessage = candidate.units > 1 ? ` Split into ${candidate.units} modules for channel capacity.` : ''
  const partialMessage =
    candidate.mismatchCount > 0 || candidate.missingCount > 0
      ? ` Includes ${candidate.mismatchCount + candidate.missingCount} approximated specs.`
      : ''
  return `Matched ${row.categoryLabel} ${row.subLabel} with ${exactOrCompatible}/${total} spec alignment.${splitMessage}${partialMessage}`
}

function buildUnresolvedRow(row: RequirementRow, fitAccumulator?: FitDiagnosticsAccumulator): ProposalUnresolvedRow {
  const fitBlocked = fitAccumulator ? wasRowHardRejectedByFit(fitAccumulator, row.rowId) : false
  const topReasons = fitAccumulator ? getTopFitRejectionReasons(fitAccumulator, row.rowId) : []
  const fitReasonSuffix =
    fitBlocked && topReasons.length > 0
      ? ` Dominant fit blockers: ${topReasons.join(', ')}.`
      : fitBlocked
      ? ' Dominant fit blockers were detected by the MAT fit gate.'
      : ''

  return {
    rowId: row.rowId,
    categoryLabel: row.categoryLabel,
    subLabel: row.subLabel,
    quantity: row.quantity,
    reason: `No simulated module could satisfy ${row.categoryLabel} / ${row.subLabel} with current specs.${fitReasonSuffix}`,
    suggestion: getSuggestionByCategory(row.categoryId),
  }
}

function getSuggestionByCategory(categoryId: string): string {
  if (categoryId === 'communication') return 'Try another protocol family or reduce required data rate.'
  if (categoryId === 'analog') return 'Lower range/resolution constraints or split into additional variants.'
  if (categoryId === 'digital') return 'Try a different interface class or isolate requirements into separate rows.'
  if (categoryId === 'motion') return 'Split encoder/resolver requirements or reduce signal rate.'
  return 'Adjust one or more detailed specs and generate again.'
}

/**
 * Pre-scan all requirement rows to build a map of FPGA family → number of rows
 * that family could potentially serve. Used for the look-ahead bonus so FPGA
 * modules get credit for multi-row consolidation *before* being selected.
 *
 * For each row, finds all FPGA catalog entries that match its category/sub and
 * pass the code-module compatibility gate, then increments the family counter.
 */
function computeFpgaCoverageMap(rows: RequirementRow[], machineId?: string): Map<string, number> {
  const coverageMap = new Map<string, number>()
  for (const row of rows) {
    const fpgaFamiliesCoveringRow = new Set<string>()
    const fpgaProtocolSubId = getFpgaProtocolSubId(row)
    const effectiveRow = fpgaProtocolSubId ? { ...row, subId: fpgaProtocolSubId } : row

    for (const entry of MOCK_MODULE_CATALOG) {
      if (!entry.fpgaFamily) continue
      if (!isMachineCompatible(entry, machineId)) continue

      // For FPGA code-module protocol rows, check code-module compat directly
      if (fpgaProtocolSubId) {
        if (isFpgaCodeModuleCompatible(entry, effectiveRow)) {
          fpgaFamiliesCoveringRow.add(entry.fpgaFamily)
        }
        continue
      }

      if (entry.categoryCoverage !== row.categoryId) continue
      if (!entry.subCoverage.includes(row.subId)) continue
      if (!isFpgaCodeModuleCompatible(entry, row)) continue
      fpgaFamiliesCoveringRow.add(entry.fpgaFamily)
    }
    for (const family of fpgaFamiliesCoveringRow) {
      coverageMap.set(family, (coverageMap.get(family) ?? 0) + 1)
    }
  }
  return coverageMap
}

/**
 * Consolidate dedicated (non-FPGA) modules that were selected for multiple rows.
 * If the combined channel demand fits on fewer boards than the sum of per-row
 * allocations, reduce the quantity.
 *
 * E.g. 2 rows of Analog Inputs × 8, both picking IO131 (16ch capacity):
 *   Before: 2× IO131 (1 per row)
 *   After:  1× IO131 (8+8 = 16 ≤ 16ch capacity)
 */
function consolidateDedicatedModules(
  recommended: Map<string, RecommendedEntry>
): void {
  // Phase 1: reduce quantity when combined channels fit on fewer boards of the same module
  for (const [, entry] of recommended) {
    // Skip FPGA modules (already handled) and interface boards
    if (entry.module.fpgaFamily) continue
    if (entry.module.categoryCoverage === 'interface') continue
    if (entry.module.channelCapacity <= 0) continue

    const minUnits = Math.max(1, Math.ceil(entry.coveredChannels / entry.module.channelCapacity))
    if (minUnits < entry.quantity) {
      entry.rationale.add(
        `Consolidated ${entry.quantity}× → ${minUnits}× ${entry.module.moduleId} (${entry.coveredChannels} channels fit in ${minUnits} × ${entry.module.channelCapacity}ch).`
      )
      entry.quantity = minUnits
    }
  }

  // Phase 2: upgrade to a larger-capacity module when it reduces total board count
  // E.g. 2× IO131 (16ch) → 1× IO134 (32ch) for 32 channels of analog inputs
  const entriesToUpgrade: { key: string; entry: RecommendedEntry }[] = []
  for (const [key, entry] of recommended) {
    if (entry.module.fpgaFamily) continue
    if (entry.module.categoryCoverage === 'interface') continue
    if (entry.quantity <= 1) continue // already minimal — no upgrade benefit
    entriesToUpgrade.push({ key, entry })
  }

  for (const { key, entry } of entriesToUpgrade) {
    const currentUnits = entry.quantity
    // Search catalog for a compatible larger-capacity module
    const upgradeCandidates = MOCK_MODULE_CATALOG.filter(m => {
      if (m.moduleId === entry.module.moduleId) return false
      if (m.fpgaFamily) return false                           // dedicated modules only
      if (m.categoryCoverage !== entry.module.categoryCoverage) return false
      if (m.channelCapacity <= entry.module.channelCapacity) return false  // must be larger
      // Must cover the same sub-categories
      const entrySubs = entry.module.subCoverage
      if (!entrySubs.every(s => m.subCoverage.includes(s))) return false
      // Must match the same machines
      if (entry.module.compatibleMachines) {
        if (!m.compatibleMachines) return false
        if (!entry.module.compatibleMachines.every(mach => m.compatibleMachines!.includes(mach))) return false
      }
      // Must not be EOL / discontinued
      if (m.lifecycleStatus === 'discontinued' || m.lifecycleStatus === 'eol') return false
      return true
    })

    // Pick the smallest upgrade that reduces board count
    upgradeCandidates.sort((a, b) => a.channelCapacity - b.channelCapacity)

    for (const upgradeModule of upgradeCandidates) {
      const upgradeUnits = Math.max(1, Math.ceil(entry.coveredChannels / upgradeModule.channelCapacity))
      if (upgradeUnits < currentUnits) {
        // Verify specs are compatible: the upgrade module must support all specs
        // present in the original module's supportedSpecs
        const specsOk = Object.entries(entry.module.supportedSpecs).every(([specKey, values]) => {
          const upgradeValues = upgradeModule.supportedSpecs[specKey]
          if (!upgradeValues || upgradeValues.length === 0) return false
          return values.every(v => upgradeValues.includes(v))
        })
        if (!specsOk) continue

        // Upgrade: replace the entry with the larger module
        recommended.delete(key)
        const existing = recommended.get(upgradeModule.moduleId)
        if (existing) {
          existing.quantity += upgradeUnits
          existing.coveredChannels += entry.coveredChannels
          for (const rowId of entry.coveredRows) existing.coveredRows.add(rowId)
          existing.rationale.add(
            `Upgraded ${currentUnits}× ${entry.module.moduleId} (${entry.module.channelCapacity}ch) → ${upgradeUnits}× ${upgradeModule.moduleId} (${upgradeModule.channelCapacity}ch) — fewer boards for ${entry.coveredChannels} channels.`
          )
        } else {
          const rationale = new Set(entry.rationale)
          rationale.add(
            `Upgraded ${currentUnits}× ${entry.module.moduleId} (${entry.module.channelCapacity}ch) → ${upgradeUnits}× ${upgradeModule.moduleId} (${upgradeModule.channelCapacity}ch) — fewer boards for ${entry.coveredChannels} channels.`
          )
          recommended.set(upgradeModule.moduleId, {
            module: upgradeModule,
            quantity: upgradeUnits,
            coveredChannels: entry.coveredChannels,
            coveredRows: new Set(entry.coveredRows),
            rationale,
          })
        }
        break // done — first valid upgrade wins
      }
    }
  }
}

/**
 * After the main per-row matching loop, FPGA boards that were selected by
 * multiple rows across different categories can often be **consolidated**.
 * E.g. 6×PWM (6 lines) + 4×QAD (12 lines) = 18 lines total, which fits on
 * a single 96-line IO324 instead of allocating two.
 *
 * Uses the `fpgaFamily` field to identify entries sharing the same physical
 * board, and `quantity / channelCapacity` to compute fractional usage.
 */
function consolidateFpgaModules(
  rowDiffs: ProposalRowDiff[],
  recommended: Map<string, {
    module: MockModuleCatalogEntry
    quantity: number
    coveredChannels: number
    coveredRows: Set<string>
    rationale: Set<string>
    ioLineUtilization?: { used: number; total: number }
    interfaceForModule?: string
  }>
): void {
  // Track per-subcategory fractional board usage AND FPGA resource consumption
  // per fpgaFamily.  Different sub-categories (analog vs encoder vs PWM) use
  // independent hardware resources on the same FPGA board:
  //   • Analog inputs/outputs → dedicated ADC/DAC on -120 extension
  //   • Encoder, PWM, digital → shared FPGA I/O lines
  // Therefore we take the MAX fraction across sub-categories (not sum) to
  // determine how many boards are needed by capacity.
  const FIT_RESOURCE_KEYS = ['slices', 'lut', 'register', 'ram16', 'ram8', 'dsp'] as const
  const familySubFractions = new Map<string, Map<string, number>>()
  // Per-family accumulated FPGA resource usage (from code module costs in fit model)
  const familyResourceUsage = new Map<string, Map<string, number>>()

  for (const diff of rowDiffs) {
    if (diff.status === 'unresolved') continue
    const moduleId = diff.moduleRefs[0]
    if (!moduleId) continue
    // Find the catalog entry matching this moduleId + category + sub
    const entry = MOCK_MODULE_CATALOG.find(e =>
      e.moduleId === moduleId &&
      e.categoryCoverage === diff.categoryId &&
      e.subCoverage.includes(diff.subId)
    ) ?? MOCK_MODULE_CATALOG.find(e =>
      e.fpgaFamily === moduleId &&
      e.categoryCoverage === diff.categoryId &&
      e.subCoverage.includes(diff.subId)
    )
    if (!entry?.fpgaFamily || !entry.channelCapacity) continue

    // Build a minimal RequirementRow for fit model lookups
    const minimalRow: RequirementRow = {
      categoryId: diff.categoryId,
      subId: diff.subId,
      categoryLabel: diff.categoryLabel,
      subLabel: diff.subLabel,
      rowId: diff.rowId,
      quantity: diff.quantityRequested,
      specs: diff.requestedSpecs,
    }

    // Verify this row's code module is supported by the FPGA family
    if (!isFpgaCodeModuleCompatible(entry, minimalRow)) {
      continue // Skip — cannot consolidate a row onto a board that doesn't support its code module
    }

    // Track per-sub fraction (independent hardware resources per sub-category)
    // Use fit model signal capacity when available for more precise fraction
    const subKey = `${diff.categoryId}/${diff.subId}`
    const effectiveConsolidationCap = getEffectiveSignalCapacity(entry, minimalRow) ?? entry.channelCapacity
    const fraction = diff.quantityRequested / effectiveConsolidationCap
    if (!familySubFractions.has(entry.fpgaFamily)) {
      familySubFractions.set(entry.fpgaFamily, new Map())
    }
    const subMap = familySubFractions.get(entry.fpgaFamily)!
    subMap.set(subKey, (subMap.get(subKey) || 0) + fraction)

    // Accumulate FPGA resource costs from code module data in the fit model
    const codeModule = resolveFitCodeModuleForRow(minimalRow)
    if (codeModule) {
      if (!familyResourceUsage.has(entry.fpgaFamily)) {
        familyResourceUsage.set(entry.fpgaFamily, new Map(FIT_RESOURCE_KEYS.map(k => [k, 0])))
      }
      const resUsage = familyResourceUsage.get(entry.fpgaFamily)!
      for (const key of FIT_RESOURCE_KEYS) {
        const cost = codeModule.resources.base[key] + codeModule.resources.perChannel[key] * diff.quantityRequested
        resUsage.set(key, (resUsage.get(key) ?? 0) + cost)
      }
    }
  }

  for (const [family, subMap] of familySubFractions) {
    const rec = recommended.get(
      // Find the moduleId used for this family in the recommended map
      Array.from(recommended.keys()).find(id => {
        const r = recommended.get(id)
        return r?.module.fpgaFamily === family || r?.module.moduleId === family
      }) ?? family
    )
    if (!rec) continue

    // Boards needed by capacity = max across independent sub-category fractions
    // (each sub uses separate hardware, so they don't sum)
    const peakFraction = Math.max(...Array.from(subMap.values()))
    const boardsNeededByCapacity = Math.max(1, Math.ceil(peakFraction))

    // Boards needed by FPGA resources (from fit model code module costs)
    let boardsNeededByResources = 1
    const resUsage = familyResourceUsage.get(family)
    const boardModel = getBoardModel(family)
    let bottleneckUsed = 0
    let bottleneckAvailable = 0
    if (resUsage && boardModel) {
      for (const key of FIT_RESOURCE_KEYS) {
        const used = resUsage.get(key) ?? 0
        const perBoard = boardModel.resources[key]
        if (used > 0 && perBoard > 0) {
          const needed = Math.ceil(used / perBoard)
          if (needed > boardsNeededByResources) {
            boardsNeededByResources = needed
            bottleneckUsed = used
            bottleneckAvailable = perBoard
          }
        }
      }
    }

    // Use the MORE CONSERVATIVE estimate (whichever requires more boards)
    const actualUnits = Math.max(boardsNeededByResources, boardsNeededByCapacity)

    if (bottleneckAvailable > 0) {
      // Report utilization based on bottleneck FPGA resource
      const totalAvailable = bottleneckAvailable * actualUnits
      rec.ioLineUtilization = { used: Math.round(bottleneckUsed), total: Math.round(totalAvailable) }
    }

    if (actualUnits < rec.quantity) {
      const utilDesc = bottleneckAvailable > 0
        ? `${Math.round((bottleneckUsed / (bottleneckAvailable * actualUnits)) * 100)}% FPGA resource utilization`
        : `${Math.round(peakFraction * 100)}% peak sub-category utilization`
      rec.rationale.add(
        `Consolidated onto ${actualUnits} × ${family} (${utilDesc}).`
      )
      rec.quantity = actualUnits
    }
  }
}

type CoveredSignalNeeds = {
  analogInputs: number
  analogOutputs: number
  hasResolver: boolean
  hasRS422orRS485: boolean
}

type IO33XCapabilities = {
  analogInputs: number
  analogOutputs: number
  hasRS422orRS485: boolean
}

function summarizeCoveredSignalNeeds(
  coveredRows: Set<string>,
  rowDiffs?: ProposalRowDiff[]
): CoveredSignalNeeds {
  if (!rowDiffs) {
    return { analogInputs: 0, analogOutputs: 0, hasResolver: false, hasRS422orRS485: false }
  }
  const coveredDiffs = rowDiffs.filter(d => coveredRows.has(d.rowId))
  let analogInputs = 0
  let analogOutputs = 0
  let hasResolver = false
  let hasRS422orRS485 = false

  for (const d of coveredDiffs) {
    if (d.categoryId === 'analog') {
      if (d.subId === 'inputs') analogInputs += d.quantityRequested
      else if (d.subId === 'outputs') analogOutputs += d.quantityRequested
    }
    if (d.subId === 'resolver') hasResolver = true

    const specValues = Object.values(d.requestedSpecs).join(' ').toLowerCase()
    if (specValues.includes('rs422') || specValues.includes('rs485')) {
      hasRS422orRS485 = true
    }
  }

  return { analogInputs, analogOutputs, hasResolver, hasRS422orRS485 }
}

function getIO33XCapabilities(interfaceId?: string): IO33XCapabilities {
  if (!interfaceId) {
    return { analogInputs: 0, analogOutputs: 0, hasRS422orRS485: false }
  }
  switch (interfaceId) {
    case 'IO33X-2':
    case 'IO33X-3':
      return { analogInputs: 0, analogOutputs: 0, hasRS422orRS485: true }
    case 'IO33X-5':
      return { analogInputs: 2, analogOutputs: 0, hasRS422orRS485: false }
    case 'IO33X-6':
      return { analogInputs: 16, analogOutputs: 8, hasRS422orRS485: false }
    case 'IO33X-7':
      return { analogInputs: 0, analogOutputs: 16, hasRS422orRS485: false }
    case 'IO33X-8':
      return { analogInputs: 0, analogOutputs: 8, hasRS422orRS485: false }
    default:
      return { analogInputs: 0, analogOutputs: 0, hasRS422orRS485: false }
  }
}

/**
 * Determine ALL I/O interface extensions needed for a set of covered rows.
 * Returns multiple extensions when the board serves mixed signal types.
 * E.g., a board covering both resolver and analog rows returns ['-24', '-120'].
 *
 * Priority ladder (collected in order):
 *   resolver (-24) > analog overflow (-120) > RS422/RS485 (-22) > sub-ID prefs
 */
function determineRequiredExtensions(
  coveredRows: Set<string>,
  rowDiffs?: ProposalRowDiff[],
  selectedIO33XBoardId?: string
): string[] {
  if (!rowDiffs) return []
  const coveredDiffs = rowDiffs.filter(d => coveredRows.has(d.rowId))
  if (coveredDiffs.length === 0) return []

  const extensions = new Set<string>()
  const needs = summarizeCoveredSignalNeeds(coveredRows, rowDiffs)
  const io33xCaps = getIO33XCapabilities(selectedIO33XBoardId)

  // Resolver rows need -24
  if (needs.hasResolver) extensions.add('-24')
  // Add -120 only for analog demand not already satisfied by selected IO33X board
  const remainingAnalogInputs = Math.max(0, needs.analogInputs - io33xCaps.analogInputs)
  const remainingAnalogOutputs = Math.max(0, needs.analogOutputs - io33xCaps.analogOutputs)
  if (remainingAnalogInputs > 0 || remainingAnalogOutputs > 0) extensions.add('-120')
  // -22 only for explicit RS422/RS485 context not already satisfied by selected IO33X board
  if (needs.hasRS422orRS485 && !io33xCaps.hasRS422orRS485) extensions.add('-22')
  // Sub-ID-based preferences (e.g., a2b → -40)
  for (const d of coveredDiffs) {
    const pref = SUB_ID_EXTENSION_PREFERENCE[d.subId]
    if (pref) extensions.add(pref)
  }

  // Default -21 (TTL) for digital rows when no specific extension was triggered.
  // Also covers FPGA code-module protocol rows (SPI, I2C, etc.) which need TTL lines.
  if (extensions.size === 0) {
    const hasDigitalOrProtocol = coveredDiffs.some(d =>
      d.categoryId === 'digital' ||
      d.subId === 'pwm' || d.subId === 'capture' || d.subId === 'gpio' ||
      (d.categoryId === 'communication' && d.subId === 'protocols')
    )
    if (hasDigitalOrProtocol) extensions.add('-21')
  }

  return Array.from(extensions)
}

/**
 * Select the best IO33X-N interface board for IO332/IO333 modules based on
 * the signal types their covered rows require. These "blank slate" FPGA modules
 * have no built-in I/O — their front I/O comes entirely from the IO33X-N board.
 *
 * Selection logic:
 *   - Mixed analog + digital → IO33X-6 (16 AD + 8 DA + 16 TTL)
 *   - Analog only → IO33X-5 (high-speed) or IO33X-7 (16 DA outputs)
 *   - RS422/RS485 → IO33X-2 (30 RS485)
 *   - Digital LVDS → IO33X-4 (30 LVDS)
 *   - Default digital → IO33X-1-LV (64 LVTTL)
 */
function selectIO33XBoard(
  coveredRows: Set<string>,
  rowDiffs?: ProposalRowDiff[]
): typeof IO_INTERFACE_BOARDS[number] | null {
  if (!rowDiffs) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-1-LV') ?? null
  const coveredDiffs = rowDiffs.filter(d => coveredRows.has(d.rowId))
  if (coveredDiffs.length === 0) return null

  const needs = summarizeCoveredSignalNeeds(coveredRows, rowDiffs)
  const hasAnalog = needs.analogInputs > 0 || needs.analogOutputs > 0
  const hasDigital = coveredDiffs.some(d =>
    d.categoryId === 'digital' || d.subId === 'pwm' || d.subId === 'capture' || d.subId === 'gpio'
  )
  const hasRS422 = needs.hasRS422orRS485
  const hasLVDS = coveredDiffs.some(d => {
    const specValues = Object.values(d.requestedSpecs).join(' ').toLowerCase()
    return specValues.includes('lvds')
  })

  // Mixed analog + digital → IO33X-6 (most versatile)
  if (hasAnalog && hasDigital) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-6') ?? null
  // Analog-only selection by demand: avoid picking IO33X-5 for large low-speed analog sets
  if (needs.analogInputs > 0 && needs.analogOutputs > 0) {
    return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-6') ?? null
  }
  if (needs.analogInputs > 2) {
    return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-6') ?? null
  }
  if (needs.analogInputs > 0) {
    return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-5') ?? null
  }
  if (needs.analogOutputs > 8) {
    return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-7') ?? null
  }
  if (needs.analogOutputs > 0) {
    return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-8') ?? null
  }
  // RS422/RS485 needs differential I/O
  if (hasRS422) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-2') ?? null
  // LVDS
  if (hasLVDS) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-4') ?? null
  // Default: digital LVTTL
  return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-1-LV') ?? null
}

/**
 * Get the set of supported I/O extensions for an FPGA family.
 * Merges fitModel.supportedExtensions with boardExtensionsOverride.json
 * (override fills gaps where MAT SupportedPlugins columns are empty).
 */
function getSupportedExtensionsForFamily(fpgaFamily: string): Set<string> {
  const board = getBoardModel(fpgaFamily)
  const fromFitModel = board?.supportedExtensions ?? []
  const fromOverride = (boardExtensionsOverride as unknown as Record<string, string[]>)[fpgaFamily] ?? []
  // Union both sources — fitModel may have data for IO360x/IO361x, override for classic boards
  return new Set([...fromFitModel, ...fromOverride])
}

/**
 * Auto-add interface boards and extensions for FPGA modules:
 *
 * 1. **IO extensions** (e.g. -21, -22, -24, -120, -40): Added for modules with
 *    `supportsIOExtensions !== false`. Supports MULTIPLE extensions per board when
 *    covered rows span different signal types.
 *
 * 2. **IO33X-N interface boards**: Added for IO332/IO333 modules with
 *    `supportsIOInterfaces === true`. These "blank slate" modules need a front
 *    I/O interface board selected based on signal requirements.
 *
 * Compact modules (IO391/392/393/397 with `supportsIOExtensions: false`)
 * are self-contained and get no interface additions.
 */
function addFpgaInterfaceBoards(
  recommended: Map<string, {
    module: MockModuleCatalogEntry
    quantity: number
    coveredChannels: number
    coveredRows: Set<string>
    rationale: Set<string>
    ioLineUtilization?: { used: number; total: number }
    interfaceForModule?: string
  }>,
  rowDiffs?: ProposalRowDiff[]
): void {
  // ── IO33X-N interface boards for IO332/IO333 (supportsIOInterfaces) ──
  const entriesNeedingIO33X = Array.from(recommended.entries()).filter(
    ([, entry]) => Boolean(entry.module.fpgaFamily) && entry.module.supportsIOInterfaces === true
  )
  const selectedIO33XByParent = new Map<string, string>()

  for (const [parentKey, entry] of entriesNeedingIO33X) {
    const techName = entry.module.technicalName
    const board = selectIO33XBoard(entry.coveredRows, rowDiffs)
    if (!board) continue

    // Use the interface board's own ID (e.g. 'IO33X-1-LV'), not prefixed with parent module
    const boardId = board.interfaceId
    const existing = recommended.get(boardId)
    if (existing) {
      existing.quantity += entry.quantity
      for (const rowId of entry.coveredRows) existing.coveredRows.add(rowId)
      existing.rationale.add(`Front I/O interface for ${techName}.`)
    } else {
      recommended.set(boardId, {
        module: {
          moduleId: boardId,
          friendlyName: `${board.description}`,
          technicalName: boardId,
          categoryCoverage: 'interface',
          subCoverage: [],
          channelCapacity: board.channelCount ?? 0,
          supportedSpecs: {},
          fpgaFamily: techName,
        },
        quantity: entry.quantity,
        coveredChannels: 0,
        coveredRows: new Set(entry.coveredRows),
        rationale: new Set([`${boardId}: ${board.description}. Front I/O interface for ${techName}.`]),
        interfaceForModule: parentKey,
      })
    }
    selectedIO33XByParent.set(parentKey, boardId)
  }

  // ── IO extensions for modules with supportsIOExtensions ──
  const entriesNeedingExtensions = Array.from(recommended.entries()).filter(
    ([, entry]) =>
      Boolean(entry.module.fpgaFamily) &&
      entry.module.categoryCoverage !== 'interface' &&
      entry.module.supportsIOExtensions !== false
  )

  for (const [parentKey, entry] of entriesNeedingExtensions) {
    // Use fpgaFamily (e.g. 'IO324') for extension naming, not technicalName ('IO3xx (Resolver config)')
    const boardName = entry.module.fpgaFamily ?? entry.module.technicalName
    const selectedIO33XBoardId = selectedIO33XByParent.get(parentKey)
    const allExtensions = determineRequiredExtensions(entry.coveredRows, rowDiffs, selectedIO33XBoardId)
    if (allExtensions.length === 0) continue

    // Gate: only attach extensions the board actually supports (per fitModel + override)
    const supported = getSupportedExtensionsForFamily(boardName)
    const extensions = supported.size > 0
      ? allExtensions.filter(ext => supported.has(ext))
      : allExtensions // If no data at all, fail open (don't silently drop everything)
    if (extensions.length === 0) continue

    for (const ext of extensions) {
      const extId = `${boardName}${ext}`
      const extInfo = IO_INTERFACE_EXTENSIONS.find(e => e.extensionId === ext)
      const friendlyName = extInfo
        ? `${boardName} ${extInfo.type}`
        : `Interface Board ${extId}`

      const existing = recommended.get(extId)
      if (existing) {
        existing.quantity += entry.quantity
        for (const rowId of entry.coveredRows) existing.coveredRows.add(rowId)
        existing.rationale.add(`Required ${ext} extension for ${boardName}.`)
      } else {
        recommended.set(extId, {
          module: {
            moduleId: extId,
            friendlyName,
            technicalName: extId,
            categoryCoverage: 'interface',
            subCoverage: [],
            channelCapacity: 0,
            supportedSpecs: {},
            fpgaFamily: boardName,
          },
          quantity: entry.quantity,
          coveredChannels: 0,
          coveredRows: new Set(entry.coveredRows),
          rationale: new Set([`Required ${ext} extension for ${boardName} (${extInfo?.type ?? 'signal conditioning'}).`]),
          interfaceForModule: parentKey,
        })
      }
    }
  }
}

// ─── Config Package Channel Limit Validation ─────────────────────────────────
/**
 * For each FPGA module with a selectedConfigPackage, validate that the config
 * package can satisfy the channel counts across all covered rows.
 * Attaches a configPackageWarning string if any code module allocation is exceeded.
 */
function validateConfigPackageChannelLimits(
  recommended: Map<string, RecommendedEntry>,
  rowDiffs: ProposalRowDiff[]
): void {
  for (const [, entry] of recommended) {
    const { module, selectedConfigPackage } = entry
    if (!selectedConfigPackage || !module.fpgaFamily) continue

    // Collect all covered row subIds and their quantities
    const warnings: string[] = []
    for (const rowId of entry.coveredRows) {
      const diff = rowDiffs.find(d => d.rowId === rowId)
      if (!diff) continue
      const subId = diff.subId
      const qty = diff.quantityRequested
      if (!subId || qty === 0) continue

      const warning = validateConfigPackageChannels(
        module.fpgaFamily,
        selectedConfigPackage,
        subId,
        qty
      )
      if (warning) warnings.push(warning)
    }

    if (warnings.length > 0) {
      entry.configPackageWarning = warnings.join('; ')
    }
  }
}

// ─── Recommended-map entry type (reusable alias) ────────────────────────────────
type RecommendedEntry = {
  module: MockModuleCatalogEntry
  quantity: number
  coveredChannels: number
  coveredRows: Set<string>
  rationale: Set<string>
  ioLineUtilization?: { used: number; total: number }
  interfaceForModule?: string
  selectedConfigPackage?: string
  configPackageWarning?: string
}

// ─── Software / Service Recommendations ──────────────────────────────────────
/**
 * Generate software / service recommendations for FPGA modules that need
 * custom configurations or HDL Coder packages.
 *
 * Triggers:
 *   A) Programmable-only modules (IO332/333/335/342/344/352): always need a
 *      custom configuration — no pre-built config packages exist.
 *   B) Config package warnings: when pre-built allocations can't cover the
 *      requested channels → custom config is the upgrade path.
 *
 * Emits:
 *   - "custom-config" — Speedgoat creates the bitstream
 *   - "hcip"          — HCIP license (self-service alternative)
 *   - "blockset"      — HDL I/O Blockset (303MOT / 303COM, optional add-on)
 */
function generateSoftwareRecommendations(
  recommended: Map<string, RecommendedEntry>,
  rowDiffs: ProposalRowDiff[]
): SoftwareRecommendation[] {
  const recs: SoftwareRecommendation[] = []
  const emittedHcip = new Set<string>()
  const emittedBlocksets = new Set<string>()
  const emittedCustomConfig = new Set<string>()

  for (const [, entry] of recommended) {
    const { module } = entry
    if (!module.fpgaFamily) continue
    if (entry.interfaceForModule) continue // skip extension/interface children

    const family = module.fpgaFamily
    const isProgrammableOnly = PROGRAMMABLE_ONLY_FAMILIES.has(family)
    const hasWarning = Boolean(entry.configPackageWarning)

    if (!isProgrammableOnly && !hasWarning) continue

    // ── Custom Configuration recommendation ──
    if (!emittedCustomConfig.has(family)) {
      emittedCustomConfig.add(family)
      const reason = isProgrammableOnly
        ? `${family} requires a custom configuration (no pre-built config packages available)`
        : `Pre-built config package cannot cover all requested channels — custom configuration recommended`
      recs.push({
        itemCode: `CUSTOM-${family}`,
        name: `${family} Custom Configuration`,
        category: 'custom-config',
        reason,
        forModuleId: module.moduleId,
        forFpgaFamily: family,
      })
    }

    // ── HCIP (self-service alternative) ──
    const hcip = FPGA_FAMILY_HCIP[family]
    if (hcip && !emittedHcip.has(family)) {
      emittedHcip.add(family)
      recs.push({
        itemCode: hcip.itemCode,
        name: hcip.name,
        category: 'hcip',
        reason: `Self-service alternative: create custom bitstreams with HDL Coder`,
        forModuleId: module.moduleId,
        forFpgaFamily: family,
      })
    }

    // ── HDL I/O Blocksets ──
    for (const rowId of entry.coveredRows) {
      const diff = rowDiffs.find(d => d.rowId === rowId)
      if (!diff) continue
      // For protocol rows, remap sub-ID (e.g. 'protocols' → 'spi')
      let effectiveSubId = diff.subId
      if (diff.categoryId === 'communication' && diff.subId === 'protocols') {
        const protocol = diff.requestedSpecs?.range || diff.requestedSpecs?.resolution || ''
        const mapped = PROTOCOL_TO_SUB_ID[protocol]
        if (mapped) effectiveSubId = mapped
      }
      const codeModules = SUB_ID_TO_CODE_MODULES[effectiveSubId]
      if (!codeModules) continue
      for (const cm of codeModules) {
        const blockset = CODE_MODULE_BLOCKSET[cm]
        if (blockset && !emittedBlocksets.has(blockset.itemCode)) {
          emittedBlocksets.add(blockset.itemCode)
          recs.push({
            itemCode: blockset.itemCode,
            name: blockset.name,
            category: 'blockset',
            reason: `Required for ${cm} code module in HDL Coder workflow`,
            forModuleId: module.moduleId,
            forFpgaFamily: family,
          })
        }
      }
    }
  }

  return recs
}

function shouldSwapFpgaFamily(mode: OptimizationPolicy['fpgaSwapMode'], dedicatedTotal: number, fpgaTotalItems: number): boolean {
  if (mode === 'aggressive') return dedicatedTotal <= fpgaTotalItems
  if (mode === 'conservative') return dedicatedTotal + 1 < fpgaTotalItems
  return dedicatedTotal < fpgaTotalItems
}

/**
 * After FPGA consolidation + interface board addition, compare the total FPGA
 * module count (main boards + extensions + IO33X) against a dedicated-only
 * alternative for each FPGA family. If dedicated modules use fewer total BOM
 * line-items, swap the family out. Ties favour FPGA (more flexible).
 *
 * Returns a list of families that were swapped (for flow display).
 */
function validateFpgaOverhead(
  recommended: Map<string, RecommendedEntry>,
  _rowDiffs: ProposalRowDiff[],
  requirements: RequirementRow[],
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  policy: OptimizationPolicy,
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>
): FpgaOverheadSwap[] {
  // Group recommended entries by fpgaFamily
  const familyEntries = new Map<string, { keys: string[]; totalModules: number; accessoryCount: number; coveredRows: Set<string> }>()

  for (const [key, entry] of recommended) {
    const family = entry.module.fpgaFamily
    if (!family) continue
    // Extensions and IO33X interface boards are accessories that travel with the
    // main board. They don't count as "main" FPGA boards but they DO consume a
    // physical slot — so we track them separately for overhead comparison.
    const isAccessory = Boolean(entry.interfaceForModule)
    const state = familyEntries.get(family)
    if (state) {
      state.keys.push(key)
      if (isAccessory) {
        state.accessoryCount += entry.quantity
      } else {
        state.totalModules += entry.quantity
      }
      for (const rowId of entry.coveredRows) state.coveredRows.add(rowId)
    } else {
      familyEntries.set(family, {
        keys: [key],
        totalModules: isAccessory ? 0 : entry.quantity,
        accessoryCount: isAccessory ? entry.quantity : 0,
        coveredRows: new Set(entry.coveredRows),
      })
    }
  }

  const swaps: FpgaOverheadSwap[] = []

  for (const [family, state] of familyEntries) {
    // Find the requirement rows this FPGA family covers
    const coveredRequirements = requirements.filter(r => state.coveredRows.has(r.rowId))
    if (coveredRequirements.length === 0) continue

    // Compute dedicated alternative: best non-FPGA candidate per covered row
    let dedicatedTotal = 0
    let allRowsHaveDedicated = true
    const dedicatedWinners: { row: RequirementRow; candidate: CandidateScore }[] = []

    for (const row of coveredRequirements) {
      const candidate = selectBestCandidate(row, moduleUsage, seededRandom, policy, machineId, fpgaCoverageMap, /* excludeFpga */ true)
      if (!candidate) {
        allRowsHaveDedicated = false
        break
      }
      dedicatedTotal += candidate.units
      dedicatedWinners.push({ row, candidate })
    }

    // Can't swap if some rows have no dedicated alternative
    if (!allRowsHaveDedicated) continue

    // Compare: swap only if dedicated uses strictly fewer physical items (ties → keep FPGA).
    // Include accessory boards (IO33X-N front boards, extensions) in the FPGA path cost —
    // they occupy real chassis slots and must be visible in the trade-off.
    const fpgaTotalItems = state.totalModules + state.accessoryCount
    if (shouldSwapFpgaFamily(policy.fpgaSwapMode, dedicatedTotal, fpgaTotalItems)) {
      // Remove all FPGA entries for this family
      for (const key of state.keys) {
        recommended.delete(key)
      }

      // Insert dedicated entries & collect replacement info
      const replacementMap = new Map<string, { moduleId: string; friendlyName: string; units: number }>()
      for (const { row, candidate } of dedicatedWinners) {
        const rationale = buildRationale(row, candidate)
        const existing = recommended.get(candidate.module.moduleId)
        if (existing) {
          existing.quantity += candidate.units
          existing.coveredChannels += row.quantity
          existing.coveredRows.add(row.rowId)
          existing.rationale.add(rationale)
        } else {
          recommended.set(candidate.module.moduleId, {
            module: candidate.module,
            quantity: candidate.units,
            coveredChannels: row.quantity,
            coveredRows: new Set([row.rowId]),
            rationale: new Set([`${rationale} (replaced FPGA ${family} — dedicated path uses fewer modules)`]),
          })
        }
        // Track replacement modules
        const rep = replacementMap.get(candidate.module.moduleId)
        if (rep) {
          rep.units += candidate.units
        } else {
          replacementMap.set(candidate.module.moduleId, {
            moduleId: candidate.module.moduleId,
            friendlyName: candidate.module.friendlyName,
            units: candidate.units,
          })
        }
      }

      swaps.push({
        family,
        fpgaCount: state.totalModules + state.accessoryCount,
        dedicatedCount: dedicatedTotal,
        replacements: Array.from(replacementMap.values()),
      })
    }
  }

  return swaps
}
