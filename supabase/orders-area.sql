-- Area manager: orders of own area and rider assignment. Safe to re-run.
-- Assumes public.orders has: id, area, shop_id, rider_id, status, total, address, created_at.
-- Orders table must have RLS enabled, otherwise this policy does not restrict anything.

drop policy if exists "orders area manager read" on public.orders;
create policy "orders area manager read" on public.orders for select to authenticated
  using (public.my_role() = 'area_manager' and area = public.my_area());

create or replace function public.am_assign_rider(p_order_id uuid, p_rider_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'area_manager' then raise exception 'Not allowed'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_rider_id and role = 'rider' and area = public.my_area() and is_online
  ) then
    raise exception 'Rider is not online in your area';
  end if;
  update public.orders set rider_id = p_rider_id
    where id = p_order_id and area = public.my_area() and status not in ('delivered', 'cancelled');
  if not found then raise exception 'Order not found in your area or already closed'; end if;
end $$;

grant execute on function public.am_assign_rider(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
