/*
 * ============================================================================
 * SISTEMA DE ALERTAS SAMARCO — BMP180 + OLED + LEDS + BUZZER + INFLUXDB
 * ============================================================================
 *
 * ⚠️ NOTA CONCEITUAL IMPORTANTE (para o TCC):
 * O BMP180 é um sensor BAROMÉTRICO — mede pressão ATMOSFÉRICA, não a pressão
 * da coluna d'água. Ele é usado aqui apenas como *stand-in* de simulação no
 * Wokwi, já que o simulador não possui transdutor piezométrico. No hardware
 * real (Fase 2), o sinal virá de um transdutor de pressão submersível
 * 4–20 mA lido por um ADC ADS1115 (ver documento AquaSense).
 *
 * Além disso, a lógica de alerta abaixo (pressão BAIXA = perigo) é a lógica
 * de um barômetro. Em um piezômetro real de barragem a lógica é INVERTIDA:
 * poro-pressão / nível d'água ALTO = perigo (saturação do maciço). Na Fase 2,
 * basta inverter as comparações em determinarAlerta().
 *
 * SISTEMA DE 3 NÍVEIS DE ALERTA (espelhado no dashboard):
 * 🟢 NORMAL   : Pressão ≥ 1010 hPa → LED Verde ON, Buzzer OFF
 * 🟡 ATENÇÃO  : 1005–1010 hPa      → LED Amarelo ON, Buzzer beep lento (2 s)
 * 🔴 CRÍTICO  : Pressão < 1005 hPa → LED Vermelho PISCA, Buzzer beep rápido
 *
 * (O Wokwi inicia o BMP180 em 1013,25 hPa — clique no sensor durante a
 *  simulação e mova o slider de pressão para testar os três níveis.)
 *
 * CONEXÕES NO WOKWI (ver firmware/diagram.json):
 *
 * BMP180:  VCC→3V3  GND→GND  SCL→GPIO22  SDA→GPIO21
 * OLED:    VCC→3V3  GND→GND  SCL→GPIO22  SDA→GPIO21
 * LEDs (com resistor 220Ω cada):
 *   Verde→GPIO32   Amarelo→GPIO33   Vermelho→GPIO25
 * BUZZER:  (+)→GPIO26  (−)→GND
 *
 * Bibliotecas (Library Manager do Wokwi):
 *   Adafruit BMP085 Library, Adafruit SSD1306, Adafruit GFX Library
 * ============================================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_BMP085.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ===== CREDENCIAIS (preencha antes de usar!) =====
#define WIFI_SSID       "Wokwi-GUEST"
#define WIFI_PASS       ""
#define INFLUXDB_URL    "https://SEU-CLUSTER.influxdata.com"   // sem barra final
#define INFLUXDB_TOKEN  "SEU-TOKEN"
#define INFLUXDB_ORG    "SUA-ORG"
#define INFLUXDB_BUCKET "PIEZOMETRO"
#define MEASUREMENT     "telemetria_samarco"   // deve bater com o dashboard!

// ===== CONFIGURAÇÕES DISPLAY OLED =====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// ===== PINOS =====
#define LED_VERDE    32
#define LED_AMARELO  33
#define LED_VERMELHO 25
#define BUZZER       26

// ===== LIMITES DE PRESSÃO (hPa) — espelhados em index.html (CFG) =====
#define PRESSAO_NORMAL  1010.0   // Acima disso = NORMAL
#define PRESSAO_ATENCAO 1005.0   // Entre 1005–1010 = ATENÇÃO; abaixo = CRÍTICO

// ===== INTERVALOS (ms) =====
#define INTERVALO_LEITURA 1000UL    // leitura local + LEDs + display
#define INTERVALO_ENVIO   10000UL   // envio ao InfluxDB

// ===== OBJETOS =====
Adafruit_BMP085 bmp;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== VARIÁVEIS GLOBAIS =====
float temperatura = 0;
float pressao = 0;
float altitude = 0;

String nivelAlerta = "NORMAL";
int corAtual = 0; // 0=Verde, 1=Amarelo, 2=Vermelho

unsigned long ultimoBuzzer  = 0;
unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio   = 0;
bool estadoBuzzer = false;
bool wifiOk = false;

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("===========================================");
  Serial.println("  SAMARCO - SISTEMA DE ALERTAS");
  Serial.println("  Monitoramento de Piezômetro com Alarmes");
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

  // Ciclo de telemetria: envio ao InfluxDB (a cada 10 s)
  if (agora - ultimoEnvio >= INTERVALO_ENVIO) {
    ultimoEnvio = agora;
    enviarInfluxDB();
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
    Serial.println(" FALHOU — sistema segue com alertas locais apenas.");
  }
}

// ===== FUNÇÃO: ENVIAR AO INFLUXDB (line protocol) =====
void enviarInfluxDB() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📡 WiFi offline — envio pulado, tentando reconectar...");
    WiFi.reconnect();
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // simulação/protótipo; em produção use certificado CA

  HTTPClient http;
  String url = String(INFLUXDB_URL) +
               "/api/v2/write?org=" + INFLUXDB_ORG +
               "&bucket=" + INFLUXDB_BUCKET + "&precision=ns";

  // Line protocol: measurement campo1=v1,campo2=v2
  String body = String(MEASUREMENT) +
                " pressao="     + String(pressao, 3) +
                ",temperatura=" + String(temperatura, 2) +
                ",altitude="    + String(altitude, 2);

  http.begin(client, url);
  http.addHeader("Authorization", "Token " INFLUXDB_TOKEN);
  http.addHeader("Content-Type", "text/plain; charset=utf-8");
  http.setTimeout(8000);

  int code = http.POST(body);
  if (code == 204) {
    Serial.println("📡 InfluxDB: dados enviados (HTTP 204)");
  } else {
    Serial.print("📡 InfluxDB: falha no envio — HTTP ");
    Serial.println(code);
  }
  http.end();
}

// ===== FUNÇÃO: LER SENSOR =====
void lerSensor() {
  temperatura = bmp.readTemperature();
  pressao = bmp.readPressure() / 100.0;
  altitude = bmp.readAltitude(101325);
}

// ===== FUNÇÃO: DETERMINAR NÍVEL DE ALERTA =====
// ⚠️ Lógica de barômetro (pressão baixa = perigo). Em piezômetro real,
//    INVERTER: nível/poro-pressão alto = perigo.
void determinarAlerta() {
  if (pressao >= PRESSAO_NORMAL) {
    nivelAlerta = "NORMAL";
    corAtual = 0; // Verde
  }
  else if (pressao >= PRESSAO_ATENCAO) {
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
    // NORMAL — Verde fixo
    digitalWrite(LED_VERDE, HIGH);
  }
  else if (corAtual == 1) {
    // ATENÇÃO — Amarelo fixo
    digitalWrite(LED_AMARELO, HIGH);
  }
  else {
    // CRÍTICO — Vermelho piscando (alterna a cada ciclo de 1 s)
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
    // NORMAL — Buzzer OFF
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
      // ultimoBuzzer mantém o início do beep → próximo em +2000 ms
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
  Serial.print("📊 Temperatura: ");
  Serial.print(temperatura, 1);
  Serial.println(" °C");

  Serial.print("📊 Pressão:     ");
  Serial.print(pressao, 1);
  Serial.println(" hPa");

  Serial.print("📊 Altitude:    ");
  Serial.print(altitude, 1);
  Serial.println(" m");

  Serial.println();

  if (nivelAlerta == "NORMAL") {
    Serial.println("🟢 STATUS: NORMAL");
    Serial.println("   → Sistema operando normalmente");
  }
  else if (nivelAlerta == "ATENCAO") {
    Serial.println("🟡 STATUS: ATENÇÃO!");
    Serial.println("   → Monitorar de perto");
    Serial.println("   → Pressão se aproximando do limite");
  }
  else {
    Serial.println("🔴 STATUS: CRÍTICO!!!");
    Serial.println("   → ALERTA MÁXIMO ATIVADO!");
    Serial.println("   → Pressão abaixo do limite seguro");
    Serial.println("   → Verificar piezômetro imediatamente!");
  }

  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println();
}

// ===== FUNÇÃO: MOSTRAR NO DISPLAY OLED =====
void mostrarDisplay() {
  display.clearDisplay();

  // Título
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("SAMARCO PIEZOMETRO");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  // Dados do sensor
  display.setCursor(0, 15);
  display.print("Temp: ");
  display.print(temperatura, 1);
  display.print(" C");

  display.setCursor(0, 25);
  display.print("Press: ");
  display.print(pressao, 1);
  display.print(" hPa");

  display.setCursor(0, 35);
  display.print("Alt: ");
  display.print(altitude, 0);
  display.print(" m  ");
  display.print(wifiOk ? "WiFi:OK" : "WiFi:--");

  display.drawLine(0, 45, 128, 45, SSD1306_WHITE);

  // STATUS em destaque
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
  display.setCursor(15, 30);
  display.println("Sistema de");
  display.setCursor(25, 42);
  display.println("Alertas");

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
 * COMO TESTAR OS NÍVEIS DE ALERTA NO WOKWI:
 * ============================================================================
 *
 * Durante a simulação, clique no sensor BMP180 e mova o slider de pressão:
 *
 * 1. NORMAL (Verde):    ajuste para 1015 hPa → LED verde, buzzer OFF
 * 2. ATENÇÃO (Amarelo): ajuste para 1007 hPa → LED amarelo, beep a cada 2 s
 * 3. CRÍTICO (Vermelho): ajuste para 1000 hPa → LED vermelho pisca, beep rápido
 *
 * O dashboard (index.html) usa os MESMOS limiares — mova o slider e veja o
 * nível mudar também na página em até 10 segundos.
 * ============================================================================
 */
