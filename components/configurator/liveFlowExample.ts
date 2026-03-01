/**
 * Builds a FlowExample from live configurator rows by running the simulator
 * and extracting per-row candidates, scores, and FPGA consolidation data.
 */

import type { RequirementRow, ProposalGenerateRequest } from './proposalTypes'
import type { FlowExample, ModuleShowcase, ModuleCandidate, ScoreBreakdownLine, NodeSnapshot } from './decisionFlowExamples'
import type { StarterRow } from './industries'
import {
  simulateProposalWithCandidates,
  type CandidateScore,
  type SimulationWithCandidates,
} from '@/lib/proposal/simulator'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function requirementLabel(row: { categoryLabel: string; subLabel: string; quantity: number }): string {
  return `${row.categoryLabel} ${row.subLabel} × ${row.quantity}`
}

function buildScoreBreakdown(c: CandidateScore): ScoreBreakdownLine[] {
  const lines: ScoreBreakdownLine[] = []

  if (c.exactCount > 0) {
    lines.push({
      label: 'Exact match',
      points: c.exactCount * 12,
      detail: `${c.exactCount} spec${c.exactCount > 1 ? 's' : ''} matched perfectly (×12)`,
    })
  }
  if (c.compatibleCount > 0) {
    lines.push({
      label: 'Partial match',
      points: c.compatibleCount * 6,
      detail: `${c.compatibleCount} spec${c.compatibleCount > 1 ? 's' : ''} compatible but not exact (×6)`,
    })
  }
  if (c.mismatchCount > 0) {
    lines.push({
      label: 'Mismatch',
      points: -c.mismatchCount * 10,
      detail: `${c.mismatchCount} spec${c.mismatchCount > 1 ? 's' : ''} couldn't be met (×−10)`,
    })
  }
  if (c.missingCount > 0) {
    lines.push({
      label: 'Missing spec',
      points: -c.missingCount * 8,
      detail: `${c.missingCount} spec${c.missingCount > 1 ? 's' : ''} not supported by module (×−8)`,
    })
  }
  if (c.consolidationBonus > 0) {
    lines.push({
      label: 'Consolidation',
      points: c.consolidationBonus,
      detail: 'Reuses a module already selected for another row',
    })
  }
  if (c.machineBonus > 0) {
    lines.push({
      label: 'Machine bonus',
      points: c.machineBonus,
      detail: 'Verified compatible with the selected machine',
    })
  }
  if (c.units > 0) {
    lines.push({
      label: 'Unit penalty',
      points: -c.units * 2,
      detail: `${c.units} board${c.units > 1 ? 's' : ''} needed (×−2)`,
    })
  }

  return lines
}

function candidateReason(c: CandidateScore, isWinner: boolean): string {
  if (!isWinner) {
    if (c.units > 1) return `Needs ${c.units} units`
    if (c.mismatchCount > 0) return `${c.mismatchCount} spec mismatch${c.mismatchCount > 1 ? 'es' : ''}`
    return 'Lower overall score'
  }
  if (c.consolidationBonus > 0) return 'Consolidation + best score'
  if (c.machineBonus > 0) return 'Machine compatible + best score'
  if (c.exactCount > 0 && c.mismatchCount === 0) return 'Best spec alignment'
  return 'Highest overall score'
}

// ─── Node snapshot generation ───────────────────────────────────────────────────

const NODE_IDS = [
  'input', 'normalize', 'catalog_filter', 'score', 'pick_best', 'accumulate',
  'fpga_detect', 'fpga_consolidate', 'fpga_interface',
  'slot_check', 'compat_check', 'output',
] as const

function buildNodeSnapshots(sim: SimulationWithCandidates, machineName: string): NodeSnapshot[] {
  const { response, perRow, fpgaConsolidation, catalogSize } = sim
  const rowCount = perRow.length
  const categorySet = new Set(perRow.map((r) => r.categoryLabel))
  const categories = Array.from(categorySet).join(', ')
  const uniqueModules = new Set(response.recommendedModules.map((m) => m.moduleId)).size
  const hasFpga = fpgaConsolidation !== null || response.recommendedModules.some((m) => m.moduleId.includes('-21'))

  const avgConfidence = response.recommendedModules.length > 0
    ? Math.round(response.recommendedModules.reduce((s, m) => s + m.confidence, 0) / response.recommendedModules.length)
    : 0

  // Typical candidate count range
  const candidateCounts = perRow.map((r) => r.allCandidates.length).filter((n) => n > 0)
  const minCandidates = candidateCounts.length > 0 ? Math.min(...candidateCounts) : 0
  const maxCandidates = candidateCounts.length > 0 ? Math.max(...candidateCounts) : 0

  // Winner examples (up to 2)
  const winners = perRow.filter((r) => r.winner).slice(0, 2)
  const winnerFacts = winners.map((r) => `${r.winner!.module.moduleId} wins ${r.subLabel} (score ${r.winner!.score})`).join(' · ')

  return [
    { nodeId: 'input', fact: `${rowCount} requirement rows → RequirementRow[]` },
    { nodeId: 'normalize', fact: `Sorted: ${categories} (${rowCount} rows)` },
    { nodeId: 'catalog_filter', fact: `${catalogSize} modules → ${minCandidates}–${maxCandidates} candidates per row` },
    { nodeId: 'score', fact: winnerFacts || 'No winners determined' },
    { nodeId: 'pick_best', fact: `${uniqueModules} unique modules selected` },
    { nodeId: 'accumulate', fact: `${response.summary.moduleCount} total boards accumulated` },
    { nodeId: 'fpga_detect', fact: hasFpga ? `FPGA modules detected → branch active` : 'No FPGA modules → branch skipped' },
    { nodeId: 'fpga_consolidate', fact: fpgaConsolidation ? `Before: ${fpgaConsolidation.before} boards → After: ${fpgaConsolidation.after} boards` : '—' },
    { nodeId: 'fpga_interface', fact: hasFpga ? `Auto-added interface boards` : '—' },
    { nodeId: 'slot_check', fact: `${response.summary.moduleCount} modules · ${machineName}: ${response.machineWarnings ? 'WARNING' : 'OK'}` },
    { nodeId: 'compat_check', fact: response.machineWarnings?.length ? 'Compatibility warnings found' : `All modules compatible with ${machineName}` },
    { nodeId: 'output', fact: `${response.summary.coveredChannels} channels resolved, ${response.summary.unresolvedCount} unresolved · avg confidence ${avgConfidence}%` },
  ]
}

// ─── Overview facts (7 stages) ──────────────────────────────────────────────────

function buildOverviewFacts(sim: SimulationWithCandidates, machineName: string): [string, string, string, string, string, string, string] {
  const { response, perRow, fpgaConsolidation, catalogSize } = sim
  const rowCount = perRow.length
  const categorySet = new Set(perRow.map((r) => r.categoryLabel))

  const candidateCounts = perRow.map((r) => r.allCandidates.length).filter((n) => n > 0)
  const minCandidates = candidateCounts.length > 0 ? Math.min(...candidateCounts) : 0
  const maxCandidates = candidateCounts.length > 0 ? Math.max(...candidateCounts) : 0

  const uniqueModules = new Set(response.recommendedModules.map((m) => m.moduleId)).size
  const avgConfidence = response.recommendedModules.length > 0
    ? Math.round(response.recommendedModules.reduce((s, m) => s + m.confidence, 0) / response.recommendedModules.length)
    : 0

  // Top 3 winner facts
  const winnerFacts = perRow
    .filter((r) => r.winner)
    .slice(0, 3)
    .map((r) => `${r.winner!.module.moduleId} wins ${r.subLabel} (score ${r.winner!.score})`)
    .join(' · ')

  const fpgaFact = fpgaConsolidation
    ? `FPGA consolidation: ${fpgaConsolidation.before} boards → ${fpgaConsolidation.after} (${fpgaConsolidation.before - fpgaConsolidation.after} saved)`
    : 'No FPGA modules → optimization step skipped'

  const slotFact = response.machineWarnings?.length
    ? `${response.summary.moduleCount} modules · ${machineName}: expansion needed`
    : `Fits in ${machineName} (${response.summary.moduleCount} modules)`

  return [
    `${rowCount} requirements: ${Array.from(categorySet).join(', ')}`,
    `Searched ${catalogSize} I/O modules · found ${minCandidates}–${maxCandidates} candidates per row`,
    `Scored every candidate by spec match, channel count, consolidation, and machine fit`,
    winnerFacts || 'No module winners (all rows unresolved)',
    fpgaFact,
    slotFact,
    `${avgConfidence}% avg confidence · ${response.summary.coveredChannels - response.summary.unresolvedCount} of ${rowCount} rows resolved`,
  ]
}

// ─── Module showcase ────────────────────────────────────────────────────────────

function buildModuleShowcase(perRow: SimulationWithCandidates['perRow']): ModuleShowcase[] {
  return perRow
    .filter((r) => r.allCandidates.length > 0)
    .map((r) => {
      // Show up to 3 candidates per row
      const top = r.allCandidates.slice(0, 3)
      const winnerId = r.winner?.module.moduleId

      const candidates: ModuleCandidate[] = top.map((c) => {
        const isWinner = c.module.moduleId === winnerId
        return {
          moduleId: c.module.moduleId,
          name: `${c.module.moduleId} – ${c.module.friendlyName}`,
          score: c.score,
          units: c.units,
          isWinner,
          reason: candidateReason(c, isWinner),
          ...(isWinner ? { scoreBreakdown: buildScoreBreakdown(c) } : {}),
        }
      })

      return {
        requirementLabel: requirementLabel(r),
        candidates,
      }
    })
}

// ─── Main builder ───────────────────────────────────────────────────────────────

export function buildLiveFlowExample(
  requirementsRows: RequirementRow[],
  machineId: string,
  machineName: string,
  maxSlots?: number,
  maxSlotsExpanded?: number,
): FlowExample | undefined {
  if (requirementsRows.length === 0) return undefined

  const request: ProposalGenerateRequest = {
    machineId,
    machineName,
    version: 'live-flow',
    requirements: requirementsRows,
    maxSlots,
    maxSlotsExpanded,
  }

  const sim = simulateProposalWithCandidates(request)
  const hasFpga = sim.fpgaConsolidation !== null || sim.response.recommendedModules.some((m) => m.moduleId.includes('-21'))

  const starterRows: StarterRow[] = requirementsRows.map((r) => ({
    categoryId: r.categoryId,
    subId: r.subId,
    quantity: r.quantity,
    specs: r.specs,
  }))

  return {
    id: 'live_config',
    label: 'Your Configuration',
    icon: '🔧',
    description: `${requirementsRows.length} requirement rows from your current setup`,
    requirements: starterRows,
    hasFpgaBranch: hasFpga,
    nodeSnapshots: buildNodeSnapshots(sim, machineName),
    overviewFacts: buildOverviewFacts(sim, machineName),
    moduleShowcase: buildModuleShowcase(sim.perRow),
  }
}
