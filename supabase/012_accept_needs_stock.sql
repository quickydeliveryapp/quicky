-- 012_accept_needs_stock.sql
-- A shop can no longer accept an order when it does not have the stock. Safe to re-run.
-- Includes the stock decrement from 010, so it is fine whether or not 010 was run.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

-- 1) Block: placed -> accepted only if every item is on sale and in stock at this shop
create or replace function public.check_stock_on_accept() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'accepted' and old.status = 'placed' then
    -- lock this shop's rows for the items, so two orders cannot both take the last unit
    perform 1 from shop_products
     where shop_id = new.fulfilment_shop_id
       and product_id in (select product_id from order_items where order_id = new.id)
     for update;
    for r in
      select p.name, oi.qty, coalesce(sp.stock, 0) as stock, coalesce(sp.is_available, false) as avail
        from order_items oi
        join products p on p.id = oi.product_id
        left join shop_products sp on sp.product_id = oi.product_id and sp.shop_id = new.fulfilment_shop_id
       where oi.order_id = new.id
    loop
      if not r.avail then
        raise exception 'Not enough stock: % is not on sale in your shop. Update your stock or reject this order.', r.name;
      elsif r.stock < r.qty then
        raise exception 'Not enough stock: % (need %, you have %). Update your stock or reject this order.', r.name, r.qty, r.stock;
      end if;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists orders_stock_check on orders;
create trigger orders_stock_check before update of status on orders
  for each row execute function public.check_stock_on_accept();

-- 2) Stock goes down when the order is accepted
create or replace function public.take_stock_on_accept() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status = 'placed' then
    update shop_products sp
       set stock = greatest(sp.stock - oi.qty, 0),
           is_available = (greatest(sp.stock - oi.qty, 0) > 0)
      from order_items oi
     where oi.order_id = new.id
       and sp.shop_id = new.fulfilment_shop_id
       and sp.product_id = oi.product_id;
  end if;
  return new;
end $$;

drop trigger if exists orders_take_stock on orders;
create trigger orders_take_stock after update of status on orders
  for each row execute function public.take_stock_on_accept();

notify pgrst, 'reload schema';
