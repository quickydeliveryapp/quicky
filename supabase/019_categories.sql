-- 019_categories.sql
-- Categories move into the database so the admin can add, hide and remove them (Admin > Categories).
-- The customer app and the shop inventory read this list; lib/categories.ts stays as the fallback. Safe to re-run.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

-- 1) The list. Anyone can read it (customers are not logged in); only the functions below can change it.
create table if not exists public.categories (
  name text primary key,
  icon text not null default 'bag',
  img text not null default '',
  enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
drop policy if exists "anyone reads categories" on public.categories;
create policy "anyone reads categories" on public.categories for select using (true);
grant select on public.categories to anon, authenticated;
revoke insert, update, delete on public.categories from anon, authenticated;

-- 2) The categories you already have, in the same order and with the same pictures. Existing rows are not touched.
insert into public.categories(name, icon, img, enabled, sort) values
  ('Paan Corner', 'leaf', '/cats/paan.webp', false, 10),
  ('Dairy, Bread & Eggs', 'milk', '/cats/dairy.webp', true, 20),
  ('Fruits & Vegetables', 'produce', '/cats/fruits.webp', true, 30),
  ('Cold Drinks & Juices', 'drink', '/cats/drinks.webp', true, 40),
  ('Snacks & Munchies', 'snack', '/cats/snacks.webp', true, 50),
  ('Breakfast & Instant Food', 'bowl', '/cats/breakfast.webp', true, 60),
  ('Sweet Tooth', 'sweet', '/cats/sweets.webp', true, 70),
  ('Bakery & Biscuits', 'cookie', '/cats/bakery.webp', true, 80),
  ('Tea, Coffee & Milk Drinks', 'mug', '/cats/tea.webp', true, 90),
  ('Atta, Rice & Dal', 'grain', '/cats/atta.webp', true, 100),
  ('Masala, Oil & More', 'oil', '/cats/masala.webp', true, 110),
  ('Sauces & Spreads', 'jar', '/cats/sauces.webp', true, 120),
  ('Chicken, Meat & Fish', 'bag', '/cats/meat.webp', false, 130),
  ('Organic & Healthy Living', 'sprout', '/cats/organic.webp', true, 140),
  ('Baby Care', 'baby', '/cats/baby.webp', true, 150),
  ('Pharma & Wellness', 'pill', '/cats/pharma.webp', false, 160),
  ('Cleaning Essentials', 'spray', '/cats/cleaning.webp', true, 170),
  ('Home & Office', 'home', '/cats/home.webp', true, 180),
  ('Personal Care', 'pump', '/cats/personal.webp', true, 190),
  ('Pet Care', 'paw', '/cats/pet.webp', true, 200)
on conflict (name) do nothing;

-- Every category also needs a commission row (it starts at 0 until you set it in Admin > Commission)
insert into public.category_commissions(category, rate)
  select name, 0 from public.categories on conflict (category) do nothing;

-- 3) Add a category (also creates its commission row)
create or replace function public.admin_add_category(p_name text, p_img text default '', p_icon text default 'bag', p_rate numeric default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if coalesce(my_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  if length(v) < 2 or length(v) > 40 then raise exception 'The category name must be 2 to 40 characters.'; end if;
  if lower(v) = 'other' then raise exception 'Other is used for products that have no category.'; end if;
  if exists (select 1 from categories where lower(name) = lower(v)) then raise exception 'That category already exists.'; end if;
  if p_rate < 0 or p_rate > 100 then raise exception 'Commission must be between 0 and 100.'; end if;
  if length(coalesce(p_img, '')) > 150000 then raise exception 'That picture is too large.'; end if;
  insert into categories(name, icon, img, enabled, sort)
    values (v, coalesce(nullif(trim(p_icon), ''), 'bag'), coalesce(p_img, ''), true, coalesce((select max(sort) from categories), 0) + 10);
  insert into category_commissions(category, rate) values (v, p_rate) on conflict (category) do nothing;
end $$;

-- 4) Show or hide a category for customers, or change its picture
create or replace function public.admin_set_category(p_name text, p_enabled boolean default null, p_img text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  if length(coalesce(p_img, '')) > 150000 then raise exception 'That picture is too large.'; end if;
  update categories set enabled = coalesce(p_enabled, enabled), img = coalesce(p_img, img) where name = p_name;
  if not found then raise exception 'Category not found'; end if;
end $$;

-- 5) Remove a category. Refused while products still use it (hide it instead).
create or replace function public.admin_remove_category(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if coalesce(my_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  select count(*) into n from products where lower(trim(category)) = lower(trim(p_name));
  if n > 0 then
    raise exception '% product(s) still use this category. Hide it instead, or move those products to another category first.', n; end if;
  delete from categories where name = p_name;
  if not found then raise exception 'Category not found'; end if;
  delete from category_commissions where lower(category) = lower(p_name);
end $$;

-- 6) How many products each category has (for the admin screen)
create or replace function public.admin_category_counts() returns table(out_category text, out_count bigint)
language sql stable security definer set search_path = public as $$
  select lower(trim(category)), count(*)::bigint from products
   where coalesce(my_role(), '') = 'admin' and category is not null group by 1 $$;

grant execute on function public.admin_add_category(text, text, text, numeric) to authenticated;
grant execute on function public.admin_set_category(text, boolean, text) to authenticated;
grant execute on function public.admin_remove_category(text) to authenticated;
grant execute on function public.admin_category_counts() to authenticated;
notify pgrst, 'reload schema';
