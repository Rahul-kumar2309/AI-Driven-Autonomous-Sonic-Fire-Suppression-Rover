// ═══════════════════════════════════════════════════════════════════
// uart_cam_bridge.cpp — UART2 Bridge to ESP32-CAM Implementation
// Dev Kit GPIO16 (RX2) ← CAM TX
// Dev Kit GPIO17 (TX2) → CAM RX
// ═══════════════════════════════════════════════════════════════════
#include "uart_cam_bridge.h"
#include "config.h"
#include "Arduino.h"

void camBridgeInit() {
  Serial2.begin(CAM_SERIAL_BAUD, SERIAL_8N1, CAM_SERIAL_RX, CAM_SERIAL_TX);
  delay(100);
  Serial.println("STATUS:CAM bridge UART2 initialized");
}

void sendToCam(String message) {
  Serial2.println(message);
}

String readFromCam() {
  if (Serial2.available()) {
    return Serial2.readStringUntil('\n');
  }
  return "";
}
