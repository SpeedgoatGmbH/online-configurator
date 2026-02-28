/**
 * Pre-computed example scenarios for the Decision Flow modal.
 *
 * Each example defines:
 * – `requirements`: StarterRow[] that can be loaded into the configurator
 * – `nodeSnapshots`: per-node-id fact badges shown during the animated walkthrough
 */

import type { StarterRow } from './industries'

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

export interface FlowExample {
  id: string
  label: string
  icon: string
  description: string
  /** Rows that can be loaded into the configurator */
  requirements: StarterRow[]
  /** Whether the FPGA branch should light up */
  hasFpgaBranch: boolean
  /** Per-node snapshot facts displayed during animation */
  nodeSnapshots: NodeSnapshot[]
  /** 7 plain-English facts for Overview mode (one per stage) */
  overviewFacts: [string, string, string, string, string, string, string]
  /** Module candidate comparisons shown in the "Score & Rank" stage */
  moduleShowcase: ModuleShowcase[]
}

// ─── Examples ───────────────────────────────────────────────────────────────────

export const FLOW_EXAMPLES: FlowExample[] = [
  {
    id: 'automotive_hil',
    label: 'Automotive HIL',
    icon: '🚗',
    description: '8 requirement rows · CAN FD, LIN, FlexRay, SENT, analog I/O, digital I/O, encoder',
    hasFpgaBranch: true,
    requirements: [
      { categoryId: 'communication', subId: 'protocols', quantity: 4, specs: { range: 'CAN FD', resolution: 'HS CAN FD', speed: '5 Mbit/s' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'LIN', resolution: 'LIN', speed: '19.2 kbit/s' } },
      { categoryId: 'analog', subId: 'inputs', quantity: 32, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'digital', subId: 'inputs', quantity: 64, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' } },
      { categoryId: 'motion', subId: 'encoder', quantity: 4, specs: { range: 'Incremental', speed: '100 kHz', resolution: '16-bit' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'FlexRay', resolution: 'FlexRay', speed: '10 Mbit/s' } },
      { categoryId: 'analog', subId: 'outputs', quantity: 8, specs: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 4, specs: { range: 'SENT', resolution: 'SENT', speed: '30 kbit/s' } },
    ],
    nodeSnapshots: [
      { nodeId: 'input', fact: '8 requirement rows → RequirementRow[]' },
      { nodeId: 'normalize', fact: 'Sorted: analog (2) → comm (4) → digital (1) → motion (1)' },
      { nodeId: 'catalog_filter', fact: 'CAN FD row: 90+ modules → 6 candidates (IO602, IO610–614)' },
      { nodeId: 'score', fact: 'IO611: exact×12=24 + compat×6=6 + consolidation=10 → score 38' },
      { nodeId: 'pick_best', fact: 'IO611 wins (1 unit, score 38). IO602 2nd (1 unit, score 28)' },
      { nodeId: 'accumulate', fact: '6 unique modules accumulated. IO611 covers CAN FD + LIN rows' },
      { nodeId: 'fpga_detect', fact: 'IO334 (encoder+digital) has fpgaFamily: IO334' },
      { nodeId: 'fpga_consolidate', fact: '4×QAD (4/32) + 64×TTL (64/96) = 79% → 1 board' },
      { nodeId: 'fpga_interface', fact: 'Auto-add IO334-21 interface board (qty: 1)' },
      { nodeId: 'slot_check', fact: '8 modules total · Performance (7 base / 42 expanded): OK' },
      { nodeId: 'compat_check', fact: 'All modules compatible with Performance machine' },
      { nodeId: 'output', fact: '8 rows resolved, 0 unresolved · avg confidence 82%' },
    ],
    overviewFacts: [
      '8 requirements: CAN FD, LIN, FlexRay, SENT, analog I/O, digital I/O, encoders',
      'Searched 120+ I/O modules · found 6–12 candidates per requirement row',
      'Scored every candidate by protocol match, channel count, and consolidation potential',
      'IO611 wins CAN FD (score 38) · IO101 wins analog (score 34) · IO334 wins encoder (score 34)',
      'IO334 encoder + digital share one FPGA → 1 board instead of 3',
      'Fits in Performance machine (8 of 7 base slots → expansion chassis)',
      '82% avg confidence · all 8 rows resolved',
    ],
    moduleShowcase: [
      {
        requirementLabel: 'CAN FD × 4',
        candidates: [
          { moduleId: 'IO611', name: 'IO611 – CAN FD / LIN', score: 38, units: 1, isWinner: true, reason: 'Exact protocol + covers LIN too', scoreBreakdown: [
            { label: 'Exact match', points: 24, detail: 'Protocol and speed match perfectly (2 specs × 12)' },
            { label: 'Partial match', points: 6, detail: 'Channel count compatible but oversized (1 spec × 6)' },
            { label: 'Consolidation', points: 10, detail: 'Also covers LIN — saves a separate module' },
            { label: 'Unit penalty', points: -2, detail: '1 board needed (minimal overhead)' },
          ] },
          { moduleId: 'IO602', name: 'IO602 – CAN FD', score: 28, units: 1, isWinner: false, reason: 'Good match but no LIN consolidation' },
          { moduleId: 'IO613', name: 'IO613 – CAN / CAN FD', score: 22, units: 2, isWinner: false, reason: 'Needs 2 units for 4 channels' },
        ],
      },
      {
        requirementLabel: 'Encoder × 4',
        candidates: [
          { moduleId: 'IO334', name: 'IO334 – FPGA Encoder/TTL', score: 34, units: 1, isWinner: true, reason: 'FPGA family shares board with digital', scoreBreakdown: [
            { label: 'Exact match', points: 24, detail: 'Encoder type and speed match perfectly (2 specs × 12)' },
            { label: 'Consolidation', points: 10, detail: 'Shares FPGA board with digital I/O — fewer slots' },
            { label: 'Unit penalty', points: 0, detail: '1 board needed (no penalty)' },
          ] },
          { moduleId: 'IO397', name: 'IO397 – Quad Encoder', score: 22, units: 1, isWinner: false, reason: 'No FPGA consolidation benefit' },
        ],
      },
    ],
  },
  {
    id: 'aerospace',
    label: 'Aerospace & Defense',
    icon: '✈️',
    description: '6 requirement rows · ARINC 429/629, MIL-STD-1553, analog, digital, RS-422',
    hasFpgaBranch: false,
    requirements: [
      { categoryId: 'communication', subId: 'protocols', quantity: 8, specs: { range: 'ARINC 429', resolution: 'ARINC 429', speed: '100 kbit/s' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'MIL-STD-1553', resolution: 'MIL-STD-1553', speed: '1 Mbit/s' } },
      { categoryId: 'analog', subId: 'inputs', quantity: 16, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±5 V', resolution: '18-bit', speed: '100 kHz' } },
      { categoryId: 'digital', subId: 'inputs', quantity: 32, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'ARINC 629', resolution: 'ARINC 629', speed: '2 Mbit/s' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 4, specs: { range: 'RS-422', resolution: 'RS-422', speed: '10 Mbit/s' } },
    ],
    nodeSnapshots: [
      { nodeId: 'input', fact: '6 requirement rows → RequirementRow[]' },
      { nodeId: 'normalize', fact: 'Sorted: analog (1) → comm (4) → digital (1)' },
      { nodeId: 'catalog_filter', fact: 'ARINC 429 row: 90+ modules → 2 candidates (IO401, IO629)' },
      { nodeId: 'score', fact: 'IO401: exact×12=12 + machine=5 → score 15. IO629: exact=12' },
      { nodeId: 'pick_best', fact: 'IO401 wins (1 unit, score 15). MIL-1553 → IO408' },
      { nodeId: 'accumulate', fact: '5 unique modules. IO504 covers RS-422 (4 ports)' },
      { nodeId: 'fpga_detect', fact: 'No FPGA-backed modules in this config → branch skipped' },
      { nodeId: 'fpga_consolidate', fact: '—' },
      { nodeId: 'fpga_interface', fact: '—' },
      { nodeId: 'slot_check', fact: '5 modules · Performance (7 base / 42 expanded): OK' },
      { nodeId: 'compat_check', fact: 'IO629 limited to Performance/Pulse only → warning if Mobile' },
      { nodeId: 'output', fact: '6 rows resolved, 0 unresolved · avg confidence 88%' },
    ],
    overviewFacts: [
      '6 requirements: ARINC 429/629, MIL-STD-1553, analog, digital, RS-422',
      'Searched 120+ I/O modules · found 2–8 candidates per requirement row',
      'Scored every candidate by protocol match, channel count, and machine compatibility',
      'IO401 wins ARINC 429 (score 15) · IO408 wins MIL-1553 (score 18) · IO504 wins RS-422',
      'No FPGA modules needed → optimization step skipped',
      'Fits in Performance machine (5 of 7 base slots)',
      '88% avg confidence · all 6 rows resolved',
    ],
    moduleShowcase: [
      {
        requirementLabel: 'ARINC 429 × 8',
        candidates: [
          { moduleId: 'IO401', name: 'IO401 – ARINC 429 Rx/Tx', score: 15, units: 1, isWinner: true, reason: 'Exact protocol match + machine bonus', scoreBreakdown: [
            { label: 'Exact match', points: 12, detail: 'ARINC 429 protocol matches perfectly (1 spec × 12)' },
            { label: 'Machine bonus', points: 5, detail: 'Verified compatible with Performance machine' },
            { label: 'Unit penalty', points: -2, detail: '1 board needed (minimal overhead)' },
          ] },
          { moduleId: 'IO629', name: 'IO629 – ARINC 429/629', score: 12, units: 1, isWinner: false, reason: 'Covers both but limited machine support' },
        ],
      },
      {
        requirementLabel: 'MIL-STD-1553 × 2',
        candidates: [
          { moduleId: 'IO408', name: 'IO408 – MIL-STD-1553', score: 18, units: 1, isWinner: true, reason: 'Only candidate with full 1553 support', scoreBreakdown: [
            { label: 'Exact match', points: 12, detail: 'MIL-STD-1553 protocol matches perfectly' },
            { label: 'Machine bonus', points: 5, detail: 'Verified compatible with Performance machine' },
            { label: 'Partial match', points: 3, detail: 'Speed range compatible (1 Mbit/s supported)' },
            { label: 'Unit penalty', points: -2, detail: '1 board needed (minimal overhead)' },
          ] },
        ],
      },
    ],
  },
  {
    id: 'fpga_consolidation',
    label: 'Mixed-Signal with Encoders',
    icon: '⚡',
    description: '4 requirement rows · encoder + digital on IO334 FPGA → board consolidation saves slots',
    hasFpgaBranch: true,
    requirements: [
      { categoryId: 'motion', subId: 'encoder', quantity: 8, specs: { range: 'Incremental', speed: '100 kHz', resolution: '16-bit' } },
      { categoryId: 'digital', subId: 'inputs', quantity: 64, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' } },
      { categoryId: 'analog', subId: 'inputs', quantity: 16, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'CAN FD', resolution: 'HS CAN FD', speed: '5 Mbit/s' } },
    ],
    nodeSnapshots: [
      { nodeId: 'input', fact: '4 requirement rows → RequirementRow[]' },
      { nodeId: 'normalize', fact: 'Sorted: analog (1) → comm (1) → digital (1) → motion (1)' },
      { nodeId: 'catalog_filter', fact: 'Encoder row: 90+ modules → 3 candidates (IO334, IO397)' },
      { nodeId: 'score', fact: 'IO334: exact×12=24 + consolidation=10 → score 34' },
      { nodeId: 'pick_best', fact: 'IO334 wins for encoder (1 unit). IO397 fallback (score 22)' },
      { nodeId: 'accumulate', fact: '4 unique modules accumulated (IO334, IO101, IO611)' },
      { nodeId: 'fpga_detect', fact: 'IO334 (encoder + digital) → fpgaFamily: IO334' },
      { nodeId: 'fpga_consolidate', fact: 'Before: 3 boards (1 enc + 2 dig) → After: 1 board (⌈72/96⌉ = 1)' },
      { nodeId: 'fpga_interface', fact: 'Auto-add IO334-21 interface board (qty: 1)' },
      { nodeId: 'slot_check', fact: '4 modules · Baseline (4 base / 6 expanded): OK' },
      { nodeId: 'compat_check', fact: 'All modules compatible with Baseline machine' },
      { nodeId: 'output', fact: '4 rows resolved, 0 unresolved · avg confidence 85%' },
    ],
    overviewFacts: [
      '4 requirements: 8 encoders, 64 digital inputs, 16 analog inputs, 2 CAN FD',
      'Searched 120+ I/O modules · found 3–6 candidates per requirement row',
      'Scored every candidate by channel capacity, FPGA consolidation potential, and fit',
      'IO334 wins encoder (score 34) · IO334 also wins digital (score 30) · IO101 wins analog',
      'Without FPGA: 3 boards (3 slots) → With FPGA: 1 board + 1 interface (2 slots saved)',
      'Fits in Baseline machine (4 of 4 base slots)',
      '85% confidence · all 4 rows resolved · 2 fewer slots used',
    ],
    moduleShowcase: [
      {
        requirementLabel: 'Encoder × 8',
        candidates: [
          { moduleId: 'IO334', name: 'IO334 – FPGA Encoder/TTL', score: 34, units: 1, isWinner: true, reason: 'FPGA consolidation with digital I/O', scoreBreakdown: [
            { label: 'Exact match', points: 24, detail: 'Encoder type and speed match perfectly (2 specs × 12)' },
            { label: 'Consolidation', points: 10, detail: 'Shares FPGA with digital I/O — saves 2 slots' },
            { label: 'Unit penalty', points: 0, detail: '1 board needed (no penalty)' },
          ] },
          { moduleId: 'IO397', name: 'IO397 – Quad Encoder', score: 22, units: 2, isWinner: false, reason: 'Needs 2 units, no FPGA sharing' },
        ],
      },
      {
        requirementLabel: 'Digital In × 64',
        candidates: [
          { moduleId: 'IO334', name: 'IO334 – FPGA Encoder/TTL', score: 30, units: 1, isWinner: true, reason: 'Shares FPGA board with encoder row', scoreBreakdown: [
            { label: 'Exact match', points: 12, detail: 'TTL digital type matches (1 spec × 12)' },
            { label: 'Partial match', points: 6, detail: '96 channels covers 64 needed (oversized but compatible)' },
            { label: 'Consolidation', points: 10, detail: 'Already on the same FPGA board as encoder' },
            { label: 'Machine bonus', points: 5, detail: 'Verified compatible with Baseline machine' },
            { label: 'Unit penalty', points: -3, detail: 'Slight overhead from shared resource' },
          ] },
          { moduleId: 'IO216', name: 'IO216 – 32ch TTL Digital', score: 20, units: 2, isWinner: false, reason: '2 boards needed, no consolidation' },
          { moduleId: 'IO217', name: 'IO217 – 48ch TTL Digital', score: 18, units: 2, isWinner: false, reason: 'Still 2 boards, lower channel density' },
        ],
      },
    ],
  },
]
