#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(envPath) {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith("\'") && val.endsWith("\'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore missing file
  }
}

// Load .env.local and .env if present
loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment (.env.local).");
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
});

function isMissingTableError(err) {
  if (!err) return false;
  if (typeof err === "string") return err.toLowerCase().includes("does not exist") || err.toLowerCase().includes("relation");
  if (err.code === "PGRST205" || err.code === "42P01") return true;
  const msg = err.message || err.details || "";
  return typeof msg === "string" && (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation"));
}

async function checkTable(name) {
  try {
    const { error } = await supabase.from(name).select("id").limit(1);
    if (error) {
      if (isMissingTableError(error)) {
        console.log(`MISSING:${name}`);
        return false;
      }
      console.error(`ERROR checking ${name}:`, error.message ?? error);
      return null;
    }

    console.log(`EXISTS:${name}`);
    return true;
  } catch (e) {
    if (isMissingTableError(e)) {
      console.log(`MISSING:${name}`);
      return false;
    }
    console.error(`EXC checking ${name}:`, e && e.message ? e.message : e);
    return null;
  }
}

(async () => {
  const tables = ["push_subscriptions", "distribusi"];
  const results = {};
  for (const t of tables) {
    results[t] = await checkTable(t);
  }

  console.log("SUMMARY:", JSON.stringify(results));
  const missing = Object.entries(results).filter(([, v]) => v === false).map(([k]) => k);
  if (missing.length) {
    console.log("One or more tables are missing:", missing.join(", "));
    process.exit(3);
  }

  console.log("All tables exist (or check completed).");
  process.exit(0);
})();
