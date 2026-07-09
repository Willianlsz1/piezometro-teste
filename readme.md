# 🟢 Samarco — Sistema de Monitoramento de Piezômetro

Dashboard em tempo real para monitoramento de pressão, temperatura e altitude via sensor BMP180 em ESP32, com armazenamento no InfluxDB Cloud e visualização em GitHub Pages.

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
- [Níveis de Alerta](#níveis-de-alerta)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

O sistema monitora continuamente um piezômetro simulado via ESP32, enviando dados de pressão, temperatura e altitude para o InfluxDB Cloud a cada 10 segundos. Um dashboard web exibe os dados em tempo real com histórico de 24 horas, indicadores visuais de alerta e registro de eventos.

Quando o InfluxDB não está acessível, o dashboard ativa automaticamente um **modo de simulação** para demonstração — sinalizado por um banner amarelo e pela marcação "(simulação)" nos eventos, para que dados fictícios nunca sejam confundidos com leituras reais.

> ⚠️ **Limitações do protótipo (Fase 1):**
> - O **BMP180 é um sensor barométrico** (pressão atmosférica) usado apenas como *stand-in* de simulação no Wokwi — ele não mede coluna d'água. No hardware real (Fase 2), o sinal virá de um **transdutor piezométrico submersível 4–20 mA** lido por um ADC ADS1115 (ver documento AquaSense).
> - Por consequência, a lógica de alerta do protótipo é a de um barômetro (**pressão baixa = perigo**). Em um piezômetro real de barragem a lógica é **invertida**: poro-pressão/nível d'água **alto** = perigo (saturação do maciço). Na Fase 2, basta inverter as comparações nos limiares.

---

## Arquitetura do Sistema

```
┌─────────────────┐         ┌──────────────────────┐
│   ESP32 + BMP180│         │                      │
│   (Wokwi Sim.)  │──POST──▶│   InfluxDB Cloud     │
│                 │         │   (us-east-1 AWS)    │
└─────────────────┘         └──────────┬───────────┘
                                        │
                                   Flux Query
                                        │
                             ┌──────────▼───────────┐
                             │   Render.com          │
                             │   server.js (proxy)  │
                             │   Node.js            │
                             └──────────┬───────────┘
                                        │
                                   HTTP /query
                                        │
                             ┌──────────▼───────────┐
                             │   GitHub Pages        │
                             │   index.html          │
                             │   (Dashboard)        │
                             └──────────────────────┘
```

**Por que o proxy?**
O token do InfluxDB nunca pode ficar exposto no HTML (visível no navegador). O `server.js` no Render atua como intermediário — recebe as queries do dashboard e as repassa ao InfluxDB com o token seguro via variável de ambiente.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| Firmware | C++ (Arduino), ESP32, BMP180 |
| Simulação | [Wokwi](https://wokwi.com) |
| Banco de dados | [InfluxDB Cloud](https://cloud2.influxdata.com) (Flux) |
| Proxy / Backend | Node.js puro (sem frameworks) |
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
#define WIFI_SSID      "Wokwi-GUEST"
#define WIFI_PASS      ""
#define INFLUXDB_URL   "https://SEU-CLUSTER.influxdata.com"
#define INFLUXDB_TOKEN "SEU-TOKEN"
#define INFLUXDB_ORG   "SUA-ORG"
#define INFLUXDB_BUCKET "PIEZOMETRO"
```

5. Os limiares padrão foram calibrados para o valor inicial do BMP180 no Wokwi (1013,25 hPa — pressão ao nível do mar):

```cpp
#define PRESSAO_NORMAL  1010.0   // hPa — acima disso = NORMAL
#define PRESSAO_ATENCAO 1005.0   // hPa — 1005–1010 = ATENÇÃO; abaixo = CRÍTICO
```

> Estes valores devem ser **os mesmos** do `CFG` em `index.html` (`thrNormal`/`thrAtencao`), para o dashboard espelhar exatamente o firmware.

6. Clique em **Start Simulation** — o ESP32 enviará dados a cada 10 segundos. Para testar os níveis de alerta, clique no BMP180 durante a simulação e mova o slider de pressão (ex.: 1015 → normal, 1007 → atenção, 1000 → crítico)

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
INFLUX_URL      = https://SEU-CLUSTER.influxdata.com
INFLUX_TOKEN    = SEU-TOKEN
INFLUX_ORG      = SUA-ORG
ALLOWED_ORIGIN  = https://SEU-USUARIO.github.io
ALLOWED_BUCKET  = PIEZOMETRO
```

> 🔐 **Segurança:** o dashboard só **lê** dados — gere para o proxy um token **somente leitura** restrito ao bucket `PIEZOMETRO` (o token de leitura+escrita fica apenas no firmware). O proxy também rejeita queries que referenciem outros buckets (`ALLOWED_BUCKET`).

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
| `INFLUX_ORG` | Nome da organização | `SAMARCO` |
| `ALLOWED_ORIGIN` | Origem permitida pelo CORS | `https://willianlsz1.github.io` |
| `ALLOWED_BUCKET` | Único bucket que o proxy aceita consultar | `PIEZOMETRO` (padrão) |
| `PORT` | Porta do servidor (opcional) | `3000` (padrão) |

---

## Níveis de Alerta

O sistema classifica a pressão em três níveis, espelhando a lógica do firmware:

| Nível | Condição | LED | Buzzer |
|-------|----------|-----|--------|
| 🟢 **Normal** | Pressão ≥ 1010 hPa | Verde contínuo | Silencioso |
| 🟡 **Atenção** | 1005 ≤ Pressão < 1010 hPa | Amarelo contínuo | 1 bip a cada 2s |
| 🔴 **Crítico** | Pressão < 1005 hPa | Vermelho piscando | Bips contínuos |

> ⚠️ Lógica de **barômetro** (pressão atmosférica baixa = tempestade/perigo), adequada ao BMP180 da simulação. Em um **piezômetro real**, o perigo é o nível d'água/poro-pressão **subir** — na Fase 2 as comparações se invertem (pressão **alta** = crítico).

---

## Estrutura do Projeto

```
piezometro-teste/
├── firmware/
│   ├── sketch.ino   # Firmware do ESP32 (C++ / Arduino)
│   └── diagram.json # Circuito do Wokwi (ESP32 + BMP180 + OLED + LEDs + buzzer)
├── server.js        # Proxy Node.js (Render)
├── index.html       # Dashboard web (GitHub Pages)
├── package.json     # Dependências Node.js
├── .env.example     # Modelo de variáveis de ambiente
└── readme.md        # Este arquivo
```

---

## 📝 Observações

- O plano gratuito do Render hiberna após **15 minutos de inatividade**. A primeira requisição após hibernação pode demorar até 50 segundos. O dashboard ativa automaticamente o modo simulação enquanto aguarda.
- O token do InfluxDB **nunca deve ser commitado** no repositório. Use sempre variáveis de ambiente.
- O simulador Wokwi usa a rede `Wokwi-GUEST` (sem senha), que possui acesso à internet para enviar dados ao InfluxDB.
