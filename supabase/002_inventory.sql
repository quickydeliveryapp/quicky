-- Shop owner product add/update by barcode (owner ki apni shop pe hi chalega)
create or replace function add_shop_product(
  p_barcode text, p_name text, p_unit text, p_category text, p_price numeric, p_stock int)
returns void language plpgsql security definer set search_path=public as $$
declare v_shop uuid; v_prod uuid;
begin
  select id into v_shop from shops where owner_id = auth.uid() limit 1;
  if v_shop is null then raise exception 'Aapki koi shop nahi mili'; end if;
  if coalesce(trim(p_barcode),'') = '' or coalesce(trim(p_name),'') = '' then
    raise exception 'Barcode aur naam zaroori hain'; end if;
  select id into v_prod from products where barcode = p_barcode;
  if v_prod is null then
    insert into products(name, unit, category, barcode) values (trim(p_name), p_unit, p_category, p_barcode)
    returning id into v_prod;
  end if;
  insert into shop_products(shop_id, product_id, price, stock, is_available)
  values (v_shop, v_prod, p_price, p_stock, p_stock > 0)
  on conflict (shop_id, product_id) do update
    set price = excluded.price, stock = excluded.stock, is_available = excluded.is_available;
end $$;
