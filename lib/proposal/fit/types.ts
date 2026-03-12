import type { FitGateReason, FitResourceKey, ProposalFitDiagnostics, RequirementRow } from '@/components/configurator/proposalTypes'

export type FitSignalCapacity = {
  analogInputs: number
  analogOutputs: number
  digitalTTL: number
  digitalRs422: number
  digitalLvds: number
  resolver: number
}

export type FitBoardModel = {
  boardModel: string
  resources: Record<FitResourceKey, number>
  signalCapacity: FitSignalCapacity
  supportsFrontPlugin: boolean
  supportedInterfaces: string[]
  supportedExtensions: string[]
}

export type FitCodeModule = {
  name: string
  normalizedName: string
  mappable: boolean
  maxChannels?: number
  resources: {
    base: Record<FitResourceKey, number>
    perChannel: Record<FitResourceKey, number>
  }
}

export type FitModel = {
  generatedFrom: 'mat_fit_model_v1'
  generatedAtUtc: string
  boards: Record<string, FitBoardModel>
  interfaces: Record<string, FitSignalCapacity>
  extensions: Record<string, FitSignalCapacity>
  codeModules: Record<string, FitCodeModule>
  moduleAliases: Record<string, string>
}

export type FitEvaluationResult = {
  pass: boolean
  failOpen: boolean
  confidence: 'high' | 'partial'
  reasons: FitGateReason[]
  resolvedBoardModel?: string
  signalDemandType?: keyof FitSignalCapacity
  signalDemandQty?: number
  codeModuleName?: string
  effectiveChannels?: number
}

export type FitRowDiagnosticsAccumulator = {
  rowId: string
  evaluated: number
  passed: number
  failOpen: number
  rejected: number
  rejectionsByReason: Map<FitGateReason, number>
  sampleRejectedCandidates: Array<{ moduleId: string; reasons: FitGateReason[] }>
}

export type FitDiagnosticsAccumulator = {
  rows: Map<string, FitRowDiagnosticsAccumulator>
  totalEvaluated: number
  totalRejected: number
  totalFailOpen: number
}

export function createFitDiagnosticsAccumulator(requirements: RequirementRow[]): FitDiagnosticsAccumulator {
  const rows = new Map<string, FitRowDiagnosticsAccumulator>()
  for (const row of requirements) {
    rows.set(row.rowId, {
      rowId: row.rowId,
      evaluated: 0,
      passed: 0,
      failOpen: 0,
      rejected: 0,
      rejectionsByReason: new Map<FitGateReason, number>(),
      sampleRejectedCandidates: [],
    })
  }
  return {
    rows,
    totalEvaluated: 0,
    totalRejected: 0,
    totalFailOpen: 0,
  }
}

export function getFitRowAccumulator(
  accumulator: FitDiagnosticsAccumulator,
  rowId: string
): FitRowDiagnosticsAccumulator {
  const existing = accumulator.rows.get(rowId)
  if (existing) return existing

  const fallback: FitRowDiagnosticsAccumulator = {
    rowId,
    evaluated: 0,
    passed: 0,
    failOpen: 0,
    rejected: 0,
    rejectionsByReason: new Map<FitGateReason, number>(),
    sampleRejectedCandidates: [],
  }
  accumulator.rows.set(rowId, fallback)
  return fallback
}

export function recordFitEvaluation(
  accumulator: FitDiagnosticsAccumulator,
  rowId: string,
  moduleId: string,
  result: FitEvaluationResult
): void {
  const row = getFitRowAccumulator(accumulator, rowId)
  row.evaluated += 1
  accumulator.totalEvaluated += 1

  if (result.failOpen) {
    row.failOpen += 1
    accumulator.totalFailOpen += 1
  }

  if (result.pass) {
    row.passed += 1
    return
  }

  row.rejected += 1
  accumulator.totalRejected += 1
  for (const reason of result.reasons) {
    row.rejectionsByReason.set(reason, (row.rejectionsByReason.get(reason) ?? 0) + 1)
  }
  if (row.sampleRejectedCandidates.length < 5) {
    row.sampleRejectedCandidates.push({ moduleId, reasons: result.reasons })
  }
}

export function buildFitDiagnostics(
  accumulator: FitDiagnosticsAccumulator,
  requirementsCount: number
): ProposalFitDiagnostics {
  const rows = Array.from(accumulator.rows.values()).map((row) => ({
    rowId: row.rowId,
    evaluated: row.evaluated,
    passed: row.passed,
    failOpen: row.failOpen,
    rejectionsByReason: Object.fromEntries(Array.from(row.rejectionsByReason.entries())),
    sampleRejectedCandidates: row.sampleRejectedCandidates,
  }))

  const rowsHardRejected = rows.filter((row) => row.evaluated > 0 && row.passed === 0 && row.sampleRejectedCandidates.length > 0).length

  return {
    policy: {
      enforcement: 'hard_gate',
      scope: 'all_modules',
      missingDataPolicy: 'fail_open',
      costMode: 'none',
      dataSource: 'mat_fit_model_v1',
    },
    summary: {
      rows: requirementsCount,
      candidatesEvaluated: accumulator.totalEvaluated,
      candidatesRejected: accumulator.totalRejected,
      failOpenCount: accumulator.totalFailOpen,
      rowsHardRejected,
    },
    rows,
  }
}

export function getTopFitRejectionReasons(
  accumulator: FitDiagnosticsAccumulator,
  rowId: string,
  maxReasons = 2
): FitGateReason[] {
  const row = accumulator.rows.get(rowId)
  if (!row) return []
  return Array.from(row.rejectionsByReason.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxReasons)
    .map(([reason]) => reason)
}

export function wasRowHardRejectedByFit(
  accumulator: FitDiagnosticsAccumulator,
  rowId: string
): boolean {
  const row = accumulator.rows.get(rowId)
  if (!row) return false
  return row.evaluated > 0 && row.passed === 0 && row.rejected > 0
}
