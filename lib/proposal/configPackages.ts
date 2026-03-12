/**
 * Structured config package data — channel allocations per FPGA module × extension × package.
 *
 * Source: Speedgoat Help — IO Configuration Package reference pages.
 * Keys follow the pattern "{fpgaFamily}-{extension}-{packageName}" where extension
 * is "21" (TTL), "22" (RS422), "24" (Resolver), or "none" (self-contained modules).
 *
 * Each allocation entry lists which code module is available and how many channels max.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConfigPackageCodeModuleAllocation = {
  /** Code module name (matches FPGA_CODE_MODULE_COMPAT / fit model names) */
  codeModule: string
  /** Maximum channels available for this code module in this config */
  maxChannels: number
}

export type ConfigPackageDefinition = {
  /** Config package display name (e.g. "RCP TTL") */
  name: string
  /** FPGA family this config applies to */
  fpgaFamily: string
  /** Extension suffix: "21" | "22" | "24" | "none" */
  extension: string
  /** Per-code-module channel allocations */
  allocations: ConfigPackageCodeModuleAllocation[]
}

export type SelectedConfigPackage = {
  /** The matched config package name */
  name: string
  /** The extension this package requires */
  extension: string
  /** Whether channel requirements are satisfied */
  satisfied: boolean
  /** Warning string if a code module exceeds its allocation, else undefined */
  warning?: string
}

// ── Sub-ID → Config Package Preference Order ───────────────────────────────────
// Maps requirement subIds to preferred config package names (best first).
// Used by selectBestConfigPackage() to pick the optimal config for a given signal.

export const SUB_ID_TO_CONFIG_PREFERENCE: Record<string, string[]> = {
  resolver: ['Resolver TTL', 'Resolver RS422'],
  encoder:  ['RCP TTL', 'RCP RS422', 'HIL TTL', 'HIL RS422'],
  pwm:      ['HIL TTL', 'HIL RS422', 'RCP TTL', 'RCP RS422'],
  capture:  ['HIL TTL', 'HIL RS422', 'RCP TTL', 'RCP RS422'],
  gpio:     ['HIL TTL', 'RCP TTL', 'HIL RS422', 'RCP RS422', 'HIL', 'RCP'],
  spi:      ['Communication TTL', 'Communication RS422', 'Communication'],
  i2c:      ['Communication TTL', 'Communication RS422', 'Communication'],
  serial:   ['Communication RS422', 'Communication TTL', 'Communication'],
  protocols: ['Communication TTL', 'Communication RS422', 'Communication'],
  inputs:   ['RCP TTL', 'HIL TTL', 'RCP RS422', 'HIL RS422', 'RCP', 'HIL'],
  outputs:  ['RCP TTL', 'HIL TTL', 'RCP RS422', 'HIL RS422', 'RCP', 'HIL'],
  sent:     ['Communication TTL', 'Communication RS422', 'Communication'],
  dshot:    ['Communication TTL', 'Communication RS422', 'Communication'],
}

// ── Config Package Allocations ─────────────────────────────────────────────────
// Source: copilot-instructions.md §16 + Speedgoat Help pages
// Extracted to JSON — loaded at import time.

import configPackageAllocationsJson from '@/lib/proposal/data/configPackageAllocations.json'

export const CONFIG_PACKAGE_ALLOCATIONS: ConfigPackageDefinition[] =
  configPackageAllocationsJson as unknown as ConfigPackageDefinition[]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** Get all config package definitions for a given FPGA family. */
export function getConfigPackagesForFamily(fpgaFamily: string): ConfigPackageDefinition[] {
  return CONFIG_PACKAGE_ALLOCATIONS.filter(p => p.fpgaFamily === fpgaFamily)
}

/** Get a specific config package definition by family + name. */
export function getConfigPackageDefinition(
  fpgaFamily: string,
  packageName: string
): ConfigPackageDefinition | undefined {
  return CONFIG_PACKAGE_ALLOCATIONS.find(
    p => p.fpgaFamily === fpgaFamily && p.name === packageName
  )
}

/**
 * Map a requirement subId to the code module name used in config package allocations.
 * This bridges the gap between user-facing subIds and internal code module names.
 */
const SUB_ID_TO_ALLOCATION_CODE_MODULE: Record<string, string[]> = {
  pwm:      ['PWM'],
  capture:  ['PWM Capture'],
  encoder:  ['Quadrature', 'SSI', 'BiSS', 'EnDat'],
  resolver: ['Resolver'],
  gpio:     ['PWM', 'PWM Capture'],    // GPIO rows use digital lines provisioned by various code modules
  spi:      ['SPI'],
  i2c:      ['I2C'],
  serial:   ['Serial'],
  sent:     ['SPI'],                    // SENT uses SPI-like code modules in config packages
  dshot:    ['Serial'],                 // dShot uses serial-like code modules in config packages
}

/**
 * Select the best config package for a given FPGA family and requirement row subId.
 * Returns the matched package name and bonus, or null if no packages exist.
 */
export function selectBestConfigPackage(
  configPackages: string[] | undefined,
  fpgaFamily: string | undefined,
  subId: string
): { packageName: string; bonus: number } | null {
  if (!configPackages || configPackages.length === 0 || !fpgaFamily) return null

  const preferences = SUB_ID_TO_CONFIG_PREFERENCE[subId]
  if (preferences) {
    // Try each preferred config in order — first available one wins
    for (const preferred of preferences) {
      if (configPackages.some(pkg => pkg === preferred)) {
        return { packageName: preferred, bonus: 1 }
      }
    }
  }

  // Fallback: substring matching (same logic as the old computeConfigPackageBonus)
  const subIdLower = subId.toLowerCase()
  const matched = configPackages.find(pkg => {
    const pkgLower = pkg.toLowerCase()
    return pkgLower.includes(subIdLower) ||
      (subIdLower === 'encoder' && (pkgLower.includes('quadrature') || pkgLower.includes('endat') || pkgLower.includes('biss') || pkgLower.includes('ssi'))) ||
      (subIdLower === 'pwm' && pkgLower.includes('hil')) ||
      (subIdLower === 'gpio' && (pkgLower.includes('hil') || pkgLower.includes('rcp')))
  })

  return matched ? { packageName: matched, bonus: 1 } : null
}

/**
 * Validate that a config package can satisfy the requested channel count for a given subId.
 * Returns a warning string if the allocation is exceeded, undefined if OK.
 */
export function validateConfigPackageChannels(
  fpgaFamily: string,
  packageName: string,
  subId: string,
  requestedChannels: number
): string | undefined {
  const definition = CONFIG_PACKAGE_ALLOCATIONS.find(
    p => p.fpgaFamily === fpgaFamily && p.name === packageName
  )
  if (!definition) return undefined // No structured data — can't validate

  const relevantModules = SUB_ID_TO_ALLOCATION_CODE_MODULE[subId]
  if (!relevantModules) return undefined // Unknown subId — skip validation

  // Sum the total channels available across all relevant code modules in this config
  const availableChannels = definition.allocations
    .filter(a => relevantModules.includes(a.codeModule))
    .reduce((sum, a) => sum + a.maxChannels, 0)

  if (availableChannels === 0) {
    return `${packageName} config does not include ${subId} code modules`
  }

  if (requestedChannels > availableChannels) {
    return `${packageName} provides ${availableChannels}× ${subId} channels but ${requestedChannels} requested — custom configuration or additional boards may be needed`
  }

  return undefined
}

// ── HCIP & HDL I/O Blockset Mappings ──────────────────────────────────────────

/**
 * FPGA families that have NO pre-built config packages — they require either
 * a custom configuration (bitstream built by Speedgoat) or the HDL Coder
 * workflow (HCIP purchased by customer).
 */
export const PROGRAMMABLE_ONLY_FAMILIES = new Set([
  'IO332', 'IO333', 'IO335', 'IO342', 'IO344', 'IO352',
])

/**
 * HDL Coder Integration Package codes per FPGA family.
 * These are the self-service licenses a customer would need to create their
 * own bitstreams. Also relevant as a reference when Speedgoat creates a
 * custom configuration.
 */
export const FPGA_FAMILY_HCIP: Record<string, { itemCode: string; name: string }> = {
  IO324: { itemCode: '3A24IP', name: 'IO324-200k HDL Coder Integration Package' },
  IO325: { itemCode: '3A25IP', name: 'IO325-160k HDL Coder Integration Package' },
  IO332: { itemCode: '3A32IP', name: 'IO332-200k HDL Coder Integration Package' },
  IO333: { itemCode: '3A33IP', name: 'IO333-325k/410k HDL Coder Integration Package' },
  IO334: { itemCode: '3A34IP', name: 'IO334-325k HDL Coder Integration Package' },
  IO335: { itemCode: '3A35IP', name: 'IO335-325k HDL Coder Integration Package' },
  IO336: { itemCode: '3A36IP', name: 'IO336-325k HDL Coder Integration Package' },
  IO337: { itemCode: '3A37IP', name: 'IO337-650k HDL Coder Integration Package' },
}

/**
 * Maps FPGA code module names to their HDL I/O Blockset.
 * 303MOT = Motion Control, 303COM = Communication.
 */
export const CODE_MODULE_BLOCKSET: Record<string, { itemCode: string; name: string }> = {
  PWM:        { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  Quadrature: { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  SSI:        { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  BiSS:       { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  EnDat:      { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  Resolver:   { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  'Cam/Crank':{ itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  'Pulse Counter': { itemCode: '303MOT', name: 'Motion Control HDL I/O Blockset' },
  SPI:        { itemCode: '303COM', name: 'Communication HDL I/O Blockset' },
  I2C:        { itemCode: '303COM', name: 'Communication HDL I/O Blockset' },
  Serial:     { itemCode: '303COM', name: 'Communication HDL I/O Blockset' },
  SENT:       { itemCode: '303COM', name: 'Communication HDL I/O Blockset' },
  Dshot:      { itemCode: '303COM', name: 'Communication HDL I/O Blockset' },
}

/**
 * FPGA code-module protocols that can be resolved via FPGA bitstreams
 * rather than dedicated hardware boards. When a Communication/Protocols
 * row requests one of these, it should be routed to FPGA evaluation.
 */
export const FPGA_CODE_MODULE_PROTOCOLS = new Set([
  'SPI', 'I2C', 'Serial', 'SENT', 'Dshot',
])

/**
 * Maps protocol names (as they appear in specs.range from the UI) to
 * the FPGA sub-ID used by SUB_ID_TO_CODE_MODULES.
 */
export const PROTOCOL_TO_SUB_ID: Record<string, string> = {
  SPI:    'spi',
  I2C:    'i2c',
  I2S:    'i2c',
  Serial: 'serial',
  UART:   'serial',
  SENT:   'sent',
  Dshot:  'dshot',
  dShot:  'dshot',
}
