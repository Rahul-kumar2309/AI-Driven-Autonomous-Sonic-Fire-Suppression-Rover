// ═══════════════════════════════════════════════════════════════════
// servo_radar.cpp — SG90 Servo Radar Sweep Implementation
// Non-blocking millis()-based sweep 0→180→0 continuously.
// ═══════════════════════════════════════════════════════════════════
#include "servo_radar.h"
#include "config.h"
#include <ESP32Servo.h>

static Servo    radarServo;
static int      currentAngle = 90;
static int      sweepDir     = 1;        // +1 or -1
static unsigned long lastSweepTime = 0;

static const int   SWEEP_STEP_DEG = 2;
static const unsigned long SWEEP_STEP_DELAY_MS = 15;

void servoInit() {
  radarServo.attach(SERVO_PIN);
  currentAngle = 90;
  radarServo.write(currentAngle);
  delay(500); // Allow servo to reach center on startup
  Serial.println("STATUS:Servo initialized at 90deg");
}

void sweepTo(int angleDeg) {
  // Clamp angle to valid servo range
  currentAngle = constrain(angleDeg, 0, 180);
  radarServo.write(currentAngle);
}

void autoSweep() {
  unsigned long now = millis();
  if (now - lastSweepTime < SWEEP_STEP_DELAY_MS) {
    return; // Not time yet — non-blocking
  }
  lastSweepTime = now;

  // Advance angle
  currentAngle += SWEEP_STEP_DEG * sweepDir;

  // Reverse direction at endpoints
  if (currentAngle >= 180) {
    currentAngle = 180;
    sweepDir = -1;
  } else if (currentAngle <= 0) {
    currentAngle = 0;
    sweepDir = 1;
  }

  radarServo.write(currentAngle);
}

int getCurrentAngle() {
  return currentAngle;
}
