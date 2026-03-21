// ═══════════════════════════════════════════════════════════════════
// oled_display.cpp — SSD1306 128x64 OLED Display Implementation
// Uses Adafruit SSD1306 + Adafruit GFX libraries.
// Non-blocking: max refresh once per 100ms via millis() guard.
// ═══════════════════════════════════════════════════════════════════
#include "oled_display.h"
#include "config.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

static Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
static unsigned long lastUpdateMs = 0;
static const unsigned long DISPLAY_REFRESH_MS = 100;

void oledInit() {
  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("STATUS:OLED SSD1306 allocation failed");
    return;
  }

  // ── Startup splash screen ──────────────────────────────────────
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // "AUTONIX" — large text centered
  display.setTextSize(2);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds("AUTONIX", 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 16);
  display.print("AUTONIX");

  // "INSNAPERZ" — small text below
  display.setTextSize(1);
  display.getTextBounds("INSNAPERZ", 0, 0, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 42);
  display.print("INSNAPERZ");

  display.display();
  delay(2000);
  display.clearDisplay();
  display.display();

  Serial.println("STATUS:OLED initialized");
}

void updateDisplay(int freq, float distance,
                   int radarAngle, bool fireDetected,
                   bool weaponActive) {
  unsigned long now = millis();
  if (now - lastUpdateMs < DISPLAY_REFRESH_MS) {
    return; // Rate-limit display updates
  }
  lastUpdateMs = now;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  // ── Line 1: Status header ──────────────────────────────────────
  display.setCursor(0, 0);
  display.print("AUTONIX");
  if (fireDetected) {
    display.setCursor(72, 0);
    display.print("[FIRE!]");
  } else {
    display.setCursor(72, 0);
    display.print("[SAFE] ");
  }

  // ── Line 2: Frequency ─────────────────────────────────────────
  display.setCursor(0, 14);
  display.print("FREQ: ");
  if (weaponActive && freq > 0) {
    display.print(freq);
    display.print("Hz");
  } else {
    display.print("--");
  }

  // ── Line 3: Distance ──────────────────────────────────────────
  display.setCursor(0, 26);
  display.print("DIST: ");
  if (distance < 999.0f) {
    display.print((int)distance);
    display.print("cm");
  } else {
    display.print("---cm");
  }

  // ── Line 4: Radar angle ───────────────────────────────────────
  display.setCursor(0, 38);
  display.print("RADAR: ");
  display.print(radarAngle);
  display.print("deg");

  // ── Line 5: Radar progress bar ────────────────────────────────
  // Fills 0→128px proportionally based on radar angle (0–180)
  int barWidth = map(radarAngle, 0, 180, 0, SCREEN_WIDTH);
  display.drawRect(0, 54, SCREEN_WIDTH, 8, SSD1306_WHITE);
  if (barWidth > 0) {
    display.fillRect(0, 54, barWidth, 8, SSD1306_WHITE);
  }

  display.display();
}
