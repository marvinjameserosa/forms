create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'order_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.order_status as enum ('pending', 'confirmed', 'packing', 'shipped', 'intransit', 'delivered');
  end if;
end $$;

do $$
begin
  begin
    alter type public.order_status add value if not exists 'paid';
  exception
    when duplicate_object then null;
  end;

  begin
    alter type public.order_status add value if not exists 'cancelled';
  exception
    when duplicate_object then null;
  end;
end $$;

create table if not exists public.merch_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  image text not null,
  tone text not null,
  price numeric(10,2) not null default 0,
  weight_grams integer not null default 0,
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
  payment_method text not null default 'gcash',
  fulfillment_method text not null default 'pickup',
  gcash_reference text not null,
  gcash_receipt_url text not null,
  items jsonb not null default '[]'::jsonb,
  delivery_fee numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  total_weight numeric(10,2) not null default 0,
  weight_unit text not null default 'g',
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.merch_items add column if not exists weight_grams integer not null default 0;
alter table public.orders add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table public.orders add column if not exists total_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists total_weight numeric(10,2) not null default 0;
alter table public.orders add column if not exists weight_unit text not null default 'g';
alter table public.orders drop column if exists item_id;
alter table public.orders drop column if exists item_name;
alter table public.orders drop column if exists size;
alter table public.orders drop column if exists quantity;
alter table public.orders drop column if exists unit_price;
alter table public.orders drop column if exists line_total;

alter table public.merch_items enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'admin';
$$;

drop policy if exists "Merch is readable by everyone" on public.merch_items;
create policy "Merch is readable by everyone"
  on public.merch_items
  for select
  using (true);

drop policy if exists "Merch admin write" on public.merch_items;
create policy "Merch admin write"
  on public.merch_items
  for insert
  with check (public.is_admin());

drop policy if exists "Merch admin update" on public.merch_items;
create policy "Merch admin update"
  on public.merch_items
  for update
  using (public.is_admin());

drop policy if exists "Merch admin delete" on public.merch_items;
create policy "Merch admin delete"
  on public.merch_items
  for delete
  using (public.is_admin());

drop policy if exists "Orders can be created by anyone" on public.orders;
create policy "Orders can be created by anyone"
  on public.orders
  for insert
  with check (true);

drop policy if exists "Orders admin read" on public.orders;
create policy "Orders admin read"
  on public.orders
  for select
  using (public.is_admin());

drop policy if exists "Orders admin update" on public.orders;
create policy "Orders admin update"
  on public.orders
  for update
  using (public.is_admin());

delete from public.orders;
delete from public.merch_items;

insert into public.merch_items (name, tag, image, tone, price, weight_grams, sizes, sort_order)
values
  (
    'Arduino Swags Pack',
    'Includes: Mouse Pad Small, Badge Pin, Magnet, Sticker',
    '/arduino_swags_pack/adph-swags.png',
    'from-amber-400/30 to-black/10',
    199,
    200,
    array['One Size'],
    10
  ),
  (
    'Arduino Starter Set',
    'Includes: Shirt, Badge Pin, Magnet, Sticker',
    '/arduino_starter_set/arduino-starter.png',
    'from-emerald-400/30 to-black/10',
    349,
    250,
    array['XS','S','M','L','XL','XXL'],
    20
  ),
  (
    'Arduino Gear Set',
    'Includes: Vest, Mouse Pad Small, Badge Pin, Magnet, Sticker',
    '/arduino_gear_set/arduino-gear.png',
    'from-sky-500/35 to-black/10',
    499,
    400,
    array['XS','S','M','L','XL','XXL'],
    30
  ),
  (
    'Arduino Tech Set',
    'Includes: Mouse Pad Small, Tote Bag, Mug, Badge Pin, Magnet, Sticker',
    '/arduino_tech_set/arduino-tech.png',
    'from-cyan-500/30 to-black/10',
    399,
    600,
    array['One Size'],
    40
  ),
  (
    'Arduino Maker Bundle',
    'Includes: Shirt, Mouse Pad Big, Badge Pin, Magnet, Sticker',
    '/arduino_maker_bundle/arduino-maker.png',
    'from-teal-500/30 to-black/10',
    599,
    550,
    array['XS','S','M','L','XL','XXL'],
    50
  ),
  (
    'Arduino Startup Bundle',
    'Includes: Vest, Cap, Tote Bag, Badge Pin, Magnet, Sticker',
    '/arduino_startup_bundle/arduino-startup.png',
    'from-orange-500/30 to-black/10',
    649,
    500,
    array['XS','S','M','L','XL','XXL'],
    60
  ),
  (
    'Arduino Creator Bundle',
    'Includes: Shirt, Mouse Pad Small, Tote Bag, Mug, Badge Pin, Magnet, Sticker',
    '/arduino_creator_bundle/arduino-creator.png',
    'from-indigo-500/30 to-black/10',
    699,
    750,
    array['XS','S','M','L','XL','XXL'],
    70
  ),
  (
    'Arduino Core Kit',
    'Includes: Shirt, Cap, Mouse Pad Big, Tote Bag, Mug, Badge Pin, Magnet, Sticker',
    '/arduino_core_kit/arduino-core.png',
    'from-slate-800/40 to-black/10',
    899,
    750,
    array['XS','S','M','L','XL','XXL'],
    80
  ),
  (
    'Arduino Pro Builder Kit',
    'Includes: Shirt, Vest, Mouse Pad Big, Tote Bag, Mug, Badge Pin, Magnet, Sticker',
    '/arduino_pro_builder_kit/arduino-pro.png',
    'from-zinc-700/40 to-black/10',
    1149,
    980,
    array['XS','S','M','L','XL','XXL'],
    90
  ),
  (
    'Arduino Ultimate 2026 Kit',
    'Includes: Shirt, Vest, Cap, Mouse Pad Big, Mouse Pad Small, Tote Bag, Mug, Badge Pin, Magnet, Sticker',
    '/arduino_ultimate_2026_kit/arduino-ultimate.png',
    'from-rose-500/30 to-black/10',
    1399,
    1650,
    array['XS','S','M','L','XL','XXL'],
    100
  ),
  (
    'Shirt',
    'Individual Item',
    '/shirts/adph-shirt-variant1.png',
    'from-slate-900/45 to-black/10',
    300,
    150,
    array['S','M','L','XL'],
    110
  ),
  (
    'Vest',
    'Individual Item',
    '/vest/adph-vest-variant1.png',
    'from-slate-800/40 to-black/10',
    350,
    200,
    array['M','L','XL'],
    120
  ),
  (
    'Cap',
    'Individual Item',
    '/cap/adph-cap.png',
    'from-amber-400/30 to-black/10',
    150,
    100,
    array['One Size'],
    130
  ),
  (
    'Mouse Pad Big',
    'Individual Item',
    '/mouse_pad/adph-mouse-pad-big.png',
    'from-teal-500/30 to-black/10',
    300,
    300,
    array['One Size'],
    140
  ),
  (
    'Mouse Pad Small',
    'Individual Item',
    '/mouse_pad/adph-mouse-pad-small.png',
    'from-cyan-500/30 to-black/10',
    130,
    100,
    array['One Size'],
    150
  ),
  (
    'Tote Bag',
    'Individual Item',
    '/tote_bag/adph-tote-bag.png',
    'from-emerald-400/30 to-black/10',
    150,
    100,
    array['One Size'],
    160
  ),
  (
    'Mug',
    'Individual Item',
    '/mug/adph-mug.png',
    'from-amber-200/35 to-transparent',
    100,
    300,
    array['One Size'],
    170
  ),
  (
    'Badge Pin',
    'Individual Item',
    '/pins-and-magnets/adph-pins-and-magnets.png',
    'from-rose-400/30 to-black/10',
    30,
    30,
    array['One Size'],
    180
  ),
  (
    'Magnet',
    'Individual Item',
    '/pins-and-magnets/adph-pins-and-magnets.png',
    'from-indigo-500/30 to-black/10',
    40,
    50,
    array['One Size'],
    190
  ),
  (
    'Sticker',
    'Individual Item',
    '/stickers/adph-stickers.png',
    'from-slate-700/35 to-black/10',
    10,
    20,
    array['One Size'],
    200
  );
