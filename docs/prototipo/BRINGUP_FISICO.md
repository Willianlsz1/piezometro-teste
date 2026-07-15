# Bring-up do protótipo físico — diário de bordo

Registro do estado real da montagem física (ESP32 + HC-SR04 emprestado + OLED), para
qualquer pessoa da equipe retomar de onde parou. Complementa o guia de montagem
([PROTOTIPO_FISICO.md](PROTOTIPO_FISICO.md)) — aqui é o que **aconteceu**, lá é o que
**deveria acontecer**.

## Estado em 15/07/2026 (PC pessoal do Willian)

### ✅ Resolvido nesta sessão

| Item | Como foi resolvido |
|---|---|
| IDE só via COM1 (driver) | Chip CP2102 detectado com erro 28 (driver ausente). Instalado o `CP210x_Universal_Windows_Driver` oficial da Silicon Labs via `pnputil` — placa passou a aparecer como **COM3** |
| Upload travando em `Connecting...` | Primeiro upload falhou com "Wrong boot mode (0x12)": segurar o botão **BOOT** durante o `Connecting...` resolve. Placa é clone (aviso de cristal 41 MHz), o auto-reset nem sempre funciona |
| Gravação do firmware | `sketch_demo_hc_sr04.ino` gravado com sucesso (82% da flash), ESP32-D0WD-V3 na COM3 |
| Serial com caracteres embaralhados | Serial Monitor estava fora de 115200 baud — corrigido no dropdown do monitor |
| Store & forward | Confirmado funcionando ao vivo: sem WiFi, o buffer acumulou 32 leituras pendentes |

### ❌ Pendente (retomar daqui — provavelmente no SENAI)

1. **Sensor HC-SR04 sempre `(sem eco)`** — o TRIG dispara mas o pulso nunca volta ao GPIO18.
   Causas prováveis, na ordem (checar com foto da protoboard antes de mexer):
   1. VCC do sensor no 3V3 — tem que ir no **VIN (5V)**; em 3,3V o HC-SR04 não ecoa;
   2. Divisor invertido — o certo é `ECHO → [1kΩ] → G18` e `G18 → [2kΩ] → GND`
      (1kΩ = marrom/preto/vermelho; 2kΩ = vermelho/preto/vermelho). Invertido, o pulso
      chega com ~1,7 V e o ESP32 não reconhece;
   3. TRIG e ECHO trocados entre si (TRIG→G5, ECHO→divisor→G18);
   4. Mau contato na protoboard (jumper fora da coluna, GND não comum).
2. **OLED não inicializou** — diagnosticar pela linha do display no boot do Serial.
   Suspeitas antigas da foto: SCK no pino TXD em vez do G22; VDD no EN em vez do 3V3
   (isso também atrapalha o boot!); endereço 0x3D em vez de 0x3C.
   Fiação certa: GND→GND, VDD→**3V3**, SCK→**G22**, SDA→**G21**.
3. **WiFi não conectou na sessão** (por isso o buffer acumulado) — conferir rede 2,4 GHz
   e credenciais no topo do sketch. No SENAI/banca: hotspot 2,4 GHz do celular.
4. Teste de ponta a ponta: mão a ~15 cm parada por 10 s → nível sobe no Serial/dashboard;
   mão a ~10 cm por 1 min → alerta CRÍTICO no Telegram.

### Como testar o sensor (jeito certo)

O firmware lê em ciclos (não é contínuo): **segurar a mão parada** sobre o sensor por
10–15 segundos e acompanhar a linha `Distancia medida:` no Serial. Passar a mão rápido
cai entre dois ciclos e não registra.

## O sketch da demo

`firmware/sketch_demo_hc_sr04.ino` — demo de bancada **sem água** (HC-SR04 emprestado):
a mão faz o papel da água. Escala: mão a 40 cm = 0 m · 20 cm = 10 m (normal) ·
16 cm = 12 m (atenção) · **10 cm = 15 m (crítico)**. Usa o mesmo `piezometro_core.h`
(WiFi, NTP, store & forward, envio, alertas, OLED) — só muda o adapter `lerSensor()`.
A maquete definitiva com água continua sendo o `sketch_fisico_jsn_sr04t.ino`.

> Para compilar na Arduino IDE: copiar `sketch_demo_hc_sr04.ino` **e** `piezometro_core.h`
> para uma pasta `sketch_demo_hc_sr04/` no sketchbook. Placa: **DOIT ESP32 DEVKIT V1**.
> Preencher WIFI_SSID/WIFI_PASS/DEVICE_KEY antes de gravar — segredos nunca no commit.

## Lembretes de infraestrutura

- PC do SENAI não permite instalar driver — gravações são no PC pessoal; na banca a
  placa roda de powerbank + hotspot 2,4 GHz (não precisa de PC).
- Driver CP210x: se usar outro PC pessoal, repetir a instalação (zip oficial da
  Silicon Labs, instalar `silabser.inf` como administrador).
