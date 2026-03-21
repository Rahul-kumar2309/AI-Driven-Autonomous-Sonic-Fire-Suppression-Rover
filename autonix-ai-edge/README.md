# AUTONIX AI Edge Server — Fire Detection Engine

The AUTONIX AI Edge Server is the Python computer-vision brain of the Autonomous Sonic Fire Suppression Rover. It captures video from a local webcam or ESP32-CAM, runs a hybrid HSV + YOLOv8 fire detection pipeline, and serves the annotated video as a Flask MJPEG stream at `/video_feed` for the AUTONIX dashboard to consume in real time.

---

## Tech Stack

| Component | Library | Purpose |
|---|---|---|
| Flask | `flask>=3.0` | MJPEG stream server (`/video_feed`) |
| Fire detection | `opencv-python` | HSV colorspace pipeline (primary) |
| AI fallback | `ultralytics` | YOLOv8 detection (optional) |
| Supabase writes | `requests` | Raw REST HTTP POST to live_metrics |
| Serial control | `pyserial` | ESP32 UART commands (SET_FREQ / STOP) |
| Terminal logs | `colorama` | Colored status output |

---

## Setup

### 1. Create a virtual environment

**Linux / macOS:**
```bash
python -m venv autonix-env
source autonix-env/bin/activate
```

**Windows:**
```bash
python -m venv autonix-env
autonix-env\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> `ultralytics` and `pyserial` are optional — the script runs with HSV-only detection and no serial if they're missing.

### 3. Edit `config.py`

| Setting | What to enter |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon (public) key |
| `CAMERA_MODE` | `"WEBCAM"` or `"ESP32CAM"` |
| `ESP32_CAM_STREAM_URL` | ESP32-CAM IP (e.g. `http://192.168.1.100/stream`) |
| `ESP32_SERIAL_PORT` | `"COM3"` (Windows) or `"/dev/ttyUSB0"` (Linux) |
| `SERIAL_ENABLED` | `False` if ESP32 Dev Kit not connected |

### 4. Run

```bash
python main.py
```

### 5. Connect the Dashboard

In the AUTONIX Command Center dashboard, set the vision feed URL to:

```
http://localhost:5000/video_feed
```

Press **q** in the OpenCV window to quit gracefully.

---

## Camera Mode

Switch between input sources in `config.py`:

| Mode | Config Value | Source |
|---|---|---|
| Laptop webcam | `CAMERA_MODE = "WEBCAM"` | `cv2.VideoCapture(0)` |
| ESP32-CAM | `CAMERA_MODE = "ESP32CAM"` | `cv2.VideoCapture(ESP32_CAM_STREAM_URL)` |

---

## Serial Command Protocol

The ESP32 Dev Kit firmware must parse two serial commands:

| Command | Format | Description |
|---|---|---|
| Set Frequency | `SET_FREQ:{hz}\n` | Drive TPA3118 amplifier at `{hz}` Hz |
| Stop | `STOP\n` | Silence the acoustic emitter |

---

## Simulation Mode

When hardware is unavailable, these metrics are simulated locally:

| Metric | Behavior | Config Flag |
|---|---|---|
| `radar_angle` | Sweeps 0° → 180° → 0° in 2° steps | `SIMULATE_RADAR = True` |
| `battery_level` | Starts at 100%, drains 0.01% per write | `SIMULATE_BATTERY = True` |
| `target_distance_cm` | Random value between 50–150 cm | `SIMULATE_DISTANCE = True` |

Set any flag to `False` in `config.py` when reading real sensor data via serial.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Stream shows black frame | Check `frame_lock` usage — never skip the lock |
| YOLO not loading | Run: `pip install ultralytics` then `yolo download yolov8n` |
| Serial port denied (Linux) | `sudo usermod -aG dialout $USER` then reboot |
| Flask port already in use | Change `FLASK_PORT` in `config.py` |
| Too many false positives | Increase `HSV_MIN_CONTOUR_AREA` in `config.py` |
| Supabase writes failing | Check `SUPABASE_URL` + `SUPABASE_ANON_KEY` in `config.py` |
| Webcam not detected | Try `cv2.VideoCapture(1)` in `open_camera()` |
