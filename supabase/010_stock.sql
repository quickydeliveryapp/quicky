-- 010_stock.sql
-- Stock now goes down when a shop accepts an order (it never went down before). Safe to re-run.
-- Run this in the Supabase SQL editor (git push does not change the database).

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
