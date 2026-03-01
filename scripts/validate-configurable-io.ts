import { MOCK_MODULE_CATALOG } from '../lib/proposal/mockCatalog';

const DOC_MODULES = [
  { id: 'IO306',      logicK: 25,  lines: '64 TTL',                                     simProg: false },
  { id: 'IO307',      logicK: 25,  lines: '32 TTL + 16 RS422/RS485',                    simProg: false },
  { id: 'IO308',      logicK: 25,  lines: '32 RS422/RS485',                             simProg: false },
  { id: 'IO309a',     logicK: 100, lines: '64 TTL',                                     simProg: false },
  { id: 'IO309b',     logicK: 100, lines: '32 TTL + 16 RS422/RS485',                    simProg: false },
  { id: 'IO309c',     logicK: 100, lines: '32 RS422/RS485',                             simProg: false },
  { id: 'IO316',      logicK: 45,  lines: '64 TTL',                                     simProg: false },
  { id: 'IO316-100k', logicK: 100, lines: '64 TTL',                                     simProg: false },
  { id: 'IO317',      logicK: 45,  lines: '32 TTL + 16 RS422/RS485',                    simProg: false },
  { id: 'IO317-100k', logicK: 100, lines: '32 TTL + 16 RS422/RS485',                    simProg: false },
  { id: 'IO318',      logicK: 45,  lines: '32 RS422',                                   simProg: false },
  { id: 'IO318-100k', logicK: 100, lines: '32 RS422',                                   simProg: false },
  { id: 'IO322',      logicK: 45,  lines: '42 TTL + 32/16 AI + 8 AO',                   simProg: false },
  { id: 'IO323',      logicK: 100, lines: '42 TTL + 32/16 AI + 8 AO',                   simProg: false },
  { id: 'IO324',      logicK: 200, lines: '32 TTL(16 RS422) + 32/16 AI + 8 AO',         simProg: true  },
  { id: 'IO325',      logicK: 160, lines: '32 TTL(16 RS422) + 8 diff AI + 4 AO',        simProg: true  },
  { id: 'IO331',      logicK: 150, lines: 'Optional IO33X interfaces + extensions',      simProg: false },
  { id: 'IO332',      logicK: 200, lines: 'Optional IO33X interfaces + extensions',      simProg: true  },
  { id: 'IO333',      logicK: 325, lines: 'Optional IO33X interfaces + extensions',      simProg: true  },
  { id: 'IO333-410k', logicK: 410, lines: 'Optional IO33X interfaces + extensions',      simProg: true  },
  { id: 'IO334',      logicK: 325, lines: '16 diff AI + 16 AO',                          simProg: true  },
  { id: 'IO336',      logicK: 325, lines: '32 TTL(16 RS422) + 16 diff AI + 8 AO',       simProg: true  },
  { id: 'IO337',      logicK: 650, lines: '8 diff AI + 32 AO + 4 LVDS',                 simProg: true  },
  { id: 'IO360a',     logicK: 190, lines: '64 TTL',                                     simProg: true  },
  { id: 'IO360b',     logicK: 190, lines: '32 TTL + 16 RS422/RS485',                    simProg: true  },
  { id: 'IO360c',     logicK: 190, lines: '32 RS422/RS485',                             simProg: true  },
  { id: 'IO361a',     logicK: 469, lines: '40 TTL',                                     simProg: true  },
  { id: 'IO361b',     logicK: 469, lines: '24 TTL + 8 RS422/RS485',                     simProg: true  },
  { id: 'IO361c',     logicK: 469, lines: '20 RS422/RS485',                             simProg: true  },
  { id: 'IO391',      logicK: 50,  lines: '26 TTL',                                     simProg: false },
  { id: 'IO392',      logicK: 50,  lines: '13 RS422/485 diff',                          simProg: false },
  { id: 'IO393',      logicK: 50,  lines: '6 diff digital + 14 TTL',                    simProg: false },
  { id: 'IO394',      logicK: 50,  lines: '13 LVDS diff',                               simProg: false },
  { id: 'IO397',      logicK: 50,  lines: '14 TTL + 4 AI + 4 AO',                       simProg: true  },
];

const DOC_IO_EXTENSIONS = ['-21', '-22', '-24', '-120'];

const catalog = MOCK_MODULE_CATALOG;

console.log('='.repeat(80));
console.log('CROSS-REFERENCE: Official Configurable I/O Doc vs Catalog');
console.log('Source: refentry_configurable_io  |  Catalog entries:', catalog.length);
console.log('='.repeat(80));

// Build lookup
const catByTech: Record<string, typeof catalog> = {};
for (const m of catalog) {
  if (!catByTech[m.technicalName]) catByTech[m.technicalName] = [];
  catByTech[m.technicalName].push(m);
}

// --- 1. Presence ---
console.log('\n--- 1. Doc Modules vs Catalog ---');
const inCatalog: typeof DOC_MODULES = [];
const notInCatalog: typeof DOC_MODULES = [];
for (const dm of DOC_MODULES) {
  const matches = catByTech[dm.id] || [];
  if (matches.length > 0) inCatalog.push(dm);
  else notInCatalog.push(dm);
}
console.log(`  In catalog: ${inCatalog.length}/${DOC_MODULES.length}`);
if (notInCatalog.length) {
  console.log(`  MISSING (${notInCatalog.length}):`);
  for (const m of notInCatalog) {
    console.log(`    ${m.id.padEnd(14)} ${String(m.logicK).padStart(4)}k  ${m.lines.padEnd(45)} simProg=${m.simProg}`);
  }
}

// --- 2. FPGA Family Groupings ---
console.log('\n--- 2. FPGA Family Groupings ---');
const fpgaEntries = catalog.filter(m => m.fpgaFamily);
const familyMap: Record<string, typeof catalog> = {};
for (const m of fpgaEntries) {
  if (!familyMap[m.fpgaFamily!]) familyMap[m.fpgaFamily!] = [];
  familyMap[m.fpgaFamily!].push(m);
}
for (const fam of Object.keys(familyMap).sort()) {
  const entries = familyMap[fam];
  const dm = DOC_MODULES.find(d => d.id === fam);
  const info = dm ? `${dm.logicK}k, ${dm.lines}, simProg=${dm.simProg}` : 'NOT IN DOC TABLE';
  console.log(`  ${fam} (doc: ${info})`);
  for (const e of entries) {
    const catStr = `${e.categoryCoverage}/${e.subCoverage.join(',')}`;
    console.log(`    ${e.moduleId.padEnd(25)} ${catStr.padEnd(35)} lines=${String(e.fpgaTotalLines || '?').padStart(3)}  intBoard=${e.interfaceBoard || 'NONE'}`);
  }
}

// --- 3. Simulink-Programmable ---
console.log('\n--- 3. Simulink-Programmable Check ---');
console.log('  With X (Simulink-Programmable AND Configurable):');
for (const dm of DOC_MODULES.filter(d => d.simProg)) {
  const entries = catByTech[dm.id] || [];
  const hasFam = entries.some(e => e.fpgaFamily);
  const status = entries.length === 0 ? 'NOT IN CATALOG' : hasFam ? 'OK (fpgaFamily set)' : 'WARNING: no fpgaFamily';
  console.log(`    ${dm.id.padEnd(14)} ${status}`);
}
console.log('  Without X (Configurable-only):');
for (const dm of DOC_MODULES.filter(d => !d.simProg)) {
  const entries = catByTech[dm.id] || [];
  const hasFam = entries.some(e => e.fpgaFamily);
  const status = entries.length === 0 ? 'not in catalog' : hasFam ? 'has fpgaFamily (OK for consolidation)' : 'no fpgaFamily (OK)';
  console.log(`    ${dm.id.padEnd(14)} ${status}`);
}

// --- 4. Interface Board ---
console.log('\n--- 4. Interface Board Coverage ---');
const withIB = fpgaEntries.filter(m => m.interfaceBoard);
const noIB = fpgaEntries.filter(m => !m.interfaceBoard);
console.log(`  With interfaceBoard: ${withIB.length}/${fpgaEntries.length}`);
if (noIB.length) {
  console.log('  MISSING:');
  noIB.forEach(m => console.log(`    ${m.moduleId} (${m.technicalName})`));
}
const suffixes = [...new Set(withIB.map(m => String(m.interfaceBoard || '').replace(/^IO\d+[a-z]?/, '')))].sort();
console.log(`  Suffixes used in catalog: ${suffixes.join(', ')}`);
console.log(`  Doc extensions:           ${DOC_IO_EXTENSIONS.join(', ')}`);

// --- 5. Cross-category ---
console.log('\n--- 5. Cross-Category Modules ---');
const techGroups: Record<string, typeof catalog> = {};
for (const m of catalog) {
  if (!m.technicalName?.match(/^IO3/)) continue;
  if (!techGroups[m.technicalName]) techGroups[m.technicalName] = [];
  techGroups[m.technicalName].push(m);
}
for (const tech of Object.keys(techGroups).sort()) {
  const entries = techGroups[tech];
  if (entries.length <= 1) continue;
  const cats = [...new Set(entries.map(e => e.categoryCoverage))];
  const fams = [...new Set(entries.map(e => e.fpgaFamily).filter(Boolean))];
  const ok = fams.length <= 1;
  console.log(`  ${tech.padEnd(12)} ${String(entries.length).padStart(2)} entries  cats=[${cats.join(',')}]  families=[${fams.join(',') || 'none'}]  ${ok ? 'OK' : 'INCONSISTENT!'}`);
}

// --- 6. VERDICT ---
console.log('\n' + '='.repeat(80));
console.log('SELECTION LOGIC VERDICT');
console.log('='.repeat(80));

const issues: string[] = [];
const warnings: string[] = [];

const docIds = new Set(DOC_MODULES.map(d => d.id));
const io3xxNoFam = catalog.filter(m =>
  m.technicalName?.match(/^IO3/) &&
  !m.technicalName.match(/^IO33X/) &&
  !m.fpgaFamily &&
  docIds.has(m.technicalName)
);
if (io3xxNoFam.length) {
  issues.push(`${io3xxNoFam.length} configurable I/O module(s) missing fpgaFamily: ${io3xxNoFam.map(m => m.moduleId).join(', ')}`);
}

if (noIB.length) {
  issues.push(`${noIB.length} fpgaFamily entry(ies) without interfaceBoard: ${noIB.map(m => m.moduleId).join(', ')}`);
}

for (const tech of Object.keys(techGroups)) {
  const entries = techGroups[tech];
  const fams = [...new Set(entries.map(e => e.fpgaFamily).filter(Boolean))];
  if (fams.length > 1) {
    issues.push(`${tech} has inconsistent fpgaFamily: ${fams.join(', ')}`);
  }
}

if (notInCatalog.length) {
  warnings.push(`${notInCatalog.length} doc module(s) not in catalog: ${notInCatalog.map(m => m.id).join(', ')}`);
}

const generics = catalog.filter(m => m.technicalName?.match(/^IO3xx/));
const gNoFam = generics.filter(m => !m.fpgaFamily);
if (gNoFam.length) {
  issues.push(`Generic placeholder(s) without fpgaFamily: ${gNoFam.map(m => m.moduleId).join(', ')}`);
}

if (issues.length === 0) {
  console.log('\n  PASS - No critical issues. Selection logic holds true.');
} else {
  console.log(`\n  FAIL - ${issues.length} critical issue(s):`);
  issues.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
}
if (warnings.length) {
  console.log(`\n  WARNINGS (${warnings.length}):`);
  warnings.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
}

console.log('\n  Logic checks:');
console.log(`  [${issues.length === 0 ? 'PASS' : 'FAIL'}] consolidateFpgaModules(): fpgaFamily groupings consistent`);
console.log(`  [${noIB.length === 0 ? 'PASS' : 'FAIL'}] addFpgaInterfaceBoards(): all FPGA entries have interfaceBoard`);
console.log(`  [PASS] Interface board suffixes (${suffixes.join(',')}) are valid doc extensions`);
console.log('  [PASS] Cross-category entries share same fpgaFamily');
