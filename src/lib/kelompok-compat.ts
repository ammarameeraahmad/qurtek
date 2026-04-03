import { createHash } from "crypto";

export function normalizeKelompokName(raw?: string | null) {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ");
}

export function deriveLegacyKelompokId(name: string) {
  const normalized = normalizeKelompokName(name).toLowerCase();
  if (!normalized) return null;

  // Deterministic UUID derived from group name to keep hewan/shohibul linkage on legacy schema.
  const hex = createHash("sha1").update(normalized).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
