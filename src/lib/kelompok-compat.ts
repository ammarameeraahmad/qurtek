import { createHash } from "crypto";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const legacyKelompokNameCache = new Map<string, string | null>();

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

export function guessLegacyKelompokNameFromId(kelompokId?: string | null, maxGroup = 500) {
  if (!kelompokId) return null;

  const normalizedId = kelompokId.trim().toLowerCase();
  if (!normalizedId || !UUID_REGEX.test(normalizedId)) return null;

  if (legacyKelompokNameCache.has(normalizedId)) {
    return legacyKelompokNameCache.get(normalizedId) ?? null;
  }

  for (let i = 1; i <= maxGroup; i += 1) {
    const candidateName = `Kelompok ${i}`;
    const candidateId = deriveLegacyKelompokId(candidateName);
    if (candidateId?.toLowerCase() === normalizedId) {
      legacyKelompokNameCache.set(normalizedId, candidateName);
      return candidateName;
    }
  }

  legacyKelompokNameCache.set(normalizedId, null);
  return null;
}
