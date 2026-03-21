// ═══════════════════════════════════════════════════════════════════
// autonix_devkit.ino — AUTONIX Rover Main Controller
// 6-State machine: IDLE → TRACKING → APPROACHING → SUPPRESSING
//                  OBSTACLE → STOPPED
// All timing via millis(). No delay() in main loop.
// Team: INSNAPERZ
// ═══════════════════════════════════════════════════════════════════

#include "config.h"
#include "motor_control.h"
#include "ultrasonic.h"
#include "flame_sensor.h"
#include "servo_radar.h"
#include "acoustic_weapon.h"
#include "oled_display.h"
#include "serial_parser.h"
#include "uart_cam_bridge.h"

// ── STATE MACHINE ─────────────────────────────────────────────────
enum RoverState {
  IDLE,         // Sweeping servo, waiting for fire
  TRACKING,     // Fire detected, rotating toward it
  APPROACHING,  // Driving toward fire
  SUPPRESSING,  // At optimal distance, weapon firing
  OBSTACLE,     // Obstacle encountered, backing off
  STOPPED       // Manual stop from laptop command
};

static RoverState state = IDLE;

// ── FIRE EXTINCTION DETECTION ─────────────────────────────────────
static int  noFireCount     = 0;
static const int NO_FIRE_CONFIRM = 3; // Consecutive no-fire readings

// ── OBSTACLE STATE TIMING (non-blocking) ─────────────────────────
static unsigned long obstacleStartMs   = 0;
static bool          obstacleReversing  = false;
static bool          obstacleTurning    = false;
static const unsigned long REVERSE_MS  = 500;
static const unsigned long TURN_MS     = 300;

// ── TELEMETRY TIMING ──────────────────────────────────────────────
static unsigned long lastTelemetryMs = 0;

// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(300); // Stabilize USB serial

  motorsInit();
  ultrasonicInit();
  flameSensorInit();
  servoInit();
  acousticInit();
  oledInit();
  camBridgeInit();
  serialParserInit();  // Re-init confirms baud, flushes buffer

  state = IDLE;
  Serial.println("STATUS:AUTONIX Dev Kit -- Ready");
}

// ─────────────────────────────────────────────────────────────────
void loop() {

  // ── STEP 1: CHECK SERIAL COMMANDS FROM LAPTOP ─────────────────
  SerialCommand cmd = checkSerialCommand();

  if (cmd.type == "SET_FREQ") {
    fireWeapon(cmd.value);
    state = SUPPRESSING;
    Serial.print("CMD:SET_FREQ:");
    Serial.println(cmd.value);
  }
  else if (cmd.type == "STOP") {
    stopWeapon();
    stopMotors();
    state = STOPPED;
    Serial.println("CMD:STOP received");
  }

  // ── STEP 2: READ SENSORS ──────────────────────────────────────
  FlameReading flame = readFlameSensors();
  float        dist  = readDistanceCM();
  int          angle = getCurrentAngle();

  // ── STEP 3: STATE MACHINE ─────────────────────────────────────
  switch (state) {

    // ── IDLE: sweep servo, await fire ────────────────────────────
    case IDLE:
      autoSweep();
      if (flame.fireDetected) {
        state = TRACKING;
        noFireCount = 0;
        sendToCam("FIRE_DETECTED");
        Serial.println("STATUS:Fire detected — entering TRACKING");
      }
      break;

    // ── TRACKING: align rover with fire direction ─────────────────
    case TRACKING:
      sweepTo(flame.directionDeg); // Point sensor at fire

      if (flame.directionDeg < 80) {
        turnLeft(MOTOR_SPEED_SLOW);
      } else if (flame.directionDeg > 100) {
        turnRight(MOTOR_SPEED_SLOW);
      } else {
        // Aligned — stop turning and begin approach
        stopMotors();
        state = APPROACHING;
        Serial.println("STATUS:Aligned — entering APPROACHING");
      }

      // Lost fire while tracking
      if (!flame.fireDetected) {
        stopMotors();
        state = IDLE;
        Serial.println("STATUS:Fire lost — returning to IDLE");
      }
      break;

    // ── APPROACHING: drive toward fire ────────────────────────────
    case APPROACHING:
      if (isObstacleDetected()) {
        stopMotors();
        obstacleStartMs  = millis();
        obstacleReversing = true;
        obstacleTurning   = false;
        state = OBSTACLE;
        Serial.println("STATUS:Obstacle detected — entering OBSTACLE");
        break;
      }

      if (isAtOptimalFireDistance()) {
        stopMotors();
        state = SUPPRESSING;
        Serial.println("STATUS:Optimal distance reached — entering SUPPRESSING");
      } else {
        moveForward(MOTOR_SPEED_NORMAL);
      }
      break;

    // ── SUPPRESSING: hold position, weapon fires via laptop cmd ───
    case SUPPRESSING:
      stopMotors(); // Rover holds position

      if (!flame.fireDetected) {
        noFireCount++;
        if (noFireCount >= NO_FIRE_CONFIRM) {
          stopWeapon();
          state = IDLE;
          noFireCount = 0;
          sendToCam("FIRE_OUT");
          Serial.println("STATUS:FIRE EXTINGUISHED — returning to IDLE");
        }
      } else {
        noFireCount = 0; // Reset if fire still detected
      }
      break;

    // ── OBSTACLE: reverse then turn right, non-blocking ───────────
    case OBSTACLE: {
      unsigned long elapsed = millis() - obstacleStartMs;

      if (obstacleReversing) {
        moveBackward(MOTOR_SPEED_SLOW);
        if (elapsed >= REVERSE_MS) {
          stopMotors();
          obstacleReversing = false;
          obstacleTurning   = true;
          obstacleStartMs   = millis(); // Reset timer for turn phase
        }
      } else if (obstacleTurning) {
        turnRight(MOTOR_SPEED_SLOW);
        if (elapsed >= TURN_MS) {
          stopMotors();
          obstacleTurning = false;
          state = APPROACHING;
          Serial.println("STATUS:Obstacle cleared — returning to APPROACHING");
        }
      }
      break;
    }

    // ── STOPPED: await next SET_FREQ from laptop ──────────────────
    case STOPPED:
      stopMotors();
      stopWeapon();
      // Waiting — next SET_FREQ will change state to SUPPRESSING
      break;
  }

  // ── STEP 4: UPDATE OLED ───────────────────────────────────────
  updateDisplay(getCurrentFreq(), dist, angle,
                flame.fireDetected, isWeaponActive());

  // ── STEP 5: TELEMETRY TO LAPTOP every 500ms ───────────────────
  unsigned long now = millis();
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = now;

    // Format: "TEL:{dist:.1f}:{angle}:{center_flame_value}"
    Serial.print("TEL:");
    Serial.print(dist, 1);
    Serial.print(":");
    Serial.print(angle);
    Serial.print(":");
    Serial.println(flame.values[2]); // Center channel
  }

  // ── Read any messages from cam ────────────────────────────────
  String camMsg = readFromCam();
  if (camMsg.length() > 0) {
    Serial.print("STATUS:CAM says: ");
    Serial.println(camMsg);
  }
}
