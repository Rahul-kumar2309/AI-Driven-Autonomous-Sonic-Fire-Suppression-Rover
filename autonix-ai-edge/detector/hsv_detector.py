# ═══════════════════════════════════════════════════════════════════
# AUTONIX AI Edge Server — HSV Fire Detector (Primary Pipeline)
# ═══════════════════════════════════════════════════════════════════
# OpenCV HSV colorspace fire detection with morphological filtering,
# contour analysis, intensity scoring, and Deep Obsidian & Neon
# overlay drawing. This is ALWAYS the primary detector.
# ═══════════════════════════════════════════════════════════════════

import logging
from dataclasses import dataclass, field
from typing import List, Tuple

import cv2
import numpy as np

from config import (
    HSV_LOWER_1,
    HSV_UPPER_1,
    HSV_LOWER_2,
    HSV_UPPER_2,
    HSV_LOWER_ORANGE,
    HSV_UPPER_ORANGE,
    HSV_MIN_CONTOUR_AREA,
    INTENSITY_WARNING,
)

logger = logging.getLogger("hsv_detector")

# ── Deep Obsidian & Neon BGR colors ────────────────────────────────
COLOR_NOMINAL  = (255, 191, 0)      # #00BFFF cyan in BGR
COLOR_WARNING  = (53, 107, 255)     # #FF6B35 orange in BGR
COLOR_CRITICAL = (68, 68, 255)      # #FF4444 red in BGR
COLOR_HUD_TEXT = (200, 200, 200)    # Light gray


def _status_color(intensity: float) -> tuple:
    """Return BGR color for the current intensity level."""
    if intensity >= INTENSITY_WARNING:
        return COLOR_CRITICAL
    if intensity >= 20.0:
        return COLOR_WARNING
    return COLOR_NOMINAL


@dataclass
class FireDetection:
    """Result container for a single frame's HSV fire analysis."""
    fire_detected:  bool             = False
    intensity:      float            = 0.0        # 0.0 – 100.0
    confidence:     float            = 0.0        # 0.0 – 1.0
    contours:       list             = field(default_factory=list)
    bounding_boxes: List[Tuple]      = field(default_factory=list)
    fire_area_px:   int              = 0
    frame_area_px:  int              = 0


class HSVFireDetector:
    """Primary fire detector using HSV colorspace analysis."""

    def __init__(self):
        self.lower_red1   = np.array(HSV_LOWER_1,     dtype=np.uint8)
        self.upper_red1   = np.array(HSV_UPPER_1,     dtype=np.uint8)
        self.lower_red2   = np.array(HSV_LOWER_2,     dtype=np.uint8)
        self.upper_red2   = np.array(HSV_UPPER_2,     dtype=np.uint8)
        self.lower_orange = np.array(HSV_LOWER_ORANGE, dtype=np.uint8)
        self.upper_orange = np.array(HSV_UPPER_ORANGE, dtype=np.uint8)

        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        logger.info("HSV Fire Detector initialized.")

    def detect(self, frame: np.ndarray) -> FireDetection:
        """Run the full HSV fire detection pipeline on one BGR frame."""
        h, w = frame.shape[:2]
        frame_area = h * w

        # 1. BGR → HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # 2. Build 3 color masks and combine
        mask_red1   = cv2.inRange(hsv, self.lower_red1,   self.upper_red1)
        mask_red2   = cv2.inRange(hsv, self.lower_red2,   self.upper_red2)
        mask_orange = cv2.inRange(hsv, self.lower_orange, self.upper_orange)
        combined    = cv2.bitwise_or(mask_red1, mask_red2)
        combined    = cv2.bitwise_or(combined,  mask_orange)

        # 3. Morphological open → close → dilate
        combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN,  self.kernel)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, self.kernel)
        combined = cv2.dilate(combined, self.kernel, iterations=1)

        # 4. External contours
        contours, _ = cv2.findContours(
            combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        # 5. Filter small contours
        valid_contours = [
            c for c in contours if cv2.contourArea(c) >= HSV_MIN_CONTOUR_AREA
        ]

        # 6. No fire
        if not valid_contours:
            return FireDetection(
                fire_detected=False, intensity=0.0, confidence=0.0,
                contours=[], bounding_boxes=[],
                fire_area_px=0, frame_area_px=frame_area,
            )

        # 7. Metrics
        fire_area = sum(cv2.contourArea(c) for c in valid_contours)
        area_ratio = min(fire_area / frame_area, 1.0)
        count_bonus = min(len(valid_contours) * 2, 20)
        intensity = min((area_ratio * 800) + count_bonus, 100.0)

        bounding_boxes = [cv2.boundingRect(c) for c in valid_contours]

        # Confidence from HSV saturation + brightness
        masked_hsv = hsv[combined > 0]
        if len(masked_hsv) > 0:
            mean_sat = np.mean(masked_hsv[:, 1]) / 255.0
            mean_val = np.mean(masked_hsv[:, 2]) / 255.0
            confidence = (mean_sat * 0.6) + (mean_val * 0.4)
            confidence = min(max(confidence, 0.0), 1.0)
        else:
            confidence = 0.0

        # 8. Result
        return FireDetection(
            fire_detected=True,
            intensity=round(intensity, 2),
            confidence=round(confidence, 3),
            contours=valid_contours,
            bounding_boxes=bounding_boxes,
            fire_area_px=int(fire_area),
            frame_area_px=frame_area,
        )

    def draw_overlay(self, frame: np.ndarray, result: FireDetection) -> np.ndarray:
        """Draw detection overlay with Deep Obsidian & Neon colors."""
        if not result.fire_detected:
            cv2.putText(
                frame, "HSV: NO FIRE", (12, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, COLOR_HUD_TEXT, 1, cv2.LINE_AA,
            )
            return frame

        color = _status_color(result.intensity)

        # Bounding boxes
        for (x, y, w, h) in result.bounding_boxes:
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            label = f"FIRE {result.confidence:.0%}"
            cv2.putText(
                frame, label, (x, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA,
            )

        # Intensity bar (0–200px)
        bar_width = int(min(result.intensity, 100.0) * 2)
        cv2.rectangle(frame, (10, 8), (10 + bar_width, 22), color, -1)
        cv2.rectangle(frame, (10, 8), (210, 22), (80, 80, 80), 1)

        # Intensity label
        cv2.putText(
            frame, f"HSV INTENSITY: {result.intensity:.1f}", (12, 48),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA,
        )

        return frame
