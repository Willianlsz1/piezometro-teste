# Comparativo de Mercado — Monitoramento de Piezômetros e Nível d'Água

> **Pesquisa realizada em:** 13/07/2026, via busca na internet (WebSearch/WebFetch — ~13 buscas
> textuais + tentativas de acesso a páginas de fabricantes, distribuidores, marketplaces B2B e
> um artigo técnico do IBRACON). **Método:** buscas em português e inglês por fabricantes
> conhecidos de instrumentação geotécnica sem fio, portais de compras públicas brasileiros,
> marketplaces (Alibaba/Made-in-China), plataformas IoT genéricas e projetos acadêmicos
> similares.
>
> **Aviso importante:** preços de instrumentação geotécnica profissional são majoritariamente
> **"sob consulta"** (nenhum dos oito fabricantes/integradores pesquisados publica tabela de
> preços). Os poucos números encontrados vêm de marketplaces genéricos (não necessariamente
> equipamentos com o mesmo nível de certificação/robustez de campo) ou de um artigo técnico de
> 2007. **Todos os valores devem ser rechecados antes da banca** — preços mudam, câmbio muda, e
> cotações diretas com os fabricantes são o padrão-ouro caso o tempo permita antes da defesa.

---

## 1. Panorama: as três camadas do mercado

O mercado de monitoramento de nível d'água/poropressão em barragens e taludes se organiza em três
camadas bem distintas, com pouquíssima sobreposição de público:

1. **Industrial certificado (corda vibrante + datalogger + telemetria proprietária).**
   Worldsensing, Geokon, Sisgeo, Ackcio, Encardio-rite, RST Instruments, Canary Systems/Measurand.
   Produto maduro, robusto para campo hostil (raios, décadas de operação, IP68), com integração
   nativa a sensores de corda vibrante — o padrão de fato para barragens de DPA alto sob a
   Resolução ANM 95/2022. Preço **opaco por design**: nenhuma das marcas pesquisadas publica
   tabela de preços; todas direcionam para "fale com vendas"/distribuidor local.
2. **IoT intermediário / genérico.** Plataformas como ThingSpeak e Ubidots, somadas a hardware
   avulso (dataloggers genéricos, sensores 4-20 mA), permitem montar telemetria sem comprar um
   pacote fechado — mas não vêm com lógica de alerta multi-camada para poropressão, não têm
   compensação de corda vibrante nativa, e cobram por dispositivo/mês nos planos comerciais
   (Ubidots: US$ 99/mês no plano Professional).
3. **Baixo custo / manual.** A imensa maioria das barragens pequenas, açudes e taludes no Brasil
   (documentado na Parte 3 da Base de Conhecimento: 28.043 barragens cadastradas, só 6.210 na
   PNSB) segue com leitura manual — pio elétrico, planilha, sem alerta automático. É exatamente a
   lacuna entre a camada 1 (cara, sob consulta) e a inexistência de solução dedicada de baixo
   custo que o protótipo deste projeto ocupa.

O protótipo (ESP32 + sensor + Cloudflare Worker/D1 + dashboard + alertas Telegram/SMS + store &
forward) não compete na Camada 1 — não usa corda vibrante, não tem certificação de campo, não tem
redundância de energia. Ele compete na lacuna entre as Camadas 2 e 3: mais dedicado a poropressão
que uma plataforma IoT genérica, e ordens de magnitude mais barato que a Camada 1.

---

## 2. Tabela comparativa principal

| Solução | Sensor suportado | Comunicação | Software/Dashboard | Alertas | Preço indicativo por ponto | Público-alvo |
|---|---|---|---|---|---|---|
| **Worldsensing Loadsensing** (nós VW + Piconode) | Corda vibrante (1/2/6 canais), analógico | LoRa proprietário → gateway celular/satélite | Plataforma web proprietária (Worldsensing Insights) | Sim, configurável | **Sob consulta** (não publicado) [[1]](#ref1) | Mineração/geotecnia industrial, DPA alto |
| **Geokon GeoNet** (8900/8940/8960 + piezômetro 4500) | Corda vibrante (Geokon nativo) | Celular/Wi-Fi/satélite (série GeoNet) | Software proprietário GeoNet/dataloggers | Sim | **Sob consulta**; sensor avulso 4500 sem preço público [[2]](#ref2) | Barragens, obras civis, engenharia geotécnica |
| **Sisgeo WR-Log** (descontinuado, mas ilustrativo) | Corda vibrante, 4-20 mA, PT-100, Modbus RS485 | Rádio proprietário até 15 km → gateway | App Android + software de gestão | Sim | **Sob consulta** [[3]](#ref3) | Geotecnia/estruturas, ambientes remotos |
| **Ackcio Beam** (BEAM-VW-S1/S8) | Corda vibrante (1 ou 8 canais) | Mesh proprietário | Plataforma web Ackcio | Sim | **Sob consulta** [[4]](#ref4) | Mineração, infraestrutura, construção |
| **Encardio-rite** (EPP + ESCL-12VT) | Corda vibrante (linha EPP) | GPRS/GSM (datalogger com telemetria) | Nuvem proprietária | Sim | **Sob consulta**; representante exclusivo BR = Santiago e Cintra [[5]](#ref5) | Barragens, obras, geotecnia (forte presença no Brasil) |
| **RST Instruments** (DT2011B/DT2040/DT2055B) | Corda vibrante + termistor (até 40 canais) | Cabo/rádio conforme modelo | Software proprietário | Configurável | **Sob consulta** [[6]](#ref6) | Geotecnia industrial |
| **Canary Systems + Measurand** (MLSAA) | Corda vibrante + ShapeArray + 4-20 mA | Solar/bateria + telemetria | Banco de dados/servidor proprietário | Sim | **Sob consulta** [[7]](#ref7) | Barragens de grande porte, hidrelétricas |
| **Sensor de corda vibrante avulso (mercado genérico/importado)** | — (o próprio sensor) | — | — | — | US$ 59,90–8.500 conforme especificação, MOQ e procedência (Alibaba/Made-in-China) [[8]](#ref8) | Faixa muito ampla — do genérico sem rastreabilidade ao de grau industrial |
| **Automação completa de instrumentação de barragem** (referência histórica, não específico de piezômetro) | Medidores triortogonais + aquisição | Telemetria dedicada | Software de aquisição dedicado | Sim | **US$ 1.636/instrumento** (só sensor + unidade de aquisição) a **US$ 2.370/instrumento** (custo total) — 270 sensores, artigo IBRACON 2007 [[9]](#ref9) | Grandes barragens de concreto |
| **ThingSpeak / Ubidots + sensor avulso** (plataforma IoT genérica) | Qualquer sensor analógico/digital que o integrador conecte | Wi-Fi/celular/LoRa (a critério do integrador) | Dashboards genéricos, sem lógica de poropressão pronta | Regras genéricas de limiar (sem 3 camadas prontas) | ThingSpeak: gratuito (não comercial, limitado); Ubidots Professional: US$ 99/mês [[10]](#ref10) | Makers, protótipos genéricos, PoCs |
| **Projetos acadêmicos ESP32/Arduino similares** (ESPiezometer, TCCs de reservatório/ETA/ETE) | Sensor de nível avulso (ultrassônico, pressão) | Wi-Fi/LoRa/BLE conforme projeto | Dashboards variados (Flutter, web, apps Android) | Variável — nem todos têm alerta multi-canal pronto | Não informado em R$ nos trabalhos revisados | Pesquisa acadêmica, prova de conceito |
| **Este projeto (piezometro-teste)** | Sensor de coluna d'água (ultrassônico JSN-SR04T / simulação BMP180) — stand-in, não corda vibrante | Wi-Fi (ESP32) → HTTP → Cloudflare Worker | Dashboard próprio (GitHub Pages, 8 módulos JS), histórico D1, gráficos | 3 camadas (Normal/Atenção/Crítico) prontas, Telegram + SMS Twilio, store & forward | **~R$ 150–220 por ponto** (protótipo) | Barragens pequenas, açudes, aterros sanitários, encostas — camada sem instrumentação hoje |

---

## 3. Detalhe por concorrente

<a id="ref1"></a>**Worldsensing Loadsensing** — linha de nós wireless para corda vibrante (1/2/6 canais) e o
"Piconode", lançado como o nó mais compacto e "mais acessível" da linha (mas sem valor numérico
divulgado). Gateway próprio agrega os nós e envia por celular/satélite. Referência de mercado em
mineração global. Fonte: [worldsensing.com/product/piconode-data-acquisition](https://www.worldsensing.com/product/piconode-data-acquisition/), acesso 13/07/2026.

<a id="ref2"></a>**Geokon** — fabricante americano (Lebanon, NH) do piezômetro de corda vibrante
Modelo 4500 (a referência mundial mais citada do tipo) e da linha de dataloggers GeoNet (séries
8900/8920/8940/8960), com opções celular, Wi-Fi e satélite. Nenhuma página de produto lista preço;
contato direto ou via distribuidor (ex.: Specto Technology) é exigido. Fonte:
[geokon.com/4500-Series](https://www.geokon.com/4500-Series), acesso 13/07/2026.

<a id="ref3"></a>**Sisgeo WR-Log** — sistema de nós sem fio (bateria, até 10 anos de autonomia)
que leem corda vibrante, 4-20 mA, PT-100 e Modbus RS485, com alcance de rádio de até 15 km até um
gateway com roteador embarcado; app Android para configuração. Produto já listado como
"descontinuado" no catálogo atual da Sisgeo, mas ilustrativo da arquitetura de mercado (nó → gateway
→ nuvem). Fonte: [sisgeo.com/products/discontinued/wr-log-wireless-dataloggers](https://sisgeo.com/products/discontinued/wr-log-wireless-dataloggers/), acesso 13/07/2026.

<a id="ref4"></a>**Ackcio Beam** — plataforma de mesh wireless malaia com nós BEAM-VW-S1 (1 canal) e
BEAM-VW-S8 (8 canais) dedicados a automatizar piezômetros de corda vibrante em barragens; forte
presença em mineração no Sudeste Asiático, revendida no Brasil/América Latina por parceiros como
HMA Group. Sem preço público. Fonte: [ackcio.com/industries/mining](https://www.ackcio.com/industries/mining/), acesso 13/07/2026.

<a id="ref5"></a>**Encardio-rite** — fabricante indiano com linha extensa de piezômetros de corda
vibrante (EPP-30V, EPP-40V, EPP-60V para baixa pressão) e datalogger com telemetria GPRS/GSM
(ESCL-12VT). Representante exclusivo no Brasil: Santiago e Cintra. Marca com forte penetração em
obras brasileiras, mas, como as demais, sem lista de preços pública. Fonte:
[encardio.com/geotechnical-products/data-loggers](https://www.encardio.com/geotechnical-products/data-loggers), acesso 13/07/2026.

<a id="ref6"></a>**RST Instruments** — fabricante canadense com dataloggers de corda vibrante de 1
a 40 canais (DT2011B, DT2040, DT2055B), descritos pelo próprio fabricante como "low cost" dentro do
segmento — mas sem valor numérico divulgado nas páginas de produto pesquisadas. Fonte:
[rstinstruments.com/product-category/instruments/data-loggers](https://rstinstruments.com/product-category/instruments/data-loggers/), acesso 13/07/2026.

<a id="ref7"></a>**Canary Systems + Measurand** — sistema MLSAA (turnkey) para automatizar até 5
sensores ShapeArray (Measurand) e outros instrumentos (corda vibrante, 4-20 mA, potenciômetros
lineares), alimentado por bateria 12V/50Ah + painel solar de 40W; já aplicado em monitoramento de
barragens/hidrelétricas (ex. Puerto Rico, Kentucky). Sem preço público. Fonte:
[canarysystems.com/products/hardware/mlsaa](https://canarysystems.com/products/hardware/mlsaa/), acesso 13/07/2026.

<a id="ref8"></a>**Mercado genérico/importado (Alibaba, Made-in-China)** — piezômetros de corda
vibrante avulsos (só o sensor, sem datalogger/telemetria/software) aparecem entre **US$ 59,90** (Made-in-China, unidade) e faixas de **US$ 300** (MOQ 10, Alibaba) até **US$ 980–8.500** para
especificações mais completas (aço inoxidável, temperatura integrada, IP68). Há também listagens
"pronta entrega" de US$ 25–35/unidade cuja procedência e certificação não podem ser verificadas
pela pesquisa — provável indicador de equipamento sem rastreabilidade/calibração adequada para uso
em barragem regulada. Fontes: [alibaba.com — vibrating wire piezometer](https://www.alibaba.com/showroom/vibrating-wire-piezometer.html), [made-in-china.com — Piezometer](https://www.made-in-china.com/products-search/hot-china-products/Piezometer.html), acesso 13/07/2026.

<a id="ref9"></a>**Referência histórica de custo de automação completa** — artigo técnico do 49º
Congresso Brasileiro do Concreto (IBRACON, 2007), sobre automação de medidores triortogonais em
barragem (não é piezômetro de corda vibrante, mas é o número mais concreto de "custo por
instrumento" encontrado em toda a pesquisa): projeto com **270 sensores** instalados, custo de
automação de **US$ 1.636,00 por instrumento** considerando só sensores + unidades de aquisição, e
**US$ 2.370,00 por instrumento** considerando todos os demais componentes (infraestrutura, software,
integração). **Atenção:** valor de 2007 — precisa de correção monetária/câmbio antes de citar como
comparação direta; e o instrumento (triortogonal) não é piezômetro. Fonte:
[dynamistechne.com — Alternativas para a automação dos medidores triortogonais](https://dynamistechne.com/wp-content/uploads/2018/07/2007-ibracon-alternativas-para-a-automacao-dos-medidores-triortogonais.pdf) (PDF), acesso 13/07/2026 (busca; conteúdo integral não pôde ser
verificado por bloqueio de acesso direto — recomenda-se reconfirmar antes da banca).

<a id="ref10"></a>**ThingSpeak / Ubidots** — plataformas IoT genéricas usáveis para telemetria de
qualquer sensor. ThingSpeak tem camada gratuita para uso não comercial (com limites de taxa de
envio); Ubidots cobra US$ 99/mês no plano "Professional" (gestão de usuários finais, alertas,
funções serverless, dashboards ilimitados), com planos Industrial/Enterprise sob consulta. Nenhuma
das duas nasce com o motor de alerta em 3 camadas (Normal/Atenção/Crítico) nem com compensação de
corda vibrante — teria que ser construído por cima, como este projeto fez sobre Cloudflare
Workers/D1. Fonte: [ubidots.com/pricing (pt)](https://pt.ubidots.com/pricing), acesso 13/07/2026.

---

## 4. Projetos acadêmicos e de baixo custo similares

- **ESPiezometer** (artigo publicado na ScienceDirect, periódico HardwareX/afim, 2026) —
  ferramenta de campo baseada em ESP32-C3, com comunicação RS485 Modbus, cálculo de nível d'água
  embarcado, correção de densidade por temperatura e integração via Bluetooth Low Energy com app
  Android para leitura em campo. É o achado acadêmico **mais próximo** do escopo deste projeto:
  open-source, ESP32, foco em nível d'água/poropressão. **Diferencial deste projeto**: o
  ESPiezometer, pelo resumo disponível, é uma ferramenta de instalação/validação pontual (leitura
  via BLE com um app), não um sistema de monitoramento contínuo com backend na nuvem, histórico em
  banco de dados, dashboard web público e motor de alertas automático multi-camada (Telegram +
  SMS) — que é o que este projeto entrega de ponta a ponta. Fonte:
  [sciencedirect.com/science/article/pii/S2468067226000337](https://www.sciencedirect.com/science/article/pii/S2468067226000337) (acesso 13/07/2026; conteúdo
  completo bloqueado por paywall/403 — resumo obtido via título/indexação, recomenda-se checagem
  direta antes de citar em detalhe no TCC).

- **TCCs brasileiros de monitoramento de reservatório/ETA/ETE com ESP32** (UFSC, IFMG-Formiga,
  UFAM, Multivix, UFOP) — usam ESP32/NodeMCU, sensores de nível (ultrassônico HC-SR04/JSN-SR04T),
  MQTT/HTTP, e em alguns casos dashboards web e alertas por Telegram/SMS/e-mail. Nenhum dos
  trabalhos revisados nesta busca é especificamente sobre **piezômetro em barragem** com os três
  elementos completos deste projeto: (a) motor de alertas em 3 camadas configurável por
  instalação, (b) store & forward para tolerar quedas de conectividade, e (c) publicação como
  stack aberta (worker + D1 + dashboard sem bundler, documentado). A monografia da UFOP
  ("SISTEMA DE MONITORAMENTO ONLINE DE BARRAGENS", 2019, já citada na Base de Conhecimento) é o
  trabalho brasileiro tematicamente mais próximo (barragens, não reservatório genérico) — vale
  revisão manual detalhada antes da banca, pois o acesso direto ao PDF foi bloqueado nesta
  pesquisa (HTTP 403). Fonte:
  [monografias.ufop.br — SistemaMonitoramentoOnline.pdf](https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf), acesso 13/07/2026.

- **GitHub / repositórios abertos** — a busca por "piezometer" no GitHub Topics retornou
  essencialmente **um único repositório público relevante** (`jzmejia/CR1000_Programs`), que são
  scripts para datalogger industrial Campbell Scientific CR1000 ler piezômetros Geokon 4500HD —
  ou seja, automação em cima de hardware industrial já caro, não uma alternativa de baixo custo.
  Buscas mais amplas por "dam monitoring IoT" trazem projetos de nível de reservatório genérico
  (ex. `BRoy777/DamWaterLevelMonitor_IOT`, ESP8266 + ThingSpeak), sem lógica de poropressão,
  alertas em camadas ou dashboard dedicado. **Achado relevante em si**: a escassez de projetos
  open-source específicos para piezômetro/poropressão de barragem no GitHub reforça que esse nicho
  específico (não "nível de reservatório genérico") está pouco coberto por soluções abertas.
  Fonte: [github.com/topics/piezometer](https://github.com/topics/piezometer), acesso 13/07/2026.

---

## 5. Síntese honesta

**O que os comerciais têm que este projeto não tem:**
- **Certificação e robustez de campo** — IP68 real, resistência a raios/surtos, décadas de
  operação comprovada em ambiente de barragem (todas as marcas da Camada 1).
- **Corda vibrante nativa** — o sensor padrão-ouro da engenharia geotécnica para poropressão;
  este projeto usa sensor de coluna d'água (ultrassônico/simulação) como *stand-in* — mede carga
  piezométrica aproximada, não a poropressão de uma camada selada com bentonita.
- **Redundância de energia** — exigida pela Resolução ANM 95/2022 para barragens de DPA alto;
  ausente no protótipo.
- **Suporte, garantia, cadeia de calibração rastreável** — parte do preço "sob consulta" das
  marcas industriais é justamente esse pacote de suporte que uma barragem de DPA alto não pode
  dispensar.

**O que este projeto tem que os comerciais não entregam nessa faixa de preço:**
- **Custo**: ~R$ 150–220 por ponto (protótipo) contra um mercado que não publica preço nenhum —
  e cujo único número concreto de "automação por instrumento" encontrado nesta pesquisa (IBRACON
  2007, ajustado por contexto) já estava na casa de **milhares de dólares por instrumento**, mesmo
  em 2007. Mesmo os sensores de corda vibrante avulsos (sem datalogger, sem telemetria, sem
  software) começam, no mercado genérico/importado, em dezenas de dólares e sobem rapidamente para
  a casa dos milhares conforme a especificação.
- **Stack aberta e documentada** — 7 módulos ES no Worker, D1/SQLite público, dashboard sem
  bundler, firmware comentado; nenhuma das oito soluções pesquisadas expõe arquitetura ou preço.
- **Alertas prontos de fábrica** — motor de 3 camadas (Normal/Atenção/Crítico) já configurado com
  Telegram + SMS Twilio e persistência de estado; nas plataformas genéricas (ThingSpeak/Ubidots)
  isso teria que ser construído do zero por cima da assinatura mensal.
- **Democratização deliberada**: nenhuma das camadas pesquisadas — nem a industrial (Camada 1),
  nem a IoT genérica paga (Camada 2, ex. Ubidots a US$ 99/mês) — endereça o caso de uso "milhares
  de estruturas pequenas, sem orçamento, sem instrumentação nenhuma hoje".

**Resposta atualizada ao "isso já existe?":** existe, sim, para quem pode pagar e perguntar o
preço — nenhum dos oito fabricantes/integradores pesquisados (Worldsensing, Geokon, Sisgeo,
Ackcio, Encardio-rite, RST, Canary Systems, mais os revendedores brasileiros) publica uma única
cifra; todos empurram para "fale com vendas". O único dado duro de custo de automação de
instrumentação de barragem encontrado na pesquisa — o artigo IBRACON de 2007 — fala em
US$ 1.636–2.370 **por instrumento**, quase vinte anos atrás, para um tipo de sensor diferente
(triortogonal, não corda vibrante). Sensores de corda vibrante avulsos no mercado genérico já
custam de dezenas a milhares de dólares **sem** datalogger, telemetria ou software — e isso é só
o sensor. Do outro lado, as plataformas IoT genéricas (ThingSpeak/Ubidots) resolvem conectividade
mas não vêm com nenhuma lógica de poropressão, alerta em camadas ou dashboard de barragem — quem
usar essas plataformas ainda precisa construir tudo isso, como este projeto construiu. Enquanto
isso, 28.043 barragens estão cadastradas no SNISB e só 6.210 enquadradas na PNSB (Base de
Conhecimento, Parte 3) — a esmagadora maioria segue sem automação nenhuma, porque a única opção
hoje visível no mercado é "sob consulta". Um protótipo funcional a R$ 150–220 por ponto, com
dashboard, histórico e alerta automático prontos, não substitui a Camada 1 para DPA alto — mas
prova que a lacuna entre "sob consulta" e "leitura manual" pode ser preenchida.

---

## Referências (URLs consultadas — acesso em 13/07/2026, salvo indicação contrária)

1. Worldsensing — Piconode · Compact Data Logger. https://www.worldsensing.com/product/piconode-data-acquisition/
2. GEOKON — Standard Piezometers (4500 Series). https://www.geokon.com/4500-Series
3. Sisgeo — WR LOG wireless dataloggers (descontinuado). https://sisgeo.com/products/discontinued/wr-log-wireless-dataloggers/
4. Ackcio — Wireless Monitoring Solutions For Mining. https://www.ackcio.com/industries/mining/
5. Encardio-rite — Geotechnical Data Logger System. https://www.encardio.com/geotechnical-products/data-loggers
6. RST Instruments — Precision Data Loggers for Geotechnical Sensors. https://rstinstruments.com/product-category/instruments/data-loggers/
7. Canary Systems — MLSAA (Measurand ShapeArray automation). https://canarysystems.com/products/hardware/mlsaa/
8. Alibaba — Vibrating Wire Piezometer showroom. https://www.alibaba.com/showroom/vibrating-wire-piezometer.html · Made-in-China — Piezometer products. https://www.made-in-china.com/products-search/hot-china-products/Piezometer.html
9. Dynamis Techne (host do PDF) — "Alternativas para a automação dos medidores triortogonais", 49º Congresso Brasileiro do Concreto, IBRACON, 2007. https://dynamistechne.com/wp-content/uploads/2018/07/2007-ibracon-alternativas-para-a-automacao-dos-medidores-triortogonais.pdf
10. Ubidots — Preços. https://pt.ubidots.com/pricing
11. ScienceDirect — "ESPiezometer: ESP32-based field tool for installation and validation of piezometric sensors for groundwater level monitoring". https://www.sciencedirect.com/science/article/pii/S2468067226000337 · PubMed (mesmo artigo). https://pubmed.ncbi.nlm.nih.gov/42027798/
12. UFOP — Monografia "Sistema de Monitoramento Online de Barragens" (2019). https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf
13. GitHub Topics — piezometer. https://github.com/topics/piezometer
14. GitHub — BRoy777/DamWaterLevelMonitor_IOT. https://github.com/BRoy777/DamWaterLevelMonitor_IOT
15. Painel de Preços (Governo Federal) — buscado, mas sem cotação específica de piezômetro localizada nesta pesquisa. https://paineldeprecos.pre.economia.gov.br/
16. ESS Earth Sciences — PW Series Vibrating Wire Piezometer (tentativa de acesso direto bloqueada por 403; preço citado apenas via resumo de busca, não verificado na fonte primária — **não usar sem reconfirmar**). https://www.essearth.com/product/pw-series-vibrating-wire-piezometer/
17. Valarm — Piezometer Monitoring blog (tentativa de acesso direto bloqueada por 403, não usado no corpo do documento). https://www.valarm.net/blog/piezometer-monitoring-monitoring-water-wells-levees-bridges-with-industrial-iot-sensors/

**Nota sobre falhas de acesso:** várias páginas (ESS Earth Sciences, Valarm, ackcio.com, o PDF do
IBRACON, a monografia da UFOP, o artigo ScienceDirect completo) retornaram **HTTP 403** ao
WebFetch direto nesta sessão — provavelmente bloqueio anti-bot dos servidores, não falha de rede
do ambiente. Nesses casos, as informações usadas no corpo do documento vieram apenas do resumo
gerado pela ferramenta de busca (WebSearch), e estão marcadas explicitamente como "não verificado
na fonte primária" onde relevante. Recomenda-se reabrir essas URLs manualmente (navegador comum)
antes de usar os números na banca.
