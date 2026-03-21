// ═══════════════════════════════════════════════════════════════════
// oled_display.h — SSD1306 OLED Display
// ═══════════════════════════════════════════════════════════════════
#pragma once

void oledInit();
void updateDisplay(int freq, float distance,
                   int radarAngle, bool fireDetected,
                   bool weaponActive);
