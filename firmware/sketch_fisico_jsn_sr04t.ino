/*
 * ============================================================================
 * SAMARCO — MONITORAMENTO ONLINE DO NÍVEL DE ÁGUA EM PIEZÔMETROS
 * ESP32 + JSN-SR04T (ultrassônico) + OLED + LEDS + BUZZER + SERVIDOR (JSON)
 * + STORE&FORWARD  —  FIRMWARE PARA HARDWARE REAL (protótipo físico)
 * ============================================================================
 *
 * ⚠️ ESTE ARQUIVO É PARA A MAQUETE FÍSICA (ESP32 real + sensor real).
 * A simulação no Wokwi continua usando firmware/sketch.ino (com o BMP180
 * como stand-in de pressão). Aqui o "stand-in" sai de cena: o nível d'água
 * vem de um sensor ultrassônico JSN-SR04T medindo a distância até a água
 * dentro de um tubo de PVC (ou balde) — uma maquete em escala reduzida do
 * piezômetro real.
 *
 * MONTAGEM FÍSICA (ver docs/PROTOTIPO_FISICO.md para o passo a passo):
 * O sensor fica fixado no TOPO do tubo/balde, apontando para baixo, para a
 * superfície da água. Ele mede a distância até a água; quanto MAIS a água
 * sobe, MENOR a distância medida — por isso o nível é calculado por
 * subtração: nivel_cm = ALTURA_SENSOR_CM - distancia_medida_cm.
 *
 *        ┌────────────┐  ← sensor JSN-SR04T (topo do tubo, apontando p/ baixo)
 *        │   TRIG/ECHO │
 *        └──────┬─────┘
 *               │  distancia (medida)
 *               │
 *        ╔══════▼══════╗  ← ALTURA_SENSOR_CM (distância do sensor ao FUNDO)
 *        ║             ║
 *        ║  ~~~~~~~~~~ ║  ← superfície da água (nivel_cm = altura - distancia)
 *        ║             ║
 *        ╚═════════════╝  ← fundo do tubo/balde
 *
 * ⚠️ DIVISOR DE TENSÃO NO ECHO: o JSN-SR04T opera em 5V e o pino ECHO
 * devolve um pulso em 5V — mas as GPIOs do ESP32 só toleram 3,3V! É
 * OBRIGATÓRIO usar um divisor resistivo entre o ECHO do sensor e o GPIO18:
 *   ECHO (5V) ──[ 1kΩ ]──┬── GPIO18 (ESP32)
 *                        │
 *                      [ 2kΩ ]
 *                        │
 *                       GND
 * Isso reduz o pulso de 5V para ~3,3V (regra do divisor: 5V × 2k/(1k+2k) ≈
 * 3,3V). TRIG pode ir direto ao GPIO5 (o ESP32 já manda 3,3V, e o sensor
 * reconhece HIGH acima de ~2V).
 *
 * ⚠️ ZONA MORTA DO JSN-SR04T: o sensor não mede distâncias menores que
 * ~20–25 cm de forma confiável (a onda ainda não "descolou" do transdutor).
 * Por isso o sensor DEVE ficar montado a pelo menos 25 cm de altura acima
 * do nível MÁXIMO de água esperado no tubo — senão, quando a água estiver
 * alta, as leituras ficam erráticas ou somem. É por isso que descartamos
 * (na mediana) qualquer leitura < 25 cm.
 *
 * ESCALA DA MAQUETE: como o tubo/balde é pequeno, aplicamos um fator de
 * escala didático (ESCALA_M_POR_CM) para que poucos centímetros de água no
 * tubo representem metros de coluna d'água na "barragem" simulada — os
 * MESMOS limiares de alerta do sistema real (12 m / 15 m) continuam
 * valendo, só a régua física é que é menor:
 *   20 cm de água no tubo → 10,0 m equivalentes (NORMAL)
 *   24 cm de água no tubo → 12,0 m equivalentes (ATENÇÃO)
 *   30 cm de água no tubo → 15,0 m equivalentes (CRÍTICO)
 *
 * PASSO DE CALIBRAÇÃO (fazer sempre que remontar o sensor no tubo): meça
 * com uma régua/trena a distância real do sensor até o FUNDO do tubo
 * (ALTURA_SENSOR_CM) e ajuste o define abaixo antes de gravar o firmware.
 * Um erro de 1 cm na medição já desloca o nível calculado em 0,5 m.
 *
 * LÓGICA DE ALERTA (idêntica ao firmware de simulação — nível ALTO = perigo):
 * 🟢 NORMAL   : nível < 12 m           → LED Verde, buzzer OFF
 * 🟡 ATENÇÃO  : 12 m ≤ nível < 15 m    → LED Amarelo, beep lento (2 s)
 * 🔴 CRÍTICO  : nível ≥ 15 m           → LED Vermelho pisca, beep rápido
 *
 * ENVIO: assim como no firmware de simulação, este ESP32 não fala direto
 * com nenhum banco de dados — ele não guarda nenhum segredo de banco,
 * apenas a DEVICE_KEY do Worker. Cada leitura vira um JSON simples, enviado
 * por HTTPS ao endpoint /ingest do Cloudflare Worker; é o Worker quem grava
 * os dados no Cloudflare D1. O JSON aqui só carrega "nivel_agua" (+ "ts"
 * quando o NTP sincronizou) — sem pressão/temperatura, pois este protótipo
 * não tem esses sensores; o Worker aceita esses campos ausentes normalmente.
 *
 * STORE & FORWARD ("caixa-preta", conceito AquaSense): idêntico ao firmware
 * de simulação. Cada leitura recebe timestamp via NTP (em SEGUNDOS, campo
 * "ts") e entra em um buffer local. O envio ao Worker despacha o buffer
 * inteiro; se a rede/Worker falhar, os dados ficam retidos e são
 * reenviados no próximo ciclo — nenhuma leitura se perde.
 *
 * ALERTAS ATIVOS (Telegram/SMS): disparados pelo motor de alertas do
 * Cloudflare Worker (Cron Trigger, roda a cada 1 min e consulta o D1) — ver
 * README. No hardware real de campo, um módulo SIM7600 permitiria SMS
 * direto do local, sem depender do backend.
 *
 * IDENTIFICAÇÃO DO INSTRUMENTO: cada placa se identifica com um ID único
 * (configurado em PIEZOMETRO_ID, ex.: "PZ-01"), enviado no campo "piezometro"
 * — é esse ID que aparece no dashboard e nos alertas.
 *
 * CONEXÕES NA MAQUETE (ver docs/PROTOTIPO_FISICO.md para a tabela completa):
 * JSN-SR04T: VCC→5V (VIN)  GND→GND  TRIG→GPIO5  ECHO→[divisor 1k/2k]→GPIO18
 * OLED:      VCC→3V3  GND→GND  SCL→GPIO22  SDA→GPIO21
 * LEDs (resistor 220Ω): Verde→GPIO32  Amarelo→GPIO33  Vermelho→GPIO25
 * BUZZER:    (+)→GPIO26  (−)→GND
 *
 * Bibliotecas: Adafruit SSD1306, Adafruit GFX Library (nenhuma lib externa
 * é necessária para o JSN-SR04T — ele é lido com pulseIn() puro).
 * ============================================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ===== CREDENCIAIS (preencha antes de usar!) =====
#define WIFI_SSID   "SUA-REDE-WIFI"
#define WIFI_PASS   "SUA-SENHA-WIFI"
#define SERVER_URL  "https://piezometro-worker.SEU-SUBDOMINIO.workers.dev/ingest"  // endpoint /ingest do Cloudflare Worker
#define DEVICE_KEY  "troque-esta-chave"                    // mesma DEVICE_KEY definida como secret no Worker
#define MEASUREMENT "telemetria_samarco"                   // (info) rótulo interno das leituras
#define PIEZOMETRO_ID "PZ-01"   // identificador deste instrumento (PZ-01, PZ-02, ...)

// ===== SENSOR ULTRASSÔNICO JSN-SR04T =====
#define PIN_TRIG 5
#define PIN_ECHO 18   // ⚠️ via divisor de tensão (echo é 5V; ESP32 é 3,3V!)
// Montagem física (maquete): sensor fixado no TOPO do tubo, apontando para a água
#define ALTURA_SENSOR_CM 60.0   // distância do sensor ao FUNDO do tubo (medir na montagem!)
#define ESCALA_M_POR_CM  0.5    // maquete em escala: 1 cm no tubo = 0,5 m na barragem
// Com a escala padrão: 20 cm de água → 10 m (normal) · 24 cm → 12 m (atenção)
// · 30 cm → 15 m (crítico) — os mesmos limiares de sempre, ver abaixo.

// ===== LIMIARES DE NÍVEL (m) — espelhados em index.html e no Cloudflare Worker =====
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
#define INTERVALO_ENVIO   10000UL   // envio ao backend (Cloudflare Worker)

// ===== STORE & FORWARD =====
#define BUFFER_MAX 120              // ~20 min de leituras retidas sem rede

// ===== OBJETOS =====
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ===== VARIÁVEIS GLOBAIS =====
float distanciaCm = 0;   // última distância medida pelo sensor (sensor → água)
float nivelCm = 0;       // nível real de água dentro do tubo/balde (cm)
float nivelAgua = 0;     // nível equivalente (m) — o que vai para telemetria/alerta

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
  Serial.println("  Protótipo físico (JSN-SR04T)");
  Serial.println("  Telemetria + Alertas + Store & Forward");
  Serial.println("  Instrumento: " PIEZOMETRO_ID);
  Serial.println("===========================================");
  Serial.println();

  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);

  Serial.println("Testando LEDs...");
  testarLEDs();

  Serial.println("Testando buzzer...");
  testarBuzzer();

  Wire.begin(21, 22);

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
void bufferizarLeitura() {
  char item[128];

  if (ntpOk) {
    // Timestamp em SEGUNDOS
    long ts = (long)time(nullptr);
    snprintf(item, sizeof(item),
             "{\"piezometro\":\"" PIEZOMETRO_ID "\",\"nivel_agua\":%.3f,\"ts\":%ld}",
             nivelAgua, ts);
  } else {
    snprintf(item, sizeof(item),
             "{\"piezometro\":\"" PIEZOMETRO_ID "\",\"nivel_agua\":%.3f}",
             nivelAgua);
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
  client.setInsecure(); // protótipo; em produção use certificado CA

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

// ===== FUNÇÃO: UMA MEDIÇÃO BRUTA DO SENSOR (cm) =====
// Dispara um pulso de 10 µs no TRIG e mede a largura do pulso de retorno
// no ECHO. Retorna 0 se estourar o timeout (sem eco — nada refletindo).
float medirDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  unsigned long duracao = pulseIn(PIN_ECHO, HIGH, 30000UL); // timeout 30 ms
  if (duracao == 0) return 0; // sem eco dentro do timeout
  return duracao / 58.0;      // µs → cm (velocidade do som no ar)
}

// ===== FUNÇÃO: DISTÂNCIA POR MEDIANA (mais robusta a ruído/eco espúrio) =====
// Faz 5 medições espaçadas de 30 ms, descarta as fora da faixa útil
// (< 25 cm = zona morta do JSN-SR04T; > 450 cm = fora de alcance/ruído) e
// retorna a mediana das leituras válidas. Se nenhuma sobrar, retorna -1.
float medirDistanciaMedianaCm() {
  float leituras[5];
  int n = 0;

  for (int i = 0; i < 5; i++) {
    float d = medirDistanciaCm();
    if (d >= 25.0 && d <= 450.0) {
      leituras[n++] = d;
    }
    delay(30);
  }

  if (n == 0) return -1.0; // nenhuma leitura válida nesta rodada

  // Ordena (insertion sort — n é pequeno) e pega o elemento do meio
  for (int i = 1; i < n; i++) {
    float chave = leituras[i];
    int j = i - 1;
    while (j >= 0 && leituras[j] > chave) {
      leituras[j + 1] = leituras[j];
      j--;
    }
    leituras[j + 1] = chave;
  }

  return leituras[n / 2];
}

// ===== FUNÇÃO: LER SENSOR =====
void lerSensor() {
  float distancia = medirDistanciaMedianaCm();

  if (distancia < 0) {
    // Sem leitura válida nesta rodada: mantém o ÚLTIMO nível conhecido
    // (não zera! um alarme falso de "nível zero" seria pior que atrasar).
    Serial.println("⚠️ Leitura ultrassônica inválida (sem eco confiável) — mantendo último nível");
    return;
  }

  distanciaCm = distancia;

  float nivel_cm = ALTURA_SENSOR_CM - distanciaCm;
  if (nivel_cm < 0) nivel_cm = 0;

  nivelCm = nivel_cm;
  nivelAgua = nivelCm * ESCALA_M_POR_CM; // nível equivalente (m) — vai para telemetria/alerta
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
// Obs.: em buzzer passivo real, troque digitalWrite por
// tone(BUZZER, 2000) / noTone(BUZZER).
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
  Serial.print("💧 Nível d'água:  ");
  Serial.print(nivelAgua, 2);
  Serial.println(" m (equivalente)");

  Serial.print("📏 Nível no tubo: ");
  Serial.print(nivelCm, 1);
  Serial.println(" cm");

  Serial.print("📡 Distância medida: ");
  Serial.print(distanciaCm, 1);
  Serial.println(" cm");

  Serial.print("💾 Buffer:        ");
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
  display.print("Tubo: ");
  display.print(nivelCm, 1);
  display.print("cm");

  display.setCursor(0, 35);
  display.print("Dist: ");
  display.print(distanciaCm, 1);
  display.print("cm ");
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
 * COMO TESTAR NA MAQUETE FÍSICA:
 * ============================================================================
 * 1. Meça com uma régua a distância real do sensor ao fundo do tubo/balde e
 *    ajuste ALTURA_SENSOR_CM antes de gravar o firmware.
 * 2. Com o tubo VAZIO, o Serial deve mostrar distância ≈ ALTURA_SENSOR_CM e
 *    nível ≈ 0 m (confere a calibração).
 * 3. Despeje água aos poucos (jarra/copo) e observe no Serial/OLED:
 *    - até ~20 cm de água no tubo → nível 10,0 m (NORMAL, verde)
 *    - a partir de 24 cm de água  → nível 12,0 m (ATENÇÃO, amarelo, beep 2s)
 *    - a partir de 30 cm de água  → nível 15,0 m (CRÍTICO, vermelho pisca,
 *      beep rápido, e o motor de alertas do Worker dispara Telegram/SMS)
 * 4. O dashboard usa os MESMOS limiares (12 m / 15 m) do firmware de
 *    simulação — não é preciso mudar nada no Worker nem no index.html.
 *
 * TESTE DO STORE & FORWARD: desligue o WiFi do roteador/celular por ~1 min
 * e observe no Serial o buffer acumulando; ao reconectar, todas as leituras
 * retidas são enviadas de uma vez (JSON) ao Worker, com seus timestamps
 * originais, que por sua vez grava tudo no D1.
 * ============================================================================
 */
