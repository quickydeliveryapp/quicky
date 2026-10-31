alter table profiles add column if not exists rider_approved boolean not null default false;
update profiles set rider_approved = true where role = 'rider';  -- maujooda test rider ko approve

create table category_commissions (
  category text primary key,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 50));
insert into category_commissions values
  ('Fresh Produce', 5), ('Dairy', 8), ('Staples', 8), ('Snacks', 12), ('Beverages', 12), ('Personal Care', 15)
on conflict do nothing;
alter table category_commissions enable row level security;
create policy "admin manages commissions" on category_commissions for all
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- Order ke waqt har item ka commission rate lock ho jata hai (baad mein rate badle toh purane orders nahi badlenge)
alter table order_items add column if not exists commission_rate numeric(5,2) not null default 0;
create function set_commission_rate() returns trigger language plpgsql security definer set search_path=public as $$
begin
  select c.rate into new.commission_rate from products p
    join category_commissions c on lower(c.category) = lower(p.category) where p.id = new.product_id;
  new.commission_rate := coalesce(new.commission_rate, 0);
  return new;
end $$;
create trigger order_items_commission before insert on order_items for each row execute function set_commission_rate();

create policy "staff sees all orders" on orders for select using (my_role() in ('admin','area_manager'));
create policy "staff sees all profiles" on profiles for select using (my_role() in ('admin','area_manager'));

create function set_rider_approved(p_id uuid, p_ok boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if my_role() not in ('admin','area_manager') then raise exception 'Not allowed'; end if;
  update profiles set rider_approved = p_ok where id = p_id and role = 'rider';
end $$;

-- Ab rider ko online hone ke saath approved bhi hona padega
create or replace function claim_order(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if my_role() <> 'rider' then raise exception 'Sirf riders ke liye'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_online and rider_approved) then
    raise exception 'Online hona ya admin approval baaki hai'; end if;
  update orders set rider_id = auth.uid() where id = p_order_id and status = 'packed' and rider_id is null;
  if not found then raise exception 'Order kisi aur ne le liya'; end if;
end $$;
