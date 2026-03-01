import { MOCK_MODULE_CATALOG, type MockModuleCatalogEntry } from '@/lib/proposal/mockCatalog'
import { createSeededRandom, hashObject, hashString } from '@/lib/proposal/seed'
import type {
  ProposalGenerateRequest,
  ProposalGenerateResponse,
  ProposalRecommendedModule,
  ProposalRowDiff,
  ProposalSpecDiff,
  ProposalUnresolvedRow,
  RequirementRow,
} from '@/components/configurator/proposalTypes'

export type CandidateScore = {
  module: MockModuleCatalogEntry
  units: number
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
  const recommended = new Map<
    string,
    {
      module: MockModuleCatalogEntry
      quantity: number
      coveredChannels: number
      coveredRows: Set<string>
      confidenceSum: number
      confidenceCount: number
      rationale: Set<string>
    }
  >()

  const rowDiffs: ProposalRowDiff[] = []
  const unresolved: ProposalUnresolvedRow[] = []
  const machineWarnings: string[] = []
  let coveredChannels = 0
  let incompatibleModuleCount = 0

  normalizedRequirements.forEach((row) => {
    const candidate = selectBestCandidate(row, moduleUsage, seededRandom, request.machineId)
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

    // Track if the best candidate is not compatible with the selected machine
    if (candidate.module.compatibleMachines &&
        !candidate.module.compatibleMachines.includes(request.machineId)) {
      incompatibleModuleCount++
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

    const confidence = calculateConfidence(candidate)
    const moduleState = recommended.get(candidate.module.moduleId)
    const rationale = buildRationale(row, candidate)
    if (moduleState) {
      moduleState.quantity += candidate.units
      moduleState.coveredChannels += row.quantity
      moduleState.coveredRows.add(row.rowId)
      moduleState.confidenceSum += confidence
      moduleState.confidenceCount += 1
      moduleState.rationale.add(rationale)
    } else {
      recommended.set(candidate.module.moduleId, {
        module: candidate.module,
        quantity: candidate.units,
        coveredChannels: row.quantity,
        coveredRows: new Set([row.rowId]),
        confidenceSum: confidence,
        confidenceCount: 1,
        rationale: new Set([rationale]),
      })
    }
  })

  // --- FPGA post-processing: consolidate boards & add -21 interfaces ---------
  consolidateFpgaModules(rowDiffs, recommended)
  addFpgaInterfaceBoards(recommended)

  const recommendedModules: ProposalRecommendedModule[] = Array.from(recommended.values())
    .map((entry) => ({
      moduleId: entry.module.moduleId,
      friendlyName: entry.module.friendlyName,
      technicalName: entry.module.technicalName,
      quantity: entry.quantity,
      coveredChannels: entry.coveredChannels,
      coveredRows: Array.from(entry.coveredRows),
      confidence: Math.round(entry.confidenceSum / entry.confidenceCount),
      rationale: Array.from(entry.rationale).join(' '),
    }))
    .sort((left, right) => {
      if (left.quantity !== right.quantity) return left.quantity - right.quantity
      if (left.confidence !== right.confidence) return right.confidence - left.confidence
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

  // Warn about modules not compatible with the selected machine
  if (incompatibleModuleCount > 0) {
    machineWarnings.push(
      `${incompatibleModuleCount} recommended module${incompatibleModuleCount > 1 ? 's are' : ' is'} not officially listed for ${request.machineName}. Verify compatibility with Speedgoat.`
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
  const perRow: PerRowCandidates[] = []

  for (const row of normalizedRequirements) {
    const { allCandidates, winner } = selectAllCandidates(row, moduleUsage, seededRandom, request.machineId)
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
    catalogSize: MOCK_MODULE_CATALOG.length,
  }
}

function selectAllCandidates(
  row: RequirementRow,
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  machineId?: string
): { allCandidates: CandidateScore[]; winner: CandidateScore | null } {
  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (entry.categoryCoverage !== row.categoryId) return false
    return entry.subCoverage.includes(row.subId)
  })

  if (candidates.length === 0) return { allCandidates: [], winner: null }

  const scoredCandidates = candidates
    .map((candidate) => evaluateCandidate(row, candidate, moduleUsage, seededRandom, machineId))
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))

  if (scoredCandidates.length === 0) return { allCandidates: [], winner: null }

  scoredCandidates.sort((left, right) => {
    if (left.units !== right.units) return left.units - right.units
    if (left.score !== right.score) return right.score - left.score
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
  machineId?: string
): CandidateScore | null {
  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (entry.categoryCoverage !== row.categoryId) return false
    return entry.subCoverage.includes(row.subId)
  })

  if (candidates.length === 0) return null

  const scoredCandidates = candidates
    .map((candidate) => evaluateCandidate(row, candidate, moduleUsage, seededRandom, machineId))
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))

  if (scoredCandidates.length === 0) return null

  scoredCandidates.sort((left, right) => {
    if (left.units !== right.units) return left.units - right.units
    if (left.score !== right.score) return right.score - left.score
    if (left.tieBreaker !== right.tieBreaker) return left.tieBreaker - right.tieBreaker
    return left.module.moduleId.localeCompare(right.module.moduleId)
  })

  return scoredCandidates[0]
}

function evaluateCandidate(
  row: RequirementRow,
  module: MockModuleCatalogEntry,
  moduleUsage: Map<string, number>,
  seededRandom: () => number,
  machineId?: string
): CandidateScore | null {
  if (row.categoryId === 'communication') {
    const requestedProtocol = row.specs.range
    if (requestedProtocol && (!module.protocolSupport || !module.protocolSupport.includes(requestedProtocol))) {
      return null
    }
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
    const specMatch = compareSpec(requested, module.supportedSpecs[key], key)
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
  // Prefer modules compatible with the selected machine
  const machineBonus = machineId && module.compatibleMachines?.includes(machineId) ? 5 : 0
  const score = exactCount * 12 + compatibleCount * 6 - mismatchCount * 10 - missingCount * 8 - units * 2 + consolidationBonus + machineBonus

  return {
    module,
    units,
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

function calculateConfidence(candidate: CandidateScore): number {
  const raw =
    62 +
    candidate.exactCount * 8 +
    candidate.compatibleCount * 4 -
    candidate.mismatchCount * 11 -
    candidate.missingCount * 8 -
    Math.max(0, candidate.units - 1) * 3
  return Math.max(15, Math.min(98, Math.round(raw)))
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
 * After the main per-row matching loop, FPGA boards that were selected by
 * multiple rows across different categories can often be **consolidated**.
 * E.g. 6×PWM (6 lines) + 4×QAD (12 lines) = 18 lines total, which fits on
 * a single 96-line IO323 instead of allocating two.
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
    confidenceSum: number
    confidenceCount: number
    rationale: Set<string>
  }>
): void {
  // Sum fractional board usage per fpgaFamily across all rows.
  const familyUsage = new Map<string, number>()

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
    const fraction = diff.quantityRequested / entry.channelCapacity
    familyUsage.set(entry.fpgaFamily, (familyUsage.get(entry.fpgaFamily) || 0) + fraction)
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
    const actualUnits = Math.max(1, Math.ceil(fraction))
    if (actualUnits < rec.quantity) {
      rec.rationale.add(
        `Consolidated onto ${actualUnits} × ${family} (${Math.round(fraction * 100)}% I/O utilization).`
      )
      rec.quantity = actualUnits
    }
  }
}

/**
 * For every recommended module that declares an `interfaceBoard` in the catalog,
 * auto-add the matching interface / connector board to the recommended list.
 *
 * This is fully data-driven: any catalog entry (FPGA or otherwise) that sets
 * `interfaceBoard: { moduleId, friendlyName }` will have its companion board
 * injected automatically. No hardcoded map to maintain.
 *
 * For FPGA boards without an explicit `interfaceBoard`, falls back to the
 * convention `{technicalName}-21`.
 */
function addFpgaInterfaceBoards(
  recommended: Map<string, {
    module: MockModuleCatalogEntry
    quantity: number
    coveredChannels: number
    coveredRows: Set<string>
    confidenceSum: number
    confidenceCount: number
    rationale: Set<string>
  }>
): void {
  // Collect all entries that either declare an interfaceBoard or are FPGA-backed
  const entriesNeedingInterface = Array.from(recommended.entries()).filter(
    ([, entry]) => Boolean(entry.module.interfaceBoard) || Boolean(entry.module.fpgaFamily)
  )

  for (const [, entry] of entriesNeedingInterface) {
    const techName = entry.module.technicalName
    // Prefer the explicit interfaceBoard from the catalog; fall back to {techName}-21 convention
    const mapping = entry.module.interfaceBoard ?? {
      moduleId: `${techName}-21`,
      friendlyName: `Interface Board ${techName}-21`,
    }

    const existing = recommended.get(mapping.moduleId)
    if (existing) {
      existing.quantity += entry.quantity
      for (const rowId of entry.coveredRows) existing.coveredRows.add(rowId)
      existing.rationale.add(`Required interface for ${techName}.`)
    } else {
      recommended.set(mapping.moduleId, {
        module: {
          moduleId: mapping.moduleId,
          friendlyName: mapping.friendlyName,
          technicalName: mapping.moduleId,
          categoryCoverage: 'interface',
          subCoverage: [],
          channelCapacity: 0,
          supportedSpecs: {},
          fpgaFamily: techName,
        },
        quantity: entry.quantity,
        coveredChannels: 0,
        coveredRows: new Set(entry.coveredRows),
        confidenceSum: 95 * entry.quantity,
        confidenceCount: entry.quantity,
        rationale: new Set([`Required interface / connector board for ${techName}.`]),
      })
    }
  }
}
