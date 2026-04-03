import type { SupabaseClient } from "@supabase/supabase-js";

type LogicalTableName =
  | "hewan"
  | "kelompok"
  | "shohibul"
  | "petugas"
  | "distribusi"
  | "dokumentasi"
  | "status_tracking"
  | "push_subscriptions";

const TABLE_CANDIDATES: Record<LogicalTableName, string[]> = {
  hewan: ["hewan", "hewan_qurban"],
  kelompok: ["kelompok", "kelompok_qurban"],
  shohibul: ["shohibul", "shohibul_qurban"],
  petugas: ["petugas", "petugas_qurban"],
  distribusi: ["distribusi", "distribusi_qurban"],
  dokumentasi: ["dokumentasi"],
  status_tracking: ["status_tracking", "tracking_status"],
  push_subscriptions: ["push_subscriptions", "push_subscription"],
};

const resolvedTableCache = new Map<LogicalTableName, string | null>();

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : undefined;
}

export function isMissingTableError(error: unknown) {
  const code = getErrorCode(error);
  return code === "PGRST205" || code === "42P01";
}

export function isMissingColumnError(error: unknown) {
  const code = getErrorCode(error);
  if (code === "PGRST204" || code === "42703") return true;

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      const lower = message.toLowerCase();
      return lower.includes("could not find the") && lower.includes("column");
    }
  }

  return false;
}

export function getMissingColumnName(error: unknown) {
  if (!error || typeof error !== "object") return null;

  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string" || !message.trim()) return null;

  const patterns = [
    /could not find the ['"]([^'"]+)['"] column/i,
    /column ['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]? does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const column = match?.[1]?.trim();
    if (column) return column;
  }

  return null;
}

export function getReadableErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;

    const details = (error as { details?: unknown }).details;
    if (typeof details === "string" && details.trim()) return details;
  }

  return fallback;
}

async function tableExists(supabase: SupabaseClient, tableName: string) {
  const { error } = await supabase.from(tableName).select("id").limit(1);

  if (!error) return true;
  if (isMissingTableError(error)) return false;

  // For non-table-missing errors, treat as existing so callers can continue.
  return true;
}

export async function resolveTableName(supabase: SupabaseClient, logicalName: LogicalTableName) {
  const cached = resolvedTableCache.get(logicalName);
  if (typeof cached !== "undefined") return cached;

  const candidates = TABLE_CANDIDATES[logicalName] ?? [logicalName];

  for (const candidate of candidates) {
    const exists = await tableExists(supabase, candidate);
    if (exists) {
      resolvedTableCache.set(logicalName, candidate);
      return candidate;
    }
  }

  resolvedTableCache.set(logicalName, null);
  return null;
}

export async function resolveExistingColumn(
  supabase: SupabaseClient,
  tableName: string,
  candidates: string[]
) {
  for (const column of candidates) {
    const { error } = await supabase.from(tableName).select(column).limit(1);
    if (!error) return column;
    if (isMissingColumnError(error)) continue;
    return null;
  }

  return null;
}
