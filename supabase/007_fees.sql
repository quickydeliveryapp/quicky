create table fee_settings (
  id int primary key default 1 check (id = 1),
  delivery_fee numeric(6,2) not null default 25,
  free_delivery_above numeric(8,2) not null default 499,
  small_cart_threshold numeric(8,2) not null default 99,
  small_cart_fee numeric(6,2) not null default 15);
insert into fee_settings default values on conflict do nothing;
alter table fee_settings enable row level security;
create policy "fees readable" on fee_settings for select using (true);
create policy "admin sets fees" on fee_settings for update using (my_role() = 'admin') with check (my_role() = 'admin');

alter table orders add column if not exists items_total numeric(10,2) not null default 0;
alter table orders add column if not exists delivery_fee numeric(6,2) not null default 0;
alter table orders add column if not exists small_cart_fee numeric(6,2) not null default 0;
update orders set items_total = total where items_total = 0;

-- place_order: ab fees server pe lagti hain (commission sirf items pe, fees pe nahi)
create or replace function place_order(p_lat float8, p_lng float8, p_address text, p_items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_shop uuid; v_order uuid; v_items numeric := 0; r record; v_price numeric;
        f fee_settings; v_del numeric; v_small numeric;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  v_shop := pick_shop(p_lat, p_lng, p_items, '{}');
  if v_shop is null then raise exception 'Koi shop abhi ye items deliver nahi kar sakti'; end if;
  insert into orders(customer_id, fulfilment_shop_id, total, address, location)
    values (auth.uid(), v_shop, 0, p_address, st_point(p_lng,p_lat)::geography) returning id into v_order;
  for r in select * from jsonb_to_recordset(p_items) as i(product_id uuid, qty int) loop
    select min(sp.price) into v_price from shop_products sp join shops s on s.id = sp.shop_id
      where sp.product_id = r.product_id and sp.is_available and sp.stock > 0 and s.is_open and s.status = 'approved'
        and st_dwithin(s.location, st_point(p_lng,p_lat)::geography, s.delivery_radius_m);
    insert into order_items(order_id, product_id, qty, price) values (v_order, r.product_id, r.qty, v_price);
    v_items := v_items + v_price * r.qty;
  end loop;
  select * into f from fee_settings where id = 1;
  v_del := case when v_items >= f.free_delivery_above then 0 else f.delivery_fee end;
  v_small := case when v_items < f.small_cart_threshold then f.small_cart_fee else 0 end;
  update orders set items_total = v_items, delivery_fee = v_del, small_cart_fee = v_small,
    total = v_items + v_del + v_small where id = v_order;
  return v_order;
end $$;

create function quicky_summary() returns table(delivered bigint, commission numeric, fees numeric)
language sql stable security definer set search_path=public as $$
  select count(*), round(coalesce(sum(c.cm),0),2), coalesce(sum(o.delivery_fee + o.small_cart_fee),0)
  from orders o
  left join (select order_id, sum(price*qty*commission_rate/100) cm from order_items group by order_id) c on c.order_id = o.id
  where o.status = 'delivered' and my_role() = 'admin' $$;
