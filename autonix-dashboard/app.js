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

// ── FEATURE 2: WAVEFORM VISUALIZER ───────────────────────────────
let waveformCanvas   = null;
let waveformCtx      = null;
let waveformFreq     = 0;       // Current Hz (0 = silent)
let waveformCritical = false;   // true when status === 'critical'
let waveformPhase    = 0;       // Sine wave phase — advances per frame
let waveformAnimId   = null;    // requestAnimationFrame handle

// ── FEATURE 4: AI TERMINAL ────────────────────────────────────────
const AI_MESSAGES = {
  idle:        '> SYSTEM NOMINAL. SCANNING ENVIRONMENT...',
  anomaly:     '> THERMAL ANOMALY DETECTED. ANALYZING...',
  threat:      '> THREAT CONFIRMED. CLOSING DISTANCE TO TARGET...',
  suppressing: (hz) => `> TARGET LOCKED. DISCHARGING ACOUSTIC PULSE AT ${hz}Hz...`,
  extinguished:'> THREAT NEUTRALIZED. RETURNING TO PATROL MODE...'
};

let aiLatestFlame = 0;
let aiLatestFreq  = 0;
let aiLatestDist  = 999;

let typewriterTimer   = null;
let typewriterCurrent = '';
const TYPEWRITER_MS   = 28;

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

  // ── FEATURE 2: Waveform data wiring ──────────────────────────
  if (data.metric_name === 'frequency_hz') {
    waveformFreq     = parseFloat(data.metric_value) || 0;
    waveformCritical = (data.status === 'critical');
  }

  // ── FEATURE 4: AI terminal data wiring ───────────────────────
  if (data.metric_name === 'flame_intensity') {
    aiLatestFlame = parseFloat(data.metric_value) || 0;
  }
  if (data.metric_name === 'frequency_hz') {
    aiLatestFreq  = parseFloat(data.metric_value) || 0;
  }
  if (data.metric_name === 'target_distance_cm') {
    aiLatestDist  = parseFloat(data.metric_value) || 999;
  }
  updateAIStatus();
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
  const camInput          = document.getElementById('cam-ip-input');
  const setStreamBtn      = document.getElementById('set-stream-btn');
  const disconnectBtn     = document.getElementById('disconnect-stream-btn');
  const liveCamFeed       = document.getElementById('live-cam-feed');
  const streamOfflineMsg  = document.getElementById('stream-offline-msg');
  const camStatusBadge    = document.getElementById('cam-status-badge');

  function setCamBadge(state) {
    if (!camStatusBadge) return;
    const states = {
      offline:     { text: 'ESP32-CAM ● MJPEG',  color: '#444444' },
      connecting:  { text: 'ESP32-CAM ◌ CONNECTING', color: '#FF6B35' },
      live:        { text: 'ESP32-CAM ● LIVE',    color: '#00FF9C' },
      error:       { text: 'ESP32-CAM ✕ ERROR',   color: '#FF4444' }
    };
    const s = states[state] || states.offline;
    camStatusBadge.textContent = s.text;
    camStatusBadge.style.color = s.color;
  }

  function connectStream(url) {
    if (!url || url.trim() === '') {
      setCamBadge('error');
      camInput.style.borderColor = '#FF4444';
      setTimeout(() => {
        camInput.style.borderColor = '';
      }, 2000);
      return;
    }

    setStreamBtn.textContent     = 'CONNECTING...';
    setStreamBtn.disabled        = true;
    setCamBadge('connecting');

    localStorage.setItem('autonix_cam_url', url.trim());

    liveCamFeed.src = url.trim();

    liveCamFeed.onload = () => {
      liveCamFeed.style.display      = 'block';
      streamOfflineMsg.style.display = 'none';
      disconnectBtn.style.display    = 'inline-block';
      setStreamBtn.style.display     = 'none';
      setCamBadge('live');
      console.log('[STREAM] Connected:', url);
    };

    liveCamFeed.onerror = () => {
      liveCamFeed.style.display      = 'none';
      streamOfflineMsg.style.display = 'flex';
      setStreamBtn.textContent       = 'SET STREAM';
      setStreamBtn.disabled          = false;
      disconnectBtn.style.display    = 'none';
      setStreamBtn.style.display     = 'inline-block';
      setCamBadge('error');
      console.warn('[STREAM] Failed to connect:', url);
    };
  }

  function disconnectStream() {
    liveCamFeed.src                = '';
    liveCamFeed.style.display      = 'none';
    streamOfflineMsg.style.display = 'flex';
    disconnectBtn.style.display    = 'none';
    setStreamBtn.style.display     = 'inline-block';
    setStreamBtn.textContent       = 'SET STREAM';
    setStreamBtn.disabled          = false;
    setCamBadge('offline');

    localStorage.removeItem('autonix_cam_url');
    camInput.value = '';

    console.log('[STREAM] Disconnected');
  }

  setStreamBtn.addEventListener('click', () => {
    connectStream(camInput.value);
  });

  camInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectStream(camInput.value);
  });

  disconnectBtn.addEventListener('click', () => {
    disconnectStream();
  });

  const savedStreamURL = localStorage.getItem('autonix_cam_url');
  if (savedStreamURL) {
    camInput.value = savedStreamURL;
    connectStream(savedStreamURL);
  }
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
// FEATURE 2: LIVE AUDIO WAVEFORM VISUALIZER
// ═══════════════════════════════════════════════════════════════════
function initWaveform() {
  waveformCanvas = document.getElementById('audio-waveform');
  if (!waveformCanvas) return;
  waveformCtx = waveformCanvas.getContext('2d');
  animateWaveform();
}

function animateWaveform() {
  waveformAnimId = requestAnimationFrame(animateWaveform);

  const ctx = waveformCtx;
  const W   = waveformCanvas.width;
  const H   = waveformCanvas.height;
  const cx  = H / 2;

  // Trail effect — not a full clear
  ctx.fillStyle = 'rgba(5, 5, 5, 0.88)';
  ctx.fillRect(0, 0, W, H);

  ctx.beginPath();
  ctx.lineWidth = 1.5;

  if (waveformFreq === 0) {
    // SILENT: flat faint blue centre line
    ctx.strokeStyle = 'rgba(0, 191, 255, 0.18)';
    ctx.moveTo(0, cx);
    ctx.lineTo(W, cx);
  } else {
    // ACTIVE: animated sine wave
    ctx.strokeStyle = waveformCritical ? '#FF4444' : '#00BFFF';

    // Amplitude: 6px at 30Hz → 16px at 60Hz
    const amplitude = 6 + ((waveformFreq - 30) / 30) * 10;

    // Phase advances faster at higher Hz
    waveformPhase += waveformFreq * 0.003;

    // Visible cycles scale with Hz
    const cycles = waveformFreq / 30;

    for (let x = 0; x < W; x++) {
      const y = cx + amplitude *
        Math.sin((x / W) * Math.PI * 2 * cycles + waveformPhase);
      if (x === 0) ctx.moveTo(x, y);
      else          ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Frequency label — bottom-right corner
  ctx.font      = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = waveformFreq > 0
    ? (waveformCritical ? 'rgba(255,68,68,0.7)' : 'rgba(0,191,255,0.6)')
    : 'rgba(0,191,255,0.15)';
  ctx.fillText(
    waveformFreq > 0 ? `${waveformFreq}Hz ACTIVE` : 'SILENT',
    W - 4,
    H - 4
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE 4: AI STATUS TERMINAL (TYPEWRITER)
// ═══════════════════════════════════════════════════════════════════
function typeMessage(message, isCritical = false) {
  clearTimeout(typewriterTimer);

  const textEl = document.getElementById('ai-status-text');
  const barEl  = document.getElementById('ai-terminal-bar');
  if (!textEl || !barEl) return;

  // Guard: same message already fully typed — skip
  if (typewriterCurrent === message && textEl.textContent === message) return;

  typewriterCurrent  = message;
  textEl.textContent = '';
  let charIndex      = 0;

  if (isCritical) barEl.classList.add('critical');
  else             barEl.classList.remove('critical');

  function typeNextChar() {
    if (charIndex < message.length) {
      textEl.textContent += message[charIndex];
      charIndex++;
      typewriterTimer = setTimeout(typeNextChar, TYPEWRITER_MS);
    } else {
      // Fully typed — loop to idle after 8s if not critical
      if (!isCritical) {
        typewriterTimer = setTimeout(() => {
          if (typewriterCurrent === message) {
            typeMessage(AI_MESSAGES.idle, false);
          }
        }, 8000);
      }
    }
  }

  typeNextChar();
}

function updateAIStatus() {
  if (aiLatestFreq > 0) {
    typeMessage(AI_MESSAGES.suppressing(aiLatestFreq), true);
  } else if (aiLatestFlame > 60) {
    typeMessage(AI_MESSAGES.threat, true);
  } else if (aiLatestFlame > 20) {
    typeMessage(AI_MESSAGES.anomaly, false);
  } else {
    typeMessage(AI_MESSAGES.idle, false);
  }
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
  initWaveform();                           // Feature 2
  typeMessage(AI_MESSAGES.idle, false);     // Feature 4
  console.log('[AUTONIX] Command Center initialized.');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
