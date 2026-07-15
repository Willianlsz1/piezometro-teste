# #[PREENCHER: código da unidade]# AquaSense: Sistema de Telemetria e Monitoramento Geotécnico Remoto e Contínuo para Piezômetros via IoT

> Fonte deste documento: transcrição fiel do TCC oficial da equipe (template INTEGRA SENAI-MG),
> com as correções decididas em 14/07/2026 aplicadas (ver nota ao final). É a partir deste
> markdown que `gerar_tcc_aquasense.py` gera `TCC_ENTREGA.docx` em formatação ABNT.

## Sumário

1. Título
   1.1 Equipe
   1.2 Problema
   1.3 Solução
      1.3.1 Área tecnológica da solução
      1.3.2 Justificativa
      1.3.3 Objetivos
      1.3.4 Desenvolvimento
      1.3.5 Viabilidade técnica
      1.3.6 Viabilidade econômica
      1.3.7 Resultados e conclusão
   1.4 Anexos
      1.4.1 Orçamento Estimado (BOM)
      1.4.2 BMG Canvas
      1.4.3 Situação de Aprendizagem
   Referências

*Nota: atualizar os números de página no Word após a diagramação final (Referências > Sumário)
ou preencher manualmente.*

---

## 1.1 EQUIPE

Unidade SENAI: Belo Horizonte HORTO

Instrutor orientador: Jairo

| ALUNO | CURSO | FUNÇÃO NO PROJETO |
|---|---|---|
| Gustavo | Técnico em Automação Industrial | Programação do firmware em C/C++ para o microcontrolador ESP32, implementação do mecanismo de store & forward com carimbo de tempo, controle do modo deep sleep e integração com o backend em nuvem. |
| Marcelo | Técnico em Automação Industrial | Projeto e dimensionamento do circuito de alimentação autônoma da unidade industrial (painel solar, controlador de carga e bateria selada de 12 V 18 Ah) e do condicionamento do sinal de corrente de 4 a 20 mA. |
| Matheus | Técnico em Automação Industrial | Projeto e dimensionamento da bancada de simulação hidráulica vertical em PVC para os ensaios de homologação e especificação do gabinete de campo com grau de proteção IP66. |
| Isadora | Técnico em Automação Industrial | Modelagem 3D do gabinete e dos suportes dos sensores, redação da documentação técnica oficial do projeto, cotação comercial de componentes e elaboração do orçamento de hardware (BOM). |

---

## 1.2 PROBLEMA

O monitoramento da estabilidade geotécnica de barragens de contenção de rejeitos, taludes e cavas de mineração depende, em grande medida, do acompanhamento contínuo do nível do lençol freático interno das estruturas. Esse acompanhamento é realizado por meio de piezômetros, instrumentos instalados em poços verticais que indicam a poropressão da água dentro do maciço. Quando esse nível se eleva além dos limites previstos em projeto, cresce o risco de saturação e de perda de estabilidade da estrutura, o que torna a leitura periódica desses instrumentos uma atividade crítica de segurança.

Na prática ainda amplamente adotada, essa leitura é feita manualmente, com equipes técnicas que se deslocam até o campo para medir o nível de água em cada poço com trenas elétricas ou sonoras. Esse método manual concentra três problemas relevantes. O primeiro é o risco à saúde e à segurança do trabalho, uma vez que os operadores precisam caminhar e permanecer periodicamente em áreas de alta periculosidade, muitas vezes dentro de zonas de autossalvamento de barragens de mineração. O segundo é a baixa resolução temporal dos dados coletados, já que leituras realizadas apenas uma vez por semana ou por mês não são capazes de capturar transientes hidráulicos rápidos provocados por chuvas intensas, comprometendo a capacidade de mitigação preventiva de incidentes. O terceiro é o custo operacional elevado, decorrente da contratação de equipes de campo, do deslocamento de veículos e do consumo de combustível associados a rotinas de leitura recorrentes.

A dimensão do problema no Brasil reforça a relevância do tema. Segundo o Sistema Nacional de Informações sobre Segurança de Barragens, existem cerca de 28.043 barragens cadastradas no país, das quais apenas aproximadamente 6.210 estão enquadradas na Política Nacional de Segurança de Barragens. A ampla maioria das estruturas segue, portanto, sem qualquer automação de monitoramento, dependendo de leitura manual ou mesmo da ausência completa de leitura, o que inclui pequenas barragens de água e açudes, aterros sanitários com piezômetros de chorume, diques, encostas urbanas monitoradas por defesa civil e pilhas de estéril que não se enquadram na categoria de Dano Potencial Associado alto.

A Resolução ANM 95/2022 estabelece a obrigatoriedade de monitoramento automatizado em tempo real e período integral, com redundância de energia e centro de monitoramento dedicado, exclusivamente para barragens classificadas com Dano Potencial Associado alto. Essa exigência regulatória atende apenas a uma parcela pequena do universo total de estruturas geotécnicas do país, deixando descoberta uma camada expressiva de barragens, açudes, aterros e taludes que hoje não têm nenhuma automação e que, por restrição orçamentária, não conseguem contratar as soluções comerciais de telemetria disponíveis no mercado, tipicamente cotadas na casa de dezenas de milhares de reais por ponto de monitoramento.

O AquaSense parte, portanto, de uma demanda real de monitoramento contínuo de piezômetros em barragens de mineração, na qual a substituição da leitura manual terceirizada por sensoriamento automático foi apontada como necessidade explícita para reduzir custo operacional, aumentar a segurança das equipes de campo e assegurar a disponibilidade de dados em tempo real para a tomada de decisão.

---

## 1.3 SOLUÇÃO

### 1.3.1 Área tecnológica da solução

O projeto está inserido nas áreas de Automação Industrial, Internet das Coisas Industrial e Tecnologia da Informação aplicada à computação em nuvem, reunindo instrumentação eletrônica de campo, comunicação de dados via rede celular e desenvolvimento de sistemas de software para ingestão, armazenamento e visualização de dados em tempo real.

### 1.3.2 Justificativa

O AquaSense promove a transformação digital do monitoramento geotécnico, substituindo a coleta manual e intermitente por medições elétricas automatizadas e contínuas. Do ponto de vista técnico, o projeto integra instrumentação industrial de referência, como o loop de corrente de 4 a 20 mA e a conversão analógico digital de alta resolução, a uma arquitetura de nuvem moderna, capaz de processar alertas em tempo real sem depender de infraestrutura própria de servidores.

Do ponto de vista econômico, a substituição da rotina de deslocamento de equipes e veículos por um sistema de telemetria contínua reduz de forma expressiva o custo operacional recorrente, com retorno de investimento estimado em poucos meses, conforme detalhado na análise de viabilidade econômica.

Do ponto de vista social e ambiental, o projeto elimina a exposição constante de trabalhadores a áreas de risco geotécnico e amplia o acesso ao monitoramento automatizado para estruturas que hoje não têm nenhuma automação, por não se enquadrarem nas exigências regulatórias voltadas apenas às barragens de maior porte. A lição central do projeto é a de que o dado coletado só tem valor quando se transforma em ação a tempo: um sistema que mede continuamente, mas não avisa ninguém quando o nível ultrapassa o limite seguro, não cumpre o papel de prevenção que o monitoramento geotécnico exige.

### 1.3.3 Objetivos

Objetivo Geral: Desenvolver e validar uma plataforma de telemetria para o monitoramento contínuo e remoto de piezômetros, composta por protótipo funcional de aquisição, processamento em nuvem, dashboard interativo e alertas preventivos em dupla via, e especificar a Unidade de Controle e Telemetria de baixo consumo para a aplicação industrial em campo.

Objetivos Específicos:

- Programar o firmware do microcontrolador ESP32 responsável pela leitura do sensor, pelo mecanismo de store & forward com carimbo de tempo e pelo envio periódico dos dados para a nuvem.
- Desenvolver o backend em plataforma de computação em nuvem serverless, responsável pela ingestão, pelo armazenamento em banco de dados gerenciado e pela execução do motor de alertas por gatilho de tempo a cada minuto.
- Construir um dashboard web interativo capaz de exibir a leitura atual, o histórico em série temporal e os eventos de alerta de cada instrumento monitorado.
- Implementar o sistema de alertas preventivos em dupla via, por Telegram e por SMS, disparado nas transições de faixa de nível e repetido enquanto persistir a condição crítica.
- Projetar a Unidade de Controle e Telemetria industrial, incluindo o transdutor piezorresistivo submersível de 4 a 20 mA, o conversor analógico digital de 16 bits e o módulo de comunicação celular 4G.
- Dimensionar o sistema de alimentação autônoma da unidade de campo, composto por painel solar, controlador de carga e bateria selada, garantindo autonomia energética prolongada.
- Especificar o invólucro de campo com grau de proteção IP66, prensa cabos e proteção contra surtos, adequado à exposição ambiental de instalações geotécnicas.
- Montar um protótipo funcional de bancada, com microcontrolador, sensor de nível e sinalização local, para validar de ponta a ponta a integração entre aquisição, firmware, nuvem e alerta.
- Definir o protocolo de homologação da unidade em bancada hidráulica vertical de PVC, com os ensaios e os critérios de aceitação a serem aplicados na continuidade do projeto.

### 1.3.4 Desenvolvimento

O desenvolvimento do AquaSense seguiu uma metodologia ágil, organizada em quatro fases distribuídas ao longo dos bimestres do curso, com participação conjunta dos quatro integrantes em cada etapa e responsabilidades específicas conforme a especialidade de cada um.

Na Fase I, de planejamento e especificações, correspondente ao primeiro bimestre, a equipe realizou o levantamento de requisitos da demanda e o estudo dos princípios de sensoriamento industrial de nível, culminando na seleção do transdutor piezorresistivo submersível com saída em corrente de 4 a 20 mA como sensor de referência do projeto. Nesta fase também foi definida a arquitetura geral do sistema, incluindo a decisão pelo uso de uma plataforma de computação em nuvem serverless para o backend, e Matheus elaborou o esboço mecânico da bancada vertical de simulação.

Na Fase II, de prototipagem e testes modulares, correspondente ao segundo bimestre, Isadora conduziu a pesquisa de preços e a cotação dos componentes junto a fornecedores nacionais, consolidando o orçamento de hardware do projeto. Marcelo dimensionou o circuito de alimentação autônoma da unidade industrial, definindo painel solar, controlador de carga e bateria selada, e especificou o condicionamento do sinal de corrente de 4 a 20 mA por resistor de shunt de precisão. Gustavo desenvolveu a primeira versão do firmware, responsável pela leitura do sensor, pela conexão de rede do microcontrolador e pelo envio das leituras. Em paralelo, Matheus elaborou o projeto mecânico da bancada hidráulica vertical de PVC e do gabinete de campo.

Na Fase III, de integração, correspondente ao terceiro bimestre, foi desenvolvido o backend em nuvem, com os endpoints de ingestão e de leitura, o esquema do banco de dados gerenciado e o motor de alertas executado por gatilho de tempo a cada minuto, além do mecanismo de store & forward do firmware para preservar leituras em caso de interrupção momentânea de rede. Nesta fase a equipe definiu também o método de calibração por dois pontos de referência conhecidos, que correlaciona a tensão medida sobre o resistor de shunt de precisão de 150 ohms ao nível da coluna de água, a ser aplicado quando o transdutor for instalado na bancada.

Na Fase IV, de validação e fechamento, correspondente ao quarto bimestre, a equipe integrou o dashboard web interativo ao backend, validando a exibição em tempo real e o histórico em série temporal, e realizou testes de ponta a ponta do sistema de alertas em dupla via, por Telegram e por SMS, verificando o disparo correto nas transições entre os níveis normal, atenção e crítico. Nesta fase foi montado o protótipo funcional de bancada, com o microcontrolador, o sensor de nível e o display local integrados e alimentados por porta USB, que reproduz em escala reduzida a lógica completa do sistema e comunica com a nuvem. Em paralelo, a equipe consolidou a especificação da unidade industrial e o protocolo de homologação em bancada hidráulica, etapa prevista para a continuidade do trabalho.

### 1.3.5 Viabilidade técnica

A solução se apoia em padrões consolidados da instrumentação industrial. Na unidade de campo especificada, o uso do loop de corrente de 4 a 20 mA no transdutor garante imunidade a ruído eletromagnético mesmo em cabos longos dentro do poço, característica essencial em ambientes sujeitos a interferências. A leitura desse sinal é feita por um conversor analógico digital externo de 16 bits, associado a um resistor de shunt de precisão de 150 ohms, que converte a faixa de 4 a 20 mA em uma faixa de tensão de 0,6 a 3,0 volts, plenamente compatível com a entrada do conversor sem risco de saturação. Essa combinação garante uma resolução muito superior à do conversor analógico digital nativo do microcontrolador, que possui apenas 12 bits e comportamento não linear nas extremidades da escala, insuficiente para uma medição de precisão em campo.

A robustez do sistema para operação em campo é reforçada por dispositivos de proteção contra surtos na entrada de energia e no loop de sinal, relevantes em estruturas expostas a descargas atmosféricas, e por um invólucro com grau de proteção IP66, que assegura vedação adequada contra poeira e jatos de água. O firmware implementa o mecanismo de store & forward, retendo localmente as leituras com carimbo de tempo quando a rede de comunicação está indisponível e reenviando os dados assim que a conexão é restabelecida, o que evita perda de informação em áreas de sombra de sinal celular.

No lado do backend, a escolha de uma plataforma de computação em nuvem serverless elimina o risco de hibernação do serviço, garantindo que o motor de alertas, executado por gatilho de tempo a cada minuto, permaneça ativo de forma contínua, sem depender de qualquer ping externo para retomar a execução. Essa característica é particularmente relevante para um sistema de alerta preventivo, cuja falha silenciosa é justamente o pior cenário possível. A arquitetura completa, do firmware ao dashboard, foi validada de ponta a ponta em ambiente de simulação, com o backend efetivamente publicado em nuvem, confirmando a viabilidade técnica da solução.

### 1.3.6 Viabilidade econômica

Para saber se o AquaSense compensa financeiramente, comparamos o que a empresa gasta hoje com o método manual e o que passaria a gastar com o sistema automatizado, incluindo tanto a compra do equipamento quanto sua manutenção ao longo dos anos. O resultado dessa comparação é apresentado a seguir, junto com a explicação de como cada número foi obtido.

**Como levantamos os custos**

Nenhum dos quatro integrantes da equipe tem formação em finanças, então tratamos este levantamento como uma pesquisa de campo: em vez de estimar os preços de memória, buscamos cada componente do sistema em lojas nacionais de eletrônica e em marketplaces, registrando o valor, a loja e a data da consulta (julho de 2026). O transdutor de pressão submersível, peça central do sistema, foi encontrado por R$ 239 na versão genérica de uso industrial; o módulo de comunicação celular 4G, por R$ 580 a R$ 760 dependendo do vendedor; o conjunto de energia solar, com painel, controlador de carga e bateria, por cerca de R$ 389; e o valor de hora de um técnico de campo para instalação, pesquisado em tabelas do setor elétrico, ficou entre R$ 150 e R$ 250. Essa pesquisa de varejo, feita componente por componente, somou R$ 1.804 por unidade, valor que serve de piso de referência: ele cobre a compra avulsa de cada peça, mas não inclui fabricação de placa própria, cabo industrial, conectores de painel nem frete e variação cambial de itens importados, custos que só aparecem quando o sistema é fabricado em série e não montado peça a peça no balcão da loja.

**Quanto custa o AquaSense**

Por isso, o valor de referência usado no projeto para cada unidade é R$ 2.965, um número que acomoda, além dos componentes pesquisados, os itens de montagem industrial, o frete e a variação de câmbio que a pesquisa de varejo não alcança, mas que aparecem de fato quando cinquenta unidades são fabricadas e instaladas de uma vez. Multiplicando por cinquenta pontos de monitoramento, o hardware sozinho custa R$ 148.250. A esse valor somamos a instalação em campo, calculada com a hora técnica pesquisada (a mesma faixa de R$ 150 a R$ 250) considerando cerca de quatro a cinco horas de trabalho por ponto, entre deslocamento, fixação, calibração e teste; um estoque de peças sobressalentes equivalente a 10% do hardware, para reposição rápida sem esperar novo pedido de compra; uma bancada de homologação para testar e calibrar os equipamentos antes de irem a campo; e uma reserva de contingência para imprevistos de fabricação, câmbio e frete. A tabela abaixo mostra como esses valores se somam.

| Item do investimento | Como foi calculado | Valor (R$) |
|---|---|---|
| Hardware (50 unidades) | 50 × R$ 2.965 por unidade | 148.250 |
| Instalação e comissionamento em campo | 50 pontos × cerca de R$ 800, com base na hora técnica pesquisada | 40.000 |
| Peças sobressalentes | 10% do valor do hardware | 14.825 |
| Bancada de homologação | Equipamento de teste e calibração, uso único no projeto | 25.000 |
| Reserva de contingência | Imprevistos de fabricação, câmbio e frete | 31.925 |
| **Investimento total para 50 pontos** | | **260.000** |

O investimento total de R$ 260.000 equivale a R$ 5.200 por ponto de monitoramento já instalado e funcionando, dos quais R$ 2.965 são o próprio equipamento e o restante cobre tudo o que é preciso para colocá-lo em operação segura no campo. O gráfico abaixo apresenta a mesma composição em escala visual.

[GRAFICO: grafico3_capex.png | Gráfico 1 – Composição do investimento total de R$ 260.000 (50 pontos)]

**Quanto a empresa gasta hoje**

O edital que originou este projeto declara uma economia potencial de R$ 600 mil por ano com a substituição da leitura manual terceirizada. Não tivemos acesso à planilha interna da empresa que gerou esse número, então testamos se ele é coerente com a prática do mercado. Um contrato de leitura manual terceirizada custa, em faixas usuais do setor, algo em torno de R$ 50 mil por mês, valor que paga uma equipe de campo com técnicos, veículo, combustível, equipamentos de segurança, encargos trabalhistas e a elaboração de relatórios. Essa equipe consegue ler cerca de cem piezômetros duas vezes por semana. Dividindo o custo mensal pelo número de leituras realizadas no período, cada leitura individual sai por cerca de R$ 58, um valor plausível para um serviço técnico terceirizado de campo. Ou seja, o número de R$ 600 mil por ano declarado no edital é coerente com o que o mercado de fato cobra por esse tipo de serviço, e não uma cifra arbitrária.

**Indicadores de viabilidade do projeto**

Com os custos levantados e o gasto atual da empresa verificado, os cinco indicadores abaixo resumem a viabilidade econômica do AquaSense. Cada um traz o valor calculado e a explicação de como chegamos a ele.

**Investimento inicial do projeto: R$ 260.000,00**

É o valor único necessário para colocar os cinquenta pontos de monitoramento em operação, conforme a composição detalhada na tabela anterior: hardware, instalação em campo, peças sobressalentes, bancada de homologação e reserva de contingência. Equivale a R$ 5.200,00 por ponto instalado e funcionando, pago uma única vez.

**Custo operacional anual: R$ 39.155,00**

Depois de instalado, o AquaSense ainda gera custo de manutenção, e ignorá-lo distorceria a comparação. O valor soma a conectividade celular dos cinquenta pontos, o serviço de nuvem que recebe e processa os dados, a manutenção preventiva de peças e as inspeções físicas mensais de campo, resultando em cerca de R$ 783,00 por ponto por ano. O maior item é o chip 4G de cada ponto, calculado no cenário mais caro, com cada unidade operando de forma totalmente independente; existem duas rotas concretas para reduzir esse valor, uma pela contratação de um plano de dados sob medida para o baixo volume que o sistema realmente transmite, outra pela instalação de um único ponto de comunicação compartilhado entre sensores próximos entre si, o que é o caso típico de uma barragem.

**Economia anual gerada: R$ 560.845,00 (redução de 93,5%)**

Comparando o gasto atual de R$ 600.000,00 por ano com o custo operacional de R$ 39.155,00, a empresa passa a economizar R$ 560.845,00 todos os anos a partir do segundo ano de operação, uma redução de 93,5% do que gastava antes. No primeiro ano, descontando também o investimento inicial de R$ 260.000,00, a economia líquida ainda é de R$ 300.845,00 nos primeiros doze meses. O contraste entre os dois custos anuais é apresentado no gráfico a seguir.

[GRAFICO: grafico2_custo_anual.png | Gráfico 2 – Custo anual da leitura manual em comparação com a operação do AquaSense]

**Payback do projeto: 5,6 meses**

Payback é o tempo que a economia gerada leva para pagar de volta o investimento feito. Dividindo o investimento de R$ 260.000,00 pela economia líquida mensal de aproximadamente R$ 46.737,00, chegamos a 5,6 meses: em pouco mais de meio ano de operação, o sistema já se pagou sozinho, e tudo o que economizar dali em diante é ganho da empresa. O gráfico a seguir mostra essa trajetória mês a mês, com o saldo saindo do investimento inicial negativo e cruzando o zero antes do sexto mês.

[GRAFICO: grafico1_payback.png | Gráfico 3 – Saldo acumulado do investimento ao longo do primeiro ano de operação]

**ROI do projeto: 116% no primeiro ano e 978% em cinco anos**

ROI, ou retorno sobre o investimento, mostra quanto volta para a empresa para cada real investido. No primeiro ano, o ROI de 116% significa que cada R$ 1,00 investido retorna R$ 2,16: o real investido de volta mais R$ 1,16 de ganho líquido, já contando o custo de manutenção do período. Em cinco anos de operação, período em que o investimento inicial é pago uma única vez e apenas o custo de manutenção se repete, o retorno acumulado chega a 978%, ou seja, cada R$ 1,00 investido vira quase R$ 11,00.

**O AquaSense diante do mercado**

Para situar esses números fora da nossa própria conta, buscamos os preços públicos dos oito principais fabricantes internacionais de telemetria geotécnica e constatamos que nenhum deles publica tabela de preço: todos exigem contato comercial direto para cotação. A única referência concreta que encontramos em toda a pesquisa foi um artigo técnico de congresso de 2007, que registrava um custo entre US$ 1.636 e US$ 2.370 por instrumento automatizado. Mesmo quase vinte anos depois e sem qualquer correção monetária, o custo de R$ 5.200 por ponto instalado do AquaSense já compete com aquela faixa histórica, o que confirma que o mercado tradicional de telemetria geotécnica opera hoje numa faixa de preço bem mais alta, reservada a barragens de Dano Potencial Associado alto. É justamente essa lacuna de preço que sustenta a proposta do AquaSense como alternativa viável para a camada de barragens, açudes e taludes que hoje não têm acesso a nenhuma automação.

| Métrica | Situação tradicional (manual) | Solução AquaSense | Impacto |
|---|---|---|---|
| Custo operacional anual | Equipes de medição, deslocamento de veículos e combustível | Manutenção, nuvem e inspeções planejadas | Economia de R$ 560.845 por ano a partir do segundo ano |
| Frequência de dados | Leitura semanal ou quinzenal por piezômetro | Leituras contínuas ao longo do dia | Detecção ágil de transientes de pressão e infiltração |
| Segurança do trabalho | Exposição constante de equipes a áreas geotécnicas instáveis | Exposição mínima, restrita a visitas programadas | Redução direta do risco às equipes de campo |
| Investimento | Gasto recorrente sem gerar ativo permanente | R$ 260.000 para 50 pontos instalados | R$ 5.200 por ponto, pago uma única vez |
| Retorno | Gasto constante sem retorno de capital | Payback de 5,6 meses; ROI de 116% no ano 1 e 978% em 5 anos | Cada R$ 1,00 investido retorna quase R$ 11,00 em 5 anos |

### 1.3.7 Resultados e conclusão

O AquaSense atingiu, até o momento, a validação completa da cadeia de software de ponta a ponta: o firmware do microcontrolador, o backend em nuvem responsável pela ingestão e pelo armazenamento das leituras, o dashboard web com exibição de série histórica e o motor de alertas em dupla via, por Telegram e por SMS, estão operacionais em ambiente de produção na nuvem. Os testes realizados confirmaram que as transições entre os níveis normal, atenção e crítico disparam corretamente as notificações, e que o mecanismo de store & forward preserva as leituras mesmo diante de interrupções momentâneas de conectividade.

No plano físico, a equipe montou um protótipo funcional de bancada, composto por microcontrolador, sensor de nível e display local, alimentado por porta USB, que reproduz em escala reduzida a cadeia completa do sistema, da leitura ao alerta. A montagem da unidade industrial na bancada hidráulica vertical, com o transdutor de pressão de 4 a 20 mA, a alimentação autônoma por painel solar e o gabinete de campo, constitui etapa prevista para a continuidade do trabalho, com protocolo de ensaios e critérios de aceitação já definidos. Cabe registrar que a alimentação fotovoltaica pertence à especificação da unidade de campo, onde não há infraestrutura elétrica disponível; em bancada, a alimentação por porta USB é suficiente e não altera o comportamento do sistema.

O desenvolvimento do projeto permitiu que os quatro integrantes, todos do curso Técnico em Automação Industrial, integrassem competências complementares de firmware, instrumentação, energia e documentação técnica sob um desafio real de mercado, cumprindo os objetivos propostos na etapa de software concluída e mantendo a etapa de homologação física como continuidade natural do trabalho.

---

## 1.4 ANEXOS

### 1.4.1 Orçamento Estimado (BOM)

Anexo I: Orçamento Estimado da Unidade de Controle e Telemetria (BOM, Bill of Materials)

A relação abaixo corresponde à unidade industrial especificada para instalação em campo, base do custo de R$ 2.965,00 por ponto adotado na análise de viabilidade econômica. O protótipo funcional montado em bancada emprega um subconjunto destes itens, com sensor de nível de baixo custo no lugar do transdutor de pressão e alimentação por porta USB no lugar do sistema fotovoltaico, uma vez que a autonomia energética só é requisito onde não existe infraestrutura elétrica.

| Componente | Especificação técnica | Qtde | Função |
|---|---|---|---|
| Transdutor de pressão | Piezorresistivo submersível, saída de corrente de 4 a 20 mA, cabo blindado | 01 un. | Converter a pressão hidrostática do poço em sinal elétrico analógico padronizado |
| Controlador ESP32 | Microcontrolador com barramentos I2C, SPI e Serial UART expostos | 01 un. | Núcleo de processamento, agendamento de leituras e controle de baixo consumo |
| Conversor ADC externo | ADS1115 de 16 bits, comunicação I2C, acoplado a resistor de shunt de precisão de 150 Ω (0,1%) | 01 un. | Converter o sinal de corrente em tensão de alta resolução, entre 0,6 V e 3,0 V |
| Módulo de conectividade | Modem celular 4G SIM7600, com antena externa e função de SMS local | 01 un. | Transmitir os dados para a nuvem e prover redundância de alerta via SMS |
| Módulo RTC | DS3231, comunicação I2C | 01 un. | Controlar o despertar programado do microcontrolador no modo deep sleep |
| Cartão de memória MicroSD | Módulo leitor SPI com cartão MicroSD | 01 un. | Registrar localmente as leituras com carimbo de tempo, como caixa preta do sistema |
| Sistema fotovoltaico | Painel solar de 20 W, controlador de carga PWM e bateria estacionária selada de 12 V 18 Ah | 01 kit | Suprir eletricidade de forma autônoma em locais sem infraestrutura elétrica externa |
| Gabinete de campo | Grau de proteção IP66, com prensa cabos e proteção contra surtos | 01 un. | Proteger a eletrônica das condições ambientais de instalação em campo |
| Bancada de ensaios | Tubulação vertical de PVC de 2 metros, conexões e válvula de drenagem | 01 kit | Simular fisicamente as variações do nível de água para homologação do sistema |
| **Custo total de componentes de referência: R$ 2.965,00 por unidade** | | | |

### 1.4.2 BMG Canvas

Anexo II: BMG Canvas do projeto. `[PREENCHER: inserir imagem do BMG Canvas]`
### 1.4.3 Situação de Aprendizagem

Anexo III: `[PREENCHER: Situação de Aprendizagem aplicada ao curso técnico]`
---

## REFERÊNCIAS

ACKCIO. Wireless Monitoring Solutions For Mining. [S. l.], [20--]. Disponível em: <https://www.ackcio.com/industries/mining/>. Acesso em: 13 jul. 2026.

AGÊNCIA NACIONAL DE ÁGUAS E SANEAMENTO BÁSICO (ANA). Manual de Segurança de Pequenas Barragens. Brasília, DF: ANA, [20--]. Disponível em: <https://www.snirh.gov.br/portal/snisb/Entenda_Mais/publicacoes/ArquivosPNSB_Docs_Estruturantes/produto-10-manual-de-seguranca-de-pequenas-barragens.pdf>. Acesso em: 14 jul. 2026.

AGÊNCIA NACIONAL DE ÁGUAS E SANEAMENTO BÁSICO (ANA). RSB 2024/2025 indica 241 barragens prioritárias que necessitam de maior atenção em termos de segurança em 23 estados e no Distrito Federal. Brasília, DF, 2025. Disponível em: <https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/rsb-2024-2025-indica-241-barragens-prioritarias-que-necessitam-de-maior-atencao-em-termos-de-seguranca-em-23-estados-e-no-distrito-federal>. Acesso em: 14 jul. 2026.

AGÊNCIA NACIONAL DE MINERAÇÃO (ANM). Resolução ANM nº 95, de 7 de fevereiro de 2022. Consolida os atos normativos de segurança de barragens de mineração. Brasília, DF: ANM, 2022. Disponível em: <https://www.gov.br/anm/pt-br/assuntos/barragens/legislacao/resolucao-no-95-2022.pdf>. Acesso em: 14 jul. 2026.

AMAZON.COM.BR. Sim7600G-H 4G HAT: comunicação e posicionamento para Raspberry Pi. [S. l.], 2026. Disponível em: <https://www.amazon.com.br/Sim7600G-H-4G-Pi-Comunica%C3%A7%C3%A3o-Posicionamento/dp/B08ZY2FV22>. Acesso em: 14 jul. 2026.

AMERICANAS. Micro SD Card 16GB Class 10. [S. l.], 2026. Disponível em: <https://www.americanas.com.br/busca/micro-sd-card-16gb-class-10>. Acesso em: 14 jul. 2026.

ARQIA. Plano Pré-Pago M2M. [S. l.], 2026. Disponível em: <https://marketplaceiot.arqia.com.br/loja/arqiamob/produto/M2M60-10MB/plano-pre-pago-m2m>. Acesso em: 14 jul. 2026.

BAÚ DA ELETRÔNICA. Conversor Analógico/Digital I2C 16 bits ADS1115. [S. l.], 2026. Disponível em: <https://www.baudaeletronica.com.br/produto/conversor-analogicodigital-i2c-16-bits-ads1115.html>. Acesso em: 14 jul. 2026.

BRASIL. Lei nº 12.334, de 20 de setembro de 2010. Estabelece a Política Nacional de Segurança de Barragens destinadas à acumulação de água para quaisquer usos, à disposição final ou temporária de rejeitos e à acumulação de resíduos industriais. Diário Oficial da União, Brasília, DF, 2010.

BRASIL. Lei nº 14.066, de 30 de setembro de 2020. Altera a Lei nº 9.984, de 17 de julho de 2000, a Lei nº 12.334, de 20 de setembro de 2010, [...] para dispor sobre a Política Nacional de Segurança de Barragens. Diário Oficial da União, Brasília, DF, 2020. Disponível em: <http://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14066.htm>. Acesso em: 14 jul. 2026.

BRASPOWER. Bateria Selada 12V 18Ah Moura VRLA/AGM. [S. l.], 2026. Disponível em: <https://www.braspower.com.br/bateria-selada-12v-18ah-moura-vrla-agm>. Acesso em: 14 jul. 2026.

CANARY SYSTEMS. MLSAA: Measurand ShapeArray Automation. [S. l.], [20--]. Disponível em: <https://canarysystems.com/products/hardware/mlsaa/>. Acesso em: 13 jul. 2026.

CLARO EMPRESAS. Planos M2M. [S. l.], 2026. Disponível em: <https://www.claro.com.br/empresas/m2m>. Acesso em: 14 jul. 2026.

CURTO CIRCUITO. Conversor Analógico/Digital I2C 16 bits ADS1115. [S. l.], 2026. Disponível em: <https://curtocircuito.com.br/conversor-analogico-digital-i2c-16-bits-ads1115.html>. Acesso em: 14 jul. 2026.

DESCOMPLICA SOLUÇÕES (via Mercado Livre). Transdutor de Pressão 0-10 Bar 4-20mA. [S. l.], 2026. Disponível em: <https://www.descomplicasolucoes.com.br/MLB-2865733954-transdutor-de-presso-0-10-bar-4-20ma-tenso-1224vdc-g14-_JM>. Acesso em: 14 jul. 2026.

DIMENSIONAL. Caixa de Passagem Policarbonato Cinza 7035 IP66, Tampa Transparente, 180x182x165mm. [S. l.], 2026. Disponível em: <https://www.dimensional.com.br/caixa-passagem-policarbonato-cinza-7035-ip66-tampa-transparente-180x182x165mm-s-ritall/p>. Acesso em: 14 jul. 2026.

DYNAMIS TECHNE (host). Alternativas para a automação dos medidores triortogonais. In: CONGRESSO BRASILEIRO DO CONCRETO, 49., 2007, [S. l.]. Anais eletrônicos [...]. São Paulo: IBRACON, 2007. Disponível em: <https://dynamistechne.com/wp-content/uploads/2018/07/2007-ibracon-alternativas-para-a-automacao-dos-medidores-triortogonais.pdf>. Acesso em: 13 jul. 2026.

ELETRODEX. Resistor de Medição Shunt. [S. l.], 2026. Disponível em: <https://www.eletrodex.net/passivos/resistores/especiais/resistor-de-medicao-shunt>. Acesso em: 14 jul. 2026.

ELETROGATE. Módulo Micro SD Card. [S. l.], 2026. Disponível em: <https://www.eletrogate.com/modulo-micro-sd-card>. Acesso em: 14 jul. 2026.

ENCARDIO-RITE. Geotechnical Data Logger System. [S. l.], [20--]. Disponível em: <https://www.encardio.com/geotechnical-products/data-loggers>. Acesso em: 13 jul. 2026.

ENGEHALL. Tabela de Preço Eletricista 2026. [S. l.], 2026. Disponível em: <https://engehall.com.br/tabela-preco-eletricista-2025/>. Acesso em: 14 jul. 2026.

GEOKON. Standard Piezometers: Model 4500 Series. Lebanon, NH, [20--]. Disponível em: <https://www.geokon.com/4500-Series>. Acesso em: 13 jul. 2026.

GITHUB. Topics: piezometer. [S. l.], 2026. Disponível em: <https://github.com/topics/piezometer>. Acesso em: 13 jul. 2026.

HUMMEL. Caixas Industriais IP66/IP67. [S. l.], 2026. Disponível em: <https://hummel.com.br/caixas/>. Acesso em: 14 jul. 2026.

INTERNATIONAL SOCIETY OF AUTOMATION (ISA). ISA-18.2: Management of Alarm Systems for the Process Industries. Research Triangle Park, NC: ISA, 2016. Disponível em: <https://www.isa.org/getmedia/55b4210e-6cb2-4de4-89f8-2b5b6b46d954/PAS-Understanding-ISA-18-2.pdf>. Acesso em: 14 jul. 2026.

LOJA ELÉTRICA. Protetor DPS (Clamper 20kA e 45kA). [S. l.], 2026. Disponível em: <https://www.lojaeletrica.com.br/protecao-eletrica/protetor-dps.html>. Acesso em: 14 jul. 2026.

MEG SEGURANÇA ELETRÔNICA (via Mercado Livre). Bateria Selada 12V 18Ah VRLA/AGM No-break Estacionária. [S. l.], 2026. Disponível em: <https://www.megsegurancaeletronica.com.br/MLB-3523126775-bateria-selada-12v-18ah-vrla-agm-no-break-estacionaria-_JM>. Acesso em: 14 jul. 2026.

MERCADO LIVRE. Módulo Waveshare SIM7600G-H 4G HAT para Raspberry Pi e PC. [S. l.], 2026. Disponível em: <https://www.mercadolivre.com.br/modulo-sim7600g-h-4g-hat-para-raspberry-pi-e-pc-suporta-lte/p/MLB2041822322>. Acesso em: 14 jul. 2026.

MERCADO LIVRE. Placa ESP32 DevKit V1. [S. l.], 2026. Disponível em: <https://lista.mercadolivre.com.br/esp32-devkit-v1>. Acesso em: 14 jul. 2026.

MERCADO LIVRE. Resistor Shunt. [S. l.], 2026. Disponível em: <https://lista.mercadolivre.com.br/resistor-shunt>. Acesso em: 14 jul. 2026.

MERCADO LIVRE. RTC DS3231. [S. l.], 2026. Disponível em: <https://lista.mercadolivre.com.br/rtc-ds3231>. Acesso em: 14 jul. 2026.

NAMUR. NE 43: Standardisation of the Signal Level for the Breakdown Information of Digital Transmitters. [S. l.]: NAMUR, [19--].

PELANDO. Kit Painel Solar 20w 12v Monocristalino + Controlador 10A. [S. l.], 2026. Disponível em: <https://www.pelando.com.br/d/kit-painel-solar-20w-12v-monocristalino-controlador-10a-prateado-1000v-18v-ea58>. Acesso em: 14 jul. 2026.

RECICOMP. Placa ESP32 DevKit V1 WiFi Bluetooth. [S. l.], 2026. Disponível em: <https://www.recicomp.com.br/produtos/placa-esp32-devkit-v1-wifi-bluetooth/>. Acesso em: 14 jul. 2026.

ROBOCORE. Módulo Cartão Micro SD. [S. l.], 2026. Disponível em: <https://www.robocore.net/outros-componentes-eletronicos/modulo-cartao-micro-sd>. Acesso em: 14 jul. 2026.

RS ROBÓTICA. Módulo RTC DS3231. [S. l.], 2026. Disponível em: <https://www.rsrobotica.com.br/modulo-rtc-ds1307>. Acesso em: 14 jul. 2026.

RST INSTRUMENTS. Precision Data Loggers for Geotechnical Sensors. Coquitlam, [20--]. Disponível em: <https://rstinstruments.com/product-category/instruments/data-loggers/>. Acesso em: 13 jul. 2026.

SAMARCO MINERAÇÃO S. A. Desafio SAGA: monitoramento contínuo de piezômetros em barragens de mineração. [S. l.: s. n.], 2026.

SCIENCEDIRECT. ESPiezometer: ESP32-based field tool for installation and validation of piezometric sensors for groundwater level monitoring. [S. l.], 2026. Disponível em: <https://www.sciencedirect.com/science/article/pii/S2468067226000337>. Acesso em: 13 jul. 2026.

SISGEO. WR Log Wireless Dataloggers. [S. l.], [20--]. Disponível em: <https://sisgeo.com/products/discontinued/wr-log-wireless-dataloggers/>. Acesso em: 13 jul. 2026.

SISTEMA NACIONAL DE INFORMAÇÕES SOBRE SEGURANÇA DE BARRAGENS (SNISB). Relatório Anual de Segurança de Barragem. Brasília, DF: ANA, 2025. Disponível em: <https://www.snirh.gov.br/portal/snisb/relatorio-anual-de-seguranca-de-barragem>. Acesso em: 14 jul. 2026.

TRICE BRASIL. Preço da mão de obra de eletricista em 2026. [S. l.], 2026. Disponível em: <https://www.tricebrasil.com.br/blog/preco-da-mao-de-obra-de-eletricista-em-2026>. Acesso em: 14 jul. 2026.

UBIDOTS. Preços. [S. l.], 2026. Disponível em: <https://pt.ubidots.com/pricing>. Acesso em: 13 jul. 2026.

UNIVERSIDADE FEDERAL DE OURO PRETO (UFOP). Sistema de Monitoramento Online de Barragens. Ouro Preto: UFOP, 2019. Disponível em: <https://www.monografias.ufop.br/bitstream/35400000/1818/11/MONOGRAFIA_SistemaMonitoramentoOnline.pdf>. Acesso em: 13 jul. 2026.

USINAINFO. Sensor de Nível Submersível para Líquidos 4 a 20mA, Sonda Inox 304. [S. l.], 2026. Disponível em: <https://www.usinainfo.com.br/sensor-de-nivel/sensor-de-nivel-submersivel-para-liquidos-4-a-20ma-sonda-inox-304-1m-com-cabo-de-3m-9117.html>. Acesso em: 14 jul. 2026.

VIVO. Chip M2M para Empresas. [S. l.], 2026. Disponível em: <https://vivo.com.br/para-empresas/produtos-e-servicos/servicos-essenciais/movel/m2m-e-kite-platform>. Acesso em: 14 jul. 2026.

WORLDSENSING. Piconode: Compact Data Logger. [S. l.], [20--]. Disponível em: <https://www.worldsensing.com/product/piconode-data-acquisition/>. Acesso em: 13 jul. 2026.

