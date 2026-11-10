# Reflexão Bíblica

Um café, um texto, uma reflexão. A Bíblia traduzida do original, com reflexão diária, leitor completo, planos de leitura, estudo dirigido com mentor, dicionário bíblico e acessibilidade por voz.

## Como está organizado
- `index.html`: o app inteiro (interface e lógica).
- `platform.js`: integração com login, banco de dados, IA, voz, microfone e assinatura (já embutido no `index.html`; mantido separado para referência).
- `netlify/functions/`: servidor
  - `ai.mjs`: chama a IA (Anthropic) com limite diário grátis/Pro.
  - `shared.mjs`: guarda capítulos traduzidos, verbetes e introduções compartilhados por todos.
  - `verify-purchase.mjs`: confirma a assinatura Pro na Google Play.
  - `delete-account.mjs`: exclusão de conta (exigência da Google Play).
  - `config.mjs`: envia ao app as chaves públicas do Supabase.
- `supabase/schema.sql`: tabelas e regras de segurança do banco.
- `privacidade.html` e `termos.html`: páginas exigidas pela loja.
- `manifest.webmanifest`, `sw.js`, `icons/`: o que torna o site instalável e funcional offline.
- `.well-known/assetlinks.json`: liga o app Android ao site (preencher na etapa da Play Store).

## Variáveis de ambiente (Netlify → Site configuration → Environment variables)
| Nome | O que é |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | chave pública (anon) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta (service_role) do Supabase |
| `ANTHROPIC_API_KEY` | chave da API da Anthropic |
| `FREE_DAILY_LIMIT` | perguntas grátis por dia (padrão 5) |
| `FREE_SHARED_LIMIT` | conteúdos novos (capítulos, lições) por dia no grátis (padrão 40) |
| `PRO_DAILY_LIMIT` | perguntas por dia no Pro (padrão 60) |
| `MODEL_QUICK`, `MODEL_DEFAULT`, `MODEL_COMPLEX` | modelos (padrões: claude-haiku-5-5, claude-sonnet-5-5, claude-sonnet-5-5) |
| `ANDROID_PACKAGE_NAME` | nome do pacote Android (ex.: app.reflexaobiblica.twa) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON da conta de serviço do Google Play (para validar o Pro) |
| `PRO_PRICE_LABEL` | texto do preço exibido fora da Play Store (opcional) |
