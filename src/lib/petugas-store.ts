import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type LocalPetugas = {
  id: string;
  nama: string;
  no_hp: string | null;
  area: string | null;
  pin: string;
  is_active: boolean;
  created_at: string;
};

const STORE_PATH = path.join(process.cwd(), ".qurtek", "petugas.local.json");

async function ensureStoreDir() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
}

export async function readPetugasLocalStore(): Promise<LocalPetugas[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        id: String(item.id ?? ""),
        nama: String(item.nama ?? "").trim(),
        no_hp: item.no_hp ? String(item.no_hp).trim() : null,
        area: item.area ? String(item.area).trim() : null,
        pin: String(item.pin ?? "").trim(),
        is_active: item.is_active !== false,
        created_at: String(item.created_at ?? ""),
      }))
      .filter((item) => item.id && item.nama && item.pin);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") return [];
    throw error;
  }
}

export async function writePetugasLocalStore(items: LocalPetugas[]) {
  await ensureStoreDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function addPetugasToLocalStore(input: {
  nama: string;
  no_hp: string | null;
  area: string | null;
  pin: string;
}) {
  const items = await readPetugasLocalStore();

  if (items.some((item) => item.pin === input.pin)) {
    throw new Error("PIN sudah dipakai petugas lain.");
  }

  const row: LocalPetugas = {
    id: randomUUID(),
    nama: input.nama,
    no_hp: input.no_hp,
    area: input.area,
    pin: input.pin,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  items.push(row);
  await writePetugasLocalStore(items);

  return row;
}

export async function updatePetugasInLocalStore(input: {
  id: string;
  nama: string;
  no_hp: string | null;
  area: string | null;
  pin: string;
  is_active: boolean;
}) {
  const items = await readPetugasLocalStore();
  const idx = items.findIndex((item) => item.id === input.id);

  if (idx < 0) {
    throw new Error("Data petugas tidak ditemukan.");
  }

  if (items.some((item, itemIdx) => itemIdx !== idx && item.pin === input.pin)) {
    throw new Error("PIN sudah dipakai petugas lain.");
  }

  const next = {
    ...items[idx],
    nama: input.nama,
    no_hp: input.no_hp,
    area: input.area,
    pin: input.pin,
    is_active: input.is_active,
  };

  items[idx] = next;
  await writePetugasLocalStore(items);

  return next;
}

export async function findActivePetugasByPin(pin: string) {
  const items = await readPetugasLocalStore();
  return items.find((item) => item.pin === pin && item.is_active) ?? null;
}
