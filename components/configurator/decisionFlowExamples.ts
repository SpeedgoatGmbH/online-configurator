/**
 * Pre-computed example scenarios for the Decision Flow modal.
 *
 * Each example defines:
 * – `requirements`: StarterRow[] that can be loaded into the configurator
 * – `nodeSnapshots`: per-node-id fact badges shown during the animated walkthrough
 */

import type { StarterRow } from './industries'
import type { OptimizationProfile } from './proposalTypes'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface NodeSnapshot {
  /** Matches a node ID in the flow graph */
  nodeId: string
  /** Short fact line displayed as a badge on the node */
  fact: string
}

/** One line in a score breakdown shown on the Score stage */
export interface ScoreBreakdownLine {
  label: string
  points: number
  /** Plain-English explanation */
  detail: string
}

/** A candidate module shown in the Overview "Score & Rank" stage */
export interface ModuleCandidate {
  moduleId: string
  name: string
  score: number
  units: number
  isWinner: boolean
  /** Short reason (e.g. "exact protocol match") */
  reason: string
  /** Optional breakdown of the score into human-readable buckets */
  scoreBreakdown?: ScoreBreakdownLine[]
}

/** One showcase row: requirement → candidate modules */
export interface ModuleShowcase {
  /** Human-friendly requirement label, e.g. "CAN FD × 4" */
  requirementLabel: string
  candidates: ModuleCandidate[]
}

export type FpgaInterfaceBoardInfo = {
  /** Interface board module ID (e.g. "IO324-21") */
  boardId: string
  /** Human-readable description of what this extension does */
  friendlyName: string
  /** Parent FPGA module ID this board belongs to */
  parentModuleId: string
  /** Parent FPGA module's human-readable name */
  parentFriendlyName: string
  /** How many of this board */
  quantity: number
}

/** Aggregated BOM figures shown in the System Overview node at the end of the flow */
export interface SystemSummary {
  /** Sum of quantities of ALL recommended entries (main boards + interface boards) */
  totalBoardsQty: number
  /** Sum of quantities of main boards only (FPGA + dedicated, no interface accessories) */
  mainBoardsQty: number
  /** Quantity of main FPGA boards (fpgaFamily set, no interfaceForModule) */
  fpgaBoardsQty: number
  /** Quantity of interface/extension boards (interfaceForModule set) */
  interfaceBoardsQty: number
  /** Quantity of dedicated (non-FPGA, non-interface) boards */
  dedicatedBoardsQty: number
  resolvedRows: number
  totalRows: number
  coveredChannels: number
  unresolvedCount: number
}

export interface FlowExample {
  id: string
  label: string
  icon: string
  description: string
  /** Rows that can be loaded into the configurator */
  requirements: StarterRow[]
  /** Whether the FPGA branch should light up */
  hasFpgaBranch: boolean
  /** FPGA board consolidation before/after (null when no savings) */
  fpgaConsolidation: { before: number; after: number } | null
  /** Total interface boards (extensions + IO33X) added for FPGA modules */
  fpgaInterfaceBoardCount: number
  /** Details of each interface board selected for FPGA modules */
  fpgaInterfaceBoards: FpgaInterfaceBoardInfo[]
  /** Per-node snapshot facts displayed during animation */
  nodeSnapshots: NodeSnapshot[]
  /** 8 plain-English facts for Overview mode (one per stage) */
  overviewFacts: [string, string, string, string, string, string, string, string]
  /** Module candidate comparisons shown in the "Score & Rank" stage */
  moduleShowcase: ModuleShowcase[]
  /** Aggregated BOM figures for the System Overview node */
  systemSummary?: SystemSummary
  /** Optimization profile applied for this live simulation. */
  optimizationProfile?: OptimizationProfile
}
