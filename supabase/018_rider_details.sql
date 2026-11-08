-- 018_rider_details.sql
-- Rider onboarding details: vehicle, licence, ID (last 4 only), emergency contact and address.
-- Area managers add them while onboarding and can edit them later for riders in their own area. Safe to re-run.
-- Needs 017_onboarding.sql to have been run first.
-- RUN THIS IN THE SUPABASE SQL EDITOR (git push does not change the database).

-- 1) Where the details live. Only the admin can read the table directly; everyone else goes through the functions below.
create table if not exists public.rider_details (
  rider_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text check (vehicle_type in ('motorbike', 'scooter', 'electric', 'bicycle', 'other')),
  vehicle_number text,
  licence_number text,
  id_type text check (id_type in ('aadhaar', 'voter', 'pan', 'passport', 'other')),
  id_last4 text check (id_last4 ~ '^[A-Z0-9]{4}$'),   -- never the full ID number
  emergency_name text,
  emergency_phone text,
  address text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.rider_details enable row level security;
drop policy if exists "rider details admin read" on public.rider_details;
create policy "rider details admin read" on public.rider_details for select to authenticated using (public.my_role() = 'admin');
revoke insert, update, delete on public.rider_details from anon, authenticated;

alter table public.member_invites add column if not exists details jsonb;

-- 2) Check and tidy the details. Raises a readable message for anything missing or wrong.
create or replace function public._clean_rider_details(p jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  vt text := lower(nullif(trim(coalesce(p->>'vehicle_type', '')), ''));
  vn text := upper(regexp_replace(coalesce(p->>'vehicle_number', ''), '[^A-Za-z0-9]', '', 'g'));
  dl text := upper(regexp_replace(coalesce(p->>'licence_number', ''), '[^A-Za-z0-9]', '', 'g'));
  it text := lower(nullif(trim(coalesce(p->>'id_type', '')), ''));
  il text := upper(regexp_replace(coalesce(p->>'id_last4', ''), '[^A-Za-z0-9]', '', 'g'));
  en text := nullif(trim(coalesce(p->>'emergency_name', '')), '');
  ep text := regexp_replace(coalesce(p->>'emergency_phone', ''), '\D', '', 'g');
  ad text := nullif(trim(coalesce(p->>'address', '')), '');
begin
  if p is null then raise exception 'Add the rider details.'; end if;
  if vt is null or vt not in ('motorbike', 'scooter', 'electric', 'bicycle', 'other') then
    raise exception 'Choose the rider''s vehicle.'; end if;
  if vt = 'bicycle' then
    vn := null; dl := null;
  else
    if length(vn) < 6 or length(vn) > 12 then raise exception 'Enter the vehicle number, for example PB10AB1234.'; end if;
    if length(dl) < 8 or length(dl) > 20 then raise exception 'Enter the driving licence number.'; end if;
  end if;
  if it is not null and it not in ('aadhaar', 'voter', 'pan', 'passport', 'other') then raise exception 'Choose the ID type.'; end if;
  if it is null then il := null;
  elsif length(il) <> 4 then raise exception 'Enter only the last 4 digits of the ID.'; end if;
  if en is null then raise exception 'Enter the emergency contact name.'; end if;
  if length(ep) = 12 and left(ep, 2) = '91' then ep := right(ep, 10); end if;
  if length(ep) <> 10 then raise exception 'Enter a valid 10-digit emergency contact number.'; end if;
  return jsonb_build_object('vehicle_type', vt, 'vehicle_number', vn, 'licence_number', dl, 'id_type', it, 'id_last4', il,
                            'emergency_name', en, 'emergency_phone', ep, 'address', ad);
end $$;
revoke all on function public._clean_rider_details(jsonb) from public, anon, authenticated;

-- 3) Save cleaned details for a rider
create or replace function public._save_rider_details(p_rider uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into rider_details(rider_id, vehicle_type, vehicle_number, licence_number, id_type, id_last4,
                            emergency_name, emergency_phone, address, updated_by)
  values (p_rider, p->>'vehicle_type', p->>'vehicle_number', p->>'licence_number', p->>'id_type', p->>'id_last4',
          p->>'emergency_name', p->>'emergency_phone', p->>'address', auth.uid())
  on conflict (rider_id) do update set
    vehicle_type = excluded.vehicle_type, vehicle_number = excluded.vehicle_number, licence_number = excluded.licence_number,
    id_type = excluded.id_type, id_last4 = excluded.id_last4, emergency_name = excluded.emergency_name,
    emergency_phone = excluded.emergency_phone, address = excluded.address, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public._save_rider_details(uuid, jsonb) from public, anon, authenticated;

-- 4) Onboarding functions now carry the rider details. The old versions are dropped so there is no ambiguity.
drop function if exists public._onboard_apply(uuid, text, text, text, boolean, text, text, float8, float8);
drop function if exists public.am_onboard(text, text, text, boolean, text, text, float8, float8);

create or replace function public._onboard_apply(
  p_user uuid, p_role text, p_area text, p_name text, p_approve boolean,
  p_shop_name text, p_shop_address text, p_lat float8, p_lng float8, p_details jsonb default null) returns void
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
  if p_role = 'rider' and p_details is not null then
    perform public._save_rider_details(p_user, p_details);
  end if;
end $$;
revoke all on function public._onboard_apply(uuid, text, text, text, boolean, text, text, float8, float8, jsonb) from public, anon, authenticated;

create or replace function public.am_onboard(
  p_phone text, p_role text, p_name text default null, p_approve boolean default false,
  p_shop_name text default null, p_shop_address text default null, p_lat float8 default null, p_lng float8 default null,
  p_details jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_area text := my_area();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_shop text := nullif(trim(coalesce(p_shop_name, '')), '');
  v_addr text := nullif(trim(coalesce(p_shop_address, '')), '');
  v_det jsonb := null;
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
  else
    if v_name is null then raise exception 'Enter the rider''s full name.'; end if;
    v_det := public._clean_rider_details(p_details);
  end if;

  select u.id, p.role, p.area into v_uid, v_role, v_parea
    from auth.users u join profiles p on p.id = u.id
   where ltrim(coalesce(u.phone, ''), '+') = v_phone limit 1;

  if v_uid is not null then
    if coalesce(v_role, '') in ('admin', 'area_manager') then raise exception 'This number belongs to a Quicky staff account.'; end if;
    if v_role in ('rider', 'shop') and v_role <> p_role then raise exception 'This number is already registered as a %.', v_role; end if;
    if v_parea is not null and v_parea <> v_area then raise exception 'This person is already in another area.'; end if;
    if v_role = p_role and v_parea = v_area then raise exception 'This person is already in your area.'; end if;
    perform public._onboard_apply(v_uid, p_role, v_area, v_name, p_approve, v_shop, v_addr, p_lat, p_lng, v_det);
    update member_invites set claimed_at = now() where phone = v_phone and claimed_at is null and area = v_area;
    return 'added';
  end if;

  if exists (select 1 from member_invites where phone = v_phone and claimed_at is null and area <> v_area) then
    raise exception 'This number has already been invited by another area.'; end if;
  delete from member_invites where phone = v_phone and claimed_at is null;
  insert into member_invites(phone, role, area, full_name, approve, shop_name, shop_address, shop_lat, shop_lng, details, created_by)
    values (v_phone, p_role, v_area, v_name, coalesce(p_approve, false), v_shop, v_addr, p_lat, p_lng, v_det, auth.uid());
  return 'invited';
end $$;

-- 5) First login of an invited number
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v member_invites%rowtype;
begin
  insert into profiles(id, phone) values (new.id, new.phone);
  if new.phone is not null then
    begin
      select * into v from member_invites where claimed_at is null and phone = ltrim(new.phone, '+') limit 1;
      if found then
        perform public._onboard_apply(new.id, v.role, v.area, v.full_name, v.approve, v.shop_name, v.shop_address, v.shop_lat, v.shop_lng, v.details);
        update member_invites set claimed_at = now() where id = v.id;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $$;

-- 6) Rider details for the riders in my area, and editing them later
create or replace function public.am_rider_details() returns table(
  out_rider uuid, out_vehicle_type text, out_vehicle_number text, out_licence_number text, out_id_type text,
  out_id_last4 text, out_emergency_name text, out_emergency_phone text, out_address text)
language sql stable security definer set search_path = public as $$
  select d.rider_id, d.vehicle_type, d.vehicle_number, d.licence_number, d.id_type, d.id_last4,
         d.emergency_name, d.emergency_phone, d.address
    from rider_details d join profiles p on p.id = d.rider_id
   where coalesce(my_role(), '') = 'area_manager' and p.role = 'rider' and p.area is not null and p.area = my_area() $$;

create or replace function public.am_set_rider_details(p_rider uuid, p_details jsonb, p_name text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_det jsonb;
begin
  if coalesce(my_role(), '') <> 'area_manager' then raise exception 'Not allowed'; end if;
  if not exists (select 1 from profiles where id = p_rider and role = 'rider' and area is not null and area = my_area()) then
    raise exception 'Not in your area'; end if;
  v_det := public._clean_rider_details(p_details);
  perform public._save_rider_details(p_rider, v_det);
  if nullif(trim(coalesce(p_name, '')), '') is not null then
    update profiles set full_name = trim(p_name) where id = p_rider;
  end if;
end $$;

grant execute on function public.am_onboard(text, text, text, boolean, text, text, float8, float8, jsonb) to authenticated;
grant execute on function public.am_rider_details() to authenticated;
grant execute on function public.am_set_rider_details(uuid, jsonb, text) to authenticated;
notify pgrst, 'reload schema';
