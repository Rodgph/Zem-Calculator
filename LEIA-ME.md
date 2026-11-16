# Preço e Margem — Vercel + Supabase

O frontend usa React + Vite em `src/`. Os scripts SQL criam as tabelas e a pasta de fotos.
Este sistema precisa de um projeto Supabase próprio; não reutilize o projeto de outra pessoa.

## 1. Supabase
1. Crie um projeto em supabase.com.
2. No **SQL Editor**, execute `supabase.sql`, `supabase-containers.sql` e `supabase-product-kits.sql`.
3. Configure a URL do projeto e a chave pública (**anon** ou **publishable**) em `src/lib/supabase.js`.
   Nunca use a chave `service_role` no frontend.

## 2. Vercel
1. Na Vercel, importe este repositório. O Vite usa `npm run build` e gera a pasta `dist`.
2. Configure a URL e a chave pública do Supabase em `src/lib/supabase.js` antes de publicar.

## Importar contêineres
- Selecione **Importar contêiner** ou solte uma planilha `.xlsx`, `.xls` ou `.csv` em qualquer lugar do site.
- Informe o nome ou número do contêiner. A planilha precisa ter colunas de SKU/货号, nome/品名, custo e Shopee.
- O preço Shopee pode ser editado na tabela; lucro e percentual são recalculados pelas taxas configuradas.
- Use **+ Marketplace** para mostrar ou ocultar colunas de preço e lucro.
- Em **Configurar taxas**, informe comissão, taxa fixa e impostos conforme o painel da sua conta. Esses valores são salvos na tabela `fees` do Supabase; não há sincronização automática com os marketplaces. Uma coluna sem taxas cadastradas mostra “Configure as taxas”.

## Observações
- Sem login: quem tiver o link do site consegue ver, editar e apagar os dados.
- As taxas iniciais (TikTok 6%, Shopee 20% + R$ 4, Mercado Livre 14% + R$ 6) são valores de referência já usados pelo sistema; confirme-os no painel antes de tomar decisões de preço.
- Os produtos cadastrados na versão antiga não vêm junto; cadastre de novo.
