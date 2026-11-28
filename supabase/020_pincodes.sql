-- 020_pincodes.sql
-- Pincodes where Quicky delivers (Admin > Pincodes). Safe to re-run.
-- Rule: while the list is EMPTY nothing is restricted. Once it has any pincode, only the pincodes
-- that are switched on can order. Pausing every pincode therefore pauses delivery everywhere.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

create table if not exists public.service_pincodes (
  pincode text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.service_pincodes enable row level security;
drop policy if exists "anyone reads pincodes" on public.service_pincodes;
create policy "anyone reads pincodes" on public.service_pincodes for select using (true);
grant select on public.service_pincodes to anon, authenticated;
revoke insert, update, delete on public.service_pincodes from anon, authenticated;

-- The app asks this for the customer's pincode. An unknown pincode (the map did not return one) is allowed.
create or replace function public.pincode_serviceable(p_pincode text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from service_pincodes) then true
    when p_pincode is null or p_pincode !~ '^[1-9][0-9]{5}$' then true
    else exists (select 1 from service_pincodes where pincode = p_pincode and enabled)
  end $$;

-- Add one or many pincodes. Returns how many were new.
create or replace function public.admin_add_pincodes(p_pincodes text[], p_label text default null) returns int
language plpgsql security definer set search_path = public as $$
declare v text; n int := 0; lab text := nullif(trim(coalesce(p_label, '')), '');
begin
  if coalesce(my_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  if p_pincodes is null or array_length(p_pincodes, 1) is null then raise exception 'Enter at least one pincode.'; end if;
  if array_length(p_pincodes, 1) > 200 then raise exception 'Add at most 200 pincodes at a time.'; end if;
  foreach v in array p_pincodes loop
    v := trim(v);
    if v !~ '^[1-9][0-9]{5}$' then raise exception '% is not a valid 6-digit pincode.', v; end if;
    insert into service_pincodes(pincode, label) values (v, lab) on conflict (pincode) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function public.admin_set_pincode(p_pincode text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  update service_pincodes set enabled = p_enabled where pincode = p_pincode;
  if not found then raise exception 'Pincode not found'; end if;
end $$;

create or replace function public.admin_remove_pincode(p_pincode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  delete from service_pincodes where pincode = p_pincode;
  if not found then raise exception 'Pincode not found'; end if;
end $$;

grant execute on function public.pincode_serviceable(text) to anon, authenticated;
grant execute on function public.admin_add_pincodes(text[], text) to authenticated;
grant execute on function public.admin_set_pincode(text, boolean) to authenticated;
grant execute on function public.admin_remove_pincode(text) to authenticated;
notify pgrst, 'reload schema';
