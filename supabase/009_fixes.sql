-- 009_fixes.sql
-- Security fixes + area-scoped access. Safe to re-run.
-- Run this in the Supabase SQL editor (git push does not change the database).

-- A) Helper: is this shop in my area (shop owner's profiles.area)
create or replace function public.shop_in_my_area(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_area() is not null and exists (
    select 1 from shops s join profiles p on p.id = s.owner_id
    where s.id = p_shop and p.area = public.my_area()) $$;

-- B) Area manager sees only their own area's data
drop policy if exists "staff sees all orders" on orders;
drop policy if exists "orders admin read" on orders;
create policy "orders admin read" on orders for select using (my_role() = 'admin');
drop policy if exists "orders area manager read" on orders;
create policy "orders area manager read" on orders for select to authenticated
  using (my_role() = 'area_manager' and shop_in_my_area(fulfilment_shop_id));

drop policy if exists "staff sees all profiles" on profiles;  -- "profiles admin read" and "profiles area manager read" already exist

drop policy if exists "staff sees order items" on order_items;
create policy "staff sees order items" on order_items for select
  using (my_role() in ('admin','area_manager') and exists (select 1 from orders o where o.id = order_id));

drop policy if exists "payouts visible" on payouts;
create policy "payouts visible" on payouts for select using (
  owns_shop(shop_id) or my_role() = 'admin' or (my_role() = 'area_manager' and shop_in_my_area(shop_id)));

drop policy if exists "deposits visible" on cash_deposits;
create policy "deposits visible" on cash_deposits for select using (
  rider_id = auth.uid() or my_role() = 'admin' or
  (my_role() = 'area_manager' and exists (select 1 from profiles p where p.id = rider_id and p.area is not null and p.area = my_area())));

-- C) Shop owner cannot change own approval / owner / location
drop policy if exists "owner updates shop" on shops;
create policy "owner updates shop" on shops for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.guard_shop_update() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and coalesce(my_role(), '') <> 'admin' then
    if new.status is distinct from old.status or new.owner_id is distinct from old.owner_id
       or new.location::text is distinct from old.location::text
       or new.delivery_radius_m is distinct from old.delivery_radius_m then
      raise exception 'Not allowed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists shops_guard on shops;
create trigger shops_guard before update on shops for each row execute function public.guard_shop_update();

-- D) Direct client updates on orders: status only, and only placed->accepted, accepted->packed
--    (reject_order, claim_order, deliver_order etc. are security definer and unaffected)
create or replace function public.guard_order_update() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if (to_jsonb(new) - 'status' - 'lat' - 'lng') is distinct from (to_jsonb(old) - 'status' - 'lat' - 'lng') then
      raise exception 'Not allowed';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'placed' and new.status = 'accepted') or
         (old.status = 'accepted' and new.status = 'packed')) then
      raise exception 'Not allowed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_guard on orders;
create trigger orders_guard before update on orders for each row execute function public.guard_order_update();

-- E) COD: cash collected is always the order total (rider's typed amount is ignored)
create or replace function public.deliver_order(p_order_id uuid, p_cash numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'delivered', delivered_at = now(), cash_collected = total
  where id = p_order_id and rider_id = auth.uid() and status = 'picked_up';
  if not found then raise exception 'Order deliver nahi ho sakta'; end if;
end $$;

-- F) Area-scoped functions
create or replace function public.am_assign_rider(p_order_id uuid, p_rider_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'area_manager' then raise exception 'Not allowed'; end if;
  if not exists (select 1 from profiles where id = p_rider_id and role = 'rider'
                 and area = my_area() and is_online and rider_approved) then
    raise exception 'Rider is not online in your area';
  end if;
  update orders set rider_id = p_rider_id
    where id = p_order_id and shop_in_my_area(fulfilment_shop_id) and status not in ('delivered','cancelled');
  if not found then raise exception 'Order not found in your area or already closed'; end if;
end $$;

create or replace function public.set_rider_approved(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() not in ('admin','area_manager') then raise exception 'Not allowed'; end if;
  update profiles set rider_approved = p_ok where id = p_id and role = 'rider'
    and (my_role() = 'admin' or (area is not null and area = my_area()));
  if not found then raise exception 'Not allowed'; end if;
end $$;

create or replace function public.record_cash_deposit(p_rider uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() not in ('admin','area_manager') then raise exception 'Not allowed'; end if;
  if my_role() = 'area_manager' and not exists (
       select 1 from profiles where id = p_rider and area is not null and area = my_area()) then
    raise exception 'Not allowed'; end if;
  insert into cash_deposits(rider_id, amount) values (p_rider, p_amount);
end $$;

create or replace function public.rider_cash()
returns table(out_rider uuid, rider_phone text, deliveries bigint, collected numeric, deposited numeric, pending numeric)
language sql stable security definer set search_path = public as $$
  select r.id, r.ph, r.n, r.col, r.dep, r.col - r.dep from (
    select p.id, p.phone ph, count(o.id) n, coalesce(sum(o.cash_collected),0) col,
      (select coalesce(sum(d.amount),0) from cash_deposits d where d.rider_id = p.id) dep
    from profiles p left join orders o on o.rider_id = p.id and o.status = 'delivered'
    where p.role = 'rider' and (my_role() = 'admin' or (my_role() = 'area_manager' and p.area is not null and p.area = my_area()))
    group by p.id, p.phone) r $$;

create or replace function public.shop_summary()
returns table(out_shop_id uuid, out_name text, orders_count bigint, gross numeric, commission numeric, earned numeric, paid numeric, balance numeric)
language sql stable security definer set search_path = public as $$
  with d as (
    select o.fulfilment_shop_id sid, o.id oid, sum(i.price*i.qty) g, sum(i.price*i.qty*i.commission_rate/100) c
    from orders o join order_items i on i.order_id = o.id
    where o.status = 'delivered' group by o.fulfilment_shop_id, o.id),
  agg as (select sid, count(*) n, sum(g) g, sum(c) c from d group by sid),
  pd as (select p.shop_id sid, sum(p.amount) a from payouts p group by p.shop_id)
  select s.id, s.name, coalesce(agg.n,0), coalesce(agg.g,0), round(coalesce(agg.c,0),2),
         round(coalesce(agg.g,0) - coalesce(agg.c,0),2), coalesce(pd.a,0),
         round(coalesce(agg.g,0) - coalesce(agg.c,0) - coalesce(pd.a,0),2)
  from shops s left join agg on agg.sid = s.id left join pd on pd.sid = s.id
  where my_role() = 'admin' or s.owner_id = auth.uid()
     or (my_role() = 'area_manager' and shop_in_my_area(s.id)) $$;

notify pgrst, 'reload schema';
