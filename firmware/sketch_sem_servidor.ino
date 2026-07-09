/*
 * ============================================================================
 * SAMARCO — MONITORAMENTO ONLINE DO NÍVEL DE ÁGUA EM PIEZÔMETROS
 * ESP32 + BMP180 (stand-in) + OLED + LEDS + BUZZER — VERSÃO "SEM SERVIDOR"
 * (placa → InfluxDB Cloud direto · placa → Telegram direto · STORE&FORWARD)
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
 * ARQUITETURA "SEM SERVIDOR" — QUAL A DIFERENÇA PARA sketch.ino?
 * O sketch.ino (versão "com servidor") manda um JSON para o endpoint /ingest
 * do server.js (rodando no Render), que é quem fala com o InfluxDB e com o
 * Telegram — o firmware nunca guarda tokens de verdade, só a DEVICE_KEY.
 * ESTE arquivo (sketch_sem_servidor.ino) elimina o servidor: a própria placa
 * grava direto no InfluxDB Cloud (line protocol) e dispara o Telegram direto,
 * sem nenhum intermediário.
 *
 *        ┌───────────┐        ┌─────────────────────┐
 *        │   ESP32    │──────▶│   InfluxDB Cloud      │◀────┐
 *        │ (BMP180 +  │ HTTPS │  (bucket PIEZOMETRO)  │      │ token
 *        │ OLED/LED/  │ write │                       │      │ leitura
 *        │  buzzer)   │       └─────────────────────┘      │
 *        │            │                                     │
 *        │            │──────▶┌─────────────────────┐      │
 *        └───────────┘ HTTPS  │   Telegram Bot API    │  ┌───────────┐
 *                      sendMsg└─────────────────────┘  │ index.html │
 *                                                        │ (dashboard)│
 *                                                        └───────────┘
 *
 * TRADE-OFFS HONESTOS (documentar no TCC):
 *   + Não depende do Render "hibernando" (free tier dorme após inatividade,
 *     causando atraso na 1ª requisição) — a placa fala direto com o Influx.
 *   + Menos peças móveis: um serviço a menos no ar, uma dependência a menos.
 *   − O TOKEN DE ESCRITA do InfluxDB fica gravado no firmware. Qualquer
 *     pessoa com acesso físico/ao código do ESP32 pode extraí-lo e escrever
 *     lixo no bucket. Por isso: crie um token de escrita EXCLUSIVO para este
 *     dispositivo, restrito ao bucket PIEZOMETRO, e revogue-o se suspeitar de
 *     vazamento (InfluxDB → Load Data → API Tokens).
 *   − Os alertas do Telegram só disparam enquanto a placa está ligada e com
 *     WiFi — não há um "vigia" 24h olhando o banco como o server.js fazia.
 *     Se o ESP32 cair, ninguém é avisado até ele voltar (ou nunca, se a queda
 *     for definitiva).
 *   − Cada ESP32 do projeto precisaria do seu próprio token de escrita — não
 *     escala tão bem quanto centralizar no servidor.
 *
 * QUANDO USAR CADA ARQUIVO:
 *   • sketch.ino              → produção/demo "de verdade": token de escrita
 *     fica só no servidor, alertas rodam 24h mesmo com a placa desligada,
 *     mais fácil trocar de dispositivo sem tocar em tokens.
 *   • sketch_sem_servidor.ino → protótipo rápido, aula, ou quando não se quer
 *     manter/pagar um servidor: tudo roda só com a placa e as nuvens de
 *     terceiros (InfluxDB Cloud + Telegram).
 *
 * COMO CRIAR OS TOKENS NO INFLUXDB (Load Data → API Tokens):
 *   1. Token de ESCRITA (write-only no bucket PIEZOMETRO) → cole em
 *      INFLUXDB_TOKEN, abaixo. É este token que fica na placa.
 *   2. Token de SOMENTE LEITURA (read-only no bucket PIEZOMETRO) → usado no
 *      index.html do dashboard, para consultar os dados sem poder escrever.
 *   NUNCA use o mesmo token nos dois lugares.
 *
 * STORE & FORWARD ("caixa-preta", conceito AquaSense):
 * Cada leitura recebe timestamp via NTP (em segundos) e entra em um buffer
 * local já em LINE PROTOCOL (formato nativo do InfluxDB). O envio despacha o
 * buffer inteiro; se a rede ou o InfluxDB falharem, os dados ficam retidos e
 * são reenviados no próximo ciclo — nenhuma leitura se perde.
 *
 * ALERTAS ATIVOS (Telegram): disparados pela PRÓPRIA placa nas transições de
 * faixa (NORMAL↔ATENÇÃO↔CRÍTICO), com reenvio a cada 15 min enquanto o nível
 * permanecer CRÍTICO. Deixe TELEGRAM_BOT_TOKEN vazio para desativar.
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
#define WIFI_SSID       "Wokwi-GUEST"
#define WIFI_PASS       ""
// InfluxDB Cloud — dados do cluster do projeto (já preenchidos)
#define INFLUXDB_URL    "https://us-east-1-1.aws.cloud2.influxdata.com"
#define INFLUXDB_ORG    "a6d8947f7ea6219b"
#define INFLUXDB_BUCKET "PIEZOMETRO"
#define INFLUXDB_TOKEN  "COLE-AQUI-SEU-TOKEN-DE-ESCRITA"   // token com permissão de ESCRITA no bucket
#define MEASUREMENT     "telemetria_samarco"
// Telegram (opcional): deixe o token vazio para desativar os alertas
#define TELEGRAM_BOT_TOKEN ""    // ex.: "123456:ABC-DEF..." (criar com @BotFather)
#define TELEGRAM_CHAT_ID   ""    // ex.: "-100123456789"

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
#define INTERVALO_ENVIO   10000UL   // envio ao InfluxDB + verificação de alerta

// ===== STORE & FORWARD =====
#define BUFFER_MAX 120              // ~20 min de leituras retidas sem rede

// ===== ALERTAS (Telegram) =====
#define ALERT_REPEAT_MS (15UL * 60UL * 1000UL)  // reenvia CRÍTICO a cada 15 min

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

// Anti-spam do Telegram: "" = ainda não notificado (boot) — não avisa NORMAL
String ultimoNivelNotificado = "";
unsigned long ultimoCriticoNotificado = 0;

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("===========================================");
  Serial.println("  SAMARCO - NIVEL DE AGUA EM PIEZOMETROS");
  Serial.println("  Telemetria + Alertas SEM SERVIDOR");
  Serial.println("  (placa -> InfluxDB direto + Telegram direto)");
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

  // Ciclo de telemetria: bufferiza, despacha ao InfluxDB e checa alerta Telegram (a cada 10 s)
  if (agora - ultimoEnvio >= INTERVALO_ENVIO) {
    ultimoEnvio = agora;
    bufferizarLeitura();
    despacharBuffer();
    checarAlertaTelegram();
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

// ===== FUNÇÃO: BUFFERIZAR LEITURA (store & forward, em LINE PROTOCOL) =====
void bufferizarLeitura() {
  String linha = String(MEASUREMENT) + " nivel_agua=" + String(nivelAgua, 3) +
                 ",pressao=" + String(pressao, 3) +
                 ",temperatura=" + String(temperatura, 2);

  if (ntpOk) {
    // Timestamp em nanossegundos, montado como string a partir dos segundos
    // (epoch) para não perder precisão — mesmo truque do server.js.
    long ts = (long)time(nullptr);
    char tsBuf[24];
    snprintf(tsBuf, sizeof(tsBuf), "%ld000000000", ts);
    linha += " ";
    linha += tsBuf;
  }

  if (bufferCount >= BUFFER_MAX) {
    // Buffer cheio: descarta a leitura mais ANTIGA (política ring buffer)
    for (int i = 1; i < BUFFER_MAX; i++) bufferDados[i - 1] = bufferDados[i];
    bufferCount = BUFFER_MAX - 1;
    Serial.println("⚠️ Buffer cheio — leitura mais antiga descartada");
  }
  bufferDados[bufferCount++] = linha;
}

// ===== FUNÇÃO: DESPACHAR BUFFER DIRETO AO INFLUXDB =====
void despacharBuffer() {
  if (bufferCount == 0) return;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("📡 WiFi offline — %d leitura(s) retidas no buffer\n", bufferCount);
    WiFi.reconnect();
    return;
  }
  if (!ntpOk) sincronizarNTP();  // tenta recuperar o relógio quando a rede volta

  // Monta um único corpo em line protocol com todas as leituras retidas
  String body = "";
  for (int i = 0; i < bufferCount; i++) {
    body += bufferDados[i];
    if (i < bufferCount - 1) body += "\n";
  }

  WiFiClientSecure client;
  client.setInsecure(); // simulação/protótipo; em produção use certificado CA

  HTTPClient http;
  String url = String(INFLUXDB_URL) + "/api/v2/write?org=" + INFLUXDB_ORG +
               "&bucket=" + INFLUXDB_BUCKET + "&precision=ns";
  http.begin(client, url);
  http.addHeader("Authorization", String("Token ") + INFLUXDB_TOKEN);
  http.addHeader("Content-Type", "text/plain; charset=utf-8");
  http.setTimeout(8000);

  int code = http.POST(body);
  if (code == 204) {
    Serial.printf("📡 InfluxDB: %d leitura(s) gravadas (HTTP 204)\n", bufferCount);
    bufferCount = 0;  // sucesso — esvazia o buffer
  } else {
    Serial.printf("📡 InfluxDB: falha (HTTP %d) — %d leitura(s) retidas\n",
                  code, bufferCount);
  }
  http.end();
}

// ===== FUNÇÃO: NOTIFICAR TELEGRAM (direto do firmware) =====
void notificarTelegram(String texto) {
  if (String(TELEGRAM_BOT_TOKEN).length() == 0) return;  // alertas desativados
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("🔔 Telegram: WiFi offline — alerta não enviado");
    return;
  }

  // Escapa aspas e quebras de linha para não quebrar o JSON
  String escapado = texto;
  escapado.replace("\\", "\\\\");
  escapado.replace("\"", "\\\"");
  escapado.replace("\n", "\\n");

  String payload = "{\"chat_id\":\"" + String(TELEGRAM_CHAT_ID) +
                    "\",\"text\":\"" + escapado + "\"}";

  WiFiClientSecure client;
  client.setInsecure(); // simulação/protótipo; em produção use certificado CA

  HTTPClient http;
  String url = String("https://api.telegram.org/bot") + TELEGRAM_BOT_TOKEN + "/sendMessage";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int code = http.POST(payload);
  Serial.printf("🔔 Telegram: %s (HTTP %d)\n", (code == 200 ? "enviado" : "falha"), code);
  http.end();
}

// ===== FUNÇÃO: CHECAR E DISPARAR ALERTA TELEGRAM (a cada ciclo de 10 s) =====
// Mesma lógica do notificar() do server.js, só que rodando na própria placa:
// dispara na TRANSIÇÃO de faixa e reenvia CRÍTICO a cada ALERT_REPEAT_MS.
void checarAlertaTelegram() {
  unsigned long agora = millis();
  bool mudouDeFaixa   = (nivelAlerta != ultimoNivelNotificado);
  bool repetirCritico = (nivelAlerta == "CRITICO") &&
                        (agora - ultimoCriticoNotificado >= ALERT_REPEAT_MS);

  if (!mudouDeFaixa && !repetirCritico) return;

  // No boot (ultimoNivelNotificado == ""), só notifica se já começar fora do normal
  bool primeiroCiclo = (ultimoNivelNotificado == "");
  if (primeiroCiclo && nivelAlerta == "NORMAL") {
    ultimoNivelNotificado = nivelAlerta;
    return;
  }

  String emoji = (nivelAlerta == "NORMAL")  ? "🟢" :
                 (nivelAlerta == "ATENCAO") ? "🟡" : "🔴";
  String acao;
  if (nivelAlerta == "NORMAL") {
    acao = "Nível retornou à faixa segura.";
  } else if (nivelAlerta == "ATENCAO") {
    acao = "Nível acima de " + String(NIVEL_ATENCAO, 0) + " m — intensificar monitoramento.";
  } else {
    acao = "Nível acima de " + String(NIVEL_CRITICO, 0) + " m — ACIONAR EQUIPE DE GEOTECNIA!";
  }

  String texto = emoji + " SAMARCO PIEZÔMETRO — " + nivelAlerta + "\n" +
                 "Nível d'água: " + String(nivelAgua, 2) + " m\n" + acao;

  notificarTelegram(texto);

  ultimoNivelNotificado = nivelAlerta;
  if (nivelAlerta == "CRITICO") ultimoCriticoNotificado = agora;
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
 * O dashboard (index.html) consulta o InfluxDB direto com um token SOMENTE
 * LEITURA e usa os MESMOS limiares (12 m / 15 m). Os alertas do Telegram, ao
 * contrário da versão com servidor, saem direto desta placa — sem token de
 * Telegram configurado (TELEGRAM_BOT_TOKEN vazio), eles simplesmente não
 * disparam e o resto do sistema (LEDs, buzzer, OLED, InfluxDB) segue normal.
 *
 * TESTE DO STORE & FORWARD: pause a simulação por ~1 min (ou desligue o
 * WiFi) e observe no Serial o buffer acumulando; ao reconectar, todas as
 * leituras retidas são enviadas de uma vez (line protocol) direto ao
 * InfluxDB, com seus timestamps originais.
 * ============================================================================
 */
