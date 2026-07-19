#!/usr/bin/env node
/**
 * Gemini E2E helper — does NOT invent keys.
 *
 * Checks:
 *  1. GEMINI_API_KEY present in env / .env
 *  2. Platform /api/health (optional if server up)
 *  3. Optional live embed probe when --live and key present
 *
 * Usage:
 *   node scripts/e2e-gemini.mjs
 *   node scripts/e2e-gemini.mjs --live
 *   npm run e2e:gemini
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const live = process.argv.includes("--live");

function loadDotEnv() {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const dotenv = loadDotEnv();
const key =
  process.env.GEMINI_API_KEY?.trim() || dotenv.GEMINI_API_KEY?.trim() || "";
const port = process.env.PORT || dotenv.PORT || "5300";
const base = `http://127.0.0.1:${port}`;

const report = {
  geminiKeyConfigured: Boolean(key),
  geminiKeyLength: key ? key.length : 0,
  geminiKeyLooksPlaceholder:
    !key ||
    /your-?key|changeme|xxx|todo|example/i.test(key) ||
    key.length < 16,
  platform: null,
  embedProbe: null,
  ok: false,
  nextSteps: [],
};

console.log("=== CodeHarbor · Gemini E2E helper ===\n");

if (!report.geminiKeyConfigured || report.geminiKeyLooksPlaceholder) {
  console.log("❌ GEMINI_API_KEY missing or placeholder");
  console.log("   Set a real key in .env:");
  console.log("     GEMINI_API_KEY=...");
  console.log("   Then restart: npm run dev:all\n");
  report.nextSteps.push("Put a real GEMINI_API_KEY in .env and restart services");
} else {
  console.log(`✓ GEMINI_API_KEY configured (length ${report.geminiKeyLength})`);
}

try {
  const r = await fetch(`${base}/api/health`, {
    signal: AbortSignal.timeout(3000),
  });
  if (r.ok) {
    report.platform = await r.json();
    console.log("✓ Platform health:", JSON.stringify(report.platform));
    if (report.platform?.llm === "missing" || report.platform?.gemini === "missing") {
      report.nextSteps.push("Server still reports LLM missing — restart after setting key");
    }
  } else {
    console.log(`⚠ Platform ${base}/api/health → HTTP ${r.status}`);
    report.platform = { status: r.status };
  }
} catch {
  console.log(`⚠ Platform not reachable at ${base} (start with npm run dev:all)`);
  report.nextSteps.push(`Start platform: npm run dev:all  (then re-run this script)`);
}

if (live && report.geminiKeyConfigured && !report.geminiKeyLooksPlaceholder) {
  console.log("\n--live: probing Google Generative Language API (models list)…");
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    if (r.ok) {
      let models = 0;
      try {
        const j = JSON.parse(text);
        models = Array.isArray(j.models) ? j.models.length : 0;
      } catch {
        /* ignore */
      }
      report.embedProbe = { ok: true, models };
      console.log(`✓ Gemini API reachable · models≈${models}`);
    } else {
      report.embedProbe = { ok: false, status: r.status, body: text.slice(0, 200) };
      console.log(`❌ Gemini API HTTP ${r.status}: ${text.slice(0, 200)}`);
      report.nextSteps.push("Check API key validity / billing / API enablement");
    }
  } catch (e) {
    report.embedProbe = { ok: false, error: String(e) };
    console.log("❌ Gemini API probe failed:", e);
  }
} else if (!live) {
  console.log("\n(Tip: node scripts/e2e-gemini.mjs --live  → hit Google API)");
}

report.ok =
  report.geminiKeyConfigured &&
  !report.geminiKeyLooksPlaceholder &&
  (!live || report.embedProbe?.ok === true);

console.log("\n--- summary ---");
console.log(JSON.stringify(report, null, 2));
if (report.nextSteps.length) {
  console.log("\nNext:");
  for (const s of report.nextSteps) console.log(" ·", s);
}

process.exit(report.ok ? 0 : 1);
