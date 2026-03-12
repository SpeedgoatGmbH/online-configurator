#!/usr/bin/env node
/**
 * check-website-essential.mjs
 *
 * ALLOWLIST mode – guards the PUBLIC remote (speedgoatgmbh).
 *
 * This repository has two remotes:
 *   • speedgoatgmbh  – PUBLIC repo, only website source code (this policy applies)
 *   • origin / other – PRIVATE / internal repo, no restrictions
 *
 * Only files matched by ALLOWED_PATTERNS below may be pushed to speedgoatgmbh.
 * Research artefacts, crawl outputs, internal docs, and tooling scripts are
 * kept on the private remote only.
 *
 * Usage – pipe a newline-separated list of file paths into this script:
 *   git diff --name-only <base> <head> | node scripts/check-website-essential.mjs
 *
 * To add new allowed paths, extend ALLOWED_PATTERNS below.
 * To run manually:  npm run check:push-policy
 */

import { createInterface } from 'readline';

/**
 * Paths that ARE allowed on the speedgoatgmbh remote.
 * Anything not matched here is blocked.
 */
const ALLOWED_PATTERNS = [
  // ── Next.js application source ──────────────────────────────────────────
  /^app\//,
  /^components\//,
  /^lib\//,
  /^types\//,
  /^public\//,
  /^assets\//,

  // ── Root config / tooling files ─────────────────────────────────────────
  /^next\.config\.[jt]s$/,
  /^tailwind\.config\.[jt]s$/,
  /^postcss\.config\.[jt]s$/,
  /^tsconfig\.json$/,
  /^next-env\.d\.ts$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^vercel\.json$/,
  /^\.gitignore$/,
  /^\.eslintrc(\.[a-z]+)?$/,
  /^eslint\.config\.[jt]s$/,
  /^\.env\.example$/,
  /^\.hintrc$/,
  /^README\.md$/,

  // ── Testing infrastructure ────────────────────────────────────────────────
  /^playwright\.[a-z.]+\.[jt]s$/,
  /^tests\//,

  // ── CI / Git infrastructure ──────────────────────────────────────────────
  /^\.github\/workflows\//,
  /^\.github\/CODEOWNERS$/,
  /^\.githooks\//,

  // ── This policy script itself ────────────────────────────────────────────
  /^scripts\/check-website-essential\.mjs$/,
];

// ── main ─────────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, terminal: false });
const violations = [];

rl.on('line', (line) => {
  const file = line.trim();
  if (!file) return;
  if (!ALLOWED_PATTERNS.some((p) => p.test(file))) {
    violations.push(file);
  }
});

rl.on('close', () => {
  if (violations.length === 0) {
    process.exit(0);
  }

  console.error(
    '\n\u274C Push blocked – speedgoatgmbh is the PUBLIC repo; these files are internal only.\n'
  );
  console.error('   Not allowed on the public remote:\n');
  violations.forEach((f) => console.error(`     \u2022 ${f}`));
  console.error(
    '\n   The public remote (speedgoatgmbh) contains website source code only.'
  );
  console.error(
    '   Research docs, crawl outputs, scripts, and internal artefacts belong on'
  );
  console.error(
    '   the private/internal remote.  Push those changes there instead.'
  );
  console.error(
    '   To explicitly allow a path on the public remote, add it to ALLOWED_PATTERNS'
  );
  console.error(
    '   in scripts/check-website-essential.mjs\n'
  );
  process.exit(1);
});
