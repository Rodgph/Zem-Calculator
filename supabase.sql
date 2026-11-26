-- Rode este arquivo inteiro uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  nome text not null default '',
  custo numeric not null,
  descricao text,
  img_path text,
  img_path_secondary text,
  margens jsonb not null default '{"tiktok":20,"shopee":20,"ml":20}',
  created_at timestamptz not null default now()
);

create table if not exists fees (
  marketplace text primary key,
  com numeric not null default 0,
  fix numeric not null default 0,
  imp numeric not null default 0
);

insert into fees (marketplace, com, fix, imp) values
  ('tiktok', 6, 0, 0), ('shopee', 20, 4, 0), ('ml', 14, 6, 0)
on conflict do nothing;

alter table products enable row level security;
alter table fees enable row level security;

-- Sem login: qualquer pessoa com o link do site pode ler e editar.
create policy "acesso products" on products for all to anon using (true) with check (true);
create policy "acesso fees" on fees for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true)
on conflict do nothing;

create policy "fotos ler" on storage.objects for select to anon using (bucket_id = 'produtos');
create policy "fotos enviar" on storage.objects for insert to anon with check (bucket_id = 'produtos');
create policy "fotos trocar" on storage.objects for update to anon using (bucket_id = 'produtos');
create policy "fotos apagar" on storage.objects for delete to anon using (bucket_id = 'produtos');
