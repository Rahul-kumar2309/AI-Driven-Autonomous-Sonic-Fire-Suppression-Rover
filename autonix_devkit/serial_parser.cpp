// ═══════════════════════════════════════════════════════════════════
// serial_parser.cpp — Laptop Serial Command Parser Implementation
// Parses "SET_FREQ:{hz}\n" and "STOP\n" from UART0 (USB Serial).
// ═══════════════════════════════════════════════════════════════════
#include "serial_parser.h"
#include "config.h"
#include "Arduino.h"

static String serialBuffer = "";

void serialParserInit() {
  Serial.begin(SERIAL_BAUD);
  while (!Serial) { delay(10); } // Wait for USB serial to be ready
  // Clear any garbage in the input buffer
  while (Serial.available()) {
    Serial.read();
  }
  Serial.println("STATUS:Serial parser ready");
}

SerialCommand checkSerialCommand() {
  SerialCommand cmd = { "NONE", 0 };

  // Accumulate available chars into buffer
  while (Serial.available()) {
    char c = (char)Serial.read();

    if (c == '\n') {
      // Complete command received — trim whitespace
      serialBuffer.trim();

      if (serialBuffer.startsWith("SET_FREQ:")) {
        // Extract integer after the colon
        String freqStr = serialBuffer.substring(9); // len("SET_FREQ:") = 9
        int freq = freqStr.toInt();
        cmd.type  = "SET_FREQ";
        cmd.value = freq;
      } else if (serialBuffer == "STOP") {
        cmd.type  = "STOP";
        cmd.value = 0;
      } else if (serialBuffer.length() > 0) {
        cmd.type  = "UNKNOWN";
        cmd.value = 0;
      }

      serialBuffer = ""; // Reset buffer for next command
      return cmd;
    } else {
      serialBuffer += c;

      // Guard against buffer overflow (max 64 chars)
      if (serialBuffer.length() > 64) {
        serialBuffer = "";
      }
    }
  }

  return cmd; // No complete command yet
}
