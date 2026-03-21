// ═══════════════════════════════════════════════════════════════════
// ultrasonic.h — HC-SR04 Distance Sensor
// ═══════════════════════════════════════════════════════════════════
#pragma once

void ultrasonicInit();
float readDistanceCM();
bool isObstacleDetected();
bool isAtOptimalFireDistance();
