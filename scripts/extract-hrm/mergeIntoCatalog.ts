#!/usr/bin/env npx tsx
/**
 * Merge extracted HRM specs into the mockCatalog.ts file.
 *
 * Reads the extracted-specs.json output and generates TypeScript code patches
 * for each module entry in MOCK_MODULE_CATALOG.
 *
 * Usage:
 *   npx tsx scripts/extract-hrm/mergeIntoCatalog.ts [--input <path>] [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ExtractedModuleSpecs } from './types'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const INPUT_PATH = getArg(
  '--input',
  path.join(__dirname, 'output', 'extracted-specs.json'),
)

const CATALOG_PATH = path.resolve(__dirname, '../../lib/proposal/mockCatalog.ts')

interface ExtractedOutput {
  _meta: Record<string, unknown>
  modules: ExtractedModuleSpecs[]
  discontinuedModuleIds: string[]
}

function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Merge HRM Extracted Specs → mockCatalog.ts')
  console.log('═══════════════════════════════════════════════════════')
  if (DRY_RUN) console.log('  MODE: dry-run (no files written)')
  console.log('')

  // Load extracted data
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Input not found: ${INPUT_PATH}`)
    console.error('Run the extraction first: npx tsx scripts/extract-hrm/index.ts')
    process.exit(1)
  }

  const data: ExtractedOutput = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'))
  console.log(`  Loaded ${data.modules.length} modules from extraction`)
  console.log(`  ${data.discontinuedModuleIds.length} discontinued module IDs`)

  // Load current catalog source
  let catalogSrc = fs.readFileSync(CATALOG_PATH, 'utf-8')
  let patchCount = 0
  let lifecycleCount = 0

  // Build lookup by moduleId
  const specsByModule = new Map(data.modules.map(m => [m.moduleId, m]))

  // For each module in the extracted data, find its entry in the catalog and inject fields
  for (const specs of data.modules) {
    const { moduleId } = specs
    const fields = buildFieldLines(specs)
    if (fields.length === 0) continue

    // Find the catalog entry block - look for moduleId: 'IOxxx' pattern
    // The entry ends with "},\n" or "}\n]" 
    const entryPattern = new RegExp(
      `(moduleId:\\s*'${moduleId}',)`,
      'g'
    )

    const match = entryPattern.exec(catalogSrc)
    if (!match) {
      console.log(`  ⚠ ${moduleId}: not found in catalog (skipped)`)
      continue
    }

    // Find the closing "}" of this entry by walking braces
    const insertPos = findEntryClosingBrace(catalogSrc, match.index)
    if (insertPos < 0) {
      console.log(`  ⚠ ${moduleId}: could not find entry end (skipped)`)
      continue
    }

    // Check if enrichment fields already exist
    const entryBlock = catalogSrc.slice(match.index, insertPos)
    if (entryBlock.includes('formFactor') || entryBlock.includes('hrmDocPath')) {
      console.log(`  ⏭ ${moduleId}: already enriched (skipped)`)
      continue
    }

    // Insert HRM fields before the closing brace
    const indent = '    '
    const fieldBlock = `\n${indent}/* HRM-enriched */\n${fields.map(f => `${indent}${f}`).join('\n')}\n  `
    catalogSrc = catalogSrc.slice(0, insertPos) + fieldBlock + catalogSrc.slice(insertPos)

    patchCount++
    console.log(`  ✓ ${moduleId}: ${fields.length} fields injected`)
  }

  // Also tag discontinued modules that are in the catalog but not in HRM scan
  for (const discId of data.discontinuedModuleIds) {
    if (specsByModule.has(discId)) continue // already handled above
    
    const entryPattern = new RegExp(`(moduleId:\\s*'${discId}',)`, 'g')
    const match = entryPattern.exec(catalogSrc)
    if (!match) continue

    const insertPos = findEntryClosingBrace(catalogSrc, match.index)
    if (insertPos < 0) continue

    const entryBlock = catalogSrc.slice(match.index, insertPos)
    if (entryBlock.includes('lifecycleStatus')) continue

    const indent = '    '
    const fieldBlock = `\n${indent}/* HRM-enriched */\n${indent}lifecycleStatus: 'discontinued',\n  `
    catalogSrc = catalogSrc.slice(0, insertPos) + fieldBlock + catalogSrc.slice(insertPos)
    lifecycleCount++
  }

  console.log(`\n  Total: ${patchCount} entries enriched, ${lifecycleCount} lifecycle-tagged`)

  if (DRY_RUN) {
    console.log('\n  DRY RUN — no files written. Remove --dry-run to apply.')
  } else {
    fs.writeFileSync(CATALOG_PATH, catalogSrc, 'utf-8')
    console.log(`\n  Written: ${CATALOG_PATH}`)
  }
}

/* ================================================================== */
/*  Field generation                                                   */
/* ================================================================== */

function buildFieldLines(specs: ExtractedModuleSpecs): string[] {
  const lines: string[] = []

  if (specs.formFactor) {
    lines.push(`formFactor: '${specs.formFactor}',`)
  }
  if (specs.lifecycleStatus && specs.lifecycleStatus !== 'active') {
    lines.push(`lifecycleStatus: '${specs.lifecycleStatus}',`)
  }
  if (specs.voltageRange) {
    lines.push(`voltageRange: { min: ${specs.voltageRange.min}, max: ${specs.voltageRange.max}, unit: '${specs.voltageRange.unit}' },`)
  }
  if (specs.currentRange) {
    lines.push(`currentRange: { min: ${specs.currentRange.min}, max: ${specs.currentRange.max}, unit: '${specs.currentRange.unit}' },`)
  }
  if (specs.sampleRateHz && specs.sampleRateHz.length > 0) {
    lines.push(`sampleRateHz: [${specs.sampleRateHz.join(', ')}],`)
  }
  if (specs.resolutionBits) {
    lines.push(`resolutionBits: ${specs.resolutionBits},`)
  }
  if (specs.isolationVoltage) {
    lines.push(`isolationVoltage: '${specs.isolationVoltage}',`)
  }
  if (specs.accuracyClass) {
    lines.push(`accuracyClass: '${specs.accuracyClass}',`)
  }
  if (specs.powerConsumptionW) {
    lines.push(`powerConsumptionW: ${specs.powerConsumptionW},`)
  }
  if (specs.operatingTempC) {
    lines.push(`operatingTempC: { min: ${specs.operatingTempC.min}, max: ${specs.operatingTempC.max} },`)
  }
  if (specs.hrmDocPath) {
    // Store just the relative path from IO Modules root
    const relative = specs.hrmDocPath.replace(/^.*IO Modules[\\\/]/, '')
    lines.push(`hrmDocPath: '${relative.replace(/\\/g, '/')}',`)
  }

  return lines
}

/* ================================================================== */
/*  Brace matching                                                     */
/* ================================================================== */

function findEntryClosingBrace(source: string, startIdx: number): number {
  // Walk backward from startIdx to find the opening "{" of this entry
  let openBrace = -1
  for (let i = startIdx; i >= 0; i--) {
    if (source[i] === '{') {
      openBrace = i
      break
    }
  }
  if (openBrace < 0) return -1

  // Now find the matching closing "}"
  let depth = 0
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

main()
