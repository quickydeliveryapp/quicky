-- Hero banner: Supabase SQL editor mein ek baar run karo

-- 1) Slides ki table (id 1 se 4)
create table if not exists public.hero_slides (
  id int primary key check (id between 1 and 4),
  image_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.hero_slides enable row level security;

drop policy if exists "hero read" on public.hero_slides;
create policy "hero read" on public.hero_slides for select using (true);

drop policy if exists "hero admin write" on public.hero_slides;
create policy "hero admin write" on public.hero_slides for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Default images (abhi jo public/ mein hain)
insert into public.hero_slides (id, image_url) values
  (1, '/hero-1-v5.webp'), (2, '/hero-2-v5.webp'), (3, '/hero-3-v5.webp'), (4, '/hero-4-v5.webp')
on conflict (id) do nothing;

-- 2) Storage bucket (public read)
insert into storage.buckets (id, name, public) values ('hero', 'hero', true)
on conflict (id) do nothing;

drop policy if exists "hero public read" on storage.objects;
create policy "hero public read" on storage.objects for select using (bucket_id = 'hero');

drop policy if exists "hero admin upload" on storage.objects;
create policy "hero admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'hero' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 3) Text fields admin se editable (null ho to code ka default text dikhega)
alter table public.hero_slides add column if not exists chip text;
alter table public.hero_slides add column if not exists title text;
alter table public.hero_slides add column if not exists cta text;

-- 4) Text on/off toggle (default: on)
alter table public.hero_slides add column if not exists show_text boolean not null default true;
