# 🧱 Protótipo Físico — Guia de Montagem da Maquete

Guia completo para transformar a simulação Wokwi (`firmware/sketch.ino`, com o BMP180 como *stand-in*) em uma **maquete física real**: ESP32 de verdade, sensor ultrassônico JSN-SR04T medindo o nível de água de verdade dentro de um tubo/balde, e o mesmo backend (Cloudflare Worker + D1 + Telegram/SMS Twilio) já usado na simulação.

> ⚠️ **Antes de começar:** o firmware desta maquete é o `firmware/sketch_fisico_jsn_sr04t.ino` — **não** use o `firmware/sketch.ino` (esse é só para o Wokwi, com BMP180). São dois firmwares diferentes para dois cenários diferentes.

> ℹ️ **Backend:** o firmware fala com o backend atual (v2) — Cloudflare Worker + D1 + Telegram/SMS Twilio, publicado em `https://piezometro-worker.willianloopes123.workers.dev`. A v1 (Render + InfluxDB) está aposentada — ver histórico git.

---

## 📋 Índice

- [1. Lista de compras](#1-lista-de-compras)
- [2. Esquema de ligação](#2-esquema-de-ligação)
- [3. Montagem da maquete](#3-montagem-da-maquete)
- [4. Calibração e teste](#4-calibração-e-teste)
- [5. Roteiro de demonstração para a banca](#5-roteiro-de-demonstração-para-a-banca)
- [6. Solução de problemas](#6-solução-de-problemas)

---

## 1. Lista de compras

| Item | Especificação | Preço estimado | Onde comprar |
|---|---|---|---|
| ESP32 DevKit V1 | 30 pinos, USB micro | R$ 35–50 | Eletrogate, RoboCore, Mercado Livre |
| Sensor ultrassônico JSN-SR04T | À prova d'água, cabeça separada do módulo | R$ 40–70 | [Eletrogate](https://www.eletrogate.com/sensor-de-distancia-ultrassonico-jsn-sr04t-a-prova-dagua-modulo) / [RoboCore](https://www.robocore.net/sensor-robo/sensor-ultrassonico-jsn-sr04t-a-prova-de-agua) |
| Display OLED SSD1306 I2C | 0,96", 128x64, 4 pinos (VCC/GND/SCL/SDA) | R$ 20–35 | Eletrogate, RoboCore, Mercado Livre |
| LEDs (verde, amarelo, vermelho) | 5 mm, um de cada cor | R$ 1–3 (kit) | Qualquer loja de eletrônica |
| Resistores 220 Ω | 3 unidades (limitação de corrente dos LEDs) | R$ 1–2 | Qualquer loja de eletrônica |
| Resistores 1 kΩ e 2 kΩ | 1 de cada (divisor de tensão do ECHO) | R$ 1–2 | Qualquer loja de eletrônica |
| Buzzer ativo 5V | Com fios ou para protoboard | R$ 3–5 | Qualquer loja de eletrônica |
| Protoboard 830 pontos | Padrão, com trilhos de alimentação | R$ 10–20 | Qualquer loja de eletrônica |
| Jumpers macho-macho e macho-fêmea | Kit variado (~40 unidades) | R$ 8–15 | Qualquer loja de eletrônica |
| Cabo micro-USB **de dados** | ⚠️ precisa ser de dados, não só de carga | R$ 5–12 | Qualquer loja/já deve ter em casa |
| Tubo de PVC 100 mm (~60 cm) ou balde transparente | Tubo de esgoto (barato) com tampa/cap de PVC nas pontas, ou um balde/pote transparente | R$ 15–30 | Loja de materiais de construção |
| Fita adesiva / abraçadeira de nylon | Para fixar o sensor no topo do tubo | R$ 5–10 | Papelaria/loja de construção |
| **(Opcional, recomendado)** Fonte USB 5 V/2 A **ou** powerbank 10.000–20.000 mAh | Deixa a maquete independente do notebook na apresentação; o powerbank ainda demonstra ao vivo a "opção A" (backup de energia) do estudo de alimentação | R$ 30–80 | Qualquer loja de eletrônicos/já deve ter em casa |

**Total estimado: R$ 150 – 220** (itens obrigatórios; +R$ 30–80 com a fonte/powerbank opcional)

> ⚠️ Prefira o JSN-SR04T ao HC-SR04 comum: o transdutor do JSN é separado do módulo eletrônico por um cabo, então ele pode ficar dentro/perto da água (protegido) enquanto a eletrônica fica seca — ideal para esta maquete.

---

## 2. Esquema de ligação

| Componente | Pino do componente | Vai para | Observação |
|---|---|---|---|
| JSN-SR04T | VCC | ESP32 `VIN` (5V) | O sensor precisa de 5V, não funciona bem em 3,3V |
| JSN-SR04T | TRIG | ESP32 `GPIO5` | Direto, sem divisor (ESP32 já manda 3,3V, sensor aceita) |
| JSN-SR04T | ECHO | Divisor de tensão → ESP32 `GPIO18` | **Obrigatório** o divisor — ver diagrama abaixo |
| JSN-SR04T | GND | ESP32 `GND` | Comum a todo o circuito |
| OLED SSD1306 | VCC | ESP32 `3V3` | |
| OLED SSD1306 | GND | ESP32 `GND` | |
| OLED SSD1306 | SCL | ESP32 `GPIO22` | Mesmo barramento I2C do diagrama Wokwi |
| OLED SSD1306 | SDA | ESP32 `GPIO21` | |
| LED Verde (+ resistor 220 Ω) | Ânodo | ESP32 `GPIO32` | Cátodo → resistor → GND |
| LED Amarelo (+ resistor 220 Ω) | Ânodo | ESP32 `GPIO33` | Cátodo → resistor → GND |
| LED Vermelho (+ resistor 220 Ω) | Ânodo | ESP32 `GPIO25` | Cátodo → resistor → GND |
| Buzzer | (+) | ESP32 `GPIO26` | (−) → GND |

### Divisor de tensão do ECHO (5V → 3,3V)

O pino ECHO do JSN-SR04T devolve um pulso em **5V**, mas as GPIOs do ESP32 só toleram **3,3V**. Ligar o ECHO direto no ESP32 pode danificar a placa. Monte este divisor resistivo:

```
 ECHO (5V) ────[ R1 = 1 kΩ ]────┬──── GPIO18 (ESP32)
                                │
                          [ R2 = 2 kΩ ]
                                │
                               GND
```

Conta da régua: `V_saída = 5V × R2/(R1+R2) = 5V × 2k/3k ≈ 3,3V` — seguro para a GPIO.

> ⚠️ Não inverta os resistores! Se trocar 1 kΩ com 2 kΩ o pulso sai maior que 3,3V.

---

## 3. Montagem da maquete

1. **Escolha o recipiente:** tubo de PVC de 100 mm com ~60 cm de altura (com uma tampa/cap de PVC no fundo para não vazar) ou um balde/pote transparente de altura semelhante. Tubos mais largos (≥ 75 mm) evitam eco nas paredes internas.
2. **Fixe o sensor no TOPO do tubo**, apontando para baixo, para a água — use fita adesiva forte, abraçadeira de nylon, ou um suporte de PVC/madeira furado no diâmetro do transdutor. O transdutor deve ficar centralizado e nivelado (não torto), olhando reto para a superfície da água.
3. **Meça a altura real** do sensor até o fundo do tubo com uma régua/trena — esse valor vai no `ALTURA_SENSOR_CM` do firmware (ver seção 4).
4. **Marque no tubo, com caneta permanente**, as alturas de referência (usando a escala padrão do firmware, `ESCALA_M_POR_CM = 0.5`):
   - **24 cm de água** → equivale a 12 m (limiar de **ATENÇÃO**)
   - **30 cm de água** → equivale a 15 m (limiar de **CRÍTICO**)
5. **Encha com uma jarra** de água aos poucos durante os testes e a demonstração — não use mangueira/torneira direta, é mais fácil controlar o nível com uma jarra.

> ⚠️ Lembre-se da zona morta do JSN-SR04T (~25 cm): o sensor precisa ficar pelo menos 25 cm ACIMA do nível máximo de água que o tubo vai receber, senão as leituras próximas ao sensor ficam instáveis. Um tubo de 60 cm com nível máximo de 30 cm de água deixa 30 cm de folga — confortável.

---

## 4. Calibração e teste

1. Abra `firmware/sketch_fisico_jsn_sr04t.ino` na Arduino IDE e ajuste:
   ```cpp
   #define ALTURA_SENSOR_CM 60.0   // troque pelo valor medido na montagem
   ```
2. Preencha `WIFI_SSID`, `WIFI_PASS`, `SERVER_URL` (apontando para o `/ingest` do Worker, ex.: `https://piezometro-worker.willianloopes123.workers.dev/ingest`) e `DEVICE_KEY` (a mesma definida como secret no Worker via `wrangler secret put DEVICE_KEY`).
3. Grave o firmware e abra o Serial Monitor (115200 baud).
4. **Teste a seco** (tubo vazio): a distância medida deve bater com `ALTURA_SENSOR_CM` (±1–2 cm) e o nível deve aparecer próximo de 0 m. Se não bater, corrija o `ALTURA_SENSOR_CM` ou refaça a fixação do sensor (pode estar torto).
5. **Teste com água subindo**: despeje água aos poucos e confira no Serial/OLED que o nível sobe conforme a régua marcada no tubo — 24 cm de água deve mostrar ATENÇÃO (LED amarelo + beep a cada 2s), 30 cm deve mostrar CRÍTICO (LED vermelho piscando + beep rápido).

---

## 5. Roteiro de demonstração para a banca

Roteiro de **~3 minutos**, pensado para deixar claro o fluxo completo (sensor → servidor → dashboard → alerta):

1. **Preparação:** deixe o dashboard (`index.html`) aberto em um notebook/projetor e o Telegram aberto no celular, com o bot já configurado e visível para a banca. Tubo com água no nível NORMAL (abaixo de 24 cm).
2. **Subida até ATENÇÃO:** despeje água até passar de 24 cm (12 m equivalentes). A banca deve ver: LED amarelo aceso, beep lento (a cada 2s) na maquete, e um novo evento aparecendo no painel/dashboard em poucos segundos.
3. **Subida até CRÍTICO:** continue despejando até passar de 30 cm (15 m equivalentes). A banca deve ver: LED vermelho piscando, beep rápido contínuo, e — o ponto alto da demonstração — o **celular tocando com a notificação do Telegram** avisando o nível crítico.
4. **Retorno ao normal:** retire água do tubo (com uma seringa, sifão ou virando parte da água fora) até voltar para NORMAL — mostre que a transição de volta também dispara uma notificação (o sistema avisa tanto quando piora quanto quando volta ao normal).
5. **Store & forward:** desligue o WiFi do roteador/celular por um instante. Mostre no Serial Monitor as leituras se acumulando no buffer local; religue o WiFi e mostre que todas as leituras retidas chegam ao servidor de uma vez, sem perda de dados — o diferencial do projeto para conectividade instável em campo.

---

## 6. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Leitura sempre 0 ou muito instável | Água/objeto dentro da zona morta (< 25 cm do sensor) | Reposicione o sensor mais alto ou reduza o nível máximo de água |
| Leitura errática mesmo fora da zona morta | Sensor torto (não perpendicular à água) ou eco nas paredes de um tubo estreito | Nivele o sensor; use tubo de diâmetro ≥ 75 mm |
| Display OLED em branco / não inicializa | Endereço I2C incorreto (alguns módulos usam `0x3D`, não `0x3C`) | Rode um scanner I2C ou troque `SCREEN_ADDRESS` para `0x3D` no firmware |
| WiFi não conecta | SSID/senha errados, ou rede 5 GHz (ESP32 só conecta em 2,4 GHz) | Confirme `WIFI_SSID`/`WIFI_PASS` e use uma rede 2,4 GHz |
| Servidor responde "HTTP 401" | `DEVICE_KEY` do firmware diferente do secret `DEVICE_KEY` configurado no Cloudflare Worker | Confirme que as duas chaves são idênticas (copie e cole, evite digitar; reconfirme com `wrangler secret put DEVICE_KEY` se necessário) |
| ESP32 não aparece na porta serial | Cabo USB é só de carga, não de dados | Troque por um cabo micro-USB de dados |
| Distância medida sempre menor que a real | Objeto/parede refletindo o eco antes da água (respingos, condensação na parede do tubo) | Seque o interior do tubo antes do teste; afaste o sensor de obstruções |

---

Com o firmware, a lista de compras e o passo a passo acima, a maquete física reproduz fielmente a lógica do sistema simulado no Wokwi — os mesmos limiares (12 m / 15 m), o mesmo store & forward, e os mesmos alertas por Telegram/SMS — só trocando a origem do dado: de um slider de pressão simulado para um sensor ultrassônico medindo água de verdade.
