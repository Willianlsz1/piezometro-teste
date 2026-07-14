/*
 * ============================================================================
 * PIEZOMETRO_CORE.H — núcleo comum dos firmwares SAMARCO (simulação + físico)
 * ============================================================================
 *
 * Este arquivo concentra tudo que é IGUAL entre o firmware de simulação
 * (sketch.ino, BMP180) e o firmware do protótipo físico
 * (sketch_fisico_jsn_sr04t.ino, JSN-SR04T): WiFi, NTP, store & forward,
 * envio HTTP ao /ingest, classificação de nível, LEDs, buzzer, OLED e telas
 * de teste. O que muda de um sensor para o outro (como medir o nível) fica
 * no próprio .ino, que implementa um "adapter" de sensor definido pelo
 * contrato abaixo.
 *
 * COMO USAR NO ARDUINO IDE / WOKWI:
 * Este .h entra como uma ABA A MAIS dentro da mesma pasta do sketch (Arduino
 * IDE: "New Tab" → nome "piezometro_core.h"; no Wokwi: crie o arquivo com
 * esse nome no mesmo projeto). O .ino principal faz "#include
 * "piezometro_core.h"" DEPOIS de definir suas credenciais/limiares e ANTES
 * de implementar os hooks do sensor — o compilador processa tudo como um
 * único arquivo, então a ordem de inclusão importa.
 *
 * CONTRATO:
 *   O .ino define ANTES do #include deste header:
 *     #define WIFI_SSID / WIFI_PASS / SERVER_URL / DEVICE_KEY / PIEZOMETRO_ID
 *     #define NIVEL_ATENCAO / NIVEL_CRITICO
 *   e implementa DEPOIS (o struct Leitura é definido AQUI, pelo core):
 *     void initSensor();                                 // hardware do sensor
 *     Leitura lerSensor();                                // uma leitura
 *     void linhasExtrasDisplay(Adafruit_SSD1306 &d);      // 0-2 linhas no OLED
 *     void linhasExtrasSerial();                          // idem no Serial
 *
 * O core fornece: coreSetup(), coreLoop() e todas as funções internas de
 * WiFi/NTP/buffer/alerta/LEDs/buzzer/display listadas abaixo.
 * ============================================================================
 */

#pragma once

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ===== DISPLAY OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// ===== PINOS COMUNS (LEDs/buzzer — iguais nos dois firmwares) =====
#define LED_VERDE    32
#define LED_AMARELO  33
#define LED_VERMELHO 25
#define BUZZER       26

// ===== INTERVALOS (ms) =====
// Modo de campo a bateria/solar (duty cycling, sem ficar sempre ligado):
// ver piezometro_deep_sleep.h — opcional, não afeta os intervalos abaixo.
#define INTERVALO_LEITURA 1000UL    // leitura local + LEDs + display
#define INTERVALO_ENVIO   10000UL   // envio ao backend (Cloudflare Worker)
#define INTERVALO_NTP     300000UL  // 5 min — re-sincroniza o relógio periodicamente:
                                     // no Wokwi o clock simulado deriva (fica atrasado)
                                     // em relação ao tempo real, e a deriva acumulada
                                     // envelheceria o ts das leituras.

// ===== STORE & FORWARD =====
#define BUFFER_MAX 120              // ~20 min de leituras retidas sem rede

// ===== CONTRATO DO SENSOR =====
// Uma leitura do instrumento. O nível (m) é obrigatório; pressão e
// temperatura são opcionais — o JSON enviado ao backend só inclui os campos
// cujo flag "tem*" estiver true (o BMP180 envia os três; o JSN-SR04T, só o
// nível). O struct pertence ao core porque É a interface entre o núcleo e o
// adapter de sensor — não um detalhe de cada sketch.
struct Leitura {
  float nivel;        // m — obrigatório
  float pressao;      // hPa — só se temPressao
  float temperatura;  // °C — só se temTemperatura
  bool  temPressao;
  bool  temTemperatura;
  bool  valida;        // false = sensor sem resposta neste ciclo — NÃO
                        // bufferizar como medição nova, senão a falha do
                        // sensor entra no histórico disfarçada de dado bom
};

// ===== DECLARAÇÕES DOS HOOKS DE SENSOR (implementados no .ino) =====
// Declaradas explicitamente aqui — não confiar só no auto-prototype do
// Arduino IDE, que é heurístico (ctags) e pode falhar com tipos definidos
// fora do sketch.
void initSensor();
Leitura lerSensor();
void linhasExtrasDisplay(Adafruit_SSD1306 &d);
void linhasExtrasSerial();

// ===== OBJETO DO DISPLAY (compartilhado) =====
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== ESTADO DA ÚLTIMA LEITURA (preenchido pelo adapter via lerSensor) =====
Leitura leituraAtual = {0, 0, 0, false, false, false};

String nivelAlerta = "NORMAL";
int corAtual = 0; // 0=Verde, 1=Amarelo, 2=Vermelho

unsigned long ultimoBuzzer  = 0;
unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio   = 0;
unsigned long ultimoNtp     = 0;
bool estadoBuzzer = false;
bool wifiOk = false;
bool ntpOk = false;
// Instrumento de SEGURANÇA: falha de um componente secundário (display) não
// pode derrubar a medição — degrada (segue sem OLED), nunca trava o setup.
bool displayOk = false;

String bufferDados[BUFFER_MAX];
int bufferCount = 0;

// ===== FUNÇÃO: CONECTAR WIFI =====
void conectarWiFi() {
  Serial.print("Conectando ao WiFi \"" WIFI_SSID "\"");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(500);
    Serial.print(".");
  }
  wifiOk = (WiFi.status() == WL_CONNECTED);
  if (wifiOk) {
    Serial.println(" OK!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" FALHOU — sistema segue com alertas locais + buffer.");
  }
}

// ===== FUNÇÃO: SINCRONIZAR RELÓGIO (NTP) =====
// Necessário para o store & forward: cada leitura retida no buffer precisa
// do SEU timestamp, senão o backend carimbaria tudo com a hora do reenvio.
void sincronizarNTP() {
  if (!wifiOk) return;
  Serial.print("Sincronizando relógio (NTP)");
  configTime(0, 0, "pool.ntp.org");
  unsigned long inicio = millis();
  while (time(nullptr) < 1000000000 && millis() - inicio < 10000) {
    delay(500);
    Serial.print(".");
  }
  ntpOk = (time(nullptr) >= 1000000000);
  Serial.println(ntpOk ? " OK!" : " FALHOU — envio sem timestamp local.");
}

// ===== FUNÇÃO: BUFFERIZAR LEITURA (store & forward) =====
// Monta o JSON só com os campos presentes nesta Leitura (pressao/temperatura
// são opcionais — o protótipo físico não os envia; o Worker aceita ausentes).
void bufferizarLeitura() {
  char item[160];
  char campos[96] = "";

  if (leituraAtual.temPressao) {
    char p[32];
    snprintf(p, sizeof(p), ",\"pressao\":%.3f", leituraAtual.pressao);
    strncat(campos, p, sizeof(campos) - strlen(campos) - 1);
  }
  if (leituraAtual.temTemperatura) {
    char t[32];
    snprintf(t, sizeof(t), ",\"temperatura\":%.2f", leituraAtual.temperatura);
    strncat(campos, t, sizeof(campos) - strlen(campos) - 1);
  }

  if (ntpOk) {
    // Timestamp em SEGUNDOS
    long ts = (long)time(nullptr);
    snprintf(item, sizeof(item),
             "{\"piezometro\":\"" PIEZOMETRO_ID "\",\"nivel_agua\":%.3f%s,\"ts\":%ld}",
             leituraAtual.nivel, campos, ts);
  } else {
    snprintf(item, sizeof(item),
             "{\"piezometro\":\"" PIEZOMETRO_ID "\",\"nivel_agua\":%.3f%s}",
             leituraAtual.nivel, campos);
  }

  if (bufferCount >= BUFFER_MAX) {
    // Buffer cheio: descarta a leitura mais ANTIGA (política ring buffer)
    for (int i = 1; i < BUFFER_MAX; i++) bufferDados[i - 1] = bufferDados[i];
    bufferCount = BUFFER_MAX - 1;
    Serial.println("⚠️ Buffer cheio — leitura mais antiga descartada");
  }
  bufferDados[bufferCount++] = String(item);
}

// ===== FUNÇÃO: DESPACHAR BUFFER AO SERVIDOR =====
void despacharBuffer() {
  // Atualiza wifiOk aqui (e não só no boot em conectarWiFi()) — é o valor que
  // o OLED/Serial exibem e que o re-sync NTP do coreLoop consulta; sem isso
  // eles ficavam presos ao estado do momento da conexão inicial.
  wifiOk = (WiFi.status() == WL_CONNECTED);

  if (bufferCount == 0) return;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("📡 WiFi offline — %d leitura(s) retidas no buffer\n", bufferCount);
    WiFi.reconnect();
    return;
  }
  if (!ntpOk) sincronizarNTP();  // tenta recuperar o relógio quando a rede volta

  // Monta um único JSON com todas as leituras retidas
  String body = "{\"leituras\":[";
  for (int i = 0; i < bufferCount; i++) {
    body += bufferDados[i];
    if (i < bufferCount - 1) body += ",";
  }
  body += "]}";

  WiFiClientSecure client;
  client.setInsecure(); // simulação/protótipo; em produção use certificado CA

  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(8000);

  int code = http.POST(body);
  if (code == 204) {
    Serial.printf("📡 Servidor: %d leitura(s) enviadas (HTTP 204)\n", bufferCount);
    bufferCount = 0;  // sucesso — esvazia o buffer
  } else {
    Serial.printf("📡 Servidor: falha (HTTP %d) — %d leitura(s) retidas\n",
                  code, bufferCount);
  }
  http.end();
}

// ===== FUNÇÃO: DETERMINAR NÍVEL DE ALERTA =====
// Lógica correta de piezômetro: nível d'água ALTO = perigo (saturação).
void determinarAlerta() {
  if (leituraAtual.nivel < NIVEL_ATENCAO) {
    nivelAlerta = "NORMAL";
    corAtual = 0; // Verde
  }
  else if (leituraAtual.nivel < NIVEL_CRITICO) {
    nivelAlerta = "ATENCAO";
    corAtual = 1; // Amarelo
  }
  else {
    nivelAlerta = "CRITICO";
    corAtual = 2; // Vermelho
  }
}

// ===== FUNÇÃO: ATUALIZAR LEDS =====
void atualizarLEDs() {
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_AMARELO, LOW);
  digitalWrite(LED_VERMELHO, LOW);

  if (corAtual == 0) {
    digitalWrite(LED_VERDE, HIGH);          // NORMAL — verde fixo
  }
  else if (corAtual == 1) {
    digitalWrite(LED_AMARELO, HIGH);        // ATENÇÃO — amarelo fixo
  }
  else {
    // CRÍTICO — vermelho piscando (alterna a cada ciclo de 1 s)
    static bool estadoVermelho = false;
    estadoVermelho = !estadoVermelho;
    digitalWrite(LED_VERMELHO, estadoVermelho);
  }
}

// ===== FUNÇÃO: ATUALIZAR BUZZER (não bloqueante) =====
// Obs.: digitalWrite funciona com o buzzer do Wokwi e buzzers ativos.
// Em buzzer passivo real, troque por tone(BUZZER, 2000) / noTone(BUZZER).
void atualizarBuzzer() {
  unsigned long agora = millis();

  if (corAtual == 0) {
    digitalWrite(BUZZER, LOW);
    estadoBuzzer = false;
  }
  else if (corAtual == 1) {
    // ATENÇÃO — beep curto (100 ms) a cada 2 segundos, sem delay()
    if (!estadoBuzzer && agora - ultimoBuzzer >= 2000) {
      digitalWrite(BUZZER, HIGH);
      estadoBuzzer = true;
      ultimoBuzzer = agora;
    }
    else if (estadoBuzzer && agora - ultimoBuzzer >= 100) {
      digitalWrite(BUZZER, LOW);
      estadoBuzzer = false;
    }
  }
  else {
    // CRÍTICO — alterna a cada 500 ms
    if (agora - ultimoBuzzer >= 500) {
      estadoBuzzer = !estadoBuzzer;
      digitalWrite(BUZZER, estadoBuzzer);
      ultimoBuzzer = agora;
    }
  }
}

// ===== FUNÇÃO: MOSTRAR NO SERIAL =====
void mostrarSerial() {
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.print("💧 Nível d'água: ");
  Serial.print(leituraAtual.nivel, 2);
  Serial.println(" m");

  linhasExtrasSerial(); // linhas específicas do sensor (pressão/temp, distância, etc.)

  Serial.print("💾 Buffer:       ");
  Serial.print(bufferCount);
  Serial.println(" leitura(s) pendente(s)");

  Serial.println();

  if (nivelAlerta == "NORMAL") {
    Serial.println("🟢 STATUS: NORMAL");
    Serial.println("   → Nível dentro da faixa segura");
  }
  else if (nivelAlerta == "ATENCAO") {
    Serial.println("🟡 STATUS: ATENÇÃO!");
    Serial.println("   → Nível d'água subindo");
    Serial.println("   → Intensificar monitoramento");
  }
  else {
    Serial.println("🔴 STATUS: CRÍTICO!!!");
    Serial.println("   → ALERTA MÁXIMO ATIVADO!");
    Serial.println("   → Nível acima do limite de segurança");
    Serial.println("   → Acionar equipe de geotecnia imediatamente!");
  }

  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println();
}

// ===== FUNÇÃO: MOSTRAR NO DISPLAY OLED =====
// Componente SECUNDÁRIO: se o OLED falhou no boot (displayOk == false), a
// função simplesmente não faz nada — a medição, os alertas (LED/buzzer) e a
// telemetria seguem intactos. Cobre também linhasExtrasDisplay(), chamada
// logo abaixo.
void mostrarDisplay() {
  if (!displayOk) return;

  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("SAMARCO PIEZOMETRO");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 15);
  display.print("Nivel: ");
  display.print(leituraAtual.nivel, 2);
  display.print(" m");

  linhasExtrasDisplay(display); // até 2 linhas específicas do sensor (cursores y=25 e y=35)

  display.drawLine(0, 45, 128, 45, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(0, 50);

  if (nivelAlerta == "NORMAL") {
    display.print("NORMAL");
  }
  else if (nivelAlerta == "ATENCAO") {
    if ((millis() / 500) % 2 == 0) display.print("ATENCAO");
  }
  else {
    if ((millis() / 250) % 2 == 0) display.print("CRITICO!");
  }

  display.display();
}

// ===== FUNÇÃO: TELA DE INICIALIZAÇÃO =====
// Mesma lógica de degradação de mostrarDisplay(): sem OLED, não há tela de
// boot, mas o resto do setup continua normalmente.
void mostrarTelaInicio() {
  if (!displayOk) return;

  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(10, 5);
  display.println("SAMARCO");

  display.setTextSize(1);
  display.setCursor(8, 30);
  display.println("Nivel de agua em");
  display.setCursor(18, 42);
  display.println("piezometros");

  display.setCursor(10, 55);
  display.println("Iniciando...");

  display.display();
  delay(2000);
}

// ===== FUNÇÃO: TESTAR LEDS =====
void testarLEDs() {
  digitalWrite(LED_VERDE, HIGH);
  delay(300);
  digitalWrite(LED_VERDE, LOW);

  digitalWrite(LED_AMARELO, HIGH);
  delay(300);
  digitalWrite(LED_AMARELO, LOW);

  digitalWrite(LED_VERMELHO, HIGH);
  delay(300);
  digitalWrite(LED_VERMELHO, LOW);

  digitalWrite(LED_VERDE, HIGH);
  digitalWrite(LED_AMARELO, HIGH);
  digitalWrite(LED_VERMELHO, HIGH);
  delay(300);
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_AMARELO, LOW);
  digitalWrite(LED_VERMELHO, LOW);

  Serial.println("✅ LEDs OK!");
}

// ===== FUNÇÃO: TESTAR BUZZER =====
void testarBuzzer() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(100);
    digitalWrite(BUZZER, LOW);
    delay(100);
  }
  Serial.println("✅ Buzzer OK!");
}

// ===== SETUP COMUM =====
// Chamado pelo .ino DEPOIS de initSensor(): void setup(){ initSensor(); coreSetup(); }
void coreSetup() {
  Serial.begin(115200); // idempotente — initSensor() pode já ter iniciado o Serial
  delay(1000);

  Serial.println("===========================================");
  Serial.println("  SAMARCO - NIVEL DE AGUA EM PIEZOMETROS");
  Serial.println("  Telemetria + Alertas + Store & Forward");
  Serial.println("  Instrumento: " PIEZOMETRO_ID);
  Serial.println("===========================================");
  Serial.println();

  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  Serial.println("Testando LEDs...");
  testarLEDs();

  Serial.println("Testando buzzer...");
  testarBuzzer();

  Wire.begin(21, 22); // barramento I2C do OLED (compartilhado com o BMP180, quando houver)

  Serial.print("Inicializando OLED... ");
  // Instrumento de SEGURANÇA: o display é um componente SECUNDÁRIO — sua
  // falha não pode travar o setup e derrubar leitura/alertas/telemetria.
  // Antes entrava em while(1) piscando o LED amarelo; agora só registra o
  // problema e segue em modo degradado (sem display).
  displayOk = display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS);
  if (!displayOk) {
    Serial.println("ERRO!");
    Serial.println("OLED ausente — seguindo em modo degradado (sem display)");
  } else {
    Serial.println("OK!");
    display.setTextColor(SSD1306_WHITE);
  }

  mostrarTelaInicio();
  conectarWiFi();
  sincronizarNTP();
  ultimoNtp = millis(); // evita re-sincronizar de novo já no primeiro loop

  Serial.println();
  Serial.println("Sistema pronto!");
  Serial.println("Monitoramento iniciado...");
  Serial.println("===========================================");
  Serial.println();

  digitalWrite(LED_VERDE, HIGH);
}

// ===== LOOP COMUM (não bloqueante) =====
// Chamado pelo .ino: void loop(){ coreLoop(); }
void coreLoop() {
  unsigned long agora = millis();

  // Ciclo local: leitura + alertas + display (a cada 1 s)
  if (agora - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = agora;
    leituraAtual = lerSensor();
    determinarAlerta();
    atualizarLEDs();
    mostrarSerial();
    mostrarDisplay();
  }

  // Ciclo de telemetria: bufferiza (só leitura válida) e tenta despachar sempre
  // (a cada 10 s) — despacharBuffer() roda mesmo sem leitura nova, para
  // esvaziar pendências já retidas.
  if (agora - ultimoEnvio >= INTERVALO_ENVIO) {
    ultimoEnvio = agora;
    if (leituraAtual.valida) bufferizarLeitura();
    despacharBuffer();
  }

  // Ciclo de relógio: re-sincroniza o NTP a cada 5 min (corrige a deriva do Wokwi)
  if (wifiOk && agora - ultimoNtp >= INTERVALO_NTP) {
    ultimoNtp = agora;
    sincronizarNTP();
  }

  // Buzzer roda a cada passagem para não perder o timing dos beeps
  atualizarBuzzer();
}
