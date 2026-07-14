# Alimentação e Energia — Da Bancada ao Campo

> Material de apoio para a pergunta 4 do `docs/prototipo/PREPARACAO_BANCA.md` ("E se faltar energia no ESP32?")
> e para a seção de limitações do TCC. Todo número marcado como **PREMISSA** é uma escolha de
> trabalho dos alunos — troque o valor e refaça a conta indicada logo abaixo dele. Referências
> cruzadas: `docs/projeto/COMPARATIVO_MERCADO.md` (soluções de energia dos concorrentes),
> `docs/prototipo/PREPARACAO_BANCA.md` (item c, tabela de conformidade ANM 95/2022), `docs/projeto/VIABILIDADE_ECONOMICA.md`
> (cenário de campo real), `firmware/piezometro_core.h` (intervalos de leitura/envio).

---

## 1. Como é hoje

O protótipo (maquete e Wokwi) é alimentado por **USB 5V** — da bancada de testes ou de uma
tomada de rede comum, via cabo micro-USB do próprio ESP32 DevKit. É a alimentação correta para
o estágio atual do projeto: simples, sem custo adicional, suficiente para demonstrar a
arquitetura de ponta a ponta.

**O que isso significa na prática: não há backup nenhum.** Se a energia falhar no ponto onde o
ESP32 está instalado, o dispositivo desliga — sem energia, não há leitura, não há LED, não há
OLED, não há envio. Diferente de uma queda de **rede** (Wi-Fi instável ou fora do ar), que o
firmware já tolera via store & forward (`piezometro_core.h`, buffer de até 120 leituras — ver
`coreLoop()`), uma queda de **energia** apaga o dispositivo inteiro, e não há buffer que sobreviva
a isso.

**Importante não confundir os dois problemas:**

| Falha | O sistema aguenta? | Por quê |
|---|---|---|
| Falta de **rede** (Wi-Fi cai, roteador reinicia) | Sim, até ~20 min | Store & forward retém as leituras no buffer local e reenvia quando a rede volta |
| Falta de **energia** (falta luz, cabo desconecta) | Não | O ESP32 desliga; não há bateria de backup nesta versão do protótipo |

A boa notícia: o sistema **detecta** a ausência de dados. Como o Worker recebe leituras a cada
10 s por ponto, a ausência prolongada de novos registros de um `piezometro` específico é, em si,
um sinal de alerta operacional — o desenho do motor de alertas (P2 "sem dados", ver
`cloudflare-worker/src/alertas`) trata "silêncio do ponto" como uma condição a ser monitorada, não
como "tudo normal". Ou seja: falta de energia derruba o dispositivo, mas não passa despercebida
para quem observa o dashboard — o ponto simplesmente para de reportar, e isso é visível.

Essa lacuna é reconhecida explicitamente na tabela de conformidade regulatória do
`DEFESA_BANCA.md` (item c): a Resolução ANM 95/2022 exige **redundância de energia** para
barragens de Dano Potencial Associado (DPA) alto, e o protótipo, como está hoje, não atende a
esse requisito. Este documento existe para mostrar que a lacuna foi mapeada, dimensionada e tem
caminho de solução — não para escondê-la.

---

## 2. O que o mercado usa

O `docs/projeto/COMPARATIVO_MERCADO.md` já documenta as soluções comerciais de telemetria (Camada 1) e
duas delas deixam clara a arquitetura de energia padrão do setor:

- **Nós wireless de corda vibrante** (ex.: Sisgeo WR-Log, ref. [3] do comparativo) — bateria
  interna de lítio (células tipo D, LTC) com autonomia declarada de **até 10 anos**. Isso só é
  possível porque esses nós (a) medem a cada 5–30 min (não a cada segundo), (b) transmitem por
  rádio proprietário/LoRa de baixíssimo consumo até um gateway, e (c) não têm display nem LEDs
  ligados o tempo todo — o consumo entre leituras é próximo de zero.
- **Dataloggers/estações maiores** (ex.: Canary Systems MLSAA, ref. [7] do comparativo) — bateria
  chumbo-ácido/AGM **12 V / 50 Ah** + **painel solar de 40 W**, o padrão para equipamentos que
  agregam múltiplos sensores e precisam de mais energia disponível (aquisição, rádio de maior
  alcance) do que uma célula de lítio sozinha entrega.

**A lição para este projeto:** nenhuma solução de campo pesquisada usa Wi-Fi sempre ligado como
o protótipo usa hoje. O padrão do mercado é **dormir quase o tempo todo e acordar só para medir e
transmitir** — exatamente o oposto da arquitetura atual (ESP32 com Wi-Fi ativo 24 h/dia, OLED e
LEDs sempre acesos). Isso não é um erro do protótipo — para uma maquete de demonstração em bancada,
sempre-ligado é a escolha certa (permite observar o sistema funcionando em tempo real durante a
apresentação) — mas é a primeira coisa a mudar numa instalação de campo real.

---

## 3. Quanto o nosso consome (a conta que a banca vai pedir)

Premissas de consumo por componente, na alimentação atual (Wi-Fi sempre ativo):

| Componente | Consumo (PREMISSA, faixa) | Fonte da premissa |
|---|---|---|
| ESP32 com Wi-Fi ativo | 120–260 mA @ 3,3 V | Faixa típica de datasheet/documentação de terceiros para o SoC ESP32 com rádio transmitindo/recebendo; usar **~160 mA** como valor médio de referência |
| Display OLED SSD1306 | 10–20 mA | Consumo típico de painel OLED pequeno (a maior parte dos pixels apagados no nosso layout) |
| LEDs (verde/amarelo/vermelho, um por vez + buzzer eventual) | 10–20 mA | Estimativa de bancada para LEDs comuns de 5 mm com resistor limitador |

**Conta do consumo total, sempre ligado:**

```
consumo_total = ESP32 + OLED + LEDs
mínimo = 120 + 10 + 10 = 140 mA
médio  = 160 + 15 + 15 = 190 mA  → usar 0,19 A como referência de trabalho
máximo = 260 + 20 + 20 = 300 mA
```

Convertendo para energia diária (`A × V × 24h`), na alimentação de 5 V do USB:

```
energia_dia = corrente(A) × 5V × 24h

mínimo = 0,19 A × 5 V × 24 h ≈ 22,8 Wh/dia
máximo = 0,30 A × 5 V × 24 h ≈ 36,0 Wh/dia
```

**Usar ~30 Wh/dia como referência de consumo diário** para os dimensionamentos das seções
seguintes (valor de meio da faixa, ligeiramente arredondado para cima por segurança).

---

## 4. As três opções para o nosso sistema, com dimensionamento

### Opção A — Rede + backup simples (powerbank/no-break)

Adequada para **maquete e demonstração** — mantém o firmware exatamente como está, só adiciona um
powerbank entre a tomada e o cabo USB do ESP32.

```
powerbank 20.000 mAh @ 3,7V (tensão nominal de célula de lítio)
energia_bruta = 20 Ah × 3,7 V = 74 Wh
energia_útil  = 74 Wh × 0,85 (eficiência de conversão boost/perdas) ≈ 62,9 Wh

autonomia = energia_útil ÷ consumo_diário
          = 62,9 Wh ÷ 30 Wh/dia ≈ 2,1 dias ≈ 2 dias de autonomia
```

**Custo estimado: R$ 80–150** (powerbank genérico de 20.000 mAh, mercado nacional — PREMISSA).

### Opção B — Solar + bateria, sem mudar o firmware (sempre ligado)

Para uma **instalação piloto** que precise operar sem depender da rede elétrica local, mas sem
tocar em uma linha de código do firmware.

```
consumo_diário = 30 Wh/dia (seção 3)

bateria 12V 7Ah AGM:
  energia_nominal = 12 V × 7 Ah = 84 Wh
  energia_útil (50% profundidade de descarga, prática recomendada p/ AGM) = 42 Wh
  autonomia_sem_sol = 42 Wh ÷ 30 Wh/dia ≈ 1,4 dia  → insuficiente para dias nublados seguidos

bateria 12V 18Ah AGM (RECOMENDADA):
  energia_nominal = 12 V × 18 Ah = 216 Wh
  energia_útil (50% DoD) = 108 Wh
  autonomia_sem_sol = 108 Wh ÷ 30 Wh/dia = 3,6 dias ≈ 3 dias nublados seguidos
```

Dimensionamento do painel solar — Brasil tem em média **4–5 horas de sol pleno por dia (HSP)**:

```
painel 20 W:
  geração_dia = 20 W × 4h a 20 W × 5h = 80 a 100 Wh/dia

folga sobre o consumo (30 Wh/dia):
  80 ÷ 30 ≈ 2,7×   |   100 ÷ 30 ≈ 3,3×
```

O painel de 20 W gera de 80 a 100 Wh/dia — **mais que o dobro** do consumo diário (30 Wh/dia),
folga suficiente para recarregar a bateria mesmo em dias parcialmente nublados e ainda compensar
perdas do controlador de carga.

Componentes adicionais necessários: **controlador de carga PWM** (protege a bateria de
sobrecarga) e **conversor step-down 12V→5V** (para alimentar o ESP32 na tensão que ele espera).

**Custo estimado do kit (todas as faixas são PREMISSA):**

```
painel 20W:            R$ 150–250
bateria 12V 18Ah AGM:   R$ 180–300
controlador PWM:        R$ 40–80
conversor step-down:    R$ 15–30
─────────────────────────────────
total: R$ 385–660
```

### Opção C — Deep sleep (duty cycling) — a mudança de MAIOR impacto

Em vez de manter o Wi-Fi sempre ativo, o ESP32 **acorda a cada 5 minutos**, faz o ciclo completo
(medir + conectar Wi-Fi + enviar) em cerca de 15 segundos, e volta a dormir em modo de baixíssimo
consumo (`esp_deep_sleep`, ~10 µA).

**Conta do consumo com deep sleep:**

```
consumo por ciclo ativo:
  15 s × 0,16 A = 0,004167 h × 160 mA = 0,67 mAh/ciclo

ciclos por dia (1 a cada 5 min):
  24h × 60min ÷ 5min = 288 ciclos/dia

consumo ativo diário:
  288 ciclos × 0,67 mAh = 192,1 mAh/dia (@ 3,3V)

consumo do sono (10 µA pelo tempo dormindo, ~22,8h/dia):
  10 µA × 22,8 h = 0,228 mAh/dia → desprezível frente ao consumo ativo

consumo total ≈ 192 mAh/dia @ 3,3V ≈ 0,63 Wh/dia (192 mAh × 3,3V)
com margem de overhead (boot Wi-Fi, regulador) ≈ 0,95 Wh/dia (PREMISSA de ~1,5× de folga)

redução frente ao modo atual (~30 Wh/dia):
  30 ÷ 0,95 ≈ 31,6× → "cerca de 30 vezes menos energia que hoje"
```

Com esse consumo, **uma única bateria 18650 (3.400 mAh ≈ 12,6 Wh a 3,7V)** já dura:

```
12,6 Wh ÷ 0,95 Wh/dia ≈ 13,3 dias → "1 a 2 semanas" de autonomia sem nenhum sol
```

E, combinada com um painel pequeno de 2–5 W, a autonomia deixa de ser um problema prático — o
painel gera, num único HSP médio (4h), de 8 a 20 Wh/dia, várias vezes o consumo diário.

**Trade-offs honestos ao adotar deep sleep:**

- **Perde leitura a cada 10 s.** Irrelevante na prática: piezômetro é um fenômeno **lento**
  (poropressão varia em horas/dias, não em segundos) — os próprios concorrentes comerciais medem
  a cada 5–30 min (seção 2) e são aceitos como padrão de mercado.
- **Perde alertas locais contínuos** (LED/buzzer/OLED só funcionam nos poucos segundos em que o
  dispositivo está acordado). Em instalação de campo real isso pesa pouco — ninguém fica olhando
  o poste da barragem o tempo todo mesmo; o alerta que importa é o que sai por Telegram/SMS, que
  continua funcionando normalmente porque é disparado pelo motor de alertas no Worker, não pelo
  dispositivo.
- **O store & forward continua funcionando** — o buffer de leituras retidas (`piezometro_core.h`)
  não depende de o dispositivo estar sempre acordado, só de o ciclo de despacho rodar quando ele
  acorda.

**Já implementado como opção de compilação** — `firmware/piezometro_deep_sleep.h`. Não é o modo
padrão (a maquete/demonstração continua sempre-ligada, LEDs/buzzer/OLED ao vivo); é opt-in via
`#define MODO_DEEP_SLEEP` antes do `#include "piezometro_core.h"` seguido de
`#include "piezometro_deep_sleep.h"`, trocando o `setup()/loop()` por
`void setup(){ initSensor(); deepSleepCiclo(); }` (nunca retorna) e `void loop(){}` (nunca
alcançado) — ver o cabeçalho do arquivo para o "como usar" completo.

A diferença central é que `esp_deep_sleep_start()` **reinicia o programa do zero** ao acordar
(não é um `delay()`) — todo o estado que no modo sempre-ligado vive em variáveis globais comuns
(`bufferDados`, `ultimoNtp`, etc.) morreria a cada ciclo. Por isso o novo header mantém seu
próprio buffer de leituras retidas em RTC memory (`RTC_DATA_ATTR`, até 96 leituras, ~2,3 KB dos
~8 KB disponíveis) em vez de reusar o buffer do core, reconecta o WiFi a cada despertar e só
re-sincroniza o NTP quando o relógio ainda não é válido ou a cada ~1 h de ciclos (o RTC interno
mantém a hora através do sono, com deriva). Os trade-offs (perde leitura a cada 10 s, perde alertas locais contínuos, mas mantém
store & forward e os alertas via Telegram/SMS do Worker) são os mesmos já descritos acima — a
implementação não muda essa análise, só a torna concreta.

### Menção — LoRaWAN como evolução para campo sem Wi-Fi

Para instalações onde não há rede Wi-Fi disponível no local (comum em campo, longe de
infraestrutura), a evolução natural é trocar o rádio Wi-Fi por **LoRaWAN**: consumo ainda menor
que o Wi-Fi mesmo em modo ativo, alcance de quilômetros até um gateway compartilhado (já citado em
`docs/projeto/VIABILIDADE_ECONOMICA.md`, seção 1.3, como alternativa de conectividade para locais sem
Wi-Fi — gateway compartilhado R$ 800–1.500 uma vez, custo recorrente por nó R$ 0–15/mês). Não é
parte do escopo deste protótipo, mas é o caminho natural de evolução de conectividade combinado
com deep sleep.

---

## 5. Recomendação em camadas

| Camada | Opção recomendada | Por quê |
|---|---|---|
| Maquete / defesa do TCC | **Opção A** (powerbank) | Zero mudança de firmware, custo baixo (R$ 80–150), autonomia de ~2 dias é suficiente para a apresentação — e a lacuna de redundância de energia é admitida explicitamente na defesa |
| Instalação piloto (validação em campo, sem obra elétrica) | **Opção B** (solar + bateria, sem mudar código) | Resolve a dependência de rede elétrica local sem tocar no firmware validado; autonomia de ~3 dias nublados com a bateria de 18Ah recomendada |
| Produto de campo (operação real, múltiplos pontos) | **Opções C + B combinadas** (deep sleep + solar pequeno) | É exatamente o padrão que o mercado usa (seção 2): duty cycling agressivo reduz o consumo em ~30× e permite bateria pequena + painel pequeno, em vez de superdimensionar a fonte solar para compensar um firmware sempre ligado |

**Tabela-resumo comparativa:**

| Opção | Custo estimado | Autonomia sem sol | Muda o firmware? | Atende ANM 95/2022 (redundância de energia)? |
|---|---|---|---|---|
| Hoje (USB, sem backup) | R$ 0 | 0 (para se faltar energia) | — | Não |
| A — Powerbank/no-break | R$ 80–150 | ~2 dias | Não | Parcial (backup simples, não é fonte de energia autônoma contínua) |
| B — Solar + bateria (sempre ligado) | R$ 385–660 | ~3 dias (bateria 18Ah) | Não | Sim, em espírito (energia autônoma contínua) — precisaria de validação formal por engenheiro para DPA alto |
| C + B — Deep sleep + solar pequeno | Kit solar menor (painel 2–5W) + bateria 18650, tipicamente abaixo do custo de B | Semanas (bateria pequena) a indefinido (com painel) | Sim — mudança de arquitetura no firmware | Sim, em espírito, com folga muito maior |

---

## 6. Resposta pronta para a banca

> "Hoje o protótipo depende de energia USB de bancada, sem nenhum backup — se faltar energia, o
> ponto para de reportar, embora o sistema detecte esse silêncio como um alerta de comunicação.
> Isso é uma lacuna real frente à Resolução ANM 95/2022, que exige redundância de energia para
> barragens de DPA alto, e nós admitimos essa lacuna sem meias palavras. Dimensionamos três
> caminhos de solução, na mesma lógica de camadas do resto do projeto: para a maquete, um
> powerbank de 20.000 mAh já dá cerca de dois dias de autonomia por ~R$ 100, sem tocar em uma
> linha de firmware; para uma instalação piloto, um kit solar de 20 W com bateria de 18 Ah (~R$
> 385–660) sustenta o consumo atual (~30 Wh/dia) por até três dias nublados seguidos, também sem
> mudar código; e para um produto de campo de verdade, a mudança de maior impacto é fazer o que o
> mercado inteiro já faz — os nós wireless de corda vibrante da Sisgeo, por exemplo, declaram até
> dez anos de bateria porque dormem quase o tempo todo. Um firmware com deep sleep, acordando a
> cada 5 minutos em vez de ficar sempre ligado, reduziria nosso consumo em cerca de 30 vezes — de
> ~30 Wh/dia para menos de 1 Wh/dia — tornando uma única bateria 18650 suficiente por uma a duas
> semanas, e indefinida com um painel solar pequeno. É trabalho futuro, não implementado nesta
> entrega, porque exige repensar o firmware em torno de reinicializações a cada ciclo — mas o
> caminho está mapeado e as contas, abertas."
