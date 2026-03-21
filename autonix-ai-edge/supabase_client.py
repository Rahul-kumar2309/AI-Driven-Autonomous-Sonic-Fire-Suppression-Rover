# ═══════════════════════════════════════════════════════════════════
# AUTONIX AI Edge Server — Supabase REST Client
# ═══════════════════════════════════════════════════════════════════
# Raw HTTP POST via requests. No Supabase Python SDK.
# Writes 5 telemetry metrics to the live_metrics table.
# ═══════════════════════════════════════════════════════════════════

import logging

import requests

from config import (
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    DEVICE_ID,
    INTENSITY_NOMINAL,
    INTENSITY_WARNING,
)

logger = logging.getLogger("supabase_client")

# ── REST endpoint + headers (built once) ───────────────────────────
REST_URL = f"{SUPABASE_URL}/rest/v1/live_metrics"

HEADERS = {
    "apikey":        SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}


def _resolve_status(metric_name: str, value: float) -> str:
    """Determine status string based on metric thresholds."""
    if metric_name == "flame_intensity":
        if value >= INTENSITY_WARNING:
            return "critical"
        if value >= INTENSITY_NOMINAL:
            return "warning"
    return "nominal"


def upsert_metric(metric_name: str, metric_value: float, unit: str) -> bool:
    """POST a single metric row to Supabase live_metrics table.

    Returns True on HTTP 200/201, False on any error.
    """
    payload = {
        "device_id":    DEVICE_ID,
        "metric_name":  metric_name,
        "metric_value": round(metric_value, 2),
        "unit":         unit,
        "status":       _resolve_status(metric_name, metric_value),
    }

    try:
        resp = requests.post(REST_URL, json=payload, headers=HEADERS, timeout=3)
        if resp.status_code in (200, 201):
            logger.debug(
                "Supabase ← %s = %s %s [%s]",
                metric_name, round(metric_value, 2), unit, payload["status"],
            )
            return True
        else:
            logger.warning(
                "Supabase write failed: HTTP %d — %s",
                resp.status_code, resp.text[:200],
            )
            return False
    except requests.exceptions.Timeout:
        logger.error("Supabase write timed out for %s", metric_name)
        return False
    except requests.exceptions.ConnectionError:
        logger.error("Supabase connection error for %s", metric_name)
        return False
    except Exception as exc:
        logger.error("Supabase unexpected error: %s", exc)
        return False


# ── Convenience wrappers ───────────────────────────────────────────

def write_flame_intensity(value: float) -> bool:
    """Write flame_intensity metric (unitless 0–100)."""
    return upsert_metric("flame_intensity", value, "")


def write_frequency_hz(value: float) -> bool:
    """Write frequency_hz metric in Hz."""
    return upsert_metric("frequency_hz", value, "Hz")


def write_radar_angle(value: float) -> bool:
    """Write radar_angle metric in degrees."""
    return upsert_metric("radar_angle", value, "°")


def write_battery_level(value: float) -> bool:
    """Write battery_level metric in percent."""
    return upsert_metric("battery_level", value, "%")


def write_target_distance(value: float) -> bool:
    """Write target_distance_cm metric in centimeters."""
    return upsert_metric("target_distance_cm", value, "cm")
