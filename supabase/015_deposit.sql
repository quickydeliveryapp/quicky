-- 015_deposit.sql
-- Rider cash limit, deposits by UPI or cash, area manager UPI, and an advance balance when a rider pays extra. Safe to re-run.
-- Needs 014_rider.sql to have been run first.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

-- 1) The limit the admin sets (Admin > Fees). Above this, the rider gets the Deposit option.
alter table fee_settings add column if not exists rider_cash_limit numeric(8,2) not null default 200 check (rider_cash_limit >= 0);

-- 2) How a deposit was made, and who recorded it
alter table cash_deposits add column if not exists method text not null default 'cash' check (method in ('cash', 'upi'));
alter table cash_deposits add column if not exists recorded_by uuid references profiles(id);

-- 3) Record a deposit (admin, or the area manager for riders in their own area). More than the rider owes is allowed:
--    the extra becomes the rider's advance balance, because "pending" = collected - deposited can go below zero.
create or replace function public.record_deposit(p_rider uuid, p_amount numeric, p_method text default 'cash') returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role(), '') not in ('admin', 'area_manager') then raise exception 'Not allowed'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount more than 0'; end if;
  if p_method not in ('cash', 'upi') then raise exception 'Choose cash or UPI'; end if;
  if my_role() = 'area_manager' and not exists (
       select 1 from profiles where id = p_rider and role = 'rider' and area is not null and area = my_area()) then
    raise exception 'Not allowed'; end if;
  insert into cash_deposits(rider_id, amount, method, recorded_by) values (p_rider, round(p_amount, 2), p_method, auth.uid());
end $$;

-- the admin screen still calls this one
create or replace function public.record_cash_deposit(p_rider uuid, p_amount numeric) returns void
language sql security definer set search_path = public as $$
  select public.record_deposit(p_rider, p_amount, 'cash') $$;

-- 4) Area managers can save their UPI ID too (the deposit QR pays to it)
create or replace function public.set_my_upi(p_upi text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := nullif(trim(coalesce(p_upi, '')), '');
begin
  if coalesce(my_role(), '') not in ('rider', 'area_manager') then raise exception 'Not allowed'; end if;
  if v is not null and v !~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$' then
    raise exception 'That does not look like a valid UPI ID (for example name@bank).'; end if;
  update profiles set upi_id = v where id = auth.uid();
end $$;

-- 5) The rider's app checks that a deposit QR belongs to the area manager of the rider's own area
create or replace function public.my_area_manager_upis() returns table(out_upi text, out_name text)
language sql stable security definer set search_path = public as $$
  select am.upi_id, coalesce(am.full_name, 'Area manager')
    from profiles am
   where coalesce(my_role(), '') = 'rider' and my_area() is not null
     and am.role = 'area_manager' and am.area = my_area() and am.upi_id is not null $$;

grant execute on function public.record_deposit(uuid, numeric, text) to authenticated;
grant execute on function public.record_cash_deposit(uuid, numeric) to authenticated;
grant execute on function public.set_my_upi(text) to authenticated;
grant execute on function public.my_area_manager_upis() to authenticated;
notify pgrst, 'reload schema';
