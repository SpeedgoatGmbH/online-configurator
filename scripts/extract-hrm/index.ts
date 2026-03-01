#!/usr/bin/env npx tsx
/**
 * HRM Extraction Orchestrator
 *
 * Scans the Speedgoat IO Modules directory for Hardware Reference Manual DOCX
 * files (NOT OEM manuals), extracts structured specs, and writes a review JSON.
 *
 * Usage:
 *   npx tsx scripts/extract-hrm/index.ts [--io-root <path>] [--output <path>] [--module <IOxxx>]
 *
 * Defaults:
 *   --io-root  "C:\Users\daniel.hediger\OneDrive - Speedgoat GmbH\Technologies - Documents\General\Products\IO Modules"
 *   --output   scripts/extract-hrm/output/extracted-specs.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { discoverHrmFiles, parseHrmDocx } from './parseDocx'
import { extractSpecs } from './extractSpecs'
import type { ExtractedModuleSpecs } from './types'
import { DISCONTINUED_MODULE_IDS } from './types'

/* ================================================================== */
/*  CLI argument parsing                                               */
/* ================================================================== */

const args = process.argv.slice(2)

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const IO_MODULES_ROOT = getArg(
  '--io-root',
  'C:\\Users\\daniel.hediger\\OneDrive - Speedgoat GmbH\\Technologies - Documents\\General\\Products\\IO Modules',
)

const OUTPUT_PATH = getArg(
  '--output',
  path.join(__dirname, 'output', 'extracted-specs.json'),
)

const SINGLE_MODULE = getArg('--module', '')

/* ================================================================== */
/*  Known catalog module IDs (for cross-reference reporting)           */
/* ================================================================== */

const CATALOG_MODULE_IDS = new Set([
  'IO104', 'IO106', 'IO107', 'IO108', 'IO109', 'IO110', 'IO111', 'IO112',
  'IO113', 'IO116', 'IO117', 'IO130', 'IO131', 'IO134', 'IO135', 'IO141',
  'IO142', 'IO143', 'IO144', 'IO145', 'IO171', 'IO172', 'IO191', 'IO203',
  'IO204', 'IO205', 'IO206', 'IO207', 'IO290', 'IO291', 'IO292', 'IO306',
  'IO307', 'IO308', 'IO316', 'IO317', 'IO318', 'IO323', 'IO324', 'IO325',
  'IO331', 'IO332', 'IO333', 'IO334', 'IO335', 'IO336', 'IO337', 'IO344',
  'IO391', 'IO392', 'IO393', 'IO394', 'IO397', 'IO424', 'IO425', 'IO503',
  'IO504', 'IO505', 'IO512', 'IO581', 'IO601', 'IO602', 'IO603', 'IO610',
  'IO611', 'IO612', 'IO613', 'IO614', 'IO619', 'IO623', 'IO624', 'IO625',
  'IO629', 'IO641', 'IO642', 'IO643', 'IO644', 'IO682', 'IO691', 'IO710',
  'IO715', 'IO716', 'IO717', 'IO723', 'IO750', 'IO751', 'IO752', 'IO753',
  'IO754', 'IO755', 'IO756', 'IO758', 'IO781', 'IO791', 'IO821', 'IO921',
  'IO923', 'IO925', 'IO927', 'IO970', 'IO972', 'IO975',
])

/* ================================================================== */
/*  Main                                                               */
/* ================================================================== */

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Speedgoat HRM Extraction Pipeline')
  console.log('  Source: Hardware Reference Manuals only (no OEM)')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  IO Modules root: ${IO_MODULES_ROOT}`)
  console.log(`  Output: ${OUTPUT_PATH}`)
  if (SINGLE_MODULE) console.log(`  Filtering: ${SINGLE_MODULE} only`)
  console.log('')

  // Step 1: Discover HRM files
  console.log('[1/4] Discovering HRM DOCX files...')
  let hrmMap = discoverHrmFiles(IO_MODULES_ROOT)

  if (SINGLE_MODULE) {
    const entry = hrmMap.get(SINGLE_MODULE.toUpperCase())
    if (!entry) {
      console.error(`Module ${SINGLE_MODULE} not found in HRM scan`)
      process.exit(1)
    }
    hrmMap = new Map([[SINGLE_MODULE.toUpperCase(), entry]])
  }

  console.log(`  Found ${hrmMap.size} HRM files\n`)

  // Step 2: Parse each DOCX
  console.log('[2/4] Parsing DOCX files with mammoth...')
  const results: ExtractedModuleSpecs[] = []
  let successCount = 0
  let errorCount = 0

  for (const [moduleId, { path: filePath, fileName }] of hrmMap) {
    process.stdout.write(`  ${moduleId} (${fileName})...`)
    try {
      const parsed = await parseHrmDocx(moduleId, filePath, fileName)
      const specs = extractSpecs(parsed)

      // Strip raw sections for cleaner output (keep for debug with --verbose)
      if (!args.includes('--verbose')) {
        delete specs._rawSections
      }

      results.push(specs)
      successCount++

      const fieldCount = countExtractedFields(specs)
      console.log(` ✓ (${fieldCount} fields extracted)`)
    } catch (err) {
      errorCount++
      console.log(` ✗ ERROR: ${(err as Error).message}`)
    }
  }

  console.log(`\n  Parsed: ${successCount} success, ${errorCount} errors\n`)

  // Step 3: Cross-reference with catalog
  console.log('[3/4] Cross-referencing with catalog...')
  const enrichable = results.filter(r => CATALOG_MODULE_IDS.has(r.moduleId))
  const newModules = results.filter(r => !CATALOG_MODULE_IDS.has(r.moduleId))

  console.log(`  ${enrichable.length} modules can enrich existing catalog entries`)
  console.log(`  ${newModules.length} modules are new (not in catalog yet)`)

  // Tag discontinued modules that aren't in the HRM scan
  const allDiscontinued = [...DISCONTINUED_MODULE_IDS].filter(id =>
    !results.find(r => r.moduleId === id)
  )
  console.log(`  ${allDiscontinued.length} discontinued modules (from folder) not in HRM scan`)

  // Step 4: Write output
  console.log('\n[4/4] Writing output...')
  const outputDir = path.dirname(OUTPUT_PATH)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      ioModulesRoot: IO_MODULES_ROOT,
      totalHrmFiles: hrmMap.size,
      successCount,
      errorCount,
      enrichableCount: enrichable.length,
      newModuleCount: newModules.length,
    },
    modules: results.sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
    discontinuedModuleIds: [...DISCONTINUED_MODULE_IDS].sort(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`  Written to: ${OUTPUT_PATH}`)

  // Summary
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  EXTRACTION SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  printSummaryTable(results)
  console.log('')
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function countExtractedFields(specs: ExtractedModuleSpecs): number {
  let count = 0
  if (specs.formFactor) count++
  if (specs.voltageRange) count++
  if (specs.currentRange) count++
  if (specs.sampleRateHz && specs.sampleRateHz.length > 0) count++
  if (specs.resolutionBits) count++
  if (specs.isolationVoltage) count++
  if (specs.accuracyClass) count++
  if (specs.powerConsumptionW) count++
  if (specs.operatingTempC) count++
  return count
}

function printSummaryTable(results: ExtractedModuleSpecs[]) {
  const fields = [
    'formFactor', 'voltageRange', 'currentRange', 'sampleRateHz',
    'resolutionBits', 'isolationVoltage', 'accuracyClass',
    'powerConsumptionW', 'operatingTempC',
  ] as const

  console.log(`\n  ${'Module'.padEnd(10)} ${fields.map(f => f.slice(0, 8).padEnd(10)).join('')}`)
  console.log(`  ${'─'.repeat(10)} ${fields.map(() => '─'.repeat(10)).join('')}`)

  for (const r of results) {
    const row = fields.map(f => {
      const val = r[f as keyof ExtractedModuleSpecs]
      if (val === undefined || val === null) return '  ·     '
      if (Array.isArray(val) && val.length === 0) return '  ·     '
      return '  ✓     '
    })
    console.log(`  ${r.moduleId.padEnd(10)} ${row.join('')}`)
  }

  // Field coverage stats
  console.log('')
  for (const f of fields) {
    const count = results.filter(r => {
      const val = r[f as keyof ExtractedModuleSpecs]
      return val !== undefined && val !== null && (!Array.isArray(val) || val.length > 0)
    }).length
    console.log(`  ${f.padEnd(22)} ${count}/${results.length} (${Math.round(100 * count / results.length)}%)`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
