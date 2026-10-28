create extension if not exists postgis;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'customer' check (role in ('customer','shop_owner','rider','area_manager','admin')),
  full_name text, phone text);

create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  name text not null, address text,
  location geography(point,4326) not null,
  delivery_radius_m int not null default 3000,
  is_open boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','suspended')));
create index on shops using gist(location);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, unit text, image_url text, category text,
  barcode text unique);

create table shop_products (
  shop_id uuid references shops(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  price numeric(10,2) not null check (price > 0),
  stock int not null default 0,
  is_available boolean not null default true,
  primary key (shop_id, product_id));

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  fulfilment_shop_id uuid references shops(id),
  rejected_shop_ids uuid[] not null default '{}',
  status text not null default 'placed' check (status in ('placed','accepted','packed','picked_up','delivered','cancelled')),
  order_type text not null default 'grocery' check (order_type in ('grocery','errand')),
  total numeric(10,2) not null,
  address text not null,
  location geography(point,4326) not null,
  pickup_token uuid not null default gen_random_uuid(),
  rider_id uuid references profiles(id),
  picked_up_at timestamptz, expected_delivery_at timestamptz, delivered_at timestamptz,
  created_at timestamptz not null default now());

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null check (qty > 0),
  price numeric(10,2) not null);

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id, phone) values (new.id, new.phone); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table shop_products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create function my_role() returns text language sql stable security definer set search_path=public as
$$ select role from profiles where id = auth.uid() $$;

create function owns_shop(s uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from shops where id = s and owner_id = auth.uid()) $$;

create policy "own profile" on profiles for select using (id = auth.uid());
create policy "products readable" on products for select using (true);
create policy "admin manages products" on products for all using (my_role()='admin') with check (my_role()='admin');
create policy "owner reads shop" on shops for select using (owner_id = auth.uid() or my_role()='admin');
create policy "owner updates shop" on shops for update using (owner_id = auth.uid());
create policy "admin manages shops" on shops for all using (my_role()='admin') with check (my_role()='admin');
create policy "owner manages stock" on shop_products for all using (owns_shop(shop_id)) with check (owns_shop(shop_id));
create policy "customer sees own orders" on orders for select using (customer_id = auth.uid());
create policy "shop sees its orders" on orders for select using (owns_shop(fulfilment_shop_id));
create policy "shop updates its orders" on orders for update using (owns_shop(fulfilment_shop_id));
create policy "items visible with order" on order_items for select using (
  exists(select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or owns_shop(o.fulfilment_shop_id))));

create function browse_products(p_lat float8, p_lng float8)
returns table(id uuid, name text, unit text, image_url text, category text, price numeric)
language sql stable security definer set search_path=public as $$
  select p.id, p.name, p.unit, p.image_url, p.category, min(sp.price)
  from products p
  join shop_products sp on sp.product_id = p.id and sp.is_available and sp.stock > 0
  join shops s on s.id = sp.shop_id and s.is_open and s.status = 'approved'
   and st_dwithin(s.location, st_point(p_lng, p_lat)::geography, s.delivery_radius_m)
  group by p.id $$;

create function pick_shop(p_lat float8, p_lng float8, p_items jsonb, p_exclude uuid[])
returns uuid language sql stable security definer set search_path=public as $$
  select s.id from shops s
  where s.is_open and s.status='approved' and not (s.id = any(p_exclude))
    and st_dwithin(s.location, st_point(p_lng,p_lat)::geography, s.delivery_radius_m)
    and not exists (
      select 1 from jsonb_to_recordset(p_items) as i(product_id uuid, qty int)
      left join shop_products sp on sp.shop_id=s.id and sp.product_id=i.product_id and sp.is_available and sp.stock>=i.qty
      where sp.shop_id is null)
  order by (select sum(sp.price*i.qty) from jsonb_to_recordset(p_items) as i(product_id uuid, qty int)
            join shop_products sp on sp.shop_id=s.id and sp.product_id=i.product_id)
  limit 1 $$;

-- Customer price = lowest displayed price (locked). Quicky absorbs difference if a costlier shop fulfils.
create function place_order(p_lat float8, p_lng float8, p_address text, p_items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_shop uuid; v_order uuid; v_total numeric := 0; r record; v_price numeric;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  v_shop := pick_shop(p_lat, p_lng, p_items, '{}');
  if v_shop is null then raise exception 'Koi shop abhi ye items deliver nahi kar sakti'; end if;
  insert into orders(customer_id, fulfilment_shop_id, total, address, location)
    values (auth.uid(), v_shop, 0, p_address, st_point(p_lng,p_lat)::geography) returning id into v_order;
  for r in select * from jsonb_to_recordset(p_items) as i(product_id uuid, qty int) loop
    select min(sp.price) into v_price from shop_products sp join shops s on s.id=sp.shop_id
      where sp.product_id=r.product_id and sp.is_available and sp.stock>0 and s.is_open and s.status='approved'
        and st_dwithin(s.location, st_point(p_lng,p_lat)::geography, s.delivery_radius_m);
    insert into order_items(order_id, product_id, qty, price) values (v_order, r.product_id, r.qty, v_price);
    v_total := v_total + v_price * r.qty;
  end loop;
  update orders set total = v_total where id = v_order;
  return v_order;
end $$;

create function reject_order(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders; v_next uuid; v_items jsonb;
begin
  select * into o from orders where id = p_order_id for update;
  if not owns_shop(o.fulfilment_shop_id) or o.status <> 'placed' then raise exception 'Not allowed'; end if;
  select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty)) into v_items from order_items where order_id = o.id;
  v_next := pick_shop(st_y(o.location::geometry), st_x(o.location::geometry), v_items, o.rejected_shop_ids || o.fulfilment_shop_id);
  update orders set rejected_shop_ids = rejected_shop_ids || fulfilment_shop_id,
    fulfilment_shop_id = v_next, status = case when v_next is null then 'cancelled' else 'placed' end
  where id = o.id;
end $$;

alter publication supabase_realtime add table orders;
