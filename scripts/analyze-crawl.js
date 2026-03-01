/* Analyze crawled doc pages */
const fs = require("fs");
const path = require("path");

const pagesDir = path.join(process.cwd(), "crawl-output-docs", "pages");

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name.endsWith(".html")) results.push(full);
  }
  return results;
}

const files = walk(pagesDir);
console.log(`\n=== ${files.length} crawled HTML pages ===\n`);

const allInternalLinks = new Set();
const allIOModuleLinks = [];

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Extract internal /help/slrt/ links
  const hrefRegex = /href="([^"]*\/help\/slrt\/[^"]*?)"/g;
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    allInternalLinks.add(m[1]);
  }

  // Find IO module references (IO100, IO130-21, etc.)
  const ioRefs = [...new Set((text.match(/IO[ ]?\d{3}[A-Z]?(-\d+)?/gi) || []))];
  if (ioRefs.length > 0) {
    console.log(`${path.relative(pagesDir, file)}: ${ioRefs.length} IO refs → ${ioRefs.slice(0, 10).join(", ")}${ioRefs.length > 10 ? "..." : ""}`);
  }
}

// Look specifically for -21 interface board references
const allTexts = files.map(f => fs.readFileSync(f, "utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).join(" ");
const dash21Refs = [...new Set((allTexts.match(/IO\d{3}-\d+/gi) || []))].sort();
console.log(`\n=== ${dash21Refs.length} IO-xxx-yy variant references ===`);
dash21Refs.forEach(r => console.log("  " + r));

// Look for FPGA references
const fpgaRefs = [...new Set((allTexts.match(/(?:FPGA|HDL Coder|Simulink Programmable|configurable)[^.]{0,60}/gi) || []))];
console.log(`\n=== ${fpgaRefs.length} FPGA-related snippets ===`);
fpgaRefs.slice(0, 20).forEach(r => console.log("  " + r.trim().slice(0, 120)));

// Sort all discovered internal links
const sortedLinks = [...allInternalLinks].sort();
console.log(`\n=== ${sortedLinks.length} unique internal /help/slrt/ links discovered ===`);
// Show pages we haven't crawled yet
const crawledSet = new Set(files.map(f => {
  const rel = path.relative(pagesDir, f).replace(/\\/g, "/").replace(/\.html$/, "");
  return "/help/slrt/" + rel.replace(/\\/g, "/");
}));
const uncrawled = sortedLinks.filter(l => !crawledSet.has(l.split("?")[0].split("#")[0]));
console.log(`  Crawled: ${crawledSet.size}, Uncrawled: ${uncrawled.length}`);
uncrawled.slice(0, 60).forEach(l => console.log("  " + l));
