import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import {
  addPetugasToLocalStore,
  readPetugasLocalStore,
  updatePetugasInLocalStore,
} from "@/lib/petugas-store";
import {
  getReadableErrorMessage,
  isMissingTableError,
  resolveExistingColumn,
  resolveTableName,
} from "@/lib/supabase-compat";

const PIN_REGEX = /^\d{6}$/;

type GenericRow = Record<string, unknown>;

type PetugasColumns = {
  nama: string | null;
  noHp: string | null;
  area: string | null;
  pin: string | null;
  isActive: string | null;
};

function sanitizePhone(raw: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[^0-9+]/g, "");
}

function toNumericValue(raw: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const asNumber = Number(digits);
  if (!Number.isFinite(asNumber)) return null;

  return asNumber;
}

async function resolvePetugasColumns(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tableName: string
): Promise<PetugasColumns> {
  const [nama, noHp, area, pin, isActive] = await Promise.all([
    resolveExistingColumn(supabase, tableName, ["nama"]),
    resolveExistingColumn(supabase, tableName, [
      "no_hp",
      "no_hp_petugas",
      "whatsapp",
      "no_whatsapp",
      "nomor_hp",
      "no_telp",
      "telepon",
    ]),
    resolveExistingColumn(supabase, tableName, ["area", "wilayah", "zona", "lokasi"]),
    resolveExistingColumn(supabase, tableName, ["pin", "kode_pin", "passcode"]),
    resolveExistingColumn(supabase, tableName, ["is_active", "aktif", "status_aktif", "enabled"]),
  ]);

  return {
    nama,
    noHp,
    area,
    pin,
    isActive,
  };
}

function parseActiveValue(raw: unknown, fallback: boolean) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;

  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    if (!value) return fallback;
    if (["false", "0", "nonaktif", "inactive", "disabled", "off"].includes(value)) return false;
    if (["true", "1", "aktif", "active", "enabled", "on"].includes(value)) return true;
  }

  return fallback;
}

function normalizePinValue(raw: unknown, fallback: string) {
  if (raw == null) return fallback;

  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return fallback;

  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padStart(6, "0");
}

function normalizePetugasRow(
  item: GenericRow,
  fallback: {
    nama: string;
    no_hp: string | null;
    area: string | null;
    pin: string;
    is_active: boolean;
  },
  columns: PetugasColumns
) {
  const namaValue = columns.nama ? item[columns.nama] : item.nama;
  const noHpValue = columns.noHp ? item[columns.noHp] : item.no_hp ?? item.no_hp_petugas;
  const areaValue = columns.area ? item[columns.area] : item.area;
  const pinValue = columns.pin ? item[columns.pin] : item.pin;
  const activeValue = columns.isActive ? item[columns.isActive] : item.is_active;

  return {
    id: String(item.id ?? ""),
    nama: typeof namaValue === "string" && namaValue.trim() ? namaValue : fallback.nama,
    no_hp: noHpValue == null ? fallback.no_hp : String(noHpValue),
    area: areaValue == null ? fallback.area : String(areaValue),
    pin: normalizePinValue(pinValue, fallback.pin),
    is_active: parseActiveValue(activeValue, fallback.is_active),
  };
}

function buildPetugasPayloadVariants(
  columns: PetugasColumns,
  input: {
    nama: string;
    no_hp: string | null;
    area: string | null;
    pin: string;
    is_active: boolean;
  }
) {
  const payload: Record<string, unknown> = {};

  if (columns.nama) payload[columns.nama] = input.nama;
  if (columns.noHp) payload[columns.noHp] = input.no_hp;
  if (columns.area) payload[columns.area] = input.area;
  if (columns.pin) payload[columns.pin] = input.pin;
  if (columns.isActive) payload[columns.isActive] = input.is_active;

  const numericPayload: Record<string, unknown> = { ...payload };
  let hasNumericVariant = false;

  if (columns.pin) {
    const pinAsNumber = Number(input.pin);
    if (Number.isFinite(pinAsNumber)) {
      numericPayload[columns.pin] = pinAsNumber;
      hasNumericVariant = true;
    }
  }

  if (columns.noHp) {
    const noHpAsNumber = toNumericValue(input.no_hp);
    if (noHpAsNumber !== null) {
      numericPayload[columns.noHp] = noHpAsNumber;
      hasNumericVariant = true;
    }
  }

  const variants: Array<Record<string, unknown>> = [payload];

  if (hasNumericVariant) {
    variants.push(numericPayload);
  }

  if (columns.isActive) {
    variants.push({
      ...payload,
      [columns.isActive]: input.is_active ? "aktif" : "nonaktif",
    });

    if (hasNumericVariant) {
      variants.push({
        ...numericPayload,
        [columns.isActive]: input.is_active ? "aktif" : "nonaktif",
      });
    }
  }

  const unique = new Map<string, Record<string, unknown>>();
  for (const variant of variants) {
    unique.set(JSON.stringify(variant), variant);
  }

  return Array.from(unique.values());
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const petugasTable = await resolveTableName(supabase, "petugas");

    if (!petugasTable) {
      const localRows = await readPetugasLocalStore();
      localRows.sort((a, b) => a.nama.localeCompare(b.nama));
      return NextResponse.json({ data: localRows });
    }

    const { data, error } = await supabase.from(petugasTable).select("*");

    if (error && isMissingTableError(error)) {
      const localRows = await readPetugasLocalStore();
      localRows.sort((a, b) => a.nama.localeCompare(b.nama));
      return NextResponse.json({ data: localRows });
    }

    if (error) throw error;

    const columns = await resolvePetugasColumns(supabase, petugasTable);

    const mapped = (data ?? []).map((item) =>
      normalizePetugasRow(
        item,
        {
          nama: typeof item.nama === "string" ? item.nama : "",
          no_hp:
            item.no_hp != null
              ? String(item.no_hp)
              : item.no_hp_petugas != null
                ? String(item.no_hp_petugas)
                : item.whatsapp != null
                  ? String(item.whatsapp)
                  : null,
          area: item.area != null ? String(item.area) : null,
          pin: item.pin != null ? String(item.pin) : "000000",
          is_active: item.is_active !== false,
        },
        columns
      )
    );

    mapped.sort((a, b) => a.nama.localeCompare(b.nama));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to fetch petugas.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const petugasTable = await resolveTableName(supabase, "petugas");

    const body = await req.json();

    const nama = String(body.nama ?? "").trim();
    const noHp = sanitizePhone(body.no_hp ? String(body.no_hp) : null);
    const area = body.area ? String(body.area).trim() : null;
    const pin = String(body.pin ?? "").trim();

    if (!nama || !PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: "Nama dan PIN 6 digit wajib diisi." },
        { status: 400 }
      );
    }

    if (!petugasTable) {
      const data = await addPetugasToLocalStore({
        nama,
        no_hp: noHp,
        area,
        pin,
      });

      return NextResponse.json({ data }, { status: 201 });
    }

    const columns = await resolvePetugasColumns(supabase, petugasTable);
    if (!columns.nama || !columns.pin) {
      return NextResponse.json(
        { error: "Kolom wajib petugas (nama/pin) tidak ditemukan di tabel Supabase." },
        { status: 500 }
      );
    }

    const payloadVariants = buildPetugasPayloadVariants(columns, {
      nama,
      no_hp: noHp,
      area,
      pin,
      is_active: true,
    });

    let data: GenericRow | null = null;
    let error: unknown = null;

    for (const payload of payloadVariants) {
      const result = await supabase
        .from(petugasTable)
        .insert([payload])
        .select("*")
        .single();

      if (!result.error) {
        data = result.data;
        error = null;
        break;
      }

      error = result.error;
    }

    if (error) throw error;
    if (!data) throw new Error("Gagal menambahkan petugas.");

    const normalized = normalizePetugasRow(
      data,
      {
        nama,
        no_hp: noHp,
        area,
        pin,
        is_active: true,
      },
      columns
    );

    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to create petugas.") },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) return unauthorizedResponse();

  try {
    const supabase = getSupabaseServerClient();
    const petugasTable = await resolveTableName(supabase, "petugas");

    const body = await req.json();

    const id = String(body.id ?? "").trim();
    const nama = String(body.nama ?? "").trim();
    const noHp = sanitizePhone(body.no_hp ? String(body.no_hp) : null);
    const area = body.area ? String(body.area).trim() : null;
    const pin = String(body.pin ?? "").trim();
    const isActive = body.is_active === false ? false : true;

    if (!id || !nama || !PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: "ID, nama, dan PIN 6 digit wajib diisi." },
        { status: 400 }
      );
    }

    if (!petugasTable) {
      const data = await updatePetugasInLocalStore({
        id,
        nama,
        no_hp: noHp,
        area,
        pin,
        is_active: isActive,
      });

      return NextResponse.json({ data });
    }

    const columns = await resolvePetugasColumns(supabase, petugasTable);
    if (!columns.nama || !columns.pin) {
      return NextResponse.json(
        { error: "Kolom wajib petugas (nama/pin) tidak ditemukan di tabel Supabase." },
        { status: 500 }
      );
    }

    const payloadVariants = buildPetugasPayloadVariants(columns, {
      nama,
      no_hp: noHp,
      area,
      pin,
      is_active: isActive,
    });

    let data: GenericRow | null = null;
    let error: unknown = null;

    for (const payload of payloadVariants) {
      const result = await supabase
        .from(petugasTable)
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (!result.error) {
        data = result.data;
        error = null;
        break;
      }

      error = result.error;
    }

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Data petugas tidak ditemukan." }, { status: 404 });
    }

    const normalized = normalizePetugasRow(
      data,
      {
        nama,
        no_hp: noHp,
        area,
        pin,
        is_active: isActive,
      },
      columns
    );

    return NextResponse.json({ data: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: getReadableErrorMessage(error, "Failed to update petugas.") },
      { status: 500 }
    );
  }
}
