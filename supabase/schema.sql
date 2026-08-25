-- Red Barn Nursery School Stay & Play
-- Private-by-default schema for bookings, capacity, cancellation, and billing.

create extension if not exists citext with schema extensions;

create table if not exists public.stay_play_sessions (
  id bigint generated always as identity primary key,
  name text not null unique,
  start_date date not null,
  end_date date not null,
  booking_opens_at timestamptz not null,
  booking_closes_at timestamptz,
  timezone text not null default 'America/New_York',
  start_time time not null default '12:00',
  end_time time not null default '14:00',
  capacity smallint not null default 14 check (capacity between 1 and 100),
  booking_cutoff_hours smallint not null default 24 check (booking_cutoff_hours between 0 and 168),
  cancellation_cutoff_hours smallint not null default 24 check (cancellation_cutoff_hours between 0 and 168),
  single_child_rate_cents integer not null default 5000 check (single_child_rate_cents >= 0),
  sibling_rate_cents integer not null default 7500 check (sibling_rate_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_time > start_time),
  check (booking_closes_at is null or booking_closes_at > booking_opens_at)
);

create table if not exists public.stay_play_program_days (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.stay_play_sessions(id) on delete cascade,
  service_date date not null unique,
  capacity smallint not null check (capacity between 1 and 100),
  booking_enabled boolean not null default true,
  closure_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stay_play_program_days_session_date_idx
  on public.stay_play_program_days (session_id, service_date);

create table if not exists public.stay_play_families (
  id bigint generated always as identity primary key,
  parent_name text not null,
  email extensions.citext not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(parent_name)) between 2 and 160),
  check (position('@' in email::text) > 1)
);

create table if not exists public.stay_play_children (
  id bigint generated always as identity primary key,
  family_id bigint not null references public.stay_play_families(id) on delete cascade,
  full_name extensions.citext not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, full_name),
  check (length(btrim(full_name::text)) between 1 and 160)
);

create index if not exists stay_play_children_family_id_idx
  on public.stay_play_children (family_id);

create table if not exists public.stay_play_bookings (
  id bigint generated always as identity primary key,
  family_id bigint not null references public.stay_play_families(id) on delete restrict,
  confirmation_code text not null unique,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stay_play_bookings_family_created_idx
  on public.stay_play_bookings (family_id, created_at desc);

create table if not exists public.stay_play_booking_items (
  id bigint generated always as identity primary key,
  booking_id bigint not null references public.stay_play_bookings(id) on delete cascade,
  child_id bigint not null references public.stay_play_children(id) on delete restrict,
  program_day_id bigint not null references public.stay_play_program_days(id) on delete restrict,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'late_cancelled')),
  cancelled_at timestamptz,
  cancellation_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stay_play_booking_items_booking_id_idx
  on public.stay_play_booking_items (booking_id);

create index if not exists stay_play_booking_items_child_id_idx
  on public.stay_play_booking_items (child_id);

create index if not exists stay_play_booking_items_program_day_status_idx
  on public.stay_play_booking_items (program_day_id, status);

create unique index if not exists stay_play_booking_items_active_child_day_uidx
  on public.stay_play_booking_items (child_id, program_day_id)
  where status in ('booked', 'late_cancelled');

create table if not exists public.stay_play_manage_links (
  id bigint generated always as identity primary key,
  family_id bigint not null references public.stay_play_families(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (octet_length(token_hash) = 32),
  check (expires_at > created_at)
);

create index if not exists stay_play_manage_links_family_created_idx
  on public.stay_play_manage_links (family_id, created_at desc);

create index if not exists stay_play_manage_links_active_expiry_idx
  on public.stay_play_manage_links (expires_at)
  where revoked_at is null;

create table if not exists public.stay_play_billing_runs (
  id bigint generated always as identity primary key,
  name text not null,
  period_start date not null,
  period_end date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists stay_play_billing_runs_period_idx
  on public.stay_play_billing_runs (period_start, period_end);

create index if not exists stay_play_billing_runs_created_by_idx
  on public.stay_play_billing_runs (created_by);

create table if not exists public.stay_play_family_statements (
  id bigint generated always as identity primary key,
  billing_run_id bigint not null references public.stay_play_billing_runs(id) on delete cascade,
  family_id bigint not null references public.stay_play_families(id) on delete restrict,
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'ready' check (status in ('ready', 'sent', 'paid')),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_run_id, family_id)
);

create index if not exists stay_play_family_statements_family_id_idx
  on public.stay_play_family_statements (family_id);

create table if not exists public.stay_play_statement_items (
  id bigint generated always as identity primary key,
  statement_id bigint not null references public.stay_play_family_statements(id) on delete cascade,
  program_day_id bigint not null references public.stay_play_program_days(id) on delete restrict,
  child_count smallint not null check (child_count between 1 and 6),
  rate_cents integer not null check (rate_cents >= 0),
  booking_item_ids bigint[] not null,
  created_at timestamptz not null default now(),
  unique (statement_id, program_day_id)
);

create index if not exists stay_play_statement_items_program_day_id_idx
  on public.stay_play_statement_items (program_day_id);

create table if not exists public.stay_play_email_deliveries (
  id bigint generated always as identity primary key,
  family_id bigint references public.stay_play_families(id) on delete set null,
  booking_id bigint references public.stay_play_bookings(id) on delete set null,
  manage_link_id bigint references public.stay_play_manage_links(id) on delete set null,
  message_type text not null check (message_type in ('booking_confirmation', 'manage_link', 'cancellation_confirmation', 'reminder')),
  recipient extensions.citext not null,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'suppressed', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stay_play_email_deliveries_status_created_idx
  on public.stay_play_email_deliveries (status, created_at desc);

create index if not exists stay_play_email_deliveries_family_id_idx
  on public.stay_play_email_deliveries (family_id);

create index if not exists stay_play_email_deliveries_booking_id_idx
  on public.stay_play_email_deliveries (booking_id);

create index if not exists stay_play_email_deliveries_manage_link_id_idx
  on public.stay_play_email_deliveries (manage_link_id);

-- Every table is private by default. Vercel server functions use the secret key.
alter table public.stay_play_sessions enable row level security;
alter table public.stay_play_program_days enable row level security;
alter table public.stay_play_families enable row level security;
alter table public.stay_play_children enable row level security;
alter table public.stay_play_bookings enable row level security;
alter table public.stay_play_booking_items enable row level security;
alter table public.stay_play_manage_links enable row level security;
alter table public.stay_play_billing_runs enable row level security;
alter table public.stay_play_family_statements enable row level security;
alter table public.stay_play_statement_items enable row level security;
alter table public.stay_play_email_deliveries enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Supabase creates this event-trigger helper for automatic RLS. It does not
-- need to be callable through the Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create or replace function public.stay_play_availability()
returns table (
  program_day_id bigint,
  session_id bigint,
  session_name text,
  service_date date,
  start_time time,
  end_time time,
  capacity smallint,
  booked_count bigint,
  open_count bigint,
  booking_enabled boolean,
  closure_note text,
  booking_deadline timestamptz,
  cancellation_deadline timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    pd.id,
    s.id,
    s.name,
    pd.service_date,
    s.start_time,
    s.end_time,
    pd.capacity,
    count(bi.id) filter (where bi.status = 'booked') as booked_count,
    pd.capacity - count(bi.id) filter (where bi.status = 'booked') as open_count,
    pd.booking_enabled
      and s.is_active
      and now() >= s.booking_opens_at
      and (s.booking_closes_at is null or now() <= s.booking_closes_at)
      and now() <= ((pd.service_date + s.start_time) at time zone s.timezone) - make_interval(hours => s.booking_cutoff_hours)
      as booking_enabled,
    pd.closure_note,
    ((pd.service_date + s.start_time) at time zone s.timezone) - make_interval(hours => s.booking_cutoff_hours),
    ((pd.service_date + s.start_time) at time zone s.timezone) - make_interval(hours => s.cancellation_cutoff_hours)
  from public.stay_play_program_days pd
  join public.stay_play_sessions s on s.id = pd.session_id
  left join public.stay_play_booking_items bi on bi.program_day_id = pd.id and bi.status = 'booked'
  group by pd.id, s.id
  order by pd.service_date;
$$;

create or replace function public.create_stay_play_booking(
  p_parent_name text,
  p_email text,
  p_children jsonb,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id bigint;
  v_booking_id bigint;
  v_confirmation_code text;
  v_child_count integer;
  v_selection_count integer;
  v_inserted_count integer;
  v_selected_day_count integer;
  v_found_day_count integer;
  v_existing_count integer;
  v_requested_count integer;
  v_before_total integer := 0;
  v_after_total integer := 0;
  v_day record;
  v_booking_deadline timestamptz;
begin
  p_parent_name := btrim(coalesce(p_parent_name, ''));
  p_email := lower(btrim(coalesce(p_email, '')));

  if length(p_parent_name) < 2 or length(p_parent_name) > 160 then
    raise exception 'Enter the parent or guardian name.';
  end if;
  if length(p_email) > 320 or position('@' in p_email) <= 1 then
    raise exception 'Enter a valid email address.';
  end if;
  if jsonb_typeof(p_children) <> 'array' or jsonb_typeof(p_selections) <> 'array' then
    raise exception 'Children and selections must be arrays.';
  end if;

  v_child_count := jsonb_array_length(p_children);
  v_selection_count := jsonb_array_length(p_selections);
  if v_child_count < 1 or v_child_count > 6 then
    raise exception 'Add between 1 and 6 children.';
  end if;
  if v_selection_count < 1 or v_selection_count > 750 then
    raise exception 'Choose at least one valid child-date reservation.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_children) as c(client_id text, full_name text)
    where c.client_id is null or length(btrim(c.client_id)) = 0
       or c.full_name is null or length(btrim(c.full_name)) = 0 or length(btrim(c.full_name)) > 160
  ) then
    raise exception 'Every child needs a valid name.';
  end if;

  if (select count(*) from jsonb_to_recordset(p_children) as c(client_id text, full_name text))
     <> (select count(distinct c.client_id) from jsonb_to_recordset(p_children) as c(client_id text, full_name text)) then
    raise exception 'Child identifiers must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
    left join jsonb_to_recordset(p_children) as c(client_id text, full_name text) on c.client_id = x.client_id
    where x.service_date is null or c.client_id is null
  ) then
    raise exception 'Every reservation must match a child and date.';
  end if;

  if (select count(*) from jsonb_to_recordset(p_selections) as x(service_date date, client_id text))
     <> (select count(*) from (
       select distinct x.service_date, x.client_id
       from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
     ) d) then
    raise exception 'The same child cannot be selected twice for one date.';
  end if;

  select count(distinct x.service_date)
  into v_selected_day_count
  from jsonb_to_recordset(p_selections) as x(service_date date, client_id text);

  select count(*)
  into v_found_day_count
  from public.stay_play_program_days pd
  where pd.service_date in (
    select distinct x.service_date
    from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
  );

  if v_found_day_count <> v_selected_day_count then
    raise exception 'One or more selected dates are unavailable.';
  end if;

  -- Lock selected day rows in date order so simultaneous parents cannot overbook.
  for v_day in
    select pd.*, s.name as session_name, s.start_time, s.timezone,
           s.booking_opens_at, s.booking_closes_at, s.booking_cutoff_hours, s.is_active
    from public.stay_play_program_days pd
    join public.stay_play_sessions s on s.id = pd.session_id
    where pd.service_date in (
      select distinct x.service_date
      from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
    )
    order by pd.service_date
    for update of pd
  loop
    v_booking_deadline := ((v_day.service_date + v_day.start_time) at time zone v_day.timezone)
      - make_interval(hours => v_day.booking_cutoff_hours);

    if not v_day.booking_enabled or not v_day.is_active
       or now() < v_day.booking_opens_at
       or (v_day.booking_closes_at is not null and now() > v_day.booking_closes_at)
       or now() > v_booking_deadline then
      raise exception '% is not open for booking.', v_day.service_date;
    end if;

    select count(*) into v_existing_count
    from public.stay_play_booking_items bi
    where bi.program_day_id = v_day.id and bi.status = 'booked';

    select count(*) into v_requested_count
    from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
    where x.service_date = v_day.service_date;

    if v_existing_count + v_requested_count > v_day.capacity then
      raise exception '% does not have enough open spots.', v_day.service_date;
    end if;
  end loop;

  insert into public.stay_play_families (parent_name, email, updated_at)
  values (p_parent_name, p_email::extensions.citext, now())
  on conflict (email) do update
    set parent_name = excluded.parent_name,
        updated_at = now()
  returning id into v_family_id;

  select coalesce(sum(case when counts.child_count = 1 then counts.single_rate else counts.sibling_rate end), 0)::integer
  into v_before_total
  from (
    select pd.id,
           count(*) as child_count,
           max(s.single_child_rate_cents) as single_rate,
           max(s.sibling_rate_cents) as sibling_rate
    from public.stay_play_booking_items bi
    join public.stay_play_bookings b on b.id = bi.booking_id
    join public.stay_play_program_days pd on pd.id = bi.program_day_id
    join public.stay_play_sessions s on s.id = pd.session_id
    where b.family_id = v_family_id
      and bi.status in ('booked', 'late_cancelled')
      and pd.service_date in (
        select distinct x.service_date
        from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
      )
    group by pd.id
  ) counts;

  insert into public.stay_play_children (family_id, full_name, updated_at)
  select v_family_id, btrim(c.full_name)::extensions.citext, now()
  from jsonb_to_recordset(p_children) as c(client_id text, full_name text)
  on conflict (family_id, full_name) do update set updated_at = now();

  v_confirmation_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.stay_play_bookings (family_id, confirmation_code)
  values (v_family_id, v_confirmation_code)
  returning id into v_booking_id;

  insert into public.stay_play_booking_items (booking_id, child_id, program_day_id)
  select v_booking_id, child.id, pd.id
  from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
  join jsonb_to_recordset(p_children) as c(client_id text, full_name text) on c.client_id = x.client_id
  join public.stay_play_children child
    on child.family_id = v_family_id and child.full_name = btrim(c.full_name)::extensions.citext
  join public.stay_play_program_days pd on pd.service_date = x.service_date
  on conflict (child_id, program_day_id) where status in ('booked', 'late_cancelled') do nothing;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_selection_count then
    raise exception 'One or more children are already booked for a selected date.';
  end if;

  select coalesce(sum(case when counts.child_count = 1 then counts.single_rate else counts.sibling_rate end), 0)::integer
  into v_after_total
  from (
    select pd.id,
           count(*) as child_count,
           max(s.single_child_rate_cents) as single_rate,
           max(s.sibling_rate_cents) as sibling_rate
    from public.stay_play_booking_items bi
    join public.stay_play_bookings b on b.id = bi.booking_id
    join public.stay_play_program_days pd on pd.id = bi.program_day_id
    join public.stay_play_sessions s on s.id = pd.session_id
    where b.family_id = v_family_id
      and bi.status in ('booked', 'late_cancelled')
      and pd.service_date in (
        select distinct x.service_date
        from jsonb_to_recordset(p_selections) as x(service_date date, client_id text)
      )
    group by pd.id
  ) counts;

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'confirmationCode', v_confirmation_code,
    'reservedChildSpots', v_inserted_count,
    'estimatedAddedChargeCents', greatest(v_after_total - v_before_total, 0)
  );
end;
$$;

create or replace function public.issue_stay_play_manage_link(
  p_email text,
  p_token_hash_hex text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family public.stay_play_families%rowtype;
  v_link_id bigint;
begin
  if p_token_hash_hex !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '2 hours' then
    raise exception 'Invalid management link parameters.';
  end if;

  select * into v_family
  from public.stay_play_families
  where email = lower(btrim(coalesce(p_email, '')))::extensions.citext;

  if not found then
    return null;
  end if;

  if exists (
    select 1 from public.stay_play_manage_links
    where family_id = v_family.id and created_at > now() - interval '60 seconds'
  ) then
    return jsonb_build_object('send', false, 'reason', 'rate_limited');
  end if;

  update public.stay_play_manage_links
  set revoked_at = now()
  where family_id = v_family.id and revoked_at is null and expires_at > now();

  insert into public.stay_play_manage_links (family_id, token_hash, expires_at)
  values (v_family.id, decode(p_token_hash_hex, 'hex'), p_expires_at)
  returning id into v_link_id;

  return jsonb_build_object(
    'send', true,
    'familyId', v_family.id,
    'parentName', v_family.parent_name,
    'email', v_family.email::text,
    'manageLinkId', v_link_id
  );
end;
$$;

create or replace function public.get_stay_play_manage_booking(p_token_hash_hex text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id bigint;
  v_parent_name text;
  v_email text;
  v_result jsonb;
begin
  if p_token_hash_hex !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select f.id, f.parent_name, f.email::text
  into v_family_id, v_parent_name, v_email
  from public.stay_play_manage_links ml
  join public.stay_play_families f on f.id = ml.family_id
  where ml.token_hash = decode(p_token_hash_hex, 'hex')
    and ml.revoked_at is null
    and ml.expires_at > now();

  if not found then
    return null;
  end if;

  update public.stay_play_manage_links
  set last_used_at = now()
  where token_hash = decode(p_token_hash_hex, 'hex');

  select jsonb_build_object(
    'family', jsonb_build_object('parentName', v_parent_name, 'email', v_email),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'bookingItemId', bi.id,
      'confirmationCode', b.confirmation_code,
      'childId', c.id,
      'childName', c.full_name::text,
      'childColorIndex', mod(c.id - 1, 6),
      'serviceDate', pd.service_date,
      'startTime', s.start_time,
      'endTime', s.end_time,
      'sessionName', s.name,
      'status', bi.status,
      'cancellationDeadline', ((pd.service_date + s.start_time) at time zone s.timezone) - make_interval(hours => s.cancellation_cutoff_hours),
      'lateCancellationIsBilled', true
    ) order by pd.service_date, c.full_name), '[]'::jsonb)
  )
  into v_result
  from public.stay_play_booking_items bi
  join public.stay_play_bookings b on b.id = bi.booking_id
  join public.stay_play_children c on c.id = bi.child_id
  join public.stay_play_program_days pd on pd.id = bi.program_day_id
  join public.stay_play_sessions s on s.id = pd.session_id
  where b.family_id = v_family_id
    and bi.status in ('booked', 'late_cancelled')
    and pd.service_date >= current_date - 7;

  return v_result;
end;
$$;

create or replace function public.cancel_stay_play_item(
  p_token_hash_hex text,
  p_booking_item_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id bigint;
  v_item record;
  v_deadline timestamptz;
  v_new_status text;
begin
  if p_token_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception 'This management link is invalid or expired.';
  end if;

  select ml.family_id into v_family_id
  from public.stay_play_manage_links ml
  where ml.token_hash = decode(p_token_hash_hex, 'hex')
    and ml.revoked_at is null
    and ml.expires_at > now();

  if not found then
    raise exception 'This management link is invalid or expired.';
  end if;

  select bi.id, bi.status, pd.service_date, s.start_time, s.timezone,
         s.cancellation_cutoff_hours, c.full_name::text as child_name
  into v_item
  from public.stay_play_booking_items bi
  join public.stay_play_bookings b on b.id = bi.booking_id
  join public.stay_play_children c on c.id = bi.child_id
  join public.stay_play_program_days pd on pd.id = bi.program_day_id
  join public.stay_play_sessions s on s.id = pd.session_id
  where bi.id = p_booking_item_id and b.family_id = v_family_id
  for update of bi;

  if not found then
    raise exception 'Reservation not found.';
  end if;

  if v_item.status <> 'booked' then
    return jsonb_build_object('status', v_item.status, 'billable', v_item.status = 'late_cancelled');
  end if;

  v_deadline := ((v_item.service_date + v_item.start_time) at time zone v_item.timezone)
    - make_interval(hours => v_item.cancellation_cutoff_hours);
  v_new_status := case when now() <= v_deadline then 'cancelled' else 'late_cancelled' end;

  update public.stay_play_booking_items
  set status = v_new_status,
      cancelled_at = now(),
      cancellation_deadline = v_deadline,
      updated_at = now()
  where id = p_booking_item_id;

  return jsonb_build_object(
    'bookingItemId', p_booking_item_id,
    'childName', v_item.child_name,
    'serviceDate', v_item.service_date,
    'status', v_new_status,
    'billable', v_new_status = 'late_cancelled',
    'cancellationDeadline', v_deadline
  );
end;
$$;

create or replace view public.stay_play_billing_lines
with (security_invoker = true)
as
select
  f.id as family_id,
  f.parent_name,
  f.email::text as email,
  pd.service_date,
  count(*)::smallint as child_count,
  string_agg(c.full_name::text, ', ' order by c.full_name) as children,
  case when count(*) = 1 then s.single_child_rate_cents else s.sibling_rate_cents end as rate_cents,
  array_agg(bi.id order by bi.id) as booking_item_ids
from public.stay_play_booking_items bi
join public.stay_play_bookings b on b.id = bi.booking_id
join public.stay_play_families f on f.id = b.family_id
join public.stay_play_children c on c.id = bi.child_id
join public.stay_play_program_days pd on pd.id = bi.program_day_id
join public.stay_play_sessions s on s.id = pd.session_id
where bi.status in ('booked', 'late_cancelled')
group by f.id, pd.id, s.id;

create or replace view public.stay_play_billing_family_summary
with (security_invoker = true)
as
select
  family_id,
  parent_name,
  email,
  count(*) as billable_days,
  sum(child_count) as child_spots,
  sum(rate_cents)::integer as total_cents
from public.stay_play_billing_lines
group by family_id, parent_name, email;

revoke all on function public.stay_play_availability() from public, anon, authenticated;
revoke all on function public.create_stay_play_booking(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.issue_stay_play_manage_link(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_stay_play_manage_booking(text) from public, anon, authenticated;
revoke all on function public.cancel_stay_play_item(text, bigint) from public, anon, authenticated;
grant execute on function public.stay_play_availability() to service_role;
grant execute on function public.create_stay_play_booking(text, text, jsonb, jsonb) to service_role;
grant execute on function public.issue_stay_play_manage_link(text, text, timestamptz) to service_role;
grant execute on function public.get_stay_play_manage_booking(text) to service_role;
grant execute on function public.cancel_stay_play_item(text, bigint) to service_role;
revoke all on public.stay_play_billing_lines, public.stay_play_billing_family_summary from anon, authenticated;
grant select on public.stay_play_billing_lines, public.stay_play_billing_family_summary to service_role;

insert into public.stay_play_sessions (
  name, start_date, end_date, booking_opens_at, booking_closes_at,
  timezone, start_time, end_time, capacity, booking_cutoff_hours,
  cancellation_cutoff_hours, single_child_rate_cents, sibling_rate_cents, is_active
)
values
  (
    'Session 1', date '2026-09-14', date '2026-12-18',
    timestamptz '2026-08-24 00:00:00-04', timestamptz '2026-12-18 12:00:00-05',
    'America/New_York', time '12:00', time '14:00', 14, 24, 24, 5000, 7500, true
  ),
  (
    'Session 2', date '2027-01-04', date '2027-06-10',
    timestamptz '2026-12-26 00:00:00-05', timestamptz '2027-06-10 12:00:00-04',
    'America/New_York', time '12:00', time '14:00', 14, 24, 24, 5000, 7500, true
  )
on conflict (name) do update set
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  booking_opens_at = excluded.booking_opens_at,
  booking_closes_at = excluded.booking_closes_at,
  timezone = excluded.timezone,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  capacity = excluded.capacity,
  booking_cutoff_hours = excluded.booking_cutoff_hours,
  cancellation_cutoff_hours = excluded.cancellation_cutoff_hours,
  single_child_rate_cents = excluded.single_child_rate_cents,
  sibling_rate_cents = excluded.sibling_rate_cents,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.stay_play_program_days (session_id, service_date, capacity)
select s.id, d::date, s.capacity
from public.stay_play_sessions s
cross join lateral generate_series(s.start_date, s.end_date, interval '1 day') d
where extract(isodow from d) between 1 and 5
on conflict (service_date) do update set
  session_id = excluded.session_id,
  capacity = excluded.capacity,
  updated_at = now();

-- Passwordless staff access for the Red Barn Stay & Play dashboard.
-- Browser roles have no access; Vercel server functions use the service role.

create table if not exists public.stay_play_staff_members (
  id bigint generated always as identity primary key,
  email extensions.citext not null unique,
  display_name text,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in email::text) > 1),
  check (display_name is null or length(btrim(display_name)) between 1 and 160)
);

create table if not exists public.stay_play_staff_login_links (
  id bigint generated always as identity primary key,
  staff_member_id bigint not null references public.stay_play_staff_members(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (octet_length(token_hash) = 32),
  check (expires_at > created_at)
);

create index if not exists stay_play_staff_login_links_staff_created_idx
  on public.stay_play_staff_login_links (staff_member_id, created_at desc);

create index if not exists stay_play_staff_login_links_active_expiry_idx
  on public.stay_play_staff_login_links (expires_at)
  where used_at is null and revoked_at is null;

create table if not exists public.stay_play_staff_sessions (
  id bigint generated always as identity primary key,
  staff_member_id bigint not null references public.stay_play_staff_members(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (octet_length(token_hash) = 32),
  check (expires_at > created_at)
);

create index if not exists stay_play_staff_sessions_staff_created_idx
  on public.stay_play_staff_sessions (staff_member_id, created_at desc);

create index if not exists stay_play_staff_sessions_active_expiry_idx
  on public.stay_play_staff_sessions (expires_at)
  where revoked_at is null;

alter table public.stay_play_staff_members enable row level security;
alter table public.stay_play_staff_login_links enable row level security;
alter table public.stay_play_staff_sessions enable row level security;

revoke all on public.stay_play_staff_members from public, anon, authenticated;
revoke all on public.stay_play_staff_login_links from public, anon, authenticated;
revoke all on public.stay_play_staff_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.stay_play_staff_members to service_role;
grant select, insert, update, delete on public.stay_play_staff_login_links to service_role;
grant select, insert, update, delete on public.stay_play_staff_sessions to service_role;
grant usage, select on sequence public.stay_play_staff_members_id_seq to service_role;
grant usage, select on sequence public.stay_play_staff_login_links_id_seq to service_role;
grant usage, select on sequence public.stay_play_staff_sessions_id_seq to service_role;

create or replace function public.issue_stay_play_staff_link(
  p_email text,
  p_token_hash_hex text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff public.stay_play_staff_members%rowtype;
  v_link_id bigint;
begin
  if p_token_hash_hex !~ '^[0-9a-f]{64}$'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '1 hour' then
    raise exception 'Invalid staff link parameters.';
  end if;

  select * into v_staff
  from public.stay_play_staff_members
  where email = lower(btrim(coalesce(p_email, '')))::extensions.citext
    and active = true;

  if not found then
    return null;
  end if;

  if exists (
    select 1
    from public.stay_play_staff_login_links
    where staff_member_id = v_staff.id
      and created_at > now() - interval '60 seconds'
  ) then
    return jsonb_build_object('send', false, 'reason', 'rate_limited');
  end if;

  update public.stay_play_staff_login_links
  set revoked_at = now()
  where staff_member_id = v_staff.id
    and used_at is null
    and revoked_at is null
    and expires_at > now();

  insert into public.stay_play_staff_login_links (staff_member_id, token_hash, expires_at)
  values (v_staff.id, decode(p_token_hash_hex, 'hex'), p_expires_at)
  returning id into v_link_id;

  return jsonb_build_object(
    'send', true,
    'staffMemberId', v_staff.id,
    'displayName', v_staff.display_name,
    'email', v_staff.email::text,
    'role', v_staff.role,
    'staffLinkId', v_link_id
  );
end;
$$;

create or replace function public.redeem_stay_play_staff_link(
  p_token_hash_hex text,
  p_session_hash_hex text,
  p_session_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_session_id bigint;
begin
  if p_token_hash_hex !~ '^[0-9a-f]{64}$'
     or p_session_hash_hex !~ '^[0-9a-f]{64}$'
     or p_session_expires_at <= now()
     or p_session_expires_at > now() + interval '30 days' then
    return null;
  end if;

  select
    l.id as link_id,
    l.staff_member_id,
    s.display_name,
    s.email::text as email,
    s.role
  into v_link
  from public.stay_play_staff_login_links l
  join public.stay_play_staff_members s on s.id = l.staff_member_id
  where l.token_hash = decode(p_token_hash_hex, 'hex')
    and l.used_at is null
    and l.revoked_at is null
    and l.expires_at > now()
    and s.active = true
  for update of l;

  if not found then
    return null;
  end if;

  update public.stay_play_staff_login_links
  set used_at = now()
  where id = v_link.link_id;

  insert into public.stay_play_staff_sessions (staff_member_id, token_hash, expires_at, last_seen_at)
  values (
    v_link.staff_member_id,
    decode(p_session_hash_hex, 'hex'),
    p_session_expires_at,
    now()
  )
  returning id into v_session_id;

  return jsonb_build_object(
    'authenticated', true,
    'sessionId', v_session_id,
    'staffMemberId', v_link.staff_member_id,
    'displayName', v_link.display_name,
    'email', v_link.email,
    'role', v_link.role
  );
end;
$$;

create or replace function public.get_stay_play_staff_session(p_session_hash_hex text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
begin
  if p_session_hash_hex !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select
    ss.id as session_id,
    sm.id as staff_member_id,
    sm.display_name,
    sm.email::text as email,
    sm.role,
    ss.expires_at
  into v_session
  from public.stay_play_staff_sessions ss
  join public.stay_play_staff_members sm on sm.id = ss.staff_member_id
  where ss.token_hash = decode(p_session_hash_hex, 'hex')
    and ss.revoked_at is null
    and ss.expires_at > now()
    and sm.active = true;

  if not found then
    return null;
  end if;

  update public.stay_play_staff_sessions
  set last_seen_at = now()
  where id = v_session.session_id;

  return jsonb_build_object(
    'authenticated', true,
    'sessionId', v_session.session_id,
    'staffMemberId', v_session.staff_member_id,
    'displayName', v_session.display_name,
    'email', v_session.email,
    'role', v_session.role,
    'expiresAt', v_session.expires_at
  );
end;
$$;

create or replace function public.revoke_stay_play_staff_session(p_session_hash_hex text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_hash_hex !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  update public.stay_play_staff_sessions
  set revoked_at = coalesce(revoked_at, now())
  where token_hash = decode(p_session_hash_hex, 'hex');

  return found;
end;
$$;

revoke all on function public.issue_stay_play_staff_link(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.redeem_stay_play_staff_link(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_stay_play_staff_session(text) from public, anon, authenticated;
revoke all on function public.revoke_stay_play_staff_session(text) from public, anon, authenticated;
grant execute on function public.issue_stay_play_staff_link(text, text, timestamptz) to service_role;
grant execute on function public.redeem_stay_play_staff_link(text, text, timestamptz) to service_role;
grant execute on function public.get_stay_play_staff_session(text) to service_role;
grant execute on function public.revoke_stay_play_staff_session(text) to service_role;

-- Live staff operations and authoritative confirmation-email details.
-- All functions are server-only and invoked by Vercel after staff-session validation.

alter table public.stay_play_family_statements
  drop constraint if exists stay_play_family_statements_status_check;

alter table public.stay_play_family_statements
  add constraint stay_play_family_statements_status_check
  check (status in ('ready', 'sent', 'paid', 'waived'));

create unique index if not exists stay_play_billing_runs_period_unique_idx
  on public.stay_play_billing_runs (period_start, period_end);

create or replace function public.get_stay_play_booking_confirmation(p_booking_id bigint)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with target as (
    select b.id as booking_id, b.family_id
    from public.stay_play_bookings b
    where b.id = p_booking_id
  ), selected_days as (
    select
      pd.id as program_day_id,
      pd.service_date,
      t.family_id,
      count(*)::integer as selected_child_count,
      array_agg(c.full_name::text order by c.full_name::text) as children
    from target t
    join public.stay_play_booking_items bi on bi.booking_id = t.booking_id
    join public.stay_play_children c on c.id = bi.child_id
    join public.stay_play_program_days pd on pd.id = bi.program_day_id
    where bi.status in ('booked', 'late_cancelled')
    group by pd.id, t.family_id
  ), family_counts as (
    select
      sd.*,
      count(all_items.id)::integer as family_child_count,
      count(all_items.id) filter (where all_items.booking_id <> p_booking_id)::integer as previous_child_count,
      max(s.single_child_rate_cents)::integer as single_rate_cents,
      max(s.sibling_rate_cents)::integer as sibling_rate_cents
    from selected_days sd
    join public.stay_play_sessions s on true
    join public.stay_play_program_days pd on pd.id = sd.program_day_id and pd.session_id = s.id
    join public.stay_play_bookings family_booking on family_booking.family_id = sd.family_id
    join public.stay_play_booking_items all_items
      on all_items.booking_id = family_booking.id
     and all_items.program_day_id = sd.program_day_id
     and all_items.status in ('booked', 'late_cancelled')
    group by sd.program_day_id, sd.service_date, sd.family_id, sd.selected_child_count, sd.children
  ), lines as (
    select
      service_date,
      selected_child_count,
      children,
      family_child_count,
      case when family_child_count = 1 then single_rate_cents else sibling_rate_cents end as family_day_rate_cents,
      greatest(
        (case when family_child_count = 1 then single_rate_cents else sibling_rate_cents end)
        - (case when previous_child_count = 0 then 0 when previous_child_count = 1 then single_rate_cents else sibling_rate_cents end),
        0
      )::integer as added_charge_cents
    from family_counts
  )
  select jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'serviceDate', service_date,
        'selectedChildCount', selected_child_count,
        'children', children,
        'familyChildCount', family_child_count,
        'familyDayRateCents', family_day_rate_cents,
        'addedChargeCents', added_charge_cents
      ) order by service_date)
      from lines
    ), '[]'::jsonb),
    'addedChargeCents', coalesce((select sum(added_charge_cents) from lines), 0)
  );
$$;

create or replace function public.get_stay_play_staff_schedule(p_start_date date, p_end_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with days as (
    select
      pd.id as program_day_id,
      pd.service_date,
      s.name as session_name,
      s.start_time,
      s.end_time,
      pd.capacity,
      count(bi.id) filter (where bi.status = 'booked') as booked_count,
      pd.capacity - count(bi.id) filter (where bi.status = 'booked') as open_count,
      pd.booking_enabled,
      pd.closure_note
    from public.stay_play_program_days pd
    join public.stay_play_sessions s on s.id = pd.session_id
    left join public.stay_play_booking_items bi on bi.program_day_id = pd.id
    where pd.service_date between p_start_date and p_end_date
    group by pd.id, s.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'programDayId', program_day_id,
    'serviceDate', service_date,
    'sessionName', session_name,
    'startTime', start_time,
    'endTime', end_time,
    'capacity', capacity,
    'bookedCount', booked_count,
    'openCount', open_count,
    'bookingEnabled', booking_enabled,
    'closureNote', closure_note
  ) order by service_date), '[]'::jsonb)
  from days;
$$;

create or replace function public.get_stay_play_staff_roster(p_service_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'bookingItemId', bi.id,
    'childName', c.full_name::text,
    'parentName', f.parent_name,
    'email', f.email::text,
    'confirmationCode', b.confirmation_code
  ) order by c.full_name::text), '[]'::jsonb)
  from public.stay_play_booking_items bi
  join public.stay_play_bookings b on b.id = bi.booking_id
  join public.stay_play_families f on f.id = b.family_id
  join public.stay_play_children c on c.id = bi.child_id
  join public.stay_play_program_days pd on pd.id = bi.program_day_id
  where pd.service_date = p_service_date
    and bi.status = 'booked';
$$;

create or replace function public.get_stay_play_staff_billing(p_start_date date, p_end_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with selected_run as (
    select br.id
    from public.stay_play_billing_runs br
    where br.period_start = p_start_date and br.period_end = p_end_date
    limit 1
  ), lines as (
    select
      bl.family_id,
      bl.parent_name,
      bl.email,
      bl.service_date,
      bl.child_count,
      bl.children,
      bl.rate_cents,
      case when bl.child_count = 1 then 1 else 2 end as rate_number,
      coalesce(fs.status, 'ready') as status
    from public.stay_play_billing_lines bl
    left join selected_run sr on true
    left join public.stay_play_family_statements fs
      on fs.billing_run_id = sr.id and fs.family_id = bl.family_id
    where bl.service_date between p_start_date and p_end_date
  ), families as (
    select
      family_id,
      parent_name,
      email,
      count(*)::integer as billable_days,
      sum(child_count)::integer as child_spots,
      count(*) filter (where rate_number = 1)::integer as single_rate_days,
      count(*) filter (where rate_number = 2)::integer as sibling_rate_days,
      sum(rate_cents)::integer as total_cents,
      max(status) as status
    from lines
    group by family_id, parent_name, email
  )
  select jsonb_build_object(
    'periodStart', p_start_date,
    'periodEnd', p_end_date,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
      'familyId', family_id,
      'parentName', parent_name,
      'email', email,
      'serviceDate', service_date,
      'childCount', child_count,
      'children', children,
      'rateNumber', rate_number,
      'rateCents', rate_cents,
      'status', status
    ) order by service_date, parent_name) from lines), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(jsonb_build_object(
      'familyId', family_id,
      'parentName', parent_name,
      'email', email,
      'billableDays', billable_days,
      'childSpots', child_spots,
      'singleRateDays', single_rate_days,
      'siblingRateDays', sibling_rate_days,
      'totalCents', total_cents,
      'status', status
    ) order by parent_name) from families), '[]'::jsonb),
    'totalCents', coalesce((select sum(total_cents) from families), 0),
    'familyCount', (select count(*) from families),
    'childSpots', coalesce((select sum(child_spots) from families), 0)
  );
$$;

create or replace function public.set_stay_play_staff_billing_status(
  p_period_start date,
  p_period_end date,
  p_family_id bigint,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run_id bigint;
  v_statement_id bigint;
  v_total_cents integer;
begin
  if p_period_end < p_period_start
     or p_status not in ('ready', 'sent', 'paid', 'waived') then
    raise exception 'Invalid billing status request.';
  end if;

  select coalesce(sum(bl.rate_cents), 0)::integer
  into v_total_cents
  from public.stay_play_billing_lines bl
  where bl.family_id = p_family_id
    and bl.service_date between p_period_start and p_period_end;

  if v_total_cents = 0 then
    raise exception 'No billable reservations exist for this family and period.';
  end if;

  insert into public.stay_play_billing_runs (name, period_start, period_end)
  values (
    to_char(p_period_start, 'Mon DD, YYYY') || '–' || to_char(p_period_end, 'Mon DD, YYYY'),
    p_period_start,
    p_period_end
  )
  on conflict (period_start, period_end) do update set name = excluded.name
  returning id into v_run_id;

  insert into public.stay_play_family_statements (
    billing_run_id, family_id, total_cents, status, sent_at, paid_at, updated_at
  ) values (
    v_run_id,
    p_family_id,
    v_total_cents,
    p_status,
    case when p_status in ('sent', 'paid') then now() else null end,
    case when p_status = 'paid' then now() else null end,
    now()
  )
  on conflict (billing_run_id, family_id) do update set
    total_cents = excluded.total_cents,
    status = excluded.status,
    sent_at = case
      when excluded.status in ('sent', 'paid') then coalesce(public.stay_play_family_statements.sent_at, now())
      else null
    end,
    paid_at = case
      when excluded.status = 'paid' then coalesce(public.stay_play_family_statements.paid_at, now())
      else null
    end,
    updated_at = now()
  returning id into v_statement_id;

  delete from public.stay_play_statement_items where statement_id = v_statement_id;

  insert into public.stay_play_statement_items (
    statement_id, program_day_id, child_count, rate_cents, booking_item_ids
  )
  select
    v_statement_id,
    pd.id,
    count(*)::smallint,
    case when count(*) = 1 then max(s.single_child_rate_cents) else max(s.sibling_rate_cents) end,
    array_agg(bi.id order by bi.id)
  from public.stay_play_booking_items bi
  join public.stay_play_bookings b on b.id = bi.booking_id
  join public.stay_play_program_days pd on pd.id = bi.program_day_id
  join public.stay_play_sessions s on s.id = pd.session_id
  where b.family_id = p_family_id
    and pd.service_date between p_period_start and p_period_end
    and bi.status in ('booked', 'late_cancelled')
  group by pd.id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'status', p_status,
    'totalCents', v_total_cents,
    'statementId', v_statement_id
  );
end;
$$;

create or replace function public.set_stay_play_staff_day(
  p_service_date date,
  p_booking_enabled boolean,
  p_closure_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day public.stay_play_program_days%rowtype;
  v_booked_count integer;
begin
  select * into v_day
  from public.stay_play_program_days
  where service_date = p_service_date
  for update;

  if not found then
    raise exception 'Program day not found.';
  end if;

  select count(*)::integer into v_booked_count
  from public.stay_play_booking_items
  where program_day_id = v_day.id and status = 'booked';

  if not p_booking_enabled and v_booked_count > 0 then
    raise exception 'This day has active bookings. Contact those families before closing it.';
  end if;

  update public.stay_play_program_days
  set booking_enabled = p_booking_enabled,
      closure_note = case
        when p_booking_enabled then null
        else coalesce(nullif(btrim(p_closure_note), ''), 'School closed')
      end,
      updated_at = now()
  where id = v_day.id
  returning * into v_day;

  return jsonb_build_object(
    'serviceDate', v_day.service_date,
    'bookingEnabled', v_day.booking_enabled,
    'closureNote', v_day.closure_note,
    'bookedCount', v_booked_count
  );
end;
$$;

revoke all on function public.get_stay_play_booking_confirmation(bigint) from public, anon, authenticated;
revoke all on function public.get_stay_play_staff_schedule(date, date) from public, anon, authenticated;
revoke all on function public.get_stay_play_staff_roster(date) from public, anon, authenticated;
revoke all on function public.get_stay_play_staff_billing(date, date) from public, anon, authenticated;
revoke all on function public.set_stay_play_staff_billing_status(date, date, bigint, text) from public, anon, authenticated;
revoke all on function public.set_stay_play_staff_day(date, boolean, text) from public, anon, authenticated;

grant execute on function public.get_stay_play_booking_confirmation(bigint) to service_role;
grant execute on function public.get_stay_play_staff_schedule(date, date) to service_role;
grant execute on function public.get_stay_play_staff_roster(date) to service_role;
grant execute on function public.get_stay_play_staff_billing(date, date) to service_role;
grant execute on function public.set_stay_play_staff_billing_status(date, date, bigint, text) to service_role;
grant execute on function public.set_stay_play_staff_day(date, boolean, text) to service_role;
