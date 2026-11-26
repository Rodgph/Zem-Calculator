-- Rode no SQL Editor para adicionar a segunda imagem a bancos já existentes.

alter table public.products
  add column if not exists img_path_secondary text;
