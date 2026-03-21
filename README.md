<h1 align="center">🔥 AUTONIX 🤖</h1>
<h3 align="center">AI-Driven Autonomous Sonic Fire Suppression Rover</h3>

<p align="center">
  <em>⚡ Born to build Tech. ⚡</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++"/>
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"/>
  <img src="https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" alt="ESP32"/>
</p>

---

> **AUTONIX** is a next-generation autonomous rover that detects fire using a hybrid edge-AI pipeline (HSV + YOLOv8) and extinguishes it using **acoustic resonance (30Hz-60Hz sound waves)** instead of traditional water or chemicals. 

### ⚙️ System Architecture
This repository contains the complete codebase for the AUTONIX ecosystem:
* 🧠 **`autonix-ai-edge`**: The Python-based AI brain running dual-mode vision and Supabase telemetry.
* 🌐 **`autonix-dashboard`**: A real-time, WebGL-powered Command Center UI built with Vanilla JS and Three.js.
* 🤖 **`autonix_devkit`**: The C++ firmware powering the ESP32 Dev Kit (motor control, sensors, and acoustic amplifier).
* 📷 **`autonix_cam`**: The MJPEG vision node firmware for the ESP32-CAM.
