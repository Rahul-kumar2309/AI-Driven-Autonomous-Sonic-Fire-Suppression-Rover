// ═══════════════════════════════════════════════════════════════════
// motor_control.cpp — L298N 4WD Motor Control Implementation
// Uses ESP32 LEDC API for PWM speed control on ENA and ENB.
// ═══════════════════════════════════════════════════════════════════
#include "motor_control.h"
#include "config.h"
#include "Arduino.h"

// ── Internal helpers ──────────────────────────────────────────────

static void setLeftSpeed(int speed) {
  ledcWrite(LEDC_MOTOR_L_CH, constrain(speed, 0, 255));
}

static void setRightSpeed(int speed) {
  ledcWrite(LEDC_MOTOR_R_CH, constrain(speed, 0, 255));
}

// ── Public functions ──────────────────────────────────────────────

void motorsInit() {
  // Direction pins
  pinMode(MOTOR_L_IN1, OUTPUT);
  pinMode(MOTOR_L_IN2, OUTPUT);
  pinMode(MOTOR_R_IN3, OUTPUT);
  pinMode(MOTOR_R_IN4, OUTPUT);

  // PWM speed pins via LEDC
  pinMode(MOTOR_L_ENA, OUTPUT);
  pinMode(MOTOR_R_ENB, OUTPUT);

  ledcSetup(LEDC_MOTOR_L_CH, LEDC_MOTOR_FREQ, LEDC_MOTOR_RES);
  ledcAttachPin(MOTOR_L_ENA, LEDC_MOTOR_L_CH);

  ledcSetup(LEDC_MOTOR_R_CH, LEDC_MOTOR_FREQ, LEDC_MOTOR_RES);
  ledcAttachPin(MOTOR_R_ENB, LEDC_MOTOR_R_CH);

  stopMotors();
  Serial.println("STATUS:Motors initialized");
}

void moveForward(int speed) {
  // Left motors forward
  digitalWrite(MOTOR_L_IN1, HIGH);
  digitalWrite(MOTOR_L_IN2, LOW);
  // Right motors forward
  digitalWrite(MOTOR_R_IN3, HIGH);
  digitalWrite(MOTOR_R_IN4, LOW);
  setLeftSpeed(speed);
  setRightSpeed(speed);
}

void moveBackward(int speed) {
  // Left motors backward
  digitalWrite(MOTOR_L_IN1, LOW);
  digitalWrite(MOTOR_L_IN2, HIGH);
  // Right motors backward
  digitalWrite(MOTOR_R_IN3, LOW);
  digitalWrite(MOTOR_R_IN4, HIGH);
  setLeftSpeed(speed);
  setRightSpeed(speed);
}

void turnLeft(int speed) {
  // Left motors reverse, right motors forward
  digitalWrite(MOTOR_L_IN1, LOW);
  digitalWrite(MOTOR_L_IN2, HIGH);
  digitalWrite(MOTOR_R_IN3, HIGH);
  digitalWrite(MOTOR_R_IN4, LOW);
  setLeftSpeed(speed);
  setRightSpeed(speed);
}

void turnRight(int speed) {
  // Left motors forward, right motors reverse
  digitalWrite(MOTOR_L_IN1, HIGH);
  digitalWrite(MOTOR_L_IN2, LOW);
  digitalWrite(MOTOR_R_IN3, LOW);
  digitalWrite(MOTOR_R_IN4, HIGH);
  setLeftSpeed(speed);
  setRightSpeed(speed);
}

void stopMotors() {
  digitalWrite(MOTOR_L_IN1, LOW);
  digitalWrite(MOTOR_L_IN2, LOW);
  digitalWrite(MOTOR_R_IN3, LOW);
  digitalWrite(MOTOR_R_IN4, LOW);
  setLeftSpeed(0);
  setRightSpeed(0);
}
