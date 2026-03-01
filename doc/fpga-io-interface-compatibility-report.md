# Speedgoat FPGA I/O Module — Interface & Extension Compatibility Report

**Source:** Speedgoat I/O Blockset v9.11.1.1 for R2025b (crawled HTML documentation)  
**Date:** Generated from `crawl-output-docs/pages/help/slrt/page/io_main/`

---

## Table of Contents

1. [Extension Compatibility per FPGA Module](#1-extension-compatibility-per-fpga-module)
2. [IO33X Board Compatibility](#2-io33x-board-compatibility)
3. [Pin Mapping Details for Each Extension](#3-pin-mapping-details-for-each-extension)
4. [Module-Specific Interface Notes](#4-module-specific-interface-notes)
5. [IO33X Front Boards vs. I/O Interface Extensions](#5-io33x-front-boards-vs-io-interface-extensions)

---

## 1. Extension Compatibility per FPGA Module

### Key Architectural Finding

The documentation states: *"The number and the type of selectable extensions depends on the configuration file."* This means extension compatibility is driven by the **bitstream/configuration file**, not statically by the module hardware. However, only modules with rear LVCMOS I/O lines can physically accept extensions. The ref pages explicitly link to "I/O interface extensions pin mapping" only for qualifying modules.

### Extension Compatibility Matrix

| FPGA Module | Logic Cells | Form | Supports Extensions | Rear LVCMOS Lines | Evidence |
|-------------|:-----------:|:----:|:-------------------:|:-----------------:|----------|
| **IO316** | 45k / 100k | XMC | Yes | 64 TTL | Has Setup block with Extension Selection param |
| **IO317** | 45k / 100k | XMC | Yes | 32 TTL + 16 RS422 | Has Setup block with Extension Selection param |
| **IO324** | 200k | XMC | **Yes** | 32 TTL (16 as RS422/485) | Ref page links to extension pin mapping |
| **IO325** | 160k | mPCIe | **Yes** | 32 TTL (16 as RS422/485) | Ref page links to extension pin mapping |
| **IO332** | 200k | XMC | **Yes** | Via IO33X plug-in | Ref page links to extension pin mapping |
| **IO333** | 325k/410k | XMC | **Yes** | Via IO33X plug-in | Ref page links to extension pin mapping |
| **IO334** | 325k | XMC | **Yes** | — (analog-focused) | Ref page links to extension pin mapping |
| **IO336** | 325k | XMC | **Yes** | 32 TTL (16 as RS422/485) | Ref page links to extension pin mapping |
| **IO337** | 650k | XMC | **Yes** | 4 LVDS | Ref page links to extension pin mapping |
| **IO391** | 50k | mPCIe | **No** | 26 TTL (front only) | No extension link on ref page |
| **IO392** | 50k | mPCIe | **No** | 13 RS422 DF | No extension link on ref page |
| **IO393** | 50k | mPCIe | **No** | 6 DF + 14 TTL (front only) | No extension link on ref page |
| **IO394** | 50k | mPCIe | **No** | 13 LVDS DF | No extension link on ref page |
| **IO397** | 50k | mPCIe | **No** | 14 TTL (front only) | No extension link on ref page |

### Available Extensions

| Extension | Signal Type | Front-Panel I/O |
|-----------|-----------|-----------------|
| **-21** | TTL (3.3V / 5V) | 56 TTL I/O lines (7 groups of 8) |
| **-22** | RS422/RS485 + TTL | 16 differential RS422/485 + 24 TTL lines |
| **-24** | Resolver-to-Digital + RS422/TTL | 2 RDC channels + configurable digital (RS422 or TTL) |
| **-40** | A2B (AD2433) | 4 A2B bus connections (2 upstream + 2 downstream) |
| **-120** | Analog (16-bit ADC/DAC) | 16 AI (1.5 MSPS) + 16 AO (10 MSPS) |

### Important Notes

- **No software-level validation** exists between the selected configuration file and the physically installed extension. Mismatch can cause signal failure or hardware damage.
- Extension selection for modules with the Setup block parameter "I/O Interface Extension Selection" presents a dropdown whose options depend on which `.mat` configuration file is loaded.
- Compact mPCIe modules (IO391–IO394, IO397) have front-accessible I/O pins directly and **do not** support rear extensions.

---

## 2. IO33X Board Compatibility

### IO33X Boards Overview

IO33X boards are **front plug-in daughter boards** that provide front-panel I/O connectivity for "bare" FPGA modules that have no on-board front I/O. They plug into the IO33X module series (IO331, IO332, IO333).

### IO33X Board Specifications

| Board | Type | Front I/O Lines | Description |
|-------|------|:---------------:|-------------|
| **IO33X-1-LV** | Digital | 64 LVTTL (3.3V) | 68-pin connector; pins 3–34 (LVTTL) + 37–68 (LVTTL); pins 1–2: +5V/+3.3V; pins 35–36: Ground |
| **IO33X-2** | Digital | 30 RS422/RS485 differential | 68-pin connector; differential pairs across pins 2–33(+) / 36–67(−); ground pins at 1, 12, 23, 34, 35, 46, 57, 68 |
| **IO33X-3** | Mixed Digital | 16 CMOS + 22 RS422/RS485 | 68-pin; CMOS pins 2–9 / 36–43; RS422 on pins 10–33(+) / 44–67(−) |
| **IO33X-4** | Digital | 30 LVDS differential | 68-pin; LVDS pairs across pins 2–33(+) / 36–67(−); ground at 1, 12, 23, 34, 35, 46, 57, 68 |
| **IO33X-5** | Analog Input | 2 AI (105 MHz, 16-bit) | SMA/micro connector; 2 simultaneous differential analog inputs + 1 GPIO TTL |
| **IO33X-6** | Mixed Analog | 16 AI + 8 AO + 16 DIO | 68-pin; 16× 16-bit 500kHz A/D (diff, pins 19–34/53–68), 8× 16-bit D/A (pins 44–51), 16× TTL (pins 2–9/35–43) |
| **IO33X-7** | Analog Output | 16 AO (16-bit, 2µs settling) | 68-pin; AO pins 1–16; pins 35–50: Ground; pins 17–34 & 51–66: Reserved; ±10V |
| **IO33X-8** | Analog Output | 8 AO (16-bit, 2µs settling) | 68-pin; AO pins 1–8; pins 35–42: Ground; remaining: Reserved; ±10V |

### IO33X ↔ Module Compatibility Matrix

| Module | IO33X-1-LV | IO33X-2 | IO33X-3 | IO33X-4 | IO33X-5 | IO33X-6 | IO33X-7 | IO33X-8 |
|--------|:----------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|
| **IO331** (150k, Configurable) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **IO332** (200k, Sim-Prog) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **IO333** (325k/410k, Sim-Prog) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| All other modules | — | — | — | — | — | — | — | — |

**Note:** IO33X boards are listed in documentation under `Configurable I/O > I/O Interfaces` and their ref pages carry links specifically to IO331/IO332/IO333. No other module supports IO33X plug-in boards.

---

## 3. Pin Mapping Details for Each Extension

### 3.1 Extension -21 (TTL)

**Description:** 56 TTL I/O lines in 7 groups of 8, accessible via a 68-pin front connector.

| Pin Range | Signal | Transceiver |
|-----------|--------|-------------|
| 1–8 (Group 1) | Configurable I/O | TTL |
| 10–17 (Group 2) | Configurable I/O | TTL |
| 19–26 (Group 3) | Configurable I/O | TTL |
| 28–35 (Group 4) | Configurable I/O | TTL |
| 37–44 (Group 5) | Configurable I/O | TTL |
| 46–53 (Group 6) | Configurable I/O | TTL |
| 55–62 (Group 7) | Configurable I/O | TTL |

| Special Pins | Function |
|-------------|----------|
| 9, 26, 43, 60 | Ground |
| 61–66 | Reserved |
| 67 | +5V supply (200mA max) |
| 68 | +5V supply (200mA max) |

### 3.2 Extension -22 (RS422/RS485 + TTL)

**Description:** 16 differential RS422/RS485 lines + 24 TTL lines.

| Pin Range | Signal | Transceiver |
|-----------|--------|-------------|
| 1–17 (odd bank) | RS422/RS485 positive (+) | RS422/RS485 |
| 35–51 (even bank) | RS422/RS485 negative (−) | RS422/RS485 |
| Port 1 (8 lines) | Configurable TTL I/O | TTL |
| Port 2 (8 lines) | Configurable TTL I/O | TTL |
| Port 3 (8 lines) | Configurable TTL I/O | TTL |

**16 differential pairs** are formed from pins on the (+) bank paired with the corresponding (−) bank pin.

### 3.3 Extension -24 (Resolver)

**Description:** 2 Resolver-to-Digital Converters + configurable digital I/O.

| Component | Pins (+) | Pins (−) | Function |
|-----------|----------|----------|----------|
| **RDC 1** | 32–34 | 66–68 | Cosine+/−, Sine+/−, Excitation+/− |
| **RDC 2** | 28–30 | 62–64 | Cosine+/−, Sine+/−, Excitation+/− |

Additional I/O:
- **Configurable digital:** Can be RS422/RS485 **or** TTL (depends on variant)
- **TTL lines:** 24–40 TTL I/O (depending on RS422/TTL allocation)
- Direction configurable on a per-group basis

### 3.4 Extension -40 (A2B)

**Description:** Automotive Audio Bus (A2B) using AD2433 transceiver.

| Connector | Function | Bus |
|-----------|----------|-----|
| **A1** | A2B1 Upstream | Primary A2B bus 1 |
| **B1** | A2B1 Downstream | Primary A2B bus 1 |
| **A2** | A2B2 Upstream | Primary A2B bus 2 |
| **B2** | A2B2 Downstream | Primary A2B bus 2 |

A second -40 extension provides A2B3 and A2B4 connections (buses 3 and 4).

### 3.5 Extension -120 (Analog)

**Description:** 16-bit analog I/O extension for modules without on-board analog front-end.

| Pin Range | Signal | Spec |
|-----------|--------|------|
| 1–17 (+), 35–51 (−) | 16× 16-bit ADC inputs (differential) | Up to 1.5 MSPS simultaneous sampling |
| 18–34 | 16× 16-bit DAC outputs (single-ended) | Up to 10 MSPS |

This extension effectively adds an analog front-end to modules like IO316, IO317, IO332, IO333 that have no on-board ADC/DAC.

---

## 4. Module-Specific Interface Notes

### 4.1 Simulink-Programmable Modules (accept user HDL via HDL Coder)

#### IO324-200k
- **I/O:** 32 TTL (16 configurable as RS422/RS485), 32 SE / 16 DF analog inputs (125kHz–1MHz), 8 analog outputs
- **On-board analog:** Yes (dedicated Analog Setup block with trigger modes: Model Step, Clock, External Trigger, Digital Input)
- **Extension support:** Yes — Setup block has "I/O Interface Extension Selection" parameter
- **Config packages:** Communication, HIL, RCP, TPI6020, Resolver (TTL/RS422 variants)
- **Note:** The most versatile Simulink-programmable module for mixed-signal applications

#### IO325-160k
- **I/O:** 32 TTL (16 as RS422/RS485), 8 differential analog inputs (1.5 MSPS), 4 analog outputs
- **On-board analog:** Yes
- **Extension support:** Yes
- **Form factor:** mPCIe (compact)
- **Note:** Compact alternative to IO324 with fewer analog channels but still full programmability

#### IO332-200k
- **I/O:** No on-board front I/O — requires IO33X plug-in board
- **Extension support:** Yes (via rear LVCMOS) + IO33X (via front plug-in)
- **Config packages:** Limited (no pre-built packages in documentation)
- **Note:** The flexible "blank FPGA" — use IO33X boards for front I/O, extensions for rear I/O

#### IO333-325k / IO333-410k
- **I/O:** No on-board front I/O — requires IO33X plug-in board
- **Extension support:** Yes + IO33X
- **Note:** Same architecture as IO332 but with more logic cells (325k or 410k)

#### IO334-325k
- **I/O:** No on-board digital I/O; 16× 16-bit differential analog inputs (5 MSPS), 16× 16-bit analog outputs
- **Extension support:** Yes
- **Config packages:** Communication, HIL, RCP, Resolver (TTL/RS422 variants)
- **Note:** Analog-heavy module with high sample rates; extensions add digital I/O

#### IO336-325k
- **I/O:** 32 TTL (16 as RS422/RS485), 16 differential analog inputs (1.5 MSPS), 8 analog outputs
- **Extension support:** Yes
- **Config packages:** Communication, HIL, RCP, TPI6020, Resolver (TTL/RS422 variants)
- **Note:** Most complete mixed-signal module with both digital and analog on a single board

#### IO337-650k
- **I/O:** 4 LVDS digital channels, 8 differential analog inputs (5 MSPS), 32 analog outputs
- **Extension support:** Yes
- **Config packages:** Communication, HIL (no RCP — too few digital channels)
- **Note:** Highest logic cell count; optimized for high-channel-count analog output applications

#### IO397-50k
- **I/O:** 14 TTL, 4 analog inputs (200 kSPS), 4 analog outputs
- **Extension support:** **No** (no extension link on ref page)
- **Config packages:** Communication, HIL, RCP, TPI6020
- **Form factor:** mPCIe
- **Note:** Exception — despite being Simulink-programmable, it does NOT support extensions (compact form factor, fixed I/O)

### 4.2 Configurable-Only Modules (Speedgoat-authored bitstreams only)

#### IO316 (45k / 100k variants)
- **I/O:** 64 TTL lines (same architecture as legacy IO306)
- **Extension support:** Yes (Setup block has Extension Selection)
- **Form factor:** XMC

#### IO317 (45k / 100k variants)
- **I/O:** 32 TTL + 16 RS422 lines (same architecture as legacy IO307)
- **Extension support:** Yes (Setup block has Extension Selection)
- **Form factor:** XMC

#### IO391-50k
- **I/O:** 26 ESD-protected TTL lines (front only)
- **Extension support:** **No**
- **Form factor:** mPCIe

#### IO392-50k
- **I/O:** 13 RS422 differential pairs (front only)
- **Extension support:** **No**
- **Form factor:** mPCIe

#### IO393-50k
- **I/O:** 6 differential digital + 14 TTL lines (front only)
- **Extension support:** **No**
- **Form factor:** mPCIe

#### IO394-50k
- **I/O:** 13 LVDS differential pairs (front only)
- **Extension support:** **No**
- **Form factor:** mPCIe

### 4.3 Setup Block Common Parameters

All modules with a Setup block share these parameters:
- **Module ID** — Unique ID per configurable/Simulink-programmable module
- **PCI Slot** — `-1` for auto-detect or specific slot number
- **Configuration file** — `.mat` file defining the FPGA bitstream
- **I/O Interface Extension Selection** — Dropdown (options depend on config file)
- **Pull resistors** — Per-pin pull-up/pull-down (where applicable)
- **I/O voltage levels** — Per-pin (where applicable)
- **Termination** — Per-pin (where applicable)

---

## 5. IO33X Front Boards vs. I/O Interface Extensions

### Fundamental Difference

| Aspect | IO33X Front Boards | I/O Interface Extensions |
|--------|-------------------|------------------------|
| **Connection point** | Front plug-in slot on the FPGA module | Rear LVCMOS lines of the FPGA module |
| **Compatible modules** | IO331, IO332, IO333 **only** | IO316, IO317, IO324, IO325, IO332, IO333, IO334, IO336, IO337 |
| **Physical installation** | Plugs into front daughter board slot | Attaches to rear I/O connector |
| **Signal path** | Direct FPGA ↔ IO33X board front panel | FPGA rear LVCMOS → Extension → Front panel |
| **Signal types available** | Digital (TTL, RS422, LVDS) and Analog (ADC, DAC) | Digital (TTL, RS422, Resolver) and Analog (ADC/DAC via -120) |
| **Number of options** | 8 boards (IO33X-1-LV through IO33X-8) | 5 extensions (-21, -22, -24, -40, -120) |
| **Simultaneous use** | One IO33X board per module slot | One extension per rear connector; can coexist with IO33X |

### Can Both Be Used Simultaneously?

**Yes.** For IO332 and IO333, both an IO33X front board AND a rear I/O interface extension can be installed simultaneously. This provides:
- **Front panel:** I/O defined by the IO33X board (e.g., IO33X-6 for 16 AI + 8 AO + 16 DIO)
- **Rear panel:** Additional I/O defined by the extension (e.g., -21 for 56 TTL lines)

This combination maximizes I/O density on a single FPGA module.

### Decision Guide

```
Do you need analog front-end I/O?
├─ YES → Does the module have on-board analog?
│   ├─ YES (IO324, IO325, IO334, IO336, IO337, IO397) → Use on-board analog
│   └─ NO (IO316, IO317, IO332, IO333) → 
│       ├─ IO332/IO333 → Use IO33X-5 (2 AI, 105MHz) or IO33X-6 (16 AI + 8 AO)
│       │                 or IO33X-7/8 (AO only)
│       │                 AND/OR -120 extension (16 AI + 16 AO via rear)
│       └─ IO316/IO317 → Use -120 extension (rear)
│
Do you need digital I/O signal conditioning?
├─ TTL (3.3V/5V) → 
│   ├─ Front board: IO33X-1-LV (64 LVTTL, IO331/332/333 only)
│   └─ Extension: -21 (56 TTL via rear)
├─ RS422/RS485 → 
│   ├─ Front board: IO33X-2 (30 RS422, IO331/332/333 only)
│   └─ Extension: -22 (16 RS422 + 24 TTL via rear)
├─ LVDS → 
│   └─ Front board: IO33X-4 (30 LVDS, IO331/332/333 only)
├─ Mixed CMOS + RS422 → 
│   └─ Front board: IO33X-3 (16 CMOS + 22 RS422, IO331/332/333 only)
│
Do you need resolver measurement?
└─ YES → Extension: -24 (2 Resolver-to-Digital converters via rear)
│
Do you need A2B (automotive audio bus)?
└─ YES → Extension: -40 (4 A2B bus connections via rear)
```

### IO33X Boards by Category

| Category | Boards | Signal Type |
|----------|--------|-------------|
| **Digital Only** | IO33X-1-LV, IO33X-2, IO33X-3, IO33X-4 | TTL, RS422, CMOS, LVDS |
| **Analog Input** | IO33X-5 | 2× 105 MHz 16-bit AI |
| **Mixed Analog + Digital** | IO33X-6 | 16 AI + 8 AO + 16 DIO |
| **Analog Output Only** | IO33X-7 (16 AO), IO33X-8 (8 AO) | 16-bit DAC, ±10V |

### Extensions by Category

| Category | Extensions | Signal Type |
|----------|-----------|-------------|
| **Digital** | -21 (TTL), -22 (RS422+TTL) | Level-shifted digital |
| **Sensor Interface** | -24 (Resolver) | Resolver-to-Digital + digital |
| **Communication Bus** | -40 (A2B) | AD2433 automotive bus |
| **Analog** | -120 (ADC/DAC) | 16 AI + 16 AO, 16-bit |

---

## Appendix A: Complete Module Specifications Reference

| Module | Logic Cells | Digital I/O | Analog AI | Analog AO | Sim-Prog | IO33X | Extensions | Form |
|--------|:-----------:|:-----------:|:---------:|:---------:|:--------:|:-----:|:----------:|:----:|
| IO306 | 25k | 64 TTL | — | — | No | No | Yes | PMC |
| IO307 | 25k | 32 TTL + 16 RS422 | — | — | No | No | Yes | PMC |
| IO308 | 25k | 32 RS422 | — | — | No | No | Yes | PMC |
| IO316 | 45k/100k | 64 TTL | — | — | No | No | Yes | XMC |
| IO317 | 45k/100k | 32 TTL + 16 RS422 | — | — | No | No | Yes | XMC |
| IO318 | 45k | 32 RS422 | — | — | No | No | Yes | XMC |
| IO322 | 45k | 42 TTL | 32/16 | 8 | No | No | Yes | XMC |
| IO323 | 100k | 42 TTL | 32/16 | 8 | No | No | Yes | XMC |
| IO324 | 200k | 32 TTL (16 RS422) | 32/16 | 8 | **Yes** | No | **Yes** | XMC |
| IO325 | 160k | 32 TTL (16 RS422) | 8 DF | 4 | **Yes** | No | **Yes** | mPCIe |
| IO331 | 150k | IO33X plug-in | IO33X | IO33X | No | **Yes** | Yes | XMC |
| IO332 | 200k | IO33X plug-in | IO33X | IO33X | **Yes** | **Yes** | **Yes** | XMC |
| IO333 | 325k/410k | IO33X plug-in | IO33X | IO33X | **Yes** | **Yes** | **Yes** | XMC |
| IO334 | 325k | — | 16 DF | 16 | **Yes** | No | **Yes** | XMC |
| IO335 | 325k | 3 DF input | 24 DF | — | **Yes** | No | **Yes** | XMC |
| IO336 | 325k | 32 TTL (16 RS422) | 16 DF | 8 | **Yes** | No | **Yes** | XMC |
| IO337 | 650k | 4 LVDS | 8 DF | 32 | **Yes** | No | **Yes** | XMC |
| IO391 | 50k | 26 TTL | — | — | No | No | No | mPCIe |
| IO392 | 50k | 13 RS422 DF | — | — | No | No | No | mPCIe |
| IO393 | 50k | 6 DF + 14 TTL | — | — | No | No | No | mPCIe |
| IO394 | 50k | 13 LVDS DF | — | — | No | No | No | mPCIe |
| IO397 | 50k | 14 TTL | 4 | 4 | **Yes** | No | No | mPCIe |

---

## Appendix B: Configuration Package Availability

| Module | Communication | HIL | RCP | TPI6020 | Resolver | Variants |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| IO306 | ✓ | ✓ | ✓ | — | — | — |
| IO307 | ✓ | ✓ | ✓ | — | — | — |
| IO324 | ✓ | ✓ | ✓ | ✓ | ✓ | TTL / RS422 |
| IO334 | ✓ | ✓ | ✓ | — | ✓ | TTL / RS422 |
| IO336 | ✓ | ✓ | ✓ | ✓ | ✓ | TTL / RS422 |
| IO337 | ✓ | ✓ | — | — | — | TTL / RS422 |
| IO397 | ✓ | ✓ | ✓ | ✓ | — | — |

Modules **without** pre-built packages (IO316–IO318, IO323, IO331–IO333, IO391–IO394) can still use custom configuration files but require Speedgoat engineering services to author them.

---

## Appendix C: Known Documentation Gaps

1. **No extension-bitstream validation:** No mechanism verifies that the installed physical extension matches what the config file expects. Risk of hardware damage from mismatch.
2. **IO33X board electrical requirements per module variant** are not documented per-FPGA — all IO33X boards are listed generically for all IO33X modules (IO331/332/333).
3. **IO316/IO317 extension details:** While Setup blocks reference extension selection, the ref pages for IO316/IO317 were not found in the crawled data to confirm which specific extensions they support.
4. **IO335-325k** appears in Simulink-Programmable documentation but has limited reference information in the crawled dataset.

---

*End of Report*
