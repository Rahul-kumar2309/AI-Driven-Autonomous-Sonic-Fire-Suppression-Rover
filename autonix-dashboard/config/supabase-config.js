// ═══════════════════════════════════════════════════════════════════
// SUPABASE CONFIGURATION — AUTONIX Command Center
// ═══════════════════════════════════════════════════════════════════
// Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below with
// your actual Supabase project credentials found under:
//   Supabase → Settings → API → Project URL / anon (public) key
// ═══════════════════════════════════════════════════════════════════

export const SUPABASE_URL = 'https://zwahvtpzgxyhrhlgutyt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3YWh2dHB6Z3h5aHJobGd1dHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTI2NjAsImV4cCI6MjA4OTYyODY2MH0.VQMhNRSxIvSRDsuGEL57vizRvq6LQHR-61HhpKIhnYs';

// ═══════════════════════════════════════════════════════════════════
// SQL SCHEMA — Paste the following into Supabase SQL Editor
// ═══════════════════════════════════════════════════════════════════
//
// -- Create the live_metrics table
// CREATE TABLE live_metrics (
//   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   device_id       TEXT NOT NULL,
//   metric_name     TEXT NOT NULL,
//   metric_value    NUMERIC NOT NULL,
//   unit            TEXT,
//   status          TEXT DEFAULT 'nominal',
//   timestamp       TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Enable Realtime on this table:
// ALTER TABLE live_metrics REPLICA IDENTITY FULL;
//
// -- Add a CHECK constraint to enforce only the 5 valid metric names:
// ALTER TABLE live_metrics
//   ADD CONSTRAINT valid_metric_name CHECK (
//     metric_name IN (
//       'frequency_hz',
//       'battery_level',
//       'flame_intensity',
//       'radar_angle',
//       'target_distance_cm'
//     )
//   );
//
// -- Add a CHECK constraint to enforce valid status values:
// ALTER TABLE live_metrics
//   ADD CONSTRAINT valid_status CHECK (
//     status IN ('nominal', 'warning', 'critical')
//   );
//
// -- Sample INSERT to simulate all 5 metrics for testing:
// INSERT INTO live_metrics (device_id, metric_name, metric_value, unit, status)
// VALUES
//   ('rover_01', 'frequency_hz',        42,   'Hz',  'nominal'),
//   ('rover_01', 'battery_level',       87,   '%',   'nominal'),
//   ('rover_01', 'flame_intensity',     91,   '',    'critical'),
//   ('rover_01', 'radar_angle',         127,  '°',   'warning'),
//   ('rover_01', 'target_distance_cm',  38,   'cm',  'nominal');
//
// ═══════════════════════════════════════════════════════════════════
