# FPGA Decision Logic — Agent Learnings

> Compiled during the full rework of the FPGA proposal pipeline in `lib/proposal/simulator.ts`.

---

## 1. Speedgoat FPGA Module Architecture

### Module Categories

| Category | Examples | Key Trait |
|---|---|---|
| **Blank-slate I/O boards** | IO332, IO333 | Support **both** IO33X-N interface boards **and** IO extensions. Highest flexibility. |
| **Compact mPCIe modules** | IO391, IO392, IO393, IO397 | Fixed function, **no** extension support (`supportsIOExtensions: false`). |
| **Standard FPGA boards** | IO302, IO303, IO306, IO314, IO321, IO334, IO397 | Support IO extensions (-21, -22, etc.) but **not** IO33X-N interface boards. |

### IO Extensions (suffix-based)

Extensions snap onto FPGA boards to add extra I/O channels:

| Extension | Purpose | Typical Use |
|---|---|---|
| `-21` | Digital I/O extension | Default / generic extension |
| `-22` | RS-422/RS-485 serial | Communication buses |
| `-24` | Resolver / encoder | Motor feedback loops |
| `-40` | CANopen / CAN FD | Automotive / industrial |
| `-120` | Analog extension | Precision measurement |

A single FPGA board can require **multiple** extensions simultaneously (e.g. an application needing both resolver feedback and analog measurement would get a -24 **and** a -120).

### IO33X-N Interface Boards (for IO332/IO333 only)

These are separate daughter-boards plugged into IO332/IO333:

| Board | Purpose |
|---|---|
| IO33X-1-LV | Low-voltage digital I/O (default) |
| IO33X-2 | RS-422 / RS-485 |
| IO33X-3 | 5V TTL digital |
| IO33X-4 | LVDS differential |
| IO33X-5 | Analog input |
| IO33X-6 | Mixed analog + digital |
| IO33X-7 | LVTTL |
| IO33X-8 | Differential analog |

### Catalog Flags

Each FPGA entry in `mockCatalog.ts` carries:

- `supportsIOExtensions: boolean` — can this board accept IO extension modules?
- `supportsIOInterfaces?: boolean` — can this board accept IO33X-N interface boards? (only IO332/IO333)
- `fpgaFamily: string` — consolidation group (e.g. `"IO334"`, `"IO302"`)
- `fpgaCategory: "simulink-programmable" | "configurable-io"` — determines flexibility level
- `fpgaTotalLines: number` — total physical I/O lines budget on the board
- `channelCapacity: number` — how many logical channels per board

---

## 2. The Six Problems We Found (and Fixed)

### Problem 1: Chicken-and-Egg (no proactive FPGA preference)

**Before:** FPGA modules only received a +10 consolidation bonus on row #2+ (i.e., only if the *same* FPGA family was already selected for a previous row). On row #1 they had no bonus, so a tighter-fit dedicated module would always win. Once a dedicated module takes row #1, rows #2+ never have a prior FPGA to consolidate with, so the FPGA never wins at all.

**Fix:** Added `computeFpgaCoverageMap()` — a pre-scan that builds a `Map<fpgaFamily, rowCount>` *before* the main selection loop. Then `evaluateCandidate()` adds a **look-ahead bonus** of `(coveredRows − 1) × 8` to any FPGA candidate whose family covers multiple requirement rows. This lets the FPGA win row #1 because it "knows" it can serve rows #2, #3, etc.

### Problem 2: fpgaTotalLines budget ignored

**Before:** `consolidateFpgaModules()` only checked `channelCapacity` (logical channel count). A board could be assigned 10 encoders (3 lines each = 30 lines) even though its `fpgaTotalLines` was only 24.

**Fix:** Added `familyLineUsage` tracking alongside `familyUsage`. Each row's line consumption is computed via `getIOLinesPerChannel(subId)` (encoder=3, resolver=6, spi=4, i2c=2, serial=2, default=1). Board count now uses `Math.max(boardsNeededByLines, boardsNeededByCapacity)`.

### Problem 3: Single extension per board

**Before:** `determineBestExtension()` returned exactly one extension string. If a board's covered rows need both a -24 (resolver) and a -120 (analog), only one was selected.

**Fix:** Replaced with `determineRequiredExtensions()` that returns `string[]`. It scans all covered rows and their diff sub-IDs, collecting every distinct extension needed.

### Problem 4: IO33X-N interface boards unused

**Before:** `IO_INTERFACE_BOARDS` was exported from `mockCatalog.ts` but never imported or used in the simulator. IO332/IO333 got standard -21 extensions instead of proper IO33X-N daughter boards.

**Fix:** Added `selectIO33XBoard()` which examines covered row types and picks the best IO33X-N. Added a second section to `addFpgaInterfaceBoards()` that checks `supportsIOInterfaces === true` and attaches IO33X-N boards.

### Problem 5: fpgaCategory treated identically

**Before:** `simulink-programmable` and `configurable-io` FPGA modules scored the same. Simulink-programmable boards are strictly more flexible (user writes custom Simulink models) but were not preferred.

**Fix:** Added `fpgaCategoryBonus`: +3 for `simulink-programmable`, +1 for `configurable-io`. Simulink boards win when all else is equal, but the difference is small enough that a significantly better configurable match still wins.

### Problem 6: Stale JSDoc and type references

**Before:** The `MockModuleCatalogEntry` type still had an `interfaceBoard?: string` field, and various comments referenced it. The validation script `scripts/validate-configurable-io.ts` used the removed `interfaceBoard` field.

**Fix:** Removed the type field, updated JSDoc, and rewrote section 4 of the validation script to use `supportsIOExtensions` / `supportsIOInterfaces` / compact flags.

---

## 3. Updated Scoring Formula

```
score = exactMatch × 12
      + compatMatch × 6
      − mismatch × 10
      − missing × 8
      − units × 2
      + consolidationBonus        // +10 if same FPGA family already selected
      + fpgaLookAheadBonus        // +(coveredRows − 1) × 8  (proactive)
      + machineBonus              // varies by machine variant
      + lifecyclePenalty           // −25 for not-recommended modules
      + configPackageBonus         // +5 for config-package match
      + fpgaCategoryBonus          // +3 simulink-programmable, +1 configurable
```

Tie-breaking sort order:
1. Fewer physical units (`units` ascending)
2. Higher score
3. Fewer channels needed (`channelCapacity` ascending — prefer tighter fit)
4. Seeded random (deterministic shuffle)
5. Alphabetical module ID (final tiebreaker)

---

## 4. Pipeline Flow

```
simulateProposal(requirements)
  │
  ├── normalizeRequirements()        → flatten & tag rows
  ├── computeFpgaCoverageMap(rows)   → Map<fpgaFamily, rowCount>  ★ NEW
  │
  ├── for each row:
  │     selectBestCandidate(row, fpgaCoverageMap)
  │       └── evaluateCandidate()    → score with look-ahead + category bonus
  │
  ├── consolidateFpgaModules()       → merge FPGA usage, validate I/O line budget
  │
  ├── addFpgaInterfaceBoards()       → attach IO extensions + IO33X-N boards
  │     ├── Section 1: IO extensions  (determineRequiredExtensions)
  │     └── Section 2: IO33X-N boards (selectIO33XBoard)
  │
  └── assemble final proposal
```

---

## 5. Key Data Structures

### `fpgaCoverageMap: Map<string, number>`
Built by `computeFpgaCoverageMap()`. Keys are FPGA family names (e.g. `"IO334"`), values are the count of requirement rows that family *could* serve. Used during candidate evaluation for the look-ahead bonus.

### `familyUsage / familyLineUsage` (inside consolidateFpgaModules)
- `familyUsage: Map<family, { totalChannels, entries[] }>` — logical channel accumulation
- `familyLineUsage: Map<family, totalLines>` — physical I/O line accumulation
- Both are checked to compute the conservative board count.

### `IO_INTERFACE_EXTENSIONS` / `IO_INTERFACE_BOARDS`
Static arrays in `mockCatalog.ts`:
- Extensions: 5 items (each with `extensionSuffix`, `description`, `compatibleModules[]`)
- Boards: 8 items (each with `id`, `name`, `signalType`, `voltageRange`)

### `SUB_ID_EXTENSION_PREFERENCE`
Maps requirement sub-IDs to preferred extension suffixes (e.g. `"resolver" → "-24"`, `"analog-input" → "-120"`).

---

## 6. I/O Lines Per Channel Estimates

Used by `getIOLinesPerChannel()` for budget validation:

| Signal Type | Lines/Channel | Rationale |
|---|---|---|
| Encoder | 3 | A, B, Z quadrature signals |
| Resolver | 6 | Sin+, Sin−, Cos+, Cos−, Ref+, Ref− |
| SPI | 4 | MOSI, MISO, SCLK, CS |
| I2C | 2 | SDA, SCL |
| Serial (UART/RS-422/485) | 2 | TX, RX (or A/B differential pair) |
| Digital I/O | 1 | Single line per channel |
| Analog | 1 | Single line per channel |
| Default | 1 | Conservative fallback |

---

## 7. Lessons for Future Development

1. **Always pre-scan multi-row coverage** before per-row selection. Greedy row-by-row without look-ahead creates systematic bias against consolidation candidates.

2. **Physical I/O lines ≠ logical channels.** A resolver uses 6× more lines than a digital I/O. Budget validation must account for both dimensions.

3. **IO332/IO333 are fundamentally different** from other FPGA boards — they are blank-slate platforms that use IO33X-N daughter boards, not extension suffixes. The code must branch on `supportsIOInterfaces`.

4. **Compact mPCIe modules (IO39x) have no extension support.** Don't try to attach -21/-22/-24 extensions to them.

5. **Extension needs are additive, not exclusive.** A single FPGA board serving resolver + analog rows needs both -24 and -120 extensions attached.

6. **Simulink-programmable vs configurable-io matters** for customer flexibility. Prefer simulink-programmable with a small bonus, but don't force it when a configurable module is a better hardware match.

---

## 8. FPGA Consolidation — Deep Dive

### Why Consolidate?

Speedgoat FPGA I/O boards are multi-function: a single board (e.g. IO334, IO397) can simultaneously handle analog inputs, digital outputs, encoders, communication, etc. Without consolidation, a user requesting 4 analog inputs + 2 encoders + 8 digital outputs would receive 3 separate boards — wasting slots, cost, and chassis space — even though one board can handle all of them.

### Consolidation Algorithm (`consolidateFpgaModules()`)

Location: `lib/proposal/simulator.ts` (~line 682)

**Phase 1 — Accumulate usage per FPGA family:**
```
For each resolved row:
  1. Find the catalog entry matching the row's moduleRef + category + sub
  2. Skip if no fpgaFamily or channelCapacity
  3. Verify code-module compatibility (SUB_ID_TO_CODE_MODULES × FPGA_CODE_MODULE_COMPAT)
  4. Accumulate fraction: quantityRequested / channelCapacity  → familyUsage
  5. Accumulate I/O lines: quantityRequested × getIOLinesPerChannel(subId) → familyLineUsage
```

**Phase 2 — Compute board count with dual-budget:**
```
For each FPGA family:
  boardsNeededByLines    = ⌈linesUsed / fpgaTotalLines⌉
  boardsNeededByCapacity = ⌈fractionalUsage⌉
  actualUnits = max(boardsNeededByLines, boardsNeededByCapacity)
```

The **more conservative** estimate wins — this prevents both:
- Over-packing (exceeding physical pin count)
- Under-counting (ignoring that encoders use 3 lines each, resolvers 6)

**Phase 3 — Update recommended map:**
If `actualUnits < rec.quantity`, reduce quantity and add consolidation rationale string with utilization percentage.

### Code-Module Compatibility Guard

Not every FPGA family supports every signal type's code module. Before counting a row toward a family's usage, the consolidation checks:
```
SUB_ID_TO_CODE_MODULES[diff.subId]  →  required code modules
FPGA_CODE_MODULE_COMPAT[fpgaFamily] →  supported code modules
```
If the intersection is empty, the row is skipped — it cannot be consolidated onto that family.

### I/O Line Utilization Tracking

After consolidation, each recommended entry gets:
```typescript
ioLineUtilization: { used: number; total: number }
```
- `used` = sum of (quantityRequested × linesPerChannel) across all consolidated rows
- `total` = fpgaTotalLines × actualUnits (total available lines across all boards)

This is propagated to the UI via `ProposalRecommendedModule.ioLineUtilization` and rendered as a progress bar (`IOLineUtilizationBar` component in `ProposalResultCard.tsx`).

### Example

User requests: 4 resolver channels + 16 analog inputs + 8 digital outputs, all mapped to IO334 family.

| Signal | Channels | Lines/Ch | Total Lines | Fraction (capacity=64) |
|---|---|---|---|---|
| Resolver | 4 | 6 | 24 | 0.0625 |
| Analog In | 16 | 1 | 16 | 0.25 |
| Digital Out | 8 | 1 | 8 | 0.125 |
| **Total** | **28** | | **48** | **0.4375** |

Assuming IO334 has `fpgaTotalLines: 96`:
- boardsNeededByLines = ⌈48/96⌉ = 1
- boardsNeededByCapacity = ⌈0.4375⌉ = 1
- Result: **1 board** instead of 3, with 50% I/O line utilization

---

## 9. UI Rework (P1–P4)

### What Changed

The React UI was updated to reflect the full FPGA pipeline:

#### New Score Breakdown Fields (P1)

`CandidateScore` type extended with 4 fields, propagated through `buildScoreBreakdown()`:
- `fpgaLookAheadBonus` — "FPGA look-ahead"
- `lifecyclePenalty` — "Lifecycle penalty"
- `configPackageBonus` — "Config package"
- `fpgaCategoryBonus` — "FPGA category"

#### DecisionFlowModal Fixes (P1)

Three stale `technicalDetail` strings updated:
1. **Score formula node** — now includes all terms (look-ahead, lifecycle, config pkg, fpga category)
2. **fpga_consolidate node** — updated to "dual-budget: max(⌈lines/fpgaTotalLines⌉, ⌈capacity⌉)"
3. **fpga_interface node** — references multi-extension + IO33X-N board selection
4. **Consolidation slot math** — uses actual `fpgaInterfaceBoardCount` instead of hardcoded value

#### ProposalRecommendedModule Extensions (P2)

Three new optional fields on the contract type (`proposalTypes.ts`):
```typescript
fpgaCategory?: 'simulink-programmable' | 'configurable'
interfaceForModule?: string   // parent module ID for extensions/IO33X
ioLineUtilization?: { used: number; total: number }
```

#### Module Badges (P3)

`ModuleSpecsBadges` in `ProposalResultCard.tsx` renders:
- **fpgaCategory** — indigo badge: "Simulink-Programmable" or "Configurable I/O"
- **lifecycleStatus** — red "End of Life" / orange "Discontinued"
- **configPackages** — gray chips for each config package
- **webSourcePage** — external link icon

#### Nested FPGA Grouping (P3)

Modules with `interfaceForModule` are rendered as indented children under their parent:
- `ProposalResultCard.tsx` — parent-child separation, children render with `ml-4 border-l-indigo-300` and "↳ Extension" / "↳ Interface Board" tag
- `MachineChassisStrip.tsx` — `expandModules()` places child slots immediately after parent in the visual chassis layout

#### I/O Line Utilization Bar (P3)

`IOLineUtilizationBar` component shows `"I/O Lines: {used}/{total} ({pct}%)"` with color-coded progress:
- Green: < 70%
- Amber: 70–90%
- Red: > 90%

#### FlowExample Extension (P4)

`FlowExample` type extended with `fpgaInterfaceBoardCount: number`, computed from `recommendedModules.filter(m => m.interfaceForModule).length`.

---

## 10. Per-Subcategory Default Channel Quantities

### Problem

When adding a new I/O card, the quantity field always defaulted to 32 channels — inappropriate for many signal types (e.g. CAN typically needs 2, resolvers need 4).

### Solution

Added `defaultQuantity?: number` to the `SubCategory` type (`types.ts`). `createInitialTempSpecs()` in `state.ts` now uses `sub.defaultQuantity ?? 32`.

### Defaults by Subcategory (`data.ts`)

| Category | Subcategory | Default Qty | Rationale |
|---|---|---|---|
| Analog | Inputs | 16 | Common bench config |
| Analog | Outputs | 8 | Fewer outputs than inputs typical |
| Digital | Inputs | 32 | High channel count standard |
| Digital | Outputs | 32 | High channel count standard |
| Digital | PWM | 4 | Motor drive typical |
| Digital | Capture | 4 | Event capture typical |
| Communication | Protocols | 2 | CAN/LIN bus pairs |
| Motion | Encoder | 4 | Multi-axis motor |
| Motion | Resolver | 4 | Multi-axis motor |
| Temperature | Measurement | 8 | Thermocouple arrays |
| Temperature | Simulation | 4 | Fewer sim channels |
| Strain | Strain Gauge | 4 | Typical bridge count |
| Strain | Vibration | 4 | Typical IEPE count |
| Fault | Relays | 4 | Fault injection matrix |
| Fault | Solid-State | 4 | Fault injection matrix |
| High Voltage | Measurement | 4 | HV measurement points |
| High Voltage | Switching | 4 | HV switching channels |
| Resistor | Simulation | 4 | Programmable R channels |
| BMS | Cell Emulation | 12 | Typical battery stack |
| BMS | Fault Insertion | 4 | Fault per cell group |
| BMS | Temp Emulation | 8 | NTC per module |
| Custom | General Purpose | 4 | Conservative default |
