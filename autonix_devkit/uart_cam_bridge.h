// ═══════════════════════════════════════════════════════════════════
// uart_cam_bridge.h — UART2 Bridge to ESP32-CAM
// ═══════════════════════════════════════════════════════════════════
#pragma once
#include "Arduino.h"

void   camBridgeInit();
void   sendToCam(String message);
String readFromCam();
