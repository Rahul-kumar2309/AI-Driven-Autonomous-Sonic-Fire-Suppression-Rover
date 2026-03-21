// ═══════════════════════════════════════════════════════════════════
// AUTONIX Dev Kit V1 — config.h
// Single source of truth for ALL pin definitions and constants.
// Every module must include this file. Never hardcode pin numbers.
// ═══════════════════════════════════════════════════════════════════
#pragma once

// ── L298N #1 — LEFT SIDE MOTORS ─────────────────────────────────
#define MOTOR_L_IN1     26    // Left motor forward
#define MOTOR_L_IN2     27    // Left motor backward
#define MOTOR_L_ENA     14    // Left speed PWM (LEDC)

// ── L298N #2 — RIGHT SIDE MOTORS ────────────────────────────────
#define MOTOR_R_IN3     25    // Right motor forward
#define MOTOR_R_IN4     33    // Right motor backward
#define MOTOR_R_ENB     32    // Right speed PWM (LEDC)

// ── HC-SR04 ULTRASONIC SENSOR ────────────────────────────────────
#define ULTRASONIC_TRIG  5
#define ULTRASONIC_ECHO 18

// ── 5-CHANNEL FLAME SENSOR ───────────────────────────────────────
#define FLAME_LEFT_FAR  34    // Leftmost  — analog input
#define FLAME_LEFT      35    // Left      — analog input
#define FLAME_CENTER    36    // Center    — VP (analog)
#define FLAME_RIGHT     39    // Right     — VN (analog)
#define FLAME_RIGHT_FAR  4    // Rightmost — analog input

// ── SG90 SERVO (radar sweep) ─────────────────────────────────────
#define SERVO_PIN       13

// ── TPA3118 AUDIO OUTPUT ─────────────────────────────────────────
// ESP32 GPIO25 = DAC1 but we use LEDC for square wave tone output
#define AUDIO_DAC_PIN   25

// ── OLED DISPLAY (I2C SSD1306 128×64) ───────────────────────────
#define OLED_SDA        21
#define OLED_SCL        22
#define OLED_ADDRESS    0x3C
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT   64

// ── UART0 — Laptop serial commands ───────────────────────────────
#define SERIAL_BAUD    115200

// ── UART2 — ESP32-CAM bridge ─────────────────────────────────────
#define CAM_SERIAL_RX   16    // Dev Kit RX2 ← CAM TX
#define CAM_SERIAL_TX   17    // Dev Kit TX2 → CAM RX
#define CAM_SERIAL_BAUD 115200

// ── MOTOR BEHAVIOUR ──────────────────────────────────────────────
#define MOTOR_SPEED_NORMAL   180   // PWM 0–255
#define MOTOR_SPEED_SLOW     100
#define MOTOR_SPEED_STOP       0
#define OBSTACLE_STOP_DIST_CM 20   // Stop if obstacle closer
#define OPTIMAL_FIRE_DIST_CM  30   // Target approach distance

// ── ACOUSTIC WEAPON ──────────────────────────────────────────────
#define FREQ_MIN_HZ       30
#define FREQ_MAX_HZ       60
#define LEDC_CHANNEL       0
#define LEDC_RESOLUTION    8      // 8-bit: duty values 0–255
#define LEDC_TIMER         0

// ── MOTOR PWM LEDC CHANNELS ──────────────────────────────────────
#define LEDC_MOTOR_L_CH    1      // LEDC channel for ENA
#define LEDC_MOTOR_R_CH    2      // LEDC channel for ENB
#define LEDC_MOTOR_FREQ 1000      // 1 kHz PWM for motors
#define LEDC_MOTOR_RES     8      // 8-bit resolution

// ── FLAME SENSOR THRESHOLDS ──────────────────────────────────────
#define FLAME_THRESHOLD_NEAR 500  // ADC value — strong fire nearby
#define FLAME_THRESHOLD_FAR 2000  // ADC value — weak/distant fire

// ── TELEMETRY ────────────────────────────────────────────────────
#define TELEMETRY_INTERVAL_MS 500 // Send telemetry every 500ms
