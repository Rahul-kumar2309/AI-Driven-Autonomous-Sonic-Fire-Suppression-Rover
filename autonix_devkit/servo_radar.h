// ═══════════════════════════════════════════════════════════════════
// servo_radar.h — SG90 Servo Radar Sweep
// ═══════════════════════════════════════════════════════════════════
#pragma once

void servoInit();
void sweepTo(int angleDeg);
void autoSweep();
int  getCurrentAngle();
