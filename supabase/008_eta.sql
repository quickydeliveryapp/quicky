-- Header mein "Delivery in X minutes": sabse paas ki open, approved shop se (5 min packing + doori x 1.3 @ 20 km/h, kam se kam 3 min)
create or replace function delivery_eta(p_lat float8, p_lng float8) returns int
language sql stable security definer set search_path=public as $$
  select (5 + greatest(ceil(min(st_distance(s.location, st_point(p_lng, p_lat)::geography)) * 1.3 / 1000 / 20 * 60), 3))::int
  from shops s
  where s.is_open and s.status = 'approved'
    and st_dwithin(s.location, st_point(p_lng, p_lat)::geography, s.delivery_radius_m) $$;
