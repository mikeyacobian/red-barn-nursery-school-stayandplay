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
