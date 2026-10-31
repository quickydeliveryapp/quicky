create table payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  amount numeric(10,2) not null check (amount > 0),
  note text, created_at timestamptz not null default now());
create table cash_deposits (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now());
alter table payouts enable row level security;
alter table cash_deposits enable row level security;
create policy "payouts visible" on payouts for select using (owns_shop(shop_id) or my_role() in ('admin','area_manager'));
create policy "deposits visible" on cash_deposits for select using (rider_id = auth.uid() or my_role() in ('admin','area_manager'));

-- Shop ki kamayi: delivered orders ka item value minus order ke waqt lock hua commission, minus payouts
create function shop_summary()
returns table(out_shop_id uuid, out_name text, orders_count bigint, gross numeric, commission numeric, earned numeric, paid numeric, balance numeric)
language sql stable security definer set search_path=public as $$
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
  where my_role() in ('admin','area_manager') or s.owner_id = auth.uid() $$;

-- Rider ne COD mein kitna cash liya aur kitna jama kiya
create function rider_cash()
returns table(out_rider uuid, rider_phone text, deliveries bigint, collected numeric, deposited numeric, pending numeric)
language sql stable security definer set search_path=public as $$
  select r.id, r.ph, r.n, r.col, r.dep, r.col - r.dep from (
    select p.id, p.phone ph, count(o.id) n, coalesce(sum(o.cash_collected),0) col,
      (select coalesce(sum(d.amount),0) from cash_deposits d where d.rider_id = p.id) dep
    from profiles p left join orders o on o.rider_id = p.id and o.status = 'delivered'
    where p.role = 'rider' and my_role() in ('admin','area_manager')
    group by p.id, p.phone) r $$;

create function record_payout(p_shop uuid, p_amount numeric, p_note text) returns void language plpgsql security definer set search_path=public as $$
begin
  if my_role() <> 'admin' then raise exception 'Sirf admin'; end if;
  insert into payouts(shop_id, amount, note) values (p_shop, p_amount, p_note);
end $$;

create function record_cash_deposit(p_rider uuid, p_amount numeric) returns void language plpgsql security definer set search_path=public as $$
begin
  if my_role() not in ('admin','area_manager') then raise exception 'Not allowed'; end if;
  insert into cash_deposits(rider_id, amount) values (p_rider, p_amount);
end $$;
