# AUTONIX Firmware — ESP32 Dev Kit V1 + ESP32-CAM
### Team: INSNAPERZ

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FULL SYSTEM PIPELINE                     │
└─────────────────────────────────────────────────────────────────┘

 [Ubuntu/Windows Laptop]
        │
        │ USB Serial (UART0) — SET_FREQ:{hz}  /  STOP
        │ Telemetry ← TEL:{dist}:{angle}:{flame}
        ▼
 [ESP32 Dev Kit V1]  ──── UART2 (GPIO16↔17) ────►  [ESP32-CAM]
        │                                                │
        ├── L298N #1 → Left DC Motors                   │
        ├── L298N #2 → Right DC Motors                  │
        ├── HC-SR04 Ultrasonic Sensor                   │
        ├── 5-channel Flame Sensor (on servo arc)        │
        ├── SG90 Servo Motor (0°–180° sweep)             │
        ├── TPA3118 Amplifier → 4" Subwoofer            │
        └── 1.3" SSD1306 OLED Display (I2C)             │
                                                   OV3660 Camera
                                                   MJPEG Wi-Fi
                                                        │
                                                        ▼
                                              [Dashboard Browser]
                                          http://{CAM_IP}/stream
```

---

## Arduino Library Dependencies

### For ESP32 Dev Kit V1 (`autonix_devkit`)
Install all via **Arduino IDE → Tools → Manage Libraries**:

| Library | Author | Purpose |
|---|---|---|
| ESP32Servo | Kevin Harrington | SG90 servo control |
| Adafruit SSD1306 | Adafruit | OLED display driver |
| Adafruit GFX | Adafruit | OLED graphics primitives |

### For ESP32-CAM (`autonix_cam`)
These are **built into the ESP32 Arduino core** — no separate install needed:
- `esp_camera.h`
- `esp_http_server.h`

### Board Manager URL
In Arduino IDE → **File → Preferences → Additional board manager URLs**, add:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
Then go to **Tools → Board → Boards Manager**, search `esp32`, install **esp32 by Espressif**.

| Board | Selection in Arduino IDE |
|---|---|
| Dev Kit V1 | **ESP32 Dev Module** |
| ESP32-CAM | **AI Thinker ESP32-CAM** |

---

## Project A — Dev Kit V1 Wiring

### Motor Drivers (L298N)

| Component | ESP32 Pin | Direction |
|---|---|---|
| L298N #1 IN1 | GPIO 26 | Left motors — forward |
| L298N #1 IN2 | GPIO 27 | Left motors — backward |
| L298N #1 ENA | GPIO 14 | Left speed (PWM/LEDC) |
| L298N #2 IN3 | GPIO 25 | Right motors — forward |
| L298N #2 IN4 | GPIO 33 | Right motors — backward |
| L298N #2 ENB | GPIO 32 | Right speed (PWM/LEDC) |

### Sensors & Actuators

| Component | ESP32 Pin | Notes |
|---|---|---|
| HC-SR04 TRIG | GPIO 5 | Ultrasonic trigger |
| HC-SR04 ECHO | GPIO 18 | Ultrasonic echo |
| Flame Sensor L_FAR | GPIO 34 | Analog input (input-only pin) |
| Flame Sensor LEFT | GPIO 35 | Analog input (input-only pin) |
| Flame Sensor CENTER | GPIO 36 (VP) | Analog input (input-only pin) |
| Flame Sensor RIGHT | GPIO 39 (VN) | Analog input (input-only pin) |
| Flame Sensor R_FAR | GPIO 4 | Analog input |
| SG90 Servo | GPIO 13 | PWM servo signal |
| TPA3118 Audio In | GPIO 25 | LEDC square wave tone |
| OLED SDA | GPIO 21 | I2C data |
| OLED SCL | GPIO 22 | I2C clock |

> ⚠️ **GPIO 34, 35, 36, 39** are **input-only** on ESP32. Do NOT connect them to outputs or use `pinMode(..., OUTPUT)`.

### UART Bridge to ESP32-CAM

| Dev Kit Pin | Direction | ESP32-CAM Pin |
|---|---|---|
| GPIO 17 (TX2) | → | GPIO 3 (RX) |
| GPIO 16 (RX2) | ← | GPIO 1 (TX) |
| GND | — | GND |
| 5V | → | 5V |

---

## Project B — ESP32-CAM Notes

The ESP32-CAM does **not** have a USB-to-serial chip. You need an **FTDI FT232 adapter** to upload firmware.

### ESP32-CAM Upload Wiring (FTDI → CAM)

| FTDI Pin | ESP32-CAM Pin |
|---|---|
| 5V | 5V |
| GND | GND |
| TX | GPIO 3 (RX0) |
| RX | GPIO 1 (TX0) |
| GND | GPIO 0 ← **connect this to enter flash mode** |

> ⚠️ **Disconnect GPIO0 from GND after upload**, then press the reset button on the CAM board.

---

## Power Wiring

```
3x 18650 Li-ion (3S, 12.6V max)
        │
        ▼
  3S 20A BMS Board  ← protects cells
        │
        ▼
     12V Bus
    /        \
   /           \
L298N #1     L298N #2     TPA3118 Amplifier
(motors)     (motors)     (speaker, 12V in)
               │
               ▼
         LM2596 Buck Converter (12V → 5V)
               │
               ▼
            5V Bus
         /    |    |    |    \
     ESP32   CAM  OLED  Flame  SG90
     Dev Kit       VCC  Sensor Servo
     (VIN)   (5V)       VCC    VCC
```

---

## Upload Instructions

### Dev Kit V1
1. Select board: **Tools → Board → ESP32 Dev Module**
2. Select the correct COM port
3. Upload speed: **115200**
4. Click **Upload** — the board auto-resets into flash mode

### ESP32-CAM
1. Wire FTDI programmer as shown in table above
2. Connect **GPIO0 to GND** before powering on
3. Select board: **Tools → Board → AI Thinker ESP32-CAM**
4. Select FTDI COM port
5. Click **Upload**
6. After "Connecting..." succeeds, **disconnect GPIO0 from GND**
7. Press the CAM reset button
8. Open Serial Monitor to see the stream IP address

---

## Wi-Fi Configuration (ESP32-CAM)

Edit `autonix_cam/config.h` before uploading:
```cpp
#define WIFI_SSID      "YourNetworkName"
#define WIFI_PASSWORD  "YourNetworkPassword"
```

After boot, the CAM will print:
```
CAM:Stream URL: http://192.168.x.x/stream
```

Use that URL in the dashboard or Python edge server.

---

## Testing Checklist

- [ ] Dev Kit Serial Monitor shows `STATUS:AUTONIX Dev Kit -- Ready`
- [ ] OLED shows "AUTONIX / INSNAPERZ" splash then live data
- [ ] Servo sweeps 0°→180°→0° continuously in IDLE state
- [ ] ESP32-CAM prints `CAM:Stream URL: http://...` to Serial Monitor
- [ ] Stream accessible at `http://{CAM_IP}/stream` in browser
- [ ] Sending `SET_FREQ:42` from Serial Monitor → Dev Kit fires weapon at 42Hz
- [ ] Speaker emits audible tone when SET_FREQ command received
- [ ] Rover stops motors when obstacle detected < 20cm
- [ ] Rover resumes approach after backing up + turning right
- [ ] Fire extinguished → 3 clean readings → `STATUS:FIRE EXTINGUISHED`
- [ ] Python edge server sends `SET_FREQ:42\n` → Dev Kit responds correctly

---

## Serial Protocol (UART0 — Laptop ↔ Dev Kit)

| Direction | Format | Meaning |
|---|---|---|
| Laptop → Dev Kit | `SET_FREQ:{hz}\n` | Fire weapon at {hz} Hz |
| Laptop → Dev Kit | `STOP\n` | Stop weapon and motors |
| Dev Kit → Laptop | `TEL:{dist}:{angle}:{flame}\n` | Sensor telemetry (every 500ms) |
| Dev Kit → Laptop | `CMD:{message}\n` | Command acknowledgement |
| Dev Kit → Laptop | `STATUS:{message}\n` | State change notification |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `OLED SSD1306 allocation failed` | Check SDA/SCL wiring (GPIO21/22), verify 3.3V power |
| Servo doesn't move | Confirm ESP32Servo library installed and GPIO13 wiring |
| Motors spin wrong direction | Swap IN1/IN2 or IN3/IN4 wires on L298N |
| No sound from speaker | Check TPA3118 12V input and audio signal wire on GPIO25 |
| ESP32-CAM stuck at `Connecting...` | Wrong SSID/password in config.h, or GPIO0 still grounded |
| UART bridge not working | Verify crossover: Dev TX17 → CAM GPIO3, Dev RX16 ← CAM GPIO1 |
| ADC flame sensor stuck at 4095 | Sensor power (5V), or using wrong analog pin |
| Camera init fails (HEX error) | Wrong pin map or power issue — verify 5V supply to CAM |
