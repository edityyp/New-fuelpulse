alter table public.user_profiles add column if not exists device_id text;
create unique index if not exists user_profiles_device_id_uq on public.user_profiles(device_id) where device_id is not null;

create or replace function public.create_customer_account(p_full_name text, p_mobile text, p_device_id text)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.user_profiles;
  v_org uuid;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if p_device_id is null or length(trim(p_device_id)) < 20 or length(trim(p_device_id)) > 128 then raise exception 'invalid_device'; end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 or length(trim(p_full_name)) > 80 then raise exception 'invalid_name'; end if;
  if p_mobile is not null and p_mobile !~ '^[0-9]{10}$' then raise exception 'invalid_mobile'; end if;
  select id into v_org from public.organizations order by created_at limit 1;
  select * into v_profile from public.user_profiles where id = v_uid;
  if found then return v_profile; end if;
  if exists (select 1 from public.user_profiles where device_id = trim(p_device_id)) then raise exception 'device_already_registered'; end if;
  insert into public.user_profiles(id, organization_id, full_name, mobile, role, status, device_id)
  values(v_uid, v_org, trim(p_full_name), nullif(p_mobile,''), 'USER', 'ACTIVE', trim(p_device_id))
  returning * into v_profile;
  return v_profile;
exception when unique_violation then
  raise exception 'device_already_registered';
end;
$$;

revoke all on function public.create_customer_account(text,text,text) from public, anon, authenticated;
grant execute on function public.create_customer_account(text,text,text) to authenticated;
