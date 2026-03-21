// ═══════════════════════════════════════════════════════════════════
// serial_parser.h — Laptop Serial Command Parser
// ═══════════════════════════════════════════════════════════════════
#pragma once
#include "Arduino.h"

struct SerialCommand {
  String type;   // "SET_FREQ" | "STOP" | "UNKNOWN" | "NONE"
  int    value;  // Frequency in Hz (only valid for SET_FREQ)
};

void          serialParserInit();
SerialCommand checkSerialCommand();
