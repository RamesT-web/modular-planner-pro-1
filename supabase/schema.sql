-- ============================================================
-- MODULAR PLANNER PRO — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 0. Extensions
create extension if not exists "uuid-ossp";

-- 1. PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text default '',
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins read all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PROJECTS
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('kitchen','wardrobe','other')),
  client_name text default '',
  location text default '',
  unit_system text not null default 'mm' check (unit_system in ('mm','inches','ft-in')),
  notes text default '',
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projects enable row level security;
create policy "Users manage own projects" on public.projects for all using (auth.uid() = user_id);

-- 3. STANDARDS (per-project material & construction standards)
create table public.standards (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,                         -- e.g. "Carcass", "Shutter", "Countertop"
  category text not null default 'general',   -- carcass, shutter, countertop, hardware, edgeband, back_panel
  material text default '',                   -- e.g. "HDHMR", "BWP Ply", "Acrylic"
  thickness_mm numeric default 0,
  brand text default '',
  finish text default '',
  rate_per_sqft numeric default 0,
  rate_per_unit numeric default 0,
  edge_band_mm numeric default 0,
  notes text default '',
  created_at timestamptz default now()
);
alter table public.standards enable row level security;
create policy "Users manage standards via project" on public.standards for all using (
  exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
);

-- 4. MODULES (individual cabinets / units)
create table public.modules (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,                     -- e.g. "Base Unit B1", "Wall Unit W3"
  module_type text not null default 'base', -- base, wall, tall, drawer, corner, shelf, hanging
  zone text default '',                   -- e.g. "cooking", "sink", "dress_left"
  width_mm numeric not null default 600,
  height_mm numeric not null default 720,
  depth_mm numeric not null default 550,
  -- Door config
  door_count int default 1,
  door_style text default 'slab',         -- slab, shaker, profile, glass
  door_open_type text default 'hinged',   -- hinged, sliding, lift_up, flap, none
  -- Drawers
  drawer_count int default 0,
  drawer_heights_mm text default '[]',    -- JSON array
  -- Shelves
  shelf_count int default 1,
  shelf_type text default 'fixed',        -- fixed, adjustable, pullout, none
  -- Back panel
  has_back_panel boolean default true,
  back_panel_type text default 'recessed', -- recessed, nailed, none
  -- Overrides (null = use project standards)
  carcass_material text,
  shutter_material text,
  -- Accessories / hardware
  hardware_json text default '{}',        -- JSON: hinges, channels, handles etc.
  -- Position
  position_index int default 0,
  notes text default '',
  created_at timestamptz default now()
);
alter table public.modules enable row level security;
create policy "Users manage modules via project" on public.modules for all using (
  exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
);

-- 5. OUTPUTS — Generated schedules (stored as JSON blobs for fast retrieval)
create table public.outputs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  output_type text not null check (output_type in ('door_schedule','cut_list','material_takeoff','hardware_schedule')),
  data jsonb not null default '[]',
  generated_at timestamptz default now()
);
alter table public.outputs enable row level security;
create policy "Users manage outputs via project" on public.outputs for all using (
  exists (select 1 from public.projects where id = project_id and user_id = auth.uid())
);

-- 6. TEMPLATES — Reusable standards profiles & module templates (global + per-user)
create table public.standard_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade, -- null = global/admin template
  name text not null,
  description text default '',
  type text not null default 'kitchen' check (type in ('kitchen','wardrobe','other')),
  standards_json jsonb not null default '[]',  -- array of standard objects
  is_global boolean default false,
  created_at timestamptz default now()
);
alter table public.standard_templates enable row level security;
create policy "Users read own or global templates" on public.standard_templates for select using (
  auth.uid() = user_id or is_global = true
);
create policy "Users manage own templates" on public.standard_templates for all using (
  auth.uid() = user_id
);
create policy "Admins manage global templates" on public.standard_templates for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create table public.module_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text default '',
  type text not null default 'kitchen' check (type in ('kitchen','wardrobe','other')),
  module_json jsonb not null default '{}',     -- full module definition
  is_global boolean default false,
  created_at timestamptz default now()
);
alter table public.module_templates enable row level security;
create policy "Users read own or global module templates" on public.module_templates for select using (
  auth.uid() = user_id or is_global = true
);
create policy "Users manage own module templates" on public.module_templates for all using (
  auth.uid() = user_id
);
create policy "Admins manage global module templates" on public.module_templates for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 7. Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();

-- 8. Indexes for performance
create index idx_projects_user on public.projects(user_id);
create index idx_standards_project on public.standards(project_id);
create index idx_modules_project on public.modules(project_id);
create index idx_outputs_project on public.outputs(project_id);
create index idx_outputs_type on public.outputs(project_id, output_type);

-- 9. Seed: make the first user admin (run after first signup)
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
