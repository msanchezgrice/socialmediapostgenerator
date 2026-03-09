create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.radar_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  domain text,
  repo_name text,
  product_type text,
  inventory_status text,
  contact_email text,
  notes text not null default '',
  analysis_summary text not null default '',
  detected_keywords text[] not null default '{}',
  platform_handles jsonb not null default '{}'::jsonb,
  scan_query text,
  active boolean not null default true,
  auto_scan boolean not null default true,
  last_scanned_at timestamptz,
  last_proposal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug)
);

create index if not exists radar_projects_profile_active_idx
  on public.radar_projects (profile_id, active, auto_scan, updated_at desc);

create table if not exists public.radar_signals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.radar_projects(id) on delete cascade,
  source_type text not null check (source_type in ('domain', 'news', 'topic')),
  title text not null,
  url text,
  summary text not null default '',
  published_at timestamptz,
  relevance_score numeric(5,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists radar_signals_project_created_idx
  on public.radar_signals (project_id, created_at desc);

create table if not exists public.radar_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.radar_projects(id) on delete cascade,
  variant_index int not null,
  headline text not null,
  rationale text not null default '',
  content jsonb not null default '{}'::jsonb,
  status text not null check (status in ('draft', 'approved', 'posted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radar_proposals_project_created_idx
  on public.radar_proposals (project_id, created_at desc);
