/**
 * =============================================================================
 * SISTEMA DE MONITORAMENTO DE PIEZÔMETRO — SAMARCO MINERAÇÃO S.A.
 * TCC SENAI — Monitoramento Online do Nível de Água em Piezômetros
 * =============================================================================
 * Hardware : ESP32 DevKit v1 + Sensor BMP180 (pressão barométrica / temperatura)
 * Conexão  : I2C (SDA=GPIO21, SCL=GPIO22)
 * Protocolo: InfluxDB Line Protocol via HTTP POST
 * Frequência: 1 leitura a cada 10 segundos
 * Buffer   : 100 leituras armazenadas em RAM (modo offline)
 * =============================================================================
 */

#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ─── CONFIGURAÇÕES — preencha antes de gravar ─────────────────────────────────
#define WIFI_SSID        "Wokwi-GUEST"
#define WIFI_PASS        ""
#define INFLUXDB_URL     "https://us-east-1-1.aws.cloud2.influxdata.com"
#define INFLUXDB_TOKEN   "SEU_TOKEN_AQUI"
#define INFLUXDB_ORG     "SAMARCO"
#define INFLUXDB_BUCKET  "PIEZOMETRO"
#define DEVICE_ID        "piezo-01"   // Identificador único do dispositivo (escala para múltiplos piezômetros)

// ─── LIMITES DE ALERTA (em hPa) ───────────────────────────────────────────────
#define PRESSAO_NORMAL   912.0   // Acima deste valor = situação normal
#define PRESSAO_ATENCAO  907.0   // Abaixo deste valor = nível de atenção
                                 // Abaixo de PRESSAO_ATENCAO = nível crítico

// ─── PINOS DOS INDICADORES VISUAIS/SONOROS ────────────────────────────────────
#define LED_VERDE     2    // LED verde  = situação normal
#define LED_AMARELO   4    // LED amarelo = atenção
#define LED_VERMELHO  5    // LED vermelho = crítico
#define BUZZER_PIN    18   // Buzzer piezoelétrico para alertas sonoros

// ─── PARÂMETROS DE TEMPORIZAÇÃO ───────────────────────────────────────────────
#define INTERVALO_LEITURA_MS   10000   // 10 segundos entre cada leitura
#define TIMEOUT_WIFI_MS        15000   // 15 s máximo para conectar ao WiFi
#define TIMEOUT_HTTP_MS         8000   // 8 s timeout para requisição HTTP
#define MAX_TENTATIVAS_WIFI        3   // Tentativas antes de aceitar modo offline

// ─── BUFFER LOCAL (modo offline) ──────────────────────────────────────────────
#define TAMANHO_BUFFER  100   // Máximo de leituras armazenadas em RAM

/**
 * Estrutura que representa uma única leitura do sensor BMP180.
 * É usada tanto para envio imediato quanto para armazenamento no buffer.
 */
struct Leitura {
  float          pressao;      // Pressão em hPa (hectopascal)
  float          temperatura;  // Temperatura em °C
  float          altitude;     // Altitude estimada em metros (ref. nível do mar)
  unsigned long  ts;           // Timestamp em milissegundos desde o boot (millis())
};

// ─── VARIÁVEIS GLOBAIS ────────────────────────────────────────────────────────
Adafruit_BMP085 bmp;                   // Instância do driver do sensor BMP180
Leitura         buffer[TAMANHO_BUFFER]; // Buffer circular de leituras offline
int             bufferInicio   = 0;    // Índice de leitura (início do buffer circular)
int             bufferContagem = 0;    // Quantidade de leituras armazenadas no buffer
unsigned long   ultimaLeituraMs = 0;   // Marca de tempo da última leitura realizada
unsigned long   tempoBootUnix   = 0;   // Estimativa de tempo Unix no momento do boot (via NTP)

// ─── DECLARAÇÕES ANTECIPADAS ──────────────────────────────────────────────────
void conectarWifi();
bool verificarConexaoWifi();
void lerSensor(Leitura &leitura);
void adicionarAoBuffer(const Leitura &leitura);
bool enviarLeitura(const Leitura &leitura);
bool enviarBuffer();
void atualizarAlertas(float pressao);
void sinalSonoro(int nivel);
String formatarLineProtocol(const Leitura &leitura, unsigned long offsetMs = 0);

// =============================================================================
// SETUP — Executado uma única vez na inicialização do ESP32
// =============================================================================
void setup() {
  Serial.begin(115200);
  Serial.println(F("\n=== SISTEMA PIEZÔMETRO SAMARCO — Iniciando... ==="));

  // Configura pinos de saída para LEDs e buzzer
  pinMode(LED_VERDE,    OUTPUT);
  pinMode(LED_AMARELO,  OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(BUZZER_PIN,   OUTPUT);

  // Indicação visual de boot: todos os LEDs piscam simultaneamente
  for (int p : {LED_VERDE, LED_AMARELO, LED_VERMELHO}) digitalWrite(p, HIGH);
  delay(500);
  for (int p : {LED_VERDE, LED_AMARELO, LED_VERMELHO}) digitalWrite(p, LOW);

  // Inicializa comunicação I2C e verifica presença do sensor BMP180
  Wire.begin();
  if (!bmp.begin()) {
    Serial.println(F("ERRO FATAL: Sensor BMP180 não encontrado. Verifique conexão I2C."));
    // Pisca LED vermelho infinitamente para sinalizar falha de hardware
    while (true) {
      digitalWrite(LED_VERMELHO, !digitalRead(LED_VERMELHO));
      delay(200);
    }
  }
  Serial.println(F("Sensor BMP180 inicializado com sucesso."));

  // Conecta ao WiFi e sincroniza relógio via NTP
  conectarWifi();

  Serial.println(F("=== Sistema pronto. Iniciando monitoramento... ===\n"));
}

// =============================================================================
// LOOP PRINCIPAL — Ciclo contínuo de leitura, alerta e envio
// =============================================================================
void loop() {
  unsigned long agora = millis();

  // Aguarda o intervalo configurado (sem uso de delay() bloqueante)
  if (agora - ultimaLeituraMs < INTERVALO_LEITURA_MS) {
    delay(100);
    return;
  }
  ultimaLeituraMs = agora;

  // Realiza leitura do sensor BMP180
  Leitura leitura;
  lerSensor(leitura);

  // Atualiza indicadores visuais e sonoros conforme o nível de pressão
  atualizarAlertas(leitura.pressao);

  // Exibe leitura atual no monitor serial (útil para depuração)
  Serial.printf("[%lu ms] Pressão: %.2f hPa | Temp: %.1f °C | Alt: %.0f m\n",
    agora, leitura.pressao, leitura.temperatura, leitura.altitude);

  // Verifica conectividade antes de tentar enviar
  if (verificarConexaoWifi()) {
    // Se há leituras pendentes no buffer, envia em lote primeiro (prioridade)
    if (bufferContagem > 0) {
      Serial.printf("Enviando %d leitura(s) em buffer para o InfluxDB...\n", bufferContagem);
      if (enviarBuffer()) {
        Serial.println(F("Buffer enviado com sucesso. Leituras sincronizadas."));
      } else {
        Serial.println(F("Falha ao enviar buffer — mantendo leituras para próxima tentativa."));
      }
    }
    // Envia a leitura atual
    if (!enviarLeitura(leitura)) {
      Serial.println(F("Falha no envio — armazenando no buffer local."));
      adicionarAoBuffer(leitura);
    }
  } else {
    // Sem conectividade: armazena no buffer circular para envio posterior
    Serial.println(F("Sem conectividade — armazenando no buffer local."));
    adicionarAoBuffer(leitura);
    Serial.printf("Buffer: %d/%d leituras armazenadas.\n", bufferContagem, TAMANHO_BUFFER);
  }
}

// =============================================================================
// FUNÇÕES DE REDE
// =============================================================================

/**
 * Conecta o ESP32 à rede WiFi configurada.
 * Exibe progresso no Serial e tenta até MAX_TENTATIVAS_WIFI vezes.
 * Ao conectar, sincroniza o relógio via NTP para timestamps precisos.
 */
void conectarWifi() {
  Serial.printf("Conectando ao WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long inicio   = millis();
  int           tentativas = 0;

  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - inicio > TIMEOUT_WIFI_MS) {
      tentativas++;
      Serial.printf("\nTimeout (tentativa %d/%d)\n", tentativas, MAX_TENTATIVAS_WIFI);
      if (tentativas >= MAX_TENTATIVAS_WIFI) {
        Serial.println(F("Não foi possível conectar. Modo offline ativado."));
        return;
      }
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      inicio = millis();
    }
    delay(500);
    Serial.print('.');
  }

  Serial.printf("\nWiFi conectado! IP: %s\n", WiFi.localIP().toString().c_str());

  // Sincroniza relógio via NTP (fuso horário: UTC-3 para horário de Brasília)
  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  struct tm ti;
  if (getLocalTime(&ti, 5000)) {
    tempoBootUnix = (unsigned long)mktime(&ti) - millis() / 1000;
    Serial.println(F("Relógio NTP sincronizado com sucesso."));
  } else {
    Serial.println(F("Aviso: NTP não sincronizado. Usando millis() como referência."));
  }
}

/**
 * Verifica se o WiFi está conectado e tenta reconectar automaticamente em caso de queda.
 * Esta função é chamada a cada ciclo de leitura para garantir resiliência de rede.
 *
 * @return true se conectado e pronto para envio, false se em modo offline
 */
bool verificarConexaoWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.println(F("WiFi desconectado! Tentando reconexão automática..."));
  WiFi.disconnect();
  WiFi.reconnect();

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI_MS) {
    delay(500);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\nReconexão WiFi bem-sucedida!"));
    return true;
  }

  Serial.println(F("\nReconexão falhou. Continuando em modo offline."));
  return false;
}

// =============================================================================
// FUNÇÕES DO SENSOR
// =============================================================================

/**
 * Realiza leitura dos três campos do BMP180 e preenche a estrutura Leitura.
 * A pressão é convertida de Pa para hPa (÷100).
 * A altitude usa a pressão ao nível do mar padrão (1013.25 hPa) como referência.
 *
 * @param leitura Referência para a estrutura a ser preenchida com os dados lidos
 */
void lerSensor(Leitura &leitura) {
  leitura.pressao     = bmp.readPressure() / 100.0F; // Pascals → hPa
  leitura.temperatura = bmp.readTemperature();         // °C
  leitura.altitude    = bmp.readAltitude(1013.25F);   // metros
  leitura.ts          = millis();
}

// =============================================================================
// FUNÇÕES DO BUFFER LOCAL (modo offline)
// =============================================================================

/**
 * Adiciona uma leitura ao buffer circular local.
 * Se o buffer estiver cheio (TAMANHO_BUFFER leituras), a mais antiga é descartada (FIFO).
 * Isso garante que as leituras mais recentes sejam sempre preservadas.
 *
 * @param leitura Leitura a ser armazenada no buffer
 */
void adicionarAoBuffer(const Leitura &leitura) {
  if (bufferContagem < TAMANHO_BUFFER) {
    // Ainda há espaço: adiciona ao final
    int pos = (bufferInicio + bufferContagem) % TAMANHO_BUFFER;
    buffer[pos] = leitura;
    bufferContagem++;
  } else {
    // Buffer cheio: sobrescreve a posição mais antiga (avança o início)
    buffer[bufferInicio] = leitura;
    bufferInicio = (bufferInicio + 1) % TAMANHO_BUFFER;
    Serial.println(F("Aviso: buffer cheio — leitura mais antiga descartada."));
  }
}

/**
 * Envia todas as leituras do buffer em uma única requisição HTTP (batch write).
 * Cada leitura é formatada como uma linha no InfluxDB Line Protocol.
 * O buffer é limpo apenas após confirmação de sucesso (HTTP 204).
 *
 * @return true se o envio foi confirmado pelo InfluxDB, false em caso de erro
 */
bool enviarBuffer() {
  if (bufferContagem == 0) return true;

  // Monta o payload com todas as leituras (uma por linha)
  String payload = "";
  for (int i = 0; i < bufferContagem; i++) {
    int pos = (bufferInicio + i) % TAMANHO_BUFFER;
    // Calcula o deslocamento temporal em relação ao momento atual
    unsigned long offsetMs = millis() - buffer[pos].ts;
    payload += formatarLineProtocol(buffer[pos], offsetMs);
    payload += "\n";
  }

  HTTPClient http;
  String url = String(INFLUXDB_URL) + "/api/v2/write?org=" +
               String(INFLUXDB_ORG) + "&bucket=" + String(INFLUXDB_BUCKET) +
               "&precision=ms";

  http.begin(url);
  http.addHeader("Authorization", String("Token ") + INFLUXDB_TOKEN);
  http.addHeader("Content-Type", "text/plain; charset=utf-8");
  http.setTimeout(TIMEOUT_HTTP_MS);

  int httpCode = http.POST(payload);
  http.end();

  if (httpCode == 204 || httpCode == 200) {
    // Limpeza do buffer somente após confirmação de sucesso
    bufferInicio   = 0;
    bufferContagem = 0;
    return true;
  }

  Serial.printf("Erro ao enviar buffer: HTTP %d\n", httpCode);
  return false;
}

// =============================================================================
// FUNÇÕES DE ENVIO PARA O INFLUXDB
// =============================================================================

/**
 * Envia uma única leitura para o InfluxDB Cloud via HTTP POST.
 * Usa o protocolo InfluxDB Line Protocol no endpoint /api/v2/write.
 *
 * @param leitura Leitura a ser enviada
 * @return true se HTTP 204 (sem conteúdo, sucesso), false em caso de falha
 */
bool enviarLeitura(const Leitura &leitura) {
  HTTPClient http;
  String url = String(INFLUXDB_URL) + "/api/v2/write?org=" +
               String(INFLUXDB_ORG) + "&bucket=" + String(INFLUXDB_BUCKET) +
               "&precision=ms";

  String payload = formatarLineProtocol(leitura);

  http.begin(url);
  http.addHeader("Authorization", String("Token ") + INFLUXDB_TOKEN);
  http.addHeader("Content-Type", "text/plain; charset=utf-8");
  http.setTimeout(TIMEOUT_HTTP_MS);

  int httpCode = http.POST(payload);
  http.end();

  if (httpCode == 204 || httpCode == 200) {
    Serial.printf("Enviado com sucesso (HTTP %d)\n", httpCode);
    return true;
  }

  Serial.printf("Erro ao enviar leitura: HTTP %d\n", httpCode);
  return false;
}

/**
 * Formata uma leitura no InfluxDB Line Protocol.
 *
 * Formato resultante:
 *   telemetria_samarco,device_id=piezo-01,nivel=normal pressao=912.340,temperatura=25.60,altitude=800.0 1711638400000
 *
 * Tags (indexadas para queries rápidas):
 *   - device_id: permite escalar para múltiplos piezômetros futuramente
 *   - nivel: classificação de alerta pré-calculada no firmware
 *
 * @param leitura  Dados do sensor a serem formatados
 * @param offsetMs Deslocamento temporal em ms (para leituras históricas do buffer)
 * @return String no formato Line Protocol pronta para envio
 */
String formatarLineProtocol(const Leitura &leitura, unsigned long offsetMs) {
  // Calcula timestamp Unix em milissegundos
  unsigned long tsMs;
  if (tempoBootUnix > 0) {
    tsMs = (tempoBootUnix * 1000UL) + leitura.ts - offsetMs;
  } else {
    // Fallback quando o NTP não está disponível: usa millis() desde o boot
    tsMs = leitura.ts - offsetMs;
  }

  // Determina o nível de alerta com base na pressão atual
  String nivel;
  if      (leitura.pressao >= PRESSAO_NORMAL)  nivel = "normal";
  else if (leitura.pressao >= PRESSAO_ATENCAO) nivel = "atencao";
  else                                          nivel = "critico";

  // Monta a linha no Line Protocol
  String line = "telemetria_samarco";
  line += ",device_id=" + String(DEVICE_ID);
  line += ",nivel="     + nivel;
  line += " pressao="      + String(leitura.pressao, 3);
  line += ",temperatura="  + String(leitura.temperatura, 2);
  line += ",altitude="     + String(leitura.altitude, 1);
  line += " "              + String(tsMs);

  return line;
}

// =============================================================================
// FUNÇÕES DE ALERTA (LEDs + Buzzer)
// =============================================================================

/**
 * Atualiza os indicadores visuais (LEDs) e sonoros (buzzer) de acordo com
 * o valor atual de pressão medido pelo BMP180.
 *
 * Tabela de níveis:
 *   Normal  (≥ 912 hPa) → LED verde estático, silêncio
 *   Atenção (907–912 hPa) → LED amarelo estático, 1 bip suave
 *   Crítico (< 907 hPa)  → LED vermelho piscando, bips contínuos
 *
 * @param pressao Valor atual da pressão em hPa
 */
void atualizarAlertas(float pressao) {
  // Desliga todos os indicadores antes de atualizar o estado
  digitalWrite(LED_VERDE,    LOW);
  digitalWrite(LED_AMARELO,  LOW);
  digitalWrite(LED_VERMELHO, LOW);
  noTone(BUZZER_PIN);

  if (pressao >= PRESSAO_NORMAL) {
    // NORMAL: LED verde estático, sem alarme sonoro
    digitalWrite(LED_VERDE, HIGH);

  } else if (pressao >= PRESSAO_ATENCAO) {
    // ATENÇÃO: LED amarelo, 1 bip suave para chamar atenção do operador
    digitalWrite(LED_AMARELO, HIGH);
    sinalSonoro(1);

  } else {
    // CRÍTICO: LED vermelho piscando 3x + bip duplo intenso
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_VERMELHO, HIGH);
      sinalSonoro(2);
      delay(100);
      digitalWrite(LED_VERMELHO, LOW);
      delay(100);
    }
    digitalWrite(LED_VERMELHO, HIGH); // Mantém aceso após sequência de piscar
  }
}

/**
 * Emite sinal sonoro no buzzer piezoelétrico.
 *
 * @param nivel 1 = bip único suave (atenção), 2 = bip duplo intenso (crítico)
 */
void sinalSonoro(int nivel) {
  if (nivel == 1) {
    tone(BUZZER_PIN, 1000, 100); // 1 kHz por 100 ms
    delay(150);
  } else {
    tone(BUZZER_PIN, 2000, 80);  // Bip 1: 2 kHz por 80 ms
    delay(120);
    noTone(BUZZER_PIN);
    tone(BUZZER_PIN, 2000, 80);  // Bip 2: 2 kHz por 80 ms
    delay(120);
  }
  noTone(BUZZER_PIN);
}
