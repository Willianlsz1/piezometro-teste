# CLAUDE.md — Contexto do Projeto

## O que é este projeto

Sistema IoT de monitoramento online do nível de água em piezômetros de barragens de mineração.
TCC do SENAI Mariana-MG, resposta ao desafio SAGA da **Samarco Mineração S.A.** (demanda oficial:
medição contínua, transmissão em tempo real, dashboard, histórico e alertas preventivos —
economia estimada de R$ 600 mil/ano vs. medição manual terceirizada).

O protótipo + código funcionando são a base de tudo: deles derivam o texto do TCC, os slides,
o vídeo pitch. Documento-fonte de conhecimento: [docs/BASE_DE_CONHECIMENTO.md](docs/BASE_DE_CONHECIMENTO.md).

## Modelo de trabalho: 10-80-10

**Regra obrigatória em toda tarefa não trivial:**

- **10% (Fable)** — organiza, planeja, especifica contratos/interfaces e decide a delegação.
- **80% (modelos menores)** — Sonnet/Haiku via subagentes executam pesquisa, escrita de código
  e implementações, em paralelo sempre que possível. Fable decide qual modelo faz o quê
  (Sonnet para código/pesquisa; Haiku para tarefas mecânicas).
- **10% (Fable)** — revisa o resultado linha a linha, corrige bugs que os agentes deixaram e
  faz a síntese final para o usuário.

A revisão final NÃO é opcional: em todas as rodadas até agora ela pegou bugs reais
(limite de escritas do KV, divisão float na agregação do D1, código morto esquecido).

## Arquitetura (v2 — atual)

```
ESP32 (Wokwi/físico) → POST /ingest → Cloudflare Worker → D1 (SQLite)
                                          │  cron 1 min: motor de alertas (estado no KV)
                                          │  → Telegram / SMS Twilio
Dashboard (GitHub Pages, index.html) → GET /ultimos, /dados?pz&range
```

- **Worker publicado:** `https://piezometro-worker.willianloopes123.workers.dev`
- **v1 (aposentada, preservada no git):** Render + server.js + InfluxDB Cloud. Motivos da troca:
  Render hibernava (pausava alertas); InfluxDB free expirava tokens/retenção 30 dias.
  Não sugerir volta ao InfluxDB/Render — decisão fechada.

## Estrutura

| Caminho | Papel |
|---|---|
| `cloudflare-worker/src/` | Backend em 7 módulos ES: `index.js` (roteador), `config`, `http`, `db` (todas as queries), `alertas` (motor 3 camadas + KV), `notificacoes`, `rotas` |
| `cloudflare-worker/wrangler.toml` | Config (cron, bindings D1/KV, vars não sensíveis) |
| `cloudflare-worker/schema.sql` | Tabela `leituras` + índice |
| `index.html` | Só a estrutura HTML do dashboard (~280 l.) — GitHub Pages |
| `assets/styles.css` + `assets/js/*` | CSS e os 8 módulos JS do dashboard (`config`, `util`, `fontes`, `estado`, `graficos`, `paineis`, `exportar`, `app`), carregados por `<script src>` em ordem de dependência — **sem bundler** |
| `firmware/piezometro_core.h` | Núcleo comum do firmware (WiFi/buffer/envio/alertas/OLED) |
| `firmware/sketch*.ino` | Adapters de sensor (BMP180 simulação; JSN-SR04T físico) |
| `docs/` | Base de conhecimento, pesquisa de dashboards, planos e guia da maquete |

**Guarda anti-godfile (permanente):** ≤ ~300 linhas por arquivo (exceção: `paineis.js` até ~450),
1 responsabilidade por arquivo, nome = responsabilidade. Função nova entra no arquivo cujo nome a
descreve; se engordar além do limite, dividir antes de commitar.

## Convenções e invariantes

- **Idioma:** tudo em pt-BR (código, comentários, commits, docs).
- **Limiares espelhados em 3 lugares** — mudou um, muda os três:
  firmware (`NIVEL_ATENCAO`/`NIVEL_CRITICO`), worker (`[vars]` no wrangler.toml) e
  dashboard (`CFG` no index.html). Padrão: atenção 12 m, crítico 15 m.
- **Faixas de alerta:** NORMAL < 12 ≤ ATENÇÃO < 15 ≤ CRÍTICO. Nível ALTO = perigo
  (saturação do maciço) — nunca inverter.
- **Timestamps:** epoch em SEGUNDOS na API e no D1; o dashboard converte para ms (×1000).
- **Segredos:** nunca em arquivo/commit. Worker: `wrangler secret put` (DEVICE_KEY,
  TELEGRAM_*, TWILIO_*). A DEVICE_KEY também vai no firmware (header `x-device-key`).
- **KV free tier:** o estado de alertas só é gravado quando muda (1000 writes/dia de limite).
  Não transformar em gravação incondicional.
- **D1/SQLite:** divisão de inteiros no bucket usa `CAST(ts / ?1 AS INTEGER)` — o D1 divide
  em float sem o CAST (bug real já corrigido; não regredir).

## Comandos

```bash
# na pasta cloudflare-worker/
wrangler deploy                                    # publicar o Worker
wrangler d1 execute piezometro-db --remote --file=schema.sql   # (re)aplicar schema
wrangler dev --test-scheduled                      # testar o cron localmente
# dashboard local: npx http-server -p 8788 na raiz do repo
```

Testes rápidos de produção: `curl <worker>/health`, `POST <worker>/ingest` (com `x-device-key`),
`GET <worker>/ultimos`, `GET <worker>/dados?pz=PZ-01&range=24h`.

## Contexto de defesa (banca)

- Resposta ao "isso já existe": existe para barragens de DPA alto a preço "sob consulta";
  o projeto democratiza o monitoramento para a camada lida à mão (28 mil barragens no Brasil,
  só ~6 mil na PNSB). Detalhes e fontes em docs/BASE_DE_CONHECIMENTO.md.
- Limitações a admitir: sensor stand-in (não é corda vibrante), sem redundância de energia
  exigida pela ANM 95/2022 para DPA alto. É protótipo de conceito.
- Terminologia: piezômetro (poropressão de camada específica) ≠ INA (nível freático geral).
