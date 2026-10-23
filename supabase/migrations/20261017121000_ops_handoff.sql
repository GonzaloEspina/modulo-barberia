-- Handoff from adm.lomiva.com.ar (HMAC ticket → platform org switch).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create table if not exists private.ops_handoff_settings (
  id boolean primary key default true check (id),
  secret text not null
);

create table if not exists public.ops_handoff_nonces (
  nonce text primary key,
  consumed_at timestamptz not null default now()
);

alter table public.ops_handoff_nonces enable row level security;

create or replace function private.b64url_decode(p text)
returns bytea
language plpgsql
immutable
as $$
declare
  s text := replace(replace(p, '-', '+'), '_', '/');
  pad int := (4 - length(s) % 4) % 4;
begin
  s := s || repeat('=', pad);
  return decode(s, 'base64');
end;
$$;

create or replace function public.platform_claim_ops_handoff(
  p_ticket text,
  p_expected_module text default 'barberia'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_body text;
  v_sig text;
  v_secret text;
  v_expected bytea;
  v_got bytea;
  v_payload jsonb;
  v_org_id uuid;
  v_email text;
  v_exp bigint;
  v_nonce text;
  v_module text;
begin
  if not public.is_platform_admin() then
    raise exception 'Sin permiso';
  end if;

  select secret into v_secret from private.ops_handoff_settings where id = true;
  if v_secret is null or v_secret = '' then
    raise exception 'Handoff no configurado';
  end if;

  v_body := split_part(p_ticket, '.', 1);
  v_sig := split_part(p_ticket, '.', 2);
  if v_body = '' or v_sig = '' then
    raise exception 'Ticket inválido';
  end if;

  v_expected := extensions.hmac(v_body, v_secret, 'sha256');
  v_got := private.b64url_decode(v_sig);
  if v_expected is distinct from v_got then
    raise exception 'Ticket inválido';
  end if;

  v_payload := convert_from(private.b64url_decode(v_body), 'utf8')::jsonb;
  v_module := coalesce(v_payload->>'module', '');
  v_org_id := (v_payload->>'orgId')::uuid;
  v_email := lower(trim(coalesce(v_payload->>'email', '')));
  v_exp := (v_payload->>'exp')::bigint;
  v_nonce := coalesce(v_payload->>'nonce', '');

  if v_module is distinct from p_expected_module then
    raise exception 'Módulo incorrecto';
  end if;
  if v_org_id is null or v_email = '' or v_nonce = '' or v_exp is null then
    raise exception 'Ticket inválido';
  end if;
  if v_exp < extract(epoch from now())::bigint then
    raise exception 'Ticket expirado';
  end if;
  if v_email is distinct from lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'Email no coincide';
  end if;

  begin
    insert into public.ops_handoff_nonces (nonce) values (v_nonce);
  exception when unique_violation then
    raise exception 'Ticket ya usado';
  end;

  if not exists (select 1 from public.organizations where id = v_org_id) then
    raise exception 'Organización no encontrada';
  end if;

  return v_org_id;
end;
$$;

revoke all on function public.platform_claim_ops_handoff(text, text) from public;
grant execute on function public.platform_claim_ops_handoff(text, text) to authenticated;
