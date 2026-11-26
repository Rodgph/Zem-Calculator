-- Rode no SQL Editor para adicionar descrições a bancos já existentes.

alter table public.products
  add column if not exists descricao text;
