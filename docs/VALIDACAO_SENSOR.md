# Validação Experimental do Sensor JSN-SR04T

Protocolo simples, executável em **uma tarde**, para gerar os números de precisão que faltam nas
seções "Viabilidade Técnica" e "Resultados e Conclusão" do TCC. Gera uma incerteza declarada
(ex.: "nível ±X cm na faixa 0,2–0,6 m") em vez de uma afirmação vaga de que "o sensor funciona bem".

> ⚠️ **O que isto valida — e o que não valida:** este protocolo mede a precisão do **JSN-SR04T
> como stand-in de coluna d'água** (o sensor usado na maquete física). Ele **não** valida um
> piezômetro de corda vibrante de verdade. Uma validação real de piezômetro exigiria: (1) um
> instrumento de referência certificado/calibrado (não uma régua) para servir de "verdade
> terrestre", (2) ensaio em câmara de pressão controlada simulando poropressão real no solo, e
> (3) comparação em campo contra um piezômetro Casagrande já instalado (o "testemunha" clássico
> da instrumentação geotécnica). Isto está fora do escopo de um TCC de graduação técnica — e deve
> ser dito exatamente assim para a banca.

---

## 1. Materiais

| Item | Observação |
|---|---|
| Balde ou tubo transparente/translúcido, altura ≥ 50 cm | O mesmo recipiente da maquete física (ver `PROTOTIPO_FISICO.md`) serve |
| Régua ou trena | Resolução de pelo menos 1 mm, para marcar as alturas de referência |
| Água | Suficiente para encher o recipiente até ~60 cm |
| Maquete montada (ESP32 + JSN-SR04T) rodando `firmware/sketch_fisico_jsn_sr04t.ino` | Com o Serial Monitor aberto a 115200 baud |
| Jarra ou recipiente para adicionar água aos poucos | Facilita controlar o nível com precisão |
| Planilha (papel ou Excel/Sheets) para anotar as leituras | Modelo de tabela na seção 3 |

---

## 2. Procedimento

1. **Zere a referência:** com o recipiente vazio, confirme que a distância medida bate com
   `ALTURA_SENSOR_CM` (o valor medido na montagem, ver `PROTOTIPO_FISICO.md` seção 4). Se não bater,
   recalibre antes de continuar — todo o experimento fica errado se o zero estiver errado.

2. **Escolha 5 alturas de água conhecidas**, espaçadas ao longo da faixa útil do sensor (lembrando
   da zona morta de ~25 cm — a água nunca deve chegar perto do sensor). Sugestão, alinhada aos
   limiares do sistema (escala didática `ESCALA_M_POR_CM = 0,5`, ou seja, 1 cm de água = 0,5 m de
   "nível"):

   | Altura real de água | Nível equivalente no sistema | Faixa |
   |---|---|---|
   | 10 cm | 5,0 m | Normal |
   | 18 cm | 9,0 m | Normal |
   | 24 cm | 12,0 m | Limiar ATENÇÃO |
   | 27 cm | 13,5 m | Atenção |
   | 30 cm | 15,0 m | Limiar CRÍTICO |

3. **Para cada altura:**
   - Encha o recipiente com a jarra até a marca medida com a régua (confira duas vezes — este é o
     valor "verdadeiro" contra o qual tudo é comparado).
   - Espere a água parar de balançar (~5 s) para não medir onda.
   - Leia o valor de distância/nível impresso no Serial Monitor **10 vezes seguidas**, com um
     intervalo de alguns segundos entre leituras (o firmware já envia a cada 10 s; aproveite os
     ciclos naturais, ou force leituras manuais se o firmware tiver esse modo).
   - Anote as 10 leituras na tabela.

4. **Repita para as 5 alturas**, sempre esvaziando parcialmente ou completando a água com cuidado
   para não sujar a leitura.

---

## 3. Tabela para preencher

Uma tabela por altura. Copie este modelo 5 vezes (uma para cada linha da tabela da seção 2).

| Altura real (cm): _____ | Leitura 1 | Leitura 2 | Leitura 3 | Leitura 4 | Leitura 5 | Leitura 6 | Leitura 7 | Leitura 8 | Leitura 9 | Leitura 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Distância medida (cm) | | | | | | | | | | |
| Nível calculado (m) | | | | | | | | | | |

Depois de preencher as 5 tabelas, monte um resumo:

| Altura real (cm) | Média medida (cm) | Erro médio (cm) | Desvio padrão (cm) | Erro máximo (cm) |
|---|---|---|---|---|
| 10 | | | | |
| 18 | | | | |
| 24 | | | | |
| 27 | | | | |
| 30 | | | | |

---

## 4. Fórmulas explicadas de forma simples

Para cada altura real, você tem 10 leituras medidas: x₁, x₂, ..., x₁₀. Seja `h_real` a altura
verdadeira (medida com régua).

### 4.1 Erro de cada leitura
```
erro_i = x_i − h_real
```
É simplesmente "quanto a leitura errou" — pode ser positivo (mediu a mais) ou negativo (mediu a
menos).

### 4.2 Erro médio
```
erro_médio = (erro_1 + erro_2 + ... + erro_10) / 10
```
Mostra se o sensor tem uma tendência sistemática de errar para mais ou para menos (viés/bias). Se
o erro médio for grande, é sinal de que a calibração (`ALTURA_SENSOR_CM`) precisa de ajuste, não
que o sensor é ruim.

### 4.3 Desvio padrão
```
desvio_padrão = raiz_quadrada( soma((x_i − média)²) / (10 − 1) )
```
Mostra o quanto as leituras variam **entre si** (ruído/instabilidade), independente do viés. É a
métrica mais importante para declarar a incerteza do sensor: um desvio padrão pequeno significa
leituras repetíveis, mesmo que exista um viés fixo que pode ser corrigido por calibração.

### 4.4 Erro máximo
```
erro_máximo = maior valor de |erro_i| entre as 10 leituras
```
O pior caso observado — útil para declarar um limite de segurança ("na pior leitura, o sensor
errou até X cm").

### 4.5 Exemplo numérico (FICTÍCIO — só para ilustrar o cálculo, não são dados reais)

> ⚠️ Os números abaixo são inventados apenas para mostrar como aplicar as fórmulas. Substitua pelos
> valores que vocês realmente coletarem no experimento.

Altura real: 24 cm. Dez leituras fictícias (cm): 24,3 / 23,8 / 24,5 / 24,1 / 23,9 / 24,4 / 24,0 /
24,6 / 23,7 / 24,2.

- Média = 24,15 cm
- Erro médio = 24,15 − 24 = **+0,15 cm** (leve tendência de medir a mais)
- Desvio padrão ≈ **0,30 cm**
- Erro máximo = |24,6 − 24| = **0,6 cm**

Convertendo para o nível do sistema (escala 1 cm = 0,5 m): erro médio ≈ 0,075 m, desvio padrão
≈ 0,15 m, erro máximo ≈ 0,3 m — todos pequenos frente aos limiares de 12 m/15 m, o que sustenta a
afirmação de que a granularidade do sensor é suficiente para essa aplicação **na escala didática
usada**.

---

## 5. Como transformar isso em incerteza declarada

Depois de calcular as 5 linhas do resumo (seção 3):

1. Pegue o **maior desvio padrão** entre as 5 alturas testadas — é o pior caso de repetibilidade
   na faixa testada.
2. Declare a incerteza como aproximadamente **2× o desvio padrão** (cobre ~95% das leituras, regra
   prática de duas faixas de desvio padrão em torno da média).
3. Frase pronta para o TCC (ajustar com os números reais):

   > "Nos ensaios de bancada, o sensor JSN-SR04T apresentou desvio padrão de até **X cm** e erro
   > médio de **Y cm** na faixa de 0,2–0,6 m de coluna d'água (10 leituras por altura, 5 alturas
   > testadas), resultando em uma incerteza declarada de aproximadamente **±Z cm** (2σ) — adequada
   > frente aos limiares de alerta de 12 m e 15 m definidos para o protótipo."

4. **Onde citar no TCC:** esta frase (com os números reais) vai na subseção de **Viabilidade
   Técnica** (validação do sensor escolhido) e é referenciada de novo em **Resultados e Conclusão**
   como evidência quantitativa do funcionamento do protótipo. Inclua a tabela-resumo da seção 3
   como anexo ou figura.

---

## 6. Nota honesta para a banca

Isto valida a **precisão do sensor ultrassônico como medidor de coluna d'água** (o stand-in físico
usado na maquete) — não valida um piezômetro de corda vibrante nem poropressão real em solo
saturado. Uma validação de verdade exigiria um instrumento de referência certificado, ensaio em
câmara de pressão controlada, e comparação de campo contra um piezômetro Casagrande instalado —
etapas fora do escopo de um TCC de graduação técnica. O valor deste protocolo é demonstrar que a
metodologia de validação existe e foi aplicada ao componente que o projeto de fato usa.
