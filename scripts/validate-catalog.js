const fs = require('fs');
const src = fs.readFileSync('lib/proposal/mockCatalog.ts', 'utf8');
const doc = require('./scrape-web/docExtractedData.json');

function findAllOccurrences(moduleId) {
  const results = [];
  let idx = 0;
  const needle = `moduleId: '${moduleId}'`;
  while ((idx = src.indexOf(needle, idx)) !== -1) {
    const start = Math.max(0, idx - 10);
    const snippet = src.slice(start, idx + 600);
    const cat = snippet.match(/categoryCoverage:\s*'([^']+)'/)?.[1];
    const sub = snippet.match(/subCoverage:\s*\[([^\]]+)\]/)?.[1]?.replace(/'/g, '');
    const fpga = snippet.match(/fpgaFamily:\s*'([^']+)'/)?.[1] || 'none';
    const ib = snippet.match(/interfaceBoard.*?moduleId:\s*'([^']+)'/)?.[1] || 'none';
    const cap = snippet.match(/channelCapacity:\s*(\d+)/)?.[1];
    results.push({ cat, sub, fpga, ib, cap });
    idx += 10;
  }
  return results;
}

console.log("=== VALIDATION REPORT ===\n");

// 1. FPGA modules in docs but not used as fpgaFamily in catalog
const fpgaInCatalog = new Set([...src.matchAll(/fpgaFamily:\s*'(IO\d{3}[a-z]?)'/gi)].map(m => m[1]));
const docFPGA = [...new Set(doc.fpgaModules.map(m => m.moduleId))];
const missingFPGA = docFPGA.filter(id => !fpgaInCatalog.has(id) && !/[ABC]$/.test(id));
console.log("1. FPGA modules in docs but NOT in catalog as fpgaFamily:");
missingFPGA.forEach(id => {
  const d = doc.fpgaModules.find(m => m.moduleId === id);
  const inCatalog = findAllOccurrences(id);
  console.log(`   ${id} (${d?.fpgaSize || '?'} logic, ${d?.category}) - catalog entries: ${inCatalog.length}`);
  inCatalog.forEach(e => console.log(`      -> ${e.cat}/${e.sub} fpga=${e.fpga} ib=${e.ib}`));
});

// 2. Check IO325 and IO336 (Simulink-programmable, in docs, in catalog as analog)
console.log("\n2. IO325 and IO336 catalog presence:");
['IO325', 'IO336'].forEach(id => {
  const entries = findAllOccurrences(id);
  console.log(`   ${id}: ${entries.length} entries`);
  entries.forEach(e => console.log(`      -> ${e.cat}/${e.sub} cap=${e.cap} fpga=${e.fpga}`));
});

// 3. Check IO397 (50k Simulink-programmable, has many config packages)
console.log("\n3. IO397 catalog presence:");
const io397 = findAllOccurrences('IO397');
io397.forEach(e => console.log(`   -> ${e.cat}/${e.sub} cap=${e.cap} fpga=${e.fpga}`));
const io397gp = findAllOccurrences('IO397-GP');
io397gp.forEach(e => console.log(`   IO397-GP -> ${e.cat}/${e.sub} cap=${e.cap} fpga=${e.fpga}`));

// 4. Check IO3xx-Enc and IO3xx-Res (generic placeholders)
console.log("\n4. Generic placeholders:");
const enc = findAllOccurrences('IO3xx-Enc');
enc.forEach(e => console.log(`   IO3xx-Enc -> ${e.cat}/${e.sub} cap=${e.cap} fpga=${e.fpga}`));
const res = findAllOccurrences('IO3xx-Res');
res.forEach(e => console.log(`   IO3xx-Res -> ${e.cat}/${e.sub} cap=${e.cap} fpga=${e.fpga}`));

// 5. Interface board auto-assignment check
console.log("\n5. FPGA entries without explicit interfaceBoard (will use fallback {techName}-21):");
const blocks = src.split(/(?=\n\s+\{)/);
let missingIB = 0;
blocks.forEach(block => {
  const moduleId = block.match(/moduleId:\s*'([^']+)'/)?.[1];
  const fpga = block.match(/fpgaFamily:\s*'([^']+)'/)?.[1];
  const hasIB = block.includes('interfaceBoard:');
  if (fpga && !hasIB) {
    console.log(`   ${moduleId} (fpga=${fpga}) -> will get ${moduleId}-21 as fallback`);
    missingIB++;
  }
});
if (missingIB === 0) console.log("   All FPGA entries have explicit interfaceBoard.");

// 6. Key question: are the FPGA-backed entries for digital/motion/analog properly configured?
console.log("\n6. FPGA board multi-role coverage (same fpgaFamily across categories):");
const familyToCats = {};
blocks.forEach(block => {
  const fpga = block.match(/fpgaFamily:\s*'([^']+)'/)?.[1];
  const cat = block.match(/categoryCoverage:\s*'([^']+)'/)?.[1];
  const sub = block.match(/subCoverage:\s*\[([^\]]+)\]/)?.[1]?.replace(/'/g, '');
  if (fpga && cat) {
    if (!familyToCats[fpga]) familyToCats[fpga] = [];
    familyToCats[fpga].push(`${cat}/${sub}`);
  }
});
Object.keys(familyToCats).sort().forEach(fpga => {
  console.log(`   ${fpga}: ${familyToCats[fpga].join(' | ')}`);
});

// 7. Check config packages - which FPGA modules support which protocols
console.log("\n7. Config packages by FPGA module:");
const pkgByModule = {};
doc.configPackages.forEach(p => {
  if (!pkgByModule[p.moduleId]) pkgByModule[p.moduleId] = [];
  pkgByModule[p.moduleId].push(p.description?.slice(0, 60) || '?');
});
Object.keys(pkgByModule).sort().forEach(id => {
  console.log(`   ${id}: ${pkgByModule[id].length} packages`);
});
