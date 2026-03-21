# ═══════════════════════════════════════════════════════════════════
# AUTONIX AI Edge Server — YOLOv8 Fire Detector (Fallback Pipeline)
# ═══════════════════════════════════════════════════════════════════
# Activates ONLY when HSV confidence < YOLO_FALLBACK_THRESHOLD.
# Gracefully degrades if ultralytics is not installed.
# Uses Deep Obsidian & Neon BGR colors for overlay drawing.
# ═══════════════════════════════════════════════════════════════════

import logging
from dataclasses import dataclass, field
from typing import List, Tuple

import cv2
import numpy as np

from config import (
    YOLO_MODEL_PATH,
    YOLO_CONFIDENCE,
    INTENSITY_WARNING,
)

logger = logging.getLogger("yolo_detector")

# Graceful import
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    logger.warning(
        "ultralytics not installed — YOLO fallback disabled. "
        "Install with: pip install ultralytics"
    )

# ── Deep Obsidian & Neon BGR colors ────────────────────────────────
COLOR_NOMINAL  = (255, 191, 0)
COLOR_WARNING  = (53, 107, 255)
COLOR_CRITICAL = (68, 68, 255)
COLOR_HUD_TEXT = (200, 200, 200)


def _status_color(intensity: float) -> tuple:
    if intensity >= INTENSITY_WARNING:
        return COLOR_CRITICAL
    if intensity >= 20.0:
        return COLOR_WARNING
    return COLOR_NOMINAL


@dataclass
class YOLODetection:
    """Result container for a single frame's YOLO fire analysis."""
    fire_detected:   bool             = False
    intensity:       float            = 0.0
    confidence:      float            = 0.0
    bounding_boxes:  List[Tuple]      = field(default_factory=list)
    model_available: bool             = False


class YOLOFireDetector:
    """YOLOv8-based fire detector — fallback to HSV pipeline."""

    def __init__(self):
        self.available = False
        self.model = None

        if not ULTRALYTICS_AVAILABLE:
            logger.info("YOLO detector unavailable (ultralytics not installed).")
            return

        try:
            self.model = YOLO(YOLO_MODEL_PATH)
            self.available = True
            logger.info("YOLO model loaded: %s", YOLO_MODEL_PATH)
        except Exception as exc:
            logger.error("YOLO model load failed: %s", exc)
            self.available = False

    def detect(self, frame: np.ndarray) -> YOLODetection:
        """Run YOLOv8 inference on one BGR frame."""
        if not self.available or self.model is None:
            return YOLODetection(
                fire_detected=False, intensity=0.0, confidence=0.0,
                bounding_boxes=[], model_available=False,
            )

        try:
            results = self.model(frame, conf=YOLO_CONFIDENCE, verbose=False)
        except Exception as exc:
            logger.error("YOLO inference error: %s", exc)
            return YOLODetection(
                fire_detected=False, intensity=0.0, confidence=0.0,
                bounding_boxes=[], model_available=True,
            )

        bounding_boxes = []
        best_conf = 0.0

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf < YOLO_CONFIDENCE:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                w = x2 - x1
                h = y2 - y1
                bounding_boxes.append((int(x1), int(y1), int(w), int(h)))
                if conf > best_conf:
                    best_conf = conf

        if not bounding_boxes:
            return YOLODetection(
                fire_detected=False, intensity=0.0, confidence=0.0,
                bounding_boxes=[], model_available=True,
            )

        intensity = min(best_conf * 110.0, 100.0)

        return YOLODetection(
            fire_detected=True,
            intensity=round(intensity, 2),
            confidence=round(best_conf, 3),
            bounding_boxes=bounding_boxes,
            model_available=True,
        )

    def draw_overlay(self, frame: np.ndarray, result: YOLODetection) -> np.ndarray:
        """Draw YOLO detection overlay with Deep Obsidian & Neon colors."""
        if not result.fire_detected:
            return frame

        color = _status_color(result.intensity)

        for (x, y, w, h) in result.bounding_boxes:
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            label = f"YOLO FIRE {result.confidence:.0%}"
            cv2.putText(
                frame, label, (x, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA,
            )

        cv2.putText(
            frame, f"YOLO INTENSITY: {result.intensity:.1f}", (12, 72),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA,
        )

        return frame
