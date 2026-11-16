# Preço e Margem — Vercel + Supabase

Arquivos: `index.html` (o site inteiro) e `supabase.sql` (cria as tabelas e a pasta de fotos).
Este sistema precisa de um projeto Supabase próprio; não reutilize o projeto de outra pessoa.

## 1. Supabase
1. Crie um projeto em supabase.com.
2. No **SQL Editor**, execute `supabase.sql` e depois `supabase-containers.sql`.
3. Em **Project Settings → API**, copie a **Project URL** e a chave pública (**anon** ou **publishable**).
4. No início do script de `index.html`, configure a URL do projeto e a chave pública.
   Nunca use a chave `service_role` aqui.

## 2. Vercel
1. Na Vercel: **Add New → Project**, importe este repositório, deixe **Framework Preset: Other** e clique em **Deploy**.
2. Abra o link que a Vercel gerar. O sistema só funcionará depois de configurar a URL e a chave pública do Supabase no `index.html` e enviar a alteração ao GitHub.

## Importar contêineres
- Selecione **Importar contêiner** ou solte uma planilha `.xlsx`, `.xls` ou `.csv` em qualquer lugar do site.
- Informe o nome ou número do contêiner. A planilha precisa ter colunas de SKU/货号, nome/品名, custo e Shopee.
- O preço Shopee pode ser editado na tabela; lucro e percentual são recalculados pelas taxas configuradas.

## Observações
- Sem login: quem tiver o link do site consegue ver, editar e apagar os dados.
- As taxas iniciais (TikTok 6%, Shopee 20% + R$ 4, Mercado Livre 14% + R$ 6) são só um ponto de partida: ajuste na tela.
- Os produtos cadastrados na versão antiga (dentro do Claude) não vêm junto; cadastre de novo.
