/* eslint-disable no-console */
const crypto = require("crypto");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const readline = require("readline");

// Load .env.local if present (simple key=value parser, no dependency needed)
(function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fsSync.existsSync(envPath)) return;
  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Don't override explicitly set env vars
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  console.log("[env] Loaded .env.local");
})();

function toBool(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return `${value}`.toLowerCase() === "true";
}

function toInt(value, defaultValue) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canonicalize(url, includeQuery) {
  const normalized = new URL(url.toString());
  normalized.hash = "";
  if (!includeQuery) normalized.search = "";
  if (normalized.pathname.length > 1 && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.slice(0, -1);
  }
  return normalized.toString();
}

function isAllowed(url, allowedHost, pathPrefix) {
  if (url.host !== allowedHost) return false;
  if (pathPrefix && !url.pathname.startsWith(pathPrefix)) return false;
  return true;
}

function safeSegment(segment) {
  return segment.replace(/[^\w.-]+/g, "_");
}

function toSafeHtmlPath(outputDir, url, includeQuery) {
  const rawSegments = url.pathname.split("/").filter(Boolean);
  const safeSegments = rawSegments.map(safeSegment);
  if (safeSegments.length === 0) safeSegments.push("home");

  const file = safeSegments.pop();
  const dir = path.join(outputDir, "pages", ...safeSegments);
  const querySuffix =
    includeQuery && url.search
      ? `__${safeSegment(url.search.slice(1))}`
      : "";
  const filePath = path.join(dir, `${file}${querySuffix}.html`);
  return { dir, filePath };
}

function sha1(text) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

async function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question(prompt, () => resolve()));
  rl.close();
}

async function main() {
  let playwright;
  try {
    // eslint-disable-next-line global-require
    playwright = require("playwright");
  } catch (error) {
    console.error(
      "Playwright is not installed. Install it in this repo:\n" +
        "  npm i -D playwright\n" +
        "  npx playwright install chromium\n",
    );
    throw error;
  }

  const START_URL =
    process.env.CRAWL_START_URL || "https://www.speedgoat.com/extranet/home";
  const allowedHost = process.env.CRAWL_ALLOWED_HOST || new URL(START_URL).host;
  const pathPrefix = process.env.CRAWL_PATH_PREFIX || "/extranet";

  const outputDir =
    process.env.CRAWL_OUTPUT_DIR ||
    path.join(process.cwd(), "crawl-output-playwright");

  const maxPages = Math.max(1, toInt(process.env.CRAWL_MAX_PAGES, 50));
  const delayMs = Math.max(0, toInt(process.env.CRAWL_DELAY_MS, 400));
  const includeQuery = toBool(process.env.CRAWL_INCLUDE_QUERY, false);

  const headless = toBool(process.env.CRAWL_HEADLESS, false);
  const waitUntil = process.env.CRAWL_WAIT_UNTIL || "domcontentloaded";
  const navigationTimeoutMs = Math.max(
    5_000,
    toInt(process.env.CRAWL_NAV_TIMEOUT_MS, 60_000),
  );
  const renderDelayMs = Math.max(0, toInt(process.env.CRAWL_RENDER_DELAY_MS, 250));

  const blockAssets = toBool(process.env.CRAWL_BLOCK_ASSETS, true);
  const saveJsonResponses = toBool(process.env.CRAWL_SAVE_JSON, false);
  const maxJsonBytes = Math.max(1_024, toInt(process.env.CRAWL_MAX_JSON_BYTES, 5_000_000));

  const loginUsername = process.env.CRAWL_USERNAME || "";
  const loginPassword = process.env.CRAWL_PASSWORD || "";
  const loginUsernameSelector =
    process.env.CRAWL_USERNAME_SELECTOR ||
    'input[type="email"], input[name="email"], input[name="username"], input#username, input[name="UserName"], input[name="Email"]';
  const loginPasswordSelector =
    process.env.CRAWL_PASSWORD_SELECTOR || 'input[type="password"]';
  const loginSubmitSelector =
    process.env.CRAWL_SUBMIT_SELECTOR ||
    'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")';

  const loginPoll = toBool(process.env.CRAWL_LOGIN_POLL, false);
  const loginPollTimeoutMs = Math.max(
    10_000,
    toInt(process.env.CRAWL_LOGIN_POLL_TIMEOUT_MS, 300_000),
  );

  const userDataDir =
    process.env.CRAWL_USER_DATA_DIR || path.join(outputDir, "profile");

  await fs.mkdir(path.join(outputDir, "pages"), { recursive: true });
  if (saveJsonResponses) {
    await fs.mkdir(path.join(outputDir, "api"), { recursive: true });
  }

  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1280, height: 800 },
  });

  context.setDefaultNavigationTimeout(navigationTimeoutMs);
  context.setDefaultTimeout(navigationTimeoutMs);

  if (blockAssets) {
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font" || type === "media") {
        return route.abort();
      }
      return route.continue();
    });
  }

  const apiCaptures = [];
  if (saveJsonResponses) {
    context.on("response", async (response) => {
      try {
        const url = new URL(response.url());
        if (url.host !== allowedHost) return;
        const headers = response.headers();
        const contentType = `${headers["content-type"] || ""}`.toLowerCase();
        if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
          return;
        }

        const buffer = await response.body();
        if (buffer.length > maxJsonBytes) return;

        const key = sha1(`${response.status()}|${response.url()}|${buffer.length}`);
        const filePath = path.join(outputDir, "api", `${key}.json`);
        await fs.writeFile(filePath, buffer);
        apiCaptures.push({
          url: response.url(),
          status: response.status(),
          contentType,
          filePath: path.relative(process.cwd(), filePath),
        });
      } catch {
        // Best-effort capture only.
      }
    });
  }

  // Use existing page from persistent context, or open a fresh one
  let page = context.pages()[0];
  if (!page) {
    page = await context.newPage();
  }

  const queue = [canonicalize(new URL(START_URL), includeQuery)];
  const visited = new Set();
  const pages = [];

  async function isAuthenticatedPage() {
    const currentUrl = new URL(page.url());
    const onSite = currentUrl.host === allowedHost && currentUrl.pathname.startsWith(pathPrefix);
    if (!onSite) return false;
    const hasPasswordField = (await page.locator('input[type="password"]').count()) > 0;
    if (hasPasswordField) return false;
    // Also catch inline login-wall text (e.g. /help pages)
    const hasLoginWall = await page.evaluate(() =>
      /customer only.*login|please login/i.test(document.body?.innerText ?? "")
    ).catch(() => false);
    return !hasLoginWall;
  }

  async function tryAutomatedLogin() {
    if (!loginUsername || !loginPassword) return false;

    try {
      const passwordField = page.locator(loginPasswordSelector).first();
      if ((await passwordField.count()) === 0) return false;

      const usernameField = page.locator(loginUsernameSelector).first();
      if ((await usernameField.count()) > 0) {
        await usernameField.fill(loginUsername);
      }
      await passwordField.fill(loginPassword);

      const submit = page.locator(loginSubmitSelector).first();
      if ((await submit.count()) > 0) {
        await submit.click();
      } else {
        await page.keyboard.press("Enter");
      }

      await page.waitForLoadState("domcontentloaded").catch(() => {});
      if (renderDelayMs > 0) await sleep(renderDelayMs);
      return true;
    } catch {
      return false;
    }
  }

  async function maybeHandleLogin() {
    if (await tryAutomatedLogin()) {
      if (await isAuthenticatedPage()) {
        console.log("[login] Automated login submitted (CRAWL_USERNAME/CRAWL_PASSWORD).");
        return;
      }
    }

    if (await isAuthenticatedPage()) return;

    if (headless && !loginPoll) {
      throw new Error(
        `Looks like you are not logged in (current URL: ${page.url()}). Re-run with CRAWL_HEADLESS=false or CRAWL_LOGIN_POLL=true to log in manually.`,
      );
    }

    if (loginPoll) {
      console.log(`[login] Polling for login completion (timeout: ${loginPollTimeoutMs / 1000}s)...`);
      console.log(`[login] Complete login in the browser window: ${page.url()}`);
      const deadline = Date.now() + loginPollTimeoutMs;
      while (!(await isAuthenticatedPage())) {
        if (Date.now() > deadline) {
          throw new Error(`Login poll timed out after ${loginPollTimeoutMs / 1000}s (current URL: ${page.url()}).`);
        }
        await sleep(2000);
      }
      console.log("[login] Login detected via polling.");
    } else {
      console.log(`\n[login] Please complete login in the browser window: ${page.url()}`);
      await waitForEnter("[login] Press Enter here after you are fully logged in... ");
      if (!(await isAuthenticatedPage())) {
        throw new Error(`Login not completed (current URL: ${page.url()}).`);
      }
    }
  }

  console.log(`[init] Output: ${outputDir}`);
  console.log(`[init] Start: ${START_URL}`);
  console.log(`[init] Profile: ${userDataDir}`);

  await page.goto(START_URL, { waitUntil });
  if (renderDelayMs > 0) await sleep(renderDelayMs);
  await maybeHandleLogin();

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    let status = 0;
    let contentType = "";

    try {
      // Check if page is still usable; if browser tab was closed, create a new one
      try {
        await page.evaluate(() => true);
      } catch {
        console.log("[recover] Page was closed, opening new tab...");
        page = await context.newPage();
      }

      const response = await page.goto(current, { waitUntil });
      status = response?.status() ?? 0;
      contentType = response?.headers()?.["content-type"] || "";
      if (renderDelayMs > 0) await sleep(renderDelayMs);
      // Re-check login only on pages under pathPrefix
      const currentPathObj = new URL(page.url());
      if (currentPathObj.pathname.startsWith(pathPrefix)) {
        await maybeHandleLogin();
      }
    } catch (error) {
      // If context/browser is fully dead, break out of the loop
      const errStr = `${error}`;
      if (errStr.includes("browser has been closed") || errStr.includes("Target closed") || errStr.includes("context or browser")) {
        try {
          page = await context.newPage();
          console.log(`[recover] Reopened page after error on ${current}`);
        } catch {
          console.log(`[fatal] Browser context is dead, stopping crawl.`);
          break;
        }
      }
      pages.push({ url: current, status, contentType, error: errStr });
      console.log(`[error] ${current} -> ${error}`);
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    let html;
    try {
      html = await page.content();
    } catch (err) {
      pages.push({ url: current, status, contentType, error: `content(): ${err}` });
      console.log(`[error] ${current} -> content() failed: ${err}`);
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }
    const urlObj = new URL(current);
    const saveTarget = toSafeHtmlPath(outputDir, urlObj, includeQuery);
    await fs.mkdir(saveTarget.dir, { recursive: true });
    await fs.writeFile(saveTarget.filePath, html, "utf8");

    const title = await page.title().catch(() => null);
    const h1 = await page
      .locator("h1")
      .first()
      .innerText()
      .then((t) => t.trim())
      .catch(() => null);
    const textPreview = await page
      .evaluate(() => (document.body ? document.body.innerText : ""))
      .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 400))
      .catch(() => null);

    const rawLinks = await page
      .$$eval("a[href]", (elements) => elements.map((a) => a.href))
      .catch(() => []);
    const links = [];
    for (const href of rawLinks) {
      try {
        const resolved = new URL(href);
        if (!isAllowed(resolved, allowedHost, pathPrefix)) continue;
        links.push(canonicalize(resolved, includeQuery));
      } catch {
        // ignore
      }
    }

    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }

    pages.push({
      url: current,
      navigatedUrl: page.url(),
      status,
      contentType,
      filePath: path.relative(process.cwd(), saveTarget.filePath),
      title,
      h1,
      textPreview,
      discoveredLinks: links.length,
    });

    console.log(`[ok] ${pages.length}/${maxPages} ${current} (${links.length} links)`);
    if (delayMs > 0) await sleep(delayMs);
  }

  await context.close();

  const manifest = {
    startedAt: new Date().toISOString(),
    config: {
      startUrl: START_URL,
      allowedHost,
      pathPrefix,
      maxPages,
      delayMs,
      includeQuery,
      headless,
      waitUntil,
      navigationTimeoutMs,
      renderDelayMs,
      blockAssets,
      saveJsonResponses,
      maxJsonBytes,
      automatedLogin: Boolean(loginUsername && loginPassword),
      loginSelectorsConfigured: Boolean(
        process.env.CRAWL_USERNAME_SELECTOR ||
          process.env.CRAWL_PASSWORD_SELECTOR ||
          process.env.CRAWL_SUBMIT_SELECTOR,
      ),
      userDataDir: path.relative(process.cwd(), userDataDir),
    },
    crawledPages: pages.length,
    discoveredUniqueUrls: visited.size,
    pages,
    apiCaptures,
  };

  const manifestPath = path.join(outputDir, "crawl-results.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nSaved crawl manifest: ${path.relative(process.cwd(), manifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
