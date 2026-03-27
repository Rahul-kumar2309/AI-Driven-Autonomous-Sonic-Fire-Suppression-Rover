# ═══════════════════════════════════════════════════════════════════
# AUTONIX AI Edge Server — Main Entry Point
# ═══════════════════════════════════════════════════════════════════
# Flask MJPEG streamer (Thread 1) + OpenCV AI pipeline (Thread 2).
# Serves annotated video at /video_feed for the dashboard <img>.
# Pushes 5 metrics to Supabase, sends serial to ESP32, saves snaps.
# ═══════════════════════════════════════════════════════════════════

import logging
import os
import random
import signal
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import requests
from colorama import Fore, Style, init as colorama_init
from flask import Flask, Response

from config import (
    CAMERA_MODE,
    ESP32_CAM_STREAM_URL,
    ESP32_SERIAL_PORT,
    ESP32_BAUD_RATE,
    SERIAL_ENABLED,
    FLASK_HOST,
    FLASK_PORT,
    FREQ_MIN,
    FREQ_MAX,
    FIRE_CONFIRM_FRAMES,
    YOLO_FALLBACK_THRESHOLD,
    INTENSITY_NOMINAL,
    INTENSITY_WARNING,
    SIMULATE_RADAR,
    SIMULATE_BATTERY,
    SIMULATE_DISTANCE,
    SNAPSHOT_DIR,
    SAVE_SNAPSHOTS,
    SNAPSHOT_MIN_INTENSITY,
    SNAPSHOT_COOLDOWN_SEC,
    LOG_DIR,
    LOG_TO_FILE,
    SUPABASE_WRITE_INTERVAL,
)
from detector.hsv_detector import HSVFireDetector
from detector.yolo_detector import YOLOFireDetector
from serial_commander import SerialCommander
from supabase_client import (
    write_flame_intensity,
    write_frequency_hz,
    write_radar_angle,
    write_battery_level,
    write_target_distance,
)

# ── Colorama init ──────────────────────────────────────────────────
colorama_init(autoreset=True)

# ═══════════════════════════════════════════════════════════════════
# A. THREAD-SAFE SHARED FRAME
# ═══════════════════════════════════════════════════════════════════
output_frame = None
frame_lock = threading.Lock()

# ═══════════════════════════════════════════════════════════════════
# B. FLASK MJPEG SERVER (Thread 1)
# ═══════════════════════════════════════════════════════════════════
app = Flask(__name__)

# Suppress Flask request logging in production
flask_log = logging.getLogger("werkzeug")
flask_log.setLevel(logging.WARNING)


def generate_frames():
    """MJPEG generator — yields annotated frames to the browser."""
    global output_frame
    while True:
        with frame_lock:
            if output_frame is None:
                time.sleep(0.033)
                continue
            flag, encoded = cv2.imencode(".jpg", output_frame)
            if not flag:
                time.sleep(0.033)
                continue
            frame_bytes = encoded.tobytes()
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )
        time.sleep(0.033)  # ~30 FPS cap


@app.route("/video_feed")
def video_feed():
    """MJPEG stream endpoint for the dashboard <img> tag."""
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "AUTONIX AI Edge"}, 200


# ═══════════════════════════════════════════════════════════════
# MJPEG CAPTURE — requests-based reader for ESP32-CAM
# cv2.VideoCapture cannot reliably read HTTP MJPEG from ESP32-CAM:
# isOpened() returns True but cap.read() returns False for every frame.
# This class manually finds JPEG markers and decodes with imdecode.
# ═══════════════════════════════════════════════════════════════

class MjpegCapture:
    """
    Requests-based MJPEG frame reader.
    Drop-in replacement for cv2.VideoCapture for HTTP MJPEG streams.
    Supports auto-reconnect after stream loss.
    """

    JPEG_START = b'\xff\xd8'
    JPEG_END   = b'\xff\xd9'

    def __init__(self, url: str, timeout: int = 10):
        self.url     = url
        self.timeout = timeout
        self._resp   = None
        self._buf    = b''
        self._iter   = None
        self._log    = logging.getLogger('mjpeg_cap')
        self._opened = self._connect()

    def _connect(self) -> bool:
        try:
            self._resp = requests.get(
                self.url,
                stream=True,
                timeout=self.timeout,
                headers={'Connection': 'keep-alive'}
            )
            self._resp.raise_for_status()
            self._iter = self._resp.iter_content(chunk_size=4096)
            self._buf  = b''
            self._log.info('MJPEG stream connected: %s', self.url)
            return True
        except Exception as exc:
            self._log.warning('MJPEG connect failed: %s', exc)
            self._resp = None
            self._iter = None
            return False

    def isOpened(self) -> bool:
        return self._opened

    def read(self):
        """Read one JPEG frame. Returns (True, frame) or (False, None)."""
        # Try reconnect if stream lost
        if self._iter is None:
            if not self._connect():
                time.sleep(1.0)
                return False, None

        try:
            # Accumulate chunks until we find a complete JPEG
            for chunk in self._iter:
                self._buf += chunk

                # Find JPEG boundaries
                start = self._buf.find(self.JPEG_START)
                end   = self._buf.find(self.JPEG_END)

                if start != -1 and end != -1 and end > start:
                    jpg  = self._buf[start : end + 2]
                    self._buf = self._buf[end + 2:]  # keep remainder

                    frame = cv2.imdecode(
                        np.frombuffer(jpg, dtype=np.uint8),
                        cv2.IMREAD_COLOR
                    )
                    if frame is not None:
                        return True, frame

        except Exception as exc:
            self._log.warning('MJPEG read error: %s — reconnecting…', exc)
            self._resp = None
            self._iter = None
            time.sleep(1.0)

        return False, None

    def release(self):
        if self._resp is not None:
            try:
                self._resp.close()
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ═══════════════════════════════════════════════════════════════════

def setup_logging() -> logging.Logger:
    """Configure root logger with terminal + optional file output."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    fmt = logging.Formatter(
        fmt="[%(asctime)s] [%(name)-18s] %(message)s",
        datefmt="%H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(fmt)
    root.addHandler(console)

    if LOG_TO_FILE:
        Path(LOG_DIR).mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(LOG_DIR, f"autonix_{ts}.log")
        fh = logging.FileHandler(filepath, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(fmt)
        root.addHandler(fh)
        root.info("Log file: %s", filepath)

    return root


# ═══════════════════════════════════════════════════════════════════
# CAMERA OPEN
# ═══════════════════════════════════════════════════════════════════

def open_camera():
    """Open webcam or ESP32-CAM based on CAMERA_MODE."""
    logger = logging.getLogger("camera")
    if CAMERA_MODE == "WEBCAM":
        logger.info("%sOpening local webcam (index 0)…%s", Fore.CYAN, Style.RESET_ALL)
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            logger.critical(
                "%sFailed to open webcam. Exiting.%s",
                Fore.RED, Style.RESET_ALL,
            )
            sys.exit(1)
        return cap
    else:
        logger.info(
            "%sOpening ESP32-CAM via requests MJPEG reader: %s%s",
            Fore.CYAN, ESP32_CAM_STREAM_URL, Style.RESET_ALL,
        )
        cap = MjpegCapture(ESP32_CAM_STREAM_URL, timeout=15)
        if not cap.isOpened():
            logger.critical(
                "%sFailed to connect to ESP32-CAM stream (%s). Exiting.%s",
                Fore.RED, ESP32_CAM_STREAM_URL, Style.RESET_ALL,
            )
            sys.exit(1)
        return cap


# ═══════════════════════════════════════════════════════════════════
# SIMULATION STATE
# ═══════════════════════════════════════════════════════════════════
sim_radar_angle = 0.0
sim_radar_dir = 1         # +1 or -1
sim_battery = 100.0
sim_last_distance = 100.0


def get_simulated_metrics() -> dict:
    """Advance and return simulated radar/battery/distance values."""
    global sim_radar_angle, sim_radar_dir, sim_battery, sim_last_distance

    # Radar sweep 0 → 180 → 0
    if SIMULATE_RADAR:
        sim_radar_angle += 2.0 * sim_radar_dir
        if sim_radar_angle >= 180.0:
            sim_radar_angle = 180.0
            sim_radar_dir = -1
        elif sim_radar_angle <= 0.0:
            sim_radar_angle = 0.0
            sim_radar_dir = 1

    # Battery drain
    if SIMULATE_BATTERY:
        sim_battery = max(0.0, sim_battery - 0.01)

    # Distance random
    if SIMULATE_DISTANCE:
        sim_last_distance = random.uniform(50.0, 150.0)

    return {
        "radar_angle":        round(sim_radar_angle, 1),
        "battery_level":      round(sim_battery, 2),
        "target_distance_cm": round(sim_last_distance, 1),
    }


# ═══════════════════════════════════════════════════════════════════
# FREQUENCY MAPPING
# ═══════════════════════════════════════════════════════════════════

def intensity_to_frequency(intensity: float) -> int:
    """Map fire intensity (0–100) to acoustic kill frequency (Hz)."""
    if intensity <= 0:
        return 0
    freq = FREQ_MIN + (intensity / 100.0) * (FREQ_MAX - FREQ_MIN)
    return max(FREQ_MIN, min(int(round(freq)), FREQ_MAX))


# ═══════════════════════════════════════════════════════════════════
# STATUS HELPERS
# ═══════════════════════════════════════════════════════════════════

def _status_text(intensity: float) -> str:
    if intensity >= INTENSITY_WARNING:
        return "CRITICAL"
    if intensity >= INTENSITY_NOMINAL:
        return "WARNING"
    return "NOMINAL"


def _status_color_bgr(intensity: float) -> tuple:
    if intensity >= INTENSITY_WARNING:
        return (68, 68, 255)
    if intensity >= INTENSITY_NOMINAL:
        return (53, 107, 255)
    return (255, 191, 0)


def _status_fore(intensity: float) -> str:
    if intensity >= INTENSITY_WARNING:
        return Fore.RED + Style.BRIGHT
    if intensity >= INTENSITY_NOMINAL:
        return Fore.YELLOW
    return Fore.CYAN


# ═══════════════════════════════════════════════════════════════════
# HUD OVERLAY
# ═══════════════════════════════════════════════════════════════════

def draw_hud(
    frame: np.ndarray,
    frame_count: int,
    detector_used: str,
    intensity: float,
    freq: int,
    consecutive: int,
    confirmed: bool,
) -> np.ndarray:
    """Draw HUD panel top-right + fire banner at bottom."""
    color = _status_color_bgr(intensity)
    status = _status_text(intensity)
    lines = [
        f"FRAME:     {frame_count:06d}",
        f"DETECTOR:  {detector_used}",
        f"INTENSITY: {intensity:.1f}",
        f"FREQ:      {freq} Hz",
        f"CONSEC:    {consecutive}/{FIRE_CONFIRM_FRAMES}",
        f"STATUS:    {status}",
    ]

    h, w = frame.shape[:2]
    x0 = w - 270
    y0 = 10

    # Semi-transparent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (x0 - 8, y0 - 4), (w - 8, y0 + len(lines) * 20 + 6), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    for i, line in enumerate(lines):
        cv2.putText(
            frame, line, (x0, y0 + 16 + i * 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA,
        )

    # Fire banner
    if confirmed and intensity > 0:
        banner = f"FIRE CONFIRMED — {detector_used} [{intensity:.1f}]"
        cv2.rectangle(frame, (0, h - 36), (w, h), (0, 0, 180), -1)
        ts = cv2.getTextSize(banner, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)[0]
        tx = (w - ts[0]) // 2
        cv2.putText(
            frame, banner, (tx, h - 12),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA,
        )

    return frame


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    global output_frame

    # ── 1. Logging ─────────────────────────────────────────────────
    setup_logging()
    logger = logging.getLogger("main")

    # ── 2. ASCII Banner ────────────────────────────────────────────
    banner = f"""{Fore.CYAN}
    ╔══════════════════════════════════════════════════╗
    ║     AUTONIX AI Edge — Fire Detection Server     ║
    ╚══════════════════════════════════════════════════╝{Style.RESET_ALL}"""
    print(banner)

    # ── 3. Print config ────────────────────────────────────────────
    logger.info("%sCamera Mode  : %s%s", Fore.CYAN, CAMERA_MODE, Style.RESET_ALL)
    logger.info("%sFlask URL    : http://localhost:%d/video_feed%s", Fore.CYAN, FLASK_PORT, Style.RESET_ALL)
    logger.info("%sSerial Port  : %s (enabled=%s)%s", Fore.CYAN, ESP32_SERIAL_PORT, SERIAL_ENABLED, Style.RESET_ALL)

    # ── 4. Initialize modules ─────────────────────────────────────
    hsv_detector  = HSVFireDetector()
    yolo_detector = YOLOFireDetector()
    serial_cmd    = SerialCommander(ESP32_SERIAL_PORT, ESP32_BAUD_RATE, SERIAL_ENABLED)

    # ── 5. Start Flask daemon thread ──────────────────────────────
    flask_thread = threading.Thread(
        target=lambda: app.run(
            host=FLASK_HOST,
            port=FLASK_PORT,
            debug=False,
            use_reloader=False,
        )
    )
    flask_thread.daemon = True
    flask_thread.start()
    logger.info(
        "%sFlask MJPEG stream → http://localhost:%d/video_feed%s",
        Fore.GREEN, FLASK_PORT, Style.RESET_ALL,
    )

    # ── 6. Open camera ────────────────────────────────────────────
    cap = open_camera()

    # ── Graceful shutdown ──────────────────────────────────────────
    running = True

    def shutdown_handler(signum, frame_):
        nonlocal running
        logger.info("Shutdown signal received (sig=%s).", signum)
        running = False

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # ── State variables ────────────────────────────────────────────
    last_supabase_write = 0.0
    last_snapshot_time  = 0.0
    last_freq_sent      = 0
    frame_count         = 0
    consecutive_fire    = 0

    logger.info("%sEntering main detection loop…%s", Fore.GREEN, Style.RESET_ALL)

    # ═══════════════════════════════════════════════════════════════
    # MAIN LOOP
    # ═══════════════════════════════════════════════════════════════
    try:
        while running:
            ret, frame = cap.read()
            if not ret:
                logger.warning("Camera frame read failed — skipping.")
                time.sleep(0.01)
                continue

            frame_count += 1
            display = frame.copy()

            # ── STEP 1: HSV DETECTION (primary) ───────────────────
            hsv_result = hsv_detector.detect(frame)

            # ── STEP 2: YOLO FALLBACK ─────────────────────────────
            yolo_result = None
            if (
                yolo_detector.available
                and hsv_result.confidence < YOLO_FALLBACK_THRESHOLD
            ):
                yolo_result = yolo_detector.detect(frame)

            # ── STEP 3: MERGE — take highest intensity ────────────
            if hsv_result.fire_detected:
                final_intensity = hsv_result.intensity
                detector_used = "HSV"
            elif yolo_result and yolo_result.fire_detected:
                final_intensity = yolo_result.intensity
                detector_used = "YOLO"
            else:
                final_intensity = 0.0
                detector_used = "NONE"

            # If YOLO detected higher, override
            if (
                yolo_result
                and yolo_result.fire_detected
                and yolo_result.intensity > final_intensity
            ):
                final_intensity = yolo_result.intensity
                detector_used = "YOLO"

            # ── STEP 4: CONSECUTIVE CONFIRMATION ──────────────────
            if final_intensity > 0:
                consecutive_fire += 1
            else:
                consecutive_fire = max(0, consecutive_fire - 1)

            confirmed_fire = consecutive_fire >= FIRE_CONFIRM_FRAMES
            if not confirmed_fire:
                final_intensity = 0.0

            # ── STEP 5: FREQUENCY CALCULATION ─────────────────────
            target_freq = intensity_to_frequency(
                final_intensity if confirmed_fire else 0.0
            )

            # ── STEP 6: SERIAL COMMAND ────────────────────────────
            if target_freq != last_freq_sent:
                if target_freq > 0:
                    serial_cmd.send_freq(target_freq)
                else:
                    serial_cmd.send_stop()
                last_freq_sent = target_freq

            # ── STEP 7: SUPABASE WRITE (throttled) ────────────────
            now = time.time()
            if now - last_supabase_write >= SUPABASE_WRITE_INTERVAL:
                sim = get_simulated_metrics()

                write_flame_intensity(final_intensity)
                write_frequency_hz(float(target_freq) if target_freq > 0 else 0.0)
                write_radar_angle(sim["radar_angle"])
                write_battery_level(sim["battery_level"])
                write_target_distance(sim["target_distance_cm"])

                last_supabase_write = now

                # ── COLORAMA TERMINAL LOG ─────────────────────────
                status = _status_text(final_intensity)
                color = _status_fore(final_intensity)
                ts = datetime.now().strftime("%H:%M:%S")
                print(
                    f"{color}[{ts}] "
                    f"FRAME:{frame_count:06d} | "
                    f"DET:{detector_used:<4s} | "
                    f"INT:{final_intensity:5.1f} | "
                    f"FREQ:{target_freq:3d}Hz | "
                    f"BAT:{sim['battery_level']:5.1f}% | "
                    f"DIST:{sim['target_distance_cm']:5.0f}cm | "
                    f"STATUS:{status}"
                    f"{Style.RESET_ALL}"
                )

            # ── STEP 8: DRAW OVERLAYS ─────────────────────────────
            display = hsv_detector.draw_overlay(display, hsv_result)
            if yolo_result:
                display = yolo_detector.draw_overlay(display, yolo_result)

            display = draw_hud(
                display, frame_count, detector_used,
                final_intensity, target_freq,
                consecutive_fire, confirmed_fire,
            )

            # ── STEP 9: SNAPSHOT ──────────────────────────────────
            if (
                confirmed_fire
                and SAVE_SNAPSHOTS
                and final_intensity >= SNAPSHOT_MIN_INTENSITY
                and now - last_snapshot_time >= SNAPSHOT_COOLDOWN_SEC
            ):
                Path(SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)
                ts_snap = datetime.now().strftime("%Y%m%d_%H%M%S")
                fname = (
                    f"{SNAPSHOT_DIR}/fire_{ts_snap}_"
                    f"I{final_intensity:.0f}_{detector_used}.jpg"
                )
                cv2.imwrite(fname, display)
                print(
                    f"{Fore.MAGENTA}Snapshot saved: {fname}{Style.RESET_ALL}"
                )
                last_snapshot_time = now

            # ── STEP 10: PUSH TO SHARED FRAME (Flask reads) ──────
            with frame_lock:
                output_frame = display.copy()

            # ── STEP 11: LOCAL WINDOW (safe fallback if no GUI) ───
            try:
                cv2.imshow("AUTONIX \u2014 Fire Detection", display)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    logger.info("User pressed 'q' \u2014 exiting.")
                    break
            except Exception:
                pass  # No display available \u2014 headless mode OK

    except Exception as exc:
        logger.critical("Unhandled exception: %s", exc, exc_info=True)

    # ═══════════════════════════════════════════════════════════════
    # CLEANUP
    # ═══════════════════════════════════════════════════════════════
    serial_cmd.send_stop()
    serial_cmd.close()
    cap.release()
    cv2.destroyAllWindows()
    print(f"{Fore.GREEN}Shutdown complete.{Style.RESET_ALL}")


if __name__ == "__main__":
    main()
