-- 016_admin_qr.sql
-- Lets the admin save a UPI ID and show the deposit QR, and makes the rider app accept the admin's QR as a known payee.
-- Safe to re-run. Needs 015_deposit.sql to have been run first.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

create or replace function public.set_my_upi(p_upi text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := nullif(trim(coalesce(p_upi, '')), '');
begin
  if coalesce(my_role(), '') not in ('rider', 'area_manager', 'admin') then raise exception 'Not allowed'; end if;
  if v is not null and v !~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$' then
    raise exception 'That does not look like a valid UPI ID (for example name@bank).'; end if;
  update profiles set upi_id = v where id = auth.uid();
end $$;

-- A rider can verify a deposit QR against: the area manager of their own area, or the Quicky admin.
create or replace function public.my_area_manager_upis() returns table(out_upi text, out_name text)
language sql stable security definer set search_path = public as $$
  select am.upi_id,
         case when am.role = 'admin' then coalesce(am.full_name, 'Quicky admin') else coalesce(am.full_name, 'Area manager') end
    from profiles am
   where coalesce(my_role(), '') = 'rider'
     and am.upi_id is not null
     and ((am.role = 'area_manager' and my_area() is not null and am.area = my_area()) or am.role = 'admin') $$;

grant execute on function public.set_my_upi(text) to authenticated;
grant execute on function public.my_area_manager_upis() to authenticated;
notify pgrst, 'reload schema';
