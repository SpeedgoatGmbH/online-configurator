/**
 * Extract structured data from crawled Speedgoat documentation pages.
 * Produces a JSON file with:
 *  - FPGA/Configurable IO modules (IO306..IO397) with specs
 *  - Simulink-Programmable FPGA IO modules (IO324..IO342)
 *  - IO interface boards (IO33X-1 through IO33X-8)
 *  - IO interface extensions (-21, -22, -24, -40, -120)
 *  - Fixed-functionality IO modules (analog, digital)
 *  - Communication protocol modules
 *  - IO Configuration Packages (HIL, RCP, Communication configs)
 *  - Other modules (battery, encoder, vibration, etc.)
 */
const fs = require("fs");
const path = require("path");

const pagesDir = path.join(process.cwd(), "crawl-output-docs", "pages");

function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name.endsWith(".html")) results.push(full);
  }
  return results;
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractContentSection(text) {
  const startMarker = "View other versions";
  const endMarker = "Follow Speedgoat";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker, startIdx > -1 ? startIdx : 0);
  if (startIdx > -1 && endIdx > -1) {
    return text.slice(startIdx + startMarker.length, endIdx).trim();
  }
  return text;
}

/** Parse specs from a description string like "200k of logic cells, 32 TTL I/O lines..." */
function parseSpecsFromDesc(desc) {
  if (!desc) return {};
  const specs = {};

  // Logic cells: "25k logic cells" or "25k of logic cells" or "containing 25k"
  const lc = desc.match(/(\d+k)\s*(?:of\s+)?logic cells/i);
  if (lc) specs.logicCells = lc[1];

  // Analog inputs: "8 x 16-bit differential analog inputs" or "32/16 x 16-bit single-ended/differential analog inputs"
  const ai = desc.match(/(\d+(?:\/\d+)?)\s*x\s*(\d+)-bit\s*(?:differential\s*)?(?:simultaneous\s*)?(?:single-ended\/differential\s*)?analog\s*input/i);
  if (ai) { specs.analogInputChannels = ai[1]; specs.analogInputBits = parseInt(ai[2]); }

  // Analog outputs: "8 x 16-bit analog outputs"  
  const ao = desc.match(/(\d+)\s*x\s*(\d+)-bit\s*analog\s*output/i);
  if (ao) { specs.analogOutputChannels = parseInt(ao[1]); specs.analogOutputBits = parseInt(ao[2]); }

  // Digital: "64 ESD protected TTL I/O lines" or "64 x TTL I/O lines" or "32 x RS422 differential I/O lines"
  const dio = desc.match(/(\d+)\s*x?\s*(?:ESD protected\s*)?(?:LVDS|TTL|CMOS|RS422(?:\/RS485)?|digital)\s*(?:protected\s*)?(?:differential\s*)?(?:digital\s*)?I\/O\s*(?:lines|channels)/i);
  if (dio) specs.digitalIOLines = parseInt(dio[1]);

  // Mixed digital: "32 x TTL I/O lines and 16 x RS422/RS485 I/O lines"
  const mixedDig = desc.match(/(\d+)\s*x?\s*TTL\s*I\/O\s*lines\s*and\s*(\d+)\s*x?\s*(?:ESD protected\s*)?RS(?:422|485)/i);
  if (mixedDig) {
    specs.ttlLines = parseInt(mixedDig[1]);
    specs.rs422Lines = parseInt(mixedDig[2]);
    specs.digitalIOLines = specs.ttlLines + specs.rs422Lines;
  }

  // LVDS: "4 x LVDS digital I/O channels"
  const lvds = desc.match(/(\d+)\s*x?\s*LVDS\s*(?:digital\s*)?I\/O/i);
  if (lvds) specs.lvdsChannels = parseInt(lvds[1]);

  // Optional I/O interfaces
  if (/optional I\/O interfaces/i.test(desc)) specs.hasOptionalInterfaces = true;
  if (/I\/O interface extensions/i.test(desc)) specs.hasInterfaceExtensions = true;

  // FMC slots
  const fmc = desc.match(/(\d+)\s*FMC\s*slot/i);
  if (fmc) specs.fmcSlots = parseInt(fmc[1]);

  return specs;
}

const files = walk(pagesDir);
console.log(`Found ${files.length} crawled HTML pages`);

const result = {
  meta: {
    source: "https://www.speedgoat.com/help/slrt/page/",
    extractedAt: new Date().toISOString().slice(0, 10),
    totalPages: files.length,
  },
  fpgaModules: [],
  ioInterfaces: [],
  ioInterfaceExtensions: [],
  analogModules: [],
  digitalModules: [],
  communicationModules: [],
  configPackages: [],
  otherModuleInfo: [],
};

// ── 1. Parse FPGA/configurable IO module detail pages ──
// Matches both "refentry_ref_io337_650k.html" AND "refentry_ref_io331.html" (no size)
const fpgaPagePattern = /refentry_ref_io(\d{3}[a-c]?)(?:[-_](\d+k?))?\.html$/;
for (const file of files) {
  const match = file.match(fpgaPagePattern);
  if (!match) continue;
  // Only IO3xx are FPGA/configurable
  const ioNum = parseInt(match[1].replace(/[a-c]$/, ""));
  if (ioNum < 300 || ioNum > 399) continue;

  const moduleId = `IO${match[1].toUpperCase()}`;
  const fpgaSizeFromFile = match[2] || null;
  const html = fs.readFileSync(file, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);

  // Extract description from the dash-separated title: "IO337-650k — The IO337-650k is a ..."
  let description = null;
  // First try: "IO337-650k — The IO337-650k is a configurable I/O module containing..."
  const descMatch = content.match(/IO\d{3}[a-c]?(?:[-_]\w+)?\s*[—–-]\s*(?:The\s+)?IO\d{3}[a-c]?(?:[-_]\w+)?\s+is\s+(?:a\s+)?(.+?)(?:\s+Introduction|\s+Note\s)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    // Fallback: just grab after the dash
    const fallback = content.match(/IO\d{3}[a-c]?(?:[-_]\w+)?\s*[—–-]\s*(.+?)(?:\s+Introduction|\s+Note\s)/i);
    if (fallback) description = fallback[1].trim();
  }

  const specs = parseSpecsFromDesc(description);
  const fpgaSize = specs.logicCells || fpgaSizeFromFile;

  // Extract driver blocks
  const driverSection = content.match(/Driver Blocks\s+([\s\S]*?)(?:Pin Mapping|Examples|I\/O Configuration|$)/i);
  const driverBlocks = driverSection
    ? [...new Set(driverSection[1].match(/(?:Analog|Digital|Setup|DMA|Interrupt|PWM|Quadrature|BiSS|SSI|EnDat|Serial|SPI|I2C|SENT|Cam|Crank|Resolver|Pulse|DShot|CMU)\s+(?:Input|Output|Setup|Controller|Capture|Generation|Counter|Master|Slave|Sniffer)?(?:\s+v\d+)?/gi) || [])]
    : [];

  // Build fullName
  const fullName = fpgaSize ? `${moduleId}-${fpgaSize}` : moduleId;

  // Category: Simulink-programmable vs. Configurable
  const isSimulinkProgrammable = /Simulink.programmable|HDL Coder/i.test(content);
  const category = isSimulinkProgrammable ? "simulink-programmable" : "configurable";

  result.fpgaModules.push({
    moduleId,
    fpgaSize: fpgaSize || "unknown",
    fullName,
    description,
    category,
    ...specs,
    driverBlocks,
    sourcePage: path.relative(pagesDir, file),
  });
}

// ── 2. Enrich from Configurable IO and Simulink-Programmable overview pages ──
const overviewPages = [
  files.find(f => f.endsWith("refentry_configurable_io.html")),
  files.find(f => f.endsWith("refentry_simulink_programmable_fpga_io.html")),
];
for (const pageFile of overviewPages) {
  if (!pageFile) continue;
  const html = fs.readFileSync(pageFile, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);
  const isSimulinkProg = pageFile.includes("simulink_programmable");

  // Match entries like "IO337-650k The IO337-650k is a configurable I/O module containing 650k logic cells..."
  // Use a broad pattern that captures up to the next IO module entry or section header
  const entryPattern = /IO(\d{3}[A-C]?)[-_](\w+)\s+(?:The\s+)?IO\d{3}[A-C]?[-_]\w+\s+is\s+(?:a\s+)?(.+?)(?=\s+IO\d{3}|\s+Pulse\s+I\/O|\s+HDL\s+I\/O|\s+Note\s|$)/gi;
  let m;
  while ((m = entryPattern.exec(content)) !== null) {
    const modId = `IO${m[1].toUpperCase()}`;
    const suffix = m[2];
    const desc = m[3].trim();
    const specs = parseSpecsFromDesc(desc);
    const fullName = `${modId}-${suffix}`;

    // Try to match an existing entry
    const existing = result.fpgaModules.find(f => f.fullName === fullName || (f.moduleId === modId && f.fpgaSize === suffix));
    if (existing) {
      if (!existing.overviewDescription) existing.overviewDescription = desc;
      // Fill in any missing specs from overview
      for (const [k, v] of Object.entries(specs)) {
        if (existing[k] === null || existing[k] === undefined) existing[k] = v;
      }
      if (isSimulinkProg) existing.category = "simulink-programmable";
    } else {
      // New module from overview not found as detail page
      result.fpgaModules.push({
        moduleId: modId,
        fpgaSize: specs.logicCells || suffix,
        fullName,
        description: desc,
        category: isSimulinkProg ? "simulink-programmable" : "configurable",
        ...specs,
        driverBlocks: [],
        sourcePage: path.relative(pagesDir, pageFile),
      });
    }
  }
}

// ── 3. Parse IO Interfaces page (IO33X-1 through IO33X-8) ──
const interfacesFile = files.find(f => f.includes("refentry_ref_io_interfaces") && !f.includes("extensions"));
if (interfacesFile) {
  const html = fs.readFileSync(interfacesFile, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);

  // Split by IO33X- entries (the content is well-structured)
  const interfacePattern = /IO33X[-_](\d+(?:[-_]LV)?)\s*:\s*(.+?)(?=IO33X[-_]\d|Note|Driver|Pin Mapping|Follow|$)/gi;
  let m;
  while ((m = interfacePattern.exec(content)) !== null) {
    const suffix = m[1].trim();
    const desc = m[2].trim();

    // Parse channel info
    const channelMatch = desc.match(/(\d+)\s*x\s*(.+?)(?:\s+front|\s+I\/O|\s+lines)/i);
    const adcMatch = desc.match(/(\d+)\s*x\s*(\d+)-bit\s*(\d+\s*(?:k|M)Hz)?\s*(?:ADs?|analog\s*(?:inputs?|outputs?))/gi);

    result.ioInterfaces.push({
      interfaceId: `IO33X-${suffix}`,
      description: desc,
      channelCount: channelMatch ? parseInt(channelMatch[1]) : null,
      channelType: channelMatch ? channelMatch[2].trim() : null,
      hasAnalog: /analog|AD|DA/i.test(desc),
      hasDigital: /TTL|LVTTL|CMOS|RS485|RS422|LVDS|digital/i.test(desc),
    });
  }
} else {
  console.log("  WARNING: IO interfaces page not found");
}

// ── 4. Parse IO Interface Extensions page (-21, -22, -24, -40, -120) ──
const extensionsFile = files.find(f => f.includes("refentry_ref_io_interface_extensions"));
if (extensionsFile) {
  const html = fs.readFileSync(extensionsFile, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);

  // Split content by extension IDs: "-21 :", "-22 :", etc.
  // Use split-based approach for reliable parsing
  const parts = content.split(/(?=\s-(\d+)\s*:)/);
  for (const part of parts) {
    const extMatch = part.match(/^\s*-(\d+)\s*:\s*(.+)/s);
    if (!extMatch) continue;
    const suffix = extMatch[1];
    // Get description up to the next -NN: or Note or Pin or Examples
    let desc = extMatch[2].replace(/\s*(?:-\d+\s*:.*|Note\s.*|Pin Mapping.*|Examples.*)$/s, "").trim();

    // Classify
    let type = null;
    if (/Resolver/i.test(desc)) type = "Resolver-to-Digital Converter + Signal Conditioning";
    else if (/TTL/i.test(desc) && !/RS422|RS485|Resolver|A2B|analog/i.test(desc)) type = "TTL Signal Conditioning";
    else if (/RS422|RS485/i.test(desc) && /TTL/i.test(desc)) type = "RS422/RS485/TTL Signal Conditioning";
    else if (/A2B/i.test(desc)) type = "A2B (Automotive Audio Bus)";
    else if (/analog/i.test(desc)) type = "Analog I/O Extension";

    result.ioInterfaceExtensions.push({
      extensionId: `-${suffix}`,
      description: desc,
      type,
      hasAnalog: /analog/i.test(desc),
      hasDigital: /TTL|RS422|RS485|LVCMOS/i.test(desc),
    });
  }
} else {
  console.log("  WARNING: IO interface extensions page not found");
}

// ── 5. Parse Analog landing page ──
const analogFile = files.find(f => f.includes("refentry_analog_landing"));
if (analogFile) {
  const html = fs.readFileSync(analogFile, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);

  // Pattern: "IO101 16-bit analog module with ..." or "IO101 very fast 16-bit..."
  const modulePattern = /IO(\d{3}(?:[-_]\d+)?[A-B]?)\s+(.+?)(?=\s+IO\d{3}|$)/gi;
  let m;
  while ((m = modulePattern.exec(content)) !== null) {
    const moduleId = `IO${m[1]}`;
    const desc = m[2].trim();
    // Skip if this is just a section header
    if (desc.length < 15 || /^Analog I\/O|^Thermocouple/i.test(desc)) continue;
    if (!result.analogModules.find(a => a.moduleId === moduleId)) {
      // Parse analog specs
      const aiMatch = desc.match(/(\d+)(?:\/\d+)?\s*(?:sequential|multiplexed|simultaneous|differential|single-ended)?\s*(?:sampling\s*)?analog\s*input/i);
      const aoMatch = desc.match(/(\d+)\s*(?:differential\s*)?analog\s*output/i);
      const bits = (desc.match(/(\d+)-bit/i) || [])[1];
      result.analogModules.push({
        moduleId,
        description: desc.slice(0, 200),
        category: "analog",
        resolutionBits: bits ? parseInt(bits) : null,
        analogInputChannels: aiMatch ? parseInt(aiMatch[1]) : null,
        analogOutputChannels: aoMatch ? parseInt(aoMatch[1]) : null,
      });
    }
  }
}

// ── 6. Parse Digital landing page ──
const digitalFile = files.find(f => f.includes("refentry_digital_landing"));
if (digitalFile) {
  const html = fs.readFileSync(digitalFile, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);

  // Format: "IO203 The IO203 is a digital I/O module providing..." or "IO290 Digital I/O module with..."
  const modulePattern = /IO(\d{3})\s+(?:The\s+IO\d{3}\s+(?:is\s+(?:a\s+)?)?|(?=Digital))?(.+?)(?=\s+IO\d{3}\s|$)/gi;
  let m;
  while ((m = modulePattern.exec(content)) !== null) {
    const moduleId = `IO${m[1]}`;
    let desc = m[2].trim();
    // Clean up leading "I/O module" if present
    desc = desc.replace(/^(?:is\s+(?:a\s+)?)?/, "").trim();
    if (desc.length < 15 || /^Digital I\/O\s*$/i.test(desc)) continue;
    if (!result.digitalModules.find(a => a.moduleId === moduleId)) {
      const channels = (desc.match(/(\d+)\s*(?:TTL|digital|24V)/i) || [])[1];
      result.digitalModules.push({
        moduleId,
        description: desc.slice(0, 200),
        category: "digital",
        totalChannels: channels ? parseInt(channels) : null,
      });
    }
  }
}

// ── 7. Parse Communication landing pages ──
const commPatterns = [
  "ethercat", "can_", "canopen", "profin", "profibus", "arinc", "flexray",
  "iec61850", "mqtt", "opcua", "powerlink", "psi5", "mvb", "mil-std",
  "dnp3", "gnss", "ethernet_ip", "serial", "shared_memory", "comms",
  "restbus", "sdlc", "tsn", "mb_", "ethernet_interface",
];
const commFiles = files.filter(f => commPatterns.some(p => f.includes(p)));
for (const file of commFiles) {
  const html = fs.readFileSync(file, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);
  const pageName = path.basename(file, ".html").replace("refentry_", "").replace("_landing", "");

  // Look for IO module references with descriptions
  const modulePattern = /IO(\d{3}[A-Z]?)\s+(?:The\s+)?(?:IO\d{3}[A-Z]?\s+(?:is\s+)?(?:a\s+)?)?(.+?)(?=\s+IO\d{3}|Usage|Code Module|Driver|Note|$)/gi;
  let m;
  while ((m = modulePattern.exec(content)) !== null) {
    const moduleId = `IO${m[1]}`;
    const desc = m[2].trim();
    if (desc.length < 10) continue;
    if (!result.communicationModules.find(a => a.moduleId === moduleId && a.protocol === pageName)) {
      result.communicationModules.push({
        moduleId,
        description: desc.slice(0, 200),
        protocol: pageName,
        category: "communication",
      });
    }
  }
}

// ── 8. Parse IO Configuration Packages ──
const configPkgFile = files.find(f => f.includes("refentry_ch_configurations"));
if (configPkgFile) {
  const html = fs.readFileSync(configPkgFile, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);

  // Parse entries grouped by IO module
  // Pattern: "IO306 Configuration Package" followed by config entries
  const pkgSections = content.split(/IO(\d{3})\s+Configuration\s+Package/i);
  for (let i = 1; i < pkgSections.length; i += 2) {
    const modNum = pkgSections[i];
    const section = pkgSections[i + 1] || "";
    
    // Parse individual configs: "HIL TTL:" or "Communication:" etc.
    const configPattern = /([A-Z][\w\s]+?):\s*(.+?)(?=\s+[A-Z][\w\s]+?:\s|$)/gi;
    let m;
    while ((m = configPattern.exec(section)) !== null) {
      const configName = m[1].trim();
      const configDesc = m[2].trim();
      if (configName.length > 50 || configDesc.length < 20) continue;
      result.configPackages.push({
        moduleId: `IO${modNum}`,
        configName,
        description: configDesc.slice(0, 300),
      });
    }
  }
}

// ── 9. Parse other category landing pages ──
const otherLandingPatterns = [
  "refentry_battery", "refentry_fault", "refentry_relay", "refentry_resistor",
  "refentry_timing", "refentry_vibrat", "refentry_encoder", "refentry_audio",
  "refentry_lvdt", "refentry_temperature", "refentry_signal_condition", "refentry_video",
];
const otherLandings = files.filter(f => otherLandingPatterns.some(p => f.includes(p)));
for (const file of otherLandings) {
  const html = fs.readFileSync(file, "utf8");
  const text = stripHtml(html);
  const content = extractContentSection(text);
  const pageName = path.basename(file, ".html").replace("refentry_", "").replace("_landing", "").replace("_etc", "");

  const modulePattern = /IO(\d{3}[A-Z]?)\s+(?:The\s+)?(?:IO\d{3}[A-Z]?\s+(?:is\s+)?(?:a\s+)?)?(.+?)(?=\s+IO\d{3}|$)/gi;
  let m;
  while ((m = modulePattern.exec(content)) !== null) {
    const moduleId = `IO${m[1]}`;
    const desc = m[2].trim();
    if (desc.length < 10) continue;
    result.otherModuleInfo.push({
      moduleId,
      description: desc.slice(0, 200),
      category: pageName,
    });
  }
}

// ── Summary ──
console.log(`\nExtracted:`);
console.log(`  FPGA/Configurable modules: ${result.fpgaModules.length}`);
console.log(`  IO Interfaces (IO33X-N):   ${result.ioInterfaces.length}`);
console.log(`  IO Interface Extensions:   ${result.ioInterfaceExtensions.length}`);
console.log(`  Analog modules:            ${result.analogModules.length}`);
console.log(`  Digital modules:           ${result.digitalModules.length}`);
console.log(`  Communication modules:     ${result.communicationModules.length}`);
console.log(`  Config packages:           ${result.configPackages.length}`);
console.log(`  Other module info:         ${result.otherModuleInfo.length}`);

console.log(`\n  ── FPGA/Configurable Modules ──`);
for (const mod of result.fpgaModules.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
  const ai = mod.analogInputChannels || "-";
  const ao = mod.analogOutputChannels || "-";
  const dio = mod.digitalIOLines || "-";
  const lc = mod.logicCells || mod.fpgaSize || "?";
  const cat = mod.category === "simulink-programmable" ? " [HDL]" : "";
  console.log(`    ${mod.fullName.padEnd(18)} ${lc.toString().padEnd(7)} LC | AI:${String(ai).padEnd(5)} AO:${String(ao).padEnd(4)} DIO:${String(dio).padEnd(4)}${cat}`);
}

console.log(`\n  ── IO Interface Boards ──`);
for (const iface of result.ioInterfaces) {
  console.log(`    ${iface.interfaceId.padEnd(14)} ${iface.description.slice(0, 80)}`);
}

console.log(`\n  ── IO Interface Extensions ──`);
for (const ext of result.ioInterfaceExtensions) {
  console.log(`    ${ext.extensionId.padEnd(6)} [${ext.type || "?"}] ${ext.description.slice(0, 70)}`);
}

console.log(`\n  ── Analog Modules ──`);
for (const mod of result.analogModules) {
  console.log(`    ${mod.moduleId.padEnd(10)} ${mod.description.slice(0, 90)}`);
}

console.log(`\n  ── Digital Modules ──`);
for (const mod of result.digitalModules) {
  console.log(`    ${mod.moduleId.padEnd(10)} ${mod.description.slice(0, 90)}`);
}

console.log(`\n  ── Config Packages (sample) ──`);
const samplePkgs = result.configPackages.slice(0, 10);
for (const pkg of samplePkgs) {
  console.log(`    ${pkg.moduleId} / ${pkg.configName}: ${pkg.description.slice(0, 80)}`);
}
if (result.configPackages.length > 10) console.log(`    ... ${result.configPackages.length - 10} more`);

const outPath = path.join(process.cwd(), "scripts", "scrape-web", "docExtractedData.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
console.log(`\nSaved to ${outPath}`);
