#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "config.h"

// ── AI Thinker ESP32-CAM Pin Map (DO NOT CHANGE) ─────────────────
#define PWDN_GPIO_NUM    32
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM     0
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      21
#define Y4_GPIO_NUM      19
#define Y3_GPIO_NUM      18
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22

static httpd_handle_t stream_httpd = NULL;
static const char* CONTENT_TYPE  = "multipart/x-mixed-replace; boundary=frame";
static const char* FRAME_HEADER  = "--frame\r\nContent-Type: image/jpeg\r\n\r\n";
static const char* FRAME_FOOTER  = "\r\n";

static esp_err_t stream_handler(httpd_req_t* req) {
  esp_err_t res = httpd_resp_set_type(req, CONTENT_TYPE);
  if (res != ESP_OK) return res;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store");

  while (true) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("CAM:Frame capture failed");
      res = ESP_FAIL;
      break;
    }
    res = httpd_resp_send_chunk(req, FRAME_HEADER, strlen(FRAME_HEADER));
    if (res != ESP_OK) { esp_camera_fb_return(fb); break; }

    res = httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len);
    esp_camera_fb_return(fb); 
    if (res != ESP_OK) break;

    res = httpd_resp_send_chunk(req, FRAME_FOOTER, strlen(FRAME_FOOTER));
    if (res != ESP_OK) break;
  }
  httpd_resp_send_chunk(req, NULL, 0);
  return res;
}

// ─ Single JPEG capture endpoint — used by Python edge server ────────
// Returns ONE frame as image/jpeg then closes. Non-blocking for browser.
static esp_err_t capture_handler(httpd_req_t* req) {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store");
  httpd_resp_set_type(req, "image/jpeg");
  esp_err_t res = httpd_resp_send(req, (const char*)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

void initCamera() {
  camera_config_t cam_config;
  cam_config.ledc_channel = LEDC_CHANNEL_0;
  cam_config.ledc_timer   = LEDC_TIMER_0;
  cam_config.pin_d0 = Y2_GPIO_NUM; cam_config.pin_d1 = Y3_GPIO_NUM;
  cam_config.pin_d2 = Y4_GPIO_NUM; cam_config.pin_d3 = Y5_GPIO_NUM;
  cam_config.pin_d4 = Y6_GPIO_NUM; cam_config.pin_d5 = Y7_GPIO_NUM;
  cam_config.pin_d6 = Y8_GPIO_NUM; cam_config.pin_d7 = Y9_GPIO_NUM;
  cam_config.pin_xclk = XCLK_GPIO_NUM; cam_config.pin_pclk = PCLK_GPIO_NUM;
  cam_config.pin_vsync = VSYNC_GPIO_NUM; cam_config.pin_href = HREF_GPIO_NUM;
  cam_config.pin_sscb_sda = SIOD_GPIO_NUM; cam_config.pin_sscb_scl = SIOC_GPIO_NUM;
  cam_config.pin_pwdn = PWDN_GPIO_NUM; cam_config.pin_reset = RESET_GPIO_NUM;

  cam_config.xclk_freq_hz = XCLK_FREQ;
  cam_config.pixel_format = PIXFORMAT_JPEG;
  cam_config.frame_size   = FRAME_SIZE;
  cam_config.jpeg_quality = JPEG_QUALITY;
  cam_config.fb_count     = 2;
  cam_config.grab_mode    = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&cam_config);
  if (err != ESP_OK) {
    Serial.println("CAM:INIT FAILED");
    delay(1000); ESP.restart();
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_gain_ctrl(s, 1);
  }
  Serial.println("CAM:Camera initialized OK");
}

void connectWiFi() {
  Serial.print("CAM:Connecting to SSID: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startMs > WIFI_TIMEOUT_MS) {
      Serial.println("\nCAM:WiFi timeout — restarting...");
      ESP.restart();
    }
  }
  Serial.println();
  Serial.print("CAM:Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/stream");
}

void startStreamServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port    = STREAM_PORT;
  config.max_uri_handlers = 4;

  httpd_uri_t stream_uri = {
    .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL
  };
  // Single-frame capture endpoint for Python AI edge server
  httpd_uri_t capture_uri = {
    .uri = "/capture", .method = HTTP_GET, .handler = capture_handler, .user_ctx = NULL
  };
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    Serial.println("CAM:Capture URL: http://" + WiFi.localIP().toString() + "/capture");
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("AUTONIX CAM -- Starting...");
  initCamera();
  connectWiFi();
  startStreamServer();
}

void loop() {
  if (Serial.available()) {
    String msg = Serial.readStringUntil('\n');
    msg.trim();
    if (msg == "FIRE_DETECTED") Serial.println("CAM:Fire mode activated");
    else if (msg == "FIRE_OUT") Serial.println("CAM:Returning to normal mode");
  }
  delay(10);
}
