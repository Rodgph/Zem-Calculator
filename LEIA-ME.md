# Preço e Margem — Vercel + Supabase

O frontend usa React + Vite em `src/`. Os scripts SQL criam as tabelas e a pasta de fotos.
Este sistema precisa de um projeto Supabase próprio; não reutilize o projeto de outra pessoa.

## 1. Supabase
1. Crie um projeto em supabase.com.
2. No **SQL Editor**, execute `supabase.sql`, `supabase-containers.sql` e `supabase-product-kits.sql`.
   Para um banco existente, execute também `supabase-product-description.sql` e `supabase-product-images.sql` para garantir as colunas adicionais.
3. Configure a URL do projeto e a chave pública (**anon** ou **publishable**) em `src/lib/supabase.js`.
   Nunca use a chave `service_role` no frontend.
4. Para gerar anúncios, cadastre `OPENAI_API_KEY` em **Edge Functions → Secrets**. A OpenAI gera o texto, as estimativas e a imagem do anúncio. Nunca coloque essa chave no frontend ou no repositório.

## 2. Vercel
1. Na Vercel, importe este repositório. O Vite usa `npm run build` e gera a pasta `dist`.
2. Configure a URL e a chave pública do Supabase em `src/lib/supabase.js` antes de publicar.

## Upseller Bridge
- Instale a pasta `upseller-extension` no Chrome por `chrome://extensions` → **Modo do desenvolvedor** → **Carregar sem compactação**.
- Em outros computadores, use o pacote da mesma versão e remova a instalação antiga antes de carregar a nova. O ID fixo da extensão é `gfmeaommeefhgngokhdoknkgfccgklmj`.
- Mantenha a pasta instalada no mesmo local e não remova a propriedade `key` do manifesto; ela mantém o mesmo ID em todas as máquinas.

## Importar contêineres
- Selecione **Importar contêiner** ou solte uma planilha `.xlsx`, `.xls` ou `.csv` em qualquer lugar do site.
- Informe o nome ou número do contêiner. A planilha precisa ter colunas de SKU/货号, nome/品名, custo e Shopee.
- O preço Shopee pode ser editado na tabela; lucro e percentual são recalculados pelas taxas configuradas.
- Use **+ Marketplace** para mostrar ou ocultar colunas de preço e lucro.
- Em **Configurar taxas**, informe comissão, taxa fixa e impostos conforme o painel da sua conta. Esses valores são salvos na tabela `fees` do Supabase; não há sincronização automática com os marketplaces. Uma coluna sem taxas cadastradas mostra “Configure as taxas”.
- A planilha pode ter uma imagem principal (`图片`) e outra imagem (`装柜图片`). A tabela mostra uma miniatura; ao abrir, as duas aparecem lado a lado, cada uma com zoom próprio.

## Observações
- Sem login: quem tiver o link do site consegue ver, editar e apagar os dados.
- As taxas iniciais (TikTok 6%, Shopee 20% + R$ 4, Mercado Livre 14% + R$ 6) são valores de referência já usados pelo sistema; confirme-os no painel antes de tomar decisões de preço.
- Os produtos cadastrados na versão antiga não vêm junto; cadastre de novo.
