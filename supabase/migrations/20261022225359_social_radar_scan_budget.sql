-- Durable application-wide scan-unit budget for Social Radar.
-- These are scan-unit ceilings, not a guaranteed dollar ceiling. Each scan is
-- limited in source code to at most two OpenAI Responses requests.

create table if not exists public.social_radar_scan_budget_state (
  singleton boolean primary key default true check (singleton),
  current_day date not null,
  daily_units integer not null default 0 check (daily_units >= 0),
  current_month date not null,
  monthly_units integer not null default 0 check (monthly_units >= 0),
  updated_at timestamptz not null default now()
);

insert into public.social_radar_scan_budget_state (singleton, current_day, daily_units, current_month, monthly_units)
values (true, (timezone('UTC', now()))::date, 0,
        date_trunc('month', timezone('UTC', now()))::date, 0)
on conflict (singleton) do nothing;

create table if not exists public.social_radar_scan_reservations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.radar_projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scan_day date not null,
  scan_month date not null,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  error_code text check (error_code is null or error_code in ('SCAN_FAILED')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (project_id, scan_day)
);

create index if not exists social_radar_scan_reservations_profile_day_idx
  on public.social_radar_scan_reservations (profile_id, scan_day desc);

alter table public.social_radar_scan_budget_state enable row level security;
alter table public.social_radar_scan_reservations enable row level security;
create policy social_radar_scan_budget_service_role
  on public.social_radar_scan_budget_state for all to service_role
  using (true) with check (true);
create policy social_radar_scan_reservations_service_role
  on public.social_radar_scan_reservations for all to service_role
  using (true) with check (true);
revoke all on table public.social_radar_scan_budget_state from public, anon, authenticated, service_role;
revoke all on table public.social_radar_scan_reservations from public, anon, authenticated, service_role;

create or replace function public.reserve_social_radar_scan(p_profile_id uuid, p_project_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day date := (timezone('UTC', v_now))::date;
  v_month date := date_trunc('month', timezone('UTC', v_now))::date;
  v_budget public.social_radar_scan_budget_state%rowtype;
  v_reservation_id uuid;
begin
  if not exists (
    select 1 from public.radar_projects p
    where p.id = p_project_id and p.profile_id = p_profile_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into strict v_budget
  from public.social_radar_scan_budget_state
  where singleton = true
  for update;

  if v_budget.current_day <> v_day or v_budget.current_month <> v_month then
    update public.social_radar_scan_budget_state
    set current_day = v_day,
        daily_units = case when current_day <> v_day then 0 else daily_units end,
        current_month = v_month,
        monthly_units = case when current_month <> v_month then 0 else monthly_units end,
        updated_at = clock_timestamp()
    where singleton = true
    returning * into v_budget;
  end if;

  select id into v_reservation_id
  from public.social_radar_scan_reservations
  where project_id = p_project_id and scan_day = v_day;
  if found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  if v_budget.daily_units >= 50 then
    return jsonb_build_object('status', 'daily_limit');
  end if;
  if v_budget.monthly_units >= 1500 then
    return jsonb_build_object('status', 'monthly_limit');
  end if;

  insert into public.social_radar_scan_reservations (project_id, profile_id, scan_day, scan_month)
  values (p_project_id, p_profile_id, v_day, v_month)
  on conflict (project_id, scan_day) do nothing
  returning id into v_reservation_id;

  if v_reservation_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  update public.social_radar_scan_budget_state
  set daily_units = daily_units + 1,
      monthly_units = monthly_units + 1,
      updated_at = clock_timestamp()
  where singleton = true
  returning * into v_budget;

  return jsonb_build_object(
    'status', 'reserved',
    'reservation_id', v_reservation_id,
    'daily_units', v_budget.daily_units,
    'monthly_units', v_budget.monthly_units
  );
end;
$$;

create or replace function public.settle_social_radar_scan(p_reservation_id uuid, p_status text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.social_radar_scan_reservations%rowtype;
begin
  if p_status is null or p_status not in ('completed', 'failed') then
    raise invalid_parameter_value using message = 'invalid scan status';
  end if;

  update public.social_radar_scan_reservations
  set status = p_status,
      error_code = case when p_status = 'failed' then 'SCAN_FAILED' else null end,
      settled_at = clock_timestamp()
  where id = p_reservation_id and status = 'reserved'
  returning * into v_row;

  if found then
    return jsonb_build_object('status', v_row.status);
  end if;

  select * into v_row from public.social_radar_scan_reservations where id = p_reservation_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'already_settled', 'settled_as', v_row.status);
end;
$$;

revoke all on function public.reserve_social_radar_scan(uuid, uuid) from public, anon, authenticated;
revoke all on function public.settle_social_radar_scan(uuid, text) from public, anon, authenticated;
grant select, insert, update on table public.social_radar_scan_budget_state to service_role;
grant select, insert, update on table public.social_radar_scan_reservations to service_role;
grant execute on function public.reserve_social_radar_scan(uuid, uuid) to service_role;
grant execute on function public.settle_social_radar_scan(uuid, text) to service_role;

comment on table public.social_radar_scan_budget_state is
  'Service-role-only global Social Radar scan-unit counters: 50 daily and 1500 monthly; units are not dollar amounts or monetary guarantees.';
comment on table public.social_radar_scan_reservations is
  'Service-role-only immutable daily project admission ledger; failures remain charged because provider timeout billing may be ambiguous.';
