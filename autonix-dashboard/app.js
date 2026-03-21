// ═══════════════════════════════════════════════════════════════════
// AUTONIX Command Center — Master Controller (app.js)
// ═══════════════════════════════════════════════════════════════════
// Initializes Supabase client, loads initial metric data,
// subscribes to Realtime, handles UI updates and alert state.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config/supabase-config.js';
import { fetchAllMetrics, fetchLatestMetric, insertTestRow } from './api/rest-handler.js';
import { initThreeScene, updateThreeScene, triggerAlertState } from './three-scene.js';

// ── SUPABASE CLIENT ───────────────────────────────────────────────
let supabase = null;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.warn('[AUTONIX] Supabase client creation failed — running in offline mode.', err.message);
}

// ── DOM CACHE ─────────────────────────────────────────────────────
const DOM = {
  navBar:         document.getElementById('nav-bar'),
  liveDot:        document.getElementById('live-dot'),
  connectionText: document.getElementById('connection-text'),
  connectionBadge:document.getElementById('connection-badge'),
  utcClock:       document.getElementById('utc-clock'),
  activityLog:    document.getElementById('activity-log'),
  visionFeed:     document.getElementById('vision-feed'),
  camIpInput:     document.getElementById('cam-ip-input'),
  camIpSet:       document.getElementById('cam-ip-set'),
  btnInsertTest:  document.getElementById('btn-insert-test'),
  btnFetchAll:    document.getElementById('btn-fetch-all'),
  btnClearLog:    document.getElementById('btn-clear-log'),
  cards: {
    frequency_hz:        document.getElementById('card-freq'),
    battery_level:       document.getElementById('card-battery'),
    flame_intensity:     document.getElementById('card-flame'),
    radar_angle:         document.getElementById('card-radar'),
    target_distance_cm:  document.getElementById('card-distance')
  }
};

// ── STATUS COLOR MAP ──────────────────────────────────────────────
const STATUS_COLORS = {
  nominal:  '#00BFFF',
  warning:  '#FF6B35',
  critical: '#FF4444'
};

// ── METRIC NAMES LIST ─────────────────────────────────────────────
const METRIC_NAMES = [
  'frequency_hz',
  'battery_level',
  'flame_intensity',
  'radar_angle',
  'target_distance_cm'
];

// ── MAX LOG ENTRIES ───────────────────────────────────────────────
const MAX_LOG_ENTRIES = 50;

// ═══════════════════════════════════════════════════════════════════
// IST CLOCK
// ═══════════════════════════════════════════════════════════════════
function startIstClock() {
  function tick() {
    const now = new Date();
    const timeString = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    DOM.utcClock.textContent = `${timeString} IST`;
  }
  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTION BADGE
// ═══════════════════════════════════════════════════════════════════
function updateConnectionBadge(status) {
  if (status === 'LIVE') {
    DOM.liveDot.classList.remove('offline');
    DOM.connectionBadge.classList.remove('offline');
    DOM.connectionText.textContent = 'LIVE';
  } else {
    DOM.liveDot.classList.add('offline');
    DOM.connectionBadge.classList.add('offline');
    DOM.connectionText.textContent = 'OFFLINE';
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORMAT TIMESTAMP (IST)
// ═══════════════════════════════════════════════════════════════════
function formatTimestamp(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE METRIC CARD
// ═══════════════════════════════════════════════════════════════════
function updateMetricCard(data) {
  if (!data || !data.metric_name) return;

  const card = DOM.cards[data.metric_name];
  if (!card) return;

  const status = data.status || 'nominal';
  const accent = STATUS_COLORS[status] || STATUS_COLORS.nominal;
  const unit = data.unit || '';
  const value = data.metric_value != null ? data.metric_value : '—';

  // Update value text
  const valueEl = card.querySelector('.m-value');
  valueEl.textContent = unit ? `${value} ${unit}` : `${value}`;

  // Update timestamp
  const tsEl = card.querySelector('.m-timestamp');
  tsEl.textContent = formatTimestamp(data.timestamp);

  // Update status badge
  const statusEl = card.querySelector('.m-status');
  statusEl.textContent = status.toUpperCase();

  // Update status class on card
  card.classList.remove('status-nominal', 'status-warning', 'status-critical');
  card.classList.add(`status-${status}`);
}

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════
function appendLogEntry(data, isAlert = false) {
  const li = document.createElement('li');
  const ts = formatTimestamp(data.timestamp || new Date().toISOString());
  const device = data.device_id || 'unknown';
  const name = data.metric_name || '?';
  const value = data.metric_value != null ? data.metric_value : '?';
  const unit = data.unit || '';
  const status = data.status || 'nominal';
  const accent = STATUS_COLORS[status] || STATUS_COLORS.nominal;

  if (isAlert) {
    li.classList.add('log-alert');
    li.innerHTML = `<span class="log-time">[${ts}]</span> [ALERT] FIRE DETECTED — AI SUPPRESSION ENGAGED`;
  } else {
    li.innerHTML = `<span class="log-time">[${ts}]</span> ${device} → ${name}: <span class="log-value" style="color:${accent}">${value} ${unit}</span> (${status})`;
  }

  DOM.activityLog.appendChild(li);

  // Trim to max entries
  while (DOM.activityLog.children.length > MAX_LOG_ENTRIES) {
    DOM.activityLog.removeChild(DOM.activityLog.firstChild);
  }

  // Auto-scroll
  DOM.activityLog.scrollTop = DOM.activityLog.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════════
// ALERT STATE (Critical flame_intensity)
// ═══════════════════════════════════════════════════════════════════
function fireAlertState(data) {
  // Add alert-active to nav and all metric cards
  DOM.navBar.classList.add('alert-active');
  document.querySelectorAll('.metric-card').forEach(c => c.classList.add('alert-active'));

  // Trigger Three.js alert
  triggerAlertState();

  // Append special log entry
  appendLogEntry(data, true);

  // Remove alert classes after 3 seconds
  setTimeout(() => {
    DOM.navBar.classList.remove('alert-active');
    document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('alert-active'));
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════
// HANDLE REALTIME PAYLOAD
// ═══════════════════════════════════════════════════════════════════
function handleRealtimePayload(payload) {
  const data = payload.new;
  if (!data) return;

  // Update the metric card
  updateMetricCard(data);

  // Append log entry
  appendLogEntry(data);

  // Update Three.js scene
  updateThreeScene(data);

  // CRITICAL FIRE ALERT check
  if (
    data.metric_name === 'flame_intensity' &&
    data.status === 'critical' &&
    data.metric_value >= 80
  ) {
    fireAlertState(data);
  }
}

// ═══════════════════════════════════════════════════════════════════
// INITIAL DATA LOAD — fetch latest row per metric
// ═══════════════════════════════════════════════════════════════════
async function loadInitialData() {
  if (!supabase) {
    console.warn('[AUTONIX] Skipping initial data load — no Supabase connection.');
    return;
  }
  const results = await Promise.all(
    METRIC_NAMES.map(name => fetchLatestMetric(name))
  );

  results.forEach(result => {
    if (result.success && result.data) {
      updateMetricCard(result.data);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════
function startRealtimeSubscription() {
  if (!supabase) {
    console.warn('[AUTONIX] Skipping realtime subscription — no Supabase connection.');
    return;
  }
  supabase.channel('live-metrics-feed')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_metrics'
    }, (payload) => {
      handleRealtimePayload(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        updateConnectionBadge('LIVE');
      } else {
        updateConnectionBadge('OFFLINE');
      }
    });
}

// ═══════════════════════════════════════════════════════════════════
// VISION FEED CONTROLS
// ═══════════════════════════════════════════════════════════════════
function setupVisionFeed() {
  DOM.camIpSet.addEventListener('click', () => {
    const url = DOM.camIpInput.value.trim();
    if (url) {
      DOM.visionFeed.src = url;
      DOM.visionFeed.alt = 'Connecting...';
    }
  });

  DOM.camIpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      DOM.camIpSet.click();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// BOTTOM BAR BUTTONS
// ═══════════════════════════════════════════════════════════════════
function setupBottomBar() {
  // INSERT TEST ROW
  DOM.btnInsertTest.addEventListener('click', async () => {
    DOM.btnInsertTest.disabled = true;
    DOM.btnInsertTest.textContent = 'INSERTING...';
    const result = await insertTestRow();
    if (result.success) {
      console.log('[AUTONIX] Test row inserted:', result.data);
    } else {
      console.error('[AUTONIX] Insert failed:', result.error);
    }
    DOM.btnInsertTest.disabled = false;
    DOM.btnInsertTest.textContent = 'INSERT TEST ROW';
  });

  // FETCH ALL
  DOM.btnFetchAll.addEventListener('click', async () => {
    DOM.btnFetchAll.disabled = true;
    DOM.btnFetchAll.textContent = 'FETCHING...';
    const result = await fetchAllMetrics();
    if (result.success) {
      console.log('[AUTONIX] All metrics:', result.data);
    } else {
      console.error('[AUTONIX] Fetch failed:', result.error);
    }
    DOM.btnFetchAll.disabled = false;
    DOM.btnFetchAll.textContent = 'FETCH ALL';
  });

  // CLEAR LOG
  DOM.btnClearLog.addEventListener('click', () => {
    DOM.activityLog.innerHTML = '';
  });
}

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
function boot() {
  startIstClock();
  setupVisionFeed();
  setupBottomBar();
  initThreeScene();
  loadInitialData();
  startRealtimeSubscription();
  console.log('[AUTONIX] Command Center initialized.');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
