-- Rode no SQL Editor depois de supabase.sql para habilitar contêineres.

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists nome text not null default '',
  add column if not exists shopee numeric,
  add column if not exists container_id uuid references public.containers(id) on delete cascade;

create index if not exists products_container_id_idx
  on public.products(container_id);

alter table public.containers enable row level security;

drop policy if exists "acesso containers" on public.containers;
create policy "acesso containers" on public.containers
  for all to anon using (true) with check (true);

insert into public.containers (nome)
select '1'
where not exists (select 1 from public.containers);

update public.products
set container_id = (
  select id from public.containers order by created_at, id limit 1
)
where container_id is null;
