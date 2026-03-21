// ═══════════════════════════════════════════════════════════════════
// acoustic_weapon.cpp — TPA3118 LEDC Tone Generator Implementation
// Uses ESP32 LEDC on AUDIO_DAC_PIN to generate square wave at
// the target acoustic kill frequency via TPA3118 amplifier.
// ═══════════════════════════════════════════════════════════════════
#include "acoustic_weapon.h"
#include "config.h"
#include "Arduino.h"

static int  currentFreqHz = 0;
static bool weaponFiring  = false;

void acousticInit() {
  // Set up LEDC channel with a dummy 1Hz start freq
  ledcSetup(LEDC_CHANNEL, 1, LEDC_RESOLUTION);
  ledcAttachPin(AUDIO_DAC_PIN, LEDC_CHANNEL);
  // Start silent
  ledcWrite(LEDC_CHANNEL, 0);
  currentFreqHz = 0;
  weaponFiring  = false;
  Serial.println("STATUS:Acoustic weapon initialized — SILENT");
}

void fireWeapon(int freqHz) {
  // Clamp to safe operating range
  int clampedFreq = constrain(freqHz, FREQ_MIN_HZ, FREQ_MAX_HZ);

  // Reconfigure LEDC channel at the new frequency
  ledcSetup(LEDC_CHANNEL, clampedFreq, LEDC_RESOLUTION);
  ledcAttachPin(AUDIO_DAC_PIN, LEDC_CHANNEL);

  // 50% duty cycle = maximum acoustic power (128 out of 255)
  ledcWrite(LEDC_CHANNEL, 128);

  currentFreqHz = clampedFreq;
  weaponFiring  = true;
  Serial.print("CMD:WEAPON_FIRING:");
  Serial.print(clampedFreq);
  Serial.println("Hz");
}

void stopWeapon() {
  ledcWrite(LEDC_CHANNEL, 0);
  weaponFiring  = false;
  currentFreqHz = 0;
  Serial.println("CMD:WEAPON_STOPPED");
}

bool isWeaponActive() {
  return weaponFiring;
}

int getCurrentFreq() {
  return currentFreqHz;
}
