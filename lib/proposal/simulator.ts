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

type CandidateScore = {
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
  let coveredChannels = 0

  normalizedRequirements.forEach((row) => {
    const candidate = selectBestCandidate(row, moduleUsage, seededRandom)
    if (!candidate || candidate.score < 0) {
      const unresolvedEntry = buildUnresolvedRow(row)
      unresolved.push(unresolvedEntry)
      rowDiffs.push({
        rowId: row.rowId,
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
      moduleState.coveredRows.add(`${row.categoryLabel} / ${row.subLabel} (${row.quantity})`)
      moduleState.confidenceSum += confidence
      moduleState.confidenceCount += 1
      moduleState.rationale.add(rationale)
    } else {
      recommended.set(candidate.module.moduleId, {
        module: candidate.module,
        quantity: candidate.units,
        coveredChannels: row.quantity,
        coveredRows: new Set([`${row.categoryLabel} / ${row.subLabel} (${row.quantity})`]),
        confidenceSum: confidence,
        confidenceCount: 1,
        rationale: new Set([rationale]),
      })
    }
  })

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

  return {
    proposalId: `mock-${proposalHash.toString(16)}`,
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
  }
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
  seededRandom: () => number
): CandidateScore | null {
  const candidates = MOCK_MODULE_CATALOG.filter((entry) => {
    if (entry.categoryCoverage !== row.categoryId) return false
    return entry.subCoverage.includes(row.subId)
  })

  if (candidates.length === 0) return null

  const scoredCandidates = candidates
    .map((candidate) => evaluateCandidate(row, candidate, moduleUsage, seededRandom))
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
  seededRandom: () => number
): CandidateScore | null {
  if (row.categoryId === 'communication') {
    const requestedProtocol = row.specs.range
    if (requestedProtocol && (!module.protocolSupport || !module.protocolSupport.includes(requestedProtocol))) {
      return null
    }
  }

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
  const consolidationBonus = row.categoryId === 'communication' && hasPriorUsage ? 10 : 0
  const score = exactCount * 12 + compatibleCount * 6 - mismatchCount * 10 - missingCount * 8 - units * 2 + consolidationBonus

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
