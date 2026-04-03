-- QURTEK Supabase Schema
-- Jalankan file ini di Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE jenis_qurban AS ENUM ('sapi', 'kambing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE hewan_status AS ENUM ('registered','ready','slaughtering','processing','distributing','done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tahap_dokumentasi AS ENUM (
    'hewan_tiba',
    'penyembelihan',
    'pengulitan',
    'pemotongan',
    'penimbangan',
    'pengemasan',
    'distribusi'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tipe_media AS ENUM ('foto', 'video');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Core tables
create table if not exists hewan (
  id uuid primary key default gen_random_uuid(),
  kode varchar(20) unique not null,
  jenis jenis_qurban not null,
  warna varchar(100),
  berat_est numeric,
  qr_code_url varchar(500),
  status hewan_status not null default 'registered',
  created_at timestamp with time zone not null default now()
);

create table if not exists kelompok (
  id uuid primary key default gen_random_uuid(),
  nama varchar(100) not null,
  hewan_id uuid references hewan(id) on delete set null
);

create table if not exists shohibul (
  id uuid primary key default gen_random_uuid(),
  nama varchar(255) not null,
  no_whatsapp varchar(20) not null,
  jenis_qurban jenis_qurban not null,
  tipe varchar(10) not null,
  kelompok_id uuid references kelompok(id) on delete set null,
  unique_token varchar(50) unique not null,
  push_subscription jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists petugas (
  id uuid primary key default gen_random_uuid(),
  nama varchar(255) not null,
  no_hp varchar(20),
  area varchar(50),
  pin varchar(6) not null,
  is_active boolean not null default true
);

create table if not exists dokumentasi (
  id uuid primary key default gen_random_uuid(),
  hewan_id uuid not null references hewan(id) on delete cascade,
  petugas_id uuid references petugas(id) on delete set null,
  tahap tahap_dokumentasi not null,
  tipe_media tipe_media not null,
  media_url varchar(500) not null,
  thumbnail_url varchar(500),
  file_size integer,
  captured_at timestamp with time zone,
  uploaded_at timestamp with time zone not null default now(),
  is_synced boolean not null default false
);

create table if not exists status_tracking (
  id uuid primary key default gen_random_uuid(),
  hewan_id uuid not null references hewan(id) on delete cascade,
  tahap varchar(50) not null,
  waktu timestamp with time zone not null default now(),
  catatan text,
  petugas_id uuid references petugas(id) on delete set null
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shohibul_id uuid not null references shohibul(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  subscribed_at timestamp with time zone not null default now(),
  is_active boolean not null default true
);

create table if not exists distribusi (
  id uuid primary key default gen_random_uuid(),
  hewan_id uuid not null references hewan(id) on delete cascade,
  shohibul_id uuid not null references shohibul(id) on delete cascade,
  berat_kg numeric,
  foto_serah varchar(500),
  diterima_at timestamp with time zone
);

-- Indexes
create index if not exists idx_shohibul_token on shohibul(unique_token);
create index if not exists idx_shohibul_kelompok on shohibul(kelompok_id);
create index if not exists idx_hewan_kode on hewan(kode);
create index if not exists idx_dokumentasi_hewan on dokumentasi(hewan_id);
create index if not exists idx_status_tracking_hewan on status_tracking(hewan_id);
create index if not exists idx_push_shohibul on push_subscriptions(shohibul_id);
create unique index if not exists idx_push_endpoint_unique on push_subscriptions(endpoint);

-- RLS setup (API routes menggunakan service role key)
alter table hewan enable row level security;
alter table kelompok enable row level security;
alter table shohibul enable row level security;
alter table petugas enable row level security;
alter table dokumentasi enable row level security;
alter table status_tracking enable row level security;
alter table push_subscriptions enable row level security;
alter table distribusi enable row level security;

-- Kebijakan read-only portal berdasarkan token dilakukan di server API,
-- maka tabel tidak dibuka langsung ke role anon.
