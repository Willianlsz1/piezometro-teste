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

Quando o InfluxDB não está acessível, o dashboard ativa automaticamente um **modo de simulação** para demonstração.

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
3. Cole o conteúdo de `sketch.ino` no editor
4. Edite as credenciais no topo do arquivo:

```cpp
#define WIFI_SSID      "Wokwi-GUEST"
#define WIFI_PASS      ""
#define INFLUXDB_URL   "https://SEU-CLUSTER.influxdata.com"
#define INFLUXDB_TOKEN "SEU-TOKEN"
#define INFLUXDB_ORG   "SUA-ORG"
#define INFLUXDB_BUCKET "PIEZOMETRO"
```

5. Ajuste a calibração de altitude se necessário:

```cpp
// Calibração para Ribeirão das Neves (~800m altitude)
#define PRESSAO_NORMAL  912.0   // hPa — pressão para nível NORMAL
#define PRESSAO_ATENCAO 907.0   // hPa — pressão para nível ATENÇÃO
```

6. Clique em **Start Simulation** — o ESP32 enviará dados a cada 10 segundos

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
```

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
| `INFLUX_TOKEN` | Token de autenticação | `abc123...` |
| `INFLUX_ORG` | Nome da organização | `SAMARCO` |
| `ALLOWED_ORIGIN` | Origem permitida pelo CORS | `https://willianlsz1.github.io` |
| `PORT` | Porta do servidor (opcional) | `3000` (padrão) |

---

## Níveis de Alerta

O sistema classifica a pressão em três níveis, espelhando a lógica do firmware:

| Nível | Condição | LED | Buzzer |
|-------|----------|-----|--------|
| 🟢 **Normal** | Pressão ≥ 912 hPa | Verde contínuo | Silencioso |
| 🟡 **Atenção** | 907 ≤ Pressão < 912 hPa | Amarelo contínuo | 1 bip a cada 2s |
| 🔴 **Crítico** | Pressão < 907 hPa | Vermelho piscando | Bips contínuos |

---

## Estrutura do Projeto

```
piezometro-teste/
├── sketch.ino       # Firmware do ESP32 (C++ / Arduino)
├── server.js        # Proxy Node.js (Render)
├── index.html       # Dashboard web (GitHub Pages)
├── package.json     # Dependências Node.js
└── README.md        # Este arquivo
```

---

## 📝 Observações

- O plano gratuito do Render hiberna após **15 minutos de inatividade**. A primeira requisição após hibernação pode demorar até 50 segundos. O dashboard ativa automaticamente o modo simulação enquanto aguarda.
- O token do InfluxDB **nunca deve ser commitado** no repositório. Use sempre variáveis de ambiente.
- O simulador Wokwi usa a rede `Wokwi-GUEST` (sem senha), que possui acesso à internet para enviar dados ao InfluxDB.
