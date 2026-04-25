# 🛰️ Chip Tracker Monitor

Sistema de monitoramento de chips de rastreadores veiculares. Detecta quando um chip para de comunicar e envia alertas por email.

## Como funciona

```
SmartGPS (rastreador) → Webhook POST → /api/webhooks/signal → Supabase
                                                                    ↓
                                              Watchdog verifica 2x/dia
                                                                    ↓
                                          Email de alerta se > 12h sem sinal
```

## Configuração

### 1. Supabase — Criar as tabelas

Acesse seu projeto no [supabase.com](https://supabase.com) → **SQL Editor** → cole e execute o conteúdo de `db_setup.sql`.

### 2. Vercel — Variáveis de ambiente

No painel da Vercel, vá em **Settings → Environment Variables** e adicione:

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role do Supabase |
| `GMAIL_USER` | Seu email Gmail |
| `GMAIL_APP_PASSWORD` | Senha de app do Gmail |
| `ALERT_RECIPIENT_EMAIL` | Email que receberá os alertas |
| `WATCHDOG_SECRET` | Qualquer palavra secreta (ex: `minha_senha_123`) |

### 3. SmartGPS — Configurar Webhook

No painel da SmartGPS → **Integrações → Webhook**, coloque a URL:

```
https://chiptracker.vercel.app/api/webhooks/signal
```

### 4. Watchdog automático

O Watchdog roda automaticamente **2x por dia** (00:00 e 12:00) via Vercel Cron Jobs.

Você também pode rodar manualmente acessando:
```
https://chiptracker.vercel.app/api/watchdog?secret=SUA_WATCHDOG_SECRET
```

## Diagnóstico

Se o webhook da SmartGPS não estiver identificando o chip, verifique a tabela `webhook_raw_logs` no Supabase — ela salva **tudo** que chega, inclusive o formato exato do payload.

## Endpoints

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/status` | Status geral do sistema |
| POST | `/api/webhooks/signal` | Recebe sinal da SmartGPS |
| GET | `/api/watchdog` | Executa verificação manual |
| POST | `/api/chips` | Cadastra chip |
| POST | `/api/alerts/:id/resolve` | Resolve alerta |
