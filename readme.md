# Sistema de Monitoramento de Piezômetro — Samarco Mineração S.A.

> **TCC SENAI** — Monitoramento Online do Nível de Água em Piezômetros
> Desenvolvido em parceria com a **Samarco Mineração S.A.**

---

## Sumário

- [Descrição do Projeto](#descrição-do-projeto)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Componentes de Hardware](#componentes-de-hardware)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [Deploy](#deploy)
- [Sistema de Alertas](#sistema-de-alertas)
- [Roadmap Industrial](#roadmap-industrial)
- [Referências Técnicas](#referências-técnicas)

---

## Descrição do Projeto

Este projeto implementa um sistema de **monitoramento remoto em tempo real** do nível de água em piezômetros, aplicado ao contexto de barragens de mineração. Desenvolvido como Trabalho de Conclusão de Curso (TCC) no SENAI, em parceria com a **Samarco Mineração S.A.**, o sistema atende às exigências de monitoramento instrumental contínuo previstas na **Portaria ANM 70.389/2017** e na **NBR 17189:2021**.

### Contexto Geotécnico

Piezômetros são instrumentos geotécnicos instalados em barragens para medir a **pressão intersticial** (poro-pressão) na massa de aterro. O monitoramento contínuo permite:

- Detectar tendências anômalas de acúmulo de pressão (indicativo de saturação excessiva)
- Antecipar condições de ruptura por liquefação ou piping
- Gerar histórico de dados para análise de estabilidade (Bishop, Fellenius)
- Cumprir obrigações legais do Plano de Ação de Emergência (PAE)

### Funcionalidades

| Funcionalidade | Status |
|---|---|
| Leitura de pressão, temperatura e altitude a cada 10 s | ✅ |
| Envio ao InfluxDB Cloud via Line Protocol | ✅ |
| Dashboard web em tempo real com histórico 24h | ✅ |
| Gráfico de taxa de variação **dP/dt** (hPa/min) | ✅ |
| Tabela das últimas 20 leituras com exportação CSV | ✅ |
| 3 níveis de alerta com LEDs e buzzer | ✅ |
| Buffer local de 100 leituras (modo offline) | ✅ |
| Reconexão automática ao Wi-Fi | ✅ |
| Rate limiting no proxy (10 req/s por IP) | ✅ |
| Endpoint `/metrics` para monitoramento do serviço | ✅ |
| Interface responsiva para celular (uso em campo) | ✅ |

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SISTEMA PIEZÔMETRO SAMARCO                       │
│                                                                     │
│  ┌──────────────────┐    HTTP POST (Line Protocol)                  │
│  │  ESP32 + BMP180  │──────────────────────────────────────┐        │
│  │  Wokwi Simulator │  telemetria_samarco,device_id=piezo-01│        │
│  │  Buffer 100 leit.│  pressao=912.3,temperatura=25.6 <ts> ▼        │
│  └──────────────────┘                        ┌──────────────────┐   │
│                                              │  InfluxDB Cloud  │   │
│                                              │  us-east-1 AWS   │   │
│                                              │  bucket:PIEZOM.  │   │
│                                              └────────┬─────────┘   │
│                                                       │ Flux Query  │
│                                              ┌────────▼─────────┐   │
│                                              │  Render.com      │   │
│                                              │  server.js       │   │
│                                              │  /query /health  │   │
│                                              │  /metrics + rate │   │
│                                              └────────┬─────────┘   │
│                                                       │ Canvas API  │
│                                              ┌────────▼─────────┐   │
│                                              │  GitHub Pages    │   │
│                                              │  index.html      │   │
│                                              └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Por que o proxy Node.js?** O token de autenticação do InfluxDB nunca pode ficar exposto no código HTML público. O `server.js` no Render.com atua como intermediário seguro, injetando o token no servidor.

---

## Componentes de Hardware

| # | Componente | Modelo | Especificações | Função |
|---|-----------|--------|----------------|--------|
| 1 | Microcontrolador | ESP32 DevKit v1 | 240 MHz dual-core, Wi-Fi 802.11 b/g/n | Processamento e comunicação |
| 2 | Sensor de Pressão | BMP180 | 300–1100 hPa, ±1 hPa, I2C (0x77), 3.3V | Medição de pressão/temperatura |
| 3 | LED Verde | 5 mm difuso | 2.0V Vf, 20 mA | Indicador nível Normal |
| 4 | LED Amarelo | 5 mm difuso | 2.1V Vf, 20 mA | Indicador nível Atenção |
| 5 | LED Vermelho | 5 mm difuso | 2.0V Vf, 20 mA | Indicador nível Crítico |
| 6 | Buzzer | Piezoelétrico passivo | 5V, ≥85 dB | Alerta sonoro |
| 7 | Resistores | 220 Ω (×3) | 1/4 W | Limitadores de corrente dos LEDs |
| 8 | Protoboard | 830 pontos | — | Prototipagem |
| 9 | Jumpers | Macho-Macho (×15) | — | Conexões |
| 10 | Cabo USB | USB-A para Micro-USB | — | Programação do ESP32 |

### Diagrama de Conexões

```
ESP32           BMP180
  3.3V ────────── VCC
  GND  ────────── GND
  GPIO21 (SDA) ── SDA
  GPIO22 (SCL) ── SCL

ESP32           Resistor     LED
  GPIO2  ──── 220Ω ──── VERDE   ──── GND
  GPIO4  ──── 220Ω ──── AMARELO ──── GND
  GPIO5  ──── 220Ω ──── VERMELHO──── GND

ESP32           Buzzer
  GPIO18 ────── (+)
  GND    ────── (-)
```

---

## Configuração do Ambiente

### Pré-requisitos

- Node.js >= 18.0.0
- Conta no [InfluxDB Cloud](https://cloud2.influxdata.com) (plano gratuito disponível)
- Conta no [Render.com](https://render.com) (plano gratuito disponível)
- Conta no GitHub (para GitHub Pages)
- Simulador [Wokwi](https://wokwi.com) (para testar sem hardware físico)

### 1. InfluxDB Cloud

1. Criar conta em https://cloud2.influxdata.com
2. Criar bucket: `PIEZOMETRO`
3. Criar token com permissão de **escrita e leitura** no bucket
4. Anotar: URL do cluster, token e nome da organização

### 2. Variáveis de Ambiente

```bash
cp .env.example .env
# Editar .env com seus valores reais
```

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `INFLUX_URL` | URL do cluster InfluxDB | `https://us-east-1-1.aws.cloud2.influxdata.com` |
| `INFLUX_TOKEN` | Token de autenticação | `meu_token_secreto` |
| `INFLUX_ORG` | Nome da organização | `SAMARCO` |
| `ALLOWED_ORIGIN` | CORS origin permitido | `https://usuario.github.io` |
| `PORT` | Porta do servidor | `3000` |

> **Segurança:** Nunca commite o arquivo `.env`. Ele já está no `.gitignore`.

### 3. Firmware ESP32 (sketch.ino)

Preencher as constantes no topo do `sketch.ino`:

```cpp
#define WIFI_SSID        "Wokwi-GUEST"   // Para Wokwi; use seu SSID real em hardware
#define WIFI_PASS        ""
#define INFLUXDB_URL     "https://seu-cluster.influxdata.com"
#define INFLUXDB_TOKEN   "seu_token_aqui"
#define INFLUXDB_ORG     "SAMARCO"
#define INFLUXDB_BUCKET  "PIEZOMETRO"
#define DEVICE_ID        "piezo-01"      // Identificador único do dispositivo
```

### 4. Dashboard (index.html)

Atualizar a constante `PROXY_URL` com a URL do seu serviço no Render:

```javascript
const PROXY_URL = "https://seu-servico.onrender.com/query";
```

---

## Deploy

### Backend — Render.com

1. Push do repositório para o GitHub
2. No Render: **New Web Service** → conectar repositório
3. Configurações:
   - **Runtime:** Node · **Build:** `npm install` · **Start:** `node server.js`
4. Adicionar variáveis de ambiente: `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `ALLOWED_ORIGIN`

> O plano gratuito do Render hiberna após 15 min de inatividade. A primeira requisição pode levar ~50 s.

### Frontend — GitHub Pages

1. Atualizar `PROXY_URL` no `index.html`
2. No repositório: **Settings → Pages → Source: main branch**
3. Dashboard disponível em `https://seu-usuario.github.io/piezometro-teste/`

### Executar localmente

```bash
npm install
npm start        # http://localhost:3000
npm test         # Testes automatizados (node:test, Node 18+)
npm run dev      # Hot-reload com nodemon
```

---

## Sistema de Alertas

### Níveis de Alerta por Pressão

| Nível | Condição | LED | Buzzer | Dashboard |
|-------|----------|-----|--------|-----------|
| **Normal** | Pressão ≥ 912 hPa | Verde estático | Silencioso | Verde |
| **Atenção** | 907 ≤ P < 912 hPa | Amarelo estático | 1 bip suave | Amarelo |
| **Crítico** | Pressão < 907 hPa | Vermelho piscando | Bips contínuos | Vermelho piscando |

### Taxa de Variação dP/dt

O dashboard exibe a **derivada temporal da pressão** (dP/dt) em hPa/min, calculada entre as duas leituras mais recentes:

| Faixa | Classificação | Cor |
|-------|---------------|-----|
| \|dP/dt\| < 0,1 hPa/min | Estável | Verde |
| 0,1 ≤ \|dP/dt\| < 0,5 hPa/min | Variação moderada | Amarelo |
| \|dP/dt\| ≥ 0,5 hPa/min | Variação crítica | Vermelho |

> Esta métrica é fundamental para identificar **tendências anômalas** antes que os valores absolutos ultrapassem os limites de alerta.

---

## Roadmap Industrial

### Curto Prazo (3–6 meses)
- [ ] Substituir BMP180 por sensor geotécnico certificado (ex: Geokon 4500)
- [ ] Implementar LoRaWAN para cobertura em campo sem Wi-Fi
- [ ] Armazenamento redundante em cartão SD
- [ ] TLS mútuo entre ESP32 e servidor

### Médio Prazo (6–12 meses)
- [ ] Suporte a múltiplos piezômetros (campo `device_id` já implementado)
- [ ] Integração com SCADA via Modbus TCP
- [ ] Modelo preditivo de alerta por tendência (regressão linear)
- [ ] Dashboard com autenticação multi-usuário
- [ ] Notificações via SMS/WhatsApp em eventos críticos

### Longo Prazo (12+ meses)
- [ ] Certificação IEC 61511 (segurança funcional)
- [ ] Redundância de servidor com failover automático
- [ ] Integração com sistema de monitoramento da ANM
- [ ] Detecção de anomalias por Machine Learning (Isolation Forest)

---

## Referências Técnicas

- **NBR 17189:2021** — Barragens de contenção de resíduos: requisitos para projeto, construção, operação e desativação
- **Portaria ANM 70.389/2017** — Requisitos mínimos para gestão da segurança de barragens de mineração
- **InfluxDB Line Protocol** — https://docs.influxdata.com/influxdb/v2/reference/syntax/line-protocol/
- **Flux Query Language** — https://docs.influxdata.com/flux/v0/
- **Adafruit BMP085 Library** — https://github.com/adafruit/Adafruit-BMP085-Library
- **ESP32 Arduino Core** — https://github.com/espressif/arduino-esp32
- **Wokwi ESP32 Simulator** — https://wokwi.com

---

## Estrutura do Projeto

```
piezometro-teste/
├── sketch.ino    # Firmware ESP32 — BMP180, buffer offline, reconexão Wi-Fi
├── server.js     # Proxy Node.js — rate limiting, /metrics, logging estruturado
├── index.html    # Dashboard web — Canvas API, dP/dt, tabela, CSV, mobile
├── test.js       # Testes automatizados — node:test (Node 18+)
├── package.json  # Dependências e scripts npm
├── .env.example  # Modelo de variáveis de ambiente
└── readme.md     # Este arquivo
```
