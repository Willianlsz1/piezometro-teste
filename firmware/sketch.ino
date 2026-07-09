/*
 * ============================================================================
 * SAMARCO — MONITORAMENTO ONLINE DO NÍVEL DE ÁGUA EM PIEZÔMETROS
 * ESP32 + BMP180 (stand-in) + OLED + LEDS + BUZZER + SERVIDOR (JSON) + STORE&FORWARD
 * ============================================================================
 *
 * ⚠️ NOTA CONCEITUAL (para o TCC):
 * O desafio SAGA pede monitoramento do NÍVEL DE ÁGUA (metros de coluna
 * d'água). O Wokwi não possui transdutor piezométrico, então usamos o BMP180
 * (barômetro) como *stand-in*: a pressão do slider é convertida em um nível
 * d'água SIMULADO pela escala didática SIM_ESCALA (10 hPa = 1 m). No hardware
 * real (Fase 2), o nível virá de um transdutor de pressão submersível
 * 4–20 mA lido por um ADC ADS1115 — e a conversão passa a ser física real
 * (1 mH2O ≈ 98,07 hPa), calibrada na instalação.
 *
 * LÓGICA DE ALERTA (correta para piezômetro: nível ALTO = perigo):
 * 🟢 NORMAL   : nível < 12 m           → LED Verde, buzzer OFF
 * 🟡 ATENÇÃO  : 12 m ≤ nível < 15 m    → LED Amarelo, beep lento (2 s)
 * 🔴 CRÍTICO  : nível ≥ 15 m           → LED Vermelho pisca, beep rápido
 *
 * Com o padrão do Wokwi (1013,25 hPa) o nível simulado é 10,0 m (NORMAL).
 * Durante a simulação, clique no BMP180 e suba a pressão no slider:
 *   1013 hPa → 10,0 m (normal) · 1035 hPa → 12,2 m (atenção)
 *   1065 hPa → 15,2 m (CRÍTICO)
 *
 * ENVIO: o firmware NÃO fala mais direto com o InfluxDB — ele não guarda
 * nenhum token do banco, apenas a DEVICE_KEY do NOSSO servidor. Cada leitura
 * vira um JSON simples, que é enviado por HTTPS ao endpoint /ingest do
 * server.js (rodando no Render); é o servidor quem repassa os dados ao
 * InfluxDB, com a chave de verdade guardada só lá.
 *
 * STORE & FORWARD ("caixa-preta", conceito AquaSense):
 * Cada leitura recebe timestamp via NTP (em SEGUNDOS, campo "ts") e entra em
 * um buffer local. O envio ao servidor despacha o buffer inteiro; se a
 * rede/servidor falhar, os dados ficam retidos e são reenviados no próximo
 * ciclo — nenhuma leitura se perde. O servidor converte o "ts" de segundos
 * para nanossegundos antes de gravar no InfluxDB.
 *
 * ALERTAS ATIVOS (Telegram/SMS): enviados pelo servidor (server.js), que
 * vigia o InfluxDB — ver README. No hardware real, um módulo SIM7600
 * permitiria SMS direto do campo, sem depender do servidor.
 *
 * CONEXÕES NO WOKWI (ver firmware/diagram.json):
 * BMP180:  VCC→3V3  GND→GND  SCL→GPIO22  SDA→GPIO21
 * OLED:    VCC→3V3  GND→GND  SCL→GPIO22  SDA→GPIO21
 * LEDs (resistor 220Ω): Verde→GPIO32  Amarelo→GPIO33  Vermelho→GPIO25
 * BUZZER:  (+)→GPIO26  (−)→GND
 *
 * Bibliotecas: Adafruit BMP085 Library, Adafruit SSD1306, Adafruit GFX Library
 * ============================================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <Adafruit_BMP085.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ===== CREDENCIAIS (preencha antes de usar!) =====
#define WIFI_SSID   "Wokwi-GUEST"
#define WIFI_PASS   ""
#define SERVER_URL  "https://SEU-APP.onrender.com/ingest"  // endpoint /ingest do server.js
#define DEVICE_KEY  "troque-esta-chave"                    // mesma DEVICE_KEY do servidor
#define MEASUREMENT "telemetria_samarco"                   // (info) measurement gravado pelo servidor

// ===== CONVERSÃO PRESSÃO → NÍVEL D'ÁGUA (simulação) =====
// nivel = NIVEL_REF + (pressao_hPa − PRESSAO_REF) / SIM_ESCALA
// Escala didática: 10 hPa por metro, para o slider do Wokwi varrer os 3 níveis.
// No hardware real: nivel = (P_transdutor − P_atmosferica) / 98.07 (mH2O).
#define PRESSAO_REF 1013.25  // hPa — padrão do BMP180 no Wokwi
#define NIVEL_REF   10.0     // m  — nível no ponto de referência
#define SIM_ESCALA  10.0     // hPa por metro (didático)

// ===== LIMIARES DE NÍVEL (m) — espelhados em index.html e server.js =====
#define NIVEL_ATENCAO 12.0   // acima disso = ATENÇÃO
#define NIVEL_CRITICO 15.0   // acima disso = CRÍTICO

// ===== DISPLAY OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// ===== PINOS =====
#define LED_VERDE    32
#define LED_AMARELO  33
#define LED_VERMELHO 25
#define BUZZER       26

// ===== INTERVALOS (ms) =====
#define INTERVALO_LEITURA 1000UL    // leitura local + LEDs + display
#define INTERVALO_ENVIO   10000UL   // envio ao servidor (Render)

// ===== STORE & FORWARD =====
#define BUFFER_MAX 120              // ~20 min de leituras retidas sem rede

// ===== OBJETOS =====
Adafruit_BMP085 bmp;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== VARIÁVEIS GLOBAIS =====
float temperatura = 0;
float pressao = 0;
float nivelAgua = 0;

String nivelAlerta = "NORMAL";
int corAtual = 0; // 0=Verde, 1=Amarelo, 2=Vermelho

unsigned long ultimoBuzzer  = 0;
unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio   = 0;
bool estadoBuzzer = false;
bool wifiOk = false;
bool ntpOk = false;

String bufferDados[BUFFER_MAX];
int bufferCount = 0;

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("===========================================");
  Serial.println("  SAMARCO - NIVEL DE AGUA EM PIEZOMETROS");
  Serial.println("  Telemetria + Alertas + Store & Forward");
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

  Wire.begin(21, 22);

  Serial.print("Inicializando BMP180... ");
  if (!bmp.begin()) {
    Serial.println("ERRO!");
    Serial.println("Sensor não encontrado!");
    while (1) {
      digitalWrite(LED_VERMELHO, HIGH);
      delay(200);
      digitalWrite(LED_VERMELHO, LOW);
      delay(200);
    }
  }
  Serial.println("OK!");

  Serial.print("Inicializando OLED... ");
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("ERRO!");
    Serial.println("Display não encontrado!");
    while (1) {
      digitalWrite(LED_AMARELO, HIGH);
      delay(200);
      digitalWrite(LED_AMARELO, LOW);
      delay(200);
    }
  }
  Serial.println("OK!");
  display.setTextColor(SSD1306_WHITE);

  mostrarTelaInicio();
  conectarWiFi();
  sincronizarNTP();

  Serial.println();
  Serial.println("Sistema pronto!");
  Serial.println("Monitoramento iniciado...");
  Serial.println("===========================================");
  Serial.println();

  digitalWrite(LED_VERDE, HIGH);
}

// ===== LOOP PRINCIPAL (não bloqueante) =====
void loop() {
  unsigned long agora = millis();

  // Ciclo local: leitura + alertas + display (a cada 1 s)
  if (agora - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = agora;
    lerSensor();
    determinarAlerta();
    atualizarLEDs();
    mostrarSerial();
    mostrarDisplay();
  }

  // Ciclo de telemetria: bufferiza e tenta despachar (a cada 10 s)
  if (agora - ultimoEnvio >= INTERVALO_ENVIO) {
    ultimoEnvio = agora;
    bufferizarLeitura();
    despacharBuffer();
  }

  // Buzzer roda a cada passagem para não perder o timing dos beeps
  atualizarBuzzer();
}

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
// do SEU timestamp, senão o InfluxDB carimbaria tudo com a hora do reenvio.
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
void bufferizarLeitura() {
  char item[128];

  if (ntpOk) {
    // Timestamp em SEGUNDOS — o servidor converte para nanossegundos
    long ts = (long)time(nullptr);
    snprintf(item, sizeof(item),
             "{\"nivel_agua\":%.3f,\"pressao\":%.3f,\"temperatura\":%.2f,\"ts\":%ld}",
             nivelAgua, pressao, temperatura, ts);
  } else {
    snprintf(item, sizeof(item),
             "{\"nivel_agua\":%.3f,\"pressao\":%.3f,\"temperatura\":%.2f}",
             nivelAgua, pressao, temperatura);
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

// ===== FUNÇÃO: LER SENSOR =====
void lerSensor() {
  temperatura = bmp.readTemperature();
  pressao = bmp.readPressure() / 100.0;
  // Conversão simulada pressão → nível d'água (ver nota no topo)
  nivelAgua = NIVEL_REF + (pressao - PRESSAO_REF) / SIM_ESCALA;
  if (nivelAgua < 0) nivelAgua = 0;
}

// ===== FUNÇÃO: DETERMINAR NÍVEL DE ALERTA =====
// Lógica correta de piezômetro: nível d'água ALTO = perigo (saturação).
void determinarAlerta() {
  if (nivelAgua < NIVEL_ATENCAO) {
    nivelAlerta = "NORMAL";
    corAtual = 0; // Verde
  }
  else if (nivelAgua < NIVEL_CRITICO) {
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
  Serial.print(nivelAgua, 2);
  Serial.println(" m");

  Serial.print("📊 Pressão:      ");
  Serial.print(pressao, 1);
  Serial.println(" hPa");

  Serial.print("📊 Temperatura:  ");
  Serial.print(temperatura, 1);
  Serial.println(" °C");

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
void mostrarDisplay() {
  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("SAMARCO PIEZOMETRO");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 15);
  display.print("Nivel: ");
  display.print(nivelAgua, 2);
  display.print(" m");

  display.setCursor(0, 25);
  display.print("Press: ");
  display.print(pressao, 1);
  display.print(" hPa");

  display.setCursor(0, 35);
  display.print("Temp: ");
  display.print(temperatura, 1);
  display.print(" C  ");
  display.print(wifiOk ? "WiFi:OK" : "WiFi:--");

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
void mostrarTelaInicio() {
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

/*
 * ============================================================================
 * COMO TESTAR NO WOKWI:
 * ============================================================================
 * Clique no BMP180 durante a simulação e mova o slider de PRESSÃO
 * (a escala didática converte 10 hPa em 1 m de nível d'água):
 *
 * 1. NORMAL  (verde):    1013 hPa → nível 10,0 m
 * 2. ATENÇÃO (amarelo):  1035 hPa → nível 12,2 m  (beep a cada 2 s)
 * 3. CRÍTICO (vermelho): 1065 hPa → nível 15,2 m  (LED pisca + beep rápido)
 *
 * O dashboard usa os MESMOS limiares (12 m / 15 m) e o servidor dispara
 * Telegram/SMS nas transições de nível — veja o README.
 *
 * TESTE DO STORE & FORWARD: pause a simulação por ~1 min (ou desligue o
 * WiFi) e observe no Serial o buffer acumulando; ao reconectar, todas as
 * leituras retidas são enviadas de uma vez (JSON) ao servidor, com seus
 * timestamps originais, que por sua vez grava tudo no InfluxDB.
 * ============================================================================
 */
