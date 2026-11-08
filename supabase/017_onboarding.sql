-- 017_onboarding.sql
-- Area manager onboarding for riders and shops: set up someone who already has an account, or invite a phone number
-- that has not signed in yet (the account is set up automatically on their first login). Safe to re-run.
-- Needs 015_deposit.sql (and everything before it) to have been run first.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

-- 1) Invites for people who have not signed up yet. No policies on purpose: only the functions below can touch it.
create table if not exists public.member_invites (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  role text not null check (role in ('rider', 'shop')),
  area text not null,
  full_name text,
  approve boolean not null default false,
  shop_name text, shop_address text, shop_lat float8, shop_lng float8,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create unique index if not exists member_invites_one_open_per_phone on public.member_invites(phone) where claimed_at is null;
alter table public.member_invites enable row level security;
revoke all on public.member_invites from anon, authenticated;

-- 2) Internal: give a user the rider/shop role in an area, and create the shop row for a shop.
--    Shops start as 'pending': the admin still approves them before they get orders.
create or replace function public._onboard_apply(
  p_user uuid, p_role text, p_area text, p_name text, p_approve boolean,
  p_shop_name text, p_shop_address text, p_lat float8, p_lng float8) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.am_action', 'on', true);
  update profiles set
      role = p_role,
      area = p_area,
      is_online = false,
      full_name = coalesce(nullif(trim(coalesce(p_name, '')), ''), case when p_role = 'shop' then p_shop_name end, full_name),
      rider_approved = case when p_role = 'rider' then (rider_approved or coalesce(p_approve, false)) else rider_approved end
    where id = p_user;
  if p_role = 'shop' then
    insert into shops(owner_id, name, address, location, status)
    select p_user, p_shop_name, p_shop_address, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, 'pending'
    where not exists (select 1 from shops where owner_id = p_user);
  end if;
end $$;
revoke all on function public._onboard_apply(uuid, text, text, text, boolean, text, text, float8, float8) from public, anon, authenticated;

-- 3) Onboard by phone. Returns 'added' (account existed, now set up) or 'invited' (waiting for their first login).
create or replace function public.am_onboard(
  p_phone text, p_role text, p_name text default null, p_approve boolean default false,
  p_shop_name text default null, p_shop_address text default null, p_lat float8 default null, p_lng float8 default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_area text := my_area();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_shop text := nullif(trim(coalesce(p_shop_name, '')), '');
  v_addr text := nullif(trim(coalesce(p_shop_address, '')), '');
  v_uid uuid; v_role text; v_parea text;
begin
  if coalesce(my_role(), '') <> 'area_manager' then raise exception 'Not allowed'; end if;
  if v_area is null then raise exception 'You do not have an area yet. Ask an admin to assign one.'; end if;
  if p_role not in ('rider', 'shop') then raise exception 'Choose rider or shop'; end if;
  if length(v_phone) = 10 then v_phone := '91' || v_phone; end if;
  if length(v_phone) < 11 or length(v_phone) > 15 then raise exception 'Enter a valid 10-digit mobile number.'; end if;
  if p_role = 'shop' then
    if v_shop is null then raise exception 'Enter the shop name.'; end if;
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'Add the shop location. Use your current location when you are at the shop.'; end if;
  end if;

  select u.id, p.role, p.area into v_uid, v_role, v_parea
    from auth.users u join profiles p on p.id = u.id
   where ltrim(coalesce(u.phone, ''), '+') = v_phone limit 1;

  if v_uid is not null then
    if coalesce(v_role, '') in ('admin', 'area_manager') then raise exception 'This number belongs to a Quicky staff account.'; end if;
    if v_role in ('rider', 'shop') and v_role <> p_role then raise exception 'This number is already registered as a %.', v_role; end if;
    if v_parea is not null and v_parea <> v_area then raise exception 'This person is already in another area.'; end if;
    if v_role = p_role and v_parea = v_area then raise exception 'This person is already in your area.'; end if;
    perform public._onboard_apply(v_uid, p_role, v_area, v_name, p_approve, v_shop, v_addr, p_lat, p_lng);
    update member_invites set claimed_at = now() where phone = v_phone and claimed_at is null and area = v_area;
    return 'added';
  end if;

  if exists (select 1 from member_invites where phone = v_phone and claimed_at is null and area <> v_area) then
    raise exception 'This number has already been invited by another area.'; end if;
  delete from member_invites where phone = v_phone and claimed_at is null;
  insert into member_invites(phone, role, area, full_name, approve, shop_name, shop_address, shop_lat, shop_lng, created_by)
    values (v_phone, p_role, v_area, v_name, coalesce(p_approve, false), v_shop, v_addr, p_lat, p_lng, auth.uid());
  return 'invited';
end $$;

-- 4) Invites waiting for a first login, and cancelling one
create or replace function public.am_invites() returns table(out_id uuid, out_phone text, out_role text, out_name text, out_shop_name text, out_created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.phone, i.role, i.full_name, i.shop_name, i.created_at
    from member_invites i
   where coalesce(my_role(), '') = 'area_manager' and i.claimed_at is null and i.area = my_area()
   order by i.created_at desc $$;

create or replace function public.am_cancel_invite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(my_role(), '') <> 'area_manager' then raise exception 'Not allowed'; end if;
  delete from member_invites where id = p_id and claimed_at is null and area = my_area();
  if not found then raise exception 'Invite not found'; end if;
end $$;

-- 5) Shops of my area with their approval status (area managers cannot read the shops table directly)
create or replace function public.am_shops() returns table(out_id uuid, out_owner uuid, out_name text, out_address text, out_status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.owner_id, s.name, s.address, s.status
    from shops s join profiles p on p.id = s.owner_id
   where coalesce(my_role(), '') = 'area_manager' and p.area is not null and p.area = my_area() $$;

-- 6) First login: if the phone was invited, set the account up straight away. Never blocks signing up.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v member_invites%rowtype;
begin
  insert into profiles(id, phone) values (new.id, new.phone);
  if new.phone is not null then
    begin
      select * into v from member_invites where claimed_at is null and phone = ltrim(new.phone, '+') limit 1;
      if found then
        perform public._onboard_apply(new.id, v.role, v.area, v.full_name, v.approve, v.shop_name, v.shop_address, v.shop_lat, v.shop_lng);
        update member_invites set claimed_at = now() where id = v.id;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;

grant execute on function public.am_onboard(text, text, text, boolean, text, text, float8, float8) to authenticated;
grant execute on function public.am_invites() to authenticated;
grant execute on function public.am_cancel_invite(uuid) to authenticated;
grant execute on function public.am_shops() to authenticated;
notify pgrst, 'reload schema';
