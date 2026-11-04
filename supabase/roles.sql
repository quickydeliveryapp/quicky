-- Roles + area access: run once in the Supabase SQL editor (safe to re-run).
-- Roles: admin, area_manager, shop, rider, customer

-- 1) Profile columns
alter table public.profiles add column if not exists area text;       -- e.g. 'Koramangala'. Used by area_manager, shop, rider
alter table public.profiles add column if not exists full_name text;

-- Allowed roles. NOT VALID = existing rows with other values (e.g. 'user') are not blocked; the app treats them as customer.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','area_manager','shop','rider','customer')) not valid;

-- 2) Helpers (security definer = no RLS recursion when used inside profiles policies)
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
  $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_area() returns text
  language sql stable security definer set search_path = public as
  $$ select area from public.profiles where id = auth.uid() $$;

-- 3) Profiles access (added on top of your existing "read own profile" policy)
alter table public.profiles enable row level security;

drop policy if exists "profiles admin read" on public.profiles;
create policy "profiles admin read" on public.profiles for select to authenticated
  using (public.my_role() = 'admin');

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Area manager: read only shops and riders of their own area
drop policy if exists "profiles area manager read" on public.profiles;
create policy "profiles area manager read" on public.profiles for select to authenticated
  using (public.my_role() = 'area_manager' and area is not null and area = public.my_area() and role in ('shop','rider'));

-- 4) Nobody except an admin can change role or area (blocks self-promotion)
create or replace function public.guard_profile_role() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.my_role() is distinct from 'admin'
     and (new.role is distinct from old.role or new.area is distinct from old.area) then
    raise exception 'Only an admin can change role or area';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 5) Template for area-scoped data (use the same pattern for orders/deliveries once their columns are known):
-- create policy "orders area manager read" on public.orders for select to authenticated
--   using (public.my_role() = 'area_manager' and area = public.my_area());

-- 6) Make yourself admin and assign an area manager (replace the ids/emails):
-- update public.profiles set role = 'admin' where id = '<your-user-uuid>';
-- update public.profiles set role = 'area_manager', area = 'Koramangala' where id = '<manager-user-uuid>';

notify pgrst, 'reload schema';
