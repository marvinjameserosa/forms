create extension if not exists "pgcrypto";

create type public.order_status as enum ('pending', 'paid');

create table if not exists public.merch_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  image text not null,
  tone text not null,
  price numeric(10,2) not null default 0,
  sizes text[] not null default array['One Size'],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  item_id uuid references public.merch_items(id),
  item_name text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.merch_items enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'admin';
$$;

create policy "Merch is readable by everyone"
  on public.merch_items
  for select
  using (true);

create policy "Merch admin write"
  on public.merch_items
  for insert
  with check (public.is_admin());

create policy "Merch admin update"
  on public.merch_items
  for update
  using (public.is_admin());

create policy "Merch admin delete"
  on public.merch_items
  for delete
  using (public.is_admin());

create policy "Orders can be created by anyone"
  on public.orders
  for insert
  with check (true);

create policy "Orders admin read"
  on public.orders
  for select
  using (public.is_admin());

create policy "Orders admin update"
  on public.orders
  for update
  using (public.is_admin());
