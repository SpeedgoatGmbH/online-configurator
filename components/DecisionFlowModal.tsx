'use client'

import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  Handle,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FLOW_EXAMPLES, type FlowExample } from './configurator/decisionFlowExamples'
import type { StarterRow } from './configurator/industries'

/* ------------------------------------------------------------------ */
/*  Custom node types                                                  */
/* ------------------------------------------------------------------ */

type FlowNodeData = {
  label: string
  description: string
  icon: string
  color: string
  border: string
  /** Technical formula or fact always shown below header */
  technicalDetail?: string
  /** Injected at runtime during example animation */
  exampleFact?: string
  /** Whether this node is currently highlighted in animation */
  isActive?: boolean
  /** Whether to dim this node (FPGA branch when not applicable) */
  isDimmed?: boolean
}

/* ---------- shared wrapper for all node types ---------- */

function NodeShell({
  data,
  borderStyle = 'solid',
}: {
  data: FlowNodeData
  borderStyle?: 'solid' | 'dashed'
}) {
  const [expanded, setExpanded] = useState(false)
  const borderClass = borderStyle === 'dashed' ? 'border-dashed' : ''

  return (
    <div
      className={`cursor-pointer rounded-lg border-2 ${borderClass} px-4 py-3 shadow-md transition-all duration-300 hover:shadow-lg ${
        data.isActive
          ? 'ring-2 ring-violet-500 ring-offset-2 scale-[1.03]'
          : ''
      } ${data.isDimmed ? 'opacity-30' : ''}`}
      style={{
        background: data.isActive ? '#F5F3FF' : data.color,
        borderColor: data.isActive ? '#8B5CF6' : data.border,
        minWidth: 220,
        maxWidth: 300,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{data.icon}</span>
        <span className="text-xs font-bold text-slate-800">{data.label}</span>
      </div>

      {/* Technical detail (always visible) */}
      {data.technicalDetail && (
        <p className="mt-1 whitespace-pre-line rounded bg-slate-100/80 px-1.5 py-0.5 font-mono text-[9px] leading-tight text-slate-600">
          {data.technicalDetail}
        </p>
      )}

      {/* Example fact badge */}
      {data.exampleFact && data.exampleFact !== '—' && (
        <div className="mt-1.5 rounded-md bg-violet-100 px-2 py-1 text-[9px] font-semibold leading-snug text-violet-800 ring-1 ring-violet-300/60">
          {data.exampleFact}
        </div>
      )}

      {/* Expandable description */}
      {expanded && (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-600">{data.description}</p>
      )}
      {!expanded && !data.technicalDetail && (
        <p className="mt-0.5 text-[10px] text-slate-400 italic">click to expand</p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  )
}

function StepNode({ data }: { data: FlowNodeData }) {
  return <NodeShell data={data} borderStyle="solid" />
}
function DecisionNode({ data }: { data: FlowNodeData }) {
  return <NodeShell data={data} borderStyle="dashed" />
}
function ResultNode({ data }: { data: FlowNodeData }) {
  return <NodeShell data={data} borderStyle="solid" />
}

const nodeTypes = { step: StepNode, decision: DecisionNode, result: ResultNode }

/* ------------------------------------------------------------------ */
/*  Flow data (enriched with technical details)                        */
/* ------------------------------------------------------------------ */

/** Node ordering for animation playback */
const MAIN_PIPELINE_ORDER = [
  'input',
  'normalize',
  'catalog_filter',
  'score',
  'pick_best',
  'accumulate',
  'fpga_detect',
  'fpga_consolidate',
  'fpga_interface',
  'slot_check',
  'compat_check',
  'output',
]

const FPGA_NODE_IDS = new Set(['fpga_detect', 'fpga_consolidate', 'fpga_interface'])

const BASE_NODES: Node<FlowNodeData>[] = [
  // --- Main pipeline (column 1) ---
  {
    id: 'input',
    type: 'step',
    position: { x: 60, y: 0 },
    data: {
      label: 'User Requirements',
      description:
        'Each configured I/O row (category + subcategory + quantity + specs) becomes a RequirementRow sent to the simulator.',
      technicalDetail: 'RequirementRow { categoryId, subId, quantity, specs }',
      icon: '📝',
      color: '#EFF6FF',
      border: '#3B82F6',
    },
  },
  {
    id: 'normalize',
    type: 'step',
    position: { x: 60, y: 120 },
    data: {
      label: 'Normalize & Sort',
      description:
        'Empty rows removed, spec keys alphabetically sorted, rows ordered by category → sub → quantity for deterministic matching.',
      technicalDetail: 'sort(category → sub → qty) · deduplicate empty',
      icon: '🔄',
      color: '#F0FDF4',
      border: '#22C55E',
    },
  },
  {
    id: 'catalog_filter',
    type: 'decision',
    position: { x: 60, y: 240 },
    data: {
      label: 'Filter Catalog',
      description:
        'For each row, the module catalog is filtered by categoryCoverage + subCoverage. Communication rows also require protocolSupport match.',
      technicalDetail: 'match(categoryCoverage, subCoverage, protocolSupport)',
      icon: '🗂️',
      color: '#FFFBEB',
      border: '#F59E0B',
    },
  },
  {
    id: 'score',
    type: 'step',
    position: { x: 60, y: 370 },
    data: {
      label: 'Score Candidates',
      description:
        'Each candidate is scored against the requirement specs. Multi-criteria weighted scoring with consolidation and machine bonuses.',
      technicalDetail:
        'exact×12 + compat×6 − mismatch×10 − missing×8\n− units×2 + consolidation(10) + machine(5)',
      icon: '⚡',
      color: '#FDF2F8',
      border: '#EC4899',
    },
  },
  {
    id: 'pick_best',
    type: 'decision',
    position: { x: 60, y: 510 },
    data: {
      label: 'Pick Best or Unresolved',
      description:
        'Candidates sorted by composite key. If no candidates pass, the row becomes "unresolved" with a suggestion.',
      technicalDetail: 'sort: min(units) → max(score) → seeded tie → moduleId',
      icon: '🏆',
      color: '#FFF7ED',
      border: '#F97316',
    },
  },
  {
    id: 'accumulate',
    type: 'step',
    position: { x: 60, y: 640 },
    data: {
      label: 'Accumulate Modules',
      description:
        'The chosen module is added to the recommended list. If already selected by a previous row, its quantity is incremented.',
      technicalDetail: 'map[moduleId].qty += requiredUnits',
      icon: '📦',
      color: '#F5F3FF',
      border: '#8B5CF6',
    },
  },

  // --- FPGA branch (column 2) ---
  {
    id: 'fpga_detect',
    type: 'decision',
    position: { x: 420, y: 370 },
    data: {
      label: 'Detect FPGA Modules',
      description:
        'Modules with fpgaFamily tag identified. User picks PWM/Encoder/etc and the catalog transparently maps to configurable FPGA boards (IO3xx).',
      technicalDetail: 'filter: entry.fpgaFamily !== undefined',
      icon: '🔌',
      color: '#ECFDF5',
      border: '#10B981',
    },
  },
  {
    id: 'fpga_consolidate',
    type: 'step',
    position: { x: 420, y: 510 },
    data: {
      label: 'Consolidate FPGA Boards',
      description:
        'Functions sharing the same fpgaFamily merge onto fewer physical boards based on fractional I/O line usage.',
      technicalDetail: 'usage = Σ(qty / channelCapacity) per family\nnew qty = ⌈usage⌉',
      icon: '🧩',
      color: '#ECFDF5',
      border: '#10B981',
    },
  },
  {
    id: 'fpga_interface',
    type: 'result',
    position: { x: 420, y: 640 },
    data: {
      label: 'Add Interface Board',
      description:
        'Companion interface board auto-added for FPGA modules. Reads interfaceBoard from catalog, fallback: {technicalName}-21.',
      technicalDetail: 'board = entry.interfaceBoard ?? {name}-21\nqty = main board count',
      icon: '🔗',
      color: '#ECFDF5',
      border: '#10B981',
    },
  },

  // --- Post-processing (column 1) ---
  {
    id: 'slot_check',
    type: 'decision',
    position: { x: 60, y: 770 },
    data: {
      label: 'Machine Slot Check',
      description:
        'Total module count compared against the machine\'s base and expanded slot limits.',
      technicalDetail: 'performance: 7/42 · pulse: 3/3 · mobile: 5/14\nbaseline: 4/6 · unit: 1/1',
      icon: '🖥️',
      color: '#FEF2F2',
      border: '#EF4444',
    },
  },
  {
    id: 'compat_check',
    type: 'decision',
    position: { x: 60, y: 900 },
    data: {
      label: 'Compatibility Check',
      description:
        'Each module\'s compatibleMachines array is checked. Non-compatible modules trigger a warning.',
      technicalDetail: 'if module.compatibleMachines && !includes(machine) → warn',
      icon: '⚙️',
      color: '#FEF2F2',
      border: '#EF4444',
    },
  },
  {
    id: 'output',
    type: 'result',
    position: { x: 60, y: 1030 },
    data: {
      label: 'Proposal Output',
      description:
        'Final proposal: recommended modules with quantity, confidence, and rationale. Per-row diffs, unresolved items, and machine warnings.',
      technicalDetail: 'confidence = 62 + exact×8 + compat×4 − mismatch×11\n− missing×8 − (units−1)×3  · clamped [15, 98]',
      icon: '📋',
      color: '#DBEAFE',
      border: '#2563EB',
    },
  },
]

const EDGE_STYLE = { stroke: '#94A3B8', strokeWidth: 1.5 }
const MARKER = { type: MarkerType.ArrowClosed, color: '#94A3B8', width: 16, height: 16 }

const EDGES: Edge[] = [
  // Main pipeline
  { id: 'e-input-norm', source: 'input', target: 'normalize', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-norm-filter', source: 'normalize', target: 'catalog_filter', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-filter-score', source: 'catalog_filter', target: 'score', style: EDGE_STYLE, markerEnd: MARKER, label: 'per row', labelStyle: { fontSize: 9, fill: '#64748B' } },
  { id: 'e-score-pick', source: 'score', target: 'pick_best', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-pick-acc', source: 'pick_best', target: 'accumulate', style: EDGE_STYLE, markerEnd: MARKER, label: 'matched', labelStyle: { fontSize: 9, fill: '#22C55E' } },
  { id: 'e-acc-slot', source: 'accumulate', target: 'slot_check', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-slot-compat', source: 'slot_check', target: 'compat_check', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-compat-out', source: 'compat_check', target: 'output', style: EDGE_STYLE, markerEnd: MARKER },

  // Transparent FPGA mapping branch
  { id: 'e-score-fpga', source: 'score', target: 'fpga_detect', style: { ...EDGE_STYLE, stroke: '#10B981', strokeDasharray: '5 3' }, markerEnd: { ...MARKER, color: '#10B981' }, label: 'FPGA-backed', labelStyle: { fontSize: 9, fill: '#10B981', fontWeight: 600 } },
  { id: 'e-fpga-consol', source: 'fpga_detect', target: 'fpga_consolidate', style: { ...EDGE_STYLE, stroke: '#10B981' }, markerEnd: { ...MARKER, color: '#10B981' } },
  { id: 'e-consol-iface', source: 'fpga_consolidate', target: 'fpga_interface', style: { ...EDGE_STYLE, stroke: '#10B981' }, markerEnd: { ...MARKER, color: '#10B981' } },
  { id: 'e-iface-slot', source: 'fpga_interface', target: 'slot_check', style: { ...EDGE_STYLE, stroke: '#10B981' }, markerEnd: { ...MARKER, color: '#10B981' } },
]

/* ------------------------------------------------------------------ */
/*  Modal component                                                    */
/* ------------------------------------------------------------------ */

type DecisionFlowModalProps = {
  open: boolean
  onClose: () => void
  onLoadExample?: (rows: StarterRow[]) => void
}

export default function DecisionFlowModal({ open, onClose, onLoadExample }: DecisionFlowModalProps) {
  const memoNodeTypes = useMemo(() => nodeTypes, [])

  // ─── Example animation state ──────────────────────────────────────────
  const [activeExample, setActiveExample] = useState<FlowExample | null>(null)
  const [animStep, setAnimStep] = useState(-1)
  const [animDone, setAnimDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAnimation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  const stopExample = useCallback(() => {
    clearAnimation()
    setActiveExample(null)
    setAnimStep(-1)
    setAnimDone(false)
  }, [clearAnimation])

  const startExample = useCallback(
    (example: FlowExample) => {
      clearAnimation()
      setActiveExample(example)
      setAnimStep(0)
      setAnimDone(false)

      let step = 0
      intervalRef.current = setInterval(() => {
        step++
        if (step >= MAIN_PIPELINE_ORDER.length) {
          clearAnimation()
          setAnimDone(true)
          setAnimStep(MAIN_PIPELINE_ORDER.length - 1)
          return
        }
        setAnimStep(step)
      }, 600)
    },
    [clearAnimation],
  )

  const replayExample = useCallback(() => {
    if (activeExample) startExample(activeExample)
  }, [activeExample, startExample])

  // cleanup on close / unmount
  useEffect(() => {
    if (!open) {
      clearAnimation()
      setActiveExample(null)
      setAnimStep(-1)
      setAnimDone(false)
    }
    return clearAnimation
  }, [open, clearAnimation])

  // ─── Compute nodes with animation overlays ────────────────────────────
  const computedNodes: Node<FlowNodeData>[] = useMemo(() => {
    if (!activeExample || animStep < 0) return BASE_NODES

    const snapshotMap = new Map(activeExample.nodeSnapshots.map((s) => [s.nodeId, s.fact]))
    const activeNodeId = MAIN_PIPELINE_ORDER[animStep]
    const visitedSet = new Set(MAIN_PIPELINE_ORDER.slice(0, animStep + 1))

    return BASE_NODES.map((node) => {
      const isFpga = FPGA_NODE_IDS.has(node.id)
      const shouldDim = isFpga && !activeExample.hasFpgaBranch

      const isVisited = visitedSet.has(node.id)
      const isCurrentlyActive = node.id === activeNodeId
      const fact = isVisited ? snapshotMap.get(node.id) : undefined

      return {
        ...node,
        data: {
          ...node.data,
          isActive: isCurrentlyActive,
          isDimmed: shouldDim,
          exampleFact: fact,
        },
      }
    })
  }, [activeExample, animStep])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  const handleLoadExample = useCallback(() => {
    if (activeExample && onLoadExample) {
      onLoadExample(activeExample.requirements)
      onClose()
    }
  }, [activeExample, onLoadExample, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative flex h-[88vh] w-[94vw] max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm text-white shadow-inner">
              ⚗
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Proposal Decision Pipeline</h2>
              <p className="text-[10px] text-slate-500">Click any node for details · Scoring formula shown in each step</p>
            </div>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 ring-1 ring-violet-300/50">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l-7-7 7-7" />
                <path d="M19 19l-7-7 7-7" />
              </svg>
              DEV PROTOTYPE
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Example selector bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-5 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Examples</span>
          {FLOW_EXAMPLES.map((ex) => {
            const isSelected = activeExample?.id === ex.id
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => (isSelected ? stopExample() : startExample(ex))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                <span>{ex.icon}</span>
                {ex.label}
              </button>
            )
          })}

          {/* Controls: replay + load */}
          {activeExample && animDone && (
            <button
              type="button"
              onClick={replayExample}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-200"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
              Replay
            </button>
          )}
          {activeExample && animDone && onLoadExample && (
            <button
              type="button"
              onClick={handleLoadExample}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md transition-all hover:shadow-lg hover:from-violet-700 hover:to-fuchsia-700"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              Load into Configurator
            </button>
          )}
        </div>

        {/* Active example description */}
        {activeExample && (
          <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/50 px-5 py-1.5">
            <span className="text-sm">{activeExample.icon}</span>
            <span className="text-[11px] font-semibold text-violet-800">{activeExample.label}</span>
            <span className="text-[10px] text-violet-600">— {activeExample.description}</span>
            {!animDone && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-violet-500">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                Step {animStep + 1} / {MAIN_PIPELINE_ORDER.length}
              </span>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 border-b border-slate-100 bg-white px-5 py-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-200 ring-1 ring-blue-400" /> Input / Output</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-200 ring-1 ring-green-400" /> Processing</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-200 ring-1 ring-amber-400" /> Decision / Filter</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-pink-200 ring-1 ring-pink-400" /> Scoring</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-400" /> FPGA Mapping</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-200 ring-1 ring-red-400" /> Validation</span>
          {activeExample && (
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-200 ring-1 ring-violet-400" /> Active trace</span>
          )}
        </div>

        {/* React Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={computedNodes}
            edges={EDGES}
            nodeTypes={memoNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: false }}
          >
            <Background gap={16} size={1} color="#E2E8F0" />
            <Controls showInteractive={false} className="!rounded-lg !border-slate-200 !shadow-md" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
