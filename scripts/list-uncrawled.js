/* List all discovered but uncrawled /help/slrt/ links, grouped by type */
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
const allLinks = new Set();
for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  const re = /href="([^"]*\/help\/slrt\/[^"]*?)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Normalize relative paths
    let link = m[1];
    if (link.includes("/../")) {
      // skip cross-doc links
      continue;
    }
    allLinks.add(link);
  }
}

const sorted = [...allLinks].sort();

// Group by category
const groups = {
  "IO module detail pages": [],
  "Analog": [],
  "Digital": [],
  "Communications": [],
  "FPGA / Configurable": [],
  "Utilities": [],
  "Configuration": [],
  "Other": [],
};

for (const link of sorted) {
  if (link.includes("refentry_ref_io") || /\/refentry_ref_io\d/.test(link)) {
    groups["IO module detail pages"].push(link);
  } else if (link.includes("analog")) {
    groups["Analog"].push(link);
  } else if (link.includes("digital")) {
    groups["Digital"].push(link);
  } else if (link.includes("comms") || link.includes("ethercat") || link.includes("can_") || link.includes("profin") || link.includes("profibus") || link.includes("udp") || link.includes("arinc") || link.includes("flexray") || link.includes("iec61850") || link.includes("mqtt") || link.includes("modbus") || link.includes("mb_") || link.includes("opcua") || link.includes("powerlink") || link.includes("psi5") || link.includes("mvb") || link.includes("ethernet") || link.includes("dnp3") || link.includes("mil-std") || link.includes("gnss") || link.includes("ethernet_ip")) {
    groups["Communications"].push(link);
  } else if (link.includes("fpga") || link.includes("config") || link.includes("hdl")) {
    groups["FPGA / Configurable"].push(link);
  } else if (link.includes("utilit") || link.includes("tool")) {
    groups["Utilities"].push(link);
  } else {
    groups["Other"].push(link);
  }
}

for (const [name, links] of Object.entries(groups)) {
  if (links.length === 0) continue;
  console.log(`\n=== ${name} (${links.length}) ===`);
  links.forEach((l) => console.log("  " + l));
}

console.log(`\nTotal: ${sorted.length} unique links`);
