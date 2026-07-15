
// ===== CREDENCIAIS (preencha antes de usar!) =====
#define WIFI_SSID   "SEU-WIFI-2G4"
#define WIFI_PASS   "SENHA-DO-WIFI"
#define SERVER_URL  "https://piezometro-worker.willianloopes123.workers.dev/ingest"
#define DEVICE_KEY  "troque-esta-chave"   // mesma DEVICE_KEY do secret do Worker
#define MEASUREMENT "telemetria_samarco"
#define PIEZOMETRO_ID "PZ-01"

// ===== SENSOR ULTRASSÔNICO HC-SR04 =====
#define PIN_TRIG 5
#define PIN_ECHO 18   // ⚠️ via divisor de tensão 1k/2k (echo é 5V!)
// Escala da demo: mão fazendo o papel da água (ver cabeçalho)
#define ALTURA_REF_CM   40.0   // "fundo" virtual: mão a 40 cm = nível 0
#define ESCALA_M_POR_CM  0.5   // 1 cm = 0,5 m equivalentes
// Faixa útil do HC-SR04 (diferente do JSN: zona morta é ~2 cm, não 25)
#define DIST_MIN_CM  3.0
#define DIST_MAX_CM  400.0

// ===== LIMIARES DE NÍVEL (m) — os mesmos do Worker e do dashboard =====
#define NIVEL_ATENCAO 12.0
#define NIVEL_CRITICO 15.0

// Núcleo comum (WiFi, NTP, buffer/store&forward, envio, alertas, OLED)
#include "piezometro_core.h"

// ===== VARIÁVEIS DO ADAPTER (para display/serial) =====
float distanciaCm = 0;   // última distância medida (sensor → mão)

// ===== HOOK: INICIALIZAR SENSOR =====
void initSensor() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);

  Serial.println("Sensor HC-SR04 pronto (TRIG/ECHO configurados) — modo DEMO.");
}

// ===== UMA MEDIÇÃO BRUTA (cm) =====
float medirDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  unsigned long duracao = pulseIn(PIN_ECHO, HIGH, 30000UL); // timeout 30 ms
  if (duracao == 0) return 0;
  return duracao / 58.0; // µs → cm
}

// ===== DISTÂNCIA POR MEDIANA (5 leituras, descarta fora da faixa útil) =====
float medirDistanciaMedianaCm() {
  float leituras[5];
  int n = 0;

  for (int i = 0; i < 5; i++) {
    float d = medirDistanciaCm();
    if (d >= DIST_MIN_CM && d <= DIST_MAX_CM) {
      leituras[n++] = d;
    }
    delay(30);
  }

  if (n == 0) return -1.0;

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

// ===== HOOK: LER SENSOR =====
Leitura lerSensor() {
  float distancia = medirDistanciaMedianaCm();

  if (distancia < 0) {
    // Sem eco válido (nada na frente do sensor até 4 m): na demo isso é o
    // estado de descanso — trata como nível 0, leitura válida, para o
    // dashboard não acusar instrumento mudo enquanto ninguém demonstra.
    distanciaCm = -1;
    Leitura l;
    l.nivel = 0;
    l.pressao = 0;
    l.temperatura = 0;
    l.temPressao = false;
    l.temTemperatura = false;
    l.valida = true;
    return l;
  }

  distanciaCm = distancia;

  float nivel_cm = ALTURA_REF_CM - distanciaCm;
  if (nivel_cm < 0) nivel_cm = 0;

  Leitura l;
  l.nivel = nivel_cm * ESCALA_M_POR_CM;
  l.pressao = 0;
  l.temperatura = 0;
  l.temPressao = false;
  l.temTemperatura = false;
  l.valida = true;
  return l;
}

// ===== HOOK: LINHAS EXTRAS NO DISPLAY OLED =====
void linhasExtrasDisplay(Adafruit_SSD1306 &d) {
  d.setCursor(0, 25);
  d.print("Dist: ");
  if (distanciaCm < 0) d.print("---");
  else { d.print(distanciaCm, 1); d.print("cm"); }

  d.setCursor(0, 35);
  d.print("DEMO ");
  d.print(wifiOk ? "WiFi:OK" : "WiFi:--");
}

// ===== HOOK: LINHAS EXTRAS NO SERIAL =====
void linhasExtrasSerial() {
  Serial.print("Distancia medida: ");
  if (distanciaCm < 0) Serial.println("(sem eco)");
  else { Serial.print(distanciaCm, 1); Serial.println(" cm"); }
}

// ===== SETUP / LOOP =====
void setup() {
  initSensor();
  coreSetup();
}

void loop() {
  coreLoop();
}
