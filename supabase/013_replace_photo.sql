-- 013_replace_photo.sql
-- A shop that sells a product can now replace its photo (before, only the first photo could be set). Safe to re-run.
-- Needs 011_inventory.sql to have been run first.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).
-- Note: a product has one photo shared by every shop that sells it, so replacing it changes it for all of them.

create or replace function public.set_product_image(p_product uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_url), '') = '' then raise exception 'Image missing'; end if;
  if coalesce(my_role(), '') <> 'admin' and not exists (
       select 1 from shop_products sp join shops s on s.id = sp.shop_id
       where sp.product_id = p_product and s.owner_id = auth.uid()) then
    raise exception 'Not allowed'; end if;
  update products set image_url = p_url where id = p_product;
  if not found then raise exception 'Product not found'; end if;
end $$;

grant execute on function public.set_product_image(uuid, text) to authenticated;
notify pgrst, 'reload schema';
