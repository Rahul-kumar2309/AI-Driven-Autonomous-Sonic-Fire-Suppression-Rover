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
CAMERA_MODE          = "WEBCAM"
ESP32_CAM_STREAM_URL = "http://192.168.1.100/stream"

# ── FLASK MJPEG STREAMER ──────────────────────────────────────────
#   Dashboard uses: <img src="http://localhost:5000/video_feed">
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5000

# ── ESP32 DEV KIT SERIAL / UART ───────────────────────────────────
ESP32_SERIAL_PORT  = "/dev/ttyUSB0"       # Windows: "COM3"
ESP32_BAUD_RATE    = 115200
SERIAL_ENABLED     = True                 # False if ESP32 not connected

# ── HSV FIRE COLOR RANGES ─────────────────────────────────────────
HSV_LOWER_1        = (0,   120, 100)      # Red-low hue start
HSV_UPPER_1        = (15,  255, 255)      # Red-low hue end
HSV_LOWER_2        = (160, 120, 100)      # Red-high (wrap) start
HSV_UPPER_2        = (180, 255, 255)      # Red-high (wrap) end
HSV_LOWER_ORANGE   = (15,  120, 100)      # Orange/yellow start
HSV_UPPER_ORANGE   = (35,  255, 255)      # Orange/yellow end
HSV_MIN_CONTOUR_AREA = 300                # Min px² to count as fire

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
FIRE_CONFIRM_FRAMES  = 3                  # consecutive frames required

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
