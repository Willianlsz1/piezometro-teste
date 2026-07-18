# Preparação para a Banca

Documento direto, sem enrolação, para responder às perguntas mais prováveis da banca do TCC.
Referências de contexto: `docs/projeto/BASE_DE_CONHECIMENTO.md` (piezômetros/legislação/mercado),
`docs/prototipo/PROTOTIPO_FISICO.md` (hardware), `docs/prototipo/VALIDACAO_SENSOR.md` (precisão do sensor).

---

## a) Memória de cálculo da economia (Viabilidade Econômica)

Números **oficiais** do projeto, fechados após pesquisa de preço real (14/07/2026) e documentados
com fonte em `docs/projeto/VIABILIDADE_ECONOMICA.md` (seções 1–4) — decisão registrada também em
`docs/projeto/PROJETO_INDUSTRIAL.md` §10, item 5. Substituem a estimativa antiga dos alunos (20
piezômetros × 104 leituras/ano × R$ 350/campanha ≈ R$ 728.000/ano), que era premissa de trabalho
não auditada.

### Custo da leitura manual terceirizada (situação atual)

```
custo_anual_manual = nº_piezômetros × frequência_anual × custo_por_leitura
```

| Variável | Valor oficial | Fonte |
|---|---|---|
| nº de piezômetros lidos | **≈100** | Decomposição usada em `VIABILIDADE_ECONOMICA.md` §4.1 para fechar o valor declarado pela Samarco |
| Frequência de leitura | **2×/semana** (≈104 leituras/ano) | Idem |
| Custo por leitura (deslocamento + técnico terceirizado) | **R$ 58** | Idem — fecha o valor declarado no edital |

```
custo_anual_manual = 100 × 104 × R$ 58 ≈ R$ 600.000/ano
```

Esse é o número **declarado pela Samarco** no edital do desafio SAGA. A leitura adotada pelo
projeto (`VIABILIDADE_ECONOMICA.md` §4.1, leitura "b") é que os **50 pontos** do projeto de
referência do TCC cobrem integralmente essa demanda — não uma fração dela.

### Custo do sistema proposto (UCT industrial, 50 pontos)

| Item | Custo |
|---|---|
| CAPEX (hardware + instalação + sobressalentes + bancada de homologação + contingência, 50 pontos) | **R$ 260.000** (R$ 5.200/ponto) — composição fechada em `VIABILIDADE_ECONOMICA.md` §2 |
| OPEX anual (chip 4G, nuvem, manutenção, inspeção de campo) | **R$ 39.155/ano** — detalhado em `VIABILIDADE_ECONOMICA.md` §3 |

> **Atenção — não confundir os dois custos de hardware.** O protótipo de bancada (ESP32 DevKit +
> sensor ultrassônico JSN-SR04T + acessórios, ver `docs/prototipo/PROTOTIPO_FISICO.md`) custa
> **R$ 150–220/ponto** — esse número é só a maquete de demonstração da banca, não a UCT industrial.
> A UCT industrial (transdutor 4–20 mA + ADS1115 + módulo celular 4G + energia solar + gabinete
> IP66/67, ver `docs/projeto/PROJETO_INDUSTRIAL.md` seções 4–6) custa **R$ 2.965/unidade**, que é o
> componente de hardware dentro do R$ 5.200/ponto instalado acima — o produto que de fato seria
> fabricado e instalado em campo, não o que está montado na bancada da apresentação.

### Comparação

```
economia_líquida = economia_bruta − OPEX
                  = R$ 600.000 − R$ 39.155 ≈ R$ 560.845/ano (redução de 93,5% do gasto atual)

payback = CAPEX ÷ (economia_líquida ÷ 12)
        = R$ 260.000 ÷ R$ 46.737,08/mês ≈ 5,6 meses
```

### Importante — não confundir os dois números

- O cálculo acima usa os **números oficiais do projeto** (CAPEX R$ 260.000, OPEX R$ 39.155/ano,
  economia líquida R$ 560.845/ano, payback 5,6 meses), com memória de cálculo auditável e fontes
  pesquisadas em `VIABILIDADE_ECONOMICA.md`.
- O **R$ 600.000/ano** é o valor declarado no edital do desafio SAGA pela Samarco; a decomposição
  (≈100 piezômetros × 2×/semana × R$ 58/leitura) é a leitura que o projeto adotou para justificá-lo
  com uma memória de cálculo própria — não é a memória de cálculo interna da empresa, à qual os
  alunos não tiveram acesso.
- Se a banca perguntar "de onde vem o R$ 600 mil?": resposta correta é "é o número que consta no
  edital do desafio SAGA como estimativa da Samarco; a decomposição (100 piezômetros × 2×/semana ×
  R$ 58/leitura) é a leitura que adotamos para justificá-lo com uma memória de cálculo auditável,
  consistente com o CAPEX de 50 pontos do projeto — `VIABILIDADE_ECONOMICA.md` §5 ainda testa o
  cenário pessimista de metade dessa economia (payback sobe para ~12 meses, mas continua dentro do
  primeiro ano)."

---

## b) "Isso é piezômetro ou INA?"

Resposta pronta (4-6 linhas):

> "O protótipo, como está hoje, mede **coluna d'água** por meio de um sensor ultrassônico — isso é
> tecnicamente mais próximo de um **INA (indicador de nível d'água)** do que de um piezômetro de
> corda vibrante, que mede a poropressão de uma camada específica isolada por um bulbo selado com
> bentonita. A diferença entre os dois está **no elemento sensor e na instalação**, não na
> eletrônica: toda a cadeia de telemetria, alertas e dashboard é idêntica para ambos os casos. Por
> isso o firmware foi desenhado com um contrato de 'adapter' de sensor (`piezometro_core.h` +
> arquivos `sketch_*.ino` trocáveis) — para instalar um transdutor de pressão ou corda vibrante de
> verdade bastaria escrever um novo adapter que leia o sinal do instrumento e devolva a mesma
> grandeza (nível/pressão), sem tocar no resto do sistema."

---

## c) Tabela de conformidade regulatória (ANM 95/2022 e PNSB)

Baseada no que `BASE_DE_CONHECIMENTO.md` já documenta (seções 1.5, 1.6, 2.3). Onde o número exato
do artigo não é citado na base de conhecimento, a tabela usa referência genérica de propósito
("exigência da ANM 95/2022 para DPA alto"), como instruído — não inventar artigos específicos.

| Requisito regulatório | O protótipo atende? | Caminho para atender |
|---|---|---|
| Monitoramento automatizado em tempo real e período integral (exigência da ANM 95/2022 para barragens de DPA alto) | **Parcial** — o sistema já é automatizado e roda 24/7 (cron de 1 min, sem hibernação), mas o sensor é um stand-in, não um instrumento certificado para operação de DPA alto | Trocar o sensor por transdutor de pressão/corda vibrante certificado (via o contrato de adapter, ver item b) |
| Redundância de energia (exigida pela ANM 95/2022 para DPA alto) | **Não** — a maquete depende de energia de rede/USB, sem bateria ou painel solar de backup | Adicionar bateria + painel solar (ou nobreak) na instalação de campo; é mudança de hardware, não de arquitetura |
| Registro histórico das leituras | **Sim** — todas as leituras ficam persistidas no D1 (SQLite gerenciado), consultáveis via `/dados` | — |
| Alerta automático ao ultrapassar níveis de controle | **Sim** — motor de alertas (cron 1 min) dispara Telegram/SMS nas transições de faixa, com estado anti-spam no KV | — |
| Limiares de controle definidos por projeto geotécnico específico (não um valor universal) | **Sim** — `NIVEL_ATENCAO`/`NIVEL_CRITICO` são parametrizáveis em 3 pontos espelhados (firmware, Worker, dashboard) | Para produção real, os valores viriam do projetista geotécnico de cada instalação, não de um padrão fixo |
| Inspeção regular e aumento de frequência quando leitura sai do padrão | **Parcial** — o sistema aumenta a "frequência de atenção" no sentido de que o alerta chama atenção imediatamente, mas não substitui a inspeção física de rotina exigida pela norma | O sistema é complementar à inspeção humana, não substituto — deixar isso explícito na defesa |
| Mapa de inundação / PAEBM (Lei 14.066/2020) | **Não** — fora do escopo do sistema de instrumentação | Não é responsabilidade do sistema de monitoramento; é um plano separado da barragem |
| Cadastro/enquadramento na PNSB (Lei 12.334/2010) | **Não aplicável** — o protótipo não é uma barragem real, é uma ferramenta que poderia equipar uma barragem cadastrada | Depende da barragem onde for instalado, não do sistema em si |

---

## d) Limites do free tier (Cloudflare) e plano de contingência

| Recurso | Limite free tier | O que acontece ao estourar |
|---|---|---|
| Workers (requisições) | 100.000 requisições/dia | Requisições extras retornam erro até o próximo dia (reset diário); não derruba o serviço, só limita picos extremos |
| D1 (armazenamento) | ~5 GB | Suficiente para anos de leituras de piezômetro (poucos KB por leitura × múltiplos pontos); estourar exigiria um volume de dados muito acima do cenário do protótipo |
| D1 (linhas lidas/escritas por dia) | 5 milhões lidas / 100 mil escritas por dia | Uma leitura a cada 10s por ponto = ~8.640 escritas/dia por ponto → o free tier comporta até ~11 pontos nessa frequência; o protótipo (1–3 pontos) tem folga larga, mas os 20 pontos do exemplo do item (a) já exigiriam reduzir a frequência (ex.: 1 leitura/min ≈ 1.440 escritas/dia/ponto, folga para ~69 pontos) ou o plano pago |
| Workers KV (escritas) | 1.000 escritas/dia (free tier) | Por isso o motor de alertas só grava no KV **quando o estado muda de faixa**, não a cada ciclo de cron — decisão de arquitetura documentada no `CLAUDE.md`, não é gravação incondicional |
| Cron Triggers | Incluído no free tier de Workers | Sem limite adicional relevante para 1 execução/minuto |

**Plano de contingência:** se o uso crescer (mais pontos, mais frequência), o primeiro tier pago é
o **Cloudflare Workers Paid**, a partir de **US$ 5/mês** (~R$ 25–30/mês), que já inclui
limites muito mais altos de requisições, leituras/escritas de D1 e armazenamento.

**Argumento de custo:** US$ 5/mês é um custo **irrisório** frente ao valor protegido — mesmo
usando só a estimativa conservadora do item (a), qualquer fração de um ano de economia (~R$ 724 mil
ou o R$ 600 mil do edital) paga décadas do plano pago. O free tier é aceitável e adequado para um
**protótipo de TCC**; uma operação de produção real, com dados de segurança de barragem em jogo,
contrataria o plano pago desde o primeiro dia — é um trade-off consciente, não uma limitação
escondida.

---

## e) As 7 perguntas difíceis prováveis (resposta curta)

| # | Pergunta | Resposta curta |
|---|---|---|
| 1 | "Qual a incerteza de medição do sensor?" | Ver `docs/prototipo/VALIDACAO_SENSOR.md` — protocolo de 5 alturas × 10 leituras, erro médio/desvio padrão/erro máximo calculados, incerteza declarada como ±2σ |
| 2 | "Isso é piezômetro ou INA?" | Ver item (b) acima — hoje é mais próximo de INA (coluna d'água); eletrônica é idêntica para os dois; muda o sensor e a instalação |
| 3 | "De onde vem o R$ 600 mil/ano?" | É o número do edital da Samarco, não auditado por nós; ver item (a) para a memória de cálculo própria e independente |
| 4 | "E se faltar energia no ESP32?" | Admitir: sem redundância de energia hoje (não atende ao exigido pela ANM 95/2022 para DPA alto); mitigação futura é bateria + painel solar; o firmware já tem store & forward para não perder dados na falta de **rede**, mas falta de **energia** derruba o dispositivo — são problemas diferentes |
| 5 | "Um backend gratuito é confiável para algo tão crítico?" | Histórico honesto: a v1 (Render + InfluxDB) tinha hibernação e expiração de retenção — por isso foi trocada pela v2 (Cloudflare Worker + D1), que não hiberna; free tier tem limites generosos para este volume (ver item d), e o caminho para produção real é o plano pago de US$ 5/mês |
| 6 | "Por que os limites do free tier não vão te pegar de surpresa?" | Ver tabela do item (d): o volume do protótipo (poucos pontos, leitura a cada 10s) está muito abaixo de todos os limites; o único limite apertado (KV, 1.000 escritas/dia) já foi tratado na arquitetura — grava só na transição de faixa |
| 7 | "Wokwi ou maquete física — o que vocês realmente testaram?" | Os dois: `firmware/sketch.ino` roda no Wokwi com BMP180 como stand-in (mesmo núcleo de código); `firmware/sketch_fisico_jsn_sr04t.ino` roda na maquete física real com JSN-SR04T medindo água de verdade dentro de um tubo/balde (ver `PROTOTIPO_FISICO.md`); ambos compartilham `piezometro_core.h` — só o adapter de sensor muda |

---

## Referências cruzadas

- Memória de economia (a) e origem do número do edital → citar em **Viabilidade Econômica**.
- Piezômetro vs. INA (b) → citar em **Justificativa/Terminologia** e ter pronta para perguntas de
  banca.
- Conformidade regulatória (c) → citar em **Viabilidade Técnica** e **Discussão de limitações**.
- Limites de free tier (d) → citar em **Viabilidade Técnica** (custo de operação) e **Viabilidade
  Econômica** (custo recorrente do sistema).
- Perguntas difíceis (e) → material de ensaio para a apresentação oral, não necessariamente texto
  do TCC.
