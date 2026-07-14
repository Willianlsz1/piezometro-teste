# Projeto Profissional — Especificação de Engenharia da Versão de Produção

> Este documento não é um pitch nem uma lista de desejos: é a especificação de engenharia de como
> o protótipo do TCC vira um produto de campo. Referências que ele consolida sem repetir:
> `docs/projeto/ALIMENTACAO_ENERGIA.md` (energia), `docs/projeto/COMPARATIVO_MERCADO.md` (mercado e preços),
> `docs/projeto/VIABILIDADE_ECONOMICA.md` (custo/precificação/TAM-SAM-SOM), `docs/projeto/CADEIA_DE_CONFIANCA.md`
> (integridade do dado) e `docs/prototipo/PREPARACAO_BANCA.md` (conformidade regulatória e respostas prontas).
> `firmware/piezometro_core.h` e `firmware/piezometro_deep_sleep.h` são citados pelo contrato que
> já definem, não reexplicados linha a linha.

---

## §1 Princípio de projeto: o protótipo é a plataforma

A tese central deste documento é uma só: **não existe reescrita**. O protótipo já resolveu o
problema difícil — orquestrar leitura contínua, transporte confiável, histórico consultável,
motor de alertas em camadas e um dashboard utilizável, tudo documentado e rodando em produção
(`https://piezometro-worker.willianloopes123.workers.dev`). Profissionalizar o sistema é trocar as
**pontas** (o sensor que mede, a energia que alimenta, o rádio que transmite) mantendo o **núcleo**
intacto: Worker + D1 + KV, dashboard, motor de alertas de 3 camadas, cadeia de confiança do dado.
Isso é possível porque o núcleo já foi desenhado com os pontos de troca certos — o contrato de
adapter de sensor (`initSensor()`/`lerSensor()`, ver `firmware/piezometro_core.h`), o backend que
não sabe nem precisa saber qual sensor físico gerou o número, e um dashboard que só consome
`/ultimos` e `/dados`.

A tabela abaixo é o mapa de leitura de todo o resto do documento — cada linha vira uma seção:

| Camada | Protótipo (hoje) | Produção (versão profissional) | Muda o núcleo? |
|---|---|---|---|
| Sensor | Ultrassônico JSN-SR04T (stand-in de INA) / simulação BMP180 | Transdutor de pressão piezorresistivo 4-20 mA/0-5V (degrau intermediário) ou corda vibrante via conversor (padrão-ouro) | Não — novo adapter, mesmo contrato |
| Energia | USB de bancada, sempre ligado, sem backup | Deep sleep (5-15 min) + solar pequeno + bateria | Não — já implementado como opção de compilação |
| Comunicação | Wi-Fi sempre ativo | Wi-Fi onde houver rede; LoRaWAN em campo sem infraestrutura | Não no Worker — só o adapter de rede no firmware |
| Segurança/identidade | `DEVICE_KEY` única compartilhada | `DEVICE_KEYS` por dispositivo, TLS com CA pinado, HMAC por mensagem (evolução) | Não — extensão do mesmo mecanismo |
| Dados | Retenção indefinida, sem consolidação | Retenção 180 dias + agregado diário permanente, backup periódico | Não — módulo novo (`retencao.js`) plugado no cron existente |
| Operação | Free tier, sem healthcheck externo, sem comissionamento formal | Plano pago desde o dia 1, healthcheck externo, comissionamento por ponto, manutenção programada | Não — decisão operacional, zero código novo no núcleo |
| Conformidade | Parcial na ANM 95/2022 (sensor stand-in, sem redundância de energia) | Sensor certificado + energia redundante + automação 24/7 já atendidos | Não |

O fio condutor: cada seção que segue começa por "o que já temos" antes de dizer "o que muda".

---

## §2 Sensor

**O que já temos:** o contrato de adapter em `firmware/piezometro_core.h` — o `.ino` implementa só
`initSensor()`, `lerSensor()` (devolvendo o `struct Leitura`: nível obrigatório, pressão/temperatura
opcionais, campo `valida`) e as duas funções de exibição extra. O core cuida de WiFi, NTP, buffer,
envio, alertas locais e display sem saber qual sensor está por trás. Essa fronteira já foi
exercitada duas vezes de verdade: `sketch.ino` (BMP180, simulação Wokwi) e
`sketch_fisico_jsn_sr04t.ino` (JSN-SR04T, maquete física) — dois adapters, um núcleo, zero
duplicação de lógica de rede/alerta.

**O que muda — dois degraus, não um salto único:**

### 2.1 Degrau intermediário — transdutor de pressão piezorresistivo (4-20 mA ou 0-5V)

Sensor submersível que mede pressão hidrostática diretamente (sem depender de linha de visada
livre e seca, ao contrário do ultrassônico) e converte para nível de coluna d'água. Já dimensionado
em `docs/projeto/VIABILIDADE_ECONOMICA.md` (seção 1.1, cenário "campo real"): **R$ 300–600** o sensor,
dentro de um CAPEX de ponto de R$ 586–1.179. É o caminho pragmático: sensor comercial disponível,
saída elétrica simples (4-20 mA ou 0-5V lida por um conversor ADC/divisor no ESP32), sem exigir
eletrônica de excitação dedicada.

Novo adapter: `firmware/sketch_pro_pressao.ino` (nome de arquivo pelo MESMO padrão dos adapters
existentes — `sketch_fisico_*`, `sketch_pro_*`). Implementa `initSensor()` (configura o pino
ADC/leitura de corrente) e `lerSensor()` (converte a leitura elétrica em metros de coluna d'água
usando a curva de calibração do instrumento — ver 2.3), preenchendo `Leitura.valida = false` sempre
que a leitura estiver fora da faixa elétrica esperada (ex.: < 3,8 mA ou > 20,5 mA num laço 4-20 mA
indica sensor desconectado/em falha) — mesma disciplina de "não disfarçar falha de dado bom" já
documentada em `docs/projeto/CADEIA_DE_CONFIANCA.md` §2 para o JSN-SR04T.

### 2.2 Padrão-ouro — piezômetro de corda vibrante

O sensor de fato usado pela Camada 1 do mercado (Worldsensing, Geokon, Sisgeo, Ackcio,
Encardio-rite — ver `docs/projeto/COMPARATIVO_MERCADO.md` seção 2) e o único que mede poropressão de uma
camada específica isolada por bulbo com bentonita (diferença conceitual, não só de precisão, frente
ao INA — ver `docs/prototipo/PREPARACAO_BANCA.md` item b). Não é um ADC simples: a leitura exige excitar a corda
com um pulso elétrico e medir a frequência de ressonância resultante, circuito que o ESP32 não tem
nativamente.

**Caminho pragmático (não reinventar o circuito de excitação):** usar um módulo conversor
VW→Modbus/4-20 mA comercial (os próprios dataloggers da Camada 1 — Geokon GeoNet, RST DT2011B —
são, na prática, isso: um front-end de corda vibrante que expõe a leitura já convertida em um
protocolo digital padrão). O ESP32 passa a ler Modbus RTU (via RS-485) ou 4-20 mA do conversor, não
a corda vibrante diretamente. O adapter (`sketch_pro_cordavibrante.ino`) muda só o que está dentro
de `lerSensor()` — ler o registrador Modbus ou o laço de corrente do conversor — mantendo
`initSensor()`/`lerSensor()` como fronteira. Consequência prática: o mesmo firmware core, o mesmo
Worker, o mesmo dashboard, atendem tanto o degrau intermediário quanto o padrão-ouro — só o hardware
entre o poço e o ESP32 muda.

### 2.3 Calibração

Dois níveis, que não se substituem:

- **Certificado rastreável RBC/Inmetro por instrumento** — a "verdade terrestre" oficial que valida
  a curva de conversão sinal→nível de cada sensor individual antes da instalação. É o que
  `docs/projeto/CADEIA_DE_CONFIANCA.md` §4 já identifica como responsabilidade da cadeia institucional
  (laboratório acreditado), não do software.
- **O protocolo de bancada do próprio projeto** (`docs/prototipo/VALIDACAO_SENSOR.md`) — 5 alturas × 10
  leituras, erro médio/desvio padrão/erro máximo, incerteza ±2σ — não substitui o certificado, mas
  serve como **verificação de recepção**: ao instalar um sensor já certificado, repetir esse
  protocolo em campo confirma que o sensor chegou íntegro e que a instalação (cabo, conector,
  adapter) não introduziu erro sistemático antes de confiar na leitura em produção.

---

## §3 Energia

**O que já temos, e é a maior parte do trabalho:** deep sleep já implementado e testável
(`firmware/piezometro_deep_sleep.h`) — buffer próprio em RTC memory (`RTC_DATA_ATTR`, até 96
leituras, ~2,3 KB), reconexão de WiFi e re-sincronização de NTP por ciclo, reduzindo o consumo em
**~30×** (de ~30 Wh/dia sempre-ligado para <1 Wh/dia, conta fechada em
`docs/projeto/ALIMENTACAO_ENERGIA.md` seção 4, Opção C). O dimensionamento de solar/bateria também já está
feito (seção 4, Opção B): painel 20 W + bateria 12V 18Ah AGM, ~3 dias de autonomia sem sol mesmo no
modo sempre-ligado — com deep sleep ativo, a mesma bateria (ou uma 18650 muito menor) dura semanas.

**O que muda para produção — só a decisão de configuração, não código novo:**

- **Modo padrão de campo: deep sleep de 5-15 min**, não os 5 min fixos usados na conta de
  referência — o intervalo é uma constante (`INTERVALO_DEEP_SLEEP_SEG`) ajustável por instalação
  sem tocar em lógica, trade-off direto entre granularidade temporal e autonomia de bateria.
- **Solar pequeno dimensionado ao consumo real do deep sleep** (painel 2-5 W, não os 20 W do cenário
  sempre-ligado) — superdimensionar a fonte solar para compensar um firmware sempre ligado é
  exatamente o erro que o mercado (seção 2 de `ALIMENTACAO_ENERGIA.md`) não comete e este projeto
  não deveria repetir em produção.
- **Watchdog habilitado** (`esp_task_wdt`) — reinicia o dispositivo se o firmware travar num ciclo
  (ex.: sensor Modbus que nunca responde e trava a leitura bloqueante), evitando um ponto de campo
  "morto" até intervenção manual.
- **Brownout detector habilitado** — protege contra reset corrompido quando a tensão de alimentação
  cai abaixo do mínimo do ESP32 (situação real em bateria descarregando ou solar insuficiente em
  dias muito nublados), evitando comportamento indefinido em vez de um reset limpo.
- Isso atende, "em espírito", a exigência de **redundância de energia** da ANM 95/2022 para DPA
  alto (energia autônoma contínua via solar+bateria) — como já registrado em
  `docs/projeto/ALIMENTACAO_ENERGIA.md` seção 5, uma validação formal para DPA alto exigiria dimensionamento
  por engenheiro responsável, não apenas a conta do TCC.

---

## §4 Comunicação

**O que já temos:** store & forward em duas variantes — buffer de até 120 leituras em RAM comum
(modo sempre-ligado, `piezometro_core.h`) e buffer de até 96 leituras em RTC memory (modo deep
sleep, `piezometro_deep_sleep.h`) — ambos toleram queda de **rede** (não de energia, distinção que
`docs/projeto/ALIMENTACAO_ENERGIA.md` seção 1 marca com cuidado) sem perder leitura, reenviando quando a
conectividade volta. O Worker recebe o mesmo formato de payload (`{"leituras":[...]}`) não importa
qual variante de firmware o enviou.

**O que muda:**

- **Wi-Fi onde houver rede local** (instalações urbanas/industriais com infraestrutura já
  disponível) — modo atual, sem alteração.
- **LoRaWAN para campo sem Wi-Fi** — a evolução já apontada em
  `docs/projeto/ALIMENTACAO_ENERGIA.md` (menção, seção 4) e `docs/projeto/VIABILIDADE_ECONOMICA.md` (seção 1.3):
  nó classe A de baixíssimo consumo, gateway compartilhado por barragem (**~R$ 800–1.500**, custo
  único), backhaul do gateway até a internet via 4G. O ponto de engenharia central: **o Worker não
  muda em nada** — o gateway LoRaWAN é quem fala HTTP com `/ingest`, agregando os nós que fala
  LoRaWAN por trás. Do ponto de vista do backend, um gateway LoRaWAN enviando leituras de 10
  piezômetros é indistinguível de 10 ESP32 com Wi-Fi enviando direto — o contrato HTTP + `x-device-key`
  é o mesmo.
- **O que muda no firmware** é só o adapter de rede: em vez de `conectarWiFi()`/`WiFiClientSecure`,
  o nó LoRaWAN fala com uma biblioteca LoRaWAN (ex. `RadioLib`/`LMIC`) e entrega o payload ao
  gateway, que faz o `POST /ingest` por ele. O store & forward local do nó (buffer RTC, mesmo
  princípio de `piezometro_deep_sleep.h`) continua necessário — o gateway ou o link celular dele
  também podem cair.
- **Custo recorrente por nó**: R$ 0-15/mês conforme o operador da rede LoRaWAN (referência já usada
  em `VIABILIDADE_ECONOMICA.md` seção 1.3), somado ao custo do backhaul 4G do gateway (plano M2M,
  compartilhado entre todos os nós daquele gateway, não por ponto).

---

## §5 Segurança e identidade

**O que já temos e está sendo estendido nesta mesma rodada de trabalho:** `cloudflare-worker/src/config.js`
já lê tanto `DEVICE_KEY` (chave única compartilhada, modo atual) quanto `DEVICE_KEYS` (mapa
JSON de chave por dispositivo, `wrangler secret put DEVICE_KEYS`) — a autenticação em
`rotas.js` (`handleIngest`) já é fail-closed: sem nenhuma chave configurada, `/ingest` responde
`503`; chave incorreta responde `401`. Isso já é, por si, uma característica de produto pensada para
produção: uma frota de N dispositivos de campo não deveria compartilhar um segredo único — se um
dispositivo for fisicamente comprometido (roubo, violação do gabinete), revogar só a chave dele
(remover a entrada do JSON `DEVICE_KEYS`) não afeta os demais pontos.

**O que muda para a versão profissional completa:**

- **TLS com certificado CA pinado no firmware de produção** — hoje `WiFiClientSecure::setInsecure()`
  é usado em ambas as variantes de firmware (`piezometro_core.h` e `piezometro_deep_sleep.h`),
  aceitável para protótipo/simulação (documentado explicitamente no código com o comentário "em
  produção use certificado CA"), mas inaceitável em campo real: sem validação de certificado, um
  atacante na rede local poderia se passar pelo Worker e capturar ou forjar leituras. Trocar por
  `WiFiClientSecure::setCACert()` com o certificado raiz da Cloudflare fixado no firmware.
- **Assinatura HMAC por mensagem (evolução, não requisito do piloto)** — `DEVICE_KEY`/`DEVICE_KEYS`
  provam "quem enviou" (posse do segredo), não "esta leitura específica não foi alterada em
  trânsito" com garantia criptográfica (gap já registrado em `docs/projeto/CADEIA_DE_CONFIANCA.md` §5).
  Um HMAC-SHA256 do corpo da requisição, calculado com a `DEVICE_KEY` do dispositivo e verificado
  no Worker, fecha essa lacuna sem trocar o modelo de chave — é uma camada adicional sobre a mesma
  identidade, não uma reescrita da autenticação.
- **Revogação individual** — já possível hoje via `DEVICE_KEYS` (remover a entrada do dispositivo do
  JSON e fazer `wrangler secret put DEVICE_KEYS` de novo); a versão profissional formaliza isso como
  procedimento operacional (parte do runbook de comissionamento, §7) em vez de edição manual ad hoc.

---

## §6 Dados

**O que já temos:** exportação de auditoria (CSV com metadados + planilha Excel, já implementada no
dashboard — `assets/js/exportar.js`), append-only de fato no backend (nenhuma rota
`PUT`/`DELETE` existe no roteador — `cloudflare-worker/src/index.js`), índice único
`(piezometro, ts)` com `INSERT OR IGNORE` prevenindo duplicação por reenvio do store & forward
(`cloudflare-worker/src/db.js`). E, assim como `DEVICE_KEYS`, a retenção automática já está sendo
implementada nesta mesma rodada: `config.js` já expõe `RETENCAO_DIAS` (default 180 dias, "folga de
6× frente a..." conforme o comentário no código) para o módulo `src/retencao.js`, que consolida
leituras brutas mais antigas que o limite em um agregado diário permanente, plugado no mesmo cron
de 1 minuto que já roda o motor de alertas.

**O que isso resolve em produção:**

- **Retenção controlada** — sem consolidação, uma frota de dezenas de pontos lendo a cada 10s (ou
  mesmo a cada 5-15 min com deep sleep) acumula linhas indefinidamente no D1; 180 dias de dado bruto
  cobre qualquer investigação de curto/médio prazo (auditoria de um evento recente, comparação
  sazonal), e o agregado diário preserva a série histórica de longo prazo sem o custo de
  armazenamento do dado bruto completo.
- **Exportação de auditoria** já cobre o caso "preciso do dado bruto de um período específico para
  uma investigação formal" — CSV com metadados suficiente para rastreabilidade.
- **Backup**: `wrangler d1 export` (exportação periódica do banco D1 inteiro) como rotina agendada
  (ex.: mensal, via cron externo ou GitHub Actions) gravando o dump num bucket externo (R2 ou S3) —
  caminho simples para uma réplica fora do D1 gerenciado pela Cloudflare, cobrindo o gap de
  "redundância de armazenamento" já identificado em `docs/projeto/CADEIA_DE_CONFIANCA.md` §5.

---

## §7 Operação profissional

- **Plano Cloudflare pago desde o dia 1 em produção** — Workers Paid, US$ 5/mês (~R$ 25-30/mês,
  compartilhado entre todos os pontos, não por ponto — ver `docs/projeto/VIABILIDADE_ECONOMICA.md` seção
  1.3). O argumento já está fechado em `docs/prototipo/PREPARACAO_BANCA.md` item d: o free tier é aceitável para
  um protótipo de TCC, mas uma operação real com dados de segurança de barragem em jogo contrata o
  plano pago desde o início — trade-off consciente, não economia de última hora.
- **Monitoramento do monitor** — o motor de alertas já cobre "instrumento mudo" (P2 "sem dados",
  `cloudflare-worker/src/alertas.js`, tratando silêncio de um piezômetro específico como condição
  monitorada). O que falta é o inverso: quem avisa se o **Worker inteiro** ficar fora do ar (não um
  ponto specific, o serviço todo)? Solução: healthcheck externo (ex. UptimeRobot, Checkly, ou um
  segundo Worker em outra conta consultando `/health` a cada poucos minutos) — camada independente
  do próprio sistema que está sendo monitorado, para não ter um único ponto de falha na própria
  vigilância.
- **Procedimento de comissionamento por ponto** — instalar (fixação física do sensor + adapter
  correto) → calibrar (curva sinal→nível do instrumento, certificado RBC quando aplicável, §2.3) →
  validar por 2 semanas em paralelo contra leitura manual no mesmo ponto (mesma disciplina que o
  protocolo de bancada de `docs/prototipo/VALIDACAO_SENSOR.md`, mas em campo e por período mais longo, para
  capturar efeitos que a bancada não reproduz — temperatura, umidade, vibração) → aceitar
  (documentar o erro medido, liberar o ponto para operação sem acompanhamento manual paralelo).
- **Manutenção programada** — inspeção mensal por ponto (mesmo em operação autônoma, nenhuma norma
  aceita instrumento que ninguém visita — princípio já registrado em `docs/prototipo/PREPARACAO_BANCA.md` item c);
  troca de bateria e/ou sensor por vida útil estimada (bateria: anos, conforme a química e o
  dimensionamento de `docs/projeto/ALIMENTACAO_ENERGIA.md`; sensor: conforme especificação do fabricante,
  tipicamente 5-10 anos para corda vibrante, menor para transdutor piezorresistivo em ambiente
  agressivo).

---

## §8 Conformidade ANM 95/2022 — antes e depois

Retomando a tabela de `docs/prototipo/PREPARACAO_BANCA.md` item c, atualizada para o que a versão PROFISSIONAL
passa a atender:

| Requisito regulatório | Protótipo (hoje) | Versão profissional |
|---|---|---|
| Monitoramento automatizado em tempo real e período integral (DPA alto) | Parcial — automatizado e 24/7, mas sensor stand-in | **Sim** — sensor certificado (§2) + automação 24/7 já existente, sem gap |
| Redundância de energia (DPA alto) | Não — sem backup | **Sim** — deep sleep + solar/bateria dimensionados (§3), redundância contínua |
| Registro histórico das leituras | Sim | Sim, mantido — agora com retenção controlada e consolidação (§6) |
| Alerta automático ao ultrapassar níveis de controle | Sim | Sim, mantido — motor de 3 camadas inalterado |
| Limiares por projeto geotécnico específico | Sim — parametrizável em 3 pontos espelhados | Sim, mantido |
| Inspeção regular / aumento de frequência quando sai do padrão | Parcial — alerta imediato, sem substituir inspeção física | Parcial, por design — inspeção mensal formalizada (§7), o sistema continua complementar, nunca substituto |
| Mapa de inundação / PAEBM (Lei 14.066/2020) | Não — fora do escopo | **Continua fora de escopo** — não é responsabilidade de um sistema de instrumentação |
| Cadastro/enquadramento na PNSB (Lei 12.334/2010) | Não aplicável | **Continua não aplicável** — depende da barragem onde o sistema é instalado, não do produto |

A honestidade da linha de inspeção física é deliberada: mesmo a versão profissional não substitui o
engenheiro responsável nem a visita humana periódica — o sistema informa com mais frequência e mais
confiabilidade, não decide nem fiscaliza (mesmo princípio de `docs/projeto/CADEIA_DE_CONFIANCA.md` §4).

---

## §9 Roadmap em 3 fases

Custos por ponto abaixo usam a mesma base de `docs/projeto/VIABILIDADE_ECONOMICA.md` (CAPEX + implantação +
OPEX ano 1), ajustada a cada fase pelo sensor/comunicação daquela fase. Preço de venda de referência
(R$ 2.500 + R$ 50/mês de assinatura) é o mesmo da seção 2.4 daquele documento — todo custo por ponto
abaixo fica abaixo desse preço, condição obrigatória para o modelo se sustentar.

### Fase 1 — Piloto interno (validação técnica)

- **5 pontos**, transdutor de pressão piezorresistivo (§2.1), Wi-Fi (rede já disponível no local do
  piloto), sempre-ligado ou deep sleep conforme disponibilidade de energia de rede.
- **Custo por ponto instalado: ~R$ 1.400** (CAPEX R$ 586-1.179 + implantação R$ 240-800, faixa
  baixa-média de `VIABILIDADE_ECONOMICA.md` seção 1.4, cenário campo real).
- **Critério de saída:** 90 dias consecutivos sem perda de dados (nenhuma lacuna não explicada por
  falha de rede/energia registrada) e erro do sensor frente à leitura manual em paralelo dentro da
  incerteza declarada do instrumento (§2.3) — sem esses dois critérios, não avança para Fase 2.

### Fase 2 — Piloto de cliente (validação comercial)

- **20 pontos**, ainda transdutor de pressão (não corda vibrante — a Fase 2 valida operação em
  campo real, não o sensor premium), LoRaWAN + solar pequeno (§3, §4) — primeira instalação sem
  depender de infraestrutura elétrica/rede do cliente.
- **Custo por ponto: ~R$ 2.000** (CAPEX de campo real + gateway LoRaWAN diluído entre os 20 pontos:
  R$ 800-1.500 ÷ 20 ≈ R$ 40-75/ponto, somado ao CAPEX+implantação já calculado).
- **Critério de saída:** cliente pagante disposto a assinar contrato de assinatura recorrente
  (R$ 30-80/ponto/mês, faixa de `VIABILIDADE_ECONOMICA.md` seção 2.4) após o piloto — validação de
  que o modelo comercial, não só o técnico, funciona.

### Fase 3 — Produto (escala)

- **Provisioning com `DEVICE_KEYS` por device** (§5) desde a fabricação — cada ponto já sai de
  fábrica com identidade própria, sem etapa manual de configuração de segredo por unidade.
- Sensor padrão do produto: **transdutor de pressão piezorresistivo** (mesmo da Fase 1/2) — mantém
  o custo por ponto abaixo do preço de venda. **Corda vibrante via conversor (§2.2) como opção
  premium, com preço próprio** (não incluída no custo-base do produto) — para o cliente que exige o
  sensor padrão-ouro da engenharia geotécnica (ex. barragem de DPA alto), mesmo firmware/Worker,
  hardware de ponta mais caro cobrado à parte.
- **Custo por ponto (configuração padrão, sensor de pressão): ~R$ 1.800-2.200** — dentro do preço de
  venda de R$ 2.500 + R$ 50/mês (`VIABILIDADE_ECONOMICA.md` seção 2.4), preservando margem.
  **Importante:** um custo de R$ 3.500 vendido a R$ 2.500 seria prejuízo por unidade — por isso a
  configuração padrão de produto usa o sensor intermediário, e a corda vibrante entra só como
  opcional com seu próprio preço, nunca subsidiada pelo preço-base.

---

## §10 O que se mantém — nossas vantagens na versão profissional

Nada do que profissionaliza o sistema apaga o que já diferencia o protótipo:

- **Stack aberta e documentada** — nenhuma das oito soluções pesquisadas em
  `docs/projeto/COMPARATIVO_MERCADO.md` publica arquitetura ou preço; este projeto publica os dois, do
  Worker de 7 módulos ao dashboard sem bundler.
- **Custo por ponto uma ordem de grandeza menor** — mesmo na Fase 3 (produto maduro, ~R$ 1.800-2.200
  de custo), continua muito abaixo da faixa de R$ 5.000-20.000/ponto da telemetria industrial
  (`COMPARATIVO_MERCADO.md`, `VIABILIDADE_ECONOMICA.md` seção 2.2) — e nenhum concorrente da
  Camada 1 tem incentivo comercial para descer a esse preço (estrutura de custo deles não permite).
- **Nicho open-source vazio** — a busca em `COMPARATIVO_MERCADO.md` seção 4 encontrou essencialmente
  zero projetos abertos específicos para piezômetro/poropressão de barragem com o conjunto completo
  (alertas em camadas, store & forward, backend documentado); esse espaço continua livre.
- **Contrato de adapter de sensor** — é o que torna todo este documento possível: cada seção acima
  (§2 a §4) é uma troca de peça, não uma reescrita, porque a fronteira `initSensor()`/`lerSensor()`
  foi desenhada desde o início pensando em produção, não só na maquete de demonstração.
- **Cadeia de confiança e alertas de 3 camadas prontos de fábrica** — em qualquer plataforma IoT
  genérica (ThingSpeak/Ubidots), isso teria que ser construído do zero por cima da assinatura
  mensal; aqui já vem embutido, com o conhecimento de domínio (terminologia correta, limiares
  parametrizáveis por projeto geotécnico) que é a defesa real contra a entrada de hardware genérico
  sem esse conhecimento (`VIABILIDADE_ECONOMICA.md` seção 3.4).

A versão profissional não é um projeto novo — é este projeto, com as pontas certas trocadas.
