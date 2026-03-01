/**
 * mergeWebData.ts
 * Reads web-scraped module data from webScrapedData.json and injects enrichment
 * fields into lib/proposal/mockCatalog.ts.
 *
 * Usage:
 *   npx tsx scripts/scrape-web/mergeWebData.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

/* ── Types ── */
interface WebModule {
  moduleId: string;
  source: string;
  compatibleMachines?: string[];
  inputChannels?: string | null;
  outputChannels?: string | null;
  dioChannels?: number;
  resolutionBits?: number;
  samplingMode?: string;
  sampleRateKsps?: number | null;
  inputVoltageRange?: string | null;
  outputVoltageRange?: string | null;
  formFactor?: string;
  lifecycleStatus?: string;
  protocols?: string[];
  channels?: number;
  connector?: string;
  maxDataRateMbps?: number;
  digitalChannels?: string;
  isolatedInputVoltage?: string;
  isolatedOutputVoltage?: string;
  maxCurrentPerChannel?: string;
  description?: string;
  resistanceRangeMOhm?: string;
  moduleType?: string;
  note?: string;
}

interface WebData {
  meta: { source: string; scrapedAt: string; pages: string[] };
  modules: WebModule[];
}

/* ── Helpers ── */

/** Parse voltage range string like "-10V to +10V" → { min: -10, max: 10, unit: 'V' } */
function parseVoltageRange(s: string | null | undefined): { min: number; max: number; unit: string } | null {
  if (!s) return null;
  // Take only the first range if multiple (e.g. "-12V to +12V, 0mA to +24mA")
  const first = s.split(',')[0].trim();
  const m = first.match(/([-+]?\d+(?:\.\d+)?)\s*V?\s*to\s*([-+]?\d+(?:\.\d+)?)\s*V/i);
  if (m) {
    return { min: parseFloat(m[1]), max: parseFloat(m[2]), unit: 'V' };
  }
  // Try ±  pattern (e.g. "±10V")
  const pm = first.match(/[±]\s*(\d+(?:\.\d+)?)\s*V/i);
  if (pm) {
    const val = parseFloat(pm[1]);
    return { min: -val, max: val, unit: 'V' };
  }
  // Try "0V to +10V" or "0-10V"
  const dash = first.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*V/i);
  if (dash) {
    return { min: parseFloat(dash[1]), max: parseFloat(dash[2]), unit: 'V' };
  }
  return null;
}

/** Parse current range from voltage string (e.g. "0mA to +24mA" portion) */
function parseCurrentRange(s: string | null | undefined): { min: number; max: number; unit: string } | null {
  if (!s) return null;
  const m = s.match(/([-+]?\d+(?:\.\d+)?)\s*mA\s*to\s*([-+]?\d+(?:\.\d+)?)\s*mA/i);
  if (m) {
    return { min: parseFloat(m[1]), max: parseFloat(m[2]), unit: 'mA' };
  }
  return null;
}

/** Build the enrichment block string for injection into the TS source.
 *  `existingFields` is the set of field names already present in this entry. */
function buildEnrichmentBlock(mod: WebModule, existingFields: Set<string>): string {
  const lines: string[] = [];

  // lifecycleStatus
  if (mod.lifecycleStatus && !existingFields.has('lifecycleStatus')) {
    lines.push(`    lifecycleStatus: '${mod.lifecycleStatus}',`);
  }

  // resolutionBits
  if (mod.resolutionBits && !existingFields.has('resolutionBits')) {
    lines.push(`    resolutionBits: ${mod.resolutionBits},`);
  }

  // sampleRateHz (kSPS → Hz)
  if (mod.sampleRateKsps && mod.sampleRateKsps > 0 && !existingFields.has('sampleRateHz')) {
    const hz = mod.sampleRateKsps * 1000;
    lines.push(`    sampleRateHz: [${hz}],`);
  }

  // voltageRange (input)
  const inV = parseVoltageRange(mod.inputVoltageRange);
  if (inV && !existingFields.has('voltageRange')) {
    lines.push(`    voltageRange: { min: ${inV.min}, max: ${inV.max}, unit: '${inV.unit}' },`);
  }

  // outputVoltageRange
  const outV = parseVoltageRange(mod.outputVoltageRange);
  if (outV && !existingFields.has('outputVoltageRange')) {
    lines.push(`    outputVoltageRange: { min: ${outV.min}, max: ${outV.max}, unit: '${outV.unit}' },`);
  }

  // currentRange (from input or output voltage string)
  const inC = parseCurrentRange(mod.inputVoltageRange) || parseCurrentRange(mod.outputVoltageRange);
  if (inC && !existingFields.has('currentRange')) {
    lines.push(`    currentRange: { min: ${inC.min}, max: ${inC.max}, unit: '${inC.unit}' },`);
  }

  // formFactor
  if (mod.formFactor && !existingFields.has('formFactor')) {
    lines.push(`    formFactor: '${mod.formFactor}' as const,`);
  }

  // samplingMode
  if (mod.samplingMode && !existingFields.has('samplingMode')) {
    lines.push(`    samplingMode: '${mod.samplingMode}',`);
  }

  // inputChannelSpec / outputChannelSpec
  if (mod.inputChannels && !existingFields.has('inputChannelSpec')) {
    lines.push(`    inputChannelSpec: '${mod.inputChannels}',`);
  }
  if (mod.outputChannels && !existingFields.has('outputChannelSpec')) {
    lines.push(`    outputChannelSpec: '${mod.outputChannels}',`);
  }

  // connector
  if (mod.connector && !existingFields.has('connector')) {
    lines.push(`    connector: '${mod.connector}',`);
  }

  // maxDataRateMbps
  if (mod.maxDataRateMbps && !existingFields.has('maxDataRateMbps')) {
    lines.push(`    maxDataRateMbps: ${mod.maxDataRateMbps},`);
  }

  // webSourcePage
  if (!existingFields.has('webSourcePage')) {
    lines.push(`    webSourcePage: '${mod.source}',`);
  }

  if (lines.length === 1 && lines[0].includes('webSourcePage')) return ''; // only source page, skip
  if (lines.length === 0) return '';
  return `\n    /* web-enriched (speedgoat.com/${mod.source}) */\n${lines.join('\n')}`;
}

/* ── Main ── */
function main() {
  const dryRun = process.argv.includes('--dry-run');

  const jsonPath = path.join(__dirname, 'webScrapedData.json');
  const catalogPath = path.resolve(__dirname, '../../lib/proposal/mockCatalog.ts');

  const webData: WebData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  let catalog = fs.readFileSync(catalogPath, 'utf-8');

  console.log(`📋 Loaded ${webData.modules.length} modules from web data`);
  console.log(`📄 Catalog file: ${catalog.length} chars`);

  let enriched = 0;
  let skipped = 0;
  let notFound = 0;

  // Build a map of web modules, first occurrence wins for each moduleId
  const webMap = new Map<string, WebModule>();
  for (const mod of webData.modules) {
    if (!webMap.has(mod.moduleId)) {
      webMap.set(mod.moduleId, mod);
    }
  }

  for (const [moduleId, webMod] of webMap) {
    // Find the module entry in the catalog by its moduleId
    const escapedId = moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(    moduleId: '${escapedId}',)`, 'g');

    let matchCount = 0;
    const matches: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(catalog)) !== null) {
      matches.push(m.index);
      matchCount++;
    }

    if (matchCount === 0) {
      console.log(`  ⚠ ${moduleId}: not found in catalog`);
      notFound++;
      continue;
    }

    // Process matches in reverse order to not invalidate offsets
    const sortedMatches = [...matches].sort((a, b) => b - a);

    for (const matchIdx of sortedMatches) {
      const afterMatch = catalog.substring(matchIdx);
      const nextEnd = afterMatch.indexOf('\n  },');
      const endIdx = nextEnd !== -1 ? nextEnd : afterMatch.indexOf('\n]\n');

      if (endIdx === -1) {
        console.log(`  ⚠ ${moduleId}: could not find entry boundary`);
        continue;
      }

      const entrySlice = afterMatch.substring(0, endIdx);

      // Check if already web-enriched
      if (entrySlice.includes('web-enriched')) {
        continue;
      }

      // Detect existing field names in this entry to avoid duplicates
      const existingFields = new Set<string>();
      const fieldRe = /^\s+(\w+)\s*:/gm;
      let fm: RegExpExecArray | null;
      while ((fm = fieldRe.exec(entrySlice)) !== null) {
        existingFields.add(fm[1]);
      }

      // Build the enrichment block, skipping already-present fields
      const block = buildEnrichmentBlock(webMod, existingFields);
      if (!block) {
        skipped++;
        continue;
      }

      // Insert the enrichment block right before the closing `},`
      const insertPos = matchIdx + endIdx;
      catalog = catalog.substring(0, insertPos) + block + catalog.substring(insertPos);
      enriched++;
    }
  }

  console.log(`\n✅ Results:`);
  console.log(`   Enriched: ${enriched} entries`);
  console.log(`   Skipped (no data): ${skipped}`);
  console.log(`   Not found in catalog: ${notFound}`);

  if (dryRun) {
    console.log(`\n🔍 DRY RUN — no changes written.`);
  } else {
    fs.writeFileSync(catalogPath, catalog, 'utf-8');
    console.log(`\n💾 Written to ${catalogPath}`);
  }
}

main();
