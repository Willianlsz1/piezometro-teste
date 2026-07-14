> **DOCUMENTO HISTÓRICO (material-fonte).** Este rascunho foi superado pelo TCC oficial da
> equipe (AquaSense, template INTEGRA-MG, mantido em Word pela equipe; versão de entrega em
> `TCC_AQUASENSE.md`/`TCC_ENTREGA.docx` nesta pasta). Permanece no repositório como fonte de
> consulta: a prosa de seções como cadeia de confiança do dado, piezômetro vs INA e limitações
> continua útil para incorporar ao texto oficial. Não usar os números econômicos daqui — os
> oficiais estão em `docs/projeto/VIABILIDADE_ECONOMICA.md`.

---

# TÍTULO DO PROJETO

**Sugestão principal:** Sistema IoT de monitoramento online do nível d'água em piezômetros de
barragens de mineração.

**Alternativas:** "Monitoramento contínuo e alertas preventivos para instrumentação geotécnica de
barragens: um protótipo IoT de baixo custo" e "Piezômetro conectado: telemetria em tempo real e
alertas automáticos para segurança de barragens de mineração".

---

## 1.1 EQUIPE

| Aluno | Curso | Função no projeto |
|---|---|---|
| [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |

**Unidade SENAI:** [PREENCHER]

**Instrutor orientador:** [PREENCHER]

---

## 1.2 PROBLEMA

A segurança de barragens de mineração depende, entre outros fatores, do monitoramento contínuo da
poropressão no maciço, isto é, da pressão da água nos poros do solo, medida por instrumentos
chamados piezômetros. Pelo princípio das tensões efetivas de Terzaghi (σ' = σ − u), quando a
poropressão (u) sobe sem que a tensão total (σ) mude, a tensão efetiva (σ') cai, reduzindo a
resistência ao cisalhamento do maciço e aumentando o risco de liquefação. Foi exatamente esse
mecanismo, linha freática alta sem rebaixamento efetivo e auscultação deficiente, que os relatórios
oficiais apontam como fator nas rupturas das barragens de Fundão (Mariana, 2015, 19 mortos) e B1
(Brumadinho, 2019, 270 mortos).

O desafio SAGA, proposto pela Samarco Mineração S.A., parte de uma demanda concreta: hoje a leitura
de piezômetros em boa parte das instalações ainda é feita manualmente, por equipe terceirizada que
se desloca até o local com frequência periódica (semanal a mensal, em operação estabilizada). Esse
modelo carrega três problemas: um custo recorrente relevante (a Samarco declara, no próprio edital
do desafio, uma economia estimada de R$ 600 mil por ano ao substituir a medição manual terceirizada
por monitoramento automatizado), o risco de a frequência de leitura não acompanhar a velocidade
real de uma anomalia (uma leitura semanal pode não capturar a elevação de poropressão a tempo de
disparar uma resposta) e a dependência de que alguém, fisicamente, esteja olhando o dado no momento
certo.

O problema, porém, é maior do que uma barragem específica. A legislação pós-Brumadinho (Lei
14.066/2020 e Resolução ANM 95/2022) passou a exigir monitoramento automatizado, em tempo real e em
período integral, para barragens de Dano Potencial Associado (DPA) alto, mas essa automação
profissional (piezômetros de corda vibrante, dataloggers, telemetria industrial) tem custo elevado
e preço tipicamente "sob consulta". Segundo o Sistema Nacional de Informações sobre Segurança de
Barragens (SNISB), o Brasil tem 28.043 barragens cadastradas, das quais apenas 6.210 estão
enquadradas na Política Nacional de Segurança de Barragens (PNSB), ou seja, a esmagadora maioria
das estruturas do país, incluindo pequenas barragens de água, açudes e aterros sanitários, segue
sem instrumentação automatizada, lida manualmente ou não lida.

Este projeto responde à demanda oficial do desafio SAGA (monitoramento contínuo de piezômetro,
transmissão em tempo real, dashboard, histórico e alertas preventivos) e, ao mesmo tempo, evidencia
que a solução construída se aplica à camada de estruturas que hoje não tem acesso a monitoramento
automatizado por barreira de custo, não apenas às barragens de DPA alto que já são obrigadas por
lei a monitorar.

---

## 1.3 SOLUÇÃO

O sistema é composto por um ESP32 com sensor de nível d'água que envia leituras a cada 10 segundos,
via HTTP autenticado, para um Cloudflare Worker que grava os dados em um banco Cloudflare D1
(SQLite gerenciado). Um cron trigger de 1 minuto no próprio Worker executa um motor de alertas em
três camadas que classifica cada leitura em NORMAL, ATENÇÃO ou CRÍTICO e dispara notificações por
Telegram e/ou SMS (Twilio) nas transições de faixa. Um dashboard web hospedado no GitHub Pages
consome os mesmos dados (últimas leituras e séries históricas) para exibir gráficos, mapa e
histórico de eventos em tempo real. O firmware implementa store and forward: leituras feitas sem
conectividade ficam retidas em buffer local, com timestamp obtido por NTP, e são reenviadas assim
que a rede volta, sem perda de dados.

Cabe deixar claro, desde já, o papel de cada parte deste trabalho. O protótipo, montado com
componentes de bancada, é a representação funcional da ideia: existe para demonstrar a arquitetura
operando de ponta a ponta, do sensor ao alerta no celular. O produto do trabalho é maior do que
ele e independe dele: é a plataforma de software completa (backend, banco, motor de alertas e
dashboard, todos em produção), a especificação de engenharia da versão profissional, a pesquisa de
mercado com fontes, a análise de viabilidade econômica com preço e retorno calculados e o
protocolo de validação experimental, todos desenvolvidos pela equipe e apresentados nas seções
seguintes.

### 1.3.1 ÁREA TECNOLÓGICA DA SOLUÇÃO

Internet das Coisas (IoT) e sistemas embarcados, computação em nuvem serverless (Cloudflare
Workers, D1 e KV) e instrumentação geotécnica aplicada à segurança de barragens.

### 1.3.2 JUSTIFICATIVA

Soluções comerciais de automação de instrumentação geotécnica (piezômetro de corda vibrante,
datalogger e telemetria industrial) já existem e atendem bem às barragens de DPA alto, mas a preço
tipicamente "sob consulta", o que naturalmente restringe sua adoção à camada de estruturas com
orçamento e obrigação legal para isso. Uma pesquisa de mercado conduzida durante o projeto
confirmou esse ponto de forma direta: nenhum dos oito fabricantes e integradores pesquisados
(Worldsensing, Geokon, Sisgeo, Ackcio, Encardio-rite, RST Instruments e Canary Systems, além de
revendedores brasileiros) publica uma tabela de preços; todos direcionam o interessado para "fale
com vendas". O único número concreto de custo de automação de instrumentação encontrado na
pesquisa vem de um artigo técnico do IBRACON de 2007 sobre automação de medidores triortogonais
(não piezômetros de corda vibrante, mas o dado mais próximo disponível): entre US$ 1.636 e US$
2.370 por instrumento, quase vinte anos atrás.

Este projeto não compete com essa automação profissional: ele democratiza o conceito de centro de
monitoramento contínuo com alertas automáticos para a camada de barragens, açudes e aterros que
hoje é lida à mão, a um custo de hardware por ponto estimado em R$ 150 a R$ 220 no cenário de
protótipo (ESP32, sensor ultrassônico, display OLED, sinalização luminosa e sonora e acessórios
de montagem), somado a um backend que opera
dentro do free tier da Cloudflare. A proposta de valor central é trocar a detecção tardia (uma
leitura manual periódica que só revela uma anomalia dias ou semanas depois de ela começar) por
alerta preventivo, com notificação em até aproximadamente um minuto após a transição de faixa.

Cabe uma ressalva honesta de terminologia: o protótipo, como construído hoje, mede coluna d'água
por meio de um sensor ultrassônico, o que é tecnicamente mais próximo de um INA (indicador de
nível d'água), que mede o nível freático geral, do que de um piezômetro de corda vibrante, cujo
bulbo é selado com bentonita para isolar e medir a poropressão de uma camada específica do maciço.
A diferença entre os dois está no elemento sensor e na instalação, não na eletrônica: toda a cadeia
de telemetria, alertas e dashboard é idêntica para ambos os casos. Por isso o firmware foi desenhado
com um contrato de "adapter" de sensor (`piezometro_core.h` mais arquivos `sketch_*.ino`
intercambiáveis): para operar com um transdutor de pressão ou piezômetro de corda vibrante de
verdade, bastaria escrever um novo adapter que leia o sinal do instrumento real e devolva a mesma
grandeza (nível ou pressão), sem alterar o restante do sistema.

### 1.3.3 OBJETIVOS

O objetivo geral do projeto é desenvolver e demonstrar um sistema IoT de baixo custo para
monitoramento contínuo do nível d'água em piezômetros de barragens, com transmissão em tempo real,
histórico persistido e alertas preventivos automáticos.

Como objetivos específicos, o projeto se propõe a medir continuamente o nível d'água por meio de
um sensor embarcado no ESP32, a intervalos regulares de 10 segundos no protótipo, e a transmitir
cada leitura em tempo real para um backend em nuvem, autenticado por chave de dispositivo. Propõe
também persistir o histórico completo das leituras em um banco de dados consultável, sem limite de
retenção dentro do free tier utilizado, e classificar cada leitura em três faixas de risco (NORMAL,
ATENÇÃO e CRÍTICO) com limiares parametrizáveis, cujo padrão é 12 m e 15 m, refletindo que os
valores de controle reais são definidos caso a caso pelo projetista geotécnico. A isso se soma a
emissão de alertas automáticos por Telegram e/ou SMS em até aproximadamente um minuto após uma
transição de faixa, mesmo sem ninguém observando o dashboard no momento, e por fim a operação com
resiliência a queda de conectividade, por meio de store and forward com buffer local e timestamp
via NTP, sem perda de leituras.

### 1.3.4 DESENVOLVIMENTO

**Arquitetura geral.** O ESP32, seja na simulação Wokwi ou na maquete física, lê o sensor de nível
d'água a cada 10 segundos e publica cada leitura em `POST /ingest`, em formato JSON, autenticado
com a `DEVICE_KEY` no cabeçalho `x-device-key`. O Cloudflare Worker recebe essa requisição,
grava a leitura no Cloudflare D1 com deduplicação por índice único e, por meio de um cron trigger
executado uma vez por minuto, roda o motor de alertas em três camadas, cujo estado fica em
Cloudflare Workers KV; quando uma transição de faixa ocorre, o Worker aciona a Telegram Bot API e,
opcionalmente, o Twilio para SMS. O dashboard, hospedado no GitHub Pages, apenas lê os dados por
meio de `GET /ultimos` (última leitura de cada piezômetro) e `GET /dados` (série histórica agregada
para os gráficos, com filtro por piezômetro e por janela de tempo). O ESP32 nunca fala diretamente
com o banco de dados, e nenhum segredo de banco fica exposto no firmware nem no HTML público; todos
os segredos ficam em secrets do Cloudflare, fora do repositório de código.

Vale registrar, com honestidade metodológica, a evolução entre a primeira versão do sistema (v1) e
a atual (v2, descrita acima). A v1 usava um proxy Node.js (`server.js`) hospedado no Render, que
ingeria as leituras do ESP32, repassava as consultas do dashboard ao InfluxDB Cloud e rodava o
motor de alertas via `setInterval`. Essa arquitetura foi substituída por três motivos documentados:
o plano gratuito do Render hibernava após 15 minutos de inatividade, o que pausava o motor de
alertas justamente quando ninguém estava olhando o dashboard, o pior momento possível para isso
acontecer; o InfluxDB Cloud, no plano gratuito, tinha retenção de dados limitada a 30 dias em
contas novas e exigia gerenciar tokens de leitura e escrita separados; e manter três serviços
externos (Render, InfluxDB, GitHub Pages) para um protótipo de TCC adicionava complexidade
operacional sem benefício correspondente. A v2 consolida ingestão, armazenamento e motor de
alertas em uma única plataforma (Cloudflare), sem credenciais externas de banco de dados, com
retenção ilimitada dentro do limite de armazenamento do free tier (cerca de 5 GB) e um cron trigger
que nunca hiberna. A v1 não foi apagada do projeto: permanece preservada no histórico do git para
eventual consulta comparativa, e a decisão de não voltar a ela é considerada fechada.

**Firmware.** O firmware é dividido em um núcleo comum, `firmware/piezometro_core.h`, que
concentra a lógica de conexão WiFi, sincronização de hora via NTP, buffer de store and forward,
envio HTTP, classificação de alertas locais e controle do display OLED, e em adapters de sensor
específicos por cenário: `firmware/sketch.ino` para a simulação no Wokwi, que usa um BMP180, sensor
barométrico, como stand-in (a pressão do slider é convertida em nível d'água simulado pela escala
didática de 10 hPa igual a 1 m), e `firmware/sketch_fisico_jsn_sr04t.ino` para a maquete física
(sensor ultrassônico JSN-SR04T medindo a distância até a água de verdade dentro de um tubo ou
balde, convertida em nível pela escala `ESCALA_M_POR_CM = 0,5`). Os dois adapters compartilham o
mesmo núcleo; só a leitura do sensor muda, validando na prática o contrato de adapter descrito na
justificativa.

Em ambos os cenários, cada leitura recebe timestamp obtido por sincronização NTP, para que leituras
acumuladas em buffer, durante uma queda de rede, sejam registradas com o instante real em que
ocorreram, e não com o instante em que finalmente chegaram ao servidor. Alertas locais (LED verde,
amarelo ou vermelho, buzzer, display OLED) reproduzem a mesma classificação de faixa do backend, de
forma independente, e o sistema opera em modo degradado: uma falha no display OLED ou uma leitura
de sensor fora da faixa válida não derruba a medição nem o envio dos dados; leituras inválidas
simplesmente não entram no histórico, evitando poluir a série temporal com ruído de sensor. Na
maquete física, essa robustez de leitura já parte do próprio sensor: o firmware calcula a mediana
de cinco leituras espaçadas de 30 ms, descartando ecos fora da faixa útil (menor que 25 cm ou maior
que 450 cm), o que se mostra mais robusto a ruído e eco espúrio do que uma leitura única.

Além do modo sempre ligado usado na demonstração, o projeto já mantém, como opção de compilação
independente do núcleo padrão, um modo de operação em campo baseado em deep sleep
(`firmware/piezometro_deep_sleep.h`). Nesse modo, o ESP32 acorda a cada cinco minutos, executa o
ciclo completo de medição, conexão WiFi e envio em cerca de 15 segundos, e volta a dormir em modo
de baixíssimo consumo. Como o `esp_deep_sleep_start()` reinicia o programa do zero a cada
despertar, esse header mantém seu próprio buffer de leituras retidas em memória RTC, em vez de
reaproveitar o buffer do núcleo padrão, e ressincroniza o NTP a cada ciclo. É um modo
opt-in, habilitado por uma diretiva de compilação antes da inclusão do núcleo, pensado para a
operação de campo real; a maquete de demonstração continua no modo sempre ligado, com LEDs, buzzer
e OLED ativos o tempo todo, porque essa é a escolha certa para uma apresentação ao vivo à banca.

**A cadeia de confiança do dado.** Um sistema de monitoramento de segurança de barragem só tem
valor se o número exibido no dashboard for exatamente o que o sensor mediu, sem perda, duplicação
ou disfarce no caminho. O projeto trata essa garantia de integridade como uma cadeia de elos
explícitos. No transporte, a autenticação por `DEVICE_KEY` é fail-closed: sem a secret configurada
no Worker, o endpoint `/ingest` responde com erro e nada entra no banco; com a secret configurada,
uma chave incorreta é rejeitada, e a ausência ou o erro na chave nunca é tratado como "permitir e
seguir". No armazenamento, um índice único sobre piezômetro e timestamp evita que o reenvio do
buffer de store and forward (por exemplo, após uma confirmação HTTP perdida) duplique a mesma
leitura, e cada linha guarda duas dimensões de tempo distintas: o instante da medição, definido
pelo firmware via NTP, e o instante em que o Worker recebeu o dado, o que é necessário justamente
porque, no store and forward, os dois instantes podem divergir. O histórico é, na prática,
somente para inserção: a API não expõe nenhum endpoint de edição ou exclusão de leituras, apenas as
rotas de ingestão e consulta. Na exibição, um dado velho nunca aparece disfarçado de normal: o
frescor de cada piezômetro é calculado a partir do instante em que o servidor recebeu a última
leitura, e não do relógio do dispositivo, de modo que, se esse prazo estourar, o painel mostra o
estado neutro "sem sinal" em vez de continuar exibindo a última faixa de nível conhecida. Essa
mesma lógica de "sem sinal" corresponde, no motor de alertas, à camada que trata o silêncio de um
instrumento como uma condição de risco a ser monitorada, não como ausência de problema. O padrão
comum a todas essas decisões é simples: na dúvida, o sistema prefere descartar, marcar como
inválido ou exibir um estado neutro a inventar ou disfarçar um valor. Essa cadeia garante a
integridade do dado por construção; ela não substitui a validade metrológica da medição, que
depende de calibração contra uma referência e é tratada, em escala de bancada, no protocolo descrito
na Viabilidade Técnica.

**Backend.** O backend roda inteiramente em `cloudflare-worker/`, dividido em sete módulos ES, cada
um com uma responsabilidade única: `index.js` como roteador, que só orquestra `fetch` e
`scheduled`; `config.js` para configuração e constantes; `http.js` para CORS, respostas JSON e
limites de payload; `db.js` para todas as queries ao D1; `alertas.js` para o motor de alertas e o
estado no KV; `notificacoes.js` para a integração com Telegram e Twilio; e `rotas.js` para os
handlers dos endpoints. Essa divisão segue uma regra de projeto adotada desde o início, de limite
de aproximadamente 300 linhas por arquivo e uma responsabilidade por arquivo, para manter o código
auditável.

O motor de alertas roda em três camadas a cada ciclo do cron, de um minuto: a primeira é o nível,
com histerese inspirada na norma ISA-18.2 de gerenciamento de alarmes, para evitar disparos
repetidos por oscilação em torno do limiar; a segunda é a comunicação, que sinaliza quando um
piezômetro para de enviar leituras; e a terceira é a taxa de variação, para sinalizar subidas
anormalmente rápidas de nível. O estado de cada camada, incluindo a última faixa notificada e o
histórico de reenvio, é persistido no Cloudflare Workers KV, já que um Worker não mantém estado em
memória entre invocações; e, como o free tier de Workers KV permite apenas 1.000 escritas por dia,
o motor grava no KV somente quando o estado muda de faixa, nunca de forma incondicional a cada
ciclo, decisão de arquitetura deliberada. Outro cuidado relevante fica na agregação temporal usada
pelos gráficos, que precisa dividir o timestamp por um bucket de tempo: o D1 e o SQLite fazem essa
divisão em ponto flutuante por padrão, o que já foi identificado como um bug real em revisão de
código e corrigido com um `CAST` explícito para inteiro; a regra é não regredir esse comportamento.

**Exportação de relatórios.** O dashboard oferece dois formatos de exportação do histórico, ambos
alimentados pela mesma função de coleta de dados, para que nunca divirjam entre si. O primeiro é um
CSV pensado como evidência de auditoria: além das linhas de dados (data e hora, piezômetro, nível
médio, mínimo, máximo, número de leituras no intervalo, status e qualidade), o arquivo carrega um
bloco de metadados no topo com o instrumento consultado, o período solicitado, o intervalo de
agregação, o momento em que o arquivo foi gerado, se a fonte era a API real ou o modo de simulação,
e os limiares de atenção e crítico vigentes no momento da exportação. O segundo formato é uma
planilha Excel formatada (gerada em SpreadsheetML), com título, cabeçalho colorido, status
sinalizado por cor e uma seção de resumo do período, voltada a quem prefere um layout de leitura
mais direta do que o CSV bruto. Em ambos os formatos, o status de cada intervalo é sempre calculado
sobre o pico do intervalo, nunca sobre a média, para que um pico pontual de nível crítico dentro de
um intervalo de média mais baixa não seja mascarado como normal.

**Dashboard.** O dashboard (`index.html` mais `assets/`) roda inteiramente no GitHub Pages, sem
bundler: o HTML concentra apenas a estrutura, com cerca de 280 linhas, o CSS fica em
`assets/styles.css` e a lógica é dividida em oito módulos JavaScript carregados em ordem de
dependência (`config`, `util`, `fontes`, `estado`, `graficos`, `paineis`, `exportar`, `app`). Entre
as funcionalidades principais estão a atualização em tempo real por polling a cada 10 segundos, os
gráficos com média e pico por janela de tempo, o mapa dos piezômetros, a distinção visual entre
alarme (condição atual) e evento (transição registrada no histórico), a indicação explícita de
"sem sinal" quando um instrumento para de enviar leituras, e a exportação do histórico já descrita
acima. Quando o backend não está acessível, o dashboard ativa um modo de simulação sinalizado por
um banner destacado no topo da página, para que dados fictícios de demonstração nunca sejam
confundidos com leituras reais.

**A versão de produção.** O trabalho não termina no protótipo: especificamos a versão profissional
do sistema sobre a mesma plataforma, seguindo o princípio de que profissionalizar significa trocar
as pontas e manter o núcleo. O sensor de bancada dá lugar a um transdutor de pressão submersível
(com o piezômetro de corda vibrante como opção premium), conectado pelo mesmo contrato de adapter
do firmware, sem alterar backend, dashboard ou motor de alertas; a alimentação passa a painel
solar com bateria operando em deep sleep, modo que já implementamos e que reduz o consumo em cerca
de trinta vezes; e a comunicação ganha a opção LoRaWAN para locais sem cobertura WiFi. Parte dessa
versão já está em produção no software: cada dispositivo passou a ter chave de autenticação
própria, revogável individualmente sem afetar os demais, e o banco consolida automaticamente as
leituras antigas em resumos diários, mantendo histórico de tendência ilimitado com armazenamento
controlado. O plano de implantação prevê três fases, do piloto interno de cinco pontos ao produto
em escala, com custo por ponto entre R$ 1.800 e R$ 2.200 na configuração padrão, abaixo do preço
de venda definido na viabilidade econômica.

**Metodologia de trabalho.** O desenvolvimento seguiu duas frentes paralelas e complementares:
simulação no Wokwi, para iteração rápida de firmware e testes de alerta sem depender de hardware
físico, e montagem de uma maquete física real (ESP32, sensor JSN-SR04T e tubo com água), ambas
falando com o mesmo backend em produção. O código foi versionado
em git ao longo de todo o projeto, com a v1 preservada no histórico para rastreabilidade da decisão
de migração, e o backend é publicado por deploy contínuo a partir do repositório, incluindo a
aplicação automática das migrações de banco antes de cada publicação.

### 1.3.5 VIABILIDADE TÉCNICA

Todos os componentes de hardware usados no protótipo são de fácil acesso no mercado nacional
(ESP32, sensor ultrassônico JSN-SR04T, display OLED, LEDs e buzzer, todos disponíveis em
fornecedores nacionais de componentes eletrônicos), sem depender de importação ou de peças
especiais.

A precisão do sensor utilizado na maquete física foi avaliada por um protocolo experimental
elaborado pela própria equipe: cinco alturas de água conhecidas, medidas com régua, cada
uma com dez leituras repetidas do sensor, calculando erro médio, desvio padrão e erro máximo por
altura, e declarando a incerteza final como aproximadamente duas vezes o maior desvio padrão
observado, regra prática de cerca de 95% de cobertura.

`[PREENCHER: resultados reais do ensaio de validação, erro médio em cm, desvio padrão em cm, erro
máximo em cm, e a incerteza declarada final em ±Z cm (2σ), na faixa de coluna d'água testada]`.

Quanto aos limites de operação em nuvem, o backend roda inteiramente dentro do free tier da
Cloudflare para o volume do protótipo: o limite mais apertado é o de Workers KV, de 1.000 escritas
por dia, já endereçado ao gravar o estado do motor de alertas apenas nas transições de faixa; o D1
comporta, na frequência de uma leitura a cada 10 segundos por ponto, até aproximadamente 11 pontos
de monitoramento simultâneos dentro da cota de 100 mil escritas por dia, e, reduzindo a frequência
para uma leitura por minuto, essa mesma cota comporta cerca de 69 pontos. Um crescimento além disso
tem caminho definido: o plano Cloudflare Workers Paid, a partir de US$ 5 por mês (cerca de R$ 25 a
R$ 30 por mês), custo irrisório frente a qualquer fração da economia estimada na viabilidade
econômica.

A alimentação elétrica também foi dimensionada com números, não apenas descrita qualitativamente.
O consumo atual da maquete, sempre ligada (WiFi ativo, OLED e LEDs acesos), foi estimado em
aproximadamente 30 Wh por dia. Uma instalação piloto alimentada por painel solar com bateria,
mantendo o firmware exatamente como está hoje, custaria entre R$ 385 e R$ 660 (painel de 20 W,
bateria de 12 V e 18 Ah, controlador de carga e conversor de tensão), com autonomia de cerca de
três dias nublados seguidos. A mudança de maior impacto, porém, é o modo de deep sleep já descrito
no desenvolvimento: acordar a cada cinco minutos em vez de manter o rádio sempre ativo reduz o
consumo em cerca de 30 vezes, de 30 Wh por dia para menos de 1 Wh por dia, o que é exatamente a
prática já adotada pelo mercado de instrumentação sem fio (nós de corda vibrante comerciais
declaram até dez anos de autonomia de bateria por dormirem quase o tempo todo).

O protótipo assume limitações que devem ser explicitadas: o sensor utilizado é um stand-in (BMP180
na simulação, sensor ultrassônico na maquete física), não um piezômetro de corda vibrante
certificado; e o sistema não implementa a redundância de energia (bateria ou painel solar) exigida
pela Resolução ANM 95/2022 para barragens de DPA alto, já que a maquete depende de alimentação de
rede ou USB. O caminho para uma instalação de produção real passa pelo contrato de adapter já
implementado no firmware: trocar o sensor por um transdutor de pressão ou piezômetro de corda
vibrante certificado exigiria escrever um novo adapter, sem alterar o restante da arquitetura de
backend, dashboard e motor de alertas.

### 1.3.6 VIABILIDADE ECONÔMICA

A análise econômica parte de duas referências concretas: o custo real dos componentes que
compramos para o protótipo e o gasto de R$ 600 mil por ano com medição manual terceirizada
declarado pela Samarco no edital do desafio SAGA. Reconstruímos esse gasto para verificar sua
coerência e o número fecha: um contrato de leitura manual de R$ 50 mil mensais cobre equipe de
campo, veículo, combustível, EPIs, encargos, supervisão de engenheiro e relatórios para atender
cerca de cem piezômetros lidos duas vezes por semana, o que resulta em R$ 58 por leitura
individual, valor compatível com o mercado de serviços técnicos terceirizados. Todos os cálculos
desta seção usam esse cenário de cem pontos.

Quanto custa o nosso produto: o protótipo de bancada custa R$ 220 por ponto em componentes (ESP32,
sensor ultrassônico, display, sinalização e acessórios). A versão de campo, que substitui o sensor
ultrassônico por um transdutor de pressão submersível e adiciona caixa hermética IP65, cabo
blindado e fixação, custa R$ 900 por ponto em materiais e, somada a instalação e calibração, chega a
R$ 1.400 por ponto instalado. O backend em nuvem custa R$ 30 por mês para a operação inteira, não
por ponto, e as notificações por Telegram são gratuitas.

Quanto a empresa gasta hoje: R$ 600 mil por ano, todos os anos, apenas para saber o nível dos seus
piezômetros.

Quanto ela passa a gastar com o sistema: R$ 140 mil de implantação, uma única vez (cem pontos a
R$ 1.400), e R$ 57 mil por ano de operação, valor que inclui nuvem, manutenção com reposição de
sensores e uma inspeção física mensal dos instrumentos, que a norma continua exigindo e que
mantivemos no cálculo por honestidade: o sistema elimina as visitas de leitura, não as visitas de
manutenção.

O resultado é direto. A economia recorrente é de R$ 543 mil por ano, uma redução de 91% no custo.
O payback da implantação é de 3,1 meses. Já no primeiro ano, descontando implantação e operação, a
empresa economiza R$ 403 mil líquidos, um retorno sobre o investimento (ROI) de 288% em doze
meses. Em cinco anos, a economia acumulada passa de R$ 2,5 milhões para um investimento de R$ 140
mil, um ROI superior a 1.800%. Não há cenário, mesmo dobrando todos os nossos custos, em que a
conta deixe de fechar, porque a distância entre o custo do sistema e o custo da leitura manual é
de duas ordens de grandeza.

Como produto comercial, definimos o preço de R$ 2.500 por ponto instalado mais uma assinatura de
plataforma de R$ 50 mensais por ponto. Esse preço foi fixado cruzando três referências: cobre o
nosso custo de R$ 1.400 com margem de 44% no hardware, representa cerca de 15% do que custa a
telemetria industrial equivalente (de R$ 5 mil a R$ 20 mil por ponto, sempre sob consulta) e fica
muito abaixo do valor que o cliente economiza. Na ponta do cliente, cada ponto lido manualmente
custa cerca de R$ 6 mil por ano; com o nosso sistema, ele paga R$ 3.100 no primeiro ano (kit mais
doze mensalidades) e R$ 600 por ano daí em diante. O investimento dele se paga em pouco mais de
seis meses e, a partir do segundo ano, ele gasta um décimo do que gastava.

Sobre o mercado além da Samarco: o Brasil tem 28.043 barragens cadastradas no SNISB e apenas 6.210
enquadradas na PNSB, de modo que mais de 21 mil estruturas seguem com leitura manual ou sem
leitura, às quais se somam cerca de 700 aterros sanitários com 5 a 15 piezômetros de chorume cada,
já obrigados a monitorar por condicionante de licença ambiental. Capturar 1% desse universo, cerca
de 900 pontos, significa R$ 2,25 milhões em vendas de kits e R$ 540 mil por ano de receita
recorrente de assinaturas. É um mercado real, alcançável com o preço definido acima, e no qual o
concorrente industrial não tem interesse em descer: a estrutura de custos dele não compete a
R$ 2.500 por ponto.

Uma empresa do porte da Samarco, sujeita à Resolução ANM 95/2022 para barragens de DPA alto,
compraria telemetria industrial certificada, e não é a ela que pretendemos vender: o desafio SAGA
valida o conceito de ponta a ponta, e o mercado do produto é a camada de estruturas que hoje não
monitora nada porque a única alternativa existente custa dez vezes mais.

### 1.3.7 RESULTADOS E CONCLUSÃO

O sistema foi demonstrado funcionando de ponta a ponta em dois cenários: simulação no Wokwi (ESP32
mais BMP180) e maquete física real (ESP32 mais JSN-SR04T medindo água de verdade dentro de um
tubo). Em ambos os casos foram observados medição contínua a cada 10 segundos, transmissão em
tempo real para o backend, persistência de histórico consultável no dashboard, classificação
correta em NORMAL, ATENÇÃO e CRÍTICO nos limiares configurados (12 m e 15 m), alertas entregues por
Telegram (e, quando configurado, SMS via Twilio) nas transições de faixa em até aproximadamente um
minuto (ciclo do cron), e resiliência a queda de rede, com o buffer de store and forward retendo
leituras localmente e reenviando-as sem perda assim que a conectividade retorna, comportamento
demonstrado desligando e religando a rede durante a operação.

`[PREENCHER: resultados quantitativos do ensaio de validação do sensor, inserir aqui a mesma
incerteza declarada (erro médio, desvio padrão, erro máximo, incerteza ±Z cm/2σ) já solicitada na
seção de Viabilidade Técnica, como evidência quantitativa do funcionamento do protótipo]`.

Ao longo do projeto, algumas melhorias de robustez foram identificadas e corrigidas, e valem ser
registradas como evidência de método de engenharia, isto é, de um processo de identificar,
corrigir e documentar, em vez de simplesmente declarar que o sistema "funciona". Entre elas estão a
introdução de um modo degradado no firmware, em que uma falha isolada de display ou de leitura de
sensor não derruba o envio dos demais dados; a deduplicação de leituras no armazenamento, para que
reenvios do buffer de store and forward nunca dupliquem uma linha no histórico; e a correção de um
falso estado de "sem sinal" que ocorria na simulação Wokwi, um bug identificado durante os testes e
corrigido antes de comprometer a credibilidade das demonstrações. Cada uma dessas correções está
documentada e é citada aqui não como um problema a esconder, mas como prova de que o projeto foi
conduzido com revisão e correção contínuas, e não apenas com um resultado final apresentado sem
histórico do caminho até ele.

Além do sistema em funcionamento, o trabalho entrega um conjunto de engenharia que existe
independentemente do protótipo: a especificação completa da versão de produção, com sensor
certificado, energia redundante e comunicação de campo; a pesquisa de mercado com fontes datadas,
que analisou oito fabricantes e confirmou a lacuna de preço que o produto ocupa; a análise
econômica com custo, preço, payback e retorno sobre investimento calculados; o protocolo de
validação experimental do sensor; e a cadeia de confiança do dado, implementada em código, da
autenticação por dispositivo à retenção automática do histórico. O protótipo é a representação
física que demonstra que tudo isso funciona em conjunto; o valor do trabalho está no conjunto.

As limitações honestas do protótipo continuam sendo as mesmas destacadas ao longo do documento: o
sensor utilizado é um stand-in de coluna d'água, mais próximo de um INA do que de um piezômetro de
corda vibrante; não há redundância de energia como exige a Resolução ANM 95/2022 para barragens de
DPA alto; e a validação de precisão realizada qualifica o sensor ultrassônico como medidor de
coluna d'água em bancada, não substituindo uma validação de piezômetro real, que exigiria
instrumento de referência certificado, ensaio em câmara de pressão controlada e comparação de
campo contra um piezômetro Casagrande instalado. O sistema é, declaradamente, um protótipo de
conceito.

Entre os trabalhos futuros estão a substituição do sensor por um piezômetro de corda vibrante
real, viabilizada pelo contrato de adapter já implementado; a adição de redundância de energia
(painel solar e bateria) para atender ao requisito da ANM 95/2022, cujo dimensionamento já foi
mapeado neste documento; a migração do firmware de campo para o modo de deep sleep já disponível
como opção de compilação; a adoção de uma chave de autenticação por dispositivo, hoje uma única
`DEVICE_KEY` compartilhada; e a conectividade via LoRaWAN para instalações de campo sem cobertura
WiFi.

---

## 1.4 ANEXOS

### 1.4.1 BMG CANVAS

Esqueleto dos nove blocos do Business Model Canvas, com base na pesquisa de mercado e no estudo
de viabilidade econômica conduzidos pela equipe, para transpor ao quadro visual.

| Bloco | Conteúdo sugerido |
|---|---|
| Proposta de valor | Monitoramento automatizado e alerta preventivo de nível d'água e poropressão a uma fração do custo da telemetria industrial (R$ 5.000 a R$ 20.000 por ponto), para estruturas hoje lidas manualmente, com preço de mercado próprio entre R$ 1.000 e R$ 3.500 por ponto instalado. |
| Segmentos de clientes | Em ordem de prioridade sugerida na base de conhecimento: primeiro, pequenas barragens de água e açudes (28.043 barragens cadastradas no SNISB, só 6.210 na PNSB); segundo, aterros sanitários (cerca de 700 no Brasil, cada um com 5 a 15 piezômetros de chorume, monitoramento já exigido como condicionante de licença ambiental); terceiro, encostas urbanas (defesa civil e prefeituras, 2.095 municípios em áreas de risco); e, como mercados adjacentes, obras civis de rebaixamento temporário de lençol freático, água subterrânea e agricultura, pilhas de estéril e taludes de cava. |
| Canais | Venda direta a operadores de barragens e municípios, parcerias com empresas de instrumentação geotécnica que hoje só atendem DPA alto, e editais públicos, como os desafios de inovação do tipo SAGA. |
| Relacionamento com clientes | Suporte à instalação e calibração, dashboard como ponto de contato contínuo, e alertas automáticos como demonstração recorrente de valor. |
| Fontes de receita | Venda ou comodato de hardware por ponto instalado (custo entre R$ 586 e R$ 1.179 em cenário de campo real, com margem), assinatura mensal de plataforma entre R$ 30 e R$ 80 por ponto, e serviço de instalação e calibração. |
| Recursos-chave | Firmware com contrato de adapter de sensor, backend Cloudflare (Worker, D1 e KV), e conhecimento de instrumentação geotécnica e da regulação (ANM 95/2022, Lei 14.066/2020). |
| Atividades-chave | Desenvolvimento e manutenção do firmware, backend e dashboard, validação de sensores, e suporte a instalação em campo. |
| Parcerias-chave | Fabricantes e fornecedores de sensores (transdutores de pressão, corda vibrante), integradores de instrumentação geotécnica, municípios e órgãos de defesa civil, e operadores de aterros sanitários. |
| Estrutura de custos | Hardware por ponto (custo único), operação em nuvem (free tier até certa escala, depois plano pago a partir de US$ 5 por mês), e eventual manutenção ou substituição de sensores em campo. |

### 1.4.2 SITUAÇÃO DE APRENDIZAGEM

`[PREENCHER conforme orientação do instrutor]`

Costumam compor esta seção as competências mobilizadas ao longo do projeto (desenvolvimento de
firmware embarcado em C++/Arduino, automação de processos, que vai do ciclo completo de medição,
transmissão, decisão e alerta sem intervenção humana até a publicação automática do sistema a cada
atualização do código, integração com APIs em nuvem via Cloudflare Workers, D1 e KV,
desenvolvimento web front-end em HTML, CSS e JavaScript sem bundler, noções de instrumentação
geotécnica e segurança de barragens, e trabalho em equipe com versionamento de código em git), o
cronograma do projeto e o papel individual de cada aluno, coerente com a tabela da equipe na seção
1.1.

`[PREENCHER: marcos do projeto, como pesquisa inicial, prototipagem no Wokwi, montagem da maquete
física, desenvolvimento do backend e do dashboard, validação do sensor, redação do TCC e ensaios
para a banca]`.

`[PREENCHER: papel de cada aluno, detalhado por nome, coerente com a tabela da seção 1.1, por
exemplo firmware, backend, dashboard, documentação ou pesquisa]`.

---

## Lista consolidada de marcadores [PREENCHER]

1. Seção 1.1: nomes dos alunos, curso e função de cada um na tabela da equipe.
2. Seção 1.1: Unidade SENAI.
3. Seção 1.1: Instrutor orientador.
4. Seção 1.3.5 (Viabilidade Técnica): resultados reais do ensaio de validação do sensor (erro
   médio, desvio padrão, erro máximo, incerteza declarada ±Z cm/2σ).
5. Seção 1.3.7 (Resultados e Conclusão): mesmos resultados quantitativos do ensaio de validação,
   repetidos como evidência de resultado.
6. Seção 1.4.2: conteúdo da Situação de Aprendizagem conforme orientação do instrutor.
7. Seção 1.4.2: cronograma do projeto.
8. Seção 1.4.2: papel individual de cada aluno.
