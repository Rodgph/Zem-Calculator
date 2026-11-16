# Preço e Margem — Vercel + Supabase

Arquivos: `index.html` (o site inteiro) e `supabase.sql` (cria as tabelas e a pasta de fotos).

## 1. Supabase
1. Crie um projeto em supabase.com.
2. Vá em **SQL Editor**, cole o conteúdo de `supabase.sql` e clique em **Run**.
3. Vá em **Project Settings → API** e copie a **Project URL** e a chave pública (**anon** ou **publishable**).
4. Abra o `index.html`, procure `COLE_AQUI_A_URL_DO_PROJETO` e `COLE_AQUI_A_CHAVE_PUBLICA` (no início do script) e troque pelos valores copiados.
   Nunca use a chave `service_role` aqui.

## 2. Vercel
1. Crie um repositório no GitHub e envie o `index.html` (botão **Add file → Upload files**).
2. Na Vercel: **Add New → Project**, escolha o repositório, deixe **Framework Preset: Other** e clique em **Deploy**.
3. Abra o link que a Vercel gerar. Pronto.

## Observações
- Sem login: quem tiver o link do site consegue ver, editar e apagar os dados.
- As taxas iniciais (TikTok 6%, Shopee 20% + R$ 4, Mercado Livre 14% + R$ 6) são só um ponto de partida: ajuste na tela.
- Os produtos cadastrados na versão antiga (dentro do Claude) não vêm junto; cadastre de novo.
