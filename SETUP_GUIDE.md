# 🤖 AUTONIX — Autonomous Sonic Fire Suppression Rover
### Complete New Laptop Setup Guide

This is the master setup guide for the entire AUTONIX project. Follow every section in order and you will have the full system running on a new machine from scratch.

---

## 📦 Project Structure Overview

```
AI-Driven Autonomous Sonic Fire Suppression Rover/
├── autonix-dashboard/      ← Web dashboard (browser UI)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── three-scene.js
│   └── config/
│       └── supabase-config.js  ← 🔑 Dashboard Supabase keys go here
│
└── autonix-ai-edge/        ← Python AI fire detection server
    ├── main.py             ← 🚀 Entry point — run this
    ├── config.py           ← 🔑 Python Supabase keys + camera config
    ├── supabase_client.py
    ├── serial_commander.py
    ├── detector/
    │   ├── hsv_detector.py
    │   └── yolo_detector.py
    ├── snapshots/
    ├── logs/
    └── requirements.txt
```

---

## ✅ Prerequisites — Install These First

| Software | Download | Notes |
|---|---|---|
| **Python 3.10+** | [python.org](https://python.org/downloads) | ✅ Check "Add Python to PATH" |
| **Node.js 18+** | [nodejs.org](https://nodejs.org) | Needed for the dashboard server |
| **Git** *(optional)* | [git-scm.com](https://git-scm.com) | To clone the project |

---

## 🗄️ STEP 1 — Set Up Supabase Database

The dashboard and AI edge server both write/read from the same Supabase database. This step is done **once** and the same credentials are used in both parts.

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

The dashboard is a plain HTML/JS app — no build step needed.

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

### 2.2 — Start the Dashboard Server

Open a terminal, navigate to the `autonix-dashboard` folder, and run:

```bash
npx serve -l 3000
```

> If it asks you to install `serve`, press **y** and Enter.

✅ Open your browser and go to: **[http://localhost:3000](http://localhost:3000)**

---

## 🐍 STEP 3 — Set Up the AI Edge Server (Python)

### 3.1 — Install Python Dependencies

Open a terminal, navigate to the `autonix-ai-edge` folder, and run:

```bash
pip install -r requirements.txt
```

> This installs: `opencv-python`, `numpy`, `requests`, `flask`, `pyserial`, `ultralytics`, `colorama`.
> Installation can take a few minutes because `ultralytics` (YOLO) is large.

### 3.2 — Paste Your Supabase Keys into Python Config

Open this file:
```
autonix-ai-edge/config.py
```

Set the same Supabase credentials you used in Step 2.1:
```python
SUPABASE_URL       = "https://YOUR_PROJECT_ID.supabase.co"
SUPABASE_ANON_KEY  = "eyJ...YOUR_LONG_KEY_HERE"
```

### 3.3 — Choose Your Camera Mode

In `autonix-ai-edge/config.py`, set the camera source:

| Scenario | Setting |
|---|---|
| Testing with laptop webcam | `CAMERA_MODE = "WEBCAM"` |
| Using ESP32-CAM over Wi-Fi | `CAMERA_MODE = "ESP32CAM"` |

If using ESP32-CAM, also set its IP address:
```python
ESP32_CAM_STREAM_URL = "http://192.168.x.x/stream"
```

### 3.4 — Configure Serial Port (ESP32 Dev Kit)

Find your serial port:
- **Windows**: Open Device Manager → Ports (COM & LPT) → note the `COM` number (e.g. `COM3`)
- **Linux**: Usually `/dev/ttyUSB0`

Then update in `config.py`:
```python
ESP32_SERIAL_PORT = "COM3"       # Windows example
ESP32_SERIAL_PORT = "/dev/ttyUSB0"  # Linux example
```

> If ESP32 is NOT connected, simply set `SERIAL_ENABLED = False` to avoid crash.

### 3.5 — Run the AI Edge Server

```bash
python main.py
```

✅ You should see the AUTONIX ASCII banner, camera opening, and the Flask stream starting. An **OpenCV window** will pop up showing your camera feed.

---

## 🔗 STEP 4 — Connect Dashboard to Video Stream

1. Open the dashboard in your browser (`http://localhost:3000`)
2. Find the **LIVE VISION FEED** panel on the left
3. In the input box at the bottom of that panel, type:
   ```
   http://localhost:5000/video_feed
   ```
4. Click **SET STREAM**

✅ The dashboard will now show the live annotated fire detection video feed!

---

## 🔁 Running the Full System (Daily Use)

Every time you want to run the project, follow this same order:

**Terminal 1 — Dashboard:**
```bash
cd autonix-dashboard
npx serve -l 3000
```

**Terminal 2 — AI Edge Server:**
```bash
cd autonix-ai-edge
python main.py
```

Then open **http://localhost:3000** in your browser.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `No such file or directory: main.py` | You are in the wrong folder. Run from inside `autonix-ai-edge/` |
| `Failed to open camera (WEBCAM)` | Another app is using your camera. Close it and retry |
| Webcam not found (index 0) | Try changing `cv2.VideoCapture(0)` to `cv2.VideoCapture(1)` in `main.py` |
| `Serial connection failed on COM3` | Wrong COM port or cable. Check Device Manager and update `config.py` |
| Dashboard shows no data | Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in both config files |
| Dashboard shows OFFLINE | Supabase key is wrong or table not created — redo Step 1.2 |
| `npx serve` not found | Install Node.js from nodejs.org |
| Stream box shows black | The Python server is not running. Start `main.py` first |
| `ultralytics` download slow | Wait for `yolov8n.pt` to download (~6 MB), it only happens once |
| Port 5000 already in use | Change `FLASK_PORT = 5001` in `config.py` and update the stream URL |
| Port 3000 already in use | Change `npx serve -l 3001` and open `http://localhost:3001` |

---

## 📡 ESP32 Firmware Requirements

For the acoustic emitter to work, the ESP32 Dev Kit firmware must listen on serial and parse these two commands:

```
SET_FREQ:{hz}\n    →  Drive TPA3118 amplifier at {hz} Hz
STOP\n             →  Silence the amplifier
```

---

## 🔑 Summary of All Credentials

| Location | File | What to fill |
|---|---|---|
| Dashboard | `autonix-dashboard/config/supabase-config.js` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| AI Server | `autonix-ai-edge/config.py` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| AI Server | `autonix-ai-edge/config.py` | `CAMERA_MODE`, `ESP32_CAM_STREAM_URL` |
| AI Server | `autonix-ai-edge/config.py` | `ESP32_SERIAL_PORT`, `SERIAL_ENABLED` |

> **Note:** No API keys are needed beyond Supabase. The dashboard and Python server use the same single Supabase anon key.
