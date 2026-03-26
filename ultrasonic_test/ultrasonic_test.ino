// ═══════════════════════════════════════════════════════════════════
// AUTONIX — Ultrasonic Sensor Test Sketch
// Reads HC-SR04 distance and pushes to Supabase live_metrics table.
// Dashboard reads it in real-time via Supabase Realtime.
//
// WIRING:
//   HC-SR04 VCC  → ESP32 5V (or Vin)
//   HC-SR04 GND  → ESP32 GND
//   HC-SR04 TRIG → ESP32 GPIO 5
//   HC-SR04 ECHO → ESP32 GPIO 18
//
// REQUIRED LIBS: WiFi (built-in), HTTPClient (built-in)
// ═══════════════════════════════════════════════════════════════════

#include <WiFi.h>
#include <HTTPClient.h>
#include <Arduino.h>

// ── FILL THESE IN BEFORE UPLOADING ───────────────────────────────
const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL   = "https://zwahvtpzgxyhrhlgutyt.supabase.co";
const char* SUPABASE_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3YWh2dHB6Z3h5aHJobGd1dHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTI2NjAsImV4cCI6MjA4OTYyODY2MH0.VQMhNRSxIvSRDsuGEL57vizRvq6LQHR-61HhpKIhnYs";
const char* DEVICE_ID      = "rover_01";
// ──────────────────────────────────────────────────────────────────

// ── PIN DEFINITIONS ───────────────────────────────────────────────
#define TRIG_PIN  5
#define ECHO_PIN 18

// ── TIMING ────────────────────────────────────────────────────────
#define SEND_INTERVAL_MS 1000   // Push data every 1 second

unsigned long lastSendMs = 0;

// ─────────────────────────────────────────────────────────────────
float readDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 999.0;   // out of range / timeout

  return duration * 0.034 / 2.0;
}

// ── Determine status label from distance ─────────────────────────
const char* getStatus(float dist) {
  if (dist <= 40)  return "critical";
  if (dist <= 100) return "warning";
  return "nominal";
}

// ── Push metric to Supabase via HTTP POST ─────────────────────────
void pushToSupabase(float distanceCm) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Not connected — skipping send");
    return;
  }

  const char* status = getStatus(distanceCm);

  // Build JSON payload
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"metric_name\":\"target_distance_cm\",";
  payload += "\"metric_value\":" + String(distanceCm, 1) + ",";
  payload += "\"unit\":\"cm\",";
  payload += "\"status\":\"" + String(status) + "\"";
  payload += "}";

  // Build full REST URL (upsert into live_metrics)
  String url = String(SUPABASE_URL) + "/rest/v1/live_metrics";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer",        "return=minimal");

  int code = http.POST(payload);

  if (code == 201 || code == 200) {
    Serial.print("[Supabase] OK  dist=");
    Serial.print(distanceCm, 1);
    Serial.print("cm  status=");
    Serial.println(status);
  } else {
    Serial.print("[Supabase] ERROR HTTP ");
    Serial.println(code);
  }

  http.end();
}

// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  // Connect to Wi-Fi
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - t > 15000) {
      Serial.println("\n[WiFi] TIMEOUT — restarting");
      ESP.restart();
    }
  }

  Serial.println();
  Serial.print("[WiFi] Connected — IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("[AUTONIX] Ultrasonic test started. Sending to dashboard...");
}

// ─────────────────────────────────────────────────────────────────
void loop() {
  float dist = readDistanceCM();

  // Always print to Serial Monitor
  if (dist >= 999.0) {
    Serial.println("[Sensor] Out of range (>5m)");
  } else {
    Serial.print("[Sensor] Distance: ");
    Serial.print(dist, 1);
    Serial.println(" cm");
  }

  // Push to Supabase at the configured interval
  unsigned long now = millis();
  if (now - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = now;
    if (dist < 999.0) {
      pushToSupabase(dist);
    }
  }

  delay(200);   // Read sensor 5x per second, push 1x per second
}
