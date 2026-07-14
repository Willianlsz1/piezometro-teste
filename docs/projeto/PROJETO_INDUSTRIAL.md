# Projeto Industrial — AquaSense: Unidade de Controle e Telemetria (UCT) para Piezômetros

> Este documento especifica a versão **industrial** do produto — batizado **AquaSense** no
> documento de TCC (template INTEGRA-MG, "Projeto de Inovação.docx"), onde a unidade de campo é
> chamada de **UCT (Unidade de Controle e Telemetria)**. É a especificação de engenharia do
> produto real, separada do protótipo (Fase 1): uma unidade instalável em campo, vendável e
> sustentável operacionalmente. As divergências ainda abertas entre este documento e o rascunho
> do TCC estão consolidadas na [seção 10](#10-divergências-abertas-com-o-rascunho-do-tcc).
>
> Base factual: [`BASE_DE_CONHECIMENTO.md`](BASE_DE_CONHECIMENTO.md),
> [`MAPEAMENTO_DEMANDA_E_MERCADO.md`](MAPEAMENTO_DEMANDA_E_MERCADO.md),
> [`../prototipo/DEFESA_BANCA.md`](../prototipo/DEFESA_BANCA.md),
> [`../prototipo/PROTOTIPO_FISICO.md`](../prototipo/PROTOTIPO_FISICO.md) e
> [`../../readme.md`](../../readme.md). Nenhum número aqui contradiz o que já está levantado
> nesses documentos; onde a fonte dá uma faixa, a faixa é preservada.

---

## 1. Visão do produto

### 1.1 O que é

Uma **unidade de monitoramento remoto de nível d'água/poropressão** — um "datalogger de ponto único"
robusto o bastante para operar em campo, ano após ano, sem manutenção frequente, transmitindo
leituras contínuas para a mesma nuvem (Cloudflare Worker + D1) já validada no protótipo. Cada
unidade instrumenta **um poço/piezômetro**; múltiplas unidades no mesmo backend formam uma rede de
monitoramento, exatamente como o protótipo já suporta hoje (campo `piezometro`, ex. `PZ-01`).

### 1.2 Público-alvo

O produto **não** compete com o pacote de automação de barragens de **DPA (Dano Potencial
Associado) alto** — esse mercado já é atendido (corda vibrante + datalogger industrial +
telemetria dedicada, sistemas como Geokon/Sisgeo/Worldsensing, operado em centros de monitoramento
como o CMI da Samarco em Germano). O público-alvo é a camada que **hoje não tem nenhuma automação**:

- Pequenas barragens de água e açudes — de ~28.043 barragens cadastradas no SNISB, apenas ~6.210
  estão enquadradas na PNSB; o restante segue com leitura manual ou nenhuma leitura.
- Aterros sanitários (~700 unidades regulares no Brasil, cada um com 5–15 piezômetros de chorume
  lidos manualmente — obrigação de licenciamento já vigente, sem automação).
- Diques, encostas urbanas monitoradas por prefeituras/defesa civil, pilhas de estéril e taludes de
  cava de mineração que não se enquadram como DPA alto.
- Obras civis com rebaixamento de lençol freático temporário.

Esse universo é, por definição, orçamentariamente incompatível com o pacote comercial de dezenas de
milhares de reais por ponto — a própria ANA reconhece em manual oficial que pequenas barragens "não
geradoras de receita" não conseguem pagar automação.

### 1.3 Proposta de valor

| | Pacote comercial (DPA alto) | Unidade industrial proposta |
|---|---|---|
| Sensor + aquisição + telemetria por ponto | Preço "sob consulta", tipicamente dezenas de milhares de R$ | Poucas centenas a poucos milhares de R$ por ponto (ver BOM, seção 6) |
| Modelo de precificação | Opaco, negociado por projeto | Público, por faixa de componente |
| Operação (nuvem, dashboard, alertas) | Incluída em contrato de serviço, custo recorrente relevante | Free tier da nuvem (Cloudflare Workers/D1/KV) — custo de operação praticamente zero em escala de dezenas de pontos |
| Público que consegue pagar | Mineradoras com barragem de DPA alto | Prefeituras, DNOCS, operadores de aterro, pequenos proprietários, consórcios de bacia |

A tese central: **a arquitetura de um centro de monitoramento (aquisição → nuvem → dashboard →
alerta em dupla via) não precisa custar dezenas de milhares de reais por ponto** — o protótipo já
prova isso em escala didática; este documento descreve o que muda para levar essa mesma arquitetura
a campo, com robustez de produto.

---

## 2. Requisitos

### 2.1 Requisitos funcionais

| ID | Requisito | Observação |
|---|---|---|
| RF1 | Medição contínua do nível d'água/poropressão do instrumento | Intervalo configurável; referência de projeto: 1 leitura a cada 1–15 min em operação normal (o protótipo já opera a 1 leitura/s + envio a cada 10 s, mais denso que o necessário em campo — deep sleep reduz a cadência para poupar energia) |
| RF2 | Transmissão em tempo real para a nuvem | Mesmo par de endpoints do protótipo (`POST /ingest`, `GET /ultimos`, `GET /dados`) |
| RF3 | Armazenamento histórico com retenção plurianual | D1 já suporta (retenção ilimitada dentro do free tier, ~5 GB — anos de leituras de um ponto) |
| RF4 | Alertas preventivos em **dupla via** | Telegram (dado) + SMS (independente de internet do destinatário) — já implementado no motor de alertas do Worker |
| RF5 | *Store & forward* | Buffer local com timestamp (RTC/NTP) para reenvio quando a rede cai — já implementado no firmware |
| RF6 | Alerta de silêncio de instrumento | Se a nuvem não recebe leitura de um ponto por N minutos, o motor de alertas deve notificar "instrumento silencioso" — ausência de dado nunca deve ser lida como "normal" (padrão ISA-18.2 de gestão de alarmes, já citado em `DASHBOARD_PROFISSIONAL.md`) |
| RF7 | Identificação multi-instrumento | Cada unidade se anuncia com um ID único (`piezometro=PZ-0x`); já suportado pelo schema e pelo dashboard |
| RF8 | Alerta local (sem depender da nuvem) | LED + buzzer/sirene no próprio gabinete, para quem está fisicamente no local |

### 2.2 Requisitos não funcionais

| ID | Requisito | Referência |
|---|---|---|
| RNF1 | Autonomia energética ≥ 12 meses sem intervenção | Bateria + solar, ver seção 4.4 |
| RNF2 | Grau de proteção IP67 no gabinete de campo | Exposição a chuva, poeira, imersão eventual |
| RNF3 | Faixa de temperatura de operação −20 °C a +60 °C (eletrônica), MCU industrial −40 °C a +85 °C | Compatível com clima brasileiro em campo aberto |
| RNF4 | MTBF alvo ≥ 3 anos por unidade em campo | Componentes industriais, proteção contra surto |
| RNF5 | Precisão do sensor de nível/poropressão: erro ≤ 0,1–0,25% do fundo de escala (transdutores 4–20 mA de linha industrial) | Ordem de grandeza muito superior ao protótipo (±1–2 cm), adequada a decisão técnica |
| RNF6 | Proteção contra surto (descarga atmosférica) na entrada de energia e no loop de sinal | Barragens são estruturas expostas a raios; item citado como lacuna do protótipo |
| RNF7 | Redundância de energia e comunicação | **Aplica-se apenas a barragens de DPA alto**, por exigência explícita da Resolução ANM 95/2022. Fora do escopo padrão deste produto (público-alvo não é DPA alto); ver seção 8 para o caminho de atendimento quando exigido |

**Nota regulatória:** a Resolução ANM 95/2022 obriga monitoramento automatizado em tempo real e
período integral, com redundância de energia, **apenas para barragens de DPA alto** com Centro de
Monitoramento dedicado. O produto aqui especificado é dimensionado para o público que está **fora**
dessa obrigação (ou a mais que atende voluntariamente, sem que a norma o exija) — daí a autonomia
energética alta em vez de redundância formal, e SMS local como segunda via em vez de dupla rede
celular redundante.

---

## 3. Arquitetura da unidade industrial

```
┌───────────────────────────────────────────────────────────────────────┐
│                       UNIDADE DE CAMPO (gabinete IP67)                 │
│                                                                         │
│  Sensor            Condicionamento         MCU               Comunic. │
│  ┌──────────┐      ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │
│  │Transdutor│ 4-20mA│ Shunt 150 Ω  │   │  ESP32       │   │ 4G Cat-M/│ │
│  │piezomé-  ├──────▶│ + ADS1115    ├──▶│  industrial  ├──▶│ NB-IoT   │ │
│  │trico     │      │ (ADC 16 bit) │   │  (WROOM-32,  │   │(SIM7600) │ │
│  │submersível│      └──────────────┘   │  -40..+85°C) │   │ + SMS    │ │
│  └──────────┘                          │  em PCB      │   │  local   │ │
│       ▲                                │  dedicada    │   └────┬─────┘ │
│       │                                └──────┬───────┘        │       │
│  Energia: bateria LiFePO4 + painel solar +     │                │       │
│  controlador de carga + proteção contra surto  │ LED/buzzer     │       │
│                                                 │ locais         │       │
└─────────────────────────────────────────────────────────────────┼───────┘
                                                                    │
                                                    POST /ingest (JSON,
                                                    x-device-key)   │
                                                                    ▼
                              ┌───────────────────────────────────────────┐
                              │   MESMO BACKEND DO PROTÓTIPO (inalterado) │
                              │   Cloudflare Worker (ingestão + /ultimos  │
                              │   + /dados + cron de alertas)             │
                              │        │                    │            │
                              │   INSERT (D1)         GET /ultimos,/dados│
                              │        ▼                    ▼            │
                              │   Cloudflare D1        GitHub Pages       │
                              │   (SQLite)             (Dashboard)        │
                              │        │                                  │
                              │        └──▶ Telegram / SMS Twilio         │
                              └───────────────────────────────────────────┘
```

**Ponto central da arquitetura:** o software — Worker, D1, motor de alertas (3 camadas: nível +
comunicação + taxa), dashboard — **não muda**. O único ponto de troca entre protótipo e produto
industrial é o **adapter de sensor do firmware**, a função `lerSensor()` (hoje implementada em
`firmware/sketch.ino` para o BMP180 de simulação e em `firmware/sketch_fisico_jsn_sr04t.ino` para o
ultrassônico da maquete física). Na versão industrial, `lerSensor()` passa a ler o transdutor 4–20 mA
via ADS1115 e converter para nível/carga piezométrica em metros — o mesmo contrato de saída
(`nivel_agua`, `pressao`, `temperatura`, `piezometro`) que o Worker já consome. Todo o resto do
sistema — protocolo HTTP, autenticação por `DEVICE_KEY`, schema do D1, motor de alertas, dashboard —
é reaproveitado integralmente, sem reescrita.

---

## 4. Hardware industrial

### 4.1 Sensor

| Opção | Como funciona | Faixa de preço (R$) | Quando usar |
|---|---|---|---|
| **Transdutor piezométrico submersível 4–20 mA** (piezorresistivo, cabo blindado) | Converte pressão em corrente de loop 4–20 mA, proporcional linear ao fundo de escala | ~R$ 240 (varejo nacional, transdutor genérico 0–10 bar) a poucos milhares de reais (versão industrial certificada, cabo longo, compensação de temperatura) | **Opção principal do produto** — custo/benefício, integra direto com o loop 4-20mA já especificado |
| **Corda vibrante** (ex. Geokon série 4500, Sisgeo, RocTest) | Diafragma tensiona um fio de aço; frequência de vibração natural varia com a pressão | Preço "sob consulta" em todos os fornecedores pesquisados (única referência aberta: ~US$ 2.750 por datalogger avulso) | Quando o **projetista geotécnico exigir** especificamente corda vibrante (padrão de mercado para automação de barragens, maior tradição e integração com dataloggers industriais estabelecidos) — a unidade pode ser adaptada trocando o bloco de aquisição por um leitor de frequência dedicado |

O produto adota o transdutor 4–20 mA como padrão porque é o que sustenta o argumento econômico da
seção 1.3; a arquitetura aceita corda vibrante como opção de projeto quando especificada.

### 4.2 Aquisição — loop 4–20 mA

Dimensionamento básico do condicionamento de sinal:

- **Resistor shunt de precisão**: 150 Ω, 0,1% de tolerância, colocado em série no loop de corrente.
  - Em 4 mA (fundo de escala inferior): V = 4 mA × 150 Ω = **0,6 V**
  - Em 20 mA (fundo de escala superior): V = 20 mA × 150 Ω = **3,0 V**
  - Faixa de tensão resultante (0,6–3,0 V) cabe confortavelmente dentro do fundo de escala do ADC
    sem saturar e sem desperdiçar resolução.
  - ⚠️ **Atenção ao valor do rascunho do TCC:** o "Projeto de Inovação.docx" especifica shunt de
    **250 Ω** — o valor clássico para entradas 1–5 V de CLP. Com 250 Ω, 20 mA geram **5,0 V**,
    acima do limite de entrada do ADS1115 alimentado em 3,3 V (máx. VDD + 0,3 V) — risco de
    saturação/dano. Ou se adota **150 Ω** (recomendado, tabela acima), ou se alimenta o ADS1115
    em 5 V (ele aceita 2,0–5,5 V), verificando os níveis lógicos do I2C com o ESP32 em 3,3 V
    (VIH mínimo do ADS1115 a 5 V é 0,7×VDD = 3,5 V — marginal). Divergência a resolver antes de
    comprar componentes (ver seção 10).
- **ADS1115** — ADC externo I2C de 16 bits, ganho configurável (PGA), usado porque o ADC interno do
  ESP32 (12 bits, não linear nas extremidades) não tem resolução nem estabilidade suficiente para
  medição de precisão de campo.
- Resolução resultante: com PGA ajustado para o fundo de escala de ~3 V, o LSB do ADS1115 fica na
  casa de dezenas de µV — folga de sobra para os milivolts de variação de nível relevantes.
- **Calibração**: a conversão de mA (ou volts sobre o shunt) para metros de coluna d'água é feita por
  dois pontos de referência conhecidos na instalação (seção 7), assim como já é convertido
  fisicamente 1 mH₂O ≈ 98,07 hPa quando a variável de origem é pressão.

### 4.3 MCU

- **ESP32 industrial** (módulo WROOM-32 ou equivalente, faixa de operação **−40 °C a +85 °C**),
  não o kit de desenvolvimento de protoboard usado no protótipo.
- Montado em **PCB dedicada** (não protoboard/jumpers): trilhas soldadas, conectores de painel para
  o loop 4–20 mA, alimentação e antena, reduzindo falhas por vibração, umidade e mau contato que uma
  protoboard não suporta em campo.
- Deep sleep entre leituras para atender à autonomia energética (seção 4.4), com o despertar
  agendado por **RTC externo DS3231** (precisão de relógio independente do NTP; o firmware liga a
  alimentação do sensor apenas no instante da leitura, como especificado no rascunho do TCC).
- **Redundância local em cartão MicroSD** ("caixa preta", decisão do rascunho do TCC): todas as
  leituras são gravadas localmente com carimbo de tempo antes do envio — complementa o
  *store & forward* em memória do protótipo com persistência que sobrevive a reinício/queda de
  energia e cobre interrupções longas de sinal celular.

### 4.4 Energia

- **Configuração adotada no rascunho do TCC (bancada/piloto):** painel solar fotovoltaico de
  **20 W** + controlador de carga **PWM** + **bateria selada estacionária 12 V 18 Ah** (VRLA/AGM)
  — kit de baixo custo e ampla disponibilidade nacional, adequado para a homologação em bancada e
  o piloto.
- **Evolução para a série:** **bateria LiFePO4** (química estável, tolera ciclos profundos e
  temperatura de campo melhor que chumbo-ácido selada, vida útil maior em ciclagem diária) +
  controlador **MPPT** — custo maior por unidade, mas menos trocas de bateria ao longo da vida da
  unidade.
- Conta de autonomia (estimativa de referência, a validar em bancada):
  - Consumo em deep sleep: dezenas de µA (referência de projeto similar de medidor de nível com
    ESP32 + LoRa atinge ~12 µA em repouso).
  - Consumo ativo (leitura + transmissão): pico na casa de 100–250 mA por poucos segundos a cada
    ciclo de leitura/transmissão.
  - Com leituras espaçadas (minutos, não segundos, como em campo — diferente da cadência densa de
    demonstração do protótipo) e deep sleep entre ciclos, o consumo médio diário fica baixo o
    suficiente para uma bateria de poucos Ah + painel solar pequeno sustentarem operação contínua
    por 12+ meses mesmo em dias nublados seguidos, com folga de projeto (dimensionamento final exige
    medição de consumo real da PCB montada, não apenas datasheet).

### 4.5 Comunicação

- **Via principal em campo:** módulo celular **4G/LTE SIM7600** (decisão do rascunho do TCC;
  módulos Cat-M/NB-IoT são a alternativa de menor consumo onde houver cobertura), que também
  permite envio de **SMS local direto do próprio equipamento** — independente do backend estar no
  ar —, como segunda via de alerta em caso de falha de nuvem ou de internet do destinatário.
  O rascunho do TCC especifica o transporte via **MQTT com payload JSON**; o backend atual do
  projeto recebe **HTTP POST `/ingest`** — divergência de protocolo a fechar (ver seção 10).
- **Alternativa:** **LoRaWAN**, quando já existir um gateway próximo (ex. redes privadas tipo
  Worldsensing Loadsensing usadas em grandes operações de mineração) — reduz custo recorrente de
  dados celulares, mas depende de infraestrutura de gateway que o público-alvo deste produto
  tipicamente não tem.
- WiFi (usado no protótipo/Wokwi) não é opção de campo — barragens, açudes e aterros normalmente não
  têm cobertura WiFi no ponto de instalação.

### 4.6 Invólucro

- Caixa **IP67**, prensa-cabos vedados nas entradas de cabo do sensor, antena e energia.
- **Proteção contra surto** na entrada de energia (painel solar) e no loop de sinal 4–20 mA —
  relevante porque barragens são estruturas expostas, sujeitas a descargas atmosféricas diretas ou
  induzidas.
- Suporte de fixação compatível com o tubo do piezômetro/poço de observação já existente em campo.

---

## 5. Tabela protótipo × industrial

| Bloco | Protótipo (maquete didática) | Equivalente industrial | Papel (idêntico nos dois) |
|---|---|---|---|
| Processamento | ESP32 DevKit V1 em protoboard | ESP32 industrial (WROOM-32, −40..+85 °C) em PCB dedicada | Datalogger com telemetria |
| Sinalização local | LEDs (verde/amarelo/vermelho) + buzzer | LEDs industriais + sirene/buzzer no gabinete de campo | Alerta visível/audível a quem está fisicamente no local |
| Display de campo | OLED SSD1306 128x64 | Display de campo (ou leitor removível/porta de diagnóstico) | Leitura local do valor atual sem precisar do dashboard |
| Sensor | JSN-SR04T ultrassônico (mede de cima, stand-in de nível) | Transdutor piezométrico submersível 4–20 mA (mede o mesmo fenômeno do piezômetro real) | Fonte da leitura de nível/poropressão |
| Placa de montagem | Protoboard 830 pontos + jumpers | PCB dedicada, soldada, com conectores de painel | Interconexão elétrica confiável em campo |
| Energia | Cabo USB (fonte de bancada) | Bateria LiFePO4 + painel solar + controlador de carga | Alimentação autônoma |
| Comunicação | WiFi (Wokwi/roteador local) | 4G Cat-M/NB-IoT (SIM7600) + SMS local, ou LoRaWAN quando houver gateway | Transporte da leitura até a nuvem |
| Gabinete | Tubo de PVC aberto/protoboard exposta | Caixa IP67 com prensa-cabos e proteção contra surto | Proteção ambiental do equipamento |

A diferença entre as duas colunas é **de robustez e certificação, não de conceito** — a mesma linha
de argumento já usada na defesa de banca (`DEFESA_BANCA.md`).

---

## 6. BOM industrial estimada (por ponto de monitoramento)

| Item | Especificação | Faixa de custo (R$) |
|---|---|---|
| Transdutor piezométrico 4–20 mA submersível | Cabo blindado, compensação de temperatura | 240 – 2.000 |
| ADS1115 + shunt de precisão 150 Ω (0,1%) | Módulo de aquisição | 30 – 60 |
| ESP32 industrial (WROOM-32, −40..+85 °C) + PCB dedicada | Placa fabricada (não protoboard) | 80 – 200 |
| Módulo celular 4G Cat-M/NB-IoT (SIM7600 ou equivalente) + chip M2M | Comunicação + SMS local | 150 – 350 |
| Bateria LiFePO4 + painel solar + controlador de carga | Dimensionado para autonomia ≥ 12 meses | 250 – 600 |
| Gabinete IP67 + prensa-cabos + proteção contra surto | Invólucro de campo | 150 – 350 |
| Sinalização local (LED/sirene) + fixação mecânica | Montagem no tubo existente | 50 – 100 |
| Instalação, calibração e comissionamento (mão de obra) | Responsável técnico em campo | 300 – 800 |
| **Total estimado por ponto** | | **≈ R$ 1.250 – 4.500** |

Para referência de escala: a proposta técnica original do projeto (ver `MAPEAMENTO_DEMANDA_E_MERCADO.md`,
seção 5) estimou **R$ 2.965/unidade** para uma primeira série (50 unidades = R$ 260 mil), com
payback de 5,8 meses frente à economia declarada de R$ 600 mil/ano na demanda oficial da Samarco —
número consistente com a faixa acima.

**Comparação com o mercado:** o pacote comercial completo (sensor corda vibrante + datalogger +
telemetria industrial + integração) é vendido "sob consulta" por todos os fornecedores pesquisados
(Geokon, Sisgeo, 3Geo, Santiago e Cintra, Worldsensing), sem lista de preço pública — a única
referência aberta encontrada na pesquisa de mercado foi ~US$ 2.750 por datalogger avulso (sem
sensor, sem telemetria, sem instalação). Mesmo no limite superior da faixa acima (R$ 4.500), a
unidade industrial proposta fica uma ordem de grandeza abaixo do que se estima para o pacote
comercial completo por ponto (dezenas de milhares de reais).

---

## 7. Instalação, calibração e manutenção

### 7.1 Instalação

- A unidade se instala **no tubo do piezômetro ou poço de observação já existente** — não requer
  nova perfuração quando o instrumento já está implantado (ex. Casagrande de leitura manual sendo
  automatizado).
- O transdutor submersível desce pelo cabo até a profundidade de operação definida em projeto,
  ficando abaixo do nível d'água mínimo esperado; o cabo é fixado na boca do tubo e conduzido até o
  gabinete de superfície, que abriga eletrônica, bateria e antena.
- Fixação do gabinete próxima ao tubo, com o painel solar orientado para máxima incidência solar
  local.

### 7.2 Calibração

- Calibração **assistida por responsável técnico**, com dois pontos de referência de nível
  conhecido (ex. nível medido manualmente com pio elétrico em dois momentos distintos, ou dois
  níveis controlados durante o comissionamento) — mesmo princípio de calibração de dois pontos já
  usado no protótipo físico (`ALTURA_SENSOR_CM` e a escala aplicada sobre a leitura bruta).
- A conversão final de corrente de loop (ou tensão sobre o shunt) para nível/carga piezométrica em
  metros é ajustada a partir desses dois pontos, documentada no relatório de comissionamento da
  unidade.

### 7.3 Manutenção

| Rotina | Frequência sugerida |
|---|---|
| Limpeza do gabinete e do painel solar | Semestral (ou após eventos de chuva/lama intensos) |
| Verificação de tensão/estado da bateria | Trimestral (remota, via telemetria de tensão da bateria — item a incluir no payload) |
| Recalibração de dois pontos | Anual, ou após qualquer intervenção física no ponto |
| Inspeção do cabo do transdutor e das conexões do loop 4–20 mA | Anual |
| Verificação do sinal de comunicação (celular/LoRa) | Trimestral |

---

## 8. Conformidade e limitações

**O que o produto atende:**
- Medição contínua, transmissão em tempo real, histórico, alertas preventivos em dupla via e
  *store & forward* — os requisitos funcionais centrais de qualquer demanda de automação de
  monitoramento geotécnico não sujeita a DPA alto.
- Alinhamento com boas práticas de gestão de alarmes (ISA-18.2: histerese, sem repique, alerta de
  ausência de dado) e com a lógica de níveis de controle definidos pelo projetista geotécnico
  (limiares parametrizáveis, já implementados).

**O que fica fora do escopo padrão (exige DPA alto ou responsabilidade legal específica):**
- **Redundância de energia e de comunicação**, exigida explicitamente pela Resolução ANM 95/2022
  para barragens de DPA alto — o produto padrão entrega alta autonomia energética (bateria + solar),
  não redundância formal (duas fontes de energia independentes, dois canais de comunicação
  simultâneos).
- **Centro de Monitoramento dedicado com operação 24/7 por equipe própria**, como o CMI da Samarco
  em Germano — o produto entrega o dashboard e o motor de alertas automatizado, que cumprem o papel
  técnico, mas não substituem a estrutura organizacional e a responsabilidade legal de um centro de
  monitoramento formal quando exigido por norma.
- **Certificações de instrumento** (calibração rastreável por laboratório acreditado, certificação
  de área classificada quando aplicável) que o mercado de DPA alto exige contratualmente.
- **Declaração de Níveis de Emergência (NE1/NE2/NE3) do PAEBM** — permanece decisão humana do
  responsável técnico; o produto fornece o dado que subsidia essa decisão, não a substitui.

**Caminho para atender DPA alto, quando necessário:** adicionar uma segunda via de energia (ex.
gerador de contingência ou segunda bateria com carregador independente) e um segundo canal de
comunicação simultâneo (ex. celular + LoRa em paralelo, não apenas em modo de contingência
sequencial), formalizar calibração rastreável por laboratório acreditado, e integrar a saída da
unidade ao Centro de Monitoramento formal do operador — a arquitetura de software não muda para
suportar isso, pois o backend já é multi-instrumento e já expõe os endpoints necessários.

---

## 9. Roadmap de industrialização

| Fase | Descrição | Status |
|---|---|---|
| **1. Protótipo** | ESP32 + sensor stand-in (BMP180 na simulação Wokwi, JSN-SR04T na maquete física) + backend Cloudflare completo + dashboard + alertas Telegram/SMS | **Concluída** (este TCC) |
| **2. Piloto em campo** | 1 unidade com transdutor 4–20 mA + ADS1115, PCB dedicada, gabinete IP67, energia solar+bateria, instalada em um açude ou pequena barragem parceira (ex. via convênio com DNOCS, prefeitura ou operador de aterro), operando por um ciclo hidrológico completo (mínimo 6–12 meses) para validar autonomia energética, comunicação em campo real e precisão de calibração | Planejada |
| **3. Pequena série** | Fabricação de PCB em lote pequeno (dezenas de unidades), padronização do processo de calibração e instalação, ajuste da BOM por volume de compra, formalização de manual de instalação/manutenção e SLA de suporte | Planejada, condicionada aos resultados do piloto |

O critério de avanço entre fases é **dado de campo real**, não estimativa de bancada: o piloto deve
responder, com números medidos (não datasheet), a autonomia energética real, a taxa de sucesso de
transmissão em área de sombra celular, e o desvio de calibração ao longo do tempo — antes de
comprometer capital em uma série maior.

---

## 10. Divergências abertas com o rascunho do TCC

O rascunho do TCC ("Projeto de Inovação.docx", template INTEGRA-MG — em desenvolvimento) toma
algumas decisões que ainda não batem com o que está construído/documentado no repositório.
Consolidadas aqui para fechamento antes do texto final:

| # | Tema | Rascunho do TCC (AquaSense) | Repositório / este documento | Recomendação |
|---|---|---|---|---|
| 1 | Shunt do loop 4–20 mA | 250 Ω | 150 Ω | **150 Ω** — 250 Ω gera 5,0 V a 20 mA e estoura a entrada do ADS1115 em 3,3 V (ver seção 4.2). Corrigir o TCC ou justificar alimentação em 5 V |
| 2 | Backend / transporte | MQTT + JSON, dashboard Grafana ou ThingsBoard | HTTP POST `/ingest` → Cloudflare Worker + D1, dashboard próprio (GitHub Pages) já pronto, com motor de alertas Telegram/SMS funcionando | Decidir: ou o TCC descreve o backend real (Cloudflare, já validado — mais honesto para a banca), ou se implementa a ponte MQTT. Reescrever o backend joga fora o que já funciona |
| 3 | Grau de proteção | Gabinete IP66 | IP67 (RNF2) | Qualquer um defende; IP66 (jato d'água) é suficiente para gabinete de superfície — alinhar os dois textos no mesmo número |
| 4 | Alerta em dupla via | Telegram/E-mail | Telegram/SMS (Twilio) implementado; SMS local via SIM7600 como redundância | Manter Telegram/SMS (já funciona e SMS não depende de internet do destinatário); e-mail é adição trivial se a banca pedir |
| 5 | Economia / payback | CAPEX R$ 300.000, payback 6 meses, economia R$ 600 mil/ano | R$ 2.965/unidade, 50 unidades ≈ R$ 260 mil (MAPEAMENTO seção 5), payback 5,8 meses | Números da mesma ordem — homogeneizar para um único par (CAPEX e payback) nos dois documentos |
| 6 | Cadência de leitura | "mais de 96 leituras/dia" (1 a cada 15 min) | Protótipo demonstra a 1 envio/10 s; RF1 prevê 1–15 min em campo | Consistente — apenas deixar explícito no TCC que a cadência do protótipo é de demonstração |
| 7 | Papel do WiFi | Não menciona | Protótipo usa WiFi; produto usa celular | Sem conflito — o TCC já descreve a fase industrial |

As decisões do rascunho **já incorporadas** a este documento: nome AquaSense/UCT, transdutor
piezorresistivo 4–20 mA submersível, ADS1115 16 bits, ESP32, SIM7600, deep sleep com RTC DS3231,
MicroSD como "caixa preta", kit solar 20 W + PWM + bateria selada 12 V 18 Ah (bancada/piloto) e
bancada vertical de PVC de 2 m como ambiente de homologação.
