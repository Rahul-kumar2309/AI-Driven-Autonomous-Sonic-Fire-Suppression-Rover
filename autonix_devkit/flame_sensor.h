// ═══════════════════════════════════════════════════════════════════
// flame_sensor.h — 5-Channel Flame Sensor
// ═══════════════════════════════════════════════════════════════════
#pragma once

struct FlameReading {
  int  values[5];       // Raw ADC values for each channel (0-4095)
  int  strongestIdx;    // Index 0-4 of the strongest detection
  bool fireDetected;    // True if any channel < FLAME_THRESHOLD_NEAR
  int  directionDeg;    // Estimated direction 0-180 degrees
};

void flameSensorInit();
FlameReading readFlameSensors();
