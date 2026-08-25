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
