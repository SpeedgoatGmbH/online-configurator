# Speedgoat FPGA I/O Module Architecture — Systems Engineering Analysis

**Document Version:** 1.0  
**Date:** 2026-03-01  
**Author:** Systems Engineering Review  
**Scope:** Logic cells (FPGA), Analog front-end, Configuration Files (bitstreams/code modules), and I/O Interface Extensions  
**Source Documentation:** Speedgoat I/O Blockset v9.11.1.1 for R2025b

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Module Taxonomy and Descriptions](#2-module-taxonomy-and-descriptions)
3. [Logical Consistency Assessment](#3-logical-consistency-assessment)
4. [Signal Flow Analysis](#4-signal-flow-analysis)
5. [Configurability Analysis](#5-configurability-analysis)
6. [Interaction Matrix](#6-interaction-matrix)
7. [Potential Issues and Gaps](#7-potential-issues-and-gaps)
8. [Recommendations](#8-recommendations)
9. [Appendix: Module Reference Tables](#9-appendix-module-reference-tables)

---

## 1. Executive Summary

The Speedgoat I/O ecosystem is organized around **four interacting layers** that together deliver signal acquisition, generation, and protocol handling on real-time target machines:

| Layer | Documentation Label | Function |
|-------|-------------------|----------|
| **FPGA Logic** | "Logic cells" (25k–930k) | Programmable fabric executing code modules or user HDL |
| **Analog Front-End** | "Analog" (ADC/DAC subsystems on IO32x/33x/34x) | Signal conditioning, A/D and D/A conversion |
| **Configuration Files** | "Configuration Files (code modules)" / bitstreams | Compiled FPGA images defining pin mapping + protocols |
| **I/O Interface Extensions** | "-21/-22/-24/-40/-120" | Rear-to-front signal conditioning, voltage level shifting |

The architecture is **logically consistent and functionally sound**. The FPGA acts as the central programmable bus: configuration files define *what* it does, the analog subsystem provides *physical conversion*, and interface extensions provide *electrical adaptation*. The documentation cleanly separates these four concerns, though some cross-layer interaction details require the reader to combine information from multiple pages.

---

## 2. Module Taxonomy and Descriptions

### 2.1 FPGA Logic Layer

Every IO3xx module contains an FPGA chip whose size is measured in **logic cells** (abbreviated "k"). The FPGA is the computational core that:

- Implements digital protocols (SPI, I2C, PWM, Quadrature, etc.) via loaded **code modules**
- Routes signals between physical I/O pins and the PCIe host interface
- Manages timing, DMA, and interrupt generation
- Optionally runs user-designed HDL (Simulink-programmable modules only)

**Two distinct FPGA personality types exist:**

| Type | Modules | FPGA Size | User HDL | Config Files |
|------|---------|-----------|----------|-------------|
| **Configurable** | IO306–IO309, IO316–IO318, IO322–IO323, IO331, IO391–IO394 | 25k–150k | No | Yes (Speedgoat-authored) |
| **Simulink-Programmable** | IO324–IO325, IO332–IO337, IO360–IO361, IO397 | 50k–930k | Yes (HDL Coder™) | Yes (also accepts user bitstreams) |

**Key distinction:** Configurable modules accept only Speedgoat-supplied bitstreams. Simulink-programmable modules accept both Speedgoat bitstreams AND user-generated HDL through MathWorks HDL Coder™, enabling custom FPGA logic at MHz-class closed-loop rates.

**Internal FPGA structure** (as inferred from Setup block documentation):
```
┌─────────────────────────────────────────────────┐
│  FPGA Fabric (Logic Cells)                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ Code Mod 1│ │ Code Mod 2│ │ Code Mod N│     │
│  │ (e.g. PWM)│ │ (e.g. SPI)│ │ (e.g. ADC)│     │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘     │
│        │              │              │           │
│  ┌─────┴──────────────┴──────────────┴─────┐    │
│  │        Internal Bus / Pin Mux           │    │
│  └────┬────────┬────────┬────────┬─────────┘    │
│       │        │        │        │              │
│  ┌────┴───┐┌───┴──┐┌────┴──┐┌───┴────┐         │
│  │PCIe DMA││DigIO ││ ADC   ││ DAC    │         │
│  │to Host ││Pins  ││Bridge ││Bridge  │         │
│  └────────┘└──────┘└───────┘└────────┘         │
└─────────────────────────────────────────────────┘
```

### 2.2 Analog Front-End Layer

Analog functionality is **not a standalone module** but rather a subsystem physically integrated onto certain FPGA boards or attached via add-on interfaces. Three delivery mechanisms exist:

| Mechanism | Modules | Analog Channels | Notes |
|-----------|---------|----------------|-------|
| **On-board ADC/DAC** | IO322, IO323, IO324, IO325, IO334, IO336, IO337, IO397 | 4–32 AI, 4–32 AO | Integrated on the FPGA carrier board |
| **IO33X-5/6/7/8 Interfaces** | IO331, IO332, IO333 (via front plug-in) | 2–16 AI, 8–16 AO | Plug-in daughter boards for HDL FPGA modules |
| **-120 Extension** | Any IO3xx with rear LVCMOS | 16 AI + 16 AO | Rear-to-front analog extension board |

**Analog driver blocks** in Simulink consist of three components:
1. **Analog Setup v1** — Configures ADC/DAC parameters, trigger mode, sample rate, channel groups
2. **Analog Input v1** — Reads digitized samples from ADC channels
3. **Analog Output v1** — Writes digital values to DAC channels

**Trigger modes** for ADC (documented per IO324, IO334, IO336, IO337):
- **Model Step** — Synchronous: ADC triggered each Simulink step, driver waits for conversion
- **I/O Module Clock** — Free-running at configurable sample rate (asynchronous to model)
- **I/O Module Internal Signal** — Triggered by an internal FPGA signal (e.g., PWM edge)
- **I/O Module Digital I/O** — Triggered by a digital pin transition
- **Read Previous Step** — Pipelined: reads last-step data, triggers new conversion (lowest latency)

### 2.3 Configuration Files Layer (Bitstreams / Code Modules)

A **configuration file** is a compiled FPGA bitstream (`.mat` archive) that defines:
1. **Pin mapping** — Which physical I/O pins are assigned to which protocol
2. **Code modules** — Which functional blocks are instantiated in the FPGA
3. **Channel allocation** — How many channels of each type are available

Configuration files are loaded via the **IO3xx Setup** block in Simulink. The `Configuration File (Bitstream)` parameter selects which `.mat` file to flash to the FPGA at deployment time.

**18 supported code module functionalities:**

| Protocol | Type | Typical Applications |
|----------|------|---------------------|
| Analog | ADC/DAC | Signal acquisition, waveform generation |
| BiSS | Digital sensor | Absolute encoder communication |
| Cam and Crank | Engine simulation | Automotive ECU testing |
| CMU Emulation | BMS testing | Battery cell measurement unit emulation |
| Digital | Logic I/O | General-purpose digital read/write |
| DMA Controller | System | Reduce task execution time via DMA triggers |
| Dshot | Motor protocol | Drone/ESC motor control |
| EnDat | Encoder | Bidirectional encoder interface |
| I2C | Communication | Low-speed peripheral bus |
| Interrupt | System | Change-of-state model triggering |
| PWM | Motor/power | Inverter gate drives, servo control |
| Pulse Counter | Measurement | Speed/frequency measurement |
| Quadrature | Position | Incremental encoder decoding/emulation |
| Resolver | Position | Resolver emulation and measurement |
| SENT | Automotive | SAE J2716 sensor protocol |
| Serial (UART) | Communication | General serial peripherals |
| SPI | Communication | High-speed peripheral bus |
| SSI | Industrial | Synchronous serial position sensors |

**Two delivery models:**
1. **Custom configuration files** — Tailored by Speedgoat for a specific application. Customer specifies functionalities, channel counts, and pin mapping.
2. **IO Configuration Packages** — Pre-built, off-the-shelf bundles optimized for common use cases (RCP, HIL, Communication). Available for IO306, IO307, IO324, IO334, IO336, IO337, IO397, and Pulse I/O.

### 2.4 I/O Interface Extensions Layer

Interface extensions are **signal conditioning daughter boards** that attach to the rear LVCMOS I/O lines of a configurable FPGA module and provide front-panel accessible connectivity:

| Extension | Signal Conversion | Physical Function |
|-----------|------------------|-------------------|
| **-21** | LVCMOS → 3.3V/5V TTL | Standard digital front I/O |
| **-22** | LVCMOS → RS422/RS485 + TTL | Differential + single-ended digital |
| **-24** | LVCMOS → Resolver-to-Digital + RS422/TTL | Resolver interface + digital |
| **-40** | LVCMOS → A2B (AD2433) | Automotive Audio Bus nodes |
| **-120** | LVCMOS → 16 AI + 16 AO | Full analog extension (ADC+DAC) |

These are **interchangeable** per module — the same IO324-200k FPGA board can be paired with a -21, -22, -24, or -120 extension depending on the application domain.

---

## 3. Logical Consistency Assessment

### 3.1 Layer Separation — PASS ✓

The documentation maintains a clean four-layer hierarchy:
```
Physical I/O ← [Interface Extension] ← [Analog Front-End] ← [FPGA Logic + Code Modules] → [PCIe to Host]
                        -21/-22/-24                 ADC/DAC              Configuration File
```

Each layer has distinct responsibilities:
- **Extensions** handle electrical level shifting only (no protocol knowledge)
- **Analog** handles A/D and D/A conversion only (no protocol knowledge)
- **Code modules** handle protocol logic only (no electrical knowledge)
- **FPGA fabric** provides the routing and computational substrate

### 3.2 Module ID Binding — PASS ✓

The documentation is explicit that the **Module ID** parameter creates a **logical binding** between:
- The IO3xx Setup block (which identifies the physical FPGA board and loads the bitstream)
- All code module blocks (PWM, SPI, Analog, etc.) targeting that FPGA

This is functionally analogous to a hardware address / resource binding pattern. The `speedgoat.getIoInterfaces` API provides runtime discovery of installed modules and their assigned IDs.

### 3.3 Configurable vs. Simulink-Programmable — PASS with NOTE

The documentation clearly distinguishes these two personality types and marks them with an "X" column in the Configurable I/O reference table. However, the naming convention `IO3xx` is shared across both types, which could cause confusion. The logic cells count is the primary differentiator:

- ≤150k logic cells → Generally configurable-only
- ≥160k logic cells → Generally Simulink-programmable
- **Exception:** IO397 (50k) is marked Simulink-programmable despite having only 50k cells

### 3.4 FPGA Consolidation Logic — PASS ✓

The `fpgaFamily` field correctly groups catalog entries sharing the same physical FPGA board. For example, an IO324 appearing under `digital/pwm`, `motion/encoder`, and `custom/gen_purpose` all share `fpgaFamily: 'IO324'`, meaning the simulator's consolidation logic correctly merges them onto one physical board rather than recommending three separate boards.

### 3.5 Interface Board Auto-Addition — PASS ✓

Every FPGA module in the catalog now has an explicit `interfaceBoard` mapping. The simulator's `addFpgaInterfaceBoards()` function automatically injects the companion board (e.g., IO324-21) whenever an FPGA module is recommended. This correctly models the physical requirement that FPGA boards need a front-panel interface board for external connectivity.

---

## 4. Signal Flow Analysis

### 4.1 Complete Signal Path: Analog Input

```
External Signal (Voltage/Current)
       │
       ▼
┌──────────────┐
│ I/O Extension│ -21: TTL level shift
│ or Terminal  │ -22: RS422 differential
│ Board        │ -24: Resolver-to-Digital
│              │ -120: 16-bit ADC (1.5 MSPS)
└──────┬───────┘
       │ LVCMOS (rear)  ─or─  Differential (on-board)
       ▼
┌──────────────┐
│ ADC Subsystem│ On-board: IO324 (32 SE/16 DF AI, 125kHz–1MHz)
│              │          IO325 (8 DF AI, 1.5 MSPS)
│              │          IO334 (16 DF AI, 5 MSPS)
│              │          IO336 (16 DF AI, 1.5 MSPS)
│              │          IO337 (8 DF AI, 5 MSPS)
│              │          IO397 (4 AI, 200 kSPS)
│              │ Plug-in: IO33X-5 (2 AI, 105 MHz)
│              │          IO33X-6 (16 AI, 500 kHz)
│              │ Extension: -120 (16 AI, 1.5 MSPS)
└──────┬───────┘
       │ Digital samples (16-bit)
       ▼
┌──────────────┐
│ FPGA Logic   │ Analog code module reads ADC via internal bus
│ Cells        │ Routes data to PCIe DMA engine
│              │ Trigger: Model Step / Clock / Internal Signal / DIO
└──────┬───────┘
       │ PCIe DMA
       ▼
┌──────────────┐
│ Simulink     │ Analog Input block reads samples
│ Model        │ at model sample time
│ (Host CPU)   │
└──────────────┘
```

### 4.2 Complete Signal Path: Digital Protocol (e.g., PWM)

```
┌──────────────┐
│ Simulink     │ PWM Generation block sets parameters
│ Model        │ (duty cycle, frequency, dead time)
└──────┬───────┘
       │ PCIe register write
       ▼
┌──────────────┐
│ FPGA Logic   │ PWM code module generates waveform
│ (Code Module)│ Internal timing at FPGA clock rate
│              │ Pin Mux routes to assigned I/O pins
└──────┬───────┘
       │ LVCMOS (rear I/O lines)
       ▼
┌──────────────┐
│ I/O Extension│ -21: LVCMOS → 3.3V/5V TTL (front accessible)
│              │ -22: LVCMOS → RS422 differential
└──────┬───────┘
       │
       ▼
  External Load (Motor Driver, Inverter, etc.)
```

### 4.3 Complete Signal Path: Resolver Measurement

```
Resolver Signal (sin/cos analog)
       │
       ▼
┌──────────────┐
│ -24 Extension│ Analog resolver signal → Resolver-to-Digital
│              │ Converter (RDC) chip → Digital position data
│              │ Also provides RS422/TTL for other channels
└──────┬───────┘
       │ Digital (position bits via LVCMOS)
       ▼
┌──────────────┐
│ FPGA Logic   │ Resolver code module reads RDC output
│ (Resolver    │ Computes angle, speed, direction
│  Code Module)│ Sends to host via PCIe
└──────┬───────┘
       │ PCIe
       ▼
┌──────────────┐
│ Simulink     │ Resolver Measurement block
│ Model        │ provides angle/speed outputs
└──────────────┘
```

### 4.4 Configuration File Loading Flow

```
┌─────────────────────┐
│ MATLAB/Simulink     │
│ (Development Host)  │
│                     │
│  IO3xx Setup Block  │──▶ Selects .mat config file
│  ├─ Hardware: IO324 │    (from dropdown or browse)
│  ├─ Module ID: 3    │
│  ├─ PCI Slot: auto  │
│  └─ Config File:    │
│     "IO324_HIL_TTL" │
└─────────┬───────────┘
          │ Build + Deploy
          ▼
┌─────────────────────┐
│ Target Machine      │
│ (Speedgoat RT PC)   │
│                     │
│  PCIe Slot 2        │
│  ┌─────────────┐    │
│  │ IO324 FPGA  │◀── Bitstream flashed from .mat
│  │ 200k cells  │    Defines: pin mapping +
│  │             │    code module instances
│  └─────────────┘    │
└─────────────────────┘
```

---

## 5. Configurability Analysis

### 5.1 Hardware-Level Configuration

| Parameter | Configured Via | Scope |
|-----------|---------------|-------|
| FPGA module selection | Physical installation in PCIe slot | Fixed at purchase |
| I/O interface board (IO33X-N) | Physical plug-in | Fixed at assembly |
| I/O extension (-21/-22/-24/-40/-120) | Physical installation | Changeable (interchangeable) |
| Logic cell count | Module variant (25k/50k/100k/200k/325k/650k) | Fixed per module |

### 5.2 Bitstream-Level Configuration

| Parameter | Configured Via | Scope |
|-----------|---------------|-------|
| Pin mapping | Configuration file selection | Per deployment |
| Code module selection | Configuration file contents | Per deployment |
| Protocol functionality | Code module instances in bitstream | Per deployment |
| Channel allocation | Code module + pin mapping | Per deployment |

### 5.3 Simulink Block-Level Configuration

| Parameter | Configured Via | Scope |
|-----------|---------------|-------|
| Module ID | IO3xx Setup block mask | Per model |
| PCI Slot addressing | IO3xx Setup block (-1 = auto) | Per model |
| ADC trigger mode | Analog Setup block | Per model |
| ADC sample rate | Analog Setup block (Hz) | Per model |
| ADC input mode | Analog Setup block (SE/DF, voltage range) | Per model |
| DAC output range | Analog Setup block | Per model |
| Pull resistors | IO3xx Setup block (per-pin) | Per model |
| I/O voltage levels | IO3xx Setup block | Per model |
| Termination | IO3xx Setup block (per-pin) | Per model |
| DMA interrupt | Analog Setup block | Per model |

### 5.4 Pre-Built Configuration Packages

| Module | Communication | HIL | RCP | TPI6020 | Resolver | Variants |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| IO306 | ✓ | ✓ | ✓ | — | — | — |
| IO307 | ✓ | ✓ | ✓ | — | — | — |
| IO324 | ✓ | ✓ | ✓ | ✓ | ✓ | TTL / RS422 |
| IO334 | ✓ | ✓ | ✓ | — | ✓ | TTL / RS422 |
| IO336 | ✓ | ✓ | ✓ | ✓ | ✓ | TTL / RS422 |
| IO337 | ✓ | ✓ | — | — | — | TTL / RS422 |
| IO397 | ✓ | ✓ | ✓ | ✓ | — | — |
| Pulse I/O | ✓ | ✓ | ✓ | — | ✓ | TTL / RS422 |

**Note:** IO337 lacks RCP packages because it has only 4 LVDS digital channels (insufficient for typical RCP protocol sets). IO397 lacks TTL/RS422 variants because its 14 TTL lines have a fixed configuration.

---

## 6. Interaction Matrix

The following matrix shows which layers interact with each other and through what mechanism:

```
                    FPGA Logic    Analog FE     Config File   I/O Extension
                   ┌─────────────┬─────────────┬─────────────┬─────────────┐
FPGA Logic         │  Internal   │ ADC/DAC     │ Bitstream   │ LVCMOS      │
                   │  bus/mux    │ bridge      │ defines     │ rear pins   │
                   ├─────────────┼─────────────┼─────────────┼─────────────┤
Analog Front-End   │ ADC/DAC     │  Self       │ Analog code │ -120 adds   │
                   │ bridge      │  (channels) │ module req'd│ analog I/O  │
                   ├─────────────┼─────────────┼─────────────┼─────────────┤
Config File        │ Programs    │ Allocates   │  Self       │ Pin mapping │
                   │ logic cells │ ADC triggers│  (bitstream)│ must match  │
                   ├─────────────┼─────────────┼─────────────┼─────────────┤
I/O Extension      │ N/A (pass-  │ -120 feeds  │ Pin mapping │  Self       │
                   │  through)   │ ADC/DAC     │ compatibility│ (electrical)│
                   └─────────────┴─────────────┴─────────────┴─────────────┘
```

**Key interactions:**

1. **Config File ↔ FPGA Logic**: The configuration file IS the FPGA programming. This is the tightest coupling — a bitstream compiled for IO324-200k cannot run on IO336-325k (different FPGA fabric, different pin layout).

2. **Config File ↔ Analog FE**: If a configuration file includes an analog code module (e.g., for IO324's on-board ADC), the Analog Setup block's parameters are partially locked. The documentation states: *"Parameters needing to be set to a specific value will be grayed out."*

3. **FPGA Logic ↔ I/O Extension**: The FPGA drives LVCMOS signals on rear I/O lines. The extension board is purely passive signal conditioning — the FPGA has no awareness of which extension is installed. This makes extensions interchangeable but also means **there is no electrical validation** at the software level.

4. **Config File ↔ I/O Extension**: The pin mapping in the configuration file must be compatible with the installed extension. A configuration using RS422 output pins requires a -22 extension, not a -21. This compatibility is enforced by documentation/naming convention, not by software.

---

## 7. Potential Issues and Gaps

### 7.1 CRITICAL: No Extension-Bitstream Compatibility Validation

**Issue:** There is no documented mechanism for the IO3xx Setup block or the deployment process to verify that the installed I/O extension (-21/-22/-24/-120) matches the pin mapping expectations of the selected configuration file.

**Risk:** A user could deploy a configuration file expecting RS422 differential I/O (e.g., "HIL RS422") with a -21 TTL extension board installed. The FPGA would drive LVCMOS signals, the -21 would convert to TTL, but the external device expects RS422 differential — resulting in signal failure or hardware damage.

**Severity:** High (potential hardware damage)

### 7.2 MODERATE: Analog Code Module Interlock Documentation

**Issue:** The Analog Setup block states that when a code module uses analog I/O, certain parameters are "grayed out." However, the documentation does not enumerate which specific parameters are locked for each code module, nor does it explain what happens if analog channels are shared between a code module and direct analog access.

**Risk:** Users may over-constrain or under-constrain their analog configuration without realizing certain channels are reserved.

**Severity:** Medium (configuration confusion)

### 7.3 MODERATE: Module ID Uniqueness Constraint Ambiguity

**Issue:** The documentation states Module ID must be "unique for each Simulink-programmable and configurable I/O module." However, the example shows two IO334-325k modules with different Module IDs (4 and 1). It is unclear whether the Module ID is:
- Assigned by the system firmware (fixed per slot)
- Assigned by the user in Simulink (arbitrary)
- Auto-detected at runtime

The `speedgoat.getIoInterfaces` output suggests it is firmware-assigned, but the Setup block mask appears to allow user entry.

**Severity:** Medium (setup confusion)

### 7.4 LOW: Missing IO335 from Configurable I/O Table

**Issue:** IO335-325k appears in the Simulink-Programmable FPGA I/O documentation (described as "325k logic cells, 3 differential digital inputs and 24 differential analog inputs") but is absent from the Configurable I/O reference table. This leaves it unclear whether IO335 supports configuration files or is HDL-only.

**Severity:** Low (documentation gap)

### 7.5 LOW: Configuration Package Parity Gaps

**Issue:** Several modules that accept configuration files do not have pre-built IO Configuration Packages:
- IO316/IO317/IO318 (and their -100k variants)
- IO323
- IO331/IO332/IO333
- IO391/IO392/IO393/IO394

These modules can still use custom configuration files, but the lack of off-the-shelf packages increases the barrier to entry.

**Severity:** Low (commercial/documentation gap, not a technical flaw)

### 7.6 LOW: IO309/IO360/IO361 Series Not in Product Catalog

**Issue:** IO309a/b/c (100k), IO360a/b/c (190k), and IO361a/b/c (469k) appear in the Configurable I/O documentation but are absent from the product configurator catalog. Users encountering them in documentation cannot select them in the configurator.

**Severity:** Low (catalog completeness, not architectural)

### 7.7 INFORMATIONAL: configPackages Data Quality

**Issue:** The extracted `configPackages` arrays in the catalog have parsing artifacts:
- `"modules HIL"` should be `"HIL"`
- `"modules RCP"` should be `"RCP"`
- `"modules Resolver TTL"` should be `"Resolver TTL"`

These stem from the extraction pipeline parsing adjacent HTML text nodes.

**Severity:** Informational (data quality, no functional impact yet)

---

## 8. Recommendations

### 8.1 Extension–Bitstream Compatibility Matrix (Priority: HIGH)

Create an explicit compatibility matrix mapping each configuration file to its required I/O extension type. This should be:
- Embedded in the configuration file metadata (`.mat` header)
- Validated at deployment time by the Setup block
- Displayed in the configurator when recommending modules

```
Config File          Required Extension
────────────────────────────────────────
IO324_HIL_TTL        -21 (TTL)
IO324_HIL_RS422      -22 (RS422/RS485)
IO324_Resolver_TTL   -24 (Resolver)
IO336_TPI6020        -21 (TTL)
...
```

### 8.2 Analog Channel Reservation Documentation (Priority: MEDIUM)

For each configuration file that includes analog code modules, document:
- Which ADC/DAC channels are reserved by the code module
- Which Analog Setup parameters are locked and to what values
- Which channels remain available for direct analog access

### 8.3 Module ID Assignment Clarification (Priority: MEDIUM)

Clarify in the IO3xx Setup documentation:
- Whether Module ID is firmware-assigned or user-assigned
- The relationship between Module ID and PCI slot
- Best practices when multiple identical modules are installed

### 8.4 Catalog Completeness (Priority: LOW)

Add the following module families to the product configurator catalog for complete coverage:
- IO309a/b/c (100k) — successors to IO306/307/308
- IO360a/b/c (190k) — PCIe FPGA series
- IO361a/b/c (469k) — Large PCIe FPGA series  
- IO333-410k — Larger variant of IO333
- IO322 — Mixed analog+digital (45k, predecessor to IO323)

### 8.5 Configuration Package Expansion (Priority: LOW)

Consider creating IO Configuration Packages for the most commonly deployed configurable-only modules (IO316, IO317, IO318, IO323) to improve out-of-box usability.

### 8.6 Clean configPackages Data (Priority: LOW)

Fix parsing artifacts in the catalog's `configPackages` arrays to ensure clean display in the configurator UI.

---

## 9. Appendix: Module Reference Tables

### 9.1 FPGA Module Specifications

| Module | Logic Cells | Digital I/O | Analog AI | Analog AO | Sim-Prog | Form |
|--------|:-----------:|:-----------:|:---------:|:---------:|:--------:|:----:|
| IO306 | 25k | 64 TTL | — | — | No | PMC |
| IO307 | 25k | 32 TTL + 16 RS422 | — | — | No | PMC |
| IO308 | 25k | 32 RS422 | — | — | No | PMC |
| IO316 | 45k | 64 TTL | — | — | No | XMC |
| IO317 | 45k | 32 TTL + 16 RS422 | — | — | No | XMC |
| IO318 | 45k | 32 RS422 | — | — | No | XMC |
| IO322 | 45k | 42 TTL | 32/16 | 8 | No | XMC |
| IO323 | 100k | 42 TTL | 32/16 | 8 | No | XMC |
| IO324 | 200k | 32 TTL (16 RS422) | 32/16 | 8 | **Yes** | XMC |
| IO325 | 160k | 32 TTL (16 RS422) | 8 DF | 4 | **Yes** | mPCIe |
| IO331 | 150k | IO33X plug-in | IO33X | IO33X | No | XMC |
| IO332 | 200k | IO33X plug-in | IO33X | IO33X | **Yes** | XMC |
| IO333 | 325k/410k | IO33X plug-in | IO33X | IO33X | **Yes** | XMC |
| IO334 | 325k | — | 16 DF | 16 | **Yes** | XMC |
| IO335 | 325k | 3 DF input | 24 DF | — | **Yes** | XMC |
| IO336 | 325k | 32 TTL (16 RS422) | 16 DF | 8 | **Yes** | XMC |
| IO337 | 650k | 4 LVDS | 8 DF | 32 | **Yes** | XMC |
| IO391 | 50k | 26 TTL | — | — | No | mPCIe |
| IO392 | 50k | 13 RS422 DF | — | — | No | mPCIe |
| IO393 | 50k | 6 DF + 14 TTL | — | — | No | mPCIe |
| IO394 | 50k | 13 LVDS DF | — | — | No | mPCIe |
| IO397 | 50k | 14 TTL | 4 | 4 | **Yes** | mPCIe |

### 9.2 I/O Interface Extensions Compatibility

| Extension | Signal Type | Compatible With | Use Case |
|-----------|-----------|----------------|----------|
| -21 | 3.3V/5V TTL | All IO3xx with rear LVCMOS | Standard digital I/O |
| -22 | RS422/RS485 + TTL | All IO3xx with rear LVCMOS | Differential comm + digital |
| -24 | Resolver-to-Digital + RS422/TTL | All IO3xx with rear LVCMOS | Motor/position (resolver) |
| -40 | A2B (AD2433) | All IO3xx with rear LVCMOS | Automotive audio/sensor bus |
| -120 | 16 AI + 16 AO (16-bit) | All IO3xx with rear LVCMOS | Analog extension (1.5 MSPS) |

### 9.3 Code Module → Module Compatibility

| Code Module | IO306 | IO307 | IO324 | IO334 | IO336 | IO337 | IO397 |
|-------------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| Analog | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| PWM | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SPI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| I2C | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Serial | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quadrature | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| SSI | — | ✓ | ✓ | ✓ | ✓ | — | — |
| BiSS | — | ✓ | ✓ | ✓ | ✓ | — | — |
| EnDat | — | ✓ | ✓ | ✓ | ✓ | — | — |
| Resolver | — | — | ✓ | ✓ | ✓ | — | — |
| TPI6020 | — | — | ✓ | — | ✓ | — | ✓ |

*(Table derived from IO Configuration Package availability — custom files may expand compatibility)*

---

**End of Analysis**
