alter table profiles add column if not exists is_online boolean not null default false;
alter table orders add column if not exists cash_collected numeric(10,2);
alter table orders add column if not exists pickup_location geography(point,4326);
alter table orders add column if not exists lat float8 generated always as (st_y(location::geometry)) stored;
alter table orders add column if not exists lng float8 generated always as (st_x(location::geometry)) stored;

create policy "rider sees available and own orders" on orders for select using (
  my_role() = 'rider' and (rider_id = auth.uid() or (status = 'packed' and rider_id is null)));

create function set_online(p_online boolean) returns void language sql security definer set search_path=public as
$$ update profiles set is_online = p_online where id = auth.uid() and role = 'rider' $$;

create function claim_order(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if my_role() <> 'rider' then raise exception 'Sirf riders ke liye'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_online) then raise exception 'Pehle Online ho jao'; end if;
  update orders set rider_id = auth.uid() where id = p_order_id and status = 'packed' and rider_id is null;
  if not found then raise exception 'Order kisi aur ne le liya'; end if;
end $$;

-- QR scan: sirf assigned rider, sirf packed order. Rider ki location + time save, ETA = distance x 1.3 buffer @ 20 km/h (min 3 min)
create function pickup_order(p_token uuid, p_lat float8, p_lng float8) returns timestamptz
language plpgsql security definer set search_path=public as $$
declare o orders; v_dist float8; v_eta timestamptz;
begin
  select * into o from orders where pickup_token = p_token for update;
  if o.id is null or o.rider_id is distinct from auth.uid() then raise exception 'Ye QR aapke order ka nahi hai'; end if;
  if o.status <> 'packed' then raise exception 'Order abhi pickup ke liye ready nahi hai'; end if;
  v_dist := st_distance(st_point(p_lng, p_lat)::geography, o.location);
  v_eta := now() + (greatest(ceil(v_dist * 1.3 / 1000 / 20 * 60), 3) || ' minutes')::interval;
  update orders set status = 'picked_up', picked_up_at = now(),
    pickup_location = st_point(p_lng, p_lat)::geography, expected_delivery_at = v_eta where id = o.id;
  return v_eta;
end $$;

create function deliver_order(p_order_id uuid, p_cash numeric) returns void language plpgsql security definer set search_path=public as $$
begin
  update orders set status = 'delivered', delivered_at = now(), cash_collected = p_cash
  where id = p_order_id and rider_id = auth.uid() and status = 'picked_up';
  if not found then raise exception 'Order deliver nahi ho sakta'; end if;
end $$;
