# Base de Conhecimento — Piezômetros, Barragens e Mercados de Aplicação

> Documento-fonte do projeto (TCC / desafio SAGA Samarco). Todo o restante — texto do TCC,
> slides, vídeo pitch — deve derivar daqui. Cada seção traz as fontes usadas; ao citar no
> TCC, prefira sempre a fonte primária (lei, norma, relatório oficial) indicada.

---

## O fio condutor (use isto como espinha dorsal do TCC, dos slides e do pitch)

1. O piezômetro mede **poropressão** (pressão da água nos poros do solo), não apenas "nível de água".
2. Pelo **princípio das tensões efetivas de Terzaghi** (σ' = σ − u), poropressão alta significa
   tensão efetiva baixa → resistência baixa → risco de ruptura por **liquefação**.
3. Foi exatamente esse mecanismo que rompeu **Fundão (Mariana, 2015)** e **B1 (Brumadinho, 2019)**
   — e os relatórios oficiais dos dois casos apontam **linha freática alta sem rebaixamento efetivo**
   e **auscultação deficiente** entre as causas.
4. Por isso a legislação pós-desastres (**Lei 14.066/2020**, **Resolução ANM 95/2022**) passou a
   exigir monitoramento **automatizado, em tempo real e período integral** para barragens de DPA alto.
5. Mas a automação profissional (corda vibrante + datalogger + telemetria industrial) custa caro e
   tem preço opaco ("sob consulta") — então **tudo que não é DPA alto continua sendo lido à mão**:
   milhares de barragens pequenas, açudes, aterros, encostas.
6. O protótipo (ESP32 + sensor + Cloudflare Worker/D1 + dashboard + alertas Telegram/SMS + store &
   forward) ataca exatamente essa lacuna: **democratiza o conceito do centro de monitoramento**
   para a camada não automatizada, por poucas centenas de reais por ponto.

⚠️ **Cuidado de terminologia no TCC**: piezômetro ≠ INA (indicador de nível d'água). O piezômetro
mede a pressão de uma camada específica (bulbo selado com bentonita); o INA mede o nível freático
geral. O protótipo, ao medir coluna d'água, aproxima-se da **carga piezométrica** (pressão convertida
em metros de coluna d'água). Usar os termos com precisão evita a crítica mais fácil da banca.

---

# PARTE 1 — PIEZÔMETROS

## 1.1 O que é um piezômetro e o que ele realmente mede

Um **piezômetro** é um instrumento geotécnico instalado no maciço de solo (barragem, fundação ou
talude) para medir a **poropressão** — também chamada de **pressão neutra** ou **pressão
intersticial** — que é a pressão exercida pela água que preenche os vazios (poros) entre as
partículas do solo. Diferente de uma régua que mede "quanto de água tem", o piezômetro mede a
**pressão** da água naquele ponto específico do maciço.

A água nos poros do solo não está livre como em um lago — ela está sob pressão, sustentando parte
do peso que atua sobre o solo. Quando essa pressão sobe, o comportamento mecânico do solo muda.

**Poropressão vs. carga piezométrica (nível d'água):** a poropressão (u) é medida em unidade de
pressão (kPa, kgf/cm²). A **carga piezométrica** é essa mesma pressão convertida em altura de coluna
d'água equivalente acima do ponto de medição — normalmente expressa em metros. A relação é direta:
u = γw × h. Em um piezômetro de tubo aberto, a água sobe dentro do tubo até a cota que representa
fisicamente essa carga.

**Piezômetro × INA (Indicador de Nível d'Água):**

- O **piezômetro** (ex.: Casagrande) tem seção filtrante curta e localizada (o "bulbo"), **selada
  com bentonita** para isolar uma camada específica. Mede a poropressão **daquela camada exata**.
- O **INA** é construtivamente parecido, mas com filtro longo e sem o mesmo selo — mede o **nível
  freático geral** (lençol freático livre).

O INA responde "onde está a superfície livre da água?"; o piezômetro responde "qual é a pressão da
água numa camada específica?". Em solos estratificados essas respostas podem ser bem diferentes.

Fontes: [Damasco Penna](https://damascopenna.com.br/piezometros/) ·
[Geothra — Casagrande](https://geothra.com.br/instrumentacao-geotecnica/piezometro-casagrande/) ·
[LTEC — NBR 17189 piezômetros](https://ltec.eng.br/instrumentacao-em-barragens-piezometros-nbr-17189/) ·
[LTEC — INAs](https://ltec.eng.br/indicadores-de-nivel-dagua-niveis-freaticos-nbr-17189/) ·
[CEFET-MG — pressão neutra em barragens](https://www.eng-minas.araxa.cefetmg.br/wp-content/uploads/sites/170/2023/05/Mensura%C3%A7%C3%A3o-e-avalia%C3%A7%C3%A3o-da-press%C3%A3o-neutra-em-barragens-um-estudo-de-caso.pdf)

## 1.2 Por que isso importa: o princípio das tensões efetivas (Terzaghi, 1925)

Num solo saturado, a tensão total (σ) que atua em qualquer plano do maciço se divide em duas
parcelas:

**σ' = σ − u**

- **σ (tensão total)**: gerada pelo peso do solo, da água e de cargas externas acima do ponto.
- **u (poropressão)**: a pressão da água nos poros — o que o piezômetro mede.
- **σ' (tensão efetiva)**: a parcela transmitida **grão a grão**, pelo contato entre as partículas.

A resistência ao cisalhamento do solo depende do atrito entre os grãos — que só existe onde há
contato grão a grão, ou seja, depende da **tensão efetiva** (Mohr-Coulomb: τ = c' + σ'·tan φ').

**Consequência prática:** se σ permanece constante mas u sobe, σ' cai — e com ela a resistência.
O solo não mudou de lugar; ele perdeu a capacidade de se segurar internamente porque a água
"empurrou" as partículas para longe umas das outras.

**Liquefação:** em materiais fofos, saturados e mal drenados — típico de rejeitos de mineração —
um carregamento rápido pode elevar u até próximo de σ. A tensão efetiva tende a zero, a resistência
tende a zero, e o material passa a se comportar como um líquido denso. É a **liquefação estática**,
mecanismo central nas rupturas de Fundão (2015) e B1 (2019). Por isso o monitoramento contínuo de
poropressão é o sinal de alerta mais direto de que a margem de segurança está sendo corroída "por
dentro", muitas vezes sem nenhum sinal visível na superfície.

Fontes: [PUC Goiás — tensões no solo](https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/17430/material/PUC_GEOI_07_Cap5_Tens%C3%B5es%20no%20solo.pdf) ·
[Liquefação em Brumadinho](https://www.kurtamann.com.br/blog/2019/02/04/entendendo-a-liquefacao-na-barragem-de-rejeitos-de-brumadinho/) ·
[Conjur — causa do rompimento](https://www.conjur.com.br/2021-out-04/relatorio-aponta-causa-rompimento-barragem-brumadinho/) ·
[Agência Brasil — deformações](https://agenciabrasil.ebc.com.br/geral/noticia/2019-12/brumadinho-combinacao-entre-deformacoes-causou-rompimento-da-barragem)

## 1.3 Tipos de piezômetro

| Tipo | Como funciona | Prós | Contras | Uso |
|---|---|---|---|---|
| **Casagrande** (tubo aberto) | Tubo de PVC com bulbo filtrante selado com bentonita; água sobe até a cota da carga piezométrica; leitura manual com pio elétrico | Simples, barato, confiável, sem eletrônica, referência para aferir os demais | Leitura manual, resposta lenta em argilas, custo operacional de campo | Padrão de instalação inicial e "testemunha" dos automatizados |
| **Corda vibrante** (vibrating wire) | Diafragma deforma sob pressão; fio de aço tensionado muda a frequência natural de vibração; sinal em frequência via cabo | Alta precisão, sinal robusto a ruído/cabos longos, integração madura com dataloggers | Custo, sensível a temperatura (compensação embutida), eletrônica exposta a raios/umidade | **Padrão de mercado para automação de barragens** |
| **Pneumático** | Gás (N₂) pressurizado até equilibrar o diafragma; pressão de equilíbrio = poropressão | Sem eletrônica no ponto de medição, durável em ambiente agressivo | Leitura com painel dedicado, difícil de automatizar continuamente | Ambientes agressivos |
| **Hidráulico** | Tubos com água desaerada até manômetro em superfície | Robusto, simples | Purga periódica de bolhas, distância limitada, pouco usado em obras novas | Legado |
| **Elétrico resistivo** (strain gauge) | Extensômetros no diafragma; variação de resistência → pressão | Resposta rápida | Degrada com umidade/corrosão, ruído em cabos longos | Perdeu espaço para corda vibrante |
| **Fibra óptica** (FBG) | Rede de Bragg na fibra; deformação altera o comprimento de onda refletido | Imune a interferência/raios, longas distâncias, vários sensores por fibra | Interrogador óptico caro, mão de obra especializada | Fronteira tecnológica — citar como "próximo passo" |

Fontes: [Geothra — corda vibrante](https://geothra.com.br/instrumentacao-geotecnica/piezometro-de-corda-vibrante/) ·
[SENTNEL](https://www.sentnel.com.br/post/piez%C3%B4metros) ·
[UFU — instrumentação de barragens de terra](https://repositorio.ufu.br/bitstream/123456789/28051/4/EstudoSobreInstrumenta%C3%A7%C3%A3o.pdf) ·
[Revista Minérios — sensores IoT](https://revistaminerios.com.br/sensores-iot-monitorar-barragens-mineracao/) ·
[AtGrating — FBG](https://pt.atgrating.com/fbg-in-civil-engineering-structure.html)

## 1.4 Instalação e leitura

**Instalação típica (furo de sondagem):** fura-se até a camada de interesse → instala-se o bulbo →
envolve-se com areia filtrante → sela-se acima com **bentonita** (expande ao hidratar e isola a
camada) → preenche-se o restante com calda de cimento-bentonita. Em barragens de rejeito, também
podem ser embutidos durante os alteamentos.

**Leitura manual:** com o **pio elétrico** — sonda em fita graduada que apita ao tocar a água dentro
do tubo; a profundidade lida vira cota/carga piezométrica. Em piezômetros elétricos, com leitor
portátil (readout) conectado ao cabo.

**Frequência típica de leituras manuais:** maior durante construção e primeiro enchimento; em
operação estabilizada, leituras semanais a mensais são comuns (variando com CRI/DPA); a frequência
**deve aumentar** quando uma leitura sai do padrão — exigência regulatória, não só boa prática.

**O que muda com automação:** leitura contínua, eliminação do deslocamento de equipe, redução de
erro humano, alarmes automáticos ao ultrapassar níveis de controle e séries temporais ricas. É esse
salto — de leitura manual esparsa para monitoramento contínuo — que o protótipo materializa.

Fontes: [FX Sondagens](https://www.fxsondagens.com.br/instalacao-de-piezometros) ·
[Geo Coring](https://geocoring.com.br/instrumentacao-geotecnica-hidraulica-instalacao-e-leitura/) ·
[UFOP — monitoramento online](https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf)

## 1.5 Interpretação: níveis de controle

Causas típicas de elevação de poropressão: chuvas intensas, elevação do reservatório, obstrução da
drenagem interna, alteamento/deposição rápida, vibrações.

Patamares usados na regulação de barragens de mineração:

- **Normal** — leituras dentro do comportamento histórico/esperado.
- **Atenção** — valor de controle ultrapassado: aumenta-se a frequência de leitura e investiga-se.
- **Alerta / emergência** — condição que pode evoluir para ruptura: aciona-se o PAEBM.

A **Resolução ANM 220/2025** atualizou a nomenclatura ("Níveis de Emergência" → "Níveis de
Segurança", reservando "Emergência" ao estágio mais crítico).

**Ponto importante para o protótipo:** os valores-limite de cada instrumento são definidos **caso a
caso pelo projetista geotécnico** (análises de estabilidade, perfil do material, histórico da
estrutura). Não existe "valor mágico" universal — por isso os limiares do sistema
(`NIVEL_ATENCAO`/`NIVEL_CRITICO`) são **parametrizáveis por configuração**, refletindo os valores de
projeto de cada instalação. Isso já está implementado e deve ser destacado na banca.

Fontes: [Manual de Segurança e Inspeção de Barragens — ANA](https://www.ana.gov.br/arquivos/cadastros/barragens/inspecao/ManualdeSegurancaeInspecaodeBarragens.pdf) ·
[Resolução ANM 95/2022](https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf) ·
[Resolução ANM 220/2025 — via MPF](https://www.mpf.mp.br/o-mpf/unidades/procuradoria-geral-da-republica-pgr/noticias/resolucao-da-anm-sobre-seguranca-de-barragens-incorpora-sugestoes-apresentadas-pelo-mpf-e-pelo-mpt/resoluoanm220-2025seguranadebarragens-pdf-bdecc2a7)

## 1.6 Normas e referências para citar

- **ABNT NBR 17189** — Instrumentação em barragens – Requisitos (verificar versão vigente na ABNT
  antes de citar — há registro de versão de 2024 cancelada).
- **ABNT NBR 17188** — Barragens – Ruptura hipotética – Diretrizes.
- **Manual de Segurança e Inspeção de Barragens (ANA)**.
- **Resoluções ANM 95/2022 e 220/2025** (barragens de mineração).
- **Manual do Empreendedor (SNISB/ANA), Volume IV — PAE**.
- **Boletins ICOLD** e publicações do **CBDB** (Revista Brasileira de Engenharia de Barragens).

---

# PARTE 2 — BARRAGENS

## 2.1 Tipos e métodos construtivos

**Barragens de água** (abastecimento, hidrelétricas, irrigação) armazenam água e costumam ter
projeto e controle rigorosos desde a concepção. **Barragens de rejeitos** armazenam o resíduo do
beneficiamento do minério e são alteadas ao longo de décadas, muitas vezes usando o próprio rejeito
como material — estruturas geotecnicamente mais complexas e heterogêneas.

Métodos de alteamento:

| Método | Como funciona | Característica |
|---|---|---|
| **A montante** | Novo alteamento apoiado sobre o próprio rejeito depositado | Mais barato e **mais perigoso**: apoia-se em material fofo, saturado, mal consolidado — alto potencial de liquefação. Método de Fundão e B1 |
| **A jusante** | Alteamento para fora, sobre fundação compactada | Mais seguro; exige mais material e área |
| **Linha de centro** | Crescimento vertical, intermediário | Estabilidade intermediária |

**Banimento no Brasil:** a Lei 14.066/2020 e a Resolução ANM 95/2022 **proíbem** construção e
alteamento a montante, com prazo de descaracterização (25/02/2022, prorrogável mediante
justificativa técnica). Início de 2025: 52 barragens a montante remanescentes no país, 32 em MG;
14 em obras de descaracterização em MG. Custo setorial estimado da descaracterização: R$ 36 bilhões.

Fontes: [Resolução ANM 95/2022](https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf) ·
[FEAM — descaracterização em MG](https://feam.br/w/minas-avanca-na-descaracterizacao-das-barragens-alteadas-a-montante) ·
[Diário do Comércio](https://diariodocomercio.com.br/economia/minas-gerais-14-barragens-obras-descaracterizacao/) ·
[Agência iNFRA — R$ 36 bi](https://agenciainfra.com/blog/descaracterizacao-de-barragens-custara-r-36-bilhoes-a-mineradoras/)

## 2.2 Os dois desastres de referência

### Fundão — Mariana/MG (Samarco), 5 de novembro de 2015

- **19 mortos**; ~45 milhões de m³ de rejeitos liberados (de ~55 milhões armazenados).
- A lama percorreu o rio Gualaxo do Norte → rio do Carmo → **rio Doce**, chegando ao litoral do
  Espírito Santo ~16 dias depois (~600 km, variando conforme o trecho medido).
- **Causa:** barragem a montante; relatórios (painel Cleary Gottlieb; MP-MG) apontam falhas desde a
  construção (2007), agravadas por modificações em 2013, culminando em **liquefação**.
- **Lição de monitoramento:** deficiências de drenagem e projeto conhecidas de longa data não
  geraram ação corretiva — instrumentação precisa gerar **resposta**, não apenas registro.

### B1 — Brumadinho/MG (Vale), 25 de janeiro de 2019

- **270 mortos** (balanço oficial consolidado).
- **Mecanismo:** liquefação estática de rejeito fofo, contrátil, saturado e mal drenado.
- **Gatilho apontado pela perícia:** perfuração para instalar piezômetros multiníveis (Fugro/TÜV SÜD),
  com circulação de água que gerou sobrepressão — ironicamente, a tentativa de melhorar a
  instrumentação foi apontada como desencadeante.
- **O que a instrumentação indicava:** o relatório do MTE lista entre as causas: **demora no
  rebaixamento efetivo da linha freática**, drenagem interna insuficiente e mal conservada,
  anomalias recorrentes não tratadas e **auscultação deficiente (piezômetros e inclinômetros)**.
  Havia monitoramento — mas insuficiente e sem resposta a tempo.

Fontes: [Relatório MTE — análise do acidente (PDF)](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/acidentes-de-trabalho-informacoes-1/relatorio_analise_acidentes_brumadinho.pdf) ·
[Agência Pública — laudo da PF](https://apublica.org/2021/09/revelamos-o-que-diz-o-laudo-sigiloso-da-pf-sobre-a-tragedia-em-brumadinho/) ·
[Agência Brasil — MP sobre Fundão](https://agenciabrasil.ebc.com.br/geral/noticia/2016-06/tragedia-em-mariana-foi-causada-por-obras-em-barragem-da-samarco-diz-mp) ·
[Ibama — documentos Fundão](https://www.ibama.gov.br/recuperacao-ambiental/rompimento-da-barragem-de-fundao-desastre-da-samarco/documentos-relacionados-ao-desastre-da-samarco-em-mariana-mg)

## 2.3 Legislação

| Norma | O que estabelece |
|---|---|
| **Lei 12.334/2010** (PNSB) | Política original: classificação CRI × DPA, Plano de Segurança (PSB), SNISB |
| **Lei 14.066/2020** (pós-Brumadinho) | Proíbe método a montante; mapa de inundação obrigatório; PSB operacional até a descaracterização; multas de R$ 2 mil a **R$ 1 bilhão** |
| **Resolução ANM 95/2022** | Consolidação: **monitoramento automatizado em tempo real e período integral obrigatório para DPA alto** (com redundância de energia); PAEBM; ZAS/ZSS; sirenes automáticas |
| **Resolução ANM 220/2025** | Atualiza a 95/2022 (nomenclatura de níveis, ajustes à Lei 14.514/2022) |

Conceitos: **CRI** (Categoria de Risco — estado técnico da barragem) × **DPA** (Dano Potencial
Associado — o que acontece a jusante se romper); **ZAS** (Zona de Autossalvamento — alerta por
sirenes é responsabilidade do empreendedor, ≤ 30 min/~10 km da onda); **ZSS** (Zona de Segurança
Secundária); **SIGBM/CNBM** (cadastro e painel público da ANM — citar com data de consulta).

Fontes: [Lei 14.066/2020 — Planalto](http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14066.htm) ·
[Senado Notícias](https://www12.senado.leg.br/noticias/materias/2020/10/01/brasil-tem-nova-lei-de-seguranca-de-barragens) ·
[SIGBM Público](https://sigbm.anm.gov.br/Publico) ·
[SNISB — classificações](https://www.snisb.gov.br/entenda-as-classificacoes/)

## 2.4 Números do setor (2025 — sempre citar a data de consulta)

- ~**101 barragens** de mineração em alerta ou emergência (boletim ANM, fev/2025).
- RSB 2024/2025 (ANA): **241 barragens prioritárias** e 213 em situação crítica/desfavorável.
- **52 barragens a montante** remanescentes no país (32 em MG), início de 2025.
- SNISB: **28.043 barragens cadastradas** no Brasil; só **6.210 enquadradas na PNSB** — a maioria
  das pequenas barragens não tem fiscalização plena nem instrumentação.

Fontes: [Boletim ANM fev/2025](https://www.gov.br/anm/pt-br/assuntos/barragens/boletim-de-barragens-de-mineracao/boletim-mensal-fevereiro-2025.pdf) ·
[ANA — RSB 2024/2025](https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/rsb-2024-2025-indica-241-barragens-prioritarias-que-necessitam-de-maior-atencao-em-termos-de-seguranca-em-23-estados-e-no-distrito-federal) ·
[SNISB — relatório anual](https://www.snirh.gov.br/portal/snisb/relatorio-anual-de-seguranca-de-barragem)

## 2.5 A instrumentação completa de uma barragem (onde o piezômetro se encaixa)

| Instrumento | O que mede | Papel |
|---|---|---|
| **Piezômetro** | Poropressão/nível d'água no maciço | Indicador central de linha freática e risco de liquefação/piping |
| **INA** | Nível freático em poços de observação | Complementa o piezômetro |
| **Marcos superficiais** | Deslocamentos na superfície (topografia) | Movimentação do maciço |
| **Inclinômetros** | Deformações em profundidade | Planos de ruptura internos antes de aparecerem na superfície |
| **Medidores de vazão de percolação** | Água nos drenos | Variação anormal = piping ou colmatação |
| **Réguas/sensores de nível** | Nível do reservatório | Borda livre e volume |
| **Acelerômetros/sismógrafos** | Vibrações | Gatilho de liquefação |
| **Radar (InSAR)** | Deslocamento de superfície em área | Complementar, sem contato |
| **Câmeras** | Inspeção visual remota | Trincas, surgências, erosões |

O protótipo cobre a variável **mais diretamente ligada aos dois desastres** (linha
freática/poropressão) — e a arquitetura multi-instrumento já aceita expandir para outros sensores.

## 2.6 Conceitos-chave (glossário para o TCC)

- **Percolação** — movimento da água pelos poros do maciço, de montante a jusante. Normal; o
  problema é quando é descontrolada.
- **Linha freática** — fronteira entre a zona saturada e a não saturada dentro do maciço. Quanto
  mais alta, menor a estabilidade.
- **Surgência** — água aflorando no talude de jusante, onde não deveria. Alerta visual clássico.
- **Piping (erosão interna)** — a água percolante arrasta partículas e forma "tubos" internos que
  crescem até o colapso.
- **Liquefação** — solo/rejeito saturado e fofo perde subitamente a resistência e flui como líquido.
- **Fator de segurança (FS)** — razão entre forças resistentes e atuantes; FS ≈ 1 = risco iminente.
- **Borda livre (freeboard)** — distância vertical entre o nível do reservatório e a crista.

---

# PARTE 3 — ONDE MAIS O SISTEMA SE APLICA (mercados adjacentes)

O sistema resolve um problema genérico: **medir remotamente coluna de líquido/poropressão em local
remoto, com alerta automático, por uma fração do custo da telemetria industrial (R$ 5–20 mil/ponto)**.
Esse problema se repete em pelo menos seis domínios:

## 3.1 Encostas e deslizamentos urbanos
- **Usuário:** prefeituras/defesa civil, CEMADEN. **2.095 municípios** em áreas de risco; cobertura
  atual apoiada em pluviômetros (só medem chuva, não a poropressão no talude).
- **Caso de referência:** Petrópolis 2022 (**241 mortos**) — alerta existiu, mas genérico.
- **O que o sistema agrega:** dado geotécnico direto (poropressão no talude) barato o bastante para
  rede densa. Base legal: Lei 12.608/2012.
- Fontes: [CEMADEN — expansão](https://www.gov.br/cemaden/pt-br/assuntos/noticias-cemaden/cemaden-expande-rede-de-monitoramento-e-passa-a-monitorar-1-295-municipios) ·
  [DRM-RJ — Petrópolis](https://www.rj.gov.br/drm/sites/default/files/arquivos_paginas/RL_09.2022.01-MTDLG-PETROPOLIS.pdf)

## 3.2 Barragens de água pequenas e açudes ⭐ (1º no ranking para o pitch)
- **28.043 barragens cadastradas, só 6.210 na PNSB**; DNOCS administra 328 barragens no semiárido
  com monitoramento majoritariamente visual/manual. Os manuais da ANA reconhecem que pequenas
  barragens "não geradoras de receita" não conseguem pagar instrumentação automatizada.
- É o domínio **tecnicamente idêntico** ao projeto original — reaproveitamento quase sem adaptação.
- Fontes: [RSB 2024/2025](https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/rsb-2024-2025-indica-241-barragens-prioritarias-que-necessitam-de-maior-atencao-em-termos-de-seguranca-em-23-estados-e-no-distrito-federal) ·
  [Manual de pequenas barragens — ANA](https://www.snirh.gov.br/portal/snisb/Entenda_Mais/publicacoes/ArquivosPNSB_Docs_Estruturantes/produto-10-manual-de-seguranca-de-pequenas-barragens.pdf) ·
  [DNOCS](https://www.gov.br/dnocs/pt-br/assuntos/vem-conhecer/vem-conhecer-o-trabalho-do-dnocs-na-seguranca-de-barragem)

## 3.3 Aterros sanitários ⭐ (2º no ranking)
- ~**700 aterros regulares** no Brasil, cada um com 5–15 piezômetros de chorume lidos manualmente.
  Monitoramento é **condicionante de licença ambiental** (demanda já obrigatória, não latente).
- Comprador institucional com orçamento recorrente.
- Fontes: [AmbScience](https://ambscience.com/aterro-sanitario-e-os-piezometros/) ·
  [Marca Ambiental](https://marcaambiental.com.br/o-monitoramento-geotecnico-de-aterros-sanitarios/)

## 3.4 Obras civis
- Rebaixamento de lençol freático em escavações urbanas (metrô, fundações): monitoramento
  **temporário** — obra com prazo não justifica sistema caro; alerta de recalque em vizinhos.
- Mercado project-based, alto valor por obra.

## 3.5 Água subterrânea e agricultura
- Poços outorgados (Lei 9.433/1997) sem telemetria; gestão de aquíferos e reservatórios rurais.
- Melhor via comitês de bacia (agregação) do que produtor individual.

## 3.6 Outros
- **Pilhas de estéril e taludes de cava** (mesma instrumentação, mesma barreira de custo).
- **Drenagem urbana/alagamentos** (nível de rio/canal — demanda validada por iniciativas como a
  startup estudantil "Ih Alagou", de Recife).
- **Piscicultura** (extensão natural, sem dados robustos de mercado — citar só de passagem).

## Ranking para o pitch (dor real + exigência legal + ausência de solução barata)

1. **Pequenas barragens de água/açudes** — milhares de estruturas sem instrumentação, lei exigindo
   plano de segurança, e reconhecimento oficial de que não conseguem pagar o padrão industrial.
2. **Aterros sanitários** — obrigação legal já vigente, universo definido (~700), comprador com
   orçamento.
3. **Encostas urbanas** — maior apelo humano (Petrópolis), mas comprador público de ciclo lento.

---

# COMO USAR ESTE DOCUMENTO

- **TCC (esqueleto sugerido):** Introdução/justificativa = fio condutor (topo deste doc) →
  Referencial teórico = Partes 1 e 2 → Trabalhos relacionados = pesquisa de projetos similares
  (nenhum integra nuvem + dashboard + Telegram + SMS + store & forward + multi-instrumento) →
  Desenvolvimento = arquitetura v1→v2 (histórico no readme e no git) → Resultados = protótipo +
  dashboard + alertas → Discussão = limitações (sensor stand-in vs. corda vibrante; sem redundância
  de energia exigida para DPA alto) e mercados adjacentes (Parte 3).
- **Slides/pitch (narrativa em 6 passos):** tragédia (2.2) → física (1.2, uma equação só: σ' = σ − u)
  → lei exige automação (2.3) → mas só o DPA alto tem (2.4: 28 mil vs. 6 mil) → nossa solução
  (demo ao vivo) → mercados além da mineração (ranking 3.x).
- **Resposta ao "isso já existe":** existe para DPA alto, a preço "sob consulta"; para todo o resto
  (milhares de barragens pequenas, aterros, encostas) a leitura ainda é manual — e é aí que o
  protótipo entra.
