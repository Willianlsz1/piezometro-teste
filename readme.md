# 🟢 Samarco — Sistema de Monitoramento de Piezômetro

Sistema online de **monitoramento do nível de água em piezômetros** (desafio SAGA SENAI / Samarco): sensores automáticos no ESP32, transmissão em tempo real para o InfluxDB Cloud, dashboard interativo no GitHub Pages e **alertas preventivos por Telegram e SMS** disparados pelo servidor.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Pré-requisitos](#pré-requisitos)
- [Configuração e Deploy](#configuração-e-deploy)
  - [1. InfluxDB Cloud](#1-influxdb-cloud)
  - [2. Firmware ESP32 (Wokwi)](#2-firmware-esp32-wokwi)
  - [3. Servidor Proxy (Render)](#3-servidor-proxy-render)
  - [4. Dashboard (GitHub Pages)](#4-dashboard-github-pages)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Alertas por Telegram e SMS](#alertas-por-telegram-e-sms)
- [Níveis de Alerta](#níveis-de-alerta)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

O sistema monitora continuamente um piezômetro simulado via ESP32, enviando **nível d'água (m)**, pressão e temperatura para o InfluxDB Cloud a cada 10 segundos — com *store & forward*: leituras feitas sem rede ficam retidas em buffer local (com timestamp NTP) e são reenviadas quando a conexão volta, sem perda de dados.

Um dashboard web exibe os dados em tempo real com histórico de 24 horas, indicadores visuais de alerta e registro de eventos. Em paralelo, o **motor de alertas do servidor** vigia o InfluxDB e dispara notificações por **Telegram** (gratuito) e/ou **SMS via Twilio** quando o nível muda de faixa — o alerta chega mesmo sem ninguém olhando o dashboard, cumprindo o requisito de "alertas preventivos" da demanda.

Quando o InfluxDB não está acessível, o dashboard ativa automaticamente um **modo de simulação** para demonstração — sinalizado por um banner amarelo e pela marcação "(simulação)" nos eventos, para que dados fictícios nunca sejam confundidos com leituras reais.

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
  POST /ingest (JSON)
         │
┌────────▼───────────────┐      ┌──────────────┐
│   Render.com            │─────▶│ 🔔 Telegram  │
│   server.js             │      │ 📱 SMS Twilio│
│   (ingestão + proxy +   │      └──────────────┘
│    motor de alertas)    │
└─────┬──────────────┬────┘
      │              │
 Flux Write/Query   HTTP /query
      │              │
┌─────▼────────┐ ┌───▼───────────────┐
│ InfluxDB      │ │   GitHub Pages     │
│ Cloud         │ │   index.html       │
│ (us-east-1)   │ │   (Dashboard)     │
└───────────────┘ └───────────────────┘
```

**Por que o proxy?**
O token do InfluxDB nunca pode ficar exposto no HTML (visível no navegador). O `server.js` no Render atua como intermediário — recebe as queries do dashboard e as repassa ao InfluxDB com o token seguro via variável de ambiente. Agora a placa também fala com o InfluxDB através dele: o ESP32 posta as leituras em `/ingest`, e é o `server.js` quem grava usando o token de escrita. Assim, **nenhum token do InfluxDB fica no firmware** — a placa só carrega a `DEVICE_KEY`, uma chave de dispositivo sem acesso direto ao banco.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| Firmware | C++ (Arduino), ESP32, BMP180, store & forward com NTP |
| Simulação | [Wokwi](https://wokwi.com) |
| Banco de dados | [InfluxDB Cloud](https://cloud2.influxdata.com) (Flux) |
| Proxy / Backend | Node.js puro (sem frameworks) + motor de alertas |
| Notificações | Telegram Bot API (gratuito) e Twilio SMS (opcional) |
| Hospedagem backend | [Render.com](https://render.com) (plano gratuito) |
| Dashboard / Frontend | HTML + CSS + Canvas API |
| Hospedagem frontend | [GitHub Pages](https://pages.github.com) |

---

## Pré-requisitos

- Conta no [InfluxDB Cloud](https://cloud2.influxdata.com) com bucket `PIEZOMETRO` criado
- Conta no [Render.com](https://render.com) conectada ao GitHub
- GitHub Pages habilitado no repositório
- (Opcional) Conta no [Wokwi](https://wokwi.com) para simular o ESP32

---

## Configuração e Deploy

### 1. InfluxDB Cloud

1. Acesse [cloud2.influxdata.com](https://cloud2.influxdata.com) e crie uma conta
2. Crie um **bucket** com o nome `PIEZOMETRO`
3. Crie um **token de acesso** com permissão de leitura e escrita no bucket
4. Anote os valores de:
   - **URL** do cluster (ex: `https://us-east-1-1.aws.cloud2.influxdata.com`)
   - **Token** gerado
   - **Organization** (nome da sua organização)

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
#define SERVER_URL  "https://SEU-APP.onrender.com/ingest"
#define DEVICE_KEY  "troque-esta-chave"
```

> A placa não fala mais direto com o InfluxDB — ela posta as leituras (JSON) no `/ingest` do `server.js` no Render, autenticando com `DEVICE_KEY` no header `x-device-key`. As credenciais do InfluxDB (`INFLUX_URL`, `INFLUX_WRITE_TOKEN`, `INFLUX_ORG`) ficam só nas variáveis de ambiente do Render — nunca no firmware.

5. O firmware converte a pressão do BMP180 em nível d'água simulado (10 hPa = 1 m) e classifica pelos limiares de **nível**:

```cpp
#define PRESSAO_REF 1013.25  // hPa — padrão do BMP180 no Wokwi ↔ nível 10,0 m
#define NIVEL_ATENCAO 12.0   // m — acima disso = ATENÇÃO
#define NIVEL_CRITICO 15.0   // m — acima disso = CRÍTICO
```

> Estes valores devem ser **os mesmos** do `CFG` em `index.html` (`thrAtencao`/`thrCritico`) e do servidor (`NIVEL_ATENCAO`/`NIVEL_CRITICO`), para dashboard e notificações espelharem exatamente o firmware.

6. Clique em **Start Simulation** — o ESP32 enviará dados a cada 10 segundos. Para testar os alertas, clique no BMP180 e mova o slider de pressão:
   - **1013 hPa → 10,0 m** 🟢 normal
   - **1035 hPa → 12,2 m** 🟡 atenção
   - **1065 hPa → 15,2 m** 🔴 crítico (e o servidor dispara Telegram/SMS)

---

### 3. Servidor Proxy (Render)

1. Acesse [render.com](https://render.com) e faça login com sua conta GitHub
2. Clique em **New → Web Service**
3. Selecione o repositório `piezometro-teste`
4. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Em **Environment Variables**, adicione:

```
INFLUX_URL         = https://SEU-CLUSTER.influxdata.com
INFLUX_TOKEN       = SEU-TOKEN-SOMENTE-LEITURA
INFLUX_WRITE_TOKEN = SEU-TOKEN-DE-ESCRITA
INFLUX_ORG         = SUA-ORG
ALLOWED_ORIGIN     = https://SEU-USUARIO.github.io
ALLOWED_BUCKET     = PIEZOMETRO
DEVICE_KEY         = troque-esta-chave

# Notificações (opcionais — ver seção "Alertas por Telegram e SMS")
TELEGRAM_BOT_TOKEN = 123456:ABC-DEF...
TELEGRAM_CHAT_ID   = -100123456789
```

> 🔐 **Segurança:** o dashboard só **lê** dados — o token em `INFLUX_TOKEN` fica **somente leitura**, restrito ao bucket `PIEZOMETRO` e usado pelo `/query`. Quem escreve agora é o próprio servidor, usando `INFLUX_WRITE_TOKEN` no `/ingest` — a placa nunca vê nenhum dos dois; ela só carrega a `DEVICE_KEY`, validada no header `x-device-key`. O proxy também rejeita queries que referenciem outros buckets (`ALLOWED_BUCKET`).

> ⚠️ **Importante:** `ALLOWED_ORIGIN` deve ser exatamente `https://SEU-USUARIO.github.io` **sem barra final** e **sem o nome do repositório**.

6. Clique em **Create Web Service** e aguarde o deploy

---

### 4. Dashboard (GitHub Pages)

1. No arquivo `index.html`, atualize a URL do proxy:

```javascript
const PROXY_URL = "https://SEU-APP.onrender.com/query";
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

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `INFLUX_URL` | URL do cluster InfluxDB | `https://us-east-1-1.aws.cloud2.influxdata.com` |
| `INFLUX_TOKEN` | Token de autenticação (**use um token somente leitura**) | `abc123...` |
| `INFLUX_WRITE_TOKEN` | Token de **escrita**, usado só pelo `/ingest` (se ausente, usa `INFLUX_TOKEN`) | `def456...` |
| `INFLUX_ORG` | Nome da organização | `SAMARCO` |
| `ALLOWED_ORIGIN` | Origem permitida pelo CORS | `https://willianlsz1.github.io` |
| `ALLOWED_BUCKET` | Único bucket que o proxy aceita consultar | `PIEZOMETRO` (padrão) |
| `PORT` | Porta do servidor (opcional) | `3000` (padrão) |
| `NIVEL_ATENCAO` | Limiar de atenção do nível d'água (m) | `12` (padrão) |
| `NIVEL_CRITICO` | Limiar crítico do nível d'água (m) | `15` (padrão) |
| `ALERT_POLL_SEC` | Intervalo de verificação do motor de alertas (s) | `60` (padrão) |
| `ALERT_REPEAT_MIN` | Reenvio do alerta crítico enquanto persistir (min) | `15` (padrão) |
| `TELEGRAM_BOT_TOKEN` | Token do bot do Telegram (opcional) | `123456:ABC-DEF...` |
| `TELEGRAM_CHAT_ID` | Chat/grupo que recebe os alertas | `-100123456789` |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio para SMS (opcional) | `ACxxxxxxxx...` |
| `TWILIO_AUTH_TOKEN` | Token de autenticação Twilio | `xxxxxxxx` |
| `TWILIO_FROM` | Número Twilio remetente (formato E.164) | `+15551234567` |
| `TWILIO_TO` | Número que recebe os SMS | `+5531999999999` |
| `DEVICE_KEY` | Chave que a placa envia no header `x-device-key` ao chamar `/ingest` (vazio = sem autenticação, só em dev) | `troque-esta-chave` |

---

## Alertas por Telegram e SMS

O `server.js` verifica o último `nivel_agua` no InfluxDB a cada `ALERT_POLL_SEC` segundos e notifica **nas transições de faixa** (anti-spam: não repete a mesma faixa; o nível CRÍTICO é reenviado a cada `ALERT_REPEAT_MIN` minutos enquanto persistir). O histórico de notificações fica exposto em `GET /alerts`.

### Telegram (gratuito — recomendado para o TCC)

1. No Telegram, fale com o **@BotFather** → `/newbot` → copie o **token**
2. Adicione o bot a um grupo (ou fale com ele no privado) e envie uma mensagem qualquer
3. Acesse `https://api.telegram.org/bot<TOKEN>/getUpdates` e copie o `chat.id`
4. Defina `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no Render

### SMS via Twilio (opcional, pago)

1. Crie uma conta em [twilio.com](https://www.twilio.com) (o modo *trial* envia SMS para números verificados)
2. Compre/ative um número remetente e copie **Account SID** e **Auth Token** do console
3. Defina `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` e `TWILIO_TO` no Render

> 💡 **No hardware real (Fase 2)**, um módulo celular **SIM7600** no próprio ESP32 permitiria enviar SMS direto do campo, sem depender do servidor — importante como redundância se a nuvem estiver fora.

---

## Níveis de Alerta

O sistema classifica o **nível d'água** em três faixas — a mesma lógica no firmware (LEDs/buzzer), no dashboard (badges/gráfico) e no servidor (Telegram/SMS):

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
├── server.js        # Proxy Node.js + ingestão + motor de alertas (Render)
├── index.html       # Dashboard web (GitHub Pages)
├── package.json     # Dependências Node.js
├── .env.example     # Modelo de variáveis de ambiente
└── readme.md        # Este arquivo
```

> 🧱 **Vai montar a maquete física?** Siga o guia completo em [`docs/PROTOTIPO_FISICO.md`](docs/PROTOTIPO_FISICO.md) — lista de compras (~R$ 150–220), esquema de ligação do JSN-SR04T (com o divisor de tensão obrigatório no ECHO), calibração e roteiro de demonstração para a banca.

---

## 📝 Observações

- O plano gratuito do Render hiberna após **15 minutos de inatividade**. A primeira requisição após hibernação pode demorar até 50 segundos. O dashboard ativa automaticamente o modo simulação enquanto aguarda.
- ⚠️ A hibernação também **pausa o motor de alertas** (Telegram/SMS). Para monitoramento contínuo, configure um ping externo gratuito (ex.: [UptimeRobot](https://uptimerobot.com) ou [cron-job.org](https://cron-job.org)) chamando `https://SEU-APP.onrender.com/health` a cada 10 minutos — isso mantém o serviço acordado. Em produção real, use um plano pago ou infraestrutura dedicada.
- O token do InfluxDB **nunca deve ser commitado** no repositório. Use sempre variáveis de ambiente.
- O simulador Wokwi usa a rede `Wokwi-GUEST` (sem senha), que possui acesso à internet para enviar dados ao InfluxDB.
