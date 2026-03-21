// ═══════════════════════════════════════════════════════════════════
// ultrasonic.cpp — HC-SR04 Distance Sensor Implementation
// ═══════════════════════════════════════════════════════════════════
#include "ultrasonic.h"
#include "config.h"
#include "Arduino.h"

void ultrasonicInit() {
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);
  digitalWrite(ULTRASONIC_TRIG, LOW);
  Serial.println("STATUS:Ultrasonic initialized");
}

float readDistanceCM() {
  // Ensure trigger is LOW before pulse
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);

  // Send 10µs HIGH pulse
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);

  // Measure echo pulse — 30000µs timeout (~5m max range)
  unsigned long duration = pulseIn(ULTRASONIC_ECHO, HIGH, 30000);

  if (duration == 0) {
    return 999.0f;  // Timeout — out of range
  }

  // Convert: speed of sound ≈ 0.034 cm/µs, divide by 2 for round-trip
  float distanceCM = duration * 0.034f / 2.0f;
  return distanceCM;
}

bool isObstacleDetected() {
  return readDistanceCM() < (float)OBSTACLE_STOP_DIST_CM;
}

bool isAtOptimalFireDistance() {
  float dist = readDistanceCM();
  float optimal = (float)OPTIMAL_FIRE_DIST_CM;
  return (dist >= optimal - 5.0f) && (dist <= optimal + 5.0f);
}
