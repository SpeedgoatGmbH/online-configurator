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

---

## 11. Accessing Speedgoat Authenticated Documentation (Workflow)

### Problem

Speedgoat's help documentation (e.g. HDL Coder interfaces, IO module specs) lives behind a customer login at `https://www.speedgoat.com/help/...`. Standard `fetch` or `curl` cannot access it — pages return a login wall.

### Solution: Playwright Crawler

The project includes a Playwright-based crawler at `scripts/crawl-speedgoat-playwright.js` that handles authenticated crawling.

#### Prerequisites

```bash
npm i -D playwright
npx playwright install chromium
```

#### Credentials

Store credentials in `.env.local` (gitignored):

```env
CRAWL_USERNAME=your.email@speedgoat.com
CRAWL_PASSWORD=your_password
```

#### Running the Crawler

**Automated login (if selectors match the login form):**
```powershell
$env:CRAWL_START_URL="https://www.speedgoat.com/help/hdlcoder/page/refentry_interface_io33x_01LV"
$env:CRAWL_PATH_PREFIX="/help"
$env:CRAWL_MAX_PAGES=30
$env:CRAWL_HEADLESS="true"
$env:CRAWL_BLOCK_ASSETS="true"
$env:CRAWL_DELAY_MS=500
node scripts/crawl-speedgoat-playwright.js
```

**Manual login (recommended — Speedgoat login form may not match default selectors):**
```powershell
$env:CRAWL_START_URL="https://www.speedgoat.com/help/hdlcoder/page/refentry_interface_io33x_01LV"
$env:CRAWL_PATH_PREFIX="/help"
$env:CRAWL_MAX_PAGES=30
$env:CRAWL_HEADLESS="false"
$env:CRAWL_LOGIN_POLL="true"
$env:CRAWL_LOGIN_POLL_TIMEOUT_MS=300000
$env:CRAWL_BLOCK_ASSETS="true"
$env:CRAWL_DELAY_MS=500
node scripts/crawl-speedgoat-playwright.js
```

This opens a browser window. Log in manually, then the script auto-detects authentication and begins crawling.

#### Output

- HTML pages saved to `crawl-output-playwright/pages/help/hdlcoder/page/*.html`
- Manifest: `crawl-output-playwright/crawl-results.json`
- Persistent browser profile: `crawl-output-playwright/profile/` (subsequent runs reuse login session)

#### Key Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CRAWL_START_URL` | extranet home | Starting URL to crawl |
| `CRAWL_PATH_PREFIX` | `/extranet` | Only follow links under this path |
| `CRAWL_MAX_PAGES` | 50 | Maximum pages to crawl |
| `CRAWL_HEADLESS` | `false` | Run browser headless (no window) |
| `CRAWL_LOGIN_POLL` | `false` | Poll for manual login completion |
| `CRAWL_BLOCK_ASSETS` | `true` | Block images/fonts/media for speed |
| `CRAWL_SAVE_JSON` | `false` | Capture JSON API responses too |
| `CRAWL_USERNAME` / `CRAWL_PASSWORD` | empty | Auto-login credentials |

#### Extracting Text from Crawled HTML

Since `jsdom` is not installed, use Node's built-in string replacement:

```javascript
const fs = require('fs');
const html = fs.readFileSync('crawl-output-playwright/pages/help/hdlcoder/page/refentry_interface_io33x_01LV.html', 'utf8');
const text = html
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
console.log(text.slice(0, 5000));
```

---

## 12. IO33x Interface & Pin Mapping Analysis

### Source Data

Crawled 30 pages from `https://www.speedgoat.com/help/hdlcoder/page/` on 2026-03-01, covering:
- IO33x-01LV, IO33x-02, IO33x-03, IO33x-04, IO33x-06 (front interfaces)
- IO3xx-21, IO3xx-22, IO3xx-24 (extension interfaces)
- IO335, IO336, IO337 (module-specific front interfaces)
- IO324, IO325 (TTL/differential interfaces)
- IO360-A/B/C, IO361-A/B/C (TTL/differential interfaces)
- IO397 (TTL interface)
- Digital FireFly interface

### Interface Architecture Summary

Each IO33x front interface board (IO33X-1-LV through IO33X-8) defines a **fixed physical pin mapping** between:
1. **Terminal pins** (physical connector pins on the board's front panel)
2. **FPGA pins** (the FPGA's I/O banks inside the IO332/IO333 module)
3. **Target Platform Interfaces** (the HDL Workflow Advisor interface names)

**This mapping is physically wired — it is NOT software-configurable.**

### IO33x Front Interface Pin Mappings (from documentation)

| Interface | Connector | I/O Type | Channel Count | Direction | Data Type |
|---|---|---|---|---|---|
| **IO33X-1-LV** (IO33x-01LV) | 68-pin | LVTTL 3.3V | 64 channels [0:63] | bidirectional | boolean |
| **IO33X-2** (IO33x-02) | 68-pin | RS485/RS422 differential | 30 channels [0:29] | bidirectional | boolean |
| **IO33X-3** (IO33x-03) | 68-pin | Mixed: 16 TTL + 22 RS485/RS422 | 16+22 = 38 channels | bidirectional | boolean |
| **IO33X-4** (IO33x-04) | 68-pin | LVDS differential | 30 channels [0:29] | bidirectional | boolean |
| **IO33X-5** (IO33x-05) | — | 2× 16-bit 105MHz differential AI | 2 channels | input | int16 |
| **IO33X-6** (IO33x-06) | — | Mixed: 16 AI + 8 AO + 16 GPIO | 16+8+16 = 40 channels | mixed | int16/boolean |
| **IO33X-7** (IO33x-07) | — | 16× 16-bit AO | 16 channels | output | int16 |
| **IO33X-8** (IO33x-08) | — | 8× 16-bit AO | 8 channels | output | int16 |

### IO Extension Interface Pin Mappings

| Extension | I/O Type | Channel Count | Supported Modules |
|---|---|---|---|
| **-21** (IO3xx-21) | 56 TTL I/O lines, 7 groups of 8 | 56 | IO324, IO325, IO332, IO333, IO334, IO335, IO336, IO337, IO342, IO344, IO352, IO360, IO361, Pulse I/O |
| **-22** (IO3xx-22) | 16 RS422/RS485 + 24 TTL + 6 I²C | 46 | IO324, IO325, IO332, IO333, IO334, IO335, IO336, IO337, IO342, IO344, IO352, IO360, IO361, Pulse I/O |
| **-24** (IO3xx-24) | 2 RDC + 8 RS422/RS485 + 40 TTL | 50 | IO324, IO325, IO332, IO333, IO334, IO335, IO336, IO337, IO360, IO361, Pulse I/O |

### Module Compatibility Matrix (from docs)

| Module | Supported IO33X-N Front Interfaces | IO Extensions |
|---|---|---|
| **IO332-200k** | -01LV, -02, -04, -06 | -21, -22, -24 |
| **IO333-325k/410k** | -01LV, -02, -03, -04, -06 | -21, -22, -24 |
| **IO334-325k** | (has own front connector) | -21, -22, -24 |
| **IO335-325k** | (has own front connector) | -21, -22, -24 |
| **IO336-325k** | (has own front connector) | -21, -22, -24 |
| **IO337-650k** | (has own front connector) | -21, -22 (no -24) |

### Digital FireFly Interface (for future reference)

The FireFly connector supports LVCMOS or LVDS with module-dependent channel counts:
- IO332/IO333: 8 LVDS or 16 LVCMOS
- IO334/IO336: 4 LVDS or 8 LVCMOS
- IO337/IO352: 8 LVCMOS only (no LVDS)
- IO360/IO361: 4 LVDS only (no LVCMOS)

---

## 13. Pin Mapping in the Configurator — Do We Need It?

### The Core Question

> Since we generate bitstreams and only a certain flexible amount of functionality is possible, do we need pin mapping logic in the configurator?

### Analysis

#### What Happens in the Real Workflow

1. **Customer selects a reference design** in the HDL Workflow Advisor (Simulink/HDL Coder)
2. **Step 1.2**: Customer selects the I/O interface (e.g. "-01" for IO33x-01LV, "-02" for IO33x-02)
3. **Step 1.3**: The available Target Platform Interfaces are **determined by the interface selection** — e.g. selecting "-01" gives `LVTTL IO33x-01LV Channel [0:63]`, selecting "-02" gives `RS485/RS422 IO33x-02 Channel [0:29]`
4. **HDL Coder generates the bitstream** with the correct pin assignments baked in

#### What the Configurator Does Today

The configurator recommends:
- Which FPGA module to use (IO332, IO333, IO334, etc.)
- Which IO33X-N front interface board (for IO332/IO333)
- Which IO extension(s) (-21, -22, -24, -120)

This is **sufficient** because:

1. **Pin mapping is fixed per interface board** — Choosing IO33X-2 (RS485) automatically means 30 RS485 channels on specific pins. There is no "custom pin assignment" option. The physical wiring is baked into the daughter board PCB.

2. **The bitstream generation handles pin mapping** — HDL Coder + the IO Configuration Package automatically assigns FPGA pins based on the selected interface. The customer doesn't manually route pins.

3. **Channel count is the binding constraint, not pin mapping** — The configurator already tracks channel counts per interface board and validates against `fpgaTotalLines` + `channelCapacity`. This is what determines whether the hardware can serve the customer's needs.

4. **Extension interfaces are similarly fixed** — The -21 always provides 56 TTL lines in 7 groups of 8. The -22 always provides 16 RS422 + 24 TTL + 6 I²C. There's no flexibility in the pinout.

### Verdict: **No, we do NOT need pin mapping in the configurator**

The configurator operates at the **functional requirement → hardware selection** level. Pin mapping is a downstream concern handled entirely by:
- The physical PCB design of the interface board
- The HDL Coder Workflow Advisor + IO Configuration Package
- The generated bitstream

#### What We Already Do (and is sufficient)

| Configurator Concern | How We Handle It | Status |
|---|---|---|
| Which FPGA module? | `evaluateCandidate()` scoring + `FPGA_CODE_MODULE_COMPAT` | ✅ Implemented |
| How many boards? | Dual-budget: `channelCapacity` + `fpgaTotalLines` | ✅ Implemented |
| Which IO33X-N board? | `selectIO33XBoard()` based on signal types | ✅ Implemented |
| Which extensions? | `determineRequiredExtensions()` from sub-IDs | ✅ Implemented |
| Code-module compatibility? | `SUB_ID_TO_CODE_MODULES` × `FPGA_CODE_MODULE_COMPAT` | ✅ Implemented |

#### What Would Change If We Added Pin Mapping

Adding pin mapping would mean:
- Modeling every terminal pin → FPGA pin assignment per interface board
- Tracking which pins are "used" vs "free" across multiple signal types sharing a board
- Validating group constraints (e.g. -21 extension: all 8 pins in a group must share direction/pull config)
- This complexity belongs in the HDL Workflow Advisor, not in a sales/proposal configurator

### Recommendation

**Keep the configurator at the functional level.** The current approach of selecting interface boards by signal type and validating channel counts is the right abstraction for a proposal tool. Pin-level mapping is an engineering detail that the HDL toolchain handles automatically during bitstream generation.

If anything, we could enhance the configurator to **display** the pin mapping info (read-only) as reference documentation for the customer — but not use it as a constraint in the selection algorithm.

---

## 14. Front Interface vs Rear Extension: Two Independent I/O Paths

### The Dual-Connector Architecture (IO332/IO333)

A critical insight from the docs: for IO332/IO333, the **front interface** (IO33X-N board) and the **rear extension** (-21, -22, -24) are **completely independent I/O paths** that are selected separately.

```
                ┌──────────────────────────────┐
                │       IO332 / IO333          │
                │         (FPGA core)          │
                │                              │
  FRONT ◄──────┤  IO33X-N board (daughter)     │──────► REAR
  connector     │  e.g. IO33X-6:               │       connector
                │  16 AI + 8 AO + 16 GPIO      │       via extension
                │                              │       e.g. -21:
                │  Pin mapping fixed by PCB     │       56 TTL in 7×8 groups
                │  of the IO33X-N board         │       + 6 bidirectional I²C
                └──────────────────────────────┘
```

### HDL Workflow Advisor Step 1.2 — Two Separate Selections

The Workflow Advisor has **two drop-downs** in step 1.2:
1. **I/O Interface** → selects the front board: `-01` (IO33x-01LV), `-02`, `-03`, `-04`, `-06`
2. **I/O Interface Extension** → selects the rear extension: `-21`, `-22`, `-24`

Step 1.3 then shows **combined** Target Platform Interfaces from both selections.

### What -21 Provides (IO3xx-21 Extension)

When -21 is selected as the extension:

| Feature | Detail |
| --- | --- |
| **TTL channels** | 56 lines [0:55], distributed in 7 groups of 8 |
| **Group constraint** | All 8 lines in a group share direction + pull resistor config |
| **Pull-up options** | 3.3V, 5V, pull-down, or floating (configured per group in generated block mask) |
| **Bidirectional I²C** | 6 additional bidirectional lines [0:5] with open-collector 5V pull-up (I²C-compatible) |
| **Switching speed** | Bidirectional: ~4µs HIGH→LOW, ~13µs LOW→HIGH (slow — I²C only) |
| **Physical connector** | 68-pin terminal board, pins 1-60 for TTL/bidir, 67-68 for +5V supply |
| **Ground pins** | Pins 9, 26, 43, 60 (every 17th pin) |
| **Data type** | boolean |
| **Direction** | input or output (per group), bidirectional (I²C lines) |

#### Module-Dependent Channel Limits on -21

Some modules use fewer rear FPGA lines than the IO33x family:

| Module | TTL Channels (n) | Bidirectional (m) |
| --- | --- | --- |
| IO33x (IO332/IO333) | 55 | 5 |
| IO342 | 13 | 1 |
| IO344 | 19 | 1 |
| IO352 | 19 | 3 |
| Pulse I/O | 55 | 5 |

### How the Configurator Handles This Today

The current code in `addFpgaInterfaceBoards()` correctly treats these as two independent selections:

1. **Section 1** — `determineRequiredExtensions()`: Scans covered row signal types → picks extension(s)
   - Resolver → `-24`
   - Analog → `-120`
   - RS422/RS485 → `-22`
   - Default → `-21`
   - **Multiple can be selected** (e.g. resolver + analog = both -24 and -120)

2. **Section 2** — `selectIO33XBoard()`: Only for IO332/IO333 (`supportsIOInterfaces: true`) → picks front board
   - Mixed analog+digital → `IO33X-6`
   - Analog only → `IO33X-5`
   - RS422/RS485 → `IO33X-2`
   - LVDS → `IO33X-4`
   - Default → `IO33X-1-LV`

These are **additive** — an IO332 proposal can include both an IO33X-6 front board AND a -21 rear extension.

### Implication for Pin Mapping

This reinforces the §13 verdict: **no pin mapping needed in the configurator**. The -21 extension's 56 lines in 7×8 groups with configurable pull resistors are all handled by:
- The physical PCB of the -21 board (fixed wiring)
- The HDL Workflow Advisor step 1.3 (interface assignment)
- The generated bitstream mask (group direction/pull-up config)

The configurator's job is just to say: "you need an IO332 + IO33X-6 front board + -21 rear extension" — the downstream toolchain handles pin details.

---

## 15. Crawled Product Pages — FPGA Module Specs Summary

### Source

Crawled 13 individual product pages from `https://www.speedgoat.com/products/` on 2026-03-01.
Stored in `crawl-output-playwright/pages/products/`.

### Complete FPGA Module Comparison

| Module | FPGA Chip | Logic Cells | Form Factor | AI (ch/res/rate) | AO (ch/res) | Digital I/O | IO33X-N Front | Extensions | Config Packages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **IO324** | Kintex-7 XC7K200T | 200k | PCIe | 32 SE or 16 diff / 16-bit / 1 Msps | 8 / 16-bit | 32 TTL + 8 RS422/485 | No | -21, -22, -24, -32 | RCP, HIL, Comms |
| **IO325** | Kintex-7 XC7K160T | 160k | XMC | 8 diff / 16-bit / 1.5 Msps | 4 / 16-bit | 32 TTL (16 reconfig as RS422) | No | -21, -22, -24, -32 | RCP, HIL, Comms |
| **IO332** | Artix-7 XC7A200T | 200k | XMC | via IO33X-N | via IO33X-N | via IO33X-N | **Yes**: -1-LV, -2, -3, -4, -6 | -21, -22, -32 | Custom bitstreams |
| **IO333** | Kintex-7 (325k/410k) | 325k–410k | XMC | via IO33X-N | via IO33X-N | via IO33X-N | **Yes**: -1-LV, -2, -3, -4, -6 | -21, -22, -32 | Custom bitstreams |
| **IO333-SFP** | Kintex-7 (325k/410k) | 325k–410k | XMC | — | — | 26 LVCMOS / 13 LVDS + 2 SFP+ | No | -21, -22, -32 | FPGA only |
| **IO334** | Kintex-7 XC7K325T | 325k | PCIe | 16 diff / 16-bit / 5 Msps | 16 SE / 16-bit | — (front AIO only) | No | -21, -22, -24, -32 | RCP, HIL, Comms, Resolver |
| **IO335** | Kintex-7 XC7K325T | 325k | XMC | 24 diff / 16-bit / 5 Msps | — | 3 diff digital input (front) | No | -21, -22, -32 | FPGA only |
| **IO336** | Kintex-7 XC7K325T | 325k | PCIe | 16 diff / 16-bit / 5 Msps | 8 / 16-bit | 32 TTL + 8 RS422/485 | No | -21, -22, -24, -32 | RCP, HIL, Comms |
| **IO337** | Kintex-7 XC7K325T | 650k | PCIe | 8 diff / 16-bit / 5 Msps | 32 SE / 16-bit / 10 Mups | 4 M-LVDS | No | -21, -22 | HIL, Comms |
| **IO342** | Kintex UltraScale (1.08M/1.45M) | 1.08M–1.45M | PCIe | via FMC (IO342-63) | via FMC | 14 TTL + 2 I²C (via -21) | Optional FMC | -21, -22, -32 | FPGA only |
| **IO344** | Zynq UltraScale+ RFSoC | 930k | PCIe x8 | 8 SE / 12-bit / 4 GSPS | 8 SE / 14-bit / 6.4 GSPS | 20 TTL (via -21) | No | -21, -22 | FPGA only |
| **IO352** | UltraScale+ | 500k | PCIe | — | — | 20 TTL + 4 I²C (via -21) | No | -21, -22 | Vision FPGA |
| **IO397** | Artix-7 XC7A50T | 50k | mPCIe | 4 / 16-bit / 200 ksps | 4 / 16-bit | 14 TTL (ESD, M12) | No | **None** (self-contained) | RCP, HIL, Comms |

### Key Observations from Product Pages

1. **Configuration packages are extension-specific**: Each module offers different config packages for -21 vs -22 vs -24 extensions. E.g., IO334 with -21 gets PWM/SPI/UART channels; IO334 with -22 gets SSI/EnDAT channels; IO334 with -24 gets resolver emulation.

2. **IO332 and IO333 are the only modules with IO33X-N front interfaces**: Every other module has built-in front I/O (analog + digital).

3. **IO342 uses FMC connectors** (FPGA Mezzanine Card) instead of IO33X-N — a different interface standard for its high-end UltraScale FPGA.

4. **IO344 is an RFSoC** (Radio Frequency System on Chip) — 4 GSPS sampling, aimed at SDR/radar, not typical I/O.

5. **IO397 is fully self-contained** (mPCIe form factor) — no extensions at all, M12 connectors, 14 TTL + 4 AI + 4 AO.

6. **IO337 has the most AO channels** (32 outputs at 10 Mups) — designed for power electronics inverter testing.

7. **IO335 is input-only** (24 AI, no AO) — pure high-speed data acquisition.

8. **Aurora inter-module communication** available on: IO325, IO332, IO333, IO334, IO335, IO336, IO337, IO342, IO344, IO352.

### Ordering Code Pattern

All modules follow: `{ItemCode}{MachineCode}` where the machine code suffix (X) indicates the target machine.

| Base Item Code | Module |
| --- | --- |
| 2A324X | IO324-200k |
| 2A325X | IO325-160k |
| 2A332X | IO332-200k |
| 2A333X | IO333-325k |
| 2B333X | IO333-410k |
| 2R333X | IO333-325k-SFP |
| 2S333X | IO333-410k-SFP |
| 2A334X | IO334-325k-10V |
| 2C334X | IO334-325k-2.5V |
| 2A335X | IO335-325k |
| 2A336X | IO336-325k |
| 2A337X | IO337-650k |
| 2A342-6 | IO342-1.08M-1FMC |
| 2B342-6 | IO342-1.45M-1FMC |
| 2A344-6 | IO344-930k |
| 2A352-6 | IO352-500k |
| 2A397X | IO397-50k |

### Extension Ordering Codes

| Item Code | Extension | Description |
| --- | --- | --- |
| 23x21X | IO3XX-21 | TTL signal conditioning extension |
| 23x22X | IO3XX-22 | RS422/RS485/TTL extension |
| 23x24X | IO3XX-24 | Resolver + RS422/TTL extension |
| 23x32X | IO3XX-32 | SFP+ transceiver extension |

### HDL Coder Integration Package Codes

| Item Code | Package |
| --- | --- |
| 3A24IP | IO324-200k HCIP |
| 3A25IP | IO325-160k HCIP |
| 3A32IP | IO332-200k HCIP |
| 3A33IP | IO333-325k/410k HCIP |
| 3A34IP | IO334-325k HCIP |
| 3A35IP | IO335-325k HCIP |
| 3A36IP | IO336-325k HCIP |
| 3A37IP | IO337-650k HCIP |

### HDL I/O Blockset Codes

| Item Code | Blockset |
| --- | --- |
| 303MOT | Motion Control HDL I/O Blockset (PWM, Quadrature, SSI, BiSS, EnDat, Cam/Crank, Resolver Emulation) |
| 303COM | Communication HDL I/O Blockset (SPI, I2C, SENT, Serial, dShot) |

---

## 16. Configuration Options, Code Modules & Restrictions

### Three Layers of FPGA Functionality

Every Speedgoat FPGA module has **three independent layers** that together determine what I/O functionalities are available:

| Layer | What it controls | How it's selected | Item example |
|---|---|---|---|
| **1. Configuration Package** | Pre-built bitstream with fixed channel allocation (RCP / HIL / Comms / Resolver) | Ordered per module+extension combo | `20334X` (IO334-21 RCP) |
| **2. HDL Coder Integration Package (HCIP)** | Unlocks Simulink-programmable workflow — custom HDL bitstreams | One per base module | `3A34IP` (IO334 HCIP) |
| **3. HDL I/O Blocksets** | Reusable IP blocks for HDL Coder (motion, comms) | One per protocol family | `303MOT`, `303COM` |

**Key insight**: Layers 2+3 (HDL Coder) give the customer **full freedom** to allocate any supported code module to any digital I/O line. Layer 1 (Configuration Package) is a **fixed, pre-designed allocation** — the customer picks which "preset" fits their application.

### Configuration Packages — Per Module (Canonical Source)

> **Source**: [/help/slrt/page/io_configuration_package/refentry_ch_configurations](https://www.speedgoat.com/help/slrt/page/io_configuration_package/refentry_ch_configurations)

Configuration packages are **NOT universal** — each module offers different packages. Modules with IO3xx extensions ("-21"/"-22"/"-24") offer TTL/RS422 variants; self-contained modules (IO306/IO307/IO397) offer plain RCP/HIL/Comms.

#### Complete Config-Package Matrix (from help page)

| Module | Comm TTL | Comm RS422 | HIL TTL | HIL RS422 | RCP TTL | RCP RS422 | TPI6020 | Resolver TTL |
|--------|----------|------------|---------|-----------|---------|-----------|---------|-------------|
| **IO306** | — Comm | — | — HIL | — | — RCP | — | — | — |
| **IO307** | — Comm | — | — HIL | — | — RCP | — | — | — |
| **IO324** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **IO334** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| **IO336** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **IO337** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **IO397** | — Comm | — | — HIL | — | — RCP | — | ✅ | — |
| **Pulse I/O** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |

> "—" = not offered for that module. IO306/IO307/IO397 have plain "Communication"/"HIL"/"RCP" without TTL/RS422 variants (no extension boards).
> **IO337** offers 4 packages (Comm+HIL × TTL+RS422) — no RCP, no Resolver, no TPI6020.
> **Pulse I/O** is a generic category (same package structure as IO334).

#### Extension ↔ Config Package Coupling

| Extension | RCP | HIL | Communication | Resolver |
|---|---|---|---|---|
| **-21** (TTL) | ✅ TTL variant | ✅ TTL variant | ✅ TTL variant | ❌ No resolver HW |
| **-22** (RS422/RS485) | ✅ RS422 variant (SSI/EnDat) | ✅ RS422 variant (SSI/EnDat Slave) | ✅ RS422 variant (Serial) | ❌ No resolver HW |
| **-24** (Resolver) | ❌ | ❌ | ❌ | ✅ 2ch resolver + TTL |
| **None** (IO306/IO307/IO397) | ✅ Built-in | ✅ Built-in | ✅ Built-in | ❌ |

#### Detailed Channel Allocations (from Product Pages)

**IO334 with -21 (TTL) Extension:**

| Package | Channels |
|---|---|
| RCP | 10x PWM Gen, 4x PWM Cap, 3x Quad Dec, 3x Pulse Cnt, 2x UART Tx/Rx, 1x I2C Master, 2x I2C Slave, 1x Interrupt |
| HIL | 5x PWM Gen, 12x PWM Cap, 3x Quad Enc, 2x Pulse Cnt, 2x UART Tx/Rx, 1x SPI, 1x I2C Master, 2x I2C Slave, 1x Interrupt |
| Comms | 5x PWM Gen, 6x PWM Cap, 1x Quad Dec, 1x Quad Enc, 4x UART Tx/Rx, 4x SPI, 1x I2C Master, 2x I2C Slave, 1x Interrupt |

**IO334 with -22 (RS422) Extension:**

| Package | Channels |
|---|---|
| RCP | 6x PWM Gen, 4x PWM Cap, 2x Quad Dec, 1x Pulse Cnt, 3x SSI Master, 2x EnDAT Master, 1x I2C Master, 2x I2C Slave, 1x Interrupt |
| HIL | 3x PWM Gen, 9x PWM Cap, 2x Quad Enc, 3x SSI Master, 2x EnDAT Slave, 1x I2C Master, 2x I2C Slave, 1x Interrupt |
| Comms | 5x PWM Gen, 3x PWM Cap, 1x Quad Dec, 1x Quad Enc, 6x UART Tx/Rx, 1x I2C Master, 2x I2C Slave, 1x SPI |

**IO334 with -24 (Resolver) Extension:**

| Package | Channels |
|---|---|
| Resolver | 2x Resolver Emu, 7x PWM Gen, 4x PWM Cap, 3x Pulse Cnt, 2x UART Tx/Rx, 2x SPI, 1x Interrupt |

**IO324 / IO336 (identical config package structure to IO334)**

Same package types (RCP/HIL/Comms for -21/-22, Resolver for -24), with slight channel count differences due to FPGA size:
- IO324 (200k) — slightly fewer channels per package
- IO336 (325k) — identical to IO334 channel allocations
- Both also support **TPI6020** (Three-Phase Inverter) config: 2x Power Module, 6x PWM, 2x Quad Dec, 1x Interrupt

**IO337 — 4 Config Packages (Comm+HIL × TTL+RS422):**

| Package | Code Modules Included |
|---|---|
| Comm TTL | SPI M/S, I2C M/S, Serial |
| Comm RS422 | SPI M/S, I2C M/S, Serial |
| HIL TTL | PWM Gen/Cap, Pulse Counter, Quadrature Encoder, Interrupt Input |
| HIL RS422 | PWM Gen/Cap, SSI Slave, EnDat Slave, Quadrature Encoder, Interrupt Input |

> ⚠ **Discrepancy**: IO337 config packages include Quadrature, SSI Slave, EnDat Slave, Pulse Counter — but `FPGA_CODE_MODULE_COMPAT` in the codebase does **not** list these for IO337. The code module compat map may only reflect the HDL Coder workflow, not what's available via config packages.

**IO306 — 3 Config Packages (no extensions, no TTL/RS422 variants):**

| Package | Code Modules Included |
|---|---|
| Communication | SPI M/S, I2C M/S |
| HIL | PWM Gen/Cap, Quadrature Encoder, Pulse Counter, Interrupt Input |
| RCP | PWM Gen/Cap, Quadrature Decoder, Pulse Counter, Interrupt Input |

**IO307 — 3 Config Packages (no extensions, no TTL/RS422 variants):**

| Package | Code Modules Included |
|---|---|
| Communication | Serial M/S, SPI M/S, I2C M/S |
| HIL | SSI Slave, BiSS Slave, EnDat Slave, Quadrature Encoder, PWM Gen/Cap, Pulse Counter, Interrupt Input |
| RCP | SSI Master, BiSS Master, EnDat Master, Quadrature Decoder, PWM Gen/Cap, Pulse Counter, Interrupt Input |

**IO397 — 4 Config Packages (self-contained, no extensions):**

| Package | Code Modules Included |
|---|---|
| Communication | SPI M/S, I2C M/S, Serial |
| HIL | PWM Capture, Quadrature Encoder, Interrupt Input |
| RCP | PWM Generation, Quadrature Decoder, Interrupt Input |
| TPI6020 | PWR-TPI6020 Three-Phase Inverter, PWM Gen, Quadrature Decoder |

> Note: IO397 HIL omits PWM Generation; IO397 RCP omits PWM Capture (asymmetric).

**IO332 / IO333 — No config packages (Simulink-programmable only):**

These use IO33X-N front interface boards (not extensions) and are purely HDL Coder workflow. Config packages don't apply — every bitstream is custom.

### Code Modules (FPGA_CODE_MODULE_COMPAT)

Code modules are the atomic functional blocks that an FPGA can instantiate. They determine **what the FPGA can do** independent of which config package or extension is selected.

**Current codebase mapping** (`mockCatalog.ts`):

| Module | Code Modules Supported |
|---|---|
| IO306 | PWM, SPI, I2C, Digital, Pulse Counter, Quadrature, Interrupt, DMA Controller |
| IO307 | + Serial, SSI, BiSS, EnDat |
| IO324 | All above + Analog, Resolver, TPI6020, SENT, Dshot, Cam/Crank, CMU Emu |
| IO325 | All above (excl. TPI6020, Dshot, Cam/Crank, CMU; + SENT) |
| IO334 | All above (excl. TPI6020, CMU) + SENT, Dshot, Cam/Crank |
| IO336 | = IO324 (full set including TPI6020, CMU) |
| IO337 | Analog, PWM, SPI, I2C, Serial, Digital, Interrupt, DMA Controller |
| IO397 | Analog, PWM, SPI, I2C, Serial, Digital, Pulse Counter, Quadrature, TPI6020, Interrupt, DMA Controller |

**Key restriction**: IO337 (650k Zynq) has a **reduced** code module set in `FPGA_CODE_MODULE_COMPAT` — no Quadrature, SSI, BiSS, EnDat, Resolver, SENT, Dshot despite being the largest FPGA. However, the IO337 **config packages** (see above) DO include Quadrature Encoder, SSI Slave, EnDat Slave, and Pulse Counter. The compat map may only reflect HDL Coder capabilities (custom bitstreams), while config packages provide pre-built bitstreams that include these code modules.

### SUB_ID → Code Module Mapping

The configurator gates FPGA candidates using `SUB_ID_TO_CODE_MODULES`:

| Sub-ID | Required Code Module(s) | Effect |
|---|---|---|
| `pwm` | PWM | Gates out IO337 ❌ (wait — IO337 has PWM ✅) |
| `capture` | PWM, Pulse Counter | Any match = compatible |
| `gpio` | Digital | All FPGA modules pass |
| `encoder` | Quadrature, BiSS, EnDat, SSI | IO337 ❌, IO397 only Quadrature |
| `resolver` | Resolver | Only IO324, IO325, IO334, IO336 |
| `spi` / `i2c` / `serial` | SPI / I2C / Serial | Most modules pass |
| `sent` / `dshot` | SENT / Dshot | Only IO324, IO325, IO334, IO336 |
| `inputs` / `outputs` | Analog | Only IO324, IO325, IO334, IO335, IO336, IO337, IO397 |

### HDL Coder Integration Package (HCIP)

HCIP is a **per-module license** that enables the Simulink-programmable workflow. Without it, the module can only use configurable workflow (pre-built bitstreams = config packages).

| Module | HCIP Code | Notes |
|---|---|---|
| IO324 | 3A24IP | Covers base module + all extensions (-21/-22/-24) |
| IO325 | 3A25IP | Covers base + extensions (-21/-22/-24/-32) |
| IO332 | 3A32IP | Covers base + IO33X-N interfaces + extensions |
| IO333 | 3A33IP / 3B33IP | 3A = 325k variant, 3B = 410k variant |
| IO334 | 3A34IP | Covers base + extensions |
| IO335 | 3A35IP | Covers base + extensions |
| IO336 | 3A36IP | Covers base + extensions |
| IO337 | 3A37IP | Covers base + extensions |
| IO342 | 3A32IP | Note: shares code with IO332 HCIP |
| IO344 | 3A44IP | Covers base + interfaces |
| IO352 | 3A52IP | Covers base + interfaces |

### HDL I/O Blocksets

These are **add-on IP bundles** for HDL Coder users:

| Blockset | Code | Contains |
|---|---|---|
| **Motion Control** | 303MOT | PWM Gen/Cap, Quadrature Dec/Enc, SSI, BiSS, EnDat, Cam/Crank, Resolver Emulation |
| **Communication** | 303COM | SPI, I2C, SENT, Serial, dShot |

> Available for: IO324, IO325, IO334, IO335, IO336, IO337 (all Simulink-programmable XMC/PCIe modules with extensions).
> NOT needed for: IO332/IO333 (included in HCIP), IO342/IO344/IO352 (different architecture), IO397 (configurable only).

### Two Workflows — Configurable vs Simulink-Programmable

| Aspect | Configurable Workflow | Simulink-Programmable (HDL Coder) |
|---|---|---|
| **Bitstream** | Pre-built by Speedgoat (config package) | Custom, compiled from Simulink model |
| **Channel allocation** | Fixed per package (RCP/HIL/Comms/Resolver) | Fully flexible — any code module on any line |
| **Sample rate** | Up to ~100 kHz | Up to 100 MHz |
| **Required purchase** | Config Package (per module+ext) | HCIP + optionally 303MOT/303COM |
| **Customer skill** | Low — Simulink Real-Time only | High — HDL Coder + Simulink |
| **Modules** | IO316–IO397 (most modules) | IO324, IO325, IO332–IO337, IO342, IO344, IO352 |

### Implications for the Configurator

1. **Config packages are NOT in the codebase yet as structured data**: The `configPackages` field on catalog entries is a free-form string array (e.g., `['Communication TTL', 'HIL RS422']`) rather than a structured per-extension breakdown. Only 8 modules have any `configPackages` defined.

2. **The scoring bonus is soft (+4)**: `computeConfigPackageBonus()` does substring matching on config package names vs sub-IDs. It works as a tie-breaker but doesn't enforce hard restrictions.

3. **Config package selection is NOT a user-facing choice yet**: The configurator doesn't ask the customer "RCP or HIL?" — it auto-selects modules. In a future phase, the workflow type (RCP vs HIL vs custom HDL) could be a top-level configurator input that constrains module scoring.

4. **Extension ↔ config package coupling is implicit**: When the simulator assigns a -24 extension, it implicitly means the Resolver config package. But the codebase doesn't enforce that -24 *requires* a Resolver config and *excludes* RCP/HIL/Comms.

5. **Channel count limits per config package could gate proposals**: E.g., IO334-21 RCP gives only 10x PWM + 4x PWM Capture. If a customer needs 15x PWM, a single RCP config won't suffice — they'd need HDL Coder workflow or a second module.

6. **Future enhancement**: Add a `workflowType` field to the configurator (`'configurable' | 'hdl-coder'`) and surface config package channel limits as hard gates for configurable-workflow proposals.
