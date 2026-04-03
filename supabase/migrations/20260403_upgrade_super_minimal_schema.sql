-- Upgrade script: super-minimal schema -> stable Qurtek schema (idempotent)
-- Run this in Supabase SQL Editor (production) once, then re-run safely if needed.

create extension if not exists pgcrypto;

-- Legacy deterministic UUID helper used by old app logic.
create or replace function public.legacy_kelompok_uuid(p_name text)
returns uuid
language sql
immutable
as $fn$
  with normalized as (
    select lower(regexp_replace(trim(coalesce(p_name, '')), '\\s+', ' ', 'g')) as name
  ),
  hashed as (
    select substr(encode(digest(name, 'sha1'), 'hex'), 1, 32) as hex
    from normalized
  )
  select (
    substr(hex, 1, 8) || '-' ||
    substr(hex, 9, 4) || '-' ||
    substr(hex, 13, 4) || '-' ||
    substr(hex, 17, 4) || '-' ||
    substr(hex, 21, 12)
  )::uuid
  from hashed;
$fn$;

-- Ensure kelompok table exists.
create table if not exists public.kelompok (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  hewan_id uuid null
);

-- Add modern columns to shohibul table.
alter table public.shohibul add column if not exists no_whatsapp text;
alter table public.shohibul add column if not exists jenis_qurban text;
alter table public.shohibul add column if not exists tipe text;
alter table public.shohibul add column if not exists unique_token text;
alter table public.shohibul add column if not exists kelompok_nama text;
alter table public.shohibul add column if not exists created_at timestamptz not null default now();

-- Backfill contact and defaults.
update public.shohibul
set no_whatsapp = nullif(btrim(coalesce(no_whatsapp, whatsapp)), '')
where coalesce(no_whatsapp, '') = '';

update public.shohibul
set jenis_qurban = coalesce(nullif(btrim(jenis_qurban), ''), 'sapi')
where jenis_qurban is null or btrim(jenis_qurban) = '';

update public.shohibul
set tipe = coalesce(nullif(btrim(tipe), ''), '1/7')
where tipe is null or btrim(tipe) = '';

-- Backfill unique_token from whichever legacy token column exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shohibul' and column_name = 'token'
  ) then
    execute $sql$
      update public.shohibul
      set unique_token = coalesce(
        nullif(btrim(unique_token), ''),
        nullif(btrim(link_unik), ''),
        nullif(btrim(token), '')
      )
      where unique_token is null or btrim(unique_token) = ''
    $sql$;
  else
    execute $sql$
      update public.shohibul
      set unique_token = coalesce(
        nullif(btrim(unique_token), ''),
        nullif(btrim(link_unik), '')
      )
      where unique_token is null or btrim(unique_token) = ''
    $sql$;
  end if;
end $$;

-- Recover kelompok name from deterministic UUIDs: Kelompok 1..500.
with mapping as (
  select
    public.legacy_kelompok_uuid('Kelompok ' || gs.i) as kelompok_id,
    ('Kelompok ' || gs.i)::text as kelompok_nama
  from generate_series(1, 500) as gs(i)
)
update public.shohibul s
set kelompok_nama = m.kelompok_nama
from mapping m
where s.kelompok_id = m.kelompok_id
  and (s.kelompok_nama is null or btrim(s.kelompok_nama) = '');

-- Final fallback label for unknown legacy IDs.
update public.shohibul s
set kelompok_nama = concat('Kelompok Legacy ', left(s.kelompok_id::text, 8))
where s.kelompok_id is not null
  and (s.kelompok_nama is null or btrim(s.kelompok_nama) = '');

-- Sync shohibul groups into kelompok table while preserving existing IDs.
insert into public.kelompok (id, nama)
select distinct
  s.kelompok_id,
  coalesce(nullif(btrim(s.kelompok_nama), ''), concat('Kelompok Legacy ', left(s.kelompok_id::text, 8)))
from public.shohibul s
where s.kelompok_id is not null
on conflict (id) do update
set nama = excluded.nama;

-- Normalize kelompok names.
update public.kelompok
set nama = regexp_replace(trim(nama), '\\s+', ' ', 'g')
where nama is not null
  and nama <> regexp_replace(trim(nama), '\\s+', ' ', 'g');

-- Deduplicate kelompok names by lower(nama), keep first id.
do $$
begin
  with ranked as (
    select
      id,
      lower(nama) as nama_key,
      first_value(id) over (partition by lower(nama) order by id) as keep_id,
      row_number() over (partition by lower(nama) order by id) as rn
    from public.kelompok
  )
  update public.shohibul s
  set kelompok_id = r.keep_id
  from ranked r
  where r.rn > 1 and s.kelompok_id = r.id;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'hewan' and column_name = 'kelompok_id'
  ) then
    with ranked as (
      select
        id,
        lower(nama) as nama_key,
        first_value(id) over (partition by lower(nama) order by id) as keep_id,
        row_number() over (partition by lower(nama) order by id) as rn
      from public.kelompok
    )
    update public.hewan h
    set kelompok_id = r.keep_id
    from ranked r
    where r.rn > 1 and h.kelompok_id = r.id;
  end if;

  with ranked as (
    select
      id,
      row_number() over (partition by lower(nama) order by id) as rn
    from public.kelompok
  )
  delete from public.kelompok k
  using ranked r
  where k.id = r.id and r.rn > 1;
end $$;

-- Useful indexes.
create unique index if not exists idx_shohibul_unique_token_nonempty
  on public.shohibul (unique_token)
  where unique_token is not null and btrim(unique_token) <> '';

create unique index if not exists idx_kelompok_nama_lower_unique
  on public.kelompok (lower(nama));

create index if not exists idx_shohibul_kelompok_id
  on public.shohibul (kelompok_id);

-- Optional compatibility columns for hewan table.
do $$
begin
  if to_regclass('public.hewan') is not null then
    alter table public.hewan add column if not exists kelompok_nama text;
    alter table public.hewan add column if not exists warna text;
    alter table public.hewan add column if not exists berat_est numeric;
    alter table public.hewan add column if not exists status text;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='hewan' and column_name='ciri_ciri'
    ) then
      execute $sql$
        update public.hewan
        set warna = coalesce(nullif(btrim(warna), ''), nullif(btrim(ciri_ciri::text), ''))
      $sql$;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='hewan' and column_name='berat'
    ) then
      execute $sql$
        update public.hewan
        set berat_est = coalesce(
          berat_est,
          case
            when trim(berat::text) ~ '^[0-9]+(\\.[0-9]+)?$' then trim(berat::text)::numeric
            else null
          end
        )
      $sql$;
    end if;
  end if;
end $$;

-- Optional FK constraints; skip safely if not possible.
do $$
begin
  begin
    alter table public.shohibul
      add constraint shohibul_kelompok_id_fkey
      foreign key (kelompok_id) references public.kelompok(id) on delete set null;
  exception
    when duplicate_object then null;
    when undefined_column then null;
    when foreign_key_violation then null;
    when others then
      raise notice 'Skip shohibul_kelompok_id_fkey: %', sqlerrm;
  end;

  if to_regclass('public.hewan') is not null then
    begin
      alter table public.hewan
        add constraint hewan_kelompok_id_fkey
        foreign key (kelompok_id) references public.kelompok(id) on delete set null;
    exception
      when duplicate_object then null;
      when undefined_column then null;
      when foreign_key_violation then null;
      when others then
        raise notice 'Skip hewan_kelompok_id_fkey: %', sqlerrm;
    end;
  end if;
end $$;
