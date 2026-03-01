/* eslint-disable no-console */
const fs = require("fs/promises");
const path = require("path");

if (typeof fetch !== "function") {
  throw new Error("This script requires Node.js 18+ (global fetch is missing).");
}

const START_URL =
  process.env.CRAWL_START_URL || "https://www.speedgoat.com/extranet/home";
const ALLOWED_HOST =
  process.env.CRAWL_ALLOWED_HOST || new URL(START_URL).host;
const PATH_PREFIX = process.env.CRAWL_PATH_PREFIX || "/extranet";
const OUTPUT_DIR =
  process.env.CRAWL_OUTPUT_DIR || path.join(process.cwd(), "crawl-output");
const MAX_PAGES = Math.max(
  1,
  Number.parseInt(process.env.CRAWL_MAX_PAGES || "50", 10),
);
const DELAY_MS = Math.max(
  0,
  Number.parseInt(process.env.CRAWL_DELAY_MS || "300", 10),
);
const COOKIE = process.env.CRAWL_COOKIE || "";
const INCLUDE_QUERY = `${process.env.CRAWL_INCLUDE_QUERY || "false"}`.toLowerCase() === "true";
const USER_AGENT =
  process.env.CRAWL_USER_AGENT ||
  "Mozilla/5.0 (compatible; SpeedgoatCrawler/1.0; +https://www.speedgoat.com)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canonicalize(url) {
  const normalized = new URL(url.toString());
  normalized.hash = "";
  if (!INCLUDE_QUERY) normalized.search = "";
  if (normalized.pathname.length > 1 && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.slice(0, -1);
  }
  return normalized.toString();
}

function isAllowed(url) {
  if (url.host !== ALLOWED_HOST) return false;
  if (PATH_PREFIX && !url.pathname.startsWith(PATH_PREFIX)) return false;
  return true;
}

function toSafePathname(url) {
  const rawSegments = url.pathname.split("/").filter(Boolean);
  const safeSegments = rawSegments.map((segment) =>
    segment.replace(/[^\w.-]+/g, "_"),
  );

  if (safeSegments.length === 0) {
    safeSegments.push("home");
  }

  const file = safeSegments.pop();
  const dir = path.join(OUTPUT_DIR, "pages", ...safeSegments);
  const querySuffix =
    INCLUDE_QUERY && url.search
      ? `__${url.search.slice(1).replace(/[^\w.-]+/g, "_")}`
      : "";
  const filePath = path.join(dir, `${file}${querySuffix}.html`);

  return { dir, filePath };
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractFirstMatch(html, regex) {
  const match = regex.exec(html);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const hrefRegex = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  for (;;) {
    const match = hrefRegex.exec(html);
    if (!match) break;

    const href = (match[1] || match[2] || match[3] || "").trim();
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    let resolved;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      continue;
    }

    if (!isAllowed(resolved)) continue;
    links.add(canonicalize(resolved));
  }

  return [...links];
}

async function crawl() {
  const queue = [canonicalize(new URL(START_URL))];
  const visited = new Set();
  const pages = [];

  await fs.mkdir(path.join(OUTPUT_DIR, "pages"), { recursive: true });

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const url = new URL(current);
    const headers = {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    };
    if (COOKIE) headers.Cookie = COOKIE;

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers,
        redirect: "follow",
      });
    } catch (error) {
      pages.push({
        url: current,
        status: 0,
        error: `${error}`,
      });
      console.log(`[error] ${current} -> ${error}`);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const pageInfo = {
      url: current,
      status: response.status,
      contentType,
      filePath: null,
      title: null,
      h1: null,
      textPreview: null,
      discoveredLinks: 0,
    };

    if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
      pages.push(pageInfo);
      console.log(`[skip] ${current} -> ${response.status} (${contentType || "unknown"})`);
      if (DELAY_MS > 0) await sleep(DELAY_MS);
      continue;
    }

    const html = await response.text();
    const saveTarget = toSafePathname(url);
    await fs.mkdir(saveTarget.dir, { recursive: true });
    await fs.writeFile(saveTarget.filePath, html, "utf8");

    const links = extractLinks(html, current);
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }

    pageInfo.filePath = path.relative(process.cwd(), saveTarget.filePath);
    pageInfo.title = extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    pageInfo.h1 = extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    pageInfo.textPreview = stripHtml(html).slice(0, 400);
    pageInfo.discoveredLinks = links.length;
    pages.push(pageInfo);

    console.log(
      `[ok] ${pages.length}/${MAX_PAGES} ${current} (${links.length} links)`,
    );

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const manifest = {
    startedAt: new Date().toISOString(),
    config: {
      startUrl: START_URL,
      allowedHost: ALLOWED_HOST,
      pathPrefix: PATH_PREFIX,
      maxPages: MAX_PAGES,
      delayMs: DELAY_MS,
      includeQuery: INCLUDE_QUERY,
      usedCookie: Boolean(COOKIE),
    },
    crawledPages: pages.length,
    discoveredUniqueUrls: visited.size,
    pages,
  };

  const manifestPath = path.join(OUTPUT_DIR, "crawl-results.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nSaved crawl manifest: ${path.relative(process.cwd(), manifestPath)}`);
}

crawl().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
