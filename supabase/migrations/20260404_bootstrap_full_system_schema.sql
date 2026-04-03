-- QURTEK Full System Bootstrap (legacy-safe, idempotent)
-- Paste file ini ke Supabase SQL Editor, lalu Run.
-- Aman dijalankan berulang karena memakai IF NOT EXISTS + guard kondisi kolom.

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

-- Core tables (fresh install)
create table if not exists public.hewan (
	id uuid primary key default gen_random_uuid(),
	kode varchar(20) unique not null,
	jenis jenis_qurban not null,
	warna varchar(100),
	berat_est numeric,
	qr_code_url varchar(500),
	status hewan_status not null default 'registered',
	created_at timestamp with time zone not null default now()
);

create table if not exists public.kelompok (
	id uuid primary key default gen_random_uuid(),
	nama varchar(100) not null,
	hewan_id uuid references public.hewan(id) on delete set null
);

create table if not exists public.shohibul (
	id uuid primary key default gen_random_uuid(),
	nama varchar(255) not null,
	no_whatsapp varchar(20) not null,
	jenis_qurban jenis_qurban not null,
	tipe varchar(10) not null,
	kelompok_id uuid references public.kelompok(id) on delete set null,
	unique_token varchar(50) unique not null,
	push_subscription jsonb,
	created_at timestamp with time zone not null default now()
);

create table if not exists public.petugas (
	id uuid primary key default gen_random_uuid(),
	nama varchar(255) not null,
	no_hp varchar(20),
	area varchar(50),
	pin varchar(6) not null,
	is_active boolean not null default true
);

create table if not exists public.dokumentasi (
	id uuid primary key default gen_random_uuid(),
	hewan_id uuid not null references public.hewan(id) on delete cascade,
	petugas_id uuid references public.petugas(id) on delete set null,
	tahap tahap_dokumentasi not null,
	tipe_media tipe_media not null,
	media_url varchar(500) not null,
	thumbnail_url varchar(500),
	file_size integer,
	captured_at timestamp with time zone,
	uploaded_at timestamp with time zone not null default now(),
	is_synced boolean not null default false
);

create table if not exists public.status_tracking (
	id uuid primary key default gen_random_uuid(),
	hewan_id uuid not null references public.hewan(id) on delete cascade,
	tahap varchar(50) not null,
	waktu timestamp with time zone not null default now(),
	catatan text,
	petugas_id uuid references public.petugas(id) on delete set null
);

create table if not exists public.push_subscriptions (
	id uuid primary key default gen_random_uuid(),
	shohibul_id uuid not null references public.shohibul(id) on delete cascade,
	endpoint text not null,
	p256dh_key text not null,
	auth_key text not null,
	subscribed_at timestamp with time zone not null default now(),
	is_active boolean not null default true
);

create table if not exists public.distribusi (
	id uuid primary key default gen_random_uuid(),
	hewan_id uuid not null references public.hewan(id) on delete cascade,
	shohibul_id uuid not null references public.shohibul(id) on delete cascade,
	berat_kg numeric,
	foto_serah varchar(500),
	diterima_at timestamp with time zone
);

-- Legacy compatibility (add missing columns without breaking existing data)
alter table public.hewan add column if not exists kode text;
alter table public.hewan add column if not exists warna text;
alter table public.hewan add column if not exists berat_est numeric;
alter table public.hewan add column if not exists qr_code_url text;
alter table public.hewan add column if not exists status text;
alter table public.hewan add column if not exists created_at timestamptz not null default now();

alter table public.kelompok add column if not exists nama text;
alter table public.kelompok add column if not exists hewan_id uuid;

alter table public.shohibul add column if not exists no_whatsapp text;
alter table public.shohibul add column if not exists jenis_qurban text;
alter table public.shohibul add column if not exists tipe text;
alter table public.shohibul add column if not exists kelompok_id uuid;
alter table public.shohibul add column if not exists unique_token text;
alter table public.shohibul add column if not exists push_subscription jsonb;
alter table public.shohibul add column if not exists created_at timestamptz not null default now();

alter table public.petugas add column if not exists nama text;
alter table public.petugas add column if not exists no_hp text;
alter table public.petugas add column if not exists area text;
alter table public.petugas add column if not exists pin text;
alter table public.petugas add column if not exists is_active boolean not null default true;

alter table public.dokumentasi add column if not exists hewan_id uuid;
alter table public.dokumentasi add column if not exists petugas_id uuid;
alter table public.dokumentasi add column if not exists tahap text;
alter table public.dokumentasi add column if not exists tipe_media text;
alter table public.dokumentasi add column if not exists media_url text;
alter table public.dokumentasi add column if not exists thumbnail_url text;
alter table public.dokumentasi add column if not exists file_size integer;
alter table public.dokumentasi add column if not exists captured_at timestamptz;
alter table public.dokumentasi add column if not exists uploaded_at timestamptz not null default now();
alter table public.dokumentasi add column if not exists is_synced boolean not null default false;

alter table public.status_tracking add column if not exists hewan_id uuid;
alter table public.status_tracking add column if not exists tahap text;
alter table public.status_tracking add column if not exists waktu timestamptz not null default now();
alter table public.status_tracking add column if not exists catatan text;
alter table public.status_tracking add column if not exists petugas_id uuid;

alter table public.push_subscriptions add column if not exists shohibul_id uuid;
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists p256dh_key text;
alter table public.push_subscriptions add column if not exists auth_key text;
alter table public.push_subscriptions add column if not exists subscribed_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists is_active boolean not null default true;

alter table public.distribusi add column if not exists hewan_id uuid;
alter table public.distribusi add column if not exists shohibul_id uuid;
alter table public.distribusi add column if not exists berat_kg numeric;
alter table public.distribusi add column if not exists foto_serah text;
alter table public.distribusi add column if not exists diterima_at timestamptz;

-- Backfill compatibility data
DO $$
BEGIN
	-- hewan.kode from legacy columns if available
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='hewan' AND column_name='kode'
	) THEN
		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema='public' AND table_name='hewan' AND column_name='qr_code'
		) THEN
			EXECUTE $sql$
				UPDATE public.hewan
				SET kode = COALESCE(NULLIF(BTRIM(kode), ''), NULLIF(BTRIM(qr_code::text), ''))
				WHERE COALESCE(BTRIM(kode), '') = ''
			$sql$;
		END IF;

		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema='public' AND table_name='hewan' AND column_name='kode_hewan'
		) THEN
			EXECUTE $sql$
				UPDATE public.hewan
				SET kode = COALESCE(NULLIF(BTRIM(kode), ''), NULLIF(BTRIM(kode_hewan::text), ''))
				WHERE COALESCE(BTRIM(kode), '') = ''
			$sql$;
		END IF;

		IF EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema='public' AND table_name='hewan' AND column_name='code'
		) THEN
			EXECUTE $sql$
				UPDATE public.hewan
				SET kode = COALESCE(NULLIF(BTRIM(kode), ''), NULLIF(BTRIM(code::text), ''))
				WHERE COALESCE(BTRIM(kode), '') = ''
			$sql$;
		END IF;

		EXECUTE $sql$
			UPDATE public.hewan
			SET kode = 'HWN-' || SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8)
			WHERE COALESCE(BTRIM(kode), '') = '' AND id IS NOT NULL
		$sql$;
	END IF;

	-- shohibul contact/token fallback
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='shohibul' AND column_name='whatsapp'
	) THEN
		EXECUTE $sql$
			UPDATE public.shohibul
			SET no_whatsapp = COALESCE(NULLIF(BTRIM(no_whatsapp), ''), NULLIF(BTRIM(whatsapp), ''))
			WHERE COALESCE(BTRIM(no_whatsapp), '') = ''
		$sql$;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='shohibul' AND column_name='link_unik'
	) THEN
		EXECUTE $sql$
			UPDATE public.shohibul
			SET unique_token = COALESCE(NULLIF(BTRIM(unique_token), ''), NULLIF(BTRIM(link_unik), ''))
			WHERE COALESCE(BTRIM(unique_token), '') = ''
		$sql$;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='shohibul' AND column_name='token'
	) THEN
		EXECUTE $sql$
			UPDATE public.shohibul
			SET unique_token = COALESCE(NULLIF(BTRIM(unique_token), ''), NULLIF(BTRIM(token), ''))
			WHERE COALESCE(BTRIM(unique_token), '') = ''
		$sql$;
	END IF;

	EXECUTE $sql$
		UPDATE public.shohibul
		SET unique_token = 'tok-' || SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 16)
		WHERE COALESCE(BTRIM(unique_token), '') = '' AND id IS NOT NULL
	$sql$;

	-- push_subscriptions key fallback from legacy names
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='p256dh'
	) THEN
		EXECUTE $sql$
			UPDATE public.push_subscriptions
			SET p256dh_key = COALESCE(NULLIF(BTRIM(p256dh_key), ''), NULLIF(BTRIM(p256dh), ''))
			WHERE COALESCE(BTRIM(p256dh_key), '') = ''
		$sql$;
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='auth'
	) THEN
		EXECUTE $sql$
			UPDATE public.push_subscriptions
			SET auth_key = COALESCE(NULLIF(BTRIM(auth_key), ''), NULLIF(BTRIM(auth), ''))
			WHERE COALESCE(BTRIM(auth_key), '') = ''
		$sql$;
	END IF;
END $$;

-- Indexes (guarded by column existence)
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='shohibul' AND column_name='unique_token'
	) THEN
		EXECUTE 'create index if not exists idx_shohibul_token on public.shohibul(unique_token)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='shohibul' AND column_name='kelompok_id'
	) THEN
		EXECUTE 'create index if not exists idx_shohibul_kelompok on public.shohibul(kelompok_id)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='hewan' AND column_name='kode'
	) THEN
		EXECUTE 'create index if not exists idx_hewan_kode on public.hewan(kode)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='dokumentasi' AND column_name='hewan_id'
	) THEN
		EXECUTE 'create index if not exists idx_dokumentasi_hewan on public.dokumentasi(hewan_id)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='status_tracking' AND column_name='hewan_id'
	) THEN
		EXECUTE 'create index if not exists idx_status_tracking_hewan on public.status_tracking(hewan_id)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='shohibul_id'
	) THEN
		EXECUTE 'create index if not exists idx_push_shohibul on public.push_subscriptions(shohibul_id)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='distribusi' AND column_name='hewan_id'
	) THEN
		EXECUTE 'create index if not exists idx_distribusi_hewan on public.distribusi(hewan_id)';
	END IF;
END $$;

DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='distribusi' AND column_name='shohibul_id'
	) THEN
		EXECUTE 'create index if not exists idx_distribusi_shohibul on public.distribusi(shohibul_id)';
	END IF;
END $$;

-- RLS setup (only if table exists)
DO $$ BEGIN
	IF to_regclass('public.hewan') IS NOT NULL THEN EXECUTE 'alter table public.hewan enable row level security'; END IF;
	IF to_regclass('public.kelompok') IS NOT NULL THEN EXECUTE 'alter table public.kelompok enable row level security'; END IF;
	IF to_regclass('public.shohibul') IS NOT NULL THEN EXECUTE 'alter table public.shohibul enable row level security'; END IF;
	IF to_regclass('public.petugas') IS NOT NULL THEN EXECUTE 'alter table public.petugas enable row level security'; END IF;
	IF to_regclass('public.dokumentasi') IS NOT NULL THEN EXECUTE 'alter table public.dokumentasi enable row level security'; END IF;
	IF to_regclass('public.status_tracking') IS NOT NULL THEN EXECUTE 'alter table public.status_tracking enable row level security'; END IF;
	IF to_regclass('public.push_subscriptions') IS NOT NULL THEN EXECUTE 'alter table public.push_subscriptions enable row level security'; END IF;
	IF to_regclass('public.distribusi') IS NOT NULL THEN EXECUTE 'alter table public.distribusi enable row level security'; END IF;
END $$;

-- Optional: buat bucket storage default untuk media upload.
-- Jika bucket sudah ada, query ini tidak mengubah apa-apa.
insert into storage.buckets (id, name, public)
values ('qurban_media', 'qurban_media', true)
on conflict (id) do nothing;
