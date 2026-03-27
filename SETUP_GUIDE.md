# 🤖 AUTONIX — Autonomous Sonic Fire Suppression Rover
### Complete Setup Guide

This is the master setup guide for the entire AUTONIX project by **Sparcs**. Follow every section in order and you will have the full system running on a new machine from scratch.

---

## 📦 Project Structure Overview

```
AI-Driven Autonomous Sonic Fire Suppression Rover/
│
├── autonix-dashboard/              ← Real-time web dashboard (browser UI)
│   ├── index.html                  ← Main HTML — 3D panel, metric cards, AI terminal
│   ├── app.js                      ← Master controller — Supabase, waveform, typewriter
│   ├── style.css                   ← Deep Obsidian & Neon design system
│   ├── three-scene.js              ← 3D WebGL scene — rover, globe, rings, cone
│   ├── config/
│   │   └── supabase-config.js      ← 🔑 Dashboard Supabase keys go here
│   ├── api/
│   │   └── rest-handler.js         ← REST API helper (fetch/insert metrics)
│   └── assets/
│       └── logo.png                ← AUTONIX logo
│
├── autonix_devkit/                 ← ESP32 Dev Kit V1 firmware (Arduino)
│   ├── autonix_devkit.ino          ← 🚀 Main firmware entry point
│   ├── config.h                    ← Pin definitions & constants
│   ├── motor_control.cpp/.h        ← L298N motor driver module
│   ├── ultrasonic.cpp/.h           ← HC-SR04 distance sensor
│   ├── flame_sensor.cpp/.h         ← Analog flame detector
│   ├── servo_radar.cpp/.h          ← SG90 servo sweep radar
│   ├── acoustic_weapon.cpp/.h      ← TPA3118 sonic fire suppressor
│   ├── oled_display.cpp/.h         ← SSD1306 128×64 OLED status display
│   ├── serial_parser.cpp/.h        ← Serial command parser (from Python)
│   └── uart_cam_bridge.cpp/.h      ← UART bridge to ESP32-CAM
│
├── autonix_cam/                    ← ESP32-CAM firmware (Arduino)
│   ├── autonix_cam.ino             ← 🚀 Camera firmware (MJPEG stream + UART)
│   └── config.h                    ← Wi-Fi credentials & camera pin mapping
│
├── ultrasonic_test/                ← Standalone HC-SR04 test sketch
│   └── ultrasonic_test.ino         ← Quick hardware verification sketch
│
├── autonix-ai-edge/                ← Python AI fire detection server
│   ├── main.py                     ← 🚀 Entry point — run this on laptop
│   ├── config.py                   ← 🔑 Supabase keys + camera + serial config
│   ├── supabase_client.py          ← Supabase REST client wrapper
│   ├── serial_commander.py         ← Serial command sender to ESP32
│   ├── requirements.txt            ← pip dependencies
│   ├── detector/
│   │   ├── hsv_detector.py         ← HSV color-based flame detection
│   │   └── yolo_detector.py        ← YOLOv8 AI fire detection
│   ├── snapshots/                  ← Auto-saved fire event screenshots
│   └── logs/                       ← Runtime log files
│
├── FIRMWARE_README.md              ← Wiring diagrams & firmware architecture
├── SETUP_GUIDE.md                  ← This file
└── README.md                       ← Project overview
```

---

## ✅ Prerequisites — Install These First

| Software | Download | Notes |
|---|---|---|
| **Python 3.10+** | [python.org](https://python.org/downloads) | ✅ Check "Add Python to PATH" |
| **Node.js 18+** | [nodejs.org](https://nodejs.org) | Needed for Live Server |
| **Arduino IDE 2.x** | [arduino.cc](https://www.arduino.cc/en/software) | For ESP32 firmware upload |
| **Git** | [git-scm.com](https://git-scm.com) | To clone and push the project |
| **VS Code** *(recommended)* | [code.visualstudio.com](https://code.visualstudio.com) | Install "Live Server" extension |

### Arduino IDE — Required Board & Libraries

1. Open Arduino IDE → **File** → **Preferences**
2. In "Additional Board Manager URLs", paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools** → **Board** → **Board Manager** → search **ESP32** → install **esp32 by Espressif Systems**
4. Install these libraries via **Sketch** → **Include Library** → **Manage Libraries**:
   - `ESP32Servo`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`

---

## 🗄️ STEP 1 — Set Up Supabase Database

The dashboard and AI edge server both write/read from the same Supabase database.

### 1.1 — Get Your API Keys

1. Log in to [supabase.com](https://supabase.com)
2. Open your project
3. Go to ⚙️ **Settings** → **API**
4. Copy these two values:
   - **Project URL** → looks like `https://xxxxxxxxxxx.supabase.co`
   - **anon / public key** → a long JWT string starting with `eyJ...`

### 1.2 — Create the Database Table

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New Query**, paste the entire block below, and click **Run**:

```sql
-- Create the live_metrics table
CREATE TABLE live_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       TEXT NOT NULL,
  metric_name     TEXT NOT NULL,
  metric_value    NUMERIC NOT NULL,
  unit            TEXT,
  status          TEXT DEFAULT 'nominal',
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime so the dashboard updates instantly
ALTER TABLE live_metrics REPLICA IDENTITY FULL;

-- Enforce only the 5 valid metric names
ALTER TABLE live_metrics
  ADD CONSTRAINT valid_metric_name CHECK (
    metric_name IN (
      'frequency_hz',
      'battery_level',
      'flame_intensity',
      'radar_angle',
      'target_distance_cm'
    )
  );

-- Enforce valid status values
ALTER TABLE live_metrics
  ADD CONSTRAINT valid_status CHECK (
    status IN ('nominal', 'warning', 'critical')
  );
```

3. ✅ You should see `Success. No rows returned.`

### 1.3 — Enable Realtime in Supabase UI

1. Go to **Database** → **Replication** in the left sidebar
2. Find `live_metrics` in the table list
3. Toggle the switch to **ON** under the `supabase_realtime` publication

---

## 🌐 STEP 2 — Set Up the Dashboard (Web UI)

The dashboard is a plain HTML/JS app — no build step needed. It features:
- **3D Digital Twin** — WebGL holographic rover with orbital rings, ultrasonic cone, and obstacle tracking
- **Live Metric Cards** — Frequency, Battery, Flame Intensity, Radar Angle, Distance
- **Audio Waveform Visualizer** — Real-time oscilloscope inside the Frequency card
- **AI Status Terminal** — Typewriter-style AI decision messages in the nav bar
- **Telemetry Key** — Legend overlay on the 3D canvas
- **Activity Log** — Timestamped event feed from Supabase Realtime
- **ESP32-CAM Vision Feed** — MJPEG stream viewer

### 2.1 — Paste Your Supabase Keys

Open this file:
```
autonix-dashboard/config/supabase-config.js
```

Replace the two values at the top:
```javascript
export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...YOUR_LONG_KEY_HERE';
```

### 2.2 — Start the Dashboard

**Option A — VS Code Live Server (Recommended):**
1. Open the project folder in VS Code
2. Right-click `autonix-dashboard/index.html` → **Open with Live Server**
3. ✅ Dashboard opens at `http://127.0.0.1:5500~/autonix-dashboard/index.html`

**Option B — npx serve:**
```bash
cd autonix-dashboard
npx serve -l 3000
```
> If prompted to install `serve`, press **y**.

✅ Open your browser and go to: **http://localhost:3000**

---

## ⚡ STEP 3 — Upload ESP32 Firmware

### 3.1 — Upload Dev Kit V1 Firmware

This board controls motors, ultrasonic sensor, flame sensor, servo radar, acoustic weapon, and OLED display.

1. Open Arduino IDE
2. Open the file: `autonix_devkit/autonix_devkit.ino`
3. Edit `autonix_devkit/config.h` — verify pin assignments match your wiring (see `FIRMWARE_README.md`)
4. Connect ESP32 Dev Kit V1 to your laptop via USB
5. Set board settings:
   - **Board**: `ESP32 Dev Module`
   - **Port**: Select the correct COM port (check Device Manager)
   - **Upload Speed**: `115200`
6. Click **Upload** (→ arrow button)

> ✅ Monitor output via **Tools** → **Serial Monitor** at **115200 baud**

### 3.2 — Upload ESP32-CAM Firmware

This board streams MJPEG video over Wi-Fi and communicates with the Dev Kit via UART.

1. Open Arduino IDE
2. Open the file: `autonix_cam/autonix_cam.ino`
3. Edit `autonix_cam/config.h` — set your **Wi-Fi SSID** and **password**:
   ```cpp
   #define WIFI_SSID     "YourWiFiName"
   #define WIFI_PASSWORD "YourPassword"
   ```
4. Connect ESP32-CAM via FTDI programmer (USB-to-TTL):
   - Connect **GND** to **GND**
   - Connect **5V** to **5V**
   - Connect **U0R** to **TX** on FTDI
   - Connect **U0T** to **RX** on FTDI
   - Connect **IO0** to **GND** (enables flash mode)
5. Set board settings:
   - **Board**: `AI Thinker ESP32-CAM`
   - **Port**: Select the FTDI COM port
6. Click **Upload**
7. **After upload**: Disconnect **IO0** from **GND**, then press the **RST** button

> ✅ Open Serial Monitor at **115200 baud** to see the camera's IP address.

### 3.3 — Quick Hardware Test (Ultrasonic Only)

To verify your ultrasonic sensor independently:
1. Open `ultrasonic_test/ultrasonic_test.ino` in Arduino IDE
2. Upload to ESP32 Dev Kit
3. Open Serial Monitor at **115200 baud**
4. ✅ You'll see distance readings in centimeters and data pushed to Supabase

---

## 🐍 STEP 4 — Set Up the AI Edge Server (Python)

### 4.1 — Install Python Dependencies

```bash
cd autonix-ai-edge
pip install -r requirements.txt
```

> This installs: `opencv-python`, `numpy`, `requests`, `flask`, `pyserial`, `ultralytics`, `colorama`.
> First run downloads `yolov8n.pt` (~6 MB) automatically.

### 4.2 — Paste Your Supabase Keys into Python Config

Open this file:
```
autonix-ai-edge/config.py
```

Set the same credentials from Step 1.1:
```python
SUPABASE_URL       = "https://YOUR_PROJECT_ID.supabase.co"
SUPABASE_ANON_KEY  = "eyJ...YOUR_LONG_KEY_HERE"
```

### 4.3 — Choose Your Camera Mode

In `autonix-ai-edge/config.py`:

| Scenario | Setting |
|---|---|
| Testing with laptop webcam | `CAMERA_MODE = "WEBCAM"` |
| Using ESP32-CAM over Wi-Fi | `CAMERA_MODE = "ESP32CAM"` |

If using ESP32-CAM, also set its IP address (use /capture here!):
```python
ESP32_CAM_STREAM_URL = "http://192.168.x.x/capture"
```

### 4.4 — Configure Serial Port (ESP32 Dev Kit)

Find your serial port:
- **Windows**: Open Device Manager → Ports (COM & LPT) → note the COM number (e.g. `COM3`)
- **Linux**: Usually `/dev/ttyUSB0`

Update in `config.py`:
```python
ESP32_SERIAL_PORT = "COM3"          # Windows
ESP32_SERIAL_PORT = "/dev/ttyUSB0"  # Linux
```

> If ESP32 is NOT connected, set `SERIAL_ENABLED = False` to avoid crash.

### 4.5 — Run the AI Edge Server

```bash
python main.py
```

✅ You should see the AUTONIX ASCII banner, camera opening, and the Flask stream starting.

---

## 🔗 STEP 5 — Connect Dashboard to Video Stream

1. Open the dashboard in your browser
2. Find the **LIVE VISION FEED** panel on the left
3. In the input box at the bottom, type the stream URL:
   - **AI Edge Server**: `http://localhost:5000/video_feed`
   - **Direct ESP32-CAM**: `http://192.168.x.x/stream`
4. Click **SET STREAM**

✅ The dashboard will now show the live annotated fire detection video feed!

---

## 🔁 Running the Full System (Daily Use)

Every time you want to run the project, follow this order:

**Terminal 1 — Dashboard:**
```bash
cd autonix-dashboard
npx serve -l 3000
```
> Or use VS Code Live Server (right-click `index.html`)

**Terminal 2 — AI Edge Server:**
```bash
cd autonix-ai-edge
python main.py
```

Then open the dashboard URL in your browser.

---

## 📡 System Architecture

```
┌──────────────────┐         UART          ┌──────────────────┐
│  ESP32 Dev Kit   │◄─────────────────────►│   ESP32-CAM      │
│  (autonix_devkit)│                       │  (autonix_cam)   │
│                  │                       │                  │
│  • Motor Control │                       │  • MJPEG Stream  │
│  • Ultrasonic    │                       │  • Wi-Fi AP/STA  │
│  • Flame Sensor  │                       └──────────────────┘
│  • Servo Radar   │                              │
│  • Acoustic Gun  │                         Wi-Fi│Stream
│  • OLED Display  │                              ▼
└────────┬─────────┘                   ┌──────────────────┐
         │ USB Serial                  │  Ubuntu Laptop   │
         ▼                             │  (autonix-ai-    │
┌──────────────────┐                   │   edge)          │
│  Ubuntu Laptop   │                   │                  │
│  Python AI Server│◄──────────────────│  • OpenCV/YOLO   │
│                  │   Same Machine    │  • Fire Detection│
│  • Serial Cmds   │                   │  • Flask Stream  │
│  • Supabase Push │                   └──────────────────┘
└────────┬─────────┘
         │ REST API
         ▼
┌──────────────────┐         Realtime       ┌──────────────────┐
│    Supabase      │◄─────────────────────►│  Web Dashboard   │
│  (live_metrics)  │    WebSocket           │  (autonix-       │
│                  │                        │   dashboard)     │
│  • Database      │                        │                  │
│  • Realtime      │                        │  • 3D Twin       │
│                  │                        │  • Metrics       │
└──────────────────┘                        │  • AI Terminal   │
                                            │  • Waveform      │
                                            └──────────────────┘
```

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `No such file or directory: main.py` | Run from inside `autonix-ai-edge/` folder |
| `Failed to open camera (WEBCAM)` | Another app is using your camera. Close it and retry |
| Webcam not found (index 0) | Try `cv2.VideoCapture(1)` in `main.py` |
| `Serial connection failed on COM3` | Wrong COM port or cable. Check Device Manager |
| Dashboard shows no data | Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in both config files |
| Dashboard shows OFFLINE | Supabase key is wrong or table not created — redo Step 1.2 |
| 3D scene not rendering | Hard-refresh with `Ctrl + Shift + R` to clear browser cache |
| OrbitControls not working | Ensure no duplicate Three.js CDN scripts in `<head>` |
| `npx serve` not found | Install Node.js from nodejs.org |
| Stream box shows black | The Python server is not running. Start `main.py` first |
| ESP32 upload fails | Select correct board and port. For ESP32-CAM, connect IO0 to GND |
| `ultralytics` download slow | Wait for `yolov8n.pt` to download (~6 MB), happens only once |
| Port 5000 already in use | Change `FLASK_PORT = 5001` in `config.py` and update stream URL |
| Port 3000 already in use | Use `npx serve -l 3001` or Live Server |

---

## 🔑 Summary of All Credentials & Config

| Component | File | What to fill |
|---|---|---|
| Dashboard | `autonix-dashboard/config/supabase-config.js` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| AI Server | `autonix-ai-edge/config.py` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| AI Server | `autonix-ai-edge/config.py` | `CAMERA_MODE`, `ESP32_CAM_STREAM_URL` |
| AI Server | `autonix-ai-edge/config.py` | `ESP32_SERIAL_PORT`, `SERIAL_ENABLED` |
| ESP32-CAM | `autonix_cam/config.h` | `WIFI_SSID`, `WIFI_PASSWORD` |

> **Note:** The dashboard and Python server use the same single Supabase anon key. No other API keys are needed.

---

## 📤 Pushing Updates to GitHub

Whenever you make changes, run these 3 commands from the project root:

```bash
git add .
git commit -m "Describe your changes here"
git push origin main
```

---

*Built by Team Sparcs — AUTONIX Autonomous Sonic Fire Suppression Rover*
