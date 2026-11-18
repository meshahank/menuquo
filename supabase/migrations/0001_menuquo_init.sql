-- Menuquo initial schema: restaurants -> categories -> menu_items (three levels)
-- Public menu is readable by anyone (anon); owners manage their own rows via Google auth.

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  currency text not null default '₹',
  hero_image text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  tag text,
  image_url text,
  available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_items_restaurant_idx on public.menu_items (restaurant_id);
create index if not exists categories_restaurant_idx on public.categories (restaurant_id);

alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;

-- Public read (the guest-facing QR menu)
create policy "public read restaurants" on public.restaurants
  for select using (true);
create policy "public read categories" on public.categories
  for select using (true);
create policy "public read menu items" on public.menu_items
  for select using (true);

-- Owner write access
create policy "owner write restaurants" on public.restaurants
  for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "owner write categories" on public.categories
  for all using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner = auth.uid()
    )
  );
create policy "owner write menu items" on public.menu_items
  for all using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner = auth.uid()
    )
  );

-- Auto-create a profile row on signup
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile write" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
