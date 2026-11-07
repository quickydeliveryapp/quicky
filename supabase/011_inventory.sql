-- 011_inventory.sql
-- Inventory: buy price, expiry date, product photos, commission rates visible to shops. Safe to re-run.
-- RUN THIS IN THE SUPABASE SQL EDITOR *BEFORE* DEPLOYING the new inventory page (git push does not change the database).

-- 1) New columns on a shop's stock
alter table shop_products add column if not exists buy_price numeric(10,2) check (buy_price is null or buy_price >= 0);
alter table shop_products add column if not exists expiry_date date;

-- 2) Storage for product photos (public read, only shops and admin can upload)
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;
drop policy if exists "products public read" on storage.objects;
create policy "products public read" on storage.objects for select using (bucket_id = 'products');
drop policy if exists "products shop upload" on storage.objects;
create policy "products shop upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and public.my_role() in ('shop', 'admin'));

-- 3) Add or update a product in my shop (now with buy price, expiry date and photo)
drop function if exists public.add_shop_product(text, text, text, text, numeric, int);
create or replace function public.add_shop_product(
  p_barcode text, p_name text, p_unit text, p_category text, p_price numeric, p_stock int,
  p_buy_price numeric default null, p_expiry date default null, p_image_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_prod uuid;
begin
  select id into v_shop from shops where owner_id = auth.uid() limit 1;
  if v_shop is null then raise exception 'Aapki koi shop nahi mili'; end if;
  if coalesce(trim(p_barcode), '') = '' or coalesce(trim(p_name), '') = '' then
    raise exception 'Barcode aur naam zaroori hain'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Sale price must be more than 0'; end if;
  if p_stock is null or p_stock < 0 then raise exception 'Quantity cannot be negative'; end if;
  if p_buy_price is not null and p_buy_price < 0 then raise exception 'Buy price cannot be negative'; end if;

  select id into v_prod from products where barcode = trim(p_barcode);
  if v_prod is null then
    insert into products(name, unit, category, barcode, image_url)
    values (trim(p_name), p_unit, p_category, trim(p_barcode), nullif(trim(coalesce(p_image_url, '')), ''))
    returning id into v_prod;
  elsif coalesce(trim(p_image_url), '') <> '' then
    update products set image_url = p_image_url where id = v_prod and image_url is null;  -- first photo wins
  end if;

  insert into shop_products(shop_id, product_id, price, stock, is_available, buy_price, expiry_date)
  values (v_shop, v_prod, p_price, p_stock, p_stock > 0 and (p_expiry is null or p_expiry >= current_date), p_buy_price, p_expiry)
  on conflict (shop_id, product_id) do update
    set price = excluded.price, stock = excluded.stock, is_available = excluded.is_available,
        buy_price = excluded.buy_price, expiry_date = excluded.expiry_date;
end $$;

-- 4) Add a photo to a product that has none yet (a shop that stocks it, or admin; admin can also replace)
create or replace function public.set_product_image(p_product uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_url), '') = '' then raise exception 'Image missing'; end if;
  if coalesce(my_role(), '') <> 'admin' and not exists (
       select 1 from shop_products sp join shops s on s.id = sp.shop_id
       where sp.product_id = p_product and s.owner_id = auth.uid()) then
    raise exception 'Not allowed'; end if;
  update products set image_url = p_url
   where id = p_product and (image_url is null or coalesce(my_role(), '') = 'admin');
  if not found then raise exception 'This product already has a photo'; end if;
end $$;

-- 5) Expired items stop being available
create or replace function public.expire_stock() returns int
language sql security definer set search_path = public as $$
  with u as (
    update shop_products set is_available = false
     where expiry_date is not null and expiry_date < current_date and is_available
    returning 1)
  select count(*)::int from u $$;
-- Optional, runs it every night (needs the pg_cron extension enabled in Supabase):
-- select cron.schedule('expire-stock', '30 18 * * *', 'select public.expire_stock()');

-- 6) Shops can see commission rates, so the inventory can show the margin after commission
drop policy if exists "shops read commissions" on category_commissions;
create policy "shops read commissions" on category_commissions for select using (my_role() in ('admin', 'shop'));

-- The inventory now picks a category from a fixed list. Add those categories so the admin can set a rate for each
-- (they start at 0 until you set them in Admin > Commission; existing rates are not changed).
insert into category_commissions(category, rate) values
  ('Dairy, Bread & Eggs', 0), ('Fruits & Vegetables', 0), ('Cold Drinks & Juices', 0), ('Snacks & Munchies', 0),
  ('Breakfast & Instant Food', 0), ('Sweet Tooth', 0), ('Bakery & Biscuits', 0), ('Tea, Coffee & Milk Drinks', 0),
  ('Atta, Rice & Dal', 0), ('Masala, Oil & More', 0), ('Sauces & Spreads', 0), ('Organic & Healthy Living', 0),
  ('Baby Care', 0), ('Cleaning Essentials', 0), ('Home & Office', 0), ('Personal Care', 0), ('Pet Care', 0)
on conflict (category) do nothing;

grant execute on function public.add_shop_product(text, text, text, text, numeric, int, numeric, date, text) to authenticated;
grant execute on function public.set_product_image(uuid, text) to authenticated;
grant execute on function public.expire_stock() to authenticated;

notify pgrst, 'reload schema';
