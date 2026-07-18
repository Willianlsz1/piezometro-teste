# Pesquisa Externa — Piezômetros e Monitoramento de Barragens de Mineração

> Fundamentação externa para o TCC AquaSense (SENAI/Samarco): monitoramento IoT de piezômetros
> em barragens de mineração no Brasil.
>
> **Método:** todas as afirmações abaixo vêm de páginas e documentos efetivamente abertos
> (WebFetch) em 18/07/2026, com a URL da fonte ao lado. Os textos da Lei 14.066/2020 (PDF oficial
> do MME) e da Resolução ANM 95/2022 (PDF oficial da ANM) foram baixados e lidos na íntegra.
> Fontes cujo acesso falhou estão listadas ao final em "Fontes não acessadas".

---

## 1. Fundamentos técnicos do piezômetro

O piezômetro é o instrumento que mede a **pressão da água nos poros (poropressão)** dentro do
maciço ou da fundação — a variável central de estabilidade de uma barragem de rejeitos. Os
principais tipos e características, conforme literatura técnica de fabricantes:

### 1.1 Casagrande / tubo aberto (standpipe)

- **Princípio:** ponta porosa conectada a um tubo vertical (riser). A água flui livremente pela
  ponta porosa e estabiliza no tubo na cota piezométrica; a leitura é feita medindo a
  profundidade do nível d'água com um medidor elétrico de nível (ex.: Solinst 101) ou pio
  (sounder). Fonte: datasheet Geokon 4590 — https://www.geokon.com/content/datasheets/4590_Casagrande_Standpipe_Piezometer.pdf
- A ponta Casagrande típica usa **filtro poroso de ~50 mícrons** (plástico/polietileno sinterizado)
  com conexões para tubos de 1/2", 3/4" ou 1" (Geokon 4590, URL acima; Sisgeo —
  https://sisgeo.com/products/piezometers/casagrande-and-standpipe-piezometers/).
- **Vantagens:** simples, econômico, muito confiável, com longo histórico de desempenho; permite
  também coleta de amostras d'água e ensaios de permeabilidade (carga constante/variável)
  (Geokon 4590).
- **Desvantagens:** grande **atraso hidrodinâmico** (time lag) — muito maior que o de piezômetros
  de diafragma, pois exige movimentação de volume de água considerável; risco de dano por
  equipamentos de construção; o tubo atravessando aterros pode gerar compactação inferior no
  local (Geokon 4590). Leituras manuais infrequentes (1–2x/semana) perdem flutuações entre
  campanhas; pontas entupidas por sedimento "cegam" o instrumento; em climas frios a coluna
  d'água pode congelar (Encardio-Rite —
  https://www.encardio.com/blog/digital-piezometers-replacing-standpipe-piezometers).
- **Automação:** o próprio fabricante indica que, "em situações críticas de monitoramento e/ou
  onde leituras automáticas em intervalos frequentes são necessárias", o standpipe é facilmente
  **convertido instalando-se um piezômetro de diafragma dentro do tubo** (ex.: Geokon 4500C)
  (Geokon 4590). A Sisgeo igualmente oferece transdutores removíveis/ventilados e piezômetros de
  corda vibrante inseridos no tubo, ligados a datalogger (OMNIAlog) para aquisição automática
  (Sisgeo, URL acima). **Este é exatamente o conceito do AquaSense: automatizar a leitura de um
  tubo Casagrande existente.**

### 1.2 Corda vibrante (vibrating wire)

- **Princípio:** um fio de aço tensionado tem uma extremidade ancorada e a outra fixada a um
  diafragma; a variação de pressão da água deflete o diafragma e altera a tensão (e portanto a
  frequência de ressonância) do fio, excitado/lido por bobina eletromagnética
  (Encardio-Rite — https://www.encardio.com/blog/piezometers-types-functions-how-it-works;
  Geo-Instruments — https://www.geo-instruments.com/technology/piezometers/).
- **Conversão de leitura:** a pressão é obtida por P = (R1 − R0) × G (leitura atual menos leitura
  zero inicial vezes fator de calibração linear), com **correção de temperatura**
  PT = (T1 − T0) × K e **correção barométrica** subtraída do valor calculado; a **linearidade da
  maioria dos sensores fica dentro de ±0,2% do fundo de escala**, e polinômios de 2ª ordem
  melhoram o ajuste quando se busca precisão máxima (manual Geokon 4500 —
  https://www.geokon.com/content/manuals/4500/topics/06_data_reduction.htm).
- **Vantagens:** alta precisão, leitura de pressões negativas, sinal em frequência imune a ruído
  eletromagnético e transmissível a longas distâncias; ideal para automação (Encardio-Rite, tipos;
  Geo-Instruments). Sensores digitais detectam variações de 0,1–0,25% F.S. (Encardio-Rite,
  digital piezometers).
- **Desvantagens:** custo mais alto e necessidade de calibração individual (Encardio-Rite, tipos).

### 1.3 Pneumático

- **Princípio:** operado por pressão de gás contra um diafragma, lido em indicador pneumático.
- **Vantagem:** viável em áreas sem eletricidade; **desvantagens:** menor precisão e necessidade
  de regulagem constante (Encardio-Rite — https://www.encardio.com/blog/piezometers-types-functions-how-it-works).

### 1.4 Elétrico (strain gauge / piezorresistivo)

- **Princípio:** diafragma defletor acoplado a transdutor que converte a deformação em sinal
  elétrico; resposta muito mais rápida que o standpipe e automação direta; risco de entrada de ar
  em pressões negativas (Encardio-Rite, URL acima).

### 1.5 Hidráulico (twin-tube)

- Sistema com tubulações gêmeas preenchidas com água ligadas a manômetro remoto; permite leitura
  a distância, mas exige manutenção de circulação de água desaerada (Encardio-Rite, URL acima).

### 1.6 Boas práticas de instalação

- Coluna clássica no furo: **areia filtrante (~1 m) envolvendo o sensor/ponta porosa → selo de
  bentonita (1–2 m) isolando a zona de interesse → calda de cimento (grout) no restante do furo**;
  filtros de 40–60 mícrons, cerâmica de baixo valor de entrada de ar ou aço inox, com **saturação
  prévia do filtro com água desaerada** (Encardio-Rite —
  https://www.encardio.com/blog/piezometers-types-functions-how-it-works).
- O esquema do Geokon 4590 mostra a mesma seção: ponta Casagrande envolta em areia, selo de
  bentonita acima e grout até a boca do furo, com tampa de proteção contra entrada de água de
  chuva (Geokon 4590, datasheet).
- Método moderno **fully grouted**: sensores de corda vibrante instalados em furos preenchidos
  com calda bentonita-cimento, permitindo múltiplos sensores em profundidades diferentes no mesmo
  furo (Geo-Instruments — https://www.geo-instruments.com/technology/piezometers/; Encardio-Rite,
  tipos).

---

## 2. Legislação brasileira (verificada na fonte)

### 2.1 Lei nº 14.066/2020 — a PNSB pós-Brumadinho

Texto integral verificado no PDF oficial do Ministério de Minas e Energia:
https://www.gov.br/mme/pt-br/acesso-a-informacao/legislacao/leis/lei-n-14-066-2020.pdf
(ficha legislativa: https://www2.camara.leg.br/legin/fed/lei/2020/lei-14066-30-setembro-2020-790691-norma-pl.html).
A lei altera a Lei 12.334/2010 (PNSB), a Lei 7.797/1989, a Lei 9.433/1997 e o Código de Mineração.

- **Proibição do método a montante (art. 2º-A):** "Fica proibida a construção ou o alteamento de
  barragem de mineração pelo método a montante", com **descaracterização** das existentes até
  25/02/2022 (§ 2º), prorrogável por inviabilidade técnica com referendo do licenciador do
  Sisnama (§ 3º).
- **Vedação de comunidade na ZAS (art. 18-A):** "Fica vedada a implantação de barragem de
  mineração cujos estudos de cenários de ruptura identifiquem a existência de comunidade na ZAS".
- **ZAS e ZSS definidas em lei (art. 2º):** ZAS é o "trecho do vale a jusante da barragem em que
  não haja tempo suficiente para intervenção da autoridade competente em situação de emergência";
  ZSS é o trecho do mapa de inundação não definido como ZAS.
- **Instrumentação e dados em tempo real — obrigação do empreendedor (art. 17, XX):**
  "armazenar os dados de instrumentação da barragem e fornecê-los ao órgão fiscalizador
  periodicamente **e em tempo real, quando requerido**". Também: apresentar periodicamente a
  Declaração de Condição de Estabilidade (inciso XIX) e não apresentar informações falsas ou
  omissas (inciso XXI).
- **PAE reforçado (art. 12):** conteúdo mínimo inclui mapa de inundação no pior cenário,
  delimitação de ZAS/ZSS, cadastro atualizado da população na ZAS com vulnerabilidades sociais e
  "**sistema de monitoramento e controle de estabilidade da barragem integrado aos procedimentos
  emergenciais**" (inciso X).
- **Barragens desativadas (art. 18, § 3º):** monitoramento das condições de segurança e medidas
  preventivas são obrigatórios "até a sua completa descaracterização".
- **SNISB (art. 13/16):** as barragens integram o SNISB até a descaracterização, e o SNISB "deve
  ser integrado ao sistema nacional de informações e monitoramento de desastres" (Lei 12.608/2012).
- **Sanções (arts. 17-C e 17-E):** advertência, multa simples, multa diária, embargo e interdição;
  multas entre **R$ 2.000,00 e R$ 1.000.000.000,00 (um bilhão de reais)**.

### 2.2 Resolução ANM nº 95/2022 — consolidação para barragens de mineração

Texto integral verificado no PDF oficial da ANM
(https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf) e na versão
HTML da LegisWeb (https://www.legisweb.com.br/legislacao/?id=427523); síntese oficial da ANM em
https://www.gov.br/anm/pt-br/assuntos/noticias/veja-o-que-muda-com-a-resolucao-anm-ndeg-95-2022.

- **Monitoramento automatizado obrigatório (art. 7º, § 1º):** para barragens com **DPA alto**, o
  empreendedor é obrigado a "manter **sistema de monitoramento automatizado de instrumentação**,
  adequado à complexidade da estrutura, com **acompanhamento em tempo real e período integral,
  incluindo redundância no sistema de alimentação de energia**", cabendo ao empreendedor a
  definição da tecnologia, dos instrumentos e dos processos de monitoramento. Videomonitoramento
  com armazenamento mínimo de 90 dias; prazo de adequação de 1 ano após reclassificação para DPA
  alto. **(Base regulatória direta do AquaSense: automação + tempo real + backup de energia.)**
- **Sirenes (art. 8º):** barragens com DPA alto — ou DPA médio quando "existência de população a
  jusante" atinge 10 pontos — devem ter "sistemas automatizados de acionamento de sirenes
  instaladas fora da mancha de inundação", em lugar seguro e "dotados de modo contra falhas em
  caso de rompimento", complementando acionamento manual e remoto.
- **Inspeções (arts. 19 e 27–32):** Fichas de Inspeção Regular ao menos **quinzenais**, com
  extrato registrado no SIGBM; relatório semestral com **Declaração de Condição de Estabilidade
  (DCE)** nas campanhas de março e setembro (setembro com equipe externa). Anomalia com pontuação
  10 aciona **Inspeção Especial**, com fichas diárias até o controle/extinção da anomalia.
- **Fator de segurança mínimo (art. 23):** análises de estabilidade e estudos de susceptibilidade
  à liquefação exigem "valor igual ou superior a 1,30 para resistência de pico" (ref. ABNT NBR
  13.028), com parâmetros obrigatoriamente definidos a partir de ensaios geotécnicos em condições
  drenada e não drenada.
- **Níveis de emergência com gatilhos objetivos (art. 41):** NE1 quando FS drenado 1,30 ≤ FS <
  1,50 ou FS não drenado de pico 1,20 ≤ FS < 1,30; NE2 quando FS drenado 1,10 ≤ FS < 1,30 (ou
  anomalia "não controlada"); **NE3 quando a "ruptura é inevitável ou está ocorrendo"** ou FS
  drenado < 1,10. Em emergência, interrupção imediata do lançamento de efluentes e rejeitos
  (art. 41, § 3º). Segundo a própria ANM, o não atendimento a FS mínimo passou a ser gatilho
  automático de emergência, "o que não ocorria até então" (notícia oficial, URL acima).
- **ZAS quantificada (art. 2º):** trecho do vale a jusante correspondente à **maior** das
  distâncias: tempo de chegada da onda de 30 minutos ou 10 km. Vedadas na ZAS instalações
  administrativas, de vivência, saúde e recreação (arts. 54–56); obras de reforço na ZAS exigem
  FS ≥ 1,5 de pico.
- **DPA e periodicidades (arts. 5º, 6º, 18, 24):** DPA classificado em alto/médio/baixo (Anexo
  IV); mapa de inundação obrigatório para todas as barragens de mineração; Revisão Periódica a
  cada 3/5/7 anos (DPA alto/médio/baixo); tempo de retorno do extravasor de 10.000 anos ou PMP
  (alto), 1.000 anos (médio) e 500 anos (baixo).
- **Consolidação (art. 82):** revoga a Portaria DNPM 70.389/2017 e as Resoluções ANM 13/2019,
  32/2020, 40/2020, 51/2020 e 56/2021, unificando o arcabouço em um único normativo. Vigência a
  partir de 22/02/2022 (art. 81).

---

## 3. Estatísticas oficiais — Relatório de Segurança de Barragens 2024/2025 (ANA/SNISB)

Fonte: notícia oficial da ANA sobre o RSB 2024/2025, lançado em 01/07/2025 —
https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/rsb-2024-2025-indica-241-barragens-prioritarias-que-necessitam-de-maior-atencao-em-termos-de-seguranca-em-23-estados-e-no-distrito-federal
(portal do sistema: https://www.snisb.gov.br/).

- **28.085 barragens cadastradas** no SNISB por 33 órgãos fiscalizadores; mais de **2.100 novos
  barramentos** cadastrados só em 2024.
- Enquadramento na PNSB: **6.202 (22%) enquadradas**, 7.005 (25%) não enquadradas e **14.878
  (53%) com enquadramento ainda indefinido** — ou seja, mais da metade do cadastro nacional sem
  definição de regime de segurança.
- **241 barragens prioritárias** (empreendedores que não cumpriram todos os requisitos de
  segurança), em 23 estados e no DF; destas, **51 (21,2%) são de disposição de rejeitos de
  mineração**.
- Eventos em 2024: **24 acidentes e 45 incidentes, com 2 óbitos**; 88% dos acidentes ocorreram em
  barragens de terra.
- Fiscalização: 33 órgãos, 356 profissionais envolvidos (apenas 169 dedicados em tempo integral);
  **2.859 inspeções de campo** (queda ante 3.064 no ciclo anterior) e 3.162 análises documentais.
- Recursos públicos executados em segurança de barragens: R$ 84 milhões (2023) → **R$ 141 milhões
  (2024)**, alta de 67%.

---

## 4. Casos: Fundão (2015) e Brumadinho (2019)

### 4.1 Fundão — Mariana/MG, 05/11/2015

Fontes: página oficial do relatório do Painel de Revisão da Barragem de Fundão
(https://www.resolutionmineeis.us/documents/fundao-2016) e página da ASDSO sobre o relatório
(https://damsafety.org/content/report-immediate-causes-failure-fund%C3%A3o-dam).

- Painel independente constituído por Cleary Gottlieb (contratado por Samarco, Vale e BHP),
  composto por **Norbert Morgenstern, Steven Vick, Bryan Watts e Cássio Viotti**, com
  especialistas em sismicidade (ASDSO, URL acima).
- Conclusão central: a barragem "falhou em um fluxo de liquefação que se iniciou no ombro
  esquerdo" — **liquefação** de rejeitos arenosos saturados, demonstrada inclusive em
  laboratório: o corpo de prova saturado "colapsou completa e abruptamente, perdendo quase toda
  a resistência" (relatório via resolutionmineeis, URL acima).
- Papel do controle de saturação: mudanças de projeto e o **dano ao sistema de drenagem original
  em 2009** provocaram "aumento da extensão de saturação" não previsto no conceito de pilha
  drenada; a saturação excessiva não foi adequadamente controlada, criando as condições de
  liquefação (idem).
- Fatores agravantes: deposição de lamas (slimes) em áreas não previstas sob o ombro esquerdo;
  redução da largura de praia de 200 m para apenas 60 m; a ruptura resultou de "uma cadeia de
  eventos e condições" acumuladas — não de um evento único (idem).
- **Lição para o TCC:** a variável crítica (saturação/poropressão) era mensurável por
  piezômetros; o caso evidencia que o controle contínuo e confiável da saturação é requisito de
  segurança, não conveniência operacional.

### 4.2 Brumadinho — Barragem B1 do Córrego do Feijão, 25/01/2019

Fontes: análise do relatório do Painel de Especialistas no AGU Landslide Blog
(https://blogs.agu.org/landslideblog/2020/01/20/brumadinho-tailings-disaster/) e artigo de Grebby
et al. na *Communications Earth & Environment*
(https://www.nature.com/articles/s43247-020-00079-2).

- O Painel concluiu que a ruptura ocorreu por **liquefação estática**, iniciando perto da crista
  e progredindo rapidamente por toda a estrutura; a falha foi **frágil e sem sinais aparentes de
  sofrimento prévio** (AGU, URL acima).
- A barragem **era extensamente monitorada** — piezômetros, inclinômetros, radar terrestre e
  marcos superficiais — e ainda assim "**nenhum desses métodos detectou deformações ou mudanças
  significativas antes da ruptura**"; o assentamento de até 30 mm/ano medido era esperado e não
  indicava perda de estabilidade (AGU, citando o relatório do Painel).
- Os piezômetros mostravam que os **níveis d'água permaneciam altos na região do pé** da
  barragem, com drenagem interna limitada e chuvas intensas — poropressões elevadas geradas pelo
  método construtivo a montante com drenagem deficiente (AGU, URL acima).
- **Contudo, havia precursor detectável por outra técnica:** Grebby et al. (2021), analisando
  InSAR (técnica ISBAS, satélites Sentinel-1), identificaram deformação de −7 a −8 mm/ano na
  praia de rejeitos com **aceleração súbita a partir de outubro de 2018** (correlacionada às
  chuvas) e mudança brusca na taxa de deslocamento dias antes do colapso; por análise de
  velocidade inversa, os intervalos previstos de ruptura (dias 513–551) **contêm o dia real da
  ruptura (dia 524)**, e os autores argumentam que monitoramento contínuo poderia ter fornecido
  aviso ~44 dias antes (Nature, URL acima).
- **Lição para o TCC:** leitura pontual/periódica de instrumentos não basta para rupturas
  frágeis; a defesa moderna é **monitoramento contínuo, automatizado e multi-sensor**, com
  análise de tendência ao longo do tempo — exatamente o que a Resolução ANM 95/2022 passou a
  exigir para DPA alto (art. 7º, § 1º).

---

## 5. Automação e IoT em instrumentação geotécnica

- **Limite da leitura manual:** standpipes lidos manualmente 1–2 vezes por semana perdem qualquer
  flutuação de poropressão entre campanhas; sensores eletrônicos ligados a dataloggers capturam
  leituras em intervalos de minutos ou horas, detectam picos transientes e variações de
  0,1–0,25% F.S. (Encardio-Rite —
  https://www.encardio.com/blog/digital-piezometers-replacing-standpipe-piezometers).
- **Telemetria e nuvem:** piezômetros digitais integram-se a sistemas GSM, rádio ou satélite,
  transmitindo automaticamente para plataformas em nuvem e "reduzindo a necessidade de visitas
  frequentes ao local" — com ganho de custo e de segurança do pessoal (Encardio-Rite, URL acima).
  Fabricantes oferecem cadeias completas: transdutores em standpipes + dataloggers (Sisgeo
  OMNIAlog — https://sisgeo.com/products/piezometers/casagrande-and-standpipe-piezometers/;
  Campbell CR6 e nós wireless "GeoCloud" — https://www.geo-instruments.com/technology/piezometers/).
- **Trabalho acadêmico brasileiro na mesma linha do AquaSense:** a monografia de SILVA, Márcio
  Flávio Sousa. *Sistema de monitoramento online de barragens de mineração* (Eng. de Controle e
  Automação, Escola de Minas/UFOP, 2019) parte do diagnóstico de que "em muitos dos casos a
  coleta das informações de instrumentação é feita de forma manual e periódica, o que torna esta
  tarefa demorada" e propõe a automatização dos principais instrumentos com disponibilização
  online dos dados —
  https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf
- **Regulação como motor da automação:** no Brasil, a automação deixou de ser opcional para DPA
  alto — o art. 7º, § 1º da Resolução ANM 95/2022 exige monitoramento automatizado em tempo real
  e período integral **com redundância de alimentação de energia** (PDF oficial —
  https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf), e a Lei
  14.066/2020 obriga o fornecimento dos dados de instrumentação ao fiscalizador "em tempo real,
  quando requerido" (art. 17, XX —
  https://www.gov.br/mme/pt-br/acesso-a-informacao/legislacao/leis/lei-n-14-066-2020.pdf).
- **Desafios técnicos documentados:**
  - *Energia:* a exigência legal de redundância de alimentação (ANM 95/2022, art. 7º, § 1º)
    reflete o desafio de alimentar sensores em campo — justifica bateria + painel solar no
    projeto.
  - *Qualidade do dado:* leituras de corda vibrante exigem correção de temperatura e correção
    barométrica, e calibração individual por sensor (manual Geokon 4500 —
    https://www.geokon.com/content/manuals/4500/topics/06_data_reduction.htm).
  - *Manutenção:* entupimento de filtros/pontas porosas e danos por equipamentos de construção
    permanecem modos de falha dos instrumentos (Encardio-Rite, digital piezometers; Geokon 4590).
  - *Detecção:* Brumadinho mostrou que mesmo instrumentação extensa com leitura convencional
    pode não antecipar ruptura frágil (AGU, URL na seção 4) — a tendência é fundir sensores in
    situ contínuos com sensoriamento remoto (InSAR) e análise de séries temporais (Grebby et
    al., Nature, seção 4).

---

## 6. Referências prontas para citar no TCC (ABNT aproximado)

1. BRASIL. **Lei nº 14.066, de 30 de setembro de 2020.** Altera a Lei nº 12.334/2010 (Política
   Nacional de Segurança de Barragens) e outras normas. Disponível em:
   https://www.gov.br/mme/pt-br/acesso-a-informacao/legislacao/leis/lei-n-14-066-2020.pdf.
   Acesso em: 18 jul. 2026.
2. AGÊNCIA NACIONAL DE MINERAÇÃO (ANM). **Resolução nº 95, de 7 de fevereiro de 2022.**
   Consolida os atos normativos sobre segurança de barragens de mineração. Disponível em:
   https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf.
   Acesso em: 18 jul. 2026.
3. AGÊNCIA NACIONAL DE MINERAÇÃO (ANM). **Veja o que muda com a Resolução ANM nº 95/2022.**
   Brasília, 2022. Disponível em:
   https://www.gov.br/anm/pt-br/assuntos/noticias/veja-o-que-muda-com-a-resolucao-anm-ndeg-95-2022.
   Acesso em: 18 jul. 2026.
4. AGÊNCIA NACIONAL DE ÁGUAS E SANEAMENTO BÁSICO (ANA). **RSB 2024/2025 indica 241 barragens
   prioritárias que necessitam de maior atenção em termos de segurança.** Brasília, 1 jul. 2025.
   Disponível em:
   https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/rsb-2024-2025-indica-241-barragens-prioritarias-que-necessitam-de-maior-atencao-em-termos-de-seguranca-em-23-estados-e-no-distrito-federal.
   Acesso em: 18 jul. 2026.
5. FUNDÃO TAILINGS DAM REVIEW PANEL (MORGENSTERN, N. R.; VICK, S. G.; VIOTTI, C. B.; WATTS, B. D.).
   **Report on the Immediate Causes of the Failure of the Fundão Dam.** 2016. Disponível em:
   https://www.resolutionmineeis.us/documents/fundao-2016. Acesso em: 18 jul. 2026.
6. ASSOCIATION OF STATE DAM SAFETY OFFICIALS (ASDSO). **Report on the Immediate Causes of the
   Failure of the Fundão Dam.** Disponível em:
   https://damsafety.org/content/report-immediate-causes-failure-fund%C3%A3o-dam.
   Acesso em: 18 jul. 2026.
7. PETLEY, D. **Brumadinho: the Expert Panel report on the failure of the Feijão tailings dam.**
   AGU Landslide Blog, 20 jan. 2020. Disponível em:
   https://blogs.agu.org/landslideblog/2020/01/20/brumadinho-tailings-disaster/.
   Acesso em: 18 jul. 2026.
8. GREBBY, S. et al. **Advanced analysis of satellite data reveals ground deformation precursors
   to the Brumadinho Tailings Dam collapse.** Communications Earth & Environment, v. 2, 2021.
   Disponível em: https://www.nature.com/articles/s43247-020-00079-2. Acesso em: 18 jul. 2026.
9. ENCARDIO-RITE. **What is a Piezometer: Types, Functions & How it Works.** Disponível em:
   https://www.encardio.com/blog/piezometers-types-functions-how-it-works. Acesso em: 18 jul. 2026.
10. ENCARDIO-RITE. **Why Digital Piezometers Replace Standpipe Piezometers.** Disponível em:
    https://www.encardio.com/blog/digital-piezometers-replacing-standpipe-piezometers.
    Acesso em: 18 jul. 2026.
11. GEOKON. **Model 4500 Series Vibrating Wire Piezometer — Instruction Manual (Data Reduction).**
    Disponível em: https://www.geokon.com/content/manuals/4500/topics/06_data_reduction.htm.
    Acesso em: 18 jul. 2026.
12. GEOKON. **Model 4590 Casagrande Standpipe Piezometer — Datasheet.** Disponível em:
    https://www.geokon.com/content/datasheets/4590_Casagrande_Standpipe_Piezometer.pdf.
    Acesso em: 18 jul. 2026.
13. SISGEO. **Casagrande and Standpipe Piezometers.** Disponível em:
    https://sisgeo.com/products/piezometers/casagrande-and-standpipe-piezometers/.
    Acesso em: 18 jul. 2026.
14. GEO-INSTRUMENTS. **Piezometers — Vibrating wire piezometers monitor pore-water pressure.**
    Disponível em: https://www.geo-instruments.com/technology/piezometers/. Acesso em: 18 jul. 2026.
15. SILVA, M. F. S. **Sistema de monitoramento online de barragens de mineração.** Monografia
    (Engenharia de Controle e Automação) — Escola de Minas, Universidade Federal de Ouro Preto,
    Ouro Preto, 2019. Disponível em:
    https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf.
    Acesso em: 18 jul. 2026.

---

## Fontes não acessadas

Páginas encontradas na busca com títulos relevantes, mas cujo acesso falhou em 18/07/2026 —
**nenhum conteúdo delas foi citado neste documento**:

- Planalto — texto da Lei 14.066/2020 (erro de conexão/ECONNRESET em múltiplas tentativas):
  https://www.planalto.gov.br/ccivil_03/_Ato2019-2022/2020/Lei/L14066.htm
  (o texto integral foi verificado pela via alternativa oficial do MME, ref. 1).
- Diário Oficial da União — publicação da Lei 14.066/2020 (falha de conexão):
  https://www.in.gov.br/en/web/dou/-/lei-n-14.066-de-30-de-setembro-de-2020-280529982
- Notícia oficial do Planalto sobre a sanção da lei (conteúdo restrito/login):
  https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/noticias/2020/09/nova-politica-nacional-de-seguranca-de-barragens-que-impoe-maior-responsabilidade-as-mineradoras-e-sancionada
- Relatório do Painel de Especialistas B1/Feijão — PDF completo (não aberto diretamente; conteúdo
  citado via análise do AGU Landslide Blog, ref. 7):
  https://bdrb1investigationstacc.z15.web.core.windows.net/assets/Feijao-Dam-I-Expert-Panel-Report-ENG.pdf
- Springer — *Benefits and Practical Experience in Automation of Auscultation Instruments of
  Dams* (bloqueio por cookies/redirect):
  https://link.springer.com/chapter/10.1007/978-981-95-4889-7_45
- Revista FOCO — *Desenvolvimento de uma estação transmissora autônoma piezométrica* (HTTP 403):
  https://ojs.focopublicacoes.com.br/foco/article/view/5730
- INZWA — *Piezometers 101* (HTTP 500):
  https://www.inzwa.io/piezometers-101-an-essential-tool-for-geotechnical-monitoring/
- Geocomp — *Modern Monitoring, Meaningful Savings* (erro de certificado):
  https://www.geocomp.com/modern-monitoring-meaningful-savings-how-advanced-geotechnical-instrumentation-helps-reduce-project-costs/
