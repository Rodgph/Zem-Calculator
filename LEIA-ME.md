# Preço e Margem — Vercel + Supabase

Arquivos: `index.html` (o site inteiro) e `supabase.sql` (cria as tabelas e a pasta de fotos).
Este sistema precisa de um projeto Supabase próprio; não reutilize o projeto de outra pessoa.

## 1. Supabase
1. Crie um projeto em supabase.com.
2. Vá em **SQL Editor**, cole o conteúdo de `supabase.sql` e clique em **Run**.
3. Vá em **Project Settings → API** e copie a **Project URL** e a chave pública (**anon** ou **publishable**).
4. No início do script de `index.html`, troque `COLE_AQUI_A_URL_DO_PROJETO` e `COLE_AQUI_A_CHAVE_PUBLICA` pela URL do projeto e pela chave pública copiada.
   Nunca use a chave `service_role` aqui.

## 2. Vercel
1. Na Vercel: **Add New → Project**, importe este repositório, deixe **Framework Preset: Other** e clique em **Deploy**.
2. Abra o link que a Vercel gerar. O sistema só funcionará depois de configurar a URL e a chave pública do Supabase no `index.html` e enviar a alteração ao GitHub.

## Observações
- Sem login: quem tiver o link do site consegue ver, editar e apagar os dados.
- As taxas iniciais (TikTok 6%, Shopee 20% + R$ 4, Mercado Livre 14% + R$ 6) são só um ponto de partida: ajuste na tela.
- Os produtos cadastrados na versão antiga (dentro do Claude) não vêm junto; cadastre de novo.
