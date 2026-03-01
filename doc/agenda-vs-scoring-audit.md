# Agenda vs Scoring System Audit

## Scope and basis

- Agenda source: `agent.md`
- Scoring implementation source: `lib/proposal/simulator.ts`
- Catalog and compatibility source: `lib/proposal/mockCatalog.ts`
- Proposal contracts source: `components/configurator/proposalTypes.ts`
- Associated proposal basis (reproducible): `simulateProposalWithCandidates` with:
  - Machine: `performance`
  - Rows:
    - Analog inputs x16 (`Differential`, `Voltage`, `±10 V`, `16-bit`, `100 kHz`)
    - Motion resolver x4 (`Single-speed`, `5 kHz`, `14-bit`)
    - Digital outputs x8 (`TTL / Discrete`, `5 V TTL`, `None`, `Push-pull`)

## 1) Agenda overview: content, objectives, structure

### Document structure

`agent.md` is a broad engineering notebook with 16 sections. Sections 1-10 are mostly implementation guidance and algorithm intent, sections 11-16 are documentation-research synthesis and future-direction notes.

### Primary objectives inferred from the agenda

1. Improve FPGA selection quality for multi-row requirements by removing row-order bias and enabling proactive consolidation.
2. Enforce dual budgeting for FPGA usage (`channelCapacity` and `fpgaTotalLines`) to prevent infeasible proposals.
3. Correctly add required interface hardware:
   - Rear extensions (`-21`, `-22`, `-24`, `-40`, `-120`)
   - IO33X front boards for IO332/IO333
4. Prefer higher-flexibility FPGA categories when hardware fit is otherwise similar.
5. Keep configurator abstraction at functional level (not pin-level mapping).
6. Increase explainability in UI (score breakdown fields and FPGA flow details).

### Normative vs exploratory content

- Normative (implementation-level): scoring formula and constants, tie-break ordering, FPGA consolidation behavior, interface board selection flow, compatibility gates.
- Exploratory / forward-looking: configuration package hard-gating, user-visible workflow type, channel-per-package constraints, commercial package semantics.

## 2) Implemented scoring system (as-built)

### Candidate filtering and hard gates (pre-score)

Candidates must pass:

1. Category and subcategory coverage filter.
2. Machine compatibility gate (`compatibleMachines`) if declared.
3. Communication protocol gate (`row.specs.range` must be in `protocolSupport` for communication rows).
4. FPGA code-module compatibility gate:
   - Required modules by sub-ID (`SUB_ID_TO_CODE_MODULES`)
   - Supported modules by FPGA family (`FPGA_CODE_MODULE_COMPAT`)

### Scoring criteria and constants

At candidate evaluation, score is:

```text
score =
  exactCount * 12
  + compatibleCount * 6
  - mismatchCount * 10
  - missingCount * 8
  - units * 2
  + consolidationBonus
  + fpgaLookAheadBonus
  + machineBonus
  + lifecyclePenalty
  + configPackageBonus
  + fpgaCategoryBonus
```

Constants in code:

- `consolidationBonus`: `+10` when prior usage exists for communication rows or FPGA rows.
- `fpgaLookAheadBonus`: `(coveredRows - 1) * 8`.
- `machineBonus`: `+5`.
- `lifecyclePenalty`: `-20` (`discontinued`), `-10` (`eol`), else `0`.
- `configPackageBonus`: `+4` via string matching heuristics.
- `fpgaCategoryBonus`: `+3` for `simulink-programmable`, `+1` for `configurable`, else `0`.

### Ranking and tie-break sequence

Sort order for winner selection:

1. Lower `units` first.
2. Higher `score` second.
3. Lower `channelCapacity` third (tighter fit).
4. Lower seeded random tie-break.
5. Lexicographic `moduleId`.

### Post-score processing

After row-level winner picks:

1. `consolidateFpgaModules`: aggregate by `fpgaFamily`, apply capacity and physical I/O line constraints.
2. `addFpgaInterfaceBoards`: add extension and IO33X interface modules.
3. `validateFpgaOverhead`: swap FPGA family to dedicated alternatives when total module count is strictly lower.
4. `consolidateDedicatedModules`: reduce duplicates and optionally upgrade dedicated module size if fewer units.

## 3) Comparative assessment: agenda priorities vs observed outcomes

### Associated proposal outcome (selected basis)

Final summary:

- Requested channels: `28`
- Covered channels: `28`
- Unresolved: `0`
- Module count: `3`
- Final recommended modules: `IO131`, `IO290`, `IO424`

Row winners and score contribution:

1. Analog/Inputs (`r-analog-inputs`)
   - Winner: `IO131`, score `63`
   - Contributions: `exact=5`, `machineBonus=+5`, all other bonuses `0`
2. Digital/Outputs (`r-digital-outputs`)
   - Winner: `IO290`, score `31`
   - Contributions: `exact=3`, `missing=1`, `machineBonus=+5`, all other bonuses `0`
3. Motion/Resolver (`r-motion-resolver`)
   - Row winner before post-processing: `IO3xx-Res`, score `39`
   - Contributions: `exact=3`, `machineBonus=+5`, all other bonuses `0`
   - Post-processing change: `validateFpgaOverhead` swapped `IO324` family to dedicated `IO424` because total module count was lower.

### Alignment table

| Agenda priority | Observed implementation | Observed associated outcome | Assessment |
|---|---|---|---|
| Proactive FPGA preference via look-ahead | Implemented (`computeFpgaCoverageMap`, +8 per extra row) | Not activated (`fpgaLookAheadBonus=0` in all 3 rows) | Aligned design, inactive in this scenario |
| Dual-budget FPGA consolidation | Implemented (`max(capacity, line budget)`) | Not used in final BOM (FPGA family swapped out) | Aligned algorithm, outcome bypassed |
| Add interface hardware automatically | Implemented for extensions and IO33X | No interface boards remained in final BOM | Aligned capability, inactive in this outcome |
| Prefer simulink-programmable boards | Implemented (+3/+1 category bonus) | Not activated (winner rows had `fpgaCategoryBonus=0`) | Aligned design, inactive in this scenario |
| Improve practical proposal compactness | Implemented via FPGA overhead guard swap | Activated: FPGA family replaced by dedicated path | Strong alignment |
| Transparent score explanation | Partial (DecisionFlow + score breakdown) | Some UI text still differs from actual ranking details | Partial alignment |

## 4) Gaps, inconsistencies, and improvement opportunities

### Risk register

| ID | Category | Finding | Evidence | Impact | Severity |
|---|---|---|---|---|---|
| R1 | Doc-code drift | Agenda formula says lifecycle `-25` and config package `+5`; code uses `-20/-10` and `+4`. | `agent.md` section 3 vs `simulator.ts` scoring constants | Reduces trust in scoring rationale and reviewability | High |
| R2 | Terminology drift | Agenda references `configurable-io`; code and types use `configurable`. | `agent.md` section 2/3 vs `mockCatalog.ts` fpgaCategory type | Confusing business-to-code mapping | Medium |
| R3 | Data coverage gap | Lifecycle penalties are effectively dormant; catalog contains lifecycle values only as `active` in current data. | Catalog scan: no `eol`/`discontinued` entries | Intended lifecycle prioritization has no runtime effect | Medium |
| R4 | Data coverage gap | Config package bonus has sparse applicability (few modules/rows get it). | Catalog scan: configPackages on 7/124 entries | Weak and uneven influence on ranking | Medium |
| R5 | Behavioral edge case | Units-first ranking can pick lower score over higher score (rare but real). | Sweep found `analog/outputs qty=32` case | Potential fairness debate if “best score” expected by users | Medium |
| R6 | UI transparency gap | DecisionFlow technical detail omits `channelCapacity` tie-break although backend uses it. | UI text in DecisionFlow vs sort logic in simulator | Incomplete explainability in user-facing flow | Medium |
| R7 | Workflow modeling gap | Config package semantics remain soft bonus, not hard feasibility constraint; no explicit workflow input. | `computeConfigPackageBonus` heuristic and request type lacking workflow | Can produce commercially/operationally ambiguous proposals | High |

### Notes on scenario representativeness

The selected associated proposal is valid and reproducible but does not exercise key FPGA bonuses because its final optimization path favors dedicated modules. This is expected behavior under the current overhead-guard design, not a defect by itself.

## 5) Recommendations (prioritized)

### P0 (immediate, low-risk correctness and transparency)

1. Align agenda constants with implementation.
   - Problem: Documentation claims and runtime constants differ.
   - Change: Update `agent.md` scoring section to exact constants currently used.
   - Effect: Eliminates audit ambiguity.
   - Validation: doc-code parity check in CI.

2. Fix ranking explanation in DecisionFlow text.
   - Problem: UI technical detail omits `channelCapacity` tie-break.
   - Change: Update technical string to reflect full sort chain.
   - Effect: Improves transparency for proposal reviews.
   - Validation: snapshot/UI test for displayed technical text.

3. Add per-row `scoreTrace` and `rankingTrace` to proposal output.
   - Problem: Forensic explanation requires recomputation.
   - Change: Extend response contract and row payload with score term and tie-break sequence.
   - Effect: Audit-ready and user-debuggable outputs.
   - Validation: contract tests asserting trace fields for resolved rows.

### P1 (material scoring quality and fairness)

1. Introduce explicit workflow input in request:
   - `workflowType: 'configurable' | 'hdl-coder'`
   - Use it to hard-gate incompatible candidates and package assumptions.
   - Effect: Better alignment between commercial offering and algorithm output.

2. Replace free-form config package strings with structured package model.
   - Add package type, extension coupling, and per-signal/channel limits.
   - Use hard constraints for configurable workflow; keep soft preference only as tie-break where appropriate.
   - Effect: Fewer false-feasible proposals.

3. Decide and codify ranking policy for `units` vs `score`.
   - If business goal is “best fit first,” keep current units-first and document clearly.
   - If goal is “quality first,” swap comparator priority to score-first with threshold logic.
   - Effect: Removes hidden policy ambiguity.

### P2 (medium-term robustness)

1. Expand lifecycle data coverage (`recommended`, `eol`, `discontinued`) in catalog enrichment.
2. Add structured tests:
   - Golden snapshot (associated proposal outcome)
   - Multi-row FPGA consolidation scenario
   - Units-vs-score edge case
   - Doc-code parity checks
   - Compatibility matrix checks (`SUB_ID_TO_CODE_MODULES × FPGA_CODE_MODULE_COMPAT`)
   - Config package coverage and activation checks

## Recommended follow-on interface changes

1. Extend `ProposalGenerateRequest` with:

```ts
workflowType?: 'configurable' | 'hdl-coder'
```

2. Extend `ProposalRowDiff` with:

```ts
scoreTrace?: {
  exactPoints: number
  compatiblePoints: number
  mismatchPoints: number
  missingPoints: number
  unitsPenalty: number
  consolidationBonus: number
  fpgaLookAheadBonus: number
  machineBonus: number
  lifecyclePenalty: number
  configPackageBonus: number
  fpgaCategoryBonus: number
  total: number
}
rankingTrace?: string[] // e.g. ['units', 'score', 'channelCapacity', 'seed', 'moduleId']
```

3. Replace catalog `configPackages: string[]` with structured objects:

```ts
configPackages?: Array<{
  packageType: 'RCP' | 'HIL' | 'COMM' | 'RESOLVER' | 'TPI6020'
  extensionRequired?: '-21' | '-22' | '-24' | '-40' | '-120' | null
  supportedSubIds: string[]
  limitsBySubId?: Record<string, number>
}>
```

## Evidence references

- Agenda and declared scoring:
  - `agent.md` lines ~99-120 (formula and tie-break)
  - `agent.md` lines ~776-982 (config-package and workflow implications)
- Scoring constants and ranking:
  - `evaluateCandidate` and formula: `lib/proposal/simulator.ts` lines ~450-541
  - `computeConfigPackageBonus`: `lib/proposal/simulator.ts` lines ~548-559
  - candidate sorting comparators:
    - `selectAllCandidates`: `lib/proposal/simulator.ts` lines ~343-352
    - `selectBestCandidate`: `lib/proposal/simulator.ts` lines ~412-421
- Post-processing:
  - FPGA consolidation: `lib/proposal/simulator.ts` lines ~805-890
  - interface boards: `lib/proposal/simulator.ts` lines ~1005-1098
  - overhead guard swap: `lib/proposal/simulator.ts` lines ~1118-1221
- Contracts:
  - request/response and row diff types: `components/configurator/proposalTypes.ts` lines ~11-104
- UI explainability:
  - technical detail strings in `components/DecisionFlowModal.tsx` lines ~208-213
  - score breakdown rendering in `components/configurator/liveFlowExample.ts` lines ~22-102
- Catalog structures and compatibility maps:
  - `configPackages`, `fpgaCategory` type: `lib/proposal/mockCatalog.ts` lines ~60-73
  - `FPGA_CODE_MODULE_COMPAT`: `lib/proposal/mockCatalog.ts` lines ~2955-2973
  - `SUB_ID_TO_CODE_MODULES`: `lib/proposal/mockCatalog.ts` lines ~2979-2998
