# 🟢 Samarco — Sistema de Monitoramento de Piezômetro

Sistema online de **monitoramento do nível de água em piezômetros** (desafio SAGA SENAI / Samarco): sensores automáticos no ESP32, transmissão em tempo real para o Cloudflare Worker (com armazenamento em D1), dashboard interativo no GitHub Pages e **alertas preventivos por Telegram e SMS** disparados pelo motor de alertas do Worker (cron trigger).

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos](#pré-requisitos)
- [Configuração e Deploy](#configuração-e-deploy)
  - [1. Backend (Cloudflare Worker + D1)](#1-backend-cloudflare-worker--d1)
  - [2. Firmware ESP32 (Wokwi)](#2-firmware-esp32-wokwi)
  - [3. Dashboard (GitHub Pages)](#3-dashboard-github-pages)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Alertas por Telegram e SMS](#alertas-por-telegram-e-sms)
- [Níveis de Alerta](#níveis-de-alerta)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Histórico de Arquitetura](#histórico-de-arquitetura)

---

## Visão Geral

O sistema monitora continuamente um piezômetro simulado via ESP32, enviando **nível d'água (m)**, pressão e temperatura para o Cloudflare Worker a cada 10 segundos — com *store & forward*: leituras feitas sem rede ficam retidas em buffer local (com timestamp NTP) e são reenviadas quando a conexão volta, sem perda de dados.

Um dashboard web exibe os dados em tempo real com histórico de 24 horas, indicadores visuais de alerta e registro de eventos. Em paralelo, o **motor de alertas** do Worker (executado por *cron trigger*, a cada 1 minuto) vigia o D1 e dispara notificações por **Telegram** (gratuito) e/ou **SMS via Twilio** quando o nível muda de faixa — o alerta chega mesmo sem ninguém olhando o dashboard, cumprindo o requisito de "alertas preventivos" da demanda. Diferente de um servidor tradicional, o Worker não hiberna: o motor de alertas roda 24/7 sem depender de nenhum ping externo para "acordar".

Quando o backend não está acessível, o dashboard ativa automaticamente um **modo de simulação** para demonstração — sinalizado por um banner amarelo e pela marcação "(simulação)" nos eventos, para que dados fictícios nunca sejam confundidos com leituras reais.

> ⚠️ **Limitações do protótipo (Fase 1):**
> - O **BMP180 é um sensor barométrico** usado apenas como *stand-in* no Wokwi — ele não mede coluna d'água. O firmware converte a pressão do slider em um **nível d'água simulado** pela escala didática de **10 hPa = 1 m** (`SIM_ESCALA`). No hardware real (Fase 2), o sinal virá de um **transdutor piezométrico submersível 4–20 mA** lido por um ADC ADS1115, e a conversão passa a ser física real (1 mH₂O ≈ 98,07 hPa), calibrada na instalação.
> - A lógica de alerta já é a **correta para piezômetro**: nível d'água **alto** = perigo (saturação do maciço).

---

## Arquitetura do Sistema

```
┌─────────────────┐
│   ESP32 + BMP180│
│   (Wokwi Sim.)  │
└────────┬────────┘
         │
  POST /ingest (JSON, x-device-key)
         │
┌────────▼───────────────┐      ┌──────────────┐
│   Cloudflare Worker     │─────▶│ 🔔 Telegram  │
│   (ingestão + /ultimos  │      │ 📱 SMS Twilio│
│    + /dados + cron de   │      └──────────────┘
│    alertas a cada 1 min)│
└─────┬──────────────┬────┘
      │              │
  INSERT (D1)   GET /ultimos, /dados
      │              │
┌─────▼────────┐ ┌───▼───────────────┐
│ Cloudflare D1 │ │   GitHub Pages     │
│ (SQLite)      │ │   index.html       │
│               │ │   (Dashboard)     │
└───────────────┘ └───────────────────┘
```

**Por que o Worker no meio?**
O ESP32 nunca fala direto com o banco: ele posta as leituras em `/ingest`, autenticando com a `DEVICE_KEY` no header `x-device-key`. É o Worker quem grava no D1. O dashboard, por sua vez, só lê — via `GET /ultimos` (última leitura de cada piezômetro) e `GET /dados` (série histórica agregada para os gráficos). Nenhum segredo de banco fica exposto no firmware nem no HTML público: o Worker guarda tudo em *secrets* do Cloudflare, fora do repositório.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| Firmware | C++ (Arduino), ESP32, BMP180, store & forward com NTP |
| Simulação | [Wokwi](https://wokwi.com) |
| Backend | [Cloudflare Workers](https://workers.cloudflare.com) (ingestão + leitura + motor de alertas via Cron Trigger) |
| Banco de dados | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite gerenciado) |
| Estado do motor de alertas | [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) |
| Notificações | Telegram Bot API (gratuito) e Twilio SMS (opcional) |
| Dashboard / Frontend | HTML + CSS + Canvas API |
| Hospedagem frontend | [GitHub Pages](https://pages.github.com) |

---

## Pré-requisitos

- Conta na [Cloudflare](https://dash.cloudflare.com) (plano gratuito) com Workers, D1 e KV habilitados
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) instalado (`npm i -g wrangler`)
- GitHub Pages habilitado no repositório
- (Opcional) Conta no [Wokwi](https://wokwi.com) para simular o ESP32

---

## Configuração e Deploy

### 1. Backend (Cloudflare Worker + D1)

O backend inteiro (ingestão, leitura para o dashboard e motor de alertas) roda em [`cloudflare-worker/`](cloudflare-worker/). Resumo do fluxo — o passo a passo completo, com todos os comandos, está no [`cloudflare-worker/README.md`](cloudflare-worker/README.md):

1. `wrangler login`
2. Criar o namespace KV do motor de alertas (`wrangler kv namespace create ALERT_STATE`) e colar o `id` em `wrangler.toml`
3. Criar o banco D1 (`wrangler d1 create piezometro-db`), colar o `database_id` em `wrangler.toml` e aplicar `schema.sql`
4. Definir os segredos com `wrangler secret put` (`DEVICE_KEY`, e opcionalmente `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`)
5. Ajustar as variáveis não sensíveis em `[vars]` (ver [tabela abaixo](#variáveis-de-ambiente))
6. `wrangler deploy` — a URL pública fica algo como `https://piezometro-worker.SEU-SUBDOMINIO.workers.dev`

---

### 2. Firmware ESP32 (Wokwi)

1. Acesse [wokwi.com](https://wokwi.com) e crie um projeto ESP32
2. Monte o circuito:
   - BMP180 → SDA no GPIO 21, SCL no GPIO 22
   - LED Verde → GPIO 32
   - LED Amarelo → GPIO 33
   - LED Vermelho → GPIO 25
   - Buzzer → GPIO 26
3. Cole o conteúdo de `firmware/sketch.ino` no editor (e, opcionalmente, o `firmware/diagram.json` na aba **diagram.json** para montar o circuito automaticamente)
4. Edite as credenciais no topo do arquivo:

```cpp
#define WIFI_SSID   "Wokwi-GUEST"
#define WIFI_PASS   ""
#define SERVER_URL  "https://piezometro-worker.SEU-SUBDOMINIO.workers.dev/ingest"
#define DEVICE_KEY  "troque-esta-chave"
```

> A placa posta as leituras (JSON) no `/ingest` do Cloudflare Worker, autenticando com `DEVICE_KEY` no header `x-device-key`. O Worker grava no D1 usando essa mesma chave para validar a origem — nenhum segredo de banco fica no firmware.

5. O firmware converte a pressão do BMP180 em nível d'água simulado (10 hPa = 1 m) e classifica pelos limiares de **nível**:

```cpp
#define PRESSAO_REF 1013.25  // hPa — padrão do BMP180 no Wokwi ↔ nível 10,0 m
#define NIVEL_ATENCAO 12.0   // m — acima disso = ATENÇÃO
#define NIVEL_CRITICO 15.0   // m — acima disso = CRÍTICO
```

> Estes valores devem ser **os mesmos** do `CFG` em `index.html` (`thrAtencao`/`thrCritico`) e do Worker (`NIVEL_ATENCAO`/`NIVEL_CRITICO` em `wrangler.toml`), para dashboard e notificações espelharem exatamente o firmware.

6. Clique em **Start Simulation** — o ESP32 enviará dados a cada 10 segundos. Para testar os alertas, clique no BMP180 e mova o slider de pressão:
   - **1013 hPa → 10,0 m** 🟢 normal
   - **1035 hPa → 12,2 m** 🟡 atenção
   - **1065 hPa → 15,2 m** 🔴 crítico (e o Worker dispara Telegram/SMS no próximo ciclo do cron, até 1 min depois)

---

### 3. Dashboard (GitHub Pages)

1. No arquivo `index.html`, atualize a URL do backend para o Worker publicado (endpoints `/ultimos` e `/dados`):

```javascript
const WORKER_URL = "https://piezometro-worker.SEU-SUBDOMINIO.workers.dev";
```

2. Habilite o GitHub Pages:
   - Vá em **Settings → Pages**
   - Source: **Deploy from a branch → main**
   - Salve

3. O dashboard estará disponível em:
   ```
   https://SEU-USUARIO.github.io/piezometro-teste
   ```

---

## Variáveis de Ambiente

Definidas em `cloudflare-worker/wrangler.toml`, no bloco `[vars]` (não sensíveis, ficam no repositório):

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `ALLOWED_ORIGIN` | Origem permitida pelo CORS (sem barra final) | `https://willianlsz1.github.io` |
| `NIVEL_ATENCAO` | Limiar de atenção do nível d'água (m) | `12` (padrão) |
| `NIVEL_CRITICO` | Limiar crítico do nível d'água (m) | `15` (padrão) |
| `ALERT_REPEAT_MIN` | Reenvio do alerta crítico enquanto persistir (min) | `15` (padrão) |
| `TWILIO_FROM` | Número Twilio remetente (formato E.164) | `+15551234567` |
| `TWILIO_TO` | Número que recebe os SMS | `+5531999999999` |

Segredos (definidos via `wrangler secret put`, **nunca** no `wrangler.toml`):

| Segredo | Descrição |
|---------|-----------|
| `DEVICE_KEY` | Chave que a placa envia no header `x-device-key` ao chamar `/ingest` (único obrigatório na prática) |
| `TELEGRAM_BOT_TOKEN` | Token do bot do Telegram (opcional) |
| `TELEGRAM_CHAT_ID` | Chat/grupo que recebe os alertas (opcional) |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio para SMS (opcional) |
| `TWILIO_AUTH_TOKEN` | Token de autenticação Twilio (opcional) |

---

## Alertas por Telegram e SMS

O motor de alertas do Worker roda como **Cron Trigger** (`* * * * *`, a cada 1 minuto), busca o último `nivel_agua` de cada piezômetro no D1 e notifica **nas transições de faixa** (anti-spam: não repete a mesma faixa; o nível CRÍTICO é reenviado a cada `ALERT_REPEAT_MIN` minutos enquanto persistir). O estado (última faixa notificada, histórico de reenvios) fica persistido no **Workers KV**, já que um Worker não mantém estado entre invocações. O histórico de notificações fica exposto em `GET /alerts`.

O sistema monitora **múltiplos piezômetros**: cada leitura carrega o identificador do instrumento (campo `piezometro`, ex. `PZ-01`), gravado junto com a medição no D1. O motor de alertas acompanha cada piezômetro separadamente — a mesma lógica de transição de faixa e repetição do CRÍTICO é aplicada por instrumento — e as notificações (e o histórico em `GET /alerts`) indicam qual piezômetro disparou o alerta. O id é configurado no firmware através da constante `PIEZOMETRO_ID`.

### Telegram (gratuito — recomendado para o TCC)

1. No Telegram, fale com o **@BotFather** → `/newbot` → copie o **token**
2. Adicione o bot a um grupo (ou fale com ele no privado) e envie uma mensagem qualquer
3. Acesse `https://api.telegram.org/bot<TOKEN>/getUpdates` e copie o `chat.id`
4. Defina `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` com `wrangler secret put`

### SMS via Twilio (opcional, pago)

1. Crie uma conta em [twilio.com](https://www.twilio.com) (o modo *trial* envia SMS para números verificados)
2. Compre/ative um número remetente e copie **Account SID** e **Auth Token** do console
3. Defina `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` com `wrangler secret put`, e `TWILIO_FROM`/`TWILIO_TO` em `[vars]`

> 💡 **No hardware real (Fase 2)**, um módulo celular **SIM7600** no próprio ESP32 permitiria enviar SMS direto do campo, sem depender do backend — importante como redundância se a nuvem estiver fora.

---

## Níveis de Alerta

O sistema classifica o **nível d'água** em três faixas — a mesma lógica no firmware (LEDs/buzzer), no dashboard (badges/gráfico) e no motor de alertas do Worker (Telegram/SMS):

| Nível | Condição | LED | Buzzer | Notificação |
|-------|----------|-----|--------|-------------|
| 🟢 **Normal** | Nível < 12 m | Verde contínuo | Silencioso | Só ao retornar de um alerta |
| 🟡 **Atenção** | 12 ≤ Nível < 15 m | Amarelo contínuo | 1 bip a cada 2s | Telegram/SMS na transição |
| 🔴 **Crítico** | Nível ≥ 15 m | Vermelho piscando | Bips contínuos | Telegram/SMS na transição + repetição a cada 15 min |

> ✅ Lógica correta de piezômetro: nível d'água **alto** = perigo (saturação do maciço da barragem).

---

## Estrutura do Projeto

```
piezometro-teste/
├── firmware/
│   ├── sketch.ino                    # Firmware da SIMULAÇÃO no Wokwi (BMP180 como stand-in)
│   ├── sketch_fisico_jsn_sr04t.ino   # Firmware do PROTÓTIPO FÍSICO (JSN-SR04T medindo água real)
│   └── diagram.json                  # Circuito do Wokwi (ESP32 + BMP180 + OLED + LEDs + buzzer)
├── docs/
│   ├── MAPEAMENTO_DEMANDA_E_MERCADO.md  # Demanda SAGA × mercado real × regulação (fontes citadas)
│   └── PROTOTIPO_FISICO.md              # Lista de compras, montagem, calibração e roteiro de demo
├── cloudflare-worker/  # Backend: ingestão (/ingest), leitura (/ultimos, /dados) e motor de alertas (cron)
│   ├── src/index.js    # Código do Worker
│   ├── schema.sql      # Schema da tabela `leituras` (D1)
│   ├── wrangler.toml   # Config do Worker (vars, D1, KV, cron)
│   └── README.md       # Guia de deploy passo a passo
├── index.html       # Dashboard web (GitHub Pages)
└── readme.md         # Este arquivo
```

> 🧱 **Vai montar a maquete física?** Siga o guia completo em [`docs/PROTOTIPO_FISICO.md`](docs/PROTOTIPO_FISICO.md) — lista de compras (~R$ 150–220), esquema de ligação do JSN-SR04T (com o divisor de tensão obrigatório no ECHO), calibração e roteiro de demonstração para a banca.

---

## Histórico de Arquitetura

A primeira versão do sistema (v1) usava um proxy Node.js (`server.js`) hospedado no Render, que ingeria as leituras do ESP32, repassava as consultas do dashboard ao InfluxDB Cloud e rodava o motor de alertas via `setInterval`. Essa arquitetura foi substituída (v2) pelo Cloudflare Worker descrito neste documento, por três motivos principais: o plano gratuito do Render hibernava após 15 minutos de inatividade, o que pausava o motor de alertas justamente quando ninguém estava olhando o dashboard (o pior momento para isso acontecer); o InfluxDB Cloud exigia gerenciar tokens de leitura/escrita separados e, em contas novas, tinha retenção de dados limitada a 30 dias no plano gratuito; e manter três serviços externos (Render, InfluxDB, GitHub Pages) para um protótipo de TCC adicionava complexidade operacional sem benefício correspondente.

A v2 consolida ingestão, armazenamento e motor de alertas em uma única plataforma (Cloudflare), sem credenciais externas de banco de dados: o D1 tem retenção ilimitada dentro do limite de armazenamento do free tier (~5 GB, suficiente para anos de leituras de piezômetro), não exige nenhum token de acesso ao banco (o binding é interno ao Worker) e o motor de alertas, agora um Cron Trigger, nunca hiberna. A v1 não foi apagada do projeto — ela está preservada no histórico do git, disponível para consulta caso seja necessário comparar as duas abordagens.
