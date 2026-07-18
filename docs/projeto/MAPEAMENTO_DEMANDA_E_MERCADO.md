# 📐 Mapeamento da Demanda SAGA × Projeto × Mercado Real

**Demanda:** Monitoramento Online do Nível de Água em Piezômetros
**Empresa:** Samarco Mineração S.A. · **Escola:** SENAI Mariana CFP Dr. José Luciano Duarte Penido
**Vigência:** 16/12/2025 – 16/12/2027 · **Benefício declarado:** economia estimada de R$ 600.000/ano, dados em tempo real, aumento da segurança

Este documento decompõe a demanda em requisitos, mostra **como o mercado real resolve cada um** (com fontes) e mapeia o estado do nosso projeto contra essa prática — apontando as melhorias que dão autenticidade à solução.

---

## 1. A demanda decomposta em requisitos

Do texto oficial da demanda, extraem-se 8 requisitos:

| # | Requisito (texto da demanda) | Palavra-chave |
|---|------------------------------|---------------|
| R1 | "medição contínua do nível de água em piezômetros" | Sensor automático |
| R2 | "sensores automáticos" (substituir medição manual terceirizada) | Automação |
| R3 | "transmissão de dados em tempo real" (áreas remotas, difícil acesso) | Telemetria |
| R4 | "armazenamento seguro em plataforma digital" | Banco de dados |
| R5 | "visualização por painéis interativos" | Dashboard |
| R6 | "histórico de variações" | Série temporal |
| R7 | "alertas preventivos" | Notificação ativa |
| R8 | "apoiando a tomada de decisão e a gestão ambiental" + redução de risco às equipes | Gestão/segurança |

---

## 2. Como o mercado real faz (síntese da pesquisa)

### 2.1 Sensor (R1/R2)
- O padrão dominante em barragens de mineração é o **piezômetro de corda vibrante** (vibrating wire) — preciso, robusto e nativo para leitura remota. Fabricantes de referência: **Geokon série 4500**, Sisgeo, RocTest/3Geo, Encardio-Rite/Santiago e Cintra ([geokon.com/4500-Series](https://www.geokon.com/4500-Series); [sollosgeotecnica.com](https://www.sollosgeotecnica.com/piezometro-corda-vibrante)).
- Transdutores piezorresistivos **4–20 mA** são a alternativa secundária — e são exatamente o que um protótipo acessível consegue usar (~R$ 240 no varejo nacional; ver §4.2).

### 2.2 Aquisição e telemetria (R3)
- Dataloggers consagrados: **Campbell Scientific CR1000X**, **Geokon GeoNet**, **Sisgeo OMNIAlog** ([campbellsci.com/cr1000x](https://www.campbellsci.com/cr1000x)).
- Líder em monitoramento **sem fio** de barragens: **Worldsensing Loadsensing (LS-G6)**, rede **LoRa privada** em estrela, alcance até 15 km, leituras de 30 s a 24 h, alarmes por limiar. Caso real no Brasil: **uma mineradora com 22 barragens monitoradas por 467 dataloggers e 10 gateways** ([worldsensing.com/mining](https://www.worldsensing.com/mining/)).
- Meios de transmissão em mina: LoRa privado e rádio onde não há celular; 4G/NB-IoT onde há cobertura; satélite como contingência.

### 2.3 Centros de monitoramento (R5/R8)
- **Vale**: Centros de Monitoramento Geotécnico (Nova Lima, Itabira, Parauapebas) — mais de 100 barragens, ~3.000 sensores, 24/7, com radar e IA ([revistaminerios.com.br](https://revistaminerios.com.br/barragens-inteligentes-monitoramento-ia-big-data/)).
- **A própria Samarco**: **Centro de Monitoramento e Inspeção (CMI)** em Germano/Mariana — **mais de 2.000 instrumentos**, ~1.500 transmitindo em tempo real, operação 24/7 ([ibram.org.br](https://ibram.org.br/noticia/saiba-mais-sobre-o-centro-de-monitoramento-e-inspecao-cmi-da-samarco/)) + radares GroundProbe ([groundprobe.com](https://www.groundprobe.com/risk-reduction-strategy-incorporating-tailings-dam-monitoring/)).
- **Argumento para a banca:** nosso dashboard + motor de alertas é um **"mini-CMI"** — a mesma arquitetura conceitual do centro que a Samarco opera em Germano, em escala didática.

### 2.4 Software e regulação (R4/R7/R8)
- Plataforma comercial típica de instrumentação: **Vista Data Vision** (Bentley) ([bentley.com](https://www.bentley.com/software/vista-data-vision/)).
- **Resolução ANM nº 95/2022**: para barragens de **DPA Alto**, o monitoramento automatizado de instrumentação em tempo real e período integral é **obrigação legal**, com **redundância de energia** e Centro de Monitoramento dedicado; vídeo-monitoramento 24 h com retenção de 90 dias ([Resolução 95/2022 — PDF oficial](https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf)).
- **SIGBM/ANM**: cadastro obrigatório e declarações semestrais (DCE/DCO, campanhas de março e setembro) ([gov.br/anm](https://www.gov.br/anm/pt-br/assuntos/barragens/dce-e-dco)).
- **Lei 14.066/2020** (pós-Brumadinho): PAEBM com sirenes de acionamento automatizado e ZAS (Zona de Autossalvamento) ([planalto.gov.br](http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14066.htm)).

### 2.5 Níveis de alerta oficiais — ajuste de nomenclatura importante
- Os limiares de cada instrumento (**níveis de controle**: normal, atenção, alerta) são definidos pelo **projetista geotécnico** em análises de percolação/estabilidade — a chamada **carta de risco** ([monografia UFOP](https://www.monografias.ufop.br/handle/35400000/7049)). É exatamente o que nossos limiares configuráveis (`NIVEL_ATENCAO`/`NIVEL_CRITICO`) representam.
- Os **Níveis de Emergência NE1/NE2/NE3** do PAEBM são **declarações formais** à ANM/Defesa Civil (NE3 = ruptura inevitável/em curso → evacuação da ZAS). **O software não declara NE** — ele fornece o dado que subsidia a decisão do responsável técnico. O TCC deve deixar esse limite claro: `Normal/Atenção/Crítico` do dashboard = níveis de controle internos; a declaração de NE é humana.
- Nota: a Resolução ANM 220/2025 propõe o termo "Nível de Segurança" no lugar de "Nível de Emergência" ([cesconbarrieu.com.br](https://cesconbarrieu.com.br/anm-publica-resolucao-no-220-2025-e-atualiza-regras-de-seguranca-de-barragens-de-mineracao/)).

### 2.6 Normas técnicas
- **NBR 17189** — instrumentação com piezômetros ([ltec.eng.br](https://ltec.eng.br/instrumentacao-em-barragens-piezometros-nbr-17189/)); NBR 13028:2017 (histórica; cancelada em 12/2025); **ICOLD Bulletin 158** (Dam Surveillance Guide) como referência internacional.

---

## 3. Mapeamento: requisito → nosso projeto → mercado → gap

| Req. | Nosso projeto hoje | Mercado real | Gap / melhoria de autenticidade |
|------|--------------------|--------------|--------------------------------|
| R1 Sensor | BMP180 (stand-in barométrico) convertido em nível simulado | Corda vibrante (Geokon 4500) ou transdutor 4–20 mA | 🔶 **Fase física:** transdutor 4–20 mA (~R$ 240) + ADS1115 + shunt 150 Ω — mesmo princípio do industrial |
| R2 Automação | Leitura a cada 1 s, envio a cada 10 s, sem intervenção humana | Leituras de 30 s a 24 h (Loadsensing) | ✅ Atendido (nosso intervalo é até mais denso que o usual) |
| R3 Telemetria | WiFi (Wokwi) → HTTPS `/ingest` com **store & forward** | LoRa privado (Worldsensing), 4G/NB-IoT | 🔶 Wokwi **não simula LoRa** ([issue #344](https://github.com/wokwi/wokwi-features/issues/344)) → manter WiFi na simulação e documentar LoRa (Heltec ESP32-LoRa) para o hardware real |
| R4 Armazenamento | InfluxDB Cloud via servidor próprio (token fora do firmware) | Historiadores/plataformas (Vista Data Vision) | ✅ Atendido em escala didática |
| R5 Dashboard | Painel próprio (nível, limiares, eventos, 24 h) | Centros de monitoramento 24/7 (CMI Samarco) | ✅ Conceito de "mini-CMI"; 🔶 evoluir para **múltiplos piezômetros** (PZ-01, PZ-02…) |
| R6 Histórico | 24 h com agregação de 30 min | Anos de série histórica | 🔶 Documentar retenção maior como evolução (bucket com retenção estendida) |
| R7 Alertas | Telegram/SMS nas transições + anti-spam + repetição do crítico | Alarmes por limiar + sirenes PAEBM na ZAS | ✅ Alinhado; 🔶 renomear conceito: limiares = **níveis de controle da carta de risco**; deixar claro que NE1/NE2/NE3 é decisão humana |
| R8 Gestão/segurança | Elimina deslocamento a campo (objetivo central da demanda) | Res. ANM 95/2022 **obriga** automação p/ DPA Alto | ✅ Forte: a demanda não é só economia — é **conformidade legal** |

---

## 4. Roadmap de autenticidade (recomendações priorizadas)

### 4.1 Sem custo — só código/documentação (dá para fazer já)
1. **Múltiplos piezômetros**: enviar `piezometro=PZ-01` como *tag* no dado e permitir seleção no dashboard — nenhum sistema real monitora um único instrumento (o CMI da Samarco tem 2.000+).
2. **Nomenclatura da carta de risco**: descrever os limiares como "níveis de controle definidos pelo projetista geotécnico por instrumento" (já são configuráveis por variável de ambiente — só falta contar essa história).
3. **Cota piezométrica**: exibir o nível também como **cota (m)** em relação a um referencial de projeto (ex.: cota da crista), como nos relatórios geotécnicos reais.
4. **Citar a Res. ANM 95/2022 na justificativa**: automação de DPA Alto é obrigação legal — transforma o projeto de "melhoria" em "requisito regulatório".

### 4.2 Baixo custo — protótipo físico (R$ 300–500)
5. **Substituir o BMP180 por transdutor de pressão 4–20 mA** (~R$ 240; ex. [Descomplica](https://www.descomplicasolucoes.com.br/MLB-2865733954-transdutor-de-presso-0-10-bar-4-20ma-tenso-1224vdc-g14-_JM)) lido por **ADS1115 + shunt 150 Ω** ([guia de circuito](https://zbotic.in/industrial-4-20ma-sensor-interface-with-arduino-and-esp32/)) — é o **mesmo princípio físico** do piezômetro industrial, num tubo com água para demonstração ao vivo. 150 Ω é a decisão fechada do projeto (ver `PROJETO_INDUSTRIAL.md` §10, item 1): a 20 mA, 150 Ω × 20 mA = 3,0 V, mantendo a tensão no fundo de escala dentro da faixa do ADS1115 (3,3 V) com margem.
   Alternativa mais barata: **JSN-SR04T** ultrassônico (mede de cima, não submerge).
6. **Energia solar + deep sleep**: projeto de referência atinge 12 µA e ~1 ano de bateria ([grillbaer/esp32-lora-water-level-meter](https://github.com/grillbaer/esp32-lora-water-level-meter)) — responde à pergunta certa da banca ("e onde não tem tomada?").

### 4.3 Evolução — comunicação de campo
7. **LoRa ponto-a-ponto** com 2 placas Heltec ESP32-LoRa (nó no "piezômetro" → gateway com internet): espelha a arquitetura Worldsensing usada nas barragens reais. No Wokwi, continuar com WiFi (LoRa não é simulável).
8. **NB-IoT/CAT-M** (SIM7070G, homologado Anatel) como alternativa onde há cobertura celular — já citado no documento AquaSense.

### 4.4 Referências acadêmicas para a fundamentação do TCC
- Monografia UFOP — Sistema de Monitoramento Online de Barragens ([PDF](https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf))
- Monografia UFOP — Definição dos níveis de controle de piezômetros ([link](https://www.monografias.ufop.br/handle/35400000/7049))
- Paper UFVJM/IJGET — Water Reservoir Level Monitoring Using an ESP32 Board ([link](https://revistas.ufvjm.edu.br/index.php/ijget/en/article/view/545))
- IEEE — IoT-Enabled Wireless Sensor Network for Dam Safety Management ([link](https://ieeexplore.ieee.org/abstract/document/11011121/))
- ICOLD Bulletin 158 — Dam Surveillance Guide

---

## 5. Comparação econômica (argumento do ROI)

- Solução comercial completa (sensor corda vibrante + datalogger + telemetria + instalação): preços **apenas sob cotação** (Geokon, Sisgeo, 3Geo, Santiago e Cintra); única referência aberta encontrada: ~US$ 2.750 por datalogger avulso. Para o TCC, **solicitar cotação formal** a um integrador (Ground Instrumentação, Damasco Penna) dá credibilidade ao número.
- Nossa solução: ~R$ 300–500/nó em protótipo; estimativa da proposta técnica: R$ 2.965/unidade industrial (50 unidades = R$ 260 mil, payback 5,8 meses vs. economia declarada na demanda de **R$ 600 mil/ano**).
- **Honestidade técnica que valoriza o TCC:** a solução própria não substitui a instrumentação certificada de uma barragem DPA Alto (responsabilidade legal exige equipamento qualificado); ela democratiza o monitoramento para estruturas menores, poços e áreas sem automação, e demonstra domínio da tecnologia (sem "caixa-preta" de fornecedor).

---

*Documento gerado a partir de pesquisa de mercado/regulatória realizada em 09/07/2026, com fontes citadas em cada afirmação. Para o texto completo das pesquisas, ver histórico do projeto.*
