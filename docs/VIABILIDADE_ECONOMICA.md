# Viabilidade Econômica — Material de Apoio (TCC + BMG Canvas)

> **Nota:** este documento é material de apoio para a seção de Viabilidade Econômica do TCC
> (`docs/TCC_RASCUNHO.md`, item 1.3.6) e para o preenchimento do **BMG Canvas**. Todo número
> marcado como **PREMISSA EDITÁVEL** é uma escolha de trabalho dos alunos, não um dado auditado —
> troque o valor e refaça a conta indicada logo abaixo dele. Os números que já aparecem em
> `docs/DEFESA_BANCA.md` (custo de leitura manual, R$ 350/campanha, R$ 724 mil/ano) são mantidos
> aqui sem contradição; este documento os aprofunda e constrói a precificação e o dimensionamento
> de mercado em cima deles.

---

## 1. Estrutura de custos (o que custa para NÓS)

### 1.1 CAPEX por ponto

**Cenário 1 — Protótipo/bancada** (o que está montado hoje, ver `docs/PROTOTIPO_FISICO.md`):

| Item | Faixa de preço |
|---|---|
| ESP32 DevKit V1 | R$ 35–50 |
| Sensor ultrassônico JSN-SR04T | R$ 40–70 |
| Display OLED SSD1306 | R$ 20–35 |
| LEDs (verde/amarelo/vermelho) | R$ 1–3 |
| Resistores 220 Ω (×3) | R$ 1–2 |
| Resistores 1 kΩ + 2 kΩ (divisor do ECHO) | R$ 1–2 |
| Buzzer ativo 5V | R$ 3–5 |
| Protoboard 830 pontos | R$ 10–20 |
| Jumpers (kit) | R$ 8–15 |
| Cabo micro-USB de dados | R$ 5–12 |
| Tubo de PVC/balde (recipiente de teste) | R$ 15–30 |
| Fita adesiva/abraçadeira | R$ 5–10 |
| **Soma item a item (mín. + mín., máx. + máx.)** | **R$ 144 – R$ 254** |

Conferindo a soma: mínimo = 35+40+20+1+1+1+3+10+8+5+15+5 = **R$ 144**; máximo =
50+70+35+3+2+2+5+20+15+12+30+10 = **R$ 254**. `PROTOTIPO_FISICO.md` arredonda esse total para
**R$ 150–220** — a diferença vem do fato de que, na prática, nem todo item bate no teto ao mesmo
tempo (jumpers e resistores costumam sobrar de kits já comprados para outros pontos). Este
documento usa a faixa **R$ 150–220/ponto** (a mesma do `DEFESA_BANCA.md`) como referência do
cenário protótipo, e registra R$ 144–254 como o cálculo aritmético estrito, para deixar a conta
auditável.

**Cenário 2 — Instalação de campo realista** (PREMISSA EDITÁVEL — não existe ainda, é o que
mudaria para sair da bancada para uma barragem de verdade): troca-se o sensor ultrassônico por um
transdutor de pressão submersível (o ultrassônico não é adequado para um poço/tubo de piezômetro
real — precisa de linha de visada livre e seca) e adiciona-se proteção industrial:

| Item | Faixa de preço | Observação |
|---|---|---|
| ESP32 DevKit V1 | R$ 35–50 | mesmo módulo |
| **Transdutor de pressão submersível** (substitui o JSN-SR04T) | **R$ 300–600** (PREMISSA) | faixa plausível para transdutor 0–5/0–10 m com saída 4-20mA ou 0-5V, sem certificação de corda vibrante |
| Display OLED SSD1306 | R$ 20–35 | opcional em campo (checagem local) |
| LEDs + resistores + buzzer (sinalização local) | R$ 6–12 | mesmos componentes, agrupados |
| Placa/terminais industriais (substitui protoboard/jumpers) | R$ 25–45 (PREMISSA) | conexões soldadas/parafusadas, mais robustas que protoboard |
| Fonte de alimentação industrial 5V/2A + gabinete interno | R$ 25–45 (PREMISSA) | |
| **Caixa hermética IP65** | **R$ 80–150** (PREMISSA) | abrigo da eletrônica no campo |
| Cabo submersível/blindado do transdutor (5–10 m) | R$ 50–150 (PREMISSA) | varia com a profundidade do poço |
| Fixação/suporte (inox ou PVC industrial + abraçadeiras) | R$ 40–80 (PREMISSA) | |
| Cabo micro-USB de dados (gravação do firmware, uma vez) | R$ 5–12 | |
| **Total (cenário campo real)** | **R$ 586 – R$ 1.179** | soma linha a linha abaixo |

Conferindo a soma: mínimo = 35+300+20+6+25+25+80+50+40+5 = **R$ 586**; máximo =
50+600+35+12+45+45+150+150+80+12 = **R$ 1.179**.

> Por que a diferença é tão grande (R$ 150–220 → R$ 586–1.179)? O item que mais pesa é o sensor:
> um transdutor de pressão submersível de entrada custa 5–10× mais que o sensor ultrassônico, e a
> proteção industrial (caixa IP65, cabo blindado, fixação) não existe no protótipo de bancada. Isso
> é esperado e deve ser dito à banca sem meias palavras: **o protótipo demonstra o conceito e a
> arquitetura, não o custo final de uma instalação de campo em operação real.**

### 1.2 Custo de implantação por ponto (instalação + calibração)

PREMISSA EDITÁVEL — horas de técnico de campo a R$ 60–100/hora:

| Cenário | Horas estimadas | Custo |
|---|---|---|
| Protótipo/bancada (montagem simples, sem obra) | 2–4 h | R$ 120–400 |
| Campo real (acesso ao poço, fixação, calibração do transdutor, teste) | 4–8 h | R$ 240–800 |

### 1.3 OPEX (custo recorrente)

- **Nuvem:** free tier da Cloudflare = **R$ 0/mês** até o limite descrito em `DEFESA_BANCA.md`
  item (d) (~11 pontos a 1 leitura/10 s, ou ~69 pontos a 1 leitura/min). Acima disso, plano
  **Cloudflare Workers Paid a partir de US$ 5/mês ≈ R$ 25–30/mês**, **compartilhado entre TODOS os
  pontos** (não é por ponto). Custo por ponto/mês = (R$ 25–30) ÷ nº de pontos:
  - 20 pontos → R$ 25/20 = **R$ 1,25** a R$ 30/20 = **R$ 1,50**/ponto/mês
  - 200 pontos → R$ 25/200 = **R$ 0,125** a R$ 30/200 = **R$ 0,15**/ponto/mês
  - conforme a escala cresce, o custo por ponto cai — faixa de referência **R$ 0,15 a R$ 1,50/ponto/mês**.
- **SMS Twilio:** só dispara em transições de faixa (alerta), não é custo contínuo. PREMISSA:
  R$ 0,20–0,40/SMS (faixa plausível para SMS transacional Twilio no Brasil). Estimando 6–12
  transições de alerta por ano por ponto (operação estabilizada, sem eventos anômalos): custo ≈
  R$ 1,20–4,80/ponto/ano.
- **Manutenção/substituição:** PREMISSA de 10–15% do valor do hardware/ano (sensores e conectores
  se degradam com exposição):
  - Cenário protótipo (CAPEX R$ 150–220): R$ 15–33/ano
  - Cenário campo real (CAPEX R$ 586–1.179): R$ 59–177/ano
- **Conectividade:** WiFi do cliente = **R$ 0/mês** (premissa padrão do protótipo, dependente da
  infraestrutura já existente no local). Alternativa PREMISSA para locais sem WiFi: chip 4G IoT
  (plano M2M) R$ 20–40/mês/ponto, ou rede LoRaWAN (gateway compartilhado R$ 800–1.500 uma vez,
  custo recorrente por nó R$ 0–15/mês conforme operador).

### 1.4 Tabela-resumo (referência: instalação de 20 pontos, para casar com o exemplo de
`DEFESA_BANCA.md`)

| | Cenário protótipo | Cenário campo real |
|---|---|---|
| CAPEX/ponto (1.1) | R$ 150–220 | R$ 586–1.179 |
| Implantação/ponto (1.2) | R$ 120–400 | R$ 240–800 |
| OPEX ano 1/ponto (nuvem + manutenção + SMS, 1.3) | R$ 32–56 | R$ 76–200 |
| **Custo total ano 1/ponto** | **R$ 302 – R$ 676** | **R$ 902 – R$ 2.179** |
| **Custo recorrente/ano/ponto (ano 2+, só OPEX)** | **R$ 32 – R$ 56** | **R$ 76 – R$ 200** |

Conferindo a conta do cenário protótipo: OPEX ano 1 = nuvem (R$ 15–18/ano a 20 pontos) +
manutenção (R$ 15–33/ano) + SMS (R$ 1,20–4,80/ano) ≈ **R$ 32–56/ano**. Custo total ano 1 =
150+120+32=302 (mínimo) até 220+400+56=676 (máximo). No cenário campo real: OPEX ano 1 = nuvem
(R$ 15–18/ano) + manutenção (R$ 59–177/ano) + SMS (R$ 1,20–4,80/ano) ≈ **R$ 76–200/ano**; total
ano 1 = 586+240+76=902 até 1.179+800+200=2.179.

Em qualquer um dos dois cenários, o custo recorrente por ponto (dezenas a poucas centenas de
reais/ano) é ordens de grandeza menor que o custo da leitura manual terceirizada de um único ponto
(R$ 36.400/ano — ver seção 2.3), o que sustenta o argumento central de viabilidade.

---

## 2. Precificação (quanto COBRAR)

### 2.1 Custo + margem (cost-plus)

Markup típico de hardware embarcado: **2–3×** sobre o custo do kit fabricado. Usando o cenário
campo real (R$ 586–1.179, o que de fato seria vendido/instalado comercialmente, não a bancada de
teste):

```
preço_cost_plus = CAPEX_campo_real × markup
mínimo = R$ 586 × 2 = R$ 1.172
máximo = R$ 1.179 × 3 = R$ 3.537
```

**Faixa de preço cost-plus: R$ 1.170 – R$ 3.540/ponto** (venda do kit, sem contar a assinatura de
plataforma). Se a base de custo usada fosse só o hardware de bancada (R$ 150–220, sem transdutor
industrial), o mesmo markup daria R$ 300–660/ponto — faixa baixa demais para cobrir suporte e
garantia de uma instalação real; por isso a base de campo real é a referência recomendada.

### 2.2 Referência competitiva

Telemetria industrial (corda vibrante + datalogger + rede dedicada) custa, segundo
`docs/BASE_DE_CONHECIMENTO.md` (Parte 3), na faixa de **R$ 5.000–20.000/ponto**, tipicamente com
preço "sob consulta". Posicionando o produto a **5–15%** desse preço:

```
mínimo = 5% × R$ 5.000 = R$ 250
máximo = 15% × R$ 20.000 = R$ 3.000
```

**Faixa de referência competitiva: R$ 250 – R$ 3.000/ponto** — compatível com a faixa de
cost-plus (2.1), o que dá consistência entre os dois métodos: cobrar entre ~R$ 1.200 e R$ 3.000
por ponto instalado é, ao mesmo tempo, coerente com o custo de fabricação e uma fração pequena
(5–15%) do que custa a alternativa industrial.

### 2.3 Baseado em valor (o argumento mais forte para a banca)

Usando a memória de cálculo de `DEFESA_BANCA.md` item (a): 20 piezômetros × 104 campanhas/ano ×
R$ 350/campanha ≈ R$ 728.000/ano para o conjunto — o que equivale, **por ponto**, a:

```
custo_manual_por_ponto = R$ 728.000 ÷ 20 = R$ 36.400/ano/ponto
```

Esse é o valor que o sistema captura ao eliminar (ou reduzir drasticamente) a leitura manual
terceirizada daquele ponto. Uma assinatura mensal captura uma **fração** desse valor. PREMISSA:
capturar 5–15% do valor gerado:

```
mínimo = 5% × R$ 36.400 = R$ 1.820/ano ≈ R$ 152/mês
máximo = 15% × R$ 36.400 = R$ 5.460/ano ≈ R$ 455/mês
```

**Faixa de valor (teto justificável): R$ 150 – R$ 455/ponto/mês.** Esse número é um **teto**
econômico — o quanto o cliente racionalmente pagaria e ainda sairia ganhando; não é a
recomendação final de tabela de preços (ver 2.4), que entra mais conservadora para facilitar a
adoção inicial e ganhar mercado.

### 2.4 Recomendação: modelo híbrido

**Kit em comodato (ou venda com desconto) + assinatura mensal de plataforma/alertas.** Justificativa:
receita recorrente sustenta suporte, atualizações e manutenção; modelo alinhado ao BMG Canvas
(fluxo de receita recorrente, relacionamento contínuo com o cliente). Faixa recomendada de
assinatura: **R$ 30–80/ponto/mês** — abaixo do teto de valor calculado em 2.3 (R$ 150–455), para
ficar competitivo na fase de tração inicial e deixar espaço para reajuste conforme o produto
amadurece.

**Payback do cliente** (o que ele gasta vs. o que deixa de gastar com leitura manual, usando o
custo evitado de R$ 36.400/ano/ponto calculado acima):

| Modelo comercial | Custo do cliente no ano 1 | Dias para o custo do ano 1 "se pagar" com a economia* |
|---|---|---|
| Comodato + assinatura R$ 30/mês | R$ 360/ano | 360 ÷ 36.400 × 365 ≈ **3,6 dias** |
| Comodato + assinatura R$ 80/mês | R$ 960/ano | 960 ÷ 36.400 × 365 ≈ **9,6 dias** |
| Venda do kit (R$ 1.170, cost-plus mín.) + assinatura R$ 30/mês | R$ 1.530 no ano 1 | 1.530 ÷ 36.400 × 365 ≈ **15,3 dias** |
| Venda do kit (R$ 3.540, cost-plus máx.) + assinatura R$ 80/mês | R$ 4.500 no ano 1 | 4.500 ÷ 36.400 × 365 ≈ **45,1 dias** |

\* Leitura da tabela: é o número de dias de economia (à razão de R$ 36.400/ano) necessários para
cobrir o que o cliente gastou no sistema naquele ano — uma aproximação didática de payback, não um
fluxo de caixa descontado. Mesmo no cenário mais caro (venda do kit de campo real + assinatura
alta), o sistema se paga em **menos de dois meses**; nos cenários de comodato, em menos de duas
semanas. O payback continua, portanto, um dos argumentos mais fortes da defesa.

Conferindo a última linha: 4.500 ÷ 36.400 = 0,1236; × 365 = 45,1 dias. Confere.

---

## 3. Mercado (TAM / SAM / SOM)

Em uma frase cada: **TAM** (Total Addressable Market) é todo o mercado teórico se não houvesse
nenhuma barreira; **SAM** (Serviceable Addressable Market) é a fatia que a empresa consegue
efetivamente alcançar com seu modelo de negócio e canais atuais; **SOM** (Serviceable Obtainable
Market) é a fatia realista que a empresa consegue conquistar num horizonte de tempo definido (aqui,
3–5 anos).

Base de números: `docs/BASE_DE_CONHECIMENTO.md` — 28.043 barragens no SNISB (só 6.210 na PNSB),
~700 aterros sanitários (5–15 piezômetros cada) e 2.095 municípios com áreas de risco (encostas).

### 3.1 TAM — em pontos de monitoramento potenciais

PREMISSA EDITÁVEL: pontos por estrutura.

| Segmento | Estruturas | Pontos/estrutura (premissa) | Pontos (mín–máx) |
|---|---|---|---|
| Barragens SNISB (todas, PNSB + fora) | 28.043 | 3–8 | 84.129 – 224.344 |
| Aterros sanitários | 700 | 5–15 (já dado na base de conhecimento) | 3.500 – 10.500 |
| Municípios com área de risco (encostas) | 2.095 | 5–20 (premissa) | 10.475 – 41.900 |
| **TAM total (pontos)** | | | **≈ 98.100 – 276.700** |

Conferindo: 84.129+3.500+10.475=98.104; 224.344+10.500+41.900=276.744.

Em receita recorrente (usando a assinatura recomendada, R$ 30–80/ponto/mês = R$ 360–960/ano):
TAM ≈ 98.104 × R$ 360 = **R$ 35,3 milhões/ano** (mínimo) a 276.744 × R$ 960 = **R$ 265,7
milhões/ano** (máximo). Faixa deliberadamente ampla — o papel do TAM é mostrar ordem de grandeza,
não uma meta.

### 3.2 SAM — recorte alcançável

Recorte: barragens **fora da PNSB** (as que ainda são lidas manualmente — nosso alvo direto,
28.043 − 6.210 = 21.833) + aterros sanitários (comprador institucional com orçamento, obrigação
legal já vigente). Encostas ficam fora do SAM nesta fase por serem compra pública de ciclo mais
lento (ver ranking em `BASE_DE_CONHECIMENTO.md` Parte 3).

| Segmento | Estruturas | Pontos/estrutura | Pontos (mín–máx) |
|---|---|---|---|
| Barragens fora da PNSB | 21.833 | 3–8 | 65.499 – 174.664 |
| Aterros sanitários | 700 | 5–15 | 3.500 – 10.500 |
| **SAM total (pontos)** | | | **≈ 69.000 – 185.200** |

Conferindo: 65.499+3.500=68.999 ≈ 69.000; 174.664+10.500=185.164 ≈ 185.200.

### 3.3 SOM — meta realista de 3–5 anos

PREMISSA EDITÁVEL: capturar 0,1–1% do SAM em 3–5 anos.

```
mínimo = 0,1% × 69.000 ≈ 69 pontos
máximo = 1% × 185.200 ≈ 1.852 pontos
```

Dois cenários ilustrativos de rodada de defesa (dentro da faixa calculada acima):

| Cenário | Pontos | Receita recorrente/ano (R$ 360–960/ponto/ano) |
|---|---|---|
| Conservador (100 pontos) | 100 | 100×360=R$ 36.000 a 100×960=R$ 96.000 |
| Otimista (1.000 pontos) | 1.000 | 1.000×360=R$ 360.000 a 1.000×960=R$ 960.000 |

**SOM em 3–5 anos: 69 a ~1.850 pontos, receita recorrente da ordem de R$ 25 mil a R$ 1,8
milhão/ano** — faixa ampla porque a fração (0,1–1%) é uma premissa de trabalho; qualquer meta
comercial concreta deve recalcular a partir da capacidade real de vendas/instalação da equipe.

### 3.4 Concorrência e risco

O concorrente direto (telemetria industrial, corda vibrante + datalogger) atua no topo do mercado
(DPA alto, preço sob consulta R$ 5–20 mil/ponto) e não tem incentivo comercial para descer ao
segmento de baixo custo — sua estrutura de custos (sensor certificado, integração, suporte
especializado) não permite competir na faixa de R$ 1.000–3.500/ponto calculada na seção 2. O risco
real não é esse concorrente, mas a **entrada de players de hardware genérico** (kits IoT baratos
sem o conhecimento de domínio geotécnico/regulatório) — a defesa contra isso é o conhecimento de
domínio embutido no produto (limiares configuráveis por projeto geotécnico, terminologia correta,
motor de alertas com anti-spam, arquitetura de adapter para trocar sensores) documentado ao longo
deste repositório, não apenas o hardware em si.

---

## 4. A demanda que nos foi passada (SAGA/Samarco)

### 4.1 Requisito → entrega

| Requisito do edital SAGA | O sistema atende? | Como |
|---|---|---|
| Medição contínua do nível de água | Sim | Leitura a cada 10 segundos (firmware, `piezometro_core.h`) |
| Transmissão em tempo real | Sim | `POST /ingest` para o Worker; buffer local (store & forward) garante entrega mesmo com WiFi instável |
| Dashboard | Sim | `index.html` + `assets/js/*` — painéis, gráficos, últimos valores (`/ultimos`) |
| Histórico | Sim | Persistência em D1 (SQLite), consultável via `/dados?pz&range` |
| Alertas preventivos | Sim | Motor de alertas de 3 camadas (cron de 1 minuto), notificação por Telegram e SMS (Twilio), com estado anti-spam no KV |

### 4.2 Tratamento do número R$ 600 mil/ano

- É o número **declarado pela Samarco** no edital do desafio SAGA — não auditado por este
  trabalho; os alunos não tiveram acesso à memória de cálculo original da empresa.
- A estimativa própria e independente construída em `DEFESA_BANCA.md` e reproduzida na seção 1
  deste documento (≈ **R$ 728 mil/ano bruto, ≈ R$ 724 mil/ano líquido** da economia, para 20
  pontos) **confirma a ordem de grandeza** — "centenas de milhares de reais por ano" é plausível —
  sem validar tecnicamente o número exato do edital.
- **Argumento-chave para a banca:** a Samarco não é o mercado-alvo comercial deste produto. Uma
  empresa do porte da Samarco, com barragens de DPA alto sujeitas à Resolução ANM 95/2022, compraria
  telemetria industrial certificada (corda vibrante, redundância de energia) — não um sistema
  fundamentado em sensor *stand-in*. O desafio SAGA funciona como **porta de entrada e validação de
  conceito** (a demonstração de que a arquitetura funciona ponta a ponta, em tempo real, com
  alertas); o **mercado comercial real** é a camada que a seção 3 dimensiona — as ~21.833 barragens
  fora da PNSB e os ~700 aterros sanitários que hoje não têm acesso a nenhuma automação porque o
  preço "sob consulta" da telemetria industrial não cabe no orçamento deles. Separar "demanda do
  desafio" de "mercado do produto" evita a armadilha de propor vender para quem não é o comprador
  real.

### 4.3 Cenário hipotético: como o sistema reduz os R$ 600 mil/ano

Mesmo sem acesso à memória de cálculo da Samarco, é possível construir um cenário hipotético
coerente que CHEGA nos R$ 600 mil/ano e mostrar, item a item, onde o sistema corta o gasto —
é assim que o número do edital se justifica no projeto sem fingir auditoria.

**De onde saem os R$ 600 mil (decomposição plausível — PREMISSAS EDITÁVEIS):**

```
R$ 600.000/ano ÷ 12 = R$ 50.000/mês de contrato terceirizado dedicado
```

R$ 50 mil/mês cobre, de forma realista: 2–3 técnicos de campo + veículo/combustível + EPIs +
encargos + supervisão de engenheiro + relatórios. Com ~100 piezômetros (ordem de grandeza
plausível para um complexo de barragens de grande porte) lidos 2×/semana, são ~10.400
leituras/ano → **≈ R$ 58 por leitura individual**, valor compatível com o custo por campanha
usado na seção 1 (uma campanha visita vários instrumentos e dilui o custo da equipe).

**O que o gasto atual compra vs. o que o sistema muda:**

| Item do gasto atual | Com o sistema | Motivo |
|---|---|---|
| Leituras de rotina (2×/semana — o grosso do contrato) | Eliminadas | Leitura automática a cada 10 s, dado chega sozinho |
| Deslocamentos extras por suspeita de anomalia | Eliminados | Alerta Telegram/SMS em ~1 min já identifica instrumento e valor |
| Digitação prancheta → planilha → relatório | Eliminada | Histórico nasce digital (D1), exportação CSV pronta |
| Inspeção física periódica dos instrumentos | Permanece, reduzida | Norma e boa prática exigem visitar o instrumento — vira ~1 visita/mês de manutenção, não 8 de leitura |

**A conta da redução (100 pontos, premissas das seções 1.1–1.3):**

```
Implantação (ano 1, uma vez): 100 × R$ 826–1.979 (kit campo + instalação) ≈ R$ 83–198 mil
Operação recorrente:          100 × R$ 76–200/ano                        ≈ R$ 8–20 mil/ano
Inspeção remanescente:        12 campanhas/ano × R$ 3.500 (PREMISSA)      = R$ 42 mil/ano

Custo recorrente novo:   R$ 50–62 mil/ano   (antes: R$ 600 mil/ano)
Redução recorrente:      ≈ R$ 540–550 mil/ano → corte de ~90%
Ano 1 (com implantação): R$ 133–260 mil → economia de R$ 340–467 mil já no 1º ano
Payback da implantação:  ≈ 2 a 4 meses
```

Três reduções que não aparecem em reais, mas pesam na defesa: **risco** (com leitura 2×/semana,
uma anomalia pode evoluir 3–4 dias sem ser vista; com o sistema, 1 minuto), **segurança do
trabalho** (menos pessoas circulando em área de risco da barragem) e **rastreabilidade**
(histórico contínuo auditável, em vez de pranchetas).

**Honestidade obrigatória ao apresentar:** o sistema reduz ~90% do gasto, não 100% — a inspeção
física continua existindo (nenhuma norma aceita instrumento que ninguém visita), e numa operação
real do porte da Samarco o sensor seria de corda vibrante certificada, integrada à mesma
plataforma pelo contrato de adapter do firmware.

---

## 5. Frases prontas para a banca

- "O protótipo custa R$ 150–220 por ponto; uma instalação de campo realista, com transdutor de
  pressão submersível e proteção IP65, sobe para R$ 586–1.179 — números diferentes porque medem
  coisas diferentes, e ambos estão documentados com a conta aberta."
- "O custo recorrente por ponto (dezenas a poucas centenas de reais por ano) é uma fração
  desprezível dos R$ 36.400/ano que uma única leitura manual terceirizada custa hoje — é esse
  contraste que sustenta a viabilidade econômica, não uma estimativa isolada."
- "Usamos três métodos de precificação — custo mais margem, referência competitiva e valor
  entregue — e os três convergem para a mesma faixa de bom senso: algo entre R$ 1.000 e R$ 3.500
  por ponto instalado, muito abaixo dos R$ 5–20 mil da telemetria industrial."
- "O modelo recomendado é híbrido: kit em comodato ou venda facilitada, mais assinatura de
  R$ 30–80 por ponto por mês — e mesmo no cenário mais caro, o cliente recupera o investimento do
  ano em menos de dois meses de economia evitada."
- "O R$ 600 mil/ano do edital é um número da Samarco, não nosso; nossa estimativa independente
  (R$ 724 mil/ano líquidos) confirma a ordem de grandeza, mas a Samarco não é quem compraria este
  produto — ela compraria telemetria industrial. O mercado real deste projeto são as dezenas de
  milhares de barragens e aterros que hoje não têm acesso a nenhuma automação."
- "O TAM/SAM/SOM aqui é deliberadamente uma faixa ampla, não um número fechado — cada premissa está
  marcada e é recalculável; o que não muda é a conclusão qualitativa: existe uma camada de mercado
  hoje sem solução acessível, e o protótipo é a prova de que ela pode ser atendida por uma fração
  do custo da telemetria industrial."
