-- Area manager: shop/rider add, remove, online/offline. Safe to re-run.

alter table public.profiles add column if not exists is_online boolean not null default false;

-- Guard: area change sirf in functions se allowed (flag inside them). Admin ka rule same.
create or replace function public.guard_profile_role() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.my_role() is distinct from 'admin'
     and current_setting('app.am_action', true) is distinct from 'on'
     and (new.role is distinct from old.role or new.area is distinct from old.area) then
    raise exception 'Only an admin can change role or area';
  end if;
  return new;
end $$;

-- Online / offline (sirf apne area ke shop/rider)
create or replace function public.am_set_online(p_id uuid, p_online boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'area_manager' then raise exception 'Not allowed'; end if;
  update public.profiles set is_online = p_online
    where id = p_id and role in ('shop','rider') and area = public.my_area();
  if not found then raise exception 'Not in your area'; end if;
end $$;

-- Add: phone se, sirf shop/rider role wala user jiska koi area na ho ya same area ho
create or replace function public.am_add_member(p_phone text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.my_role() is distinct from 'area_manager' then raise exception 'Not allowed'; end if;
  select p.id into v_id from public.profiles p
    join auth.users u on u.id = p.id
    where u.phone = p_phone and p.role in ('shop','rider')
      and (p.area is null or p.area = public.my_area())
    limit 1;
  if v_id is null then
    raise exception 'No shop or rider found with this phone (role shop/rider hona chahiye, aur kisi aur area mein nahi)';
  end if;
  perform set_config('app.am_action', 'on', true);
  update public.profiles set area = public.my_area() where id = v_id;
end $$;

-- Remove: area se hatana (role nahi badlega)
create or replace function public.am_remove_member(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'area_manager' then raise exception 'Not allowed'; end if;
  perform set_config('app.am_action', 'on', true);
  update public.profiles set area = null, is_online = false
    where id = p_id and role in ('shop','rider') and area = public.my_area();
  if not found then raise exception 'Not in your area'; end if;
end $$;

grant execute on function public.am_set_online(uuid, boolean) to authenticated;
grant execute on function public.am_add_member(text) to authenticated;
grant execute on function public.am_remove_member(uuid) to authenticated;

notify pgrst, 'reload schema';
