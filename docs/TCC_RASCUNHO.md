> **Nota de uso:** rascunho estruturado no template oficial (`TEMPLATE_INTEGRA_MG.docx`) — copie
> cada seção para o Word, substitua os `[PREENCHER]` e ajuste o texto à voz da equipe. Não entregue
> com marcadores `[PREENCHER]`. Todo o conteúdo factual abaixo foi extraído de `CLAUDE.md`,
> `readme.md`, `docs/BASE_DE_CONHECIMENTO.md`, `docs/DEFESA_BANCA.md`, `docs/VALIDACAO_SENSOR.md` e
> `docs/PROTOTIPO_FISICO.md` — nenhum número, norma ou fato foi inventado.

---

# TÍTULO DO PROJETO

**Sugestão principal:** Sistema IoT de monitoramento online do nível d'água em piezômetros de
barragens de mineração.

**Alternativas:**

1. Monitoramento contínuo e alertas preventivos para instrumentação geotécnica de barragens: um
   protótipo IoT de baixo custo.
2. Piezômetro conectado: telemetria em tempo real e alertas automáticos para segurança de barragens
   de mineração.

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
poropressão no maciço — a pressão da água nos poros do solo, medida por instrumentos chamados
piezômetros. Pelo princípio das tensões efetivas de Terzaghi (σ' = σ − u), quando a poropressão (u)
sobe sem que a tensão total (σ) mude, a tensão efetiva (σ') cai, reduzindo a resistência ao
cisalhamento do maciço e aumentando o risco de liquefação. Foi exatamente esse mecanismo — linha
freática alta sem rebaixamento efetivo e auscultação deficiente — que os relatórios oficiais
apontam como fator nas rupturas das barragens de Fundão (Mariana, 2015, 19 mortos) e B1
(Brumadinho, 2019, 270 mortos).

O desafio SAGA, proposto pela Samarco Mineração S.A., parte de uma demanda concreta: hoje a leitura
de piezômetros em boa parte das instalações ainda é feita manualmente, por equipe terceirizada que
se desloca até o local com frequência periódica (semanal a mensal, em operação estabilizada). Esse
modelo tem três problemas: custo recorrente relevante (a Samarco declara, no próprio edital do
desafio, uma economia estimada de **R$ 600 mil/ano** ao substituir a medição manual terceirizada por
monitoramento automatizado), risco de a frequência de leitura não acompanhar a velocidade real de
uma anomalia (uma leitura semanal pode não capturar a elevação de poropressão a tempo de disparar
uma resposta), e dependência de que alguém, fisicamente, esteja olhando o dado no momento certo.

O problema, porém, é maior do que uma barragem específica. A legislação pós-Brumadinho (Lei
14.066/2020 e Resolução ANM 95/2022) passou a exigir monitoramento automatizado, em tempo real e em
período integral para barragens de Dano Potencial Associado (DPA) alto — mas essa automação
profissional (piezômetros de corda vibrante, dataloggers, telemetria industrial) tem custo elevado e
preço tipicamente "sob consulta". Segundo o Sistema Nacional de Informações sobre Segurança de
Barragens (SNISB), o Brasil tem **28.043 barragens cadastradas**, das quais apenas **6.210 estão
enquadradas na Política Nacional de Segurança de Barragens (PNSB)** — ou seja, a esmagadora maioria
das estruturas do país, incluindo pequenas barragens de água, açudes e aterros sanitários, segue sem
instrumentação automatizada, lida manualmente ou não lida.

Este projeto responde à demanda oficial do desafio SAGA (monitoramento contínuo de piezômetro,
transmissão em tempo real, dashboard, histórico e alertas preventivos) e, ao mesmo tempo, evidencia
que a solução construída se aplica à camada de estruturas que hoje não tem acesso a monitoramento
automatizado por barreira de custo — não apenas às barragens de DPA alto que já são obrigadas por
lei a monitorar.

---

## 1.3 SOLUÇÃO

O sistema é composto por um ESP32 com sensor de nível d'água que envia leituras a cada 10 segundos,
via HTTP autenticado, para um Cloudflare Worker que grava os dados em um banco Cloudflare D1
(SQLite gerenciado). Um cron trigger de 1 minuto no próprio Worker executa um motor de alertas em 3
camadas que classifica cada leitura em NORMAL, ATENÇÃO ou CRÍTICO e dispara notificações por
Telegram e/ou SMS (Twilio) nas transições de faixa. Um dashboard web hospedado no GitHub Pages
consome os mesmos dados (últimas leituras e séries históricas) para exibir gráficos, mapa e
histórico de eventos em tempo real. O firmware implementa *store & forward*: leituras feitas sem
conectividade ficam retidas em buffer local, com timestamp obtido por NTP, e são reenviadas assim
que a rede volta, sem perda de dados.

### 1.3.1 ÁREA TECNOLÓGICA DA SOLUÇÃO

Internet das Coisas (IoT) e sistemas embarcados, computação em nuvem serverless (Cloudflare
Workers/D1/KV) e instrumentação geotécnica aplicada à segurança de barragens.

### 1.3.2 JUSTIFICATIVA

Soluções comerciais de automação de instrumentação geotécnica (piezômetro de corda vibrante +
datalogger + telemetria industrial) já existem e atendem bem às barragens de DPA alto — mas a preço
tipicamente "sob consulta", o que naturalmente restringe sua adoção à camada de estruturas com
orçamento e obrigação legal para isso. Este projeto não compete com essa automação profissional:
ele democratiza o **conceito** de centro de monitoramento contínuo com alertas automáticos para a
camada de barragens, açudes e aterros que hoje é lida à mão, a um custo de hardware por ponto
estimado em **R$ 150–220** (ver lista de compras em `docs/PROTOTIPO_FISICO.md`), somado a um backend
que opera dentro do free tier da Cloudflare. A proposta de valor central é trocar detecção tardia
(uma leitura manual periódica que só revela uma anomalia dias ou semanas depois de ela começar) por
alerta preventivo (notificação em até ~1 minuto após a transição de faixa).

É importante uma ressalva honesta de terminologia: o protótipo, como construído hoje, mede coluna
d'água por meio de um sensor ultrassônico — o que é tecnicamente mais próximo de um **INA
(indicador de nível d'água)**, que mede o nível freático geral, do que de um **piezômetro** de
corda vibrante, cujo bulbo é selado com bentonita para isolar e medir a poropressão de uma camada
específica do maciço. A diferença entre os dois está no elemento sensor e na instalação, não na
eletrônica: toda a cadeia de telemetria, alertas e dashboard é idêntica para ambos os casos. Por
isso o firmware foi desenhado com um contrato de "adapter" de sensor (`piezometro_core.h` +
arquivos `sketch_*.ino` intercambiáveis): para operar com um transdutor de pressão ou piezômetro de
corda vibrante de verdade, bastaria escrever um novo adapter que leia o sinal do instrumento real e
devolva a mesma grandeza (nível/pressão), sem alterar o restante do sistema.

### 1.3.3 OBJETIVOS

**Objetivo geral:** desenvolver e demonstrar um sistema IoT de baixo custo para monitoramento
contínuo do nível d'água em piezômetros de barragens, com transmissão em tempo real, histórico
persistido e alertas preventivos automáticos.

**Objetivos específicos:**

1. Medir continuamente o nível d'água por meio de um sensor embarcado no ESP32, a intervalos
   regulares (10 segundos no protótipo).
2. Transmitir cada leitura em tempo real para um backend em nuvem, autenticado por chave de
   dispositivo.
3. Persistir o histórico completo das leituras em um banco de dados consultável, sem limite de
   retenção dentro do free tier utilizado.
4. Classificar cada leitura em três faixas de risco (NORMAL, ATENÇÃO, CRÍTICO) com limiares
   parametrizáveis (padrão: 12 m e 15 m), refletindo que os valores de controle reais são definidos
   caso a caso pelo projetista geotécnico.
5. Emitir alertas automáticos por Telegram e/ou SMS em até aproximadamente 1 minuto após uma
   transição de faixa, mesmo sem ninguém observando o dashboard no momento.
6. Operar com resiliência a queda de conectividade, por meio de *store & forward* com buffer local
   e timestamp via NTP, sem perda de leituras.

### 1.3.4 DESENVOLVIMENTO

#### Arquitetura geral

```
ESP32 (Wokwi ou maquete física)
   │  sensor de nível d'água, leitura a cada 10 s
   │  POST /ingest  (JSON, header x-device-key)
   ▼
Cloudflare Worker  ──────────────►  Cloudflare D1 (SQLite gerenciado)
   │                                    ▲
   │  cron trigger, 1x/minuto           │  INSERT por leitura (dedupe por índice único)
   │  motor de alertas (3 camadas)      │
   │  estado em Cloudflare Workers KV   │
   ▼                                    │
Telegram Bot API / Twilio SMS      GET /ultimos, GET /dados  ◄──── Dashboard (GitHub Pages, index.html)
```

O ESP32 nunca fala diretamente com o banco de dados: ele publica cada leitura em `/ingest`,
autenticando-se com a `DEVICE_KEY` no header `x-device-key`; é o Worker quem grava no D1. O
dashboard, por sua vez, só lê — via `GET /ultimos` (última leitura de cada piezômetro) e
`GET /dados` (série histórica agregada para os gráficos, com filtro por piezômetro e por janela de
tempo). Nenhum segredo de banco fica exposto no firmware nem no HTML público: todos os segredos
ficam em *secrets* do Cloudflare, fora do repositório de código.

**Evolução v1 → v2 (honestidade metodológica):** a primeira versão do sistema (v1) usava um proxy
Node.js (`server.js`) hospedado no Render, que ingeria as leituras do ESP32, repassava as consultas
do dashboard ao InfluxDB Cloud e rodava o motor de alertas via `setInterval`. Essa arquitetura foi
substituída pela versão atual (v2, descrita acima) por três motivos documentados: (1) o plano
gratuito do Render hibernava após 15 minutos de inatividade, o que pausava o motor de alertas
justamente quando ninguém estava olhando o dashboard — o pior momento possível para isso acontecer;
(2) o InfluxDB Cloud, no plano gratuito, tinha retenção de dados limitada a 30 dias em contas novas
e exigia gerenciar tokens de leitura/escrita separados; (3) manter três serviços externos (Render,
InfluxDB, GitHub Pages) para um protótipo de TCC adicionava complexidade operacional sem benefício
correspondente. A v2 consolida ingestão, armazenamento e motor de alertas em uma única plataforma
(Cloudflare), sem credenciais externas de banco de dados, com retenção ilimitada dentro do limite de
armazenamento do free tier (~5 GB) e um cron trigger que nunca hiberna. A v1 não foi apagada do
projeto — permanece preservada no histórico do git para eventual consulta comparativa; a decisão de
não voltar a ela é considerada fechada.

#### Firmware

O firmware é dividido em um núcleo comum, `firmware/piezometro_core.h`, que concentra a lógica de
conexão WiFi, sincronização de hora via NTP, buffer de *store & forward*, envio HTTP, classificação
de alertas locais e controle do display OLED — e em *adapters* de sensor específicos por cenário:
`firmware/sketch.ino` para a simulação no Wokwi (usa um BMP180, sensor barométrico, como *stand-in*:
a pressão do slider é convertida em nível d'água simulado pela escala didática de 10 hPa = 1 m) e
`firmware/sketch_fisico_jsn_sr04t.ino` para a maquete física (sensor ultrassônico JSN-SR04T medindo
a distância até a água de verdade dentro de um tubo/balde, convertida em nível pela escala
`ESCALA_M_POR_CM = 0,5`). Os dois adapters compartilham o mesmo núcleo — só a leitura do sensor
muda, validando na prática o contrato de adapter descrito na justificativa.

Em ambos os cenários, cada leitura recebe timestamp obtido por sincronização NTP, para que
leituras acumuladas em buffer (durante uma queda de rede) sejam registradas com o instante real em
que ocorreram, e não com o instante em que finalmente chegaram ao servidor. Alertas locais (LED
verde/amarelo/vermelho, buzzer, display OLED) reproduzem a mesma classificação de faixa do backend,
de forma independente — o sistema opera em modo degradado: uma falha no display OLED ou uma leitura
de sensor fora da faixa válida não derruba a medição nem o envio dos dados; leituras inválidas
simplesmente não entram no histórico, evitando poluir a série temporal com ruído de sensor.

#### Backend

O backend roda inteiramente em `cloudflare-worker/`, dividido em 7 módulos ES, cada um com uma
responsabilidade única: `index.js` (roteador — só orquestra `fetch` e `scheduled`), `config.js`
(configuração e constantes), `http.js` (CORS, respostas JSON, limites de payload), `db.js` (todas as
queries ao D1), `alertas.js` (motor de alertas e estado no KV), `notificacoes.js` (integração
Telegram e Twilio) e `rotas.js` (handlers dos endpoints). Essa divisão segue uma regra de projeto
adotada desde o início (limite de ~300 linhas por arquivo, uma responsabilidade por arquivo) para
manter o código auditável.

Pontos de projeto relevantes:

- **Dedupe:** o D1 tem um índice único que evita duplicar a mesma leitura em reenvios de
  *store & forward*.
- **Duas dimensões de tempo:** cada registro guarda o instante da medição (`ts`, definido pelo
  firmware via NTP) separado do instante em que o Worker recebeu o dado (`recebido_em`) —
  necessário justamente por causa do *store & forward*, em que os dois instantes podem divergir.
- **Autenticação fail-closed:** o endpoint `/ingest` rejeita por padrão qualquer requisição sem a
  `DEVICE_KEY` correta no header `x-device-key` — a ausência ou erro na chave nunca é tratada como
  "permitir e seguir".
- **Motor de alertas em 3 camadas**, executado a cada ciclo do cron (1 minuto): (1) nível, com
  histerese inspirada na norma ISA-18.2 de gerenciamento de alarmes, para evitar disparos repetidos
  por oscilação em torno do limiar; (2) comunicação/instrumento mudo, quando um piezômetro para de
  enviar leituras; (3) taxa de variação, para sinalizar subidas anormalmente rápidas de nível. O
  estado de cada camada (última faixa notificada, histórico de reenvio) é persistido no Cloudflare
  Workers KV, já que um Worker não mantém estado em memória entre invocações.
- **Limite do KV respeitado por projeto:** o free tier de Workers KV permite 1.000 escritas/dia; o
  motor de alertas só grava no KV quando o estado muda de faixa, nunca de forma incondicional a
  cada ciclo de cron — decisão de arquitetura deliberada, documentada em `CLAUDE.md`.
- **Divisão de bucket no D1 sem perda de precisão:** a agregação temporal para os gráficos usa
  `CAST(ts / ?1 AS INTEGER)` — sem o `CAST`, o D1/SQLite faz a divisão em ponto flutuante, o que já
  foi identificado como bug real em revisão e corrigido; a regra é não regredir esse comportamento.

#### Dashboard

O dashboard (`index.html` + `assets/`) roda inteiramente no GitHub Pages, sem bundler: o HTML
concentra apenas a estrutura (~280 linhas), o CSS fica em `assets/styles.css` e a lógica é dividida
em 8 módulos JavaScript carregados em ordem de dependência (`config`, `util`, `fontes`, `estado`,
`graficos`, `paineis`, `exportar`, `app`). Funcionalidades principais: atualização em tempo real por
*polling* a cada 10 segundos; gráficos com média e pico por janela de tempo; mapa dos piezômetros;
distinção visual entre alarme (condição atual) e evento (transição registrada no histórico);
indicação explícita de "SEM SINAL" quando um instrumento para de enviar leituras (camada de
comunicação do motor de alertas); e exportação do histórico em CSV. Quando o backend não está
acessível, o dashboard ativa um modo de simulação sinalizado por um banner destacado no topo da
página, para que dados fictícios de demonstração nunca sejam confundidos com leituras reais.

#### Metodologia de trabalho

O desenvolvimento seguiu duas frentes paralelas e complementares: simulação no Wokwi (para
iteração rápida de firmware e testes de alerta sem depender de hardware físico) e montagem de uma
maquete física real (ESP32 + JSN-SR04T + tubo com água, ver `docs/PROTOTIPO_FISICO.md`), ambas
falando com o mesmo backend em produção. O código foi versionado em git ao longo de todo o projeto,
com a v1 preservada no histórico para rastreabilidade da decisão de migração, e o backend é
publicado por deploy contínuo a partir do repositório (GitHub Actions + integração Git da
Cloudflare), incluindo a aplicação automática das migrações de banco antes de cada publicação.

### 1.3.5 VIABILIDADE TÉCNICA

Todos os componentes de hardware usados no protótipo são de fácil acesso no mercado nacional
(ESP32, sensor ultrassônico JSN-SR04T, display OLED, LEDs, buzzer — lista completa e fornecedores em
`docs/PROTOTIPO_FISICO.md`), sem depender de importação ou de peças especiais.

A precisão do sensor utilizado na maquete física foi avaliada por um protocolo experimental
descrito em `docs/VALIDACAO_SENSOR.md`: 5 alturas de água conhecidas, medidas com régua, cada uma
com 10 leituras repetidas do sensor, calculando erro médio, desvio padrão e erro máximo por altura,
e declarando a incerteza final como aproximadamente 2× o maior desvio padrão observado (regra
prática de ~95% de cobertura).

`[PREENCHER: resultados reais do ensaio de validação — erro médio X cm, desvio padrão Y cm, erro
máximo em cm, e a incerteza declarada final em ±Z cm (2σ), na faixa de coluna d'água testada]`.

Quanto aos limites de operação em nuvem, o backend roda inteiramente dentro do free tier da
Cloudflare para o volume do protótipo: o limite mais apertado é o de Workers KV (1.000
escritas/dia), já endereçado ao gravar o estado do motor de alertas apenas nas transições de faixa;
o D1 comporta, na frequência de 1 leitura a cada 10 segundos por ponto, até aproximadamente 11
pontos de monitoramento simultâneos dentro da cota de 100 mil escritas/dia — reduzindo a frequência
para 1 leitura/minuto, essa mesma cota comporta cerca de 69 pontos. Um crescimento além disso tem
caminho definido: o plano Cloudflare Workers Paid, a partir de US$ 5/mês (~R$ 25–30/mês), o que é
um custo irrisório frente a qualquer fração da economia estimada na viabilidade econômica.

O protótipo assume limitações que devem ser explicitadas: o sensor utilizado é um *stand-in*
(BMP180 na simulação, sensor ultrassônico na maquete física), não um piezômetro de corda vibrante
certificado; e o sistema não implementa a redundância de energia (bateria/painel solar) exigida pela
Resolução ANM 95/2022 para barragens de DPA alto — a maquete depende de alimentação de rede/USB. O
caminho para uma instalação de produção real passa pelo contrato de adapter já implementado no
firmware (`piezometro_core.h`): trocar o sensor por um transdutor de pressão ou piezômetro de corda
vibrante certificado exigiria escrever um novo adapter, sem alterar o restante da arquitetura
(backend, dashboard, motor de alertas).

### 1.3.6 VIABILIDADE ECONÔMICA

O edital do desafio SAGA declara, como estimativa da própria Samarco, uma economia de **R$ 600
mil/ano** ao substituir a medição manual terceirizada por monitoramento automatizado. Esse é um
número emprestado do edital, não auditado por este trabalho: os alunos não tiveram acesso à memória
de cálculo original da empresa.

Para avaliar a plausibilidade da ordem de grandeza dessa economia, foi construída uma estimativa
própria e independente, com premissas explícitas dos alunos (livremente ajustáveis):

```
custo_anual_manual = nº_piezômetros × frequência_anual × custo_por_campanha
                    = 20 pontos × 104 campanhas/ano (≈2x/semana) × R$ 350/campanha
                    ≈ R$ 728.000/ano
```

em que 20 piezômetros é uma ordem de grandeza razoável para uma barragem de porte médio, a
frequência de ~2x/semana reflete a periodicidade comumente exigida em operação estabilizada, e R$
350/campanha (deslocamento + técnico terceirizado + relatório) é estimativa própria dos alunos, não
um número auditado.

```
custo_anual_sistema (20 pontos) = 20 × R$ 185 (hardware, custo único) + backend R$ 0/mês (free tier)
                                 ≈ R$ 3.700 no ano de implantação, ~R$ 0/ano nos anos seguintes
                                   (fora manutenção/substituição eventual de sensores)
```

```
economia_estimada = R$ 728.000 − R$ 3.700 ≈ R$ 724.000 no primeiro ano
```

O resultado (~R$ 724 mil/ano) é uma estimativa própria e independente, não uma reprodução do número
do edital — mas confirma que a ordem de grandeza de "centenas de milhares de reais por ano" é
plausível para essa comparação, o que sustenta o número declarado pela Samarco como coerente, sem
validá-lo tecnicamente. Em qualquer um dos dois cenários, o retorno sobre o investimento é
imediato: o custo do sistema é essencialmente um investimento único de hardware (~R$ 150–220 por
ponto) mais um custo recorrente residual, dentro do free tier de nuvem, muito abaixo de qualquer
fração da economia anual estimada.

### 1.3.7 RESULTADOS E CONCLUSÃO

O sistema foi demonstrado funcionando de ponta a ponta em dois cenários: simulação no Wokwi
(ESP32 + BMP180) e maquete física real (ESP32 + JSN-SR04T medindo água de verdade dentro de um
tubo). Em ambos os casos foram observados: medição contínua a cada 10 segundos; transmissão em
tempo real para o backend; persistência de histórico consultável no dashboard; classificação
correta em NORMAL/ATENÇÃO/CRÍTICO nos limiares configurados (12 m/15 m); alertas entregues por
Telegram (e, quando configurado, SMS via Twilio) nas transições de faixa, em até ~1 minuto (ciclo do
cron); e resiliência a queda de rede, com o buffer de *store & forward* retendo leituras localmente
e reenviando-as sem perda assim que a conectividade retorna — demonstração roteirizada em
`docs/PROTOTIPO_FISICO.md`.

`[PREENCHER: resultados quantitativos do ensaio de validação do sensor — inserir aqui a mesma
incerteza declarada (erro médio, desvio padrão, erro máximo, incerteza ±Z cm/2σ) já solicitada na
seção de Viabilidade Técnica, como evidência quantitativa do funcionamento do protótipo]`.

**Limitações honestas do protótipo:** o sensor utilizado é um *stand-in* de coluna d'água (mais
próximo de um INA do que de um piezômetro de corda vibrante), não há redundância de energia como
exige a Resolução ANM 95/2022 para barragens de DPA alto, e a validação de precisão realizada
qualifica o sensor ultrassônico como medidor de coluna d'água em bancada — não substitui uma
validação de piezômetro real, que exigiria instrumento de referência certificado, ensaio em câmara
de pressão controlada e comparação de campo contra um piezômetro Casagrande instalado. O sistema é,
declaradamente, um protótipo de conceito.

**Trabalhos futuros:** substituição do sensor por um piezômetro de corda vibrante real (via o
contrato de adapter já implementado); adição de redundância de energia (painel solar + bateria) para
atender ao requisito da ANM 95/2022; chave de autenticação por dispositivo (hoje uma única
`DEVICE_KEY` compartilhada); e conectividade via LoRaWAN para instalações de campo sem cobertura
WiFi.

---

## 1.4 ANEXOS

### 1.4.1 BMG CANVAS

Esqueleto dos 9 blocos do Business Model Canvas, com base no mercado e nos dados de
`docs/BASE_DE_CONHECIMENTO.md` (Parte 3), para a equipe transpor ao quadro visual:

| Bloco | Conteúdo sugerido |
|---|---|
| **Proposta de valor** | Monitoramento automatizado e alerta preventivo de nível d'água/poropressão a uma fração do custo da telemetria industrial (R$ 5–20 mil/ponto), para estruturas hoje lidas manualmente. |
| **Segmentos de clientes** | Em ordem de prioridade sugerida na base de conhecimento: (1) pequenas barragens de água e açudes (28.043 barragens cadastradas no SNISB, só 6.210 na PNSB); (2) aterros sanitários (~700 no Brasil, cada um com 5–15 piezômetros de chorume, monitoramento já exigido como condicionante de licença ambiental); (3) encostas urbanas (defesa civil/prefeituras, 2.095 municípios em áreas de risco); mercados adjacentes: obras civis (rebaixamento temporário de lençol freático), água subterrânea/agricultura, pilhas de estéril e taludes de cava. |
| **Canais** | Venda direta a operadores de barragens e municípios; parcerias com empresas de instrumentação geotécnica que hoje só atendem DPA alto; editais públicos (ex. desafios de inovação como o SAGA). |
| **Relacionamento com clientes** | Suporte à instalação e calibração; dashboard como ponto de contato contínuo; alertas automáticos como demonstração recorrente de valor. |
| **Fontes de receita** | Venda de hardware por ponto instalado (~R$ 150–220 de custo, com margem); possível assinatura para o backend em escala (quando exceder o free tier); serviço de instalação/calibração. |
| **Recursos-chave** | Firmware com contrato de adapter de sensor; backend Cloudflare (Worker + D1 + KV); conhecimento de instrumentação geotécnica e da regulação (ANM 95/2022, Lei 14.066/2020). |
| **Atividades-chave** | Desenvolvimento e manutenção do firmware/backend/dashboard; validação de sensores; suporte a instalação em campo. |
| **Parcerias-chave** | Fabricantes/fornecedores de sensores (transdutores de pressão, corda vibrante); integradores de instrumentação geotécnica; municípios e órgãos de defesa civil; operadores de aterros sanitários. |
| **Estrutura de custos** | Hardware por ponto (custo único); operação em nuvem (free tier até certa escala, depois plano pago a partir de US$ 5/mês); eventual manutenção/substituição de sensores em campo. |

### 1.4.2 SITUAÇÃO DE APRENDIZAGEM

`[PREENCHER conforme orientação do instrutor]`

Sugestões do que costuma compor esta seção:

- **Competências mobilizadas:** desenvolvimento de firmware embarcado (C++/Arduino), integração com
  APIs em nuvem (Cloudflare Workers/D1/KV), desenvolvimento web front-end (HTML/CSS/JS sem
  bundler), noções de instrumentação geotécnica e segurança de barragens, trabalho em equipe com
  versionamento de código (git).
- **Cronograma:** `[PREENCHER: marcos do projeto — pesquisa inicial, prototipagem no Wokwi, montagem
  da maquete física, desenvolvimento do backend/dashboard, validação do sensor, redação do TCC,
  ensaios para a banca]`.
- **Papel de cada aluno:** `[PREENCHER: detalhar por aluno, coerente com a tabela da seção 1.1 —
  ex. firmware, backend, dashboard, documentação/pesquisa]`.

---

## Lista consolidada de marcadores [PREENCHER]

1. Seção 1.1 — nomes dos alunos, curso e função de cada um na tabela da equipe.
2. Seção 1.1 — Unidade SENAI.
3. Seção 1.1 — Instrutor orientador.
4. Seção 1.3.5 (Viabilidade Técnica) — resultados reais do ensaio de validação do sensor (erro
   médio, desvio padrão, erro máximo, incerteza declarada ±Z cm/2σ).
5. Seção 1.3.7 (Resultados e Conclusão) — mesmos resultados quantitativos do ensaio de validação,
   repetidos como evidência de resultado.
6. Seção 1.4.2 — conteúdo da Situação de Aprendizagem conforme orientação do instrutor.
7. Seção 1.4.2 — cronograma do projeto.
8. Seção 1.4.2 — papel individual de cada aluno.
