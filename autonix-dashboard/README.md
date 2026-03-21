# ⬡ AUTONIX Command Center

A real-time monitoring dashboard for the **Autonomous Sonic Fire Suppression Rover**. AUTONIX tracks live telemetry data — acoustic frequency output, battery level, flame intensity, radar angle, and target distance — through a Supabase-powered realtime pipeline, rendered in a Deep Obsidian & Neon UI with a Three.js 3D digital twin.

---

## Tech Stack

| Technology | Purpose | Source / Version |
|---|---|---|
| Supabase | Realtime DB + REST API | [supabase.com](https://supabase.com) |
| Three.js | WebGL 3D Digital Twin | CDN r128 |
| Supabase JS v2 | Realtime client | CDN jsdelivr |
| JetBrains Mono | Monospace UI font | Google Fonts |
| Inter | UI sans-serif font | Google Fonts |
| ESP32-CAM | MJPEG video stream source | Local network |

---

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project. Wait for it to initialize.

### 2. Run the SQL Schema

Open the **Supabase SQL Editor** and paste the full schema from `config/supabase-config.js`. This creates the `live_metrics` table:

```sql
CREATE TABLE live_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       TEXT NOT NULL,
  metric_name     TEXT NOT NULL,
  metric_value    NUMERIC NOT NULL,
  unit            TEXT,
  status          TEXT DEFAULT 'nominal',
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Enable Realtime

Run this in the SQL Editor:

```sql
ALTER TABLE live_metrics REPLICA IDENTITY FULL;
```

Then add the CHECK constraints:

```sql
ALTER TABLE live_metrics
  ADD CONSTRAINT valid_metric_name CHECK (
    metric_name IN (
      'frequency_hz', 'battery_level', 'flame_intensity',
      'radar_angle', 'target_distance_cm'
    )
  );

ALTER TABLE live_metrics
  ADD CONSTRAINT valid_status CHECK (
    status IN ('nominal', 'warning', 'critical')
  );
```

### 4. Enable Realtime in the Dashboard

Go to **Supabase → Table Editor → live_metrics** and toggle **Realtime ON**.

### 5. Configure API Keys

Go to **Supabase → Settings → API** and copy:
- **Project URL** → paste into `config/supabase-config.js` as `SUPABASE_URL`
- **anon (public) key** → paste as `SUPABASE_ANON_KEY`

### 6. Open in Browser

Simply open `index.html` in any modern browser. **Zero build step required.**

### 7. Set ESP32-CAM Stream

Enter your ESP32-CAM stream URL (e.g. `http://192.168.1.100/stream`) in the vision panel input field and click **SET STREAM**.

---

## Simulate Live Data

Paste this into the Supabase SQL Editor to insert test data. The dashboard will update instantly via Realtime:

```sql
INSERT INTO live_metrics (device_id, metric_name, metric_value, unit, status)
VALUES
  ('rover_01', 'frequency_hz',        42,   'Hz',  'nominal'),
  ('rover_01', 'battery_level',       87,   '%',   'nominal'),
  ('rover_01', 'flame_intensity',     91,   '',    'critical'),
  ('rover_01', 'radar_angle',         127,  '°',   'warning'),
  ('rover_01', 'target_distance_cm',  38,   'cm',  'nominal');
```

Or click the **INSERT TEST ROW** button in the dashboard bottom bar.

---

## Trigger Fire Alert State

To test the full critical alert sequence (UI pulse + WebGL red burst), run:

```sql
INSERT INTO live_metrics (device_id, metric_name, metric_value, unit, status)
VALUES ('rover_01', 'flame_intensity', 95, '', 'critical');
```

This triggers:
- Nav bar and all metric cards pulse red for 3 seconds
- 3D icosahedron flashes red
- 40-particle red burst in WebGL scene
- Special `[ALERT] FIRE DETECTED — AI SUPPRESSION ENGAGED` log entry

---

## Folder Structure

```
autonix-dashboard/
├── index.html              ← Single entry point (SPA layout)
├── style.css               ← Deep Obsidian & Neon design system
├── app.js                  ← Master controller (Supabase + UI logic)
├── three-scene.js          ← Three.js / WebGL 3D digital twin
├── api/
│   └── rest-handler.js     ← REST API fetch calls (CRUD + validation)
├── config/
│   └── supabase-config.js  ← Supabase URL + anon key + SQL schema
├── assets/
│   └── (reserved)
└── README.md               ← This file
```

---

## Known Limitations

- **Vision feed** requires the rover and dashboard to be on the same local network.
- **No authentication layer** — add Supabase Row Level Security (RLS) for production use.
- **Three.js** loaded via CDN r128 — for production, consider bundling or upgrading to a newer release.
