// ═══════════════════════════════════════════════════════════════════
// AUTONIX CAM — config.h
// ESP32-CAM (AI Thinker) configuration settings.
// Edit WIFI_SSID and WIFI_PASSWORD before uploading.
// ═══════════════════════════════════════════════════════════════════
#pragma once

// ── Wi-Fi credentials ─────────────────────────────────────────────
#define WIFI_SSID      "YOUR_WIFI_SSID"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"

// ── UART from Dev Kit (overlaps USB — disconnect USB when using) ──
#define CAM_RX_PIN      3    // GPIO3 (U0RXD) — receives from Dev Kit TX
#define CAM_TX_PIN      1    // GPIO1 (U0TXD) — sends to Dev Kit RX

// ── HTTP Stream ───────────────────────────────────────────────────
#define STREAM_PORT     80

// ── Camera image settings ─────────────────────────────────────────
#define FRAME_SIZE      FRAMESIZE_VGA   // 640 x 480
#define JPEG_QUALITY    12              // 0=best quality, 63=worst
#define XCLK_FREQ       20000000        // 20 MHz clock

// ── Wi-Fi connection timeout ─────────────────────────────────────
#define WIFI_TIMEOUT_MS 15000           // 15 seconds before restart
