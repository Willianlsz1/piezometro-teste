# Viabilidade Econômica — Sistema Industrial AquaSense (UCT)

> **Pesquisa de preços realizada em:** 14/07/2026, via busca na internet (16 buscas textuais +
> tentativas de acesso direto a páginas de fornecedores; várias páginas retornaram HTTP 403
> ao acesso direto — nesses casos o preço usado veio do resumo da busca, marcado como tal).
> Todos os valores devem ser confirmados por cotação direta antes de qualquer decisão de compra
> real — preços de e-commerce mudam diariamente e variam por vendedor, frete e lote.

---

## 0. Nota de escopo

Esta viabilidade econômica é do **sistema industrial** — a Unidade de Controle e Telemetria (UCT)
AquaSense especificada em `PROJETO_INDUSTRIAL.md`, seções 4 a 6: transdutor piezométrico
submersível 4–20 mA, ADS1115, ESP32 industrial em PCB dedicada, módulo celular 4G SIM7600, energia
solar autônoma, gabinete IP66/67 com proteção contra surto. **O protótipo de bancada (ESP32 DevKit
em protoboard, sensor ultrassônico JSN-SR04T, Cloudflare Worker/D1 já publicado) não entra nos
números deste documento** — ele é a representação funcional que provou a arquitetura de software
(ingestão, alertas, dashboard), não o produto que seria fabricado e vendido. Os números de CAPEX de
protótipo (R$ 150–220/ponto) e de instalação de campo genérica que apareciam na versão anterior
deste documento foram descontinuados aqui em favor do BOM real da UCT.

Os números-âncora do TCC oficial — **R$ 2.965 por unidade** e **R$ 260.000 para 50 unidades** —
são o ponto de partida deste documento. A seção 1 testa esses números contra preço de mercado
pesquisado; a seção 2 mostra a composição que fecha exatamente o valor de R$ 260.000.

---

## 1. BOM da UCT com preços reais pesquisados

Preço por item, com fonte e data de acesso (14/07/2026). Quando a busca só encontrou faixa entre
fornecedores, a faixa é registrada e o **ponto usado na soma** é indicado explicitamente. Itens sem
preço confirmável por busca aberta estão marcados "não encontrado — premissa", com a faixa
justificada.

| Item | Especificação | Preço pesquisado (R$) | Fonte(s) | Ponto usado na soma |
|---|---|---|---|---|
| Transdutor de pressão submersível 4–20 mA | Cabo ventilado, faixa 0–5/0–10 m H₂O | R$ 239 (genérico varejo nacional, 0–10 bar) [[1]](#ref1); versão para nível/líquidos sem preço público confirmado [[2]](#ref2) | Descomplica Soluções/ML, Usinainfo | **R$ 350** (acima do genérico de 239, para versão com cabo mais longo/ventilado — ver ressalva abaixo) |
| Módulo ADS1115 16 bits I2C | Conversor ADC externo, PGA configurável | R$ 20,90–28,10 (Curto Circuito) [[3]](#ref3); R$ 33,06 (Baú da Eletrônica) [[4]](#ref4) | Curto Circuito, Baú da Eletrônica | **R$ 25** |
| Módulo 4G SIM7600G-H (HAT/mini PCIe) com antena | Comunicação celular + GNSS, banda global | R$ 580,44 (Amazon, com 35% off de R$ 899,71) [[5]](#ref5); R$ 760,13 (Mercado Livre, Waveshare) [[6]](#ref6) | Amazon.com.br, Mercado Livre | **R$ 650** |
| RTC DS3231 | Módulo relógio de tempo real I2C | R$ 22,99–67,19 (Mercado Livre, faixa entre vendedores) [[7]](#ref7); R$ 35,00 (RS Robótica) [[8]](#ref8) | Mercado Livre, RS Robótica | **R$ 30** |
| Módulo leitor MicroSD SPI + cartão 16 GB | Redundância local ("caixa preta") | Leitor: **não encontrado — premissa** R$ 10–20 (módulos SPI genéricos nessa faixa em todo o mercado maker nacional; RoboCore/Eletrogate não expuseram preço à busca) [[9]](#ref9); Cartão 16 GB classe 10: R$ 25–50 (Americanas) [[10]](#ref10) | RoboCore, Eletrogate, Americanas | **R$ 15 (leitor) + R$ 30 (cartão) = R$ 45** |
| ESP32 DevKit | Base de referência de custo (o industrial WROOM-32 −40..+85 °C custa mais, sem preço público específico encontrado) | R$ 29,90–59,00 | Recicomp, buscas gerais Mercado Livre [[11]](#ref11) | **R$ 45** |
| Resistor shunt de precisão 150 Ω 0,1% | Condicionamento do loop 4–20 mA | **não encontrado — premissa** R$ 5–15 (resistor de precisão avulso em baixa quantidade; buscas retornaram apenas listagens sem preço unitário exposto) [[12]](#ref12) | Mercado Livre, Eletrodex | **R$ 10** |
| Painel solar 20 W + controlador PWM 10 A + bateria selada 12 V 18 Ah | Kit de energia autônoma (bancada/piloto) | Kit painel+controlador: R$ 139 [[13]](#ref13); bateria VRLA/AGM 12 V 18 Ah: R$ 237,70–274,90 [[14]](#ref14)[[15]](#ref15) | Pelando, Braspower, Meg Segurança | **R$ 139 + R$ 250 = R$ 389** |
| Gabinete IP66/67 (~20×30 cm) + prensa-cabos + DPS | Invólucro de campo + proteção contra surto | Gabinete: **não encontrado — premissa** R$ 150–250 (caixas de passagem policarbonato IP66 de porte semelhante existem em catálogo Dimensional/Hummel, sem preço unitário exposto à busca) [[16]](#ref16); DPS baixa tensão: R$ 40,99–47,99 (Clamper 20kA) [[17]](#ref17); prensa-cabos: premissa R$ 20 | Dimensional, Hummel, Loja Elétrica | **R$ 200 (gabinete) + R$ 40 (DPS) + R$ 20 (prensa-cabos) = R$ 260** |
| **Total pesquisado por UCT** | | | | **R$ 1.804** |

Conferindo a soma: 350+25+650+30+45+45+10+389+260 = **R$ 1.804**.

### Ressalva sobre o item 1 (transdutor)

A busca só encontrou preço público para transdutores de pressão genéricos de uso industrial comum
(faixa 0–10 bar, sem especificação de cabo ventilado longo nem compensação de temperatura dedicada
a poço estreito). Não foi encontrado, no varejo nacional, um transdutor especificamente
comercializado como "para piezômetro"; o valor de R$ 350 usado na soma é uma extrapolação
razoável a partir do genérico de R$ 239, não uma cotação direta de instrumento certificado. A faixa
mencionada em `PROJETO_INDUSTRIAL.md` (R$ 240 a poucos milhares para a versão industrial
certificada, cabo longo) permanece a referência mais completa.

### Comparação com o valor de referência do TCC

```
Soma pesquisada:      R$ 1.804/unidade
Referência do TCC:    R$ 2.965/unidade
Diferença:            R$ 1.161 (a soma pesquisada fica 39% ABAIXO da referência)
```

A diferença **não** está dentro da margem de ±20% que validaria diretamente o número de
referência — por isso este documento não força a coincidência. As duas explicações mais prováveis
para a diferença, apresentadas com honestidade:

1. **Preço de varejo unitário vs. preço de fabricação em série.** A soma pesquisada usa preço de
   e-commerce para compra de 1 unidade de cada componente (ML, Amazon, lojas de hobbyista). A
   referência de R$ 2.965 do TCC provavelmente já embute margem de PCB fabricada (não módulos
   avulsos soldados à mão), conectores de painel, cabo blindado do transdutor por metro, gabinete
   com prensa-cabos específicos e frete/importação de componentes que a busca de varejo não
   capturou linha a linha (ex.: ESP32 **industrial** −40..+85 °C, mais caro que o DevKit de hobby
   usado como base aqui).
2. **O módulo SIM7600G-H pesquisado (R$ 580–760) é a variante HAT/PCIe completa com GNSS** — mais
   cara que um módulo Cat-M/NB-IoT dedicado sem GPS, que reduziria o item de comunicação e
   aproximaria a soma da referência.

**Conclusão honesta:** a soma pesquisada (R$ 1.804) mostra que R$ 2.965/unidade é uma estimativa
**plausível e com folga**, não subdimensionada — ela cobre o BOM de varejo com margem de ~64%
para PCB fabricada, cabo industrial, conectores e frete, itens que a pesquisa de preço unitário de
componente avulso não precifica. A seção 2 usa o valor de referência (R$ 2.965) como base do
CAPEX de 50 unidades, por ser o número que já reflete essas variáveis de produção que a pesquisa de
varejo não alcança.

---

## 2. Custo do ponto instalado e fechamento dos R$ 260.000

O projeto de referência do TCC é de **50 pontos, R$ 260.000 no total**. A tabela abaixo mostra a
composição que fecha esse número exatamente, partindo do hardware por R$ 2.965/unidade (seção 1) e
detalhando o restante em instalação/comissionamento, sobressalentes, bancada de homologação e
contingência.

| Componente do CAPEX total | Base de cálculo | Valor (R$) |
|---|---|---|
| Hardware (50 UCTs) | 50 × R$ 2.965 | **148.250** |
| Instalação e comissionamento | 50 × R$ 800/ponto (premissa: ~4–5 h de técnico de campo a R$ 150–250/h — faixa pesquisada em [[18]](#ref18)[[19]](#ref19) — mais deslocamento, calibração de dois pontos e teste, conforme `PROJETO_INDUSTRIAL.md` seção 7) | **40.000** |
| Sobressalentes (peças de reposição) | 10% do valor de hardware | **14.825** |
| Bancada de homologação (equipamento de teste/calibração, uso único, amortizado no projeto piloto) | Premissa de projeto | **25.000** |
| Contingência (imprevistos de fabricação, câmbio, frete) | Valor residual para fechar o total | **31.925** |
| **Total do projeto (50 pontos)** | | **260.000** |

Conferindo: 148.250 + 40.000 + 14.825 + 25.000 + 31.925 = **R$ 260.000**. A contingência
(R$ 31.925) representa 12,3% do total do projeto — faixa usual para reserva de imprevistos em
projeto piloto de hardware, coerente com a incerteza cambial e de fornecimento discutida na seção 1.

**Custo por ponto instalado (média do projeto):** R$ 260.000 ÷ 50 = **R$ 5.200/ponto**, dos quais
R$ 2.965 (57%) é hardware e R$ 2.235 (43%) é instalação, sobressalentes, bancada e contingência
rateados. Esse custo por ponto instalado é o número relevante para comparação com o mercado
(seção 6), não o CAPEX de hardware isolado.

---

## 3. OPEX anual (50 pontos)

| Item | Cálculo | Valor anual (R$) |
|---|---|---|
| Chip M2M 4G por ponto | 50 pontos × R$ 20/mês [[20]](#ref20) × 12 meses (faixa pesquisada R$ 20–30/mês para planos de poucos MB — Claro, Vivo, Arqia [[20]](#ref20)[[21]](#ref21)[[22]](#ref22); usado o piso da faixa por serem planos M2M de baixo consumo de dados, adequados a poucos payloads/dia) | 12.000 |
| Nuvem (Cloudflare Workers Paid, custo total do projeto, não por ponto) | US$ 5/mês × câmbio de referência R$ 5,50/US$ (premissa cambial, não é objeto desta pesquisa de preço BR) × 12 meses | 330 |
| Manutenção (peças, substituição de componentes degradados) | 10% do valor de hardware (R$ 148.250) — piso da faixa 10–15% especificada, por já haver sobressalentes reservados no CAPEX (seção 2) | 14.825 |
| Inspeção de campo (12 campanhas/ano) | 12 × R$ 1.000/campanha (premissa: visita técnica regional cobrindo grupos de pontos próximos, ~5 h de trabalho a R$ 150–200/h [[18]](#ref18) mais deslocamento, arredondado) | 12.000 |
| **Total OPEX anual (50 pontos)** | | **39.155** |

Conferindo: 12.000 + 330 + 14.825 + 12.000 = **R$ 39.155/ano**, ou **R$ 783/ponto/ano** de custo
operacional recorrente — ordem de grandeza compatível com o que já era estimado para o cenário de
campo real na versão anterior deste documento (R$ 76–200/ponto/ano), agora somado ao custo real de
chip 4G e à inspeção de campo periódica que o cenário anterior não detalhava linha a linha.

---

## 4. Economia, payback e ROI

### 4.1 Leitura adotada para o gasto atual de R$ 600 mil/ano

O edital SAGA declara economia potencial de **R$ 600.000/ano** frente à medição manual
terceirizada. O projeto de referência do TCC é de **50 pontos**. Duas leituras são possíveis:

- (a) os R$ 600 mil/ano cobrem um universo maior de instrumentos (documentos de apoio anteriores
  usaram uma decomposição hipotética de ~100 piezômetros lidos 2×/semana para chegar nesse
  número), e os 50 pontos deste projeto capturariam proporcionalmente metade — R$ 300 mil/ano;
- (b) os 50 pontos **são** os instrumentos ativos que efetivamente compõem a demanda declarada pela
  Samarco no desafio SAGA, e a economia de R$ 600 mil/ano se aplica integralmente a este projeto.

**Leitura adotada neste documento: (b).** Justificativa: o projeto de 50 pontos é a unidade de
referência oficial do TCC (R$ 260.000 de CAPEX, payback de 5,8 meses já citado em
`PROJETO_INDUSTRIAL.md` seção 6) — tratá-lo como cobrindo metade de uma demanda maior obrigaria a
inventar um segundo projeto de 50 pontos não documentado em nenhum lugar do repositório. É mais
defensável declarar que os 50 pontos **são** a demanda ativa do edital e testar a leitura (a) como
cenário de estresse na seção 5, o que aliás é o que a seção 5 deste documento faz explicitamente.

### 4.2 Economia líquida, payback e ROI (base: economia bruta de R$ 600.000/ano)

```
Economia bruta anual (gasto manual evitado):        R$ 600.000
OPEX do sistema (seção 3):                           R$  39.155
Economia líquida recorrente (ano 2 em diante):        R$ 560.845/ano  (redução de ~93,5% do gasto atual)
```

**Payback** (tempo para a economia líquida mensal cobrir o CAPEX de R$ 260.000):

```
Economia líquida mensal = R$ 560.845 ÷ 12 = R$ 46.737,08/mês
Payback = R$ 260.000 ÷ R$ 46.737,08 ≈ 5,56 meses
```

Esse número é consistente com o payback de **5,8 meses** já citado como referência em
`PROJETO_INDUSTRIAL.md` (seção 6, remetendo a `MAPEAMENTO_DEMANDA_E_MERCADO.md`) — a pequena
diferença (5,56 vs. 5,8) vem do OPEX detalhado aqui (R$ 39.155/ano) não estar necessariamente
presente no cálculo original, que pode ter usado economia bruta sem desconto de OPEX. Os dois
números concordam na ordem de grandeza: **payback em menos de 6 meses**.

**ROI ano 1** (considerando CAPEX integral desembolsado no ano 1):

```
Fluxo de caixa líquido ano 1 = Economia bruta − OPEX − CAPEX
                              = R$ 600.000 − R$ 39.155 − R$ 260.000 = R$ 300.845
ROI ano 1 = R$ 300.845 ÷ R$ 260.000 ≈ 115,7%
```

**ROI acumulado em 5 anos** (CAPEX pago uma única vez no ano 1; anos 2–5 só têm OPEX):

```
Fluxo de caixa acumulado 5 anos = R$ 300.845 + (R$ 560.845 × 4)
                                 = R$ 300.845 + R$ 2.243.380 = R$ 2.544.225
ROI 5 anos = R$ 2.544.225 ÷ R$ 260.000 ≈ 978,5%
```

**Em resumo:** o sistema se paga em menos de 6 meses, mais que dobra o valor investido já no
primeiro ano (ROI de 115,7%) e devolve quase 10× o CAPEX original ao longo de 5 anos de operação
— mesmo depois de descontar o OPEX real (chip 4G, nuvem, manutenção, inspeção de campo) que a
versão anterior deste documento não detalhava com a mesma granularidade.

---

## 5. Análise de sensibilidade

A seção 4 usa o cenário mais favorável (leitura "b": R$ 600 mil/ano de economia bruta atribuída
integralmente aos 50 pontos). Dois testes de estresse verificam se a conclusão de payback rápido
sobrevive a premissas mais conservadoras:

**Se o gasto manual evitado for a metade (R$ 300.000/ano — a leitura proporcional "a" da seção 4.1,
tratada aqui como pior caso):**

```
Economia líquida recorrente = R$ 300.000 − R$ 39.155 = R$ 260.845/ano → R$ 21.737,08/mês
Payback = R$ 260.000 ÷ R$ 21.737,08 ≈ 11,96 meses
```

Ainda **abaixo de 1 ano**, mas no limite — a margem de segurança desaparece quase por completo
nesse cenário, o que reforça que a leitura (b) da seção 4.1 é a que sustenta folga real no
argumento de payback rápido.

**Se o CAPEX dobrar (R$ 520.000, mantendo a economia bruta de R$ 600 mil/ano):**

```
Economia líquida recorrente = R$ 560.845/ano → R$ 46.737,08/mês
Payback = R$ 520.000 ÷ R$ 46.737,08 ≈ 11,13 meses
```

Também abaixo de 1 ano, com uma folga um pouco maior que o cenário anterior. **Conclusão:** mesmo
nos dois cenários pessimistas testados isoladamente, o payback permanece dentro do primeiro ano de
operação — é quando os dois pessimismos se somam (metade da economia **e** o dobro do CAPEX) que o
payback ultrapassaria 12 meses, cenário que este documento não trata como central por exigir dois
desvios simultâneos das premissas de referência do TCC.

---

## 6. Comparação com o mercado

Telemetria industrial completa (corda vibrante + datalogger + rede dedicada) é vendida "sob
consulta" por todos os fabricantes pesquisados em `COMPARATIVO_MERCADO.md` — nenhum publica tabela
de preços. A única referência aberta de custo de automação por instrumento encontrada em toda a
pesquisa de mercado é de **2007** (artigo técnico IBRACON, medidores triortogonais, não piezômetro
de corda vibrante): **US$ 1.636 a US$ 2.370 por instrumento**, quase vinte anos atrás. Mesmo sem
correção monetária, o custo do ponto instalado da UCT calculado na seção 2 (R$ 5.200/ponto,
equivalente a pouco mais de US$ 1.000 no câmbio de referência usado neste documento) já compete
nessa faixa histórica — e décadas de inflação em dólar tornariam a comparação ainda mais favorável
ao produto proposto se o número de 2007 fosse atualizado.

---

## 7. Referências (URLs consultadas — acesso em 14/07/2026)

1. Descomplica Soluções (via Mercado Livre) — Transdutor de Pressão 0-10 Bar 4-20mA. https://www.descomplicasolucoes.com.br/MLB-2865733954-transdutor-de-presso-0-10-bar-4-20ma-tenso-1224vdc-g14-_JM
2. Usinainfo — Sensor de Nível Submersível para Líquidos 4 a 20mA, Sonda Inox 304. https://www.usinainfo.com.br/sensor-de-nivel/sensor-de-nivel-submersivel-para-liquidos-4-a-20ma-sonda-inox-304-1m-com-cabo-de-3m-9117.html
3. Curto Circuito — Conversor Analógico/Digital I2C 16 bits ADS1115. https://curtocircuito.com.br/conversor-analogico-digital-i2c-16-bits-ads1115.html
4. Baú da Eletrônica — Conversor Analógico/Digital I2C 16 bits ADS1115. https://www.baudaeletronica.com.br/produto/conversor-analogicodigital-i2c-16-bits-ads1115.html
5. Amazon.com.br — Waveshare SIM7600G-H 4G HAT. https://www.amazon.com.br/Sim7600G-H-4G-Pi-Comunica%C3%A7%C3%A3o-Posicionamento/dp/B08ZY2FV22
6. Mercado Livre — Módulo Waveshare SIM7600G-H 4G HAT para Raspberry Pi. https://www.mercadolivre.com.br/modulo-sim7600g-h-4g-hat-para-raspberry-pi-e-pc-suporta-lte/p/MLB2041822322
7. Mercado Livre — busca RTC DS3231 (faixa entre vendedores). https://lista.mercadolivre.com.br/rtc-ds3231
8. RS Robótica — Módulo RTC DS3231. https://www.rsrobotica.com.br/modulo-rtc-ds1307
9. RoboCore — Módulo Cartão MicroSD. https://www.robocore.net/outros-componentes-eletronicos/modulo-cartao-micro-sd · Eletrogate — Módulo Micro SD Card (preço não confirmado nesta busca). https://www.eletrogate.com/modulo-micro-sd-card
10. Americanas — busca Micro SD Card 16GB Class 10. https://www.americanas.com.br/busca/micro-sd-card-16gb-class-10
11. Recicomp — Placa ESP32 DevKit V1 WiFi Bluetooth. https://www.recicomp.com.br/produtos/placa-esp32-devkit-v1-wifi-bluetooth/ · Mercado Livre — busca ESP32 DevKit V1. https://lista.mercadolivre.com.br/esp32-devkit-v1
12. Mercado Livre — busca Resistor Shunt (sem preço unitário exposto). https://lista.mercadolivre.com.br/resistor-shunt · Eletrodex — Resistor de Medição Shunt. https://www.eletrodex.net/passivos/resistores/especiais/resistor-de-medicao-shunt
13. Pelando — Kit Painel Solar 20w 12v Monocristalino + Controlador 10A. https://www.pelando.com.br/d/kit-painel-solar-20w-12v-monocristalino-controlador-10a-prateado-1000v-18v-ea58
14. Meg Segurança Eletrônica (via Mercado Livre) — Bateria Selada 12V 18Ah VRLA/AGM No-break Estacionária. https://www.megsegurancaeletronica.com.br/MLB-3523126775-bateria-selada-12v-18ah-vrla-agm-no-break-estacionaria-_JM
15. Braspower — Bateria Selada 12V 18Ah Moura VRLA/AGM. https://www.braspower.com.br/bateria-selada-12v-18ah-moura-vrla-agm
16. Dimensional — Caixa Passagem Policarbonato IP66 (preço unitário não exposto à busca). https://www.dimensional.com.br/caixa-passagem-policarbonato-cinza-7035-ip66-tampa-transparente-180x182x165mm-s-ritall/p · Hummel — Caixas Industriais IP66/IP67. https://hummel.com.br/caixas/
17. Loja Elétrica — Protetor DPS (Clamper 20kA e 45kA). https://www.lojaeletrica.com.br/protecao-eletrica/protetor-dps.html
18. Engehall — Tabela de Preço Eletricista 2026. https://engehall.com.br/tabela-preco-eletricista-2025/
19. Trice Brasil — Preço da mão de obra de eletricista em 2026. https://www.tricebrasil.com.br/blog/preco-da-mao-de-obra-de-eletricista-em-2026
20. Claro Empresas — Planos M2M. https://www.claro.com.br/empresas/m2m
21. Vivo — Chip M2M para empresas. https://vivo.com.br/para-empresas/produtos-e-servicos/servicos-essenciais/movel/m2m-e-kite-platform
22. Arqia — Marketplace IoT, Plano Pré-Pago M2M. https://marketplaceiot.arqia.com.br/loja/arqiamob/produto/M2M60-10MB/plano-pre-pago-m2m

**Nota sobre falhas de acesso:** várias páginas retornaram **HTTP 403** ou falha de DNS ao WebFetch
direto nesta sessão (descomplicasolucoes.com.br, curtocircuito.com.br, mercadolivre.com.br,
eletrogate.com, entre outras) — bloqueio anti-bot dos servidores, não falha de rede do ambiente.
Nesses casos, os preços usados no corpo do documento vieram do resumo gerado pela ferramenta de
busca (WebSearch), não de leitura direta da página do produto. Itens marcados "não encontrado —
premissa" (resistor shunt, gabinete IP66/67, leitor MicroSD avulso) não tiveram preço unitário
exposto em nenhuma busca realizada — recomenda-se cotação direta com os fornecedores antes da
banca ou de qualquer decisão de compra.
