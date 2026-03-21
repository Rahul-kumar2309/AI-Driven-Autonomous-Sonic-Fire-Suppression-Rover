# ═══════════════════════════════════════════════════════════════════
# AUTONIX AI Edge Server — Serial UART Commander
# ═══════════════════════════════════════════════════════════════════
# Thread-safe serial interface to the ESP32 Dev Kit.
# Sends SET_FREQ and STOP commands to control the TPA3118 amplifier.
# Gracefully degrades if pyserial is not installed.
# ═══════════════════════════════════════════════════════════════════

import logging
import threading

from colorama import Fore, Style

try:
    import serial
    PYSERIAL_AVAILABLE = True
except ImportError:
    PYSERIAL_AVAILABLE = False

logger = logging.getLogger("serial_commander")


class SerialCommander:
    """Thread-safe serial command sender for the ESP32 TPA3118 controller."""

    def __init__(self, port: str, baud: int, enabled: bool = True):
        self.port = port
        self.baud = baud
        self.enabled = enabled and PYSERIAL_AVAILABLE
        self._lock = threading.Lock()
        self._ser = None

        if not PYSERIAL_AVAILABLE:
            logger.warning(
                "%spyserial not installed — serial commands disabled. "
                "Install with: pip install pyserial%s",
                Fore.YELLOW, Style.RESET_ALL,
            )
            self.enabled = False
            return

        if not enabled:
            logger.info("Serial disabled in config (SERIAL_ENABLED = False).")
            return

        try:
            self._ser = serial.Serial(port, baud, timeout=1)
            logger.info(
                "%sSerial connected: %s @ %d baud%s",
                Fore.GREEN, port, baud, Style.RESET_ALL,
            )
        except serial.SerialException as exc:
            logger.error(
                "%sSerial connection failed on %s: %s%s",
                Fore.RED, port, exc, Style.RESET_ALL,
            )
            self.enabled = False
        except Exception as exc:
            logger.error(
                "%sUnexpected serial error: %s%s",
                Fore.RED, exc, Style.RESET_ALL,
            )
            self.enabled = False

    def send_freq(self, freq_hz: int) -> bool:
        """Send SET_FREQ:{freq_hz} command to ESP32.

        Returns True on success, False on failure.
        """
        if not self.enabled or self._ser is None:
            return False

        command = f"SET_FREQ:{freq_hz}\n"
        with self._lock:
            try:
                self._ser.write(command.encode("utf-8"))
                self._ser.flush()
                logger.info(
                    "%sSerial TX → %s%s",
                    Fore.CYAN, command.strip(), Style.RESET_ALL,
                )
                return True
            except Exception as exc:
                logger.error(
                    "%sSerial send_freq failed: %s%s",
                    Fore.RED, exc, Style.RESET_ALL,
                )
                return False

    def send_stop(self) -> bool:
        """Send STOP command to silence the acoustic emitter.

        Returns True on success, False on failure.
        """
        if not self.enabled or self._ser is None:
            return False

        command = "STOP\n"
        with self._lock:
            try:
                self._ser.write(command.encode("utf-8"))
                self._ser.flush()
                logger.info(
                    "%sSerial TX → STOP%s",
                    Fore.CYAN, Style.RESET_ALL,
                )
                return True
            except Exception as exc:
                logger.error(
                    "%sSerial send_stop failed: %s%s",
                    Fore.RED, exc, Style.RESET_ALL,
                )
                return False

    def close(self):
        """Close the serial port cleanly."""
        if self._ser is not None:
            try:
                self._ser.close()
                logger.info(
                    "%sSerial port closed.%s",
                    Fore.GREEN, Style.RESET_ALL,
                )
            except Exception as exc:
                logger.error(
                    "%sSerial close error: %s%s",
                    Fore.RED, exc, Style.RESET_ALL,
                )
            self._ser = None
        self.enabled = False
