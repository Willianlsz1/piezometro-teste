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

*Nota: atualizar os números de página no Word após a diagramação final (Referências > Sumário)
ou preencher manualmente.*

---

## 1.1 EQUIPE

Unidade SENAI: Belo Horizonte HORTO

Instrutor orientador: `[PREENCHER: instrutor orientador]`

| ALUNO | CURSO | FUNÇÃO NO PROJETO |
|---|---|---|
| Gustavo | Técnico em Automação Industrial | Programação do firmware em C/C++ para o microcontrolador ESP32, implementação do mecanismo de store & forward com carimbo de tempo, controle do modo deep sleep e integração com o backend em nuvem. |
| Marcelo | Técnico em Automação Industrial | Projeto e dimensionamento do circuito de alimentação autônoma (painel solar, controlador de carga e bateria selada de 12 V 18 Ah) e calibração do sinal de corrente de 4 a 20 mA. |
| Matheus | Técnico em Automação Industrial | Construção e dimensionamento da bancada física de simulação hidráulica vertical em PVC para testes experimentais e desenvolvimento do gabinete de proteção IP66. |
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

Objetivo Geral: Desenvolver, integrar e homologar uma Unidade de Controle e Telemetria de baixo consumo para o monitoramento contínuo e remoto de piezômetros industriais, com processamento em nuvem, dashboard interativo e alertas preventivos em dupla via.

Objetivos Específicos:

- Programar o firmware do microcontrolador ESP32 responsável pela leitura do sensor, pelo mecanismo de store & forward com carimbo de tempo e pelo envio periódico dos dados para a nuvem.
- Desenvolver o backend em plataforma de computação em nuvem serverless, responsável pela ingestão, pelo armazenamento em banco de dados gerenciado e pela execução do motor de alertas por gatilho de tempo a cada minuto.
- Construir um dashboard web interativo capaz de exibir a leitura atual, o histórico em série temporal e os eventos de alerta de cada instrumento monitorado.
- Implementar o sistema de alertas preventivos em dupla via, por Telegram e por SMS, disparado nas transições de faixa de nível e repetido enquanto persistir a condição crítica.
- Projetar a Unidade de Controle e Telemetria industrial, incluindo o transdutor piezorresistivo submersível de 4 a 20 mA, o conversor analógico digital de 16 bits e o módulo de comunicação celular 4G.
- Dimensionar o sistema de alimentação autônoma da unidade de campo, composto por painel solar, controlador de carga e bateria selada, garantindo autonomia energética prolongada.
- Especificar o invólucro de campo com grau de proteção IP66, prensa cabos e proteção contra surtos, adequado à exposição ambiental de instalações geotécnicas.
- Construir e homologar a bancada vertical de PVC destinada a simular fisicamente as variações do nível de água de um piezômetro, validando a integração entre sensor, eletrônica e software.

### 1.3.4 Desenvolvimento

O desenvolvimento do AquaSense seguiu uma metodologia ágil, organizada em quatro fases distribuídas ao longo dos bimestres do curso, com participação conjunta dos quatro integrantes em cada etapa e responsabilidades específicas conforme a especialidade de cada um.

Na Fase I, de planejamento e especificações, correspondente ao primeiro bimestre, a equipe realizou o levantamento de requisitos da demanda e o estudo dos princípios de sensoriamento industrial de nível, culminando na seleção do transdutor piezorresistivo submersível com saída em corrente de 4 a 20 mA como sensor de referência do projeto. Nesta fase também foi definida a arquitetura geral do sistema, incluindo a decisão pelo uso de uma plataforma de computação em nuvem serverless para o backend, e Matheus elaborou o esboço mecânico da bancada vertical de simulação.

Na Fase II, de prototipagem e testes modulares, correspondente ao segundo bimestre, Isadora conduziu a cotação e aquisição dos componentes eletrônicos, incluindo o conversor analógico digital e o resistor de shunt de precisão. Marcelo montou o circuito de alimentação fotovoltaica, compreendendo painel solar, controlador de carga e bateria selada. Gustavo desenvolveu a primeira versão do firmware, responsável pela leitura da porta analógica via barramento I2C e pela conexão de rede do microcontrolador. Em paralelo, Matheus montou fisicamente a tubulação de PVC de dois metros que compõem a bancada de ensaios.

Na Fase III, de integração e calibração, correspondente ao terceiro bimestre, a equipe conectou o transdutor à bancada vertical e realizou a calibração da leitura de tensão do conversor analógico digital, correlacionando a tensão medida sobre o resistor de shunt de precisão de 150 ohms ao nível físico da coluna de água no poço simulado, por meio de dois pontos de referência conhecidos. Em paralelo, foi desenvolvido o backend em nuvem, com os endpoints de ingestão e de leitura, o esquema do banco de dados gerenciado e o motor de alertas executado por gatilho de tempo a cada minuto, além do mecanismo de store & forward do firmware para preservar leituras em caso de interrupção momentânea de rede.

Na Fase IV, de homologação e fechamento, correspondente ao quarto bimestre, a equipe integrou o dashboard web interativo ao backend, validando a exibição em tempo real e o histórico em série temporal, e realizou testes de ponta a ponta do sistema de alertas em dupla via, por Telegram e por SMS, verificando o disparo correto nas transições entre os níveis normal, atenção e crítico. Em paralelo, a equipe avançou na especificação do gabinete industrial com grau de proteção IP66 e prensa cabos, e teve início o processo de montagem física e homologação da Unidade de Controle e Telemetria na bancada vertical, etapa que segue em andamento.

### 1.3.5 Viabilidade técnica

A solução desenvolvida se apoia em padrões consolidados da instrumentação industrial. O uso do loop de corrente de 4 a 20 mA no transdutor garante imunidade a ruído eletromagnético mesmo em cabos longos dentro do poço, característica essencial em ambientes de campo sujeitos a interferências. A leitura desse sinal é feita por um conversor analógico digital externo de 16 bits, associado a um resistor de shunt de precisão de 150 ohms, que converte a faixa de 4 a 20 mA em uma faixa de tensão de 0,6 a 3,0 volts, plenamente compatível com a entrada do conversor sem risco de saturação. Essa combinação garante uma resolução muito superior à do conversor analógico digital nativo do microcontrolador, que possui apenas 12 bits e comportamento não linear nas extremidades da escala, insuficiente para uma medição de precisão em campo.

A robustez do sistema para operação em campo é reforçada por dispositivos de proteção contra surtos na entrada de energia e no loop de sinal, relevantes em estruturas expostas a descargas atmosféricas, e por um invólucro com grau de proteção IP66, que assegura vedação adequada contra poeira e jatos de água. O firmware implementa o mecanismo de store & forward, retendo localmente as leituras com carimbo de tempo quando a rede de comunicação está indisponível e reenviando os dados assim que a conexão é restabelecida, o que evita perda de informação em áreas de sombra de sinal celular.

No lado do backend, a escolha de uma plataforma de computação em nuvem serverless elimina o risco de hibernação do serviço, garantindo que o motor de alertas, executado por gatilho de tempo a cada minuto, permaneça ativo de forma contínua, sem depender de qualquer ping externo para retomar a execução. Essa característica é particularmente relevante para um sistema de alerta preventivo, cuja falha silenciosa é justamente o pior cenário possível. A arquitetura completa, do firmware ao dashboard, foi validada de ponta a ponta em ambiente de simulação, com o backend efetivamente publicado em nuvem, confirmando a viabilidade técnica da solução.

### 1.3.6 Viabilidade econômica

A viabilidade econômica do AquaSense foi avaliada a partir da comparação entre o custo da rotina tradicional de leitura manual terceirizada e o custo estimado de implantação e operação da solução proposta, tomando como referência a demanda oficial que motivou o projeto.

| Métrica | Situação tradicional (manual) | Solução AquaSense | Impacto |
|---|---|---|---|
| Custo operacional anual | Custo elevado com contratação de equipes de medição, deslocamento de veículos e consumo de combustível | Custo concentrado em manutenções preventivas esporádicas planejadas | Economia estimada de R$ 600.000,00 por ano em escala operacional |
| Frequência de dados | Baixa frequência, com leitura semanal ou mensal por piezômetro | Alta resolução de monitoramento, com leituras contínuas ao longo do dia | Detecção ágil de transientes de pressão hidráulica e infiltração rápida |
| Segurança do trabalho | Exposição constante de equipes a áreas geotécnicas instáveis | Exposição mínima, restrita a visitas programadas de manutenção preventiva | Redução direta do risco operacional das equipes de campo |
| Custo por ponto de monitoramento | Custo recorrente sem geração de ativo permanente | Investimento estimado de aproximadamente R$ 2.965,00 por ponto de monitoramento | Investimento estimado de R$ 260.000,00 para uma primeira série de 50 pontos |
| Tempo de retorno | Gasto constante sem possibilidade de retorno de capital | Investimento com retorno mensurável frente à economia operacional obtida | Payback estimado em cerca de 6 meses |

O valor de R$ 2.965 corresponde ao hardware de cada unidade; o investimento total de R$ 260.000,00 para a primeira série de 50 pontos inclui, além do hardware (R$ 148.250,00), a instalação e o comissionamento em campo (R$ 40.000,00), sobressalentes (R$ 14.825,00), a bancada de homologação (R$ 25.000,00) e a contingência de projeto (R$ 31.925,00), resultando em R$ 5.200,00 por ponto instalado.

O custo operacional anual estimado do sistema é de R$ 39.155,00, cobrindo a conectividade celular dos 50 pontos, a nuvem, a manutenção e as inspeções mensais de campo, o que representa uma redução de 93,5% sobre os R$ 600 mil/ano da situação tradicional, com payback estimado em 5,6 meses, ROI de 116% já no primeiro ano de operação e de 978% acumulado ao longo de cinco anos. O item de conectividade celular tem rotas concretas de redução de custo, como planos IoT de menor preço por chip e o uso de um gateway LoRaWAN compartilhado entre os pontos mais próximos.

Mesmo em uma comparação conservadora, o investimento estimado por ponto de monitoramento permanece uma ordem de grandeza abaixo dos pacotes comerciais completos de instrumentação e telemetria voltados a barragens de Dano Potencial Associado alto, cujos preços são tipicamente informados apenas sob consulta. Essa diferença sustenta a proposta de valor do AquaSense como alternativa economicamente viável para a camada de estruturas geotécnicas que hoje não têm acesso a nenhuma automação.

### 1.3.7 Resultados e conclusão

O AquaSense atingiu, até o momento, a validação completa da cadeia de software de ponta a ponta: o firmware do microcontrolador, o backend em nuvem responsável pela ingestão e pelo armazenamento das leituras, o dashboard web com exibição de série histórica e o motor de alertas em dupla via, por Telegram e por SMS, estão operacionais em ambiente de produção na nuvem. Os testes realizados confirmaram que as transições entre os níveis normal, atenção e crítico disparam corretamente as notificações, e que o mecanismo de store & forward preserva as leituras mesmo diante de interrupções momentâneas de conectividade.

A montagem e a homologação física da Unidade de Controle e Telemetria na bancada vertical de PVC constituem etapa em andamento, na qual a equipe segue validando a integração entre o transdutor de pressão, o circuito de condicionamento de sinal e o gabinete industrial, com o objetivo de comprovar em bancada os mesmos resultados já obtidos no ambiente de simulação e nuvem.

O desenvolvimento do projeto permitiu que os quatro integrantes, todos do curso Técnico em Automação Industrial, integrassem competências complementares de firmware, instrumentação, energia e documentação técnica sob um desafio real de mercado, cumprindo os objetivos propostos na etapa de software concluída e mantendo a etapa de homologação física como continuidade natural do trabalho.

---

## 1.4 ANEXOS

### 1.4.1 Orçamento Estimado (BOM)

Anexo I: Orçamento Estimado da Unidade de Controle e Telemetria (BOM, Bill of Materials)

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

