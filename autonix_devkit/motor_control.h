// ═══════════════════════════════════════════════════════════════════
// motor_control.h — L298N 4WD Motor Control
// Uses ESP32 LEDC PWM for ENA/ENB speed control.
// ═══════════════════════════════════════════════════════════════════
#pragma once

void motorsInit();
void moveForward(int speed);
void moveBackward(int speed);
void turnLeft(int speed);
void turnRight(int speed);
void stopMotors();
