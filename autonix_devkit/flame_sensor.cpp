// ═══════════════════════════════════════════════════════════════════
// flame_sensor.cpp — 5-Channel Flame Sensor Implementation
// Lower ADC value = stronger fire signal (inverse relationship).
// Channel map: [0]=0°  [1]=45°  [2]=90°  [3]=135°  [4]=180°
// ═══════════════════════════════════════════════════════════════════
#include "flame_sensor.h"
#include "config.h"
#include "Arduino.h"

// Sensor pins in spatial order (left to right)
static const int FLAME_PINS[5] = {
  FLAME_LEFT_FAR,   // index 0 → 0°
  FLAME_LEFT,       // index 1 → 45°
  FLAME_CENTER,     // index 2 → 90°
  FLAME_RIGHT,      // index 3 → 135°
  FLAME_RIGHT_FAR   // index 4 → 180°
};

// Direction angles corresponding to each sensor channel
static const int CHANNEL_DEGREES[5] = { 0, 45, 90, 135, 180 };

void flameSensorInit() {
  // GPIO34, 35, 36, 39 are input-only pins on ESP32
  // GPIO4 supports analog — all set as INPUT
  for (int i = 0; i < 5; i++) {
    pinMode(FLAME_PINS[i], INPUT);
  }
  Serial.println("STATUS:Flame sensor initialized");
}

FlameReading readFlameSensors() {
  FlameReading result;
  result.fireDetected = false;
  result.strongestIdx = 2;  // default center
  result.directionDeg = 90; // default straight ahead

  int lowestValue = 4096;   // Track minimum ADC value (strongest signal)

  // Read all 5 channels
  for (int i = 0; i < 5; i++) {
    result.values[i] = analogRead(FLAME_PINS[i]);

    // Track strongest detection (lowest ADC value)
    if (result.values[i] < lowestValue) {
      lowestValue = result.values[i];
      result.strongestIdx = i;
    }

    // Check if this channel detects fire nearby
    if (result.values[i] < FLAME_THRESHOLD_NEAR) {
      result.fireDetected = true;
    }
  }

  // Map strongest channel index to direction angle
  result.directionDeg = CHANNEL_DEGREES[result.strongestIdx];

  return result;
}
