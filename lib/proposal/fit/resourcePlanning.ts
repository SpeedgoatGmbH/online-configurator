import type {
  ProposalFpgaResourcePlanning,
  ProposalFpgaResourcePlanningFamily,
  ProposalRowDiff,
  RequirementRow,
} from '@/components/configurator/proposalTypes'
import { PROTOCOL_TO_SUB_ID } from '@/lib/proposal/configPackages'
import { getBoardModel } from './model'
import { resolveFitCodeModuleForRow } from './evaluator'

type PlanningEntry = {
  moduleId: string
  fpgaFamily?: string
  quantity: number
  coveredRows: Set<string>
  interfaceForModule?: string
}

/** Collect extension / interface-board IDs that are attached to a given parent module. */
function collectExtensionsForModule(parentModuleId: string, entries: PlanningEntry[]): string[] {
  return entries
    .filter(e => e.interfaceForModule === parentModuleId)
    .map(e => e.moduleId)
}

const RESOURCE_KEYS = ['slices', 'lut', 'register', 'ram16', 'ram8', 'dsp'] as const

/**
 * Convert a ProposalRowDiff to a RequirementRow suitable for code-module
 * resolution.  Protocol rows (communication / protocols / SPI) arrive with
 * subId="protocols" — remap to the concrete sub-ID (e.g. "spi") so that
 * SUB_ID_TO_CODE_MODULES can find the matching code module entry.
 */
function toRequirementRow(row: ProposalRowDiff): RequirementRow {
  let effectiveSubId = row.subId
  if (row.categoryId === 'communication' && row.subId === 'protocols') {
    const protocol = row.requestedSpecs.range || row.requestedSpecs.resolution || ''
    const mapped = PROTOCOL_TO_SUB_ID[protocol]
    if (mapped) effectiveSubId = mapped
  }
  return {
    rowId: row.rowId,
    categoryId: row.categoryId,
    categoryLabel: row.categoryLabel,
    subId: effectiveSubId,
    subLabel: row.subLabel,
    quantity: row.quantityRequested,
    specs: row.requestedSpecs,
  }
}

export function computeFpgaResourcePlanning(
  entries: PlanningEntry[],
  rowDiffs: ProposalRowDiff[]
): ProposalFpgaResourcePlanning | undefined {
  const families = new Map<
    string,
    { boardsUsed: number; coveredRows: Set<string>; members: PlanningEntry[] }
  >()

  for (const entry of entries) {
    if (entry.interfaceForModule) continue
    const family = entry.fpgaFamily
    if (!family) continue

    const existing = families.get(family)
    if (existing) {
      existing.boardsUsed += entry.quantity
      for (const rowId of entry.coveredRows) existing.coveredRows.add(rowId)
      existing.members.push(entry)
    } else {
      families.set(family, {
        boardsUsed: entry.quantity,
        coveredRows: new Set(entry.coveredRows),
        members: [entry],
      })
    }
  }

  if (families.size === 0) return undefined

  const familySummaries: ProposalFpgaResourcePlanningFamily[] = []

  for (const [family, state] of families) {
    const board = getBoardModel(family)
    if (!board) {
      familySummaries.push({
        family,
        boardModel: family,
        boardsUsed: state.boardsUsed,
        coveredRows: Array.from(state.coveredRows).sort(),
        resources: RESOURCE_KEYS.map((key) => ({
          key,
          used: 0,
          available: 0,
          headroom: 0,
          utilizationPct: 0,
        })),
        bottleneckResource: 'slices',
        headroomPctMin: 0,
        confidence: 'partial',
      })
      continue
    }

    const coveredDiffs = rowDiffs.filter((row) => state.coveredRows.has(row.rowId) && row.status !== 'unresolved')
    const usedByResource = new Map<(typeof RESOURCE_KEYS)[number], number>()
    for (const key of RESOURCE_KEYS) usedByResource.set(key, 0)

    let confidence: 'high' | 'partial' = 'high'
    const codeModuleChannels = new Map<string, { channels: number; row: RequirementRow }>()

    for (const row of coveredDiffs) {
      const requirementRow = toRequirementRow(row)
      const codeModule = resolveFitCodeModuleForRow(requirementRow)
      if (!codeModule) {
        confidence = 'partial'
        continue
      }
      const existing = codeModuleChannels.get(codeModule.normalizedName)
      if (existing) {
        existing.channels += requirementRow.quantity
      } else {
        codeModuleChannels.set(codeModule.normalizedName, { channels: requirementRow.quantity, row: requirementRow })
      }
    }

    for (const codeModuleUsage of codeModuleChannels.values()) {
      const codeModule = resolveFitCodeModuleForRow(codeModuleUsage.row)
      if (!codeModule) {
        confidence = 'partial'
        continue
      }
      for (const key of RESOURCE_KEYS) {
        const used = (usedByResource.get(key) ?? 0) + codeModule.resources.base[key] + codeModule.resources.perChannel[key] * codeModuleUsage.channels
        usedByResource.set(key, used)
      }
    }

    const resources = RESOURCE_KEYS.map((key) => {
      const used = usedByResource.get(key) ?? 0
      const available = board.resources[key] * Math.max(1, state.boardsUsed)
      if (available <= 0 && used > 0) confidence = 'partial'
      const headroom = available - used
      const utilizationPct = available > 0 ? Number(((used / available) * 100).toFixed(2)) : 0
      return {
        key,
        used: Number(used.toFixed(2)),
        available: Number(available.toFixed(2)),
        headroom: Number(headroom.toFixed(2)),
        utilizationPct,
      }
    })

    // Collect extensions attached to this family
    const extensions = collectExtensionsForModule(
      state.members[0]?.moduleId ?? family,
      entries
    )

    // When multiple boards of the same family are used, emit one card per
    // board so the UI can show per-board resource usage and per-board
    // extension attachments.
    if (state.boardsUsed > 1) {
      for (let i = 0; i < state.boardsUsed; i++) {
        const perBoardResources = RESOURCE_KEYS.map((key) => {
          const totalUsed = usedByResource.get(key) ?? 0
          // Distribute resource usage evenly across boards
          const used = totalUsed / state.boardsUsed
          const available = board.resources[key]
          const headroom = available - used
          const utilizationPct = available > 0 ? Number(((used / available) * 100).toFixed(2)) : 0
          return {
            key,
            used: Number(used.toFixed(2)),
            available: Number(available.toFixed(2)),
            headroom: Number(headroom.toFixed(2)),
            utilizationPct,
          }
        })

        const bottleneck = perBoardResources
          .filter((resource) => resource.available > 0)
          .sort((left, right) => left.headroom / left.available - right.headroom / right.available)[0]

        familySummaries.push({
          family,
          boardModel: board.boardModel,
          boardsUsed: 1,
          boardIndex: i + 1,
          coveredRows: Array.from(state.coveredRows).sort(),
          extensions: extensions.length > 0 ? extensions : undefined,
          resources: perBoardResources,
          bottleneckResource: bottleneck?.key ?? 'slices',
          headroomPctMin:
            bottleneck && bottleneck.available > 0
              ? Number((((bottleneck.headroom / bottleneck.available) * 100)).toFixed(2))
              : 0,
          confidence,
        })
      }
    } else {
      const bottleneck = resources
        .filter((resource) => resource.available > 0)
        .sort((left, right) => left.headroom / left.available - right.headroom / right.available)[0]

      familySummaries.push({
        family,
        boardModel: board.boardModel,
        boardsUsed: state.boardsUsed,
        coveredRows: Array.from(state.coveredRows).sort(),
        extensions: extensions.length > 0 ? extensions : undefined,
        resources,
        bottleneckResource: bottleneck?.key ?? 'slices',
        headroomPctMin:
          bottleneck && bottleneck.available > 0
            ? Number((((bottleneck.headroom / bottleneck.available) * 100)).toFixed(2))
            : 0,
        confidence,
      })
    }
  }

  familySummaries.sort((left, right) => {
    const famCmp = left.family.localeCompare(right.family)
    if (famCmp !== 0) return famCmp
    return (left.boardIndex ?? 0) - (right.boardIndex ?? 0)
  })

  const uniqueFamilies = new Set(familySummaries.map(f => f.family))

  return {
    generatedFrom: 'mat_fit_model_v1',
    familiesUsed: uniqueFamilies.size,
    boardsUsed: familySummaries.reduce((sum, family) => sum + family.boardsUsed, 0),
    families: familySummaries,
  }
}
