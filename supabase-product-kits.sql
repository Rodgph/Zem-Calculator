-- Rode no SQL Editor depois de supabase-containers.sql para habilitar kits.

alter table public.products
  add column if not exists parent_product_id uuid
    references public.products(id) on delete cascade;

alter table public.products
  add column if not exists kit_quantity integer
    check (kit_quantity is null or kit_quantity >= 2);

create index if not exists products_parent_product_id_idx
  on public.products(parent_product_id);
