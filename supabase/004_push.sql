create table device_tokens (
  token text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now());
alter table device_tokens enable row level security;
create policy "own tokens" on device_tokens for select using (user_id = auth.uid());
create policy "delete own tokens" on device_tokens for delete using (user_id = auth.uid());

-- Same phone pe user badle toh token naye user ko transfer ho jata hai
create function save_device_token(p_token text) returns void language sql security definer set search_path=public as $$
  insert into device_tokens(token, user_id) values (p_token, auth.uid())
  on conflict (token) do update set user_id = excluded.user_id $$;
