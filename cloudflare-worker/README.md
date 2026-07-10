# Piezômetro — Worker Cloudflare (port do server.js)

Port do proxy Node.js (`../server.js`) para **Cloudflare Workers**: mesma
ingestão do ESP32, mesmo motor de alertas Telegram/SMS (agora rodando como
*cron trigger* em vez de `setInterval`, com o estado persistido no KV), e as
leituras armazenadas no **Cloudflare D1** (SQLite gerenciado) em vez de um
InfluxDB externo. O InfluxDB não é mais necessário para este projeto — se
você criou uma conta só para isso, pode encerrá-la.

## 1. Instalar o wrangler e autenticar

```bash
npm i -g wrangler
wrangler login
```

## 2. Criar o KV namespace do motor de alertas

(pule este passo se o namespace já existir de uma instalação anterior)

```bash
wrangler kv namespace create ALERT_STATE
```

Copie o `id` retornado e cole em `wrangler.toml`, no bloco `[[kv_namespaces]]`,
no lugar do id já preenchido.

## 3. Criar o banco D1 e aplicar o schema

```bash
wrangler d1 create piezometro-db
```

Copie o `database_id` retornado e cole em `wrangler.toml`, no bloco
`[[d1_databases]]`, no lugar de `"COLOQUE_O_ID_AQUI"`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "piezometro-db"
database_id = "seu-database-id-aqui"
```

Depois aplique o schema (tabela `leituras` + índice) no banco remoto:

```bash
wrangler d1 execute piezometro-db --remote --file=schema.sql
```

## 4. Definir os segredos

Estes valores **nunca** vão no `wrangler.toml` (fica em texto puro e pode ir
pro Git) — use `wrangler secret put`, que pergunta o valor interativamente.
São só 5 agora (sem os tokens do InfluxDB):

```bash
wrangler secret put DEVICE_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
```

`DEVICE_KEY` é o único obrigatório na prática (protege o `/ingest`). Telegram
e Twilio são opcionais — se não for usar SMS, por exemplo, não defina
`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` (o worker detecta e desativa o canal
automaticamente, igual ao `server.js`).

## 5. Ajustar as variáveis não sensíveis

Edite o bloco `[vars]` em `wrangler.toml` conforme o seu ambiente:

- `ALLOWED_ORIGIN` → coloque a URL exata do seu GitHub Pages (sem barra
  final), nunca deixe `"*"` em produção
- `NIVEL_ATENCAO`, `NIVEL_CRITICO`, `ALERT_REPEAT_MIN`
- `TWILIO_FROM`, `TWILIO_TO` (só usados se os segredos Twilio estiverem
  definidos)

## 6. Deploy

```bash
wrangler deploy
```

Ao final, o wrangler imprime a URL pública, algo como:

```
https://piezometro-worker.<seu-subdominio>.workers.dev
```

## 7. Testar

```bash
# Health check
curl https://piezometro-worker.<seu-subdominio>.workers.dev/health

# Ingestão de uma leitura (troque SUA-DEVICE-KEY pela que você definiu)
curl -X POST https://piezometro-worker.<seu-subdominio>.workers.dev/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: SUA-DEVICE-KEY" \
  -d '{"piezometro":"PZ-01","nivel_agua":10.4,"pressao":1013.2,"temperatura":24.1}'

# Última leitura de cada piezômetro
curl https://piezometro-worker.<seu-subdominio>.workers.dev/ultimos

# Série histórica agregada (últimas 24h, buckets de 30min)
curl "https://piezometro-worker.<seu-subdominio>.workers.dev/dados?pz=PZ-01&range=24h"
```

## 8. Apontar o firmware e o dashboard para o Worker

- **Firmware** (`../firmware/sketch.ino`): troque `SERVER_URL` para
  `https://piezometro-worker.<seu-subdominio>.workers.dev/ingest`.
- **Dashboard** (`../index.html`): aponte para
  `https://piezometro-worker.<seu-subdominio>.workers.dev/ultimos` (status
  atual) e `.../dados?pz=<id>&range=<24h|7d|30d>` (gráficos históricos).

## 9. Testar o cron (motor de alertas) localmente

```bash
wrangler dev --test-scheduled
```

Em outro terminal, dispare o cron manualmente:

```bash
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

Isso executa `scheduled()` uma vez — leia os logs do `wrangler dev` para
confirmar que ele buscou os últimos níveis no D1, avaliou as faixas e (se
aplicável) notificou Telegram/SMS.

## Observação sobre o volume do cron

O `wrangler.toml` está configurado para `* * * * *` (a cada 1 minuto), igual
ao `ALERT_POLL_SEC=60` padrão do `server.js`. Cada execução faz 1 leitura no
KV (~1440/dia — o free tier permite 100.000 leituras/dia) e uma consulta ao
D1, mas só **grava** no KV quando algum piezômetro muda de faixa ou o alerta
CRÍTICO é repetido. Em operação normal isso significa poucas escritas por
dia, bem abaixo do limite de 1000 escritas/dia do KV gratuito — não é preciso
mexer no cron.

## Sobre a retenção de dados

Diferente do InfluxDB (que costuma ter política de retenção configurável e
frequentemente limitada nos planos gratuitos), o D1 não expira dados
automaticamente: as leituras ficam guardadas indefinidamente até você
apagá-las, dentro do limite de armazenamento do free tier (5 GB — bastante
espaço para anos de leituras de piezômetro, que são registros pequenos). Se
o volume crescer muito, considere um job periódico de limpeza (`DELETE FROM
leituras WHERE ts < ?`) para leituras muito antigas, mas isso não é
necessário no dia a dia.
