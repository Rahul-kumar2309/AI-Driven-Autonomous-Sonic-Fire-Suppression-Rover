// ═══════════════════════════════════════════════════════════════════
// REST API Handler — AUTONIX Command Center
// ═══════════════════════════════════════════════════════════════════
// All Supabase REST API interactions (CRUD) for the live_metrics table.
// Uses fetch-based requests with the anon key as Bearer token.
// ═══════════════════════════════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase-config.js';

// ── VALID METRIC NAMES ────────────────────────────────────────────
const VALID_METRIC_NAMES = [
  'frequency_hz',
  'battery_level',
  'flame_intensity',
  'radar_angle',
  'target_distance_cm'
];

const VALID_STATUSES = ['nominal', 'warning', 'critical'];

// ── METRIC THRESHOLDS ─────────────────────────────────────────────
// Defines safe ranges: values within [nominalMin, nominalMax] → nominal,
// outside nominal but within [warningMin, warningMax] → warning,
// outside warning → critical.
const METRIC_THRESHOLDS = {
  frequency_hz: {
    min: 30, max: 60,
    nominalMin: 35, nominalMax: 55,
    warningMin: 30, warningMax: 60,
    unit: 'Hz'
  },
  battery_level: {
    min: 0, max: 100,
    nominalMin: 40, nominalMax: 100,
    warningMin: 15, warningMax: 100,
    unit: '%'
  },
  flame_intensity: {
    min: 0, max: 100,
    nominalMin: 0, nominalMax: 30,
    warningMin: 0, warningMax: 70,
    unit: ''
  },
  radar_angle: {
    min: 0, max: 180,
    nominalMin: 10, nominalMax: 170,
    warningMin: 0, warningMax: 180,
    unit: '°'
  },
  target_distance_cm: {
    min: 5, max: 200,
    nominalMin: 30, nominalMax: 200,
    warningMin: 10, warningMax: 200,
    unit: 'cm'
  }
};

// ── INTERNAL: headers builder ─────────────────────────────────────
function buildHeaders(method = 'GET') {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };
  if (method === 'POST' || method === 'PATCH') {
    headers['Content-Type'] = 'application/json';
    headers['Prefer'] = 'return=representation';
  }
  return headers;
}

// ── INTERNAL: build base URL ──────────────────────────────────────
function restUrl(path) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

// ── INTERNAL: determine status from value ─────────────────────────
function determineStatus(metricName, value) {
  const t = METRIC_THRESHOLDS[metricName];
  if (!t) return 'nominal';

  // Special logic for flame_intensity: higher is worse
  if (metricName === 'flame_intensity') {
    if (value >= 80) return 'critical';
    if (value >= 50) return 'warning';
    return 'nominal';
  }

  // Special logic for battery_level: lower is worse
  if (metricName === 'battery_level') {
    if (value <= 15) return 'critical';
    if (value <= 40) return 'warning';
    return 'nominal';
  }

  // Special logic for target_distance_cm: shorter is worse
  if (metricName === 'target_distance_cm') {
    if (value <= 10) return 'critical';
    if (value <= 30) return 'warning';
    return 'nominal';
  }

  // General range-based check
  if (value >= t.nominalMin && value <= t.nominalMax) return 'nominal';
  if (value >= t.warningMin && value <= t.warningMax) return 'warning';
  return 'critical';
}

// ── PUBLIC: fetchAllMetrics ───────────────────────────────────────
export async function fetchAllMetrics() {
  try {
    const res = await fetch(
      restUrl('live_metrics?order=timestamp.desc&limit=50'),
      { headers: buildHeaders() }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: fetchLatestMetric (single) ────────────────────────────
export async function fetchLatestMetric(metricName) {
  try {
    const res = await fetch(
      restUrl(`live_metrics?metric_name=eq.${metricName}&order=timestamp.desc&limit=1`),
      { headers: buildHeaders() }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return { success: true, data: data[0] || null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: fetchLatestPerMetric (all 5) ──────────────────────────
export async function fetchLatestPerMetric() {
  try {
    const results = await Promise.all(
      VALID_METRIC_NAMES.map(name => fetchLatestMetric(name))
    );
    const data = results
      .filter(r => r.success && r.data)
      .map(r => r.data);
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: fetchMetricById ───────────────────────────────────────
export async function fetchMetricById(id) {
  try {
    const res = await fetch(
      restUrl(`live_metrics?id=eq.${id}`),
      { headers: buildHeaders() }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return { success: true, data: data[0] || null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: insertMetric ──────────────────────────────────────────
export async function insertMetric({ device_id, metric_name, metric_value, unit, status }) {
  // Validate metric_name
  if (!VALID_METRIC_NAMES.includes(metric_name)) {
    return { success: false, data: null, error: 'Invalid metric_name' };
  }
  // Validate status
  if (status && !VALID_STATUSES.includes(status)) {
    return { success: false, data: null, error: 'Invalid status value' };
  }

  try {
    const res = await fetch(
      restUrl('live_metrics'),
      {
        method: 'POST',
        headers: buildHeaders('POST'),
        body: JSON.stringify({ device_id, metric_name, metric_value, unit, status })
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: updateMetricStatus ────────────────────────────────────
export async function updateMetricStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, data: null, error: 'Invalid status value' };
  }

  try {
    const res = await fetch(
      restUrl(`live_metrics?id=eq.${id}`),
      {
        method: 'PATCH',
        headers: buildHeaders('PATCH'),
        body: JSON.stringify({ status })
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: deleteMetric ──────────────────────────────────────────
export async function deleteMetric(id) {
  try {
    const res = await fetch(
      restUrl(`live_metrics?id=eq.${id}`),
      {
        method: 'DELETE',
        headers: buildHeaders()
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return { success: true, data: null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// ── PUBLIC: insertTestRow ─────────────────────────────────────────
export async function insertTestRow() {
  const metricName = VALID_METRIC_NAMES[Math.floor(Math.random() * VALID_METRIC_NAMES.length)];
  const t = METRIC_THRESHOLDS[metricName];

  // Generate a random realistic value within the metric's range
  const metricValue = Math.round(
    (t.min + Math.random() * (t.max - t.min)) * 10
  ) / 10;

  const status = determineStatus(metricName, metricValue);

  return insertMetric({
    device_id: 'rover_01',
    metric_name: metricName,
    metric_value: metricValue,
    unit: t.unit,
    status: status
  });
}
