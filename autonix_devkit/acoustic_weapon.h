// ═══════════════════════════════════════════════════════════════════
// acoustic_weapon.h — TPA3118 Acoustic Emitter Control
// ═══════════════════════════════════════════════════════════════════
#pragma once

void acousticInit();
void fireWeapon(int freqHz);
void stopWeapon();
bool isWeaponActive();
int  getCurrentFreq();
