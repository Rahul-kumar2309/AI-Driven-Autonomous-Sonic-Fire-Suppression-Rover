# ═══════════════════════════════════════════════════════════════════
# AUTONIX AI Edge Server — Configuration (Single Source of Truth)
# ═══════════════════════════════════════════════════════════════════
# Every tunable value lives here. No other file should hardcode
# any of these settings — always import from config.
# ═══════════════════════════════════════════════════════════════════

# ── SUPABASE ───────────────────────────────────────────────────────
SUPABASE_URL       = "https://zwahvtpzgxyhrhlgutyt.supabase.co"
SUPABASE_ANON_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3YWh2dHB6Z3h5aHJobGd1dHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTI2NjAsImV4cCI6MjA4OTYyODY2MH0.VQMhNRSxIvSRDsuGEL57vizRvq6LQHR-61HhpKIhnYs"
DEVICE_ID          = "rover_01"

# ── CAMERA MODE ────────────────────────────────────────────────────
#   "WEBCAM"   → cv2.VideoCapture(0)
#   "ESP32CAM" → cv2.VideoCapture(ESP32_CAM_STREAM_URL)
CAMERA_MODE          = "ESP32CAM"
ESP32_CAM_STREAM_URL = "http://10.122.223.237/capture"  # /capture = single JPEG, doesn't block browser /stream

# ── FLASK MJPEG STREAMER ──────────────────────────────────────────
#   Dashboard uses: <img src="http://localhost:5000/video_feed">
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5000

# ── ESP32 DEV KIT SERIAL / UART ───────────────────────────────────
#ESP32_SERIAL_PORT  = "/dev/ttyUSB0"       # Windows: "COM3"
ESP32_SERIAL_PORT  = "COM5" 
ESP32_BAUD_RATE    = 115200
SERIAL_ENABLED     = True                 # False if ESP32 not connected

# ── HSV FIRE COLOR RANGES ─────────────────────────────────────────
# Tuned for small flame detection (matchstick / lighter scale)
HSV_LOWER_1        = (0,   60,  80)       # Red-low: lower sat+val for small flames
HSV_UPPER_1        = (18,  255, 255)      # Red-low hue end (extended to 18)
HSV_LOWER_2        = (155, 60,  80)       # Red-high (wrap) — lowered sat
HSV_UPPER_2        = (180, 255, 255)      # Red-high (wrap) end
HSV_LOWER_ORANGE   = (18,  60,  80)       # Orange/yellow — extended range
HSV_UPPER_ORANGE   = (40,  255, 255)      # Yellow end (40 covers pure yellow)
HSV_MIN_CONTOUR_AREA = 50                 # Min px² — 50 catches matchstick flames

# ── YOLO FALLBACK ──────────────────────────────────────────────────
YOLO_FALLBACK_THRESHOLD = 0.4             # HSV conf below this → YOLO
YOLO_MODEL_PATH         = "yolov8n.pt"
YOLO_CONFIDENCE         = 0.45

# ── ACOUSTIC KILL FREQUENCY ───────────────────────────────────────
#   freq = FREQ_MIN + (intensity / 100.0) * (FREQ_MAX - FREQ_MIN)
#   Clamped to [FREQ_MIN, FREQ_MAX]. Return 0 if intensity == 0.
FREQ_MIN             = 30                 # Hz — minimum tone
FREQ_MAX             = 60                 # Hz — maximum tone

# ── STATUS THRESHOLDS ──────────────────────────────────────────────
INTENSITY_NOMINAL    = 20.0               # below 20 → 'nominal'
INTENSITY_WARNING    = 60.0               # 20–60 → 'warning', above 60 → 'critical'
FIRE_CONFIRM_FRAMES  = 2                  # consecutive frames required (2 = faster response)

# ── SIMULATION (when hardware unavailable) ─────────────────────────
SIMULATE_RADAR       = True               # Sweeps radar_angle 0→180→0
SIMULATE_BATTERY     = True               # Starts at 100%, drains 0.01%/write
SIMULATE_DISTANCE    = True               # Random 50–150 cm

# ── SNAPSHOTS ──────────────────────────────────────────────────────
SNAPSHOT_DIR             = "snapshots"
SAVE_SNAPSHOTS           = True
SNAPSHOT_MIN_INTENSITY   = 60.0
SNAPSHOT_COOLDOWN_SEC    = 10              # Max 1 snapshot per 10 seconds

# ── LOGGING ────────────────────────────────────────────────────────
LOG_DIR      = "logs"
LOG_TO_FILE  = True

# ── SUPABASE WRITE THROTTLE ───────────────────────────────────────
SUPABASE_WRITE_INTERVAL = 1.0             # seconds between DB writes
