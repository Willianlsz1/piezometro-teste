# Homologação da UCT em Bancada: Protocolo Pré-Piloto

> Protocolo de ensaios para homologar a **primeira UCT (Unidade de Controle e Telemetria) AquaSense**
> montada (integração sensor + condicionamento + firmware + nuvem) na bancada de PVC de 2 m, antes
> de liberar a unidade para o piloto de campo (fase 2 do roadmap, ver
> [`PROJETO_INDUSTRIAL.md`](PROJETO_INDUSTRIAL.md) seção 9). Especificação de hardware, arquitetura
> e BOM: [`PROJETO_INDUSTRIAL.md`](PROJETO_INDUSTRIAL.md) seções 3 a 6. Coerência de custos, quando
> citados: [`VIABILIDADE_ECONOMICA.md`](VIABILIDADE_ECONOMICA.md).

---

## 1. Objetivo e escopo

Este documento homologa a **UCT completa**: transdutor piezométrico 4-20 mA submersível,
condicionamento (shunt 150 Ω + ADS1115), firmware do ESP32 industrial e a cadeia de nuvem
(ingestão, D1, dashboard, alertas) já validada pelo protótipo. É um ensaio de **integração de
instrumento**, não de arquitetura de software: o Worker, o D1 e o motor de alertas já foram
provados pelo protótipo didático e não são reavaliados aqui, exceto no papel de receptor das
leituras da UCT durante o ensaio de resistência (etapa E4).

**Diferença para [`VALIDACAO_SENSOR.md`](../prototipo/VALIDACAO_SENSOR.md):** aquele documento
valida a precisão do JSN-SR04T ultrassônico, o sensor stand-in da maquete didática, medindo coluna
d'água de cima para baixo em balde ou tubo aberto. Este documento valida um instrumento diferente:
o transdutor piezométrico industrial de 4-20 mA, submerso na coluna d'água, com toda a cadeia
elétrica de condicionamento (shunt, ADC) que o stand-in ultrassônico não tem. O **método
estatístico de exatidão** (etapa E3) é o mesmo dos dois documentos e é reutilizado, não reescrito:
erro médio, desvio padrão, erro máximo e incerteza a 2σ, conforme
[`VALIDACAO_SENSOR.md`](../prototipo/VALIDACAO_SENSOR.md) seção 4. As fórmulas não são repetidas
aqui.

**Fora de escopo:** ensaio de campo real (piloto, fase 2), certificação rastreável por laboratório
acreditado, e qualquer requisito exclusivo de barragem de DPA alto (redundância de energia e de
comunicação, ver `PROJETO_INDUSTRIAL.md` seção 8), fora do padrão a que este protótipo se propõe.

**Critério de saída:** a UCT só é liberada para o piloto se **todos** os critérios de go/no-go da
seção 5 forem atendidos. Reprovação em qualquer etapa significa corrigir e repetir aquela etapa,
nunca seguir em frente com ressalva.

---

## 2. Física do ensaio

**Sensibilidade do transdutor** (0-5 m H₂O, saída 4-20 mA):

```
Sensibilidade = (20 mA - 4 mA) / (5 m - 0 m) = 16 mA / 5 m = 3,2 mA/m
```

**Tensão sobre o shunt de 150 Ω** (decisão fechada em `PROJETO_INDUSTRIAL.md` seção 10):

```
V = I × R
Em 4 mA:  V = 0,004 A × 150 Ω = 0,600 V
Em 20 mA: V = 0,020 A × 150 Ω = 3,000 V
```

Faixa de tensão do transdutor completo (0-5 m): **0,6 a 3,0 V**. Sensibilidade em tensão:
3,2 mA/m × 150 Ω = 480 mV/m = **0,48 V/m**.

**Excursão real na bancada de 2 m** (cobre só os primeiros 2 m dos 5 m de fundo de escala):

```
Seco (0 m):  I = 4 + 3,2×0 = 4,0 mA   →  V = 4,0 mA × 150 Ω = 0,600 V
Cheio (2 m): I = 4 + 3,2×2 = 10,4 mA  →  V = 10,4 mA × 150 Ω = 1,560 V
```

A bancada excursiona de **4,0 a 10,4 mA** (0,6 a 1,56 V), cerca de 40% da faixa elétrica total do
transdutor. Isso é esperado: a bancada serve para exatidão e resistência, não para varrer o fundo
de escala completo (exigiria coluna de 5 m).

**Tabela de referência esperada** (I = 4 + 3,2 × h; V = I × 0,150):

| Altura de água (m) | Corrente esperada (mA) | Tensão no shunt (V) |
|---|---|---|
| 0,0 | 4,00 | 0,600 |
| 0,5 | 5,60 | 0,840 |
| 1,0 | 7,20 | 1,080 |
| 1,5 | 8,80 | 1,320 |
| 2,0 | 10,40 | 1,560 |

Conferência: cada passo de 0,5 m soma 1,6 mA (3,2 × 0,5) e 0,24 V (0,48 × 0,5) sobre o ponto
anterior. Bate em todas as linhas da tabela.

**Resolução teórica do ADS1115 frente ao critério de aceitação.** Com PGA em ±4,096 V (ajuste
adequado à faixa de 0,6 a 3,0 V do transdutor):

```
Resolução = 4,096 V / 2^15 bits úteis = 4,096 / 32768 = 125,0 µV/bit

Resolução em altura = 125,0 µV/bit ÷ 0,48 V/m = 0,0002604 m/bit ≈ 0,26 mm por bit
```

O ADC sozinho resolve cerca de **0,26 mm** por bit, muitíssimo abaixo do critério de exatidão de
±3 cm (seção 5): a resolução do conversor não é o fator limitante. O que a etapa E3 mede é o erro
do sistema completo (transdutor + condicionamento + calibração + firmware), dominado pela exatidão
do próprio transdutor (0,5% do fundo de escala), não pela resolução do ADC.

---

## 3. Materiais e segurança

| Item | Papel no ensaio |
|---|---|
| Bancada de PVC vertical, 2 m, com válvula de drenagem na base | Ambiente de teste controlado, esvazia rápido entre alturas |
| Trena ou régua rígida, resolução ≥ 1 mm | Referência de altura "verdadeira" para calibração e exatidão |
| Multímetro com medição de corrente DC em série | Verificação do loop (E1) e conferência cruzada em E3 |
| Multímetro (ou segundo) para tensão DC | Leitura da tensão no shunt, conferência cruzada com o ADS1115 |
| Fonte de bancada ou bateria compatível com o loop | Alimentação do transdutor e do condicionamento |
| UCT completa montada: transdutor + shunt 150 Ω + ADS1115 + ESP32 + firmware | Objeto do ensaio |
| Acesso à internet/WiFi ou celular, conforme a via da unidade | Necessário para E4 e E5 |
| EPI básico (luvas, calçado fechado) | Manuseio de água e eletrônica energizada |
| Cronômetro ou relógio confiável | Marcação dos eventos temporizados de E4 |

**Segurança elétrica:** água e eletrônica energizada não se misturam. Antes de qualquer manuseio
próximo à bancada com água presente, desenergize o loop. A etapa E1 (verificação a seco, sem o
ADS1115 ligado) protege o conversor de uma corrente fora da faixa esperada antes de ele entrar no
circuito; não pule essa ordem. Confirme aterramento e proteção contra surto (DPS) na entrada de
energia e no loop de sinal, conforme `PROJETO_INDUSTRIAL.md` seção 4.6, mesmo em bancada: o hábito
de bancada é o que se leva para o campo.

---

## 4. Etapas do ensaio

### E1. Verificação elétrica do loop (a seco)

Confirmar a corrente de repouso esperada (4,0 mA a seco) **antes** de conectar o ADS1115, para
proteger o conversor.

1. Bancada vazia e drenada; monte o loop (transdutor + fonte) sem o ADS1115.
2. Multímetro em série no loop, modo corrente DC.
3. Energize e aguarde estabilização.
4. Compare a corrente lida com 4,0 mA ± tolerância do fabricante (registrar o valor do datasheet).
5. Só depois de aprovar, insira o ADS1115 (shunt em série, entrada diferencial sobre o shunt).

| Grandeza | Esperado | Medido | Dentro da tolerância? |
|---|---|---|---|
| Corrente a seco (0 m) | 4,0 mA ± tolerância do fabricante | | Sim / Não |

Se "Não": não conecte o ADS1115; investigue fiação, alimentação e o transdutor antes de repetir.

### E2. Calibração de dois pontos

Gravar no firmware os coeficientes que convertem a leitura bruta do ADS1115 em metros de coluna
d'água.

1. Ponto 1 (zero): bancada vazia; registre a leitura bruta correspondente a 0 m.
2. Ponto 2 (referência): encha até uma altura medida com trena (sugestão 1,5 ou 2,0 m, para
   maximizar a distância entre pontos); registre a leitura bruta.
3. Calcule offset e ganho da reta que mapeia leitura bruta → metros.
4. Grave os coeficientes no firmware (mesmo princípio já usado no protótipo físico, ver
   `PROJETO_INDUSTRIAL.md` seção 7.2).
5. Verifique nos dois pontos que o valor convertido bate com a altura conhecida.

| Ponto | Altura conhecida (m) | Leitura bruta do ADS1115 | Nível convertido (m) | Diferença |
|---|---|---|---|---|
| 1 (zero) | 0,000 | | | |
| 2 (referência) | | | | |

### E3. Curva de exatidão

Quantificar o erro do sistema completo nas cinco alturas da tabela §2, com o método estatístico de
[`VALIDACAO_SENSOR.md`](../prototipo/VALIDACAO_SENSOR.md) seção 4 (erro médio, desvio padrão, erro
máximo, incerteza a 2σ).

1. Para cada altura (0 / 0,5 / 1,0 / 1,5 / 2,0 m): encha até a marca da trena, aguarde
   estabilização, colete **10 leituras** consecutivas do nível reportado pelo dashboard (ou log
   serial).
2. Confira com o multímetro corrente e tensão em pelo menos uma leitura por altura, comparando com
   a tabela §2 (divergência grande indica problema de condicionamento, não só de calibração).
3. Calcule erro médio, desvio padrão e erro máximo por altura (fórmulas em `VALIDACAO_SENSOR.md`
   seção 4).
4. Tome o maior desvio padrão entre as 5 alturas; a incerteza declarada é 2× esse valor.

Tabela por altura (repetir 5 vezes):

| Altura real (m): _____ | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Nível reportado (m) | | | | | | | | | | |

Tabela-resumo:

| Altura real (m) | Corrente medida (mA) | Tensão medida (V) | Média do nível (m) | Erro médio (cm) | Desvio padrão (cm) | Erro máximo (cm) |
|---|---|---|---|---|---|---|
| 0,0 | | | | | | |
| 0,5 | | | | | | |
| 1,0 | | | | | | |
| 1,5 | | | | | | |
| 2,0 | | | | | | |

### E4. Ensaio de resistência de 72 horas

Validar operação contínua com dois eventos provocados que exercitam *store & forward* e
recuperação de energia.

1. Com a UCT calibrada (E2) e aprovada em exatidão (E3), inicie operação contínua com altura
   estável na bancada (o foco é continuidade de comunicação, não exatidão).
2. **Evento 1, corte de rede:** desconecte a conectividade por **no mínimo 1 hora**, com o firmware
   gravando localmente. Reconecte e confirme que o D1 não tem lacuna: as leituras do período do
   corte devem chegar com o timestamp original, não o de reenvio.
3. **Evento 2, corte de energia:** desligue a alimentação por 10-30 min e religue. Confirme: (a)
   retomada automática, sem intervenção manual; (b) o motor de alertas do Worker dispara
   "instrumento silencioso" durante a janela sem dado (RF6 de `PROJETO_INDUSTRIAL.md`), nunca
   tratando ausência de dado como normal.
4. Ao final, exporte o histórico do período (dashboard, CSV) e confira: leituras esperadas pela
   cadência configurada contra recebidas, lacunas fora dos dois eventos provocados, e ausência de
   duplicatas (mesma leitura/timestamp gravada mais de uma vez; o dedupe deve impedir isso).
5. Confira a deriva do RTC: compare com referência confiável (NTP/celular) e divida a deriva
   acumulada pelos 3 dias do ensaio.

| Item | Esperado | Observado |
|---|---|---|
| Início / fim do ensaio | | |
| Duração total | 72 h | |
| Corte de rede: início / duração | ≥ 1 h | |
| Corte de rede: lacuna após reconexão? | Não | |
| Corte de energia: início / duração | | |
| Recuperação automática após corte de energia? | Sim, sem intervenção manual | |
| Alerta de instrumento silencioso disparado? | Sim | |
| Leituras esperadas / recebidas | | |
| Lacunas fora dos eventos provocados | Nenhuma | |
| Duplicatas no histórico | Nenhuma | |
| Deriva do RTC por dia | < 2 s/dia | |

### E5. Ensaio de energia

Medir o consumo real da UCT e comparar com a previsão de projeto.

1. Com a UCT em operação normal (mesma configuração de E4), meça a corrente média ao longo de um
   ciclo completo de leitura/transmissão (pico ativo + repouso, deep sleep ou sempre-ligado,
   conforme o modo em teste).
2. Calcule o consumo diário e compare com a previsão: **~30 Wh/dia** sempre-ligado ou
   **< 1 Wh/dia** em deep sleep (`PROJETO_INDUSTRIAL.md` seção 4.4).
3. Se com kit solar (painel 20 W + PWM + bateria selada 12 V 18 Ah, `PROJETO_INDUSTRIAL.md`
   seção 10), acompanhe **um ciclo dia/noite completo** e confirme ausência de queda anormal de
   tensão da bateria durante a noite.

| Grandeza | Previsto | Medido | Dentro de ±20%? |
|---|---|---|---|
| Consumo diário (Wh/dia), modo em teste | 30 Wh/dia (sempre-ligado) ou < 1 Wh/dia (deep sleep) | | Sim / Não |
| Queda de tensão da bateria à noite (se com kit solar) | Sem queda anormal, recuperação total no dia seguinte | | Sim / Não |

---

## 5. Critérios de aceitação (go/no-go)

| Critério | Limite de aceitação | Etapa | Resultado |
|---|---|---|---|
| Exatidão em toda a faixa | ±3 cm (0,5% FS = 2,5 cm, mais margem de montagem) | E3 | Go / No-go |
| Repetibilidade | 2σ ≤ 2 cm | E3 | Go / No-go |
| Continuidade de dados em 72 h | Sem perda nem duplicata fora dos eventos provocados | E4 | Go / No-go |
| Recuperação do corte de rede | Automática, sem lacuna após reconexão | E4 | Go / No-go |
| Recuperação do corte de energia | Automática, sem intervenção, com alerta de silêncio | E4 | Go / No-go |
| Deriva do RTC | < 2 s/dia | E4 | Go / No-go |
| Consumo de energia | Dentro de ±20% do previsto | E5 | Go / No-go |

**Regra de decisão:** qualquer linha "No-go" bloqueia a liberação para o piloto. Corrija a causa
(recalibrar, revisar firmware, revisar condicionamento, revisar dimensionamento de energia,
conforme o caso) e **repita a etapa que reprovou**; nunca registre "aceito com ressalva". Só a UCT
com todas as linhas em "Go" está homologada para instalação em campo.

---

## 6. Registro e rastreabilidade

1. **Planilha de bancada:** tabelas preenchidas das etapas E1 a E5 (papel digitalizado ou planilha
   eletrônica), com data, responsável técnico e número de série da UCT testada.
2. **Export CSV do dashboard:** exportação do período completo do ensaio de resistência (E4, as
   72 h), pela função já existente (`assets/js/exportar.js`), como evidência independente das
   tabelas manuais: permite conferir depois o número de leituras, os timestamps e a ausência de
   lacunas/duplicatas, sem repetir o ensaio.
3. **Arquivo dos coeficientes de calibração** gravados na etapa E2, para rastreabilidade caso a
   unidade precise de recalibração futura em campo.

**Frase de aceite final**, a preencher e assinar quando todos os critérios da seção 5 estiverem em
"Go":

> "A UCT nº ___ foi homologada em __/__/____ com incerteza de ±__ cm (2σ, etapa E3), consumo
> medido de __ Wh/dia frente à previsão de __ Wh/dia (etapa E5), zero perdas e zero duplicatas no
> ensaio de resistência de 72 horas (etapa E4), recuperação automática confirmada nos dois eventos
> de corte provocados, e deriva de RTC de __ s/dia. Responsável técnico: ___________. Liberada para
> instalação no piloto de campo conforme `PROJETO_INDUSTRIAL.md` seção 9, fase 2."
