/**
 * Merge extracted documentation data into mockCatalog.ts
 *
 * Enriches MockModuleCatalogEntry items with:
 *  - docDescription: full description from authenticated docs
 *  - fpgaLogicCells, fpgaCategory, fpgaAnalogInput/Output, fpgaDigitalIOLines
 *  - supportsIOInterfaces, supportsIOExtensions
 *  - configPackages
 *
 * Also appends IO_INTERFACE_BOARDS, IO_INTERFACE_EXTENSIONS, FPGA_MODULE_SPECS exports.
 *
 * Run with: node scripts/mergeDocData.js
 */
const fs = require("fs");
const path = require("path");

// ── Load source data ──
const docDataPath = path.join(__dirname, "scrape-web", "docExtractedData.json");
const docData = JSON.parse(fs.readFileSync(docDataPath, "utf8"));

const catalogPath = path.join(__dirname, "..", "lib", "proposal", "mockCatalog.ts");
let catalogSrc = fs.readFileSync(catalogPath, "utf8");

// ── Parse existing catalog entry moduleIds ──
const entryPattern = /moduleId:\s*['"]([^'"]+)['"]/g;
const existingIds = new Set();
let m;
while ((m = entryPattern.exec(catalogSrc)) !== null) {
  existingIds.add(m[1]);
}
console.log(`Existing catalog entries: ${existingIds.size} unique moduleIds`);

// ── Build doc enrichment maps ──

// FPGA modules (by fullName and moduleId)
const fpgaMap = new Map();
for (const mod of docData.fpgaModules) {
  fpgaMap.set(mod.fullName, mod);
  if (!fpgaMap.has(mod.moduleId)) fpgaMap.set(mod.moduleId, mod);
}

// Analog modules
const analogMap = new Map();
for (const mod of docData.analogModules) {
  analogMap.set(mod.moduleId, mod);
}

// Digital modules
const digitalMap = new Map();
for (const mod of docData.digitalModules) {
  digitalMap.set(mod.moduleId, mod);
}

// Communication modules (by moduleId → protocol list)
const commMap = new Map();
for (const mod of docData.communicationModules) {
  if (!commMap.has(mod.moduleId)) commMap.set(mod.moduleId, []);
  commMap.get(mod.moduleId).push(mod.protocol);
}

// Other modules
const otherMap = new Map();
for (const mod of docData.otherModuleInfo) {
  otherMap.set(mod.moduleId, mod);
}

// Config packages (by moduleId → config names)
const pkgMap = new Map();
for (const pkg of (docData.configPackages || [])) {
  if (!pkgMap.has(pkg.moduleId)) pkgMap.set(pkg.moduleId, []);
  pkgMap.get(pkg.moduleId).push(pkg.configName);
}

// ── Add new type fields to MockModuleCatalogEntry ──
const newTypeFields = `
  /* ── Documentation-enriched fields (from Speedgoat authenticated docs) ── */
  /** Full description from documentation */
  docDescription?: string
  /** FPGA logic cell count (e.g. "325k", "650k") */
  fpgaLogicCells?: string
  /** FPGA module category */
  fpgaCategory?: 'configurable' | 'simulink-programmable'
  /** Analog input channels from FPGA module (e.g. "32/16" or 16) */
  fpgaAnalogInputChannels?: string | number
  /** Analog output channels from FPGA module */
  fpgaAnalogOutputChannels?: number
  /** Digital I/O lines from FPGA module */
  fpgaDigitalIOLines?: number
  /** Whether this module supports optional IO33X-N interface boards */
  supportsIOInterfaces?: boolean
  /** Whether this module supports IO interface extensions (-21, -22, etc.) */
  supportsIOExtensions?: boolean
  /** Available IO Configuration Package names for this module */
  configPackages?: string[]`;

if (!catalogSrc.includes("docDescription")) {
  // Insert new fields before the closing brace of the type
  // Handle both Unix and Windows line endings
  const typeClosePatterns = [
    /}\r?\n\r?\n\/\*\*\r?\n \* Catalog of Speedgoat/,
  ];
  let inserted = false;
  for (const pat of typeClosePatterns) {
    const match = catalogSrc.match(pat);
    if (match) {
      const idx = catalogSrc.indexOf(match[0]);
      catalogSrc = catalogSrc.slice(0, idx) + newTypeFields + "\n" + catalogSrc.slice(idx);
      console.log("Added new type fields to MockModuleCatalogEntry");
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    console.log("WARNING: Could not find type definition closing brace");
  }
}

// ── Enrich existing entries ──
let enriched = 0;
let notFound = 0;

function escapeForTs(s) {
  return s.replace(/'/g, "\\'").replace(/\n/g, " ");
}

for (const id of existingIds) {
  // Skip interface board entries (IO3xx-21 etc.)
  if (/IO\d{3}-\d+$/.test(id)) continue;

  let docDesc = null;
  let fpgaInfo = null;

  // Check FPGA map first
  if (fpgaMap.has(id)) {
    fpgaInfo = fpgaMap.get(id);
    docDesc = fpgaInfo.description || fpgaInfo.overviewDescription;
  }

  // Fallback: analog/digital/other descriptions
  if (!docDesc && analogMap.has(id)) docDesc = analogMap.get(id).description;
  if (!docDesc && digitalMap.has(id)) docDesc = digitalMap.get(id).description;
  if (!docDesc && otherMap.has(id)) docDesc = otherMap.get(id).description;

  if (!docDesc && !fpgaInfo) {
    notFound++;
    continue;
  }

  // Build enrichment fields
  const fields = [];

  if (docDesc) {
    fields.push(`    docDescription: '${escapeForTs(docDesc)}',`);
  }

  if (fpgaInfo) {
    if (fpgaInfo.logicCells) fields.push(`    fpgaLogicCells: '${fpgaInfo.logicCells}',`);
    if (fpgaInfo.category) fields.push(`    fpgaCategory: '${fpgaInfo.category}',`);
    if (fpgaInfo.analogInputChannels) {
      const val = typeof fpgaInfo.analogInputChannels === "string" ? `'${fpgaInfo.analogInputChannels}'` : fpgaInfo.analogInputChannels;
      fields.push(`    fpgaAnalogInputChannels: ${val},`);
    }
    if (fpgaInfo.analogOutputChannels) fields.push(`    fpgaAnalogOutputChannels: ${fpgaInfo.analogOutputChannels},`);
    if (fpgaInfo.digitalIOLines) fields.push(`    fpgaDigitalIOLines: ${fpgaInfo.digitalIOLines},`);
    if (fpgaInfo.hasOptionalInterfaces) fields.push(`    supportsIOInterfaces: true,`);
    if (fpgaInfo.hasInterfaceExtensions) fields.push(`    supportsIOExtensions: true,`);
  }

  const pkgs = pkgMap.get(id);
  if (pkgs && pkgs.length > 0) {
    fields.push(`    configPackages: [${pkgs.map(p => `'${escapeForTs(p)}'`).join(", ")}],`);
  }

  if (fields.length === 0) continue;

  // Find the entry and inject fields before its closing },
  const moduleIdStr = `moduleId: '${id}'`;
  const entryStart = catalogSrc.indexOf(moduleIdStr);
  if (entryStart === -1) continue;

  // Find the closing `  },` for this entry
  const searchAfterEntry = catalogSrc.slice(entryStart);
  const entryEndMatch = searchAfterEntry.match(/\r?\n(  },?\r?\n)/);
  if (!entryEndMatch) continue;

  const insertPos = entryStart + (entryEndMatch.index || 0);
  const enrichmentBlock = "\n" + fields.join("\n");
  catalogSrc = catalogSrc.slice(0, insertPos) + enrichmentBlock + catalogSrc.slice(insertPos);
  enriched++;
}

console.log(`Enriched ${enriched} catalog entries with doc data`);
console.log(`${notFound} entries had no matching doc data`);

// ── Append reference data exports ──
const interfaceData = `
/**
 * IO Interface Boards (IO33X-N) for FPGA I/O modules.
 * These are front I/O boards that plug into IO33x series modules.
 */
export const IO_INTERFACE_BOARDS = ${JSON.stringify(docData.ioInterfaces, null, 2)} as const;

/**
 * IO Interface Extensions (-21, -22, -24, -40, -120).
 * Signal conditioning boards extending rear LVCMOS lines.
 */
export const IO_INTERFACE_EXTENSIONS = ${JSON.stringify(docData.ioInterfaceExtensions, null, 2)} as const;

/**
 * Summary of all FPGA/Configurable modules with specs from authenticated docs.
 */
export const FPGA_MODULE_SPECS = ${JSON.stringify(
  docData.fpgaModules.map((mod) => ({
    moduleId: mod.moduleId,
    fullName: mod.fullName,
    fpgaSize: mod.fpgaSize,
    category: mod.category,
    description: mod.description,
    logicCells: mod.logicCells,
    analogInputChannels: mod.analogInputChannels || null,
    analogOutputChannels: mod.analogOutputChannels || null,
    digitalIOLines: mod.digitalIOLines || null,
    hasOptionalInterfaces: mod.hasOptionalInterfaces || false,
    hasInterfaceExtensions: mod.hasInterfaceExtensions || false,
  })),
  null,
  2
)} as const;
`;

if (!catalogSrc.includes("IO_INTERFACE_BOARDS")) {
  catalogSrc += interfaceData;
  console.log("Added IO_INTERFACE_BOARDS, IO_INTERFACE_EXTENSIONS, FPGA_MODULE_SPECS exports");
}

// ── Write back ──
fs.writeFileSync(catalogPath, catalogSrc, "utf8");
console.log(`\nWrote updated catalog to ${catalogPath}`);
console.log(`Total catalog size: ${(catalogSrc.length / 1024).toFixed(1)} KB`);
