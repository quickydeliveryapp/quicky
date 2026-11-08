-- 014_rider.sql
-- Rider: payment check before "delivered", change to return, UPI ID, and shop details for the rider app. Safe to re-run.
-- RUN THIS IN THE SUPABASE SQL EDITOR *TOGETHER WITH* deploying the new rider page (git push does not change the database).
-- (The old rider page stops being able to mark orders delivered once this is run, the new page is the replacement.)

-- 1) What was paid, and how
alter table orders add column if not exists payment_method text check (payment_method in ('cash', 'upi'));
alter table orders add column if not exists cash_received numeric(10,2);
alter table orders add column if not exists change_returned numeric(10,2) not null default 0;
alter table profiles add column if not exists upi_id text;

-- 2) Delivered: the money must match the bill. The old version did not look at the amount, so it is removed.
drop function if exists public.deliver_order(uuid, numeric);
create or replace function public.deliver_order(
  p_order_id uuid, p_method text, p_received numeric default null, p_change_returned boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare o orders; v_recv numeric; v_change numeric := 0;
begin
  if coalesce(my_role(), '') <> 'rider' then raise exception 'Sirf riders ke liye'; end if;
  select * into o from orders where id = p_order_id for update;
  if o.id is null or o.rider_id is distinct from auth.uid() or o.status <> 'picked_up' then
    raise exception 'Order deliver nahi ho sakta'; end if;

  if p_method = 'cash' then
    v_recv := round(coalesce(p_received, 0), 2);
    if v_recv < o.total then
      raise exception 'The cash received (Rs %) is less than the bill (Rs %).', v_recv, o.total; end if;
    v_change := v_recv - o.total;
    if v_change > 0 and not coalesce(p_change_returned, false) then
      raise exception 'Return the change of Rs % to the customer first.', v_change; end if;
  elsif p_method = 'upi' then
    v_recv := o.total;   -- paid to the rider's UPI. There is no payment gateway, so the rider confirms it.
  else
    raise exception 'Choose cash or UPI.';
  end if;

  -- cash_collected = the bill. Cash and UPI both reach the rider, so both count in what the rider owes Quicky.
  update orders set status = 'delivered', delivered_at = now(), cash_collected = o.total,
         payment_method = p_method, cash_received = v_recv, change_returned = v_change
   where id = o.id;
end $$;

-- 3) The rider saves his own UPI ID
create or replace function public.set_my_upi(p_upi text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := nullif(trim(coalesce(p_upi, '')), '');
begin
  if coalesce(my_role(), '') <> 'rider' then raise exception 'Sirf riders ke liye'; end if;
  if v is not null and v !~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$' then
    raise exception 'That does not look like a valid UPI ID (for example name@bank).'; end if;
  update profiles set upi_id = v where id = auth.uid();
end $$;

-- 4) Orders for the rider app: ready orders anyone can take, plus my own active ones, with shop details.
--    The customer's phone is only given for the rider's own order.
create or replace function public.rider_orders()
returns table(out_id uuid, out_status text, out_total numeric, out_address text, out_lat float8, out_lng float8,
              out_created_at timestamptz, out_eta timestamptz, out_rider uuid,
              out_shop_name text, out_shop_address text, out_shop_lat float8, out_shop_lng float8, out_customer_phone text)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.total, o.address, o.lat, o.lng, o.created_at, o.expected_delivery_at, o.rider_id,
         s.name, s.address, st_y(s.location::geometry), st_x(s.location::geometry),
         case when o.rider_id = auth.uid() then cp.phone end
    from orders o
    left join shops s on s.id = o.fulfilment_shop_id
    left join profiles cp on cp.id = o.customer_id
   where coalesce(my_role(), '') = 'rider'
     and ((o.rider_id = auth.uid() and o.status in ('packed', 'picked_up'))
          or (o.status = 'packed' and o.rider_id is null))
   order by o.created_at $$;

grant execute on function public.deliver_order(uuid, text, numeric, boolean) to authenticated;
grant execute on function public.set_my_upi(text) to authenticated;
grant execute on function public.rider_orders() to authenticated;
notify pgrst, 'reload schema';
