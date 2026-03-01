import {
  MOCK_MODULE_CATALOG,
  type MockModuleCatalogEntry,
  FPGA_CODE_MODULE_COMPAT,
  SUB_ID_TO_CODE_MODULES,
  SUB_ID_EXTENSION_PREFERENCE,
  IO_INTERFACE_EXTENSIONS,
  IO_INTERFACE_BOARDS,
} from '@/lib/proposal/mockCatalog'
import { createSeededRandom, hashObject, hashString } from '@/lib/proposal/seed'
import type {
  ProposalGenerateRequest,
  ProposalGenerateResponse,
  ProposalRecommendedModule,
  ProposalRowDiff,
  ProposalSpecDiff,
  ProposalUnresolvedRow,
  RequirementRow,
  FpgaOverheadSwap,
} from '@/components/configurator/proposalTypes'

export type CandidateScore = {
  module: MockModuleCatalogEntry
  units: number
  /** Prefer smaller modules (fewer total channels) when scores tie */
  channelCapacity: number
  tieBreaker: number
  exactCount: number
  compatibleCount: number
  mismatchCount: number
  missingCount: number
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
  /** Bonus for simulink-programmable (+3) or configurable (+1) FPGA category */
  fpgaCategoryBonus: number
}

type SpecMatch = {
  status: 'exact' | 'compatible' | 'mismatch' | 'missing'
  provided: string
}

export function getSimulationDelayMs(request: ProposalGenerateRequest): number {
  const seed = hashString(buildSeedInput(request))
  return 3000 + (seed % 2001)
}

export function simulateProposal(request: ProposalGenerateRequest): ProposalGenerateResponse {
  const normalizedRequirements = normalizeRequirements(request.requirements)
  const seedInput = buildSeedInput({ ...request, requirements: normalizedRequirements })
  const seededRandom = createSeededRandom(seedInput)
  const moduleUsage = new Map<string, number>()

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
    }
  >()

  const rowDiffs: ProposalRowDiff[] = []
  const unresolved: ProposalUnresolvedRow[] = []
  const machineWarnings: string[] = []
  let coveredChannels = 0

  normalizedRequirements.forEach((row) => {
    const candidate = selectBestCandidate(row, moduleUsage, seededRandom, request.machineId, fpgaCoverageMap)
    if (!candidate) {
      const unresolvedEntry = buildUnresolvedRow(row)
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
    moduleUsage.set(candidate.module.moduleId, (moduleUsage.get(candidate.module.moduleId) || 0) + candidate.units)

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
      moduleRefs: [candidate.module.moduleId],
      notes,
    })

    const moduleState = recommended.get(candidate.module.moduleId)
    const rationale = buildRationale(row, candidate)
    if (moduleState) {
      moduleState.quantity += candidate.units
      moduleState.coveredChannels += row.quantity
      moduleState.coveredRows.add(row.rowId)
      moduleState.rationale.add(rationale)
    } else {
      recommended.set(candidate.module.moduleId, {
        module: candidate.module,
        quantity: candidate.units,
        coveredChannels: row.quantity,
        coveredRows: new Set([row.rowId]),
        rationale: new Set([rationale]),
      })
    }
  })

  // --- FPGA post-processing: consolidate boards & add smart interfaces ------
  consolidateFpgaModules(rowDiffs, recommended)
  addFpgaInterfaceBoards(recommended, rowDiffs)
  // --- FPGA overhead guard: swap to dedicated when satellite count exceeds savings ---
  const fpgaOverheadSwaps = validateFpgaOverhead(
    recommended, rowDiffs, normalizedRequirements, moduleUsage, seededRandom, request.machineId, fpgaCoverageMap
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

  return {
    proposalId: `SP-${proposalHash.toString(16).toUpperCase().slice(0, 8)}`,
    generatedAt: new Date().toISOString(),
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
    fpgaOverheadSwaps: fpgaOverheadSwaps.length > 0 ? fpgaOverheadSwaps : undefined,
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
  const response = simulateProposal(request)

  // Re-run candidate selection to capture ALL scored candidates per row
  const normalizedRequirements = normalizeRequirements(request.requirements)
  const seedInput = buildSeedInput({ ...request, requirements: normalizedRequirements })
  const seededRandom = createSeededRandom(seedInput)
  const moduleUsage = new Map<string, number>()
  const fpgaCoverageMap = computeFpgaCoverageMap(normalizedRequirements)
  const perRow: PerRowCandidates[] = []

  for (const row of normalizedRequirements) {
    const { allCandidates, winner } = selectAllCandidates(row, moduleUsage, seededRandom, request.machineId, fpgaCoverageMap)
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
      moduleUsage.set(winner.module.moduleId, (moduleUsage.get(winner.module.moduleId) || 0) + winner.units)
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
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>,
  excludeFpga?: boolean
): { allCandidates: CandidateScore[]; winner: CandidateScore | null } {
  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (entry.categoryCoverage !== row.categoryId) return false
    if (!entry.subCoverage.includes(row.subId)) return false
    if (!isMachineCompatible(entry, machineId)) return false
    if (excludeFpga && entry.fpgaFamily) return false
    return true
  })

  if (candidates.length === 0) return { allCandidates: [], winner: null }

  const scoredCandidates = candidates
    .map((candidate) => evaluateCandidate(row, candidate, moduleUsage, seededRandom, machineId, fpgaCoverageMap))
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))

  if (scoredCandidates.length === 0) return { allCandidates: [], winner: null }

  scoredCandidates.sort((left, right) => {
    if (left.units !== right.units) return left.units - right.units
    if (left.score !== right.score) return right.score - left.score
    // Prefer tighter fit: fewer total channels = less over-provisioning
    if (left.channelCapacity !== right.channelCapacity) return left.channelCapacity - right.channelCapacity
    // NOTE: No further priority, stock level, or preference is defined.
    // If modules still tie after score + channelCapacity, we pick one at random (seeded).
    if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker
    return left.module.moduleId.localeCompare(right.module.moduleId)
  })

  return { allCandidates: scoredCandidates, winner: scoredCandidates[0] }
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
    requirements: request.requirements,
  })
}

function selectBestCandidate(
  row: RequirementRow,
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>,
  excludeFpga?: boolean
): CandidateScore | null {
  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (entry.categoryCoverage !== row.categoryId) return false
    if (!entry.subCoverage.includes(row.subId)) return false
    if (!isMachineCompatible(entry, machineId)) return false
    if (excludeFpga && entry.fpgaFamily) return false
    return true
  })

  if (candidates.length === 0) return null

  const scoredCandidates = candidates
    .map((candidate) => evaluateCandidate(row, candidate, moduleUsage, seededRandom, machineId, fpgaCoverageMap))
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))

  if (scoredCandidates.length === 0) return null

  scoredCandidates.sort((left, right) => {
    if (left.units !== right.units) return left.units - right.units
    if (left.score !== right.score) return right.score - left.score
    // Prefer tighter fit: fewer total channels = less over-provisioning
    if (left.channelCapacity !== right.channelCapacity) return left.channelCapacity - right.channelCapacity
    // NOTE: No further priority, stock level, or preference is defined.
    // If modules still tie after score + channelCapacity, we pick one at random (seeded).
    if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker
    return left.module.moduleId.localeCompare(right.module.moduleId)
  })

  return scoredCandidates[0]
}

/**
 * Check if an FPGA module supports the code module(s) required by a row's sub-ID.
 * Non-FPGA modules always pass. FPGA modules without a compat entry are treated as compatible.
 */
function isFpgaCodeModuleCompatible(module: MockModuleCatalogEntry, row: RequirementRow): boolean {
  if (!module.fpgaFamily) return true
  const requiredCodeModules = SUB_ID_TO_CODE_MODULES[row.subId]
  if (!requiredCodeModules || requiredCodeModules.length === 0) return true
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
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>
): CandidateScore | null {
  if (row.categoryId === 'communication') {
    const requestedProtocol = row.specs.range
    if (requestedProtocol && (!module.protocolSupport || !module.protocolSupport.includes(requestedProtocol))) {
      return null
    }
  }

  // Gate: FPGA modules must support the code module required by this row's sub-ID
  if (!isFpgaCodeModuleCompatible(module, row)) {
    return null
  }

  // For FPGA boards, calculate I/O lines consumed instead of raw channel count
  const units = Math.max(1, Math.ceil(row.quantity / module.channelCapacity))
  let exactCount = 0
  let compatibleCount = 0
  let mismatchCount = 0
  let missingCount = 0
  const providedSpecs: Record<string, string> = {}
  const specDiffs: ProposalSpecDiff[] = []

  Object.entries(row.specs).forEach(([key, requested]) => {
    // For communication modules, 'range' (Protocol) isn't in supportedSpecs — fall back to protocolSupport
    const specValues = key === 'range' && !module.supportedSpecs[key] && module.protocolSupport
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

  const hasPriorUsage = moduleUsage.has(module.moduleId)
  // FPGA boards strongly prefer reusing the same board (consolidation will merge later)
  const consolidationBonus = (row.categoryId === 'communication' || module.fpgaFamily) && hasPriorUsage ? 10 : 0
  // ── FPGA look-ahead bonus: proactive multi-row coverage ──
  // Awards +8 per additional row this FPGA can serve beyond the first, even before it's selected.
  // Solves the chicken-and-egg: FPGA no longer needs to win row #1 on specs alone.
  const fpgaLookAheadBonus = module.fpgaFamily && fpgaCoverageMap
    ? Math.max(0, (fpgaCoverageMap.get(module.fpgaFamily) ?? 1) - 1) * 8
    : 0
  // Prefer modules compatible with the selected machine
  const machineBonus = machineId && module.compatibleMachines?.includes(machineId) ? 5 : 0
  // Penalize discontinued / end-of-life modules so active alternatives rank higher
  const lifecyclePenalty = module.lifecycleStatus === 'discontinued' ? -20
    : module.lifecycleStatus === 'eol' ? -10
    : 0
  // Soft bonus for matching configuration packages (e.g. module has "HIL" package for HIL workflow)
  const configPackageBonus = computeConfigPackageBonus(module, row)
  // ── fpgaCategory bonus: prefer simulink-programmable over configurable for flexibility ──
  const fpgaCategoryBonus = module.fpgaCategory === 'simulink-programmable' ? 3
    : module.fpgaCategory === 'configurable' ? 1
    : 0
  const score = exactCount * 12 + compatibleCount * 6 - mismatchCount * 10 - missingCount * 8 - units * 2 + consolidationBonus + fpgaLookAheadBonus + machineBonus + lifecyclePenalty + configPackageBonus + fpgaCategoryBonus

  return {
    module,
    units,
    channelCapacity: module.channelCapacity,
    tieBreaker: seededRandom(),
    exactCount,
    compatibleCount,
    mismatchCount,
    missingCount,
    score,
    providedSpecs,
    specDiffs,
    consolidationBonus,
    machineBonus,
    fpgaLookAheadBonus,
    lifecyclePenalty,
    configPackageBonus,
    fpgaCategoryBonus,
  }
}

/**
 * Soft bonus (+4) when the module has a configuration package matching the row's signal context.
 * E.g. a module with configPackages ["HIL TTL", "Resolver RS422"] gets a bonus for resolver rows.
 */
function computeConfigPackageBonus(module: MockModuleCatalogEntry, row: RequirementRow): number {
  if (!module.configPackages || module.configPackages.length === 0) return 0
  const subIdLower = row.subId.toLowerCase()
  const hasMatch = module.configPackages.some(pkg => {
    const pkgLower = pkg.toLowerCase()
    return pkgLower.includes(subIdLower) ||
           (subIdLower === 'encoder' && (pkgLower.includes('quadrature') || pkgLower.includes('endat') || pkgLower.includes('biss') || pkgLower.includes('ssi'))) ||
           (subIdLower === 'pwm' && pkgLower.includes('hil')) ||
           (subIdLower === 'gpio' && (pkgLower.includes('hil') || pkgLower.includes('rcp')))
  })
  return hasMatch ? 4 : 0
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

function buildUnresolvedRow(row: RequirementRow): ProposalUnresolvedRow {
  return {
    rowId: row.rowId,
    categoryLabel: row.categoryLabel,
    subLabel: row.subLabel,
    quantity: row.quantity,
    reason: `No simulated module could satisfy ${row.categoryLabel} / ${row.subLabel} with current specs.`,
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
    for (const entry of MOCK_MODULE_CATALOG) {
      if (!entry.fpgaFamily) continue
      if (entry.categoryCoverage !== row.categoryId) continue
      if (!entry.subCoverage.includes(row.subId)) continue
      if (!isFpgaCodeModuleCompatible(entry, row)) continue
      if (!isMachineCompatible(entry, machineId)) continue
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
  // Sum fractional board usage per fpgaFamily across all rows.
  // Track both channelCapacity-based fraction AND physical I/O line consumption.
  const familyUsage = new Map<string, number>()
  const familyLineUsage = new Map<string, number>()

  for (const diff of rowDiffs) {
    if (diff.status === 'unresolved') continue
    const moduleId = diff.moduleRefs[0]
    if (!moduleId) continue
    // Find the catalog entry matching this moduleId + category + sub
    const entry = MOCK_MODULE_CATALOG.find(e =>
      e.moduleId === moduleId &&
      e.categoryCoverage === diff.categoryId &&
      e.subCoverage.includes(diff.subId)
    )
    if (!entry?.fpgaFamily || !entry.channelCapacity) continue

    // Verify this row's code module is supported by the FPGA family
    const requiredCodeModules = SUB_ID_TO_CODE_MODULES[diff.subId]
    if (requiredCodeModules && requiredCodeModules.length > 0) {
      const supported = FPGA_CODE_MODULE_COMPAT[entry.fpgaFamily]
      if (supported && !requiredCodeModules.some(cm => supported.has(cm))) {
        continue // Skip — cannot consolidate a row onto a board that doesn't support its code module
      }
    }

    const fraction = diff.quantityRequested / entry.channelCapacity
    familyUsage.set(entry.fpgaFamily, (familyUsage.get(entry.fpgaFamily) || 0) + fraction)

    // Track physical I/O line consumption (if fpgaTotalLines is known)
    // Some functions use multiple lines per channel (e.g., encoder = 3 lines/ch, resolver = 6 lines/ch)
    const linesPerChannel = getIOLinesPerChannel(diff.subId)
    const linesConsumed = diff.quantityRequested * linesPerChannel
    familyLineUsage.set(entry.fpgaFamily, (familyLineUsage.get(entry.fpgaFamily) || 0) + linesConsumed)
  }

  for (const [family, fraction] of familyUsage) {
    const rec = recommended.get(
      // Find the moduleId used for this family in the recommended map
      Array.from(recommended.keys()).find(id => {
        const r = recommended.get(id)
        return r?.module.fpgaFamily === family || r?.module.moduleId === family
      }) ?? family
    )
    if (!rec) continue

    // Validate against fpgaTotalLines budget (if known)
    const totalLines = rec.module.fpgaTotalLines
    const linesUsed = familyLineUsage.get(family) ?? 0
    if (totalLines && linesUsed > 0) {
      const boardsNeededByLines = Math.ceil(linesUsed / totalLines)
      const boardsNeededByCapacity = Math.max(1, Math.ceil(fraction))
      // Use the MORE CONSERVATIVE estimate (whichever requires more boards)
      const actualUnits = Math.max(boardsNeededByLines, boardsNeededByCapacity)
      rec.ioLineUtilization = { used: linesUsed, total: totalLines * actualUnits }
      if (actualUnits < rec.quantity) {
        const utilPct = Math.round((linesUsed / (totalLines * actualUnits)) * 100)
        rec.rationale.add(
          `Consolidated onto ${actualUnits} × ${family} (${utilPct}% I/O line utilization, ${linesUsed}/${totalLines * actualUnits} lines).`
        )
        rec.quantity = actualUnits
      }
    } else {
      // No fpgaTotalLines — fall back to capacity-based consolidation
      const actualUnits = Math.max(1, Math.ceil(fraction))
      if (actualUnits < rec.quantity) {
        rec.rationale.add(
          `Consolidated onto ${actualUnits} × ${family} (${Math.round(fraction * 100)}% I/O utilization).`
        )
        rec.quantity = actualUnits
      }
    }
  }
}

/**
 * Estimate physical I/O lines consumed per logical channel for a given signal type.
 * Encoders use quadrature (A+B+Z = 3 lines), resolvers use 6 lines (sin+cos+ref × 2),
 * most others use 1 line per channel.
 */
function getIOLinesPerChannel(subId: string): number {
  switch (subId) {
    case 'encoder': return 3   // Quadrature: A, B, Z
    case 'resolver': return 6  // Sin+, Sin-, Cos+, Cos-, Ref+, Ref-
    case 'spi': return 4       // MOSI, MISO, CLK, CS
    case 'i2c': return 2       // SDA, SCL
    case 'serial': return 2    // TX, RX
    default: return 1
  }
}

/**
 * Determine ALL I/O interface extensions needed for a set of covered rows.
 * Returns multiple extensions when the board serves mixed signal types.
 * E.g., a board covering both resolver and analog rows returns ['-24', '-120'].
 *
 * Priority ladder (collected in order):
 *   resolver (-24) > analog (-120) > RS422 (-22) > sub-ID prefs > TTL (-21 default)
 */
function determineRequiredExtensions(
  coveredRows: Set<string>,
  rowDiffs?: ProposalRowDiff[]
): string[] {
  if (!rowDiffs) return ['-21']
  const coveredDiffs = rowDiffs.filter(d => coveredRows.has(d.rowId))
  if (coveredDiffs.length === 0) return ['-21']

  const extensions = new Set<string>()

  // Resolver rows need -24
  if (coveredDiffs.some(d => d.subId === 'resolver')) extensions.add('-24')
  // Analog rows need -120
  if (coveredDiffs.some(d => d.categoryId === 'analog')) extensions.add('-120')
  // RS422/RS485/differential rows need -22
  if (coveredDiffs.some(d => {
    const specValues = Object.values(d.requestedSpecs).join(' ').toLowerCase()
    return specValues.includes('rs422') || specValues.includes('rs485') || specValues.includes('differential')
  })) extensions.add('-22')
  // Sub-ID-based preferences (e.g., a2b → -40)
  for (const d of coveredDiffs) {
    const pref = SUB_ID_EXTENSION_PREFERENCE[d.subId]
    if (pref) extensions.add(pref)
  }

  // Default to TTL (-21) if nothing more specific is needed
  if (extensions.size === 0) extensions.add('-21')
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

  const hasAnalog = coveredDiffs.some(d => d.categoryId === 'analog')
  const hasDigital = coveredDiffs.some(d =>
    d.categoryId === 'digital' || d.subId === 'pwm' || d.subId === 'capture' || d.subId === 'gpio'
  )
  const hasRS422 = coveredDiffs.some(d => {
    const specValues = Object.values(d.requestedSpecs).join(' ').toLowerCase()
    return specValues.includes('rs422') || specValues.includes('rs485')
  })
  const hasLVDS = coveredDiffs.some(d => {
    const specValues = Object.values(d.requestedSpecs).join(' ').toLowerCase()
    return specValues.includes('lvds')
  })

  // Mixed analog + digital → IO33X-6 (most versatile)
  if (hasAnalog && hasDigital) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-6') ?? null
  // Analog only — prefer high-speed inputs
  if (hasAnalog) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-5') ?? null
  // RS422/RS485 needs differential I/O
  if (hasRS422) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-2') ?? null
  // LVDS
  if (hasLVDS) return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-4') ?? null
  // Default: digital LVTTL
  return IO_INTERFACE_BOARDS.find(b => b.interfaceId === 'IO33X-1-LV') ?? null
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
  // ── IO extensions for modules with supportsIOExtensions ──
  const entriesNeedingExtensions = Array.from(recommended.entries()).filter(
    ([, entry]) => Boolean(entry.module.fpgaFamily) && entry.module.supportsIOExtensions !== false
  )

  for (const [, entry] of entriesNeedingExtensions) {
    // Use fpgaFamily (e.g. 'IO324') for extension naming, not technicalName ('IO3xx (Resolver config)')
    const boardName = entry.module.fpgaFamily ?? entry.module.technicalName
    const extensions = determineRequiredExtensions(entry.coveredRows, rowDiffs)

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
          interfaceForModule: entry.module.moduleId,
        })
      }
    }
  }

  // ── IO33X-N interface boards for IO332/IO333 (supportsIOInterfaces) ──
  const entriesNeedingIO33X = Array.from(recommended.entries()).filter(
    ([, entry]) => Boolean(entry.module.fpgaFamily) && entry.module.supportsIOInterfaces === true
  )

  for (const [, entry] of entriesNeedingIO33X) {
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
        interfaceForModule: entry.module.moduleId,
      })
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
  rowDiffs: ProposalRowDiff[],
  requirements: RequirementRow[],
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  machineId?: string,
  fpgaCoverageMap?: Map<string, number>
): FpgaOverheadSwap[] {
  // Group recommended entries by fpgaFamily
  const familyEntries = new Map<string, { keys: string[]; totalModules: number; coveredRows: Set<string> }>()

  for (const [key, entry] of recommended) {
    const family = entry.module.fpgaFamily
    if (!family) continue
    const state = familyEntries.get(family)
    if (state) {
      state.keys.push(key)
      state.totalModules += entry.quantity
      for (const rowId of entry.coveredRows) state.coveredRows.add(rowId)
    } else {
      familyEntries.set(family, {
        keys: [key],
        totalModules: entry.quantity,
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
      const candidate = selectBestCandidate(row, moduleUsage, seededRandom, machineId, fpgaCoverageMap, /* excludeFpga */ true)
      if (!candidate) {
        allRowsHaveDedicated = false
        break
      }
      dedicatedTotal += candidate.units
      dedicatedWinners.push({ row, candidate })
    }

    // Can't swap if some rows have no dedicated alternative
    if (!allRowsHaveDedicated) continue

    // Compare: swap only if dedicated uses strictly fewer modules (ties → keep FPGA)
    if (dedicatedTotal < state.totalModules) {
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
        fpgaCount: state.totalModules,
        dedicatedCount: dedicatedTotal,
        replacements: Array.from(replacementMap.values()),
      })
    }
  }

  return swaps
}