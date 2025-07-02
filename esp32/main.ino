
/*
  Digital Water Curtain - ESP32 Controller Firmware
  Developed by JA3Jou3 & Ehsen

  This firmware provides a dual-mode operation:
  1. Access Point (AP) Mode: On first boot or reconfiguration, it creates a WiFi network
     named "DigitalWaterCurtain-Setup". Connect to this network and go to 192.168.4.1
     in a browser to configure WiFi credentials and hardware settings.
  2. Station (STA) Mode: After configuration, it connects to your WiFi network and
     serves the main web interface from SPIFFS. It also provides a WebSocket API
     for real-time control.

  SETUP:
  1. Install required libraries in Arduino IDE -> Sketch -> Include Library -> Manage Libraries:
     - ESPAsyncWebServer
     - AsyncTCP
     - ArduinoJson (Version 6.x.x)
     - FastLED
     - EEPROM
  2. Install the ESP32 SPIFFS upload tool:
     https://github.com/me-no-dev/arduino-esp32fs-plugin
  3. Upload the 'data' directory to SPIFFS using "Tools > ESP32 Sketch Data Upload".
  4. Compile and upload this sketch.
*/

// =================================================================
// LIBRARIES
// =================================================================
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <EEPROM.h>

// =================================================================
// CONFIGURATION
// =================================================================
// -- Hardware Pin Definitions
#define LATCH_PIN    12  // 74HC595 Latch pin (ST_CP/RCLK)
#define CLOCK_PIN    14  // 74HC595 Clock pin (SH_CP/SRCLK)
#define DATA_PIN     13  // 74HC595 Data pin (DS/SER)
#define LED_PIN      19  // WS2812B data pin

// -- EEPROM Configuration
#define EEPROM_SIZE 256
#define CONFIG_MAGIC 0x44574346 // "DWCF" - Used to validate stored config
struct Configuration {
  uint32_t magic;
  char ssid[64];
  char password[64];
  int numValves;
  int numLeds;
  bool configured;
};

// -- AP Mode Configuration
const char* ap_ssid = "DigitalWaterCurtain-Setup";

// =================================================================
// GLOBAL VARIABLES
// =================================================================
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
Configuration config;

// -- Curtain State
int BYTES_PER_ROW = 2; // Default, will be recalculated
#define PATTERN_BUFFER_SIZE 8192 // Increased buffer for larger/more complex patterns
byte patternBuffer[PATTERN_BUFFER_SIZE];
CRGB* leds = nullptr;

int numPatternRows = 0;
int currentPatternRow = 0;
unsigned long lastUpdateTime = 0;
int animationSpeed = 100; // Delay in ms
bool isPlaying = false;
const int BITS_PER_BYTE = 8;

// =================================================================
// FIRMWARE LOGIC
// =================================================================

// -- Configuration Management
void saveConfiguration() {
  config.magic = CONFIG_MAGIC;
  EEPROM.put(0, config);
  EEPROM.commit();
}

void clearConfiguration() {
  Configuration blankConfig;
  memset(&blankConfig, 0, sizeof(Configuration));
  blankConfig.configured = false;
  blankConfig.magic = 0;
  EEPROM.put(0, blankConfig);
  EEPROM.commit();
}

void loadConfiguration() {
  EEPROM.get(0, config);
  // If magic number doesn't match or config is invalid, reset to defaults.
  if (config.magic != CONFIG_MAGIC || config.numValves <= 0 || config.numLeds <= 0) {
    Serial.println("Magic number mismatch or config not found. Resetting to defaults.");
    clearConfiguration();
    EEPROM.get(0, config); // Re-read the cleared configuration
  }
}

// -- Hardware Control
void writeShiftRegisters(byte rowData[]) {
  digitalWrite(LATCH_PIN, LOW);
  for (int i = BYTES_PER_ROW - 1; i >= 0; i--) {
    shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, rowData[i]);
  }
  digitalWrite(LATCH_PIN, HIGH);
}

void setupHardware() {
    if (leds != nullptr) {
        delete[] leds;
        leds = nullptr;
    }
    // Only setup hardware if config values are sane
    if (config.numValves > 0 && config.numLeds > 0) {
        BYTES_PER_ROW = (config.numValves + BITS_PER_BYTE - 1) / BITS_PER_BYTE;
        leds = new CRGB[config.numLeds];
        if (leds) {
            FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, config.numLeds);
            FastLED.setBrightness(50);
            for(int i = 0; i < config.numLeds; i++) { leds[i] = CRGB::Black; }
            FastLED.show();
        } else {
            Serial.println("Error: Failed to allocate memory for LEDs!");
        }
    } else {
        Serial.println("Warning: Invalid number of valves or LEDs. Hardware not initialized.");
    }
}

// -- AP Mode Setup Page
const char* setupPage = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>Digital Water Curtain Setup</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #121212; color: #E0E0E0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { background-color: #1E1E1E; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); width: 100%; max-width: 400px; border: 1px solid #333; }
        h1 { color: #BB86FC; text-align: center; margin-bottom: 2rem; }
        label { display: block; margin-bottom: 0.5rem; color: #B0B0B0; }
        input { width: calc(100% - 20px); padding: 10px; margin-bottom: 1rem; border-radius: 6px; border: 1px solid #444; background-color: #2C2C2C; color: #E0E0E0; font-size: 1rem; }
        input:focus { outline: none; border-color: #BB86FC; }
        button { background-color: #03DAC6; color: #000; border: none; padding: 12px 20px; text-align: center; text-decoration: none; display: inline-block; font-size: 1rem; margin-top: 1rem; cursor: pointer; border-radius: 6px; width: 100%; font-weight: bold; }
        button:hover { background-color: #35fbe8; }
        .msg { background-color: #333; padding: 1rem; border-radius: 6px; text-align: center; display: none; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Device Configuration</h1>
        <form action="/save" method="POST">
            <label for="ssid">WiFi SSID:</label>
            <input type="text" id="ssid" name="ssid" required>
            <label for="password">WiFi Password:</label>
            <input type="password" id="password" name="password">
            <label for="valves">Number of Valves (multiple of 8):</label>
            <input type="number" id="valves" name="valves" value="16" step="8" min="8" required>
            <label for="leds">Number of LEDs:</label>
            <input type="number" id="leds" name="leds" value="16" min="1" required>
            <button type="submit">Save and Reboot</button>
        </form>
        <div id="msg" class="msg"></div>
    </div>
    <script>
        document.querySelector('form').addEventListener('submit', function(e) {
            e.preventDefault();
            const msgDiv = document.getElementById('msg');
            msgDiv.style.display = 'block';
            msgDiv.innerText = 'Saving configuration... The device will reboot. Connect to your WiFi and find the device IP address to continue.';
            
            const formData = new FormData(e.target);
            fetch('/save', {
                method: 'POST',
                body: new URLSearchParams(formData)
            }).then(res => {
                // The device will reboot, so this may not be reached.
            }).catch(err => {
                msgDiv.innerText = 'An error occurred. Please try again.';
            });
        });
    </script>
</body>
</html>
)rawliteral";

void handleRoot(AsyncWebServerRequest *request){
    request->send_P(200, "text/html", setupPage);
}

void handleSave(AsyncWebServerRequest *request) {
    if(request->hasParam("ssid", true) && request->hasParam("valves", true) && request->hasParam("leds", true)) {
        strncpy(config.ssid, request->getParam("ssid", true)->value().c_str(), sizeof(config.ssid) - 1);
        strncpy(config.password, request->getParam("password", true)->value().c_str(), sizeof(config.password) - 1);
        config.numValves = request->getParam("valves", true)->value().toInt();
        config.numLeds = request->getParam("leds", true)->value().toInt();
        config.configured = true;
        saveConfiguration();

        request->send(200, "text/plain", "Configuration saved. Rebooting...");
        delay(1000);
        ESP.restart();
    } else {
        request->send(400, "text/plain", "Bad Request");
    }
}

// -- WebSocket Handler
void onWsEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.println("WebSocket client connected");
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.println("WebSocket client disconnected");
  } else if (type == WS_EVT_DATA) {
    // Allocate a JSON document. It's important to have enough memory.
    // 8KB should be enough for large patterns.
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, (char*)data, len);
    
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.c_str());
      return;
    }

    const char* action = doc["action"];
    if (!action) return;

    Serial.print("Received action: ");
    Serial.println(action);

    if (strcmp(action, "reboot_to_ap") == 0) {
        clearConfiguration();
        Serial.println("Configuration cleared. Rebooting to AP mode.");
        delay(500);
        ESP.restart();
    } else if (strcmp(action, "config") == 0) {
        int newNumValves = doc["valves"];
        int newNumLeds = doc["leds"];
        if (newNumValves > 0 && newNumLeds > 0 && (newNumValves != config.numValves || newNumLeds != config.numLeds)) {
            config.numValves = newNumValves;
            config.numLeds = newNumLeds;
            setupHardware();
            saveConfiguration(); // Persist hardware changes
            Serial.print("Reconfigured for ");
            Serial.print(config.numValves);
            Serial.print(" valves and ");
            Serial.print(config.numLeds);
            Serial.println(" LEDs.");
        }
    } else if (strcmp(action, "play") == 0) {
      isPlaying = true;
      currentPatternRow = 0; // Reset animation
    } else if (strcmp(action, "pause") == 0) {
      isPlaying = false;
      // Use heap for temporary buffer to avoid stack overflow with large valve counts
      byte* clearByte = new byte[BYTES_PER_ROW];
      if (clearByte) {
          memset(clearByte, 0, BYTES_PER_ROW);
          writeShiftRegisters(clearByte);
          delete[] clearByte;
      } else {
          Serial.println("ERROR: could not allocate memory to clear valves!");
      }
    } else if (strcmp(action, "speed") == 0) {
      animationSpeed = doc["value"];
    } else if (strcmp(action, "color") == 0) {
      if (leds == nullptr) return;
      const char* colorStr = doc["value"]; // e.g., "#RRGGBB"
      long number = (long) strtol( &colorStr[1], NULL, 16);
      int r = number >> 16;
      int g = number >> 8 & 0xFF;
      int b = number & 0xFF;
      for(int i = 0; i < config.numLeds; i++) {
        leds[i] = CRGB(r, g, b);
      }
      FastLED.show();
    } else if (strcmp(action, "load_pattern") == 0) {
      JsonArray pattern = doc["pattern"].as<JsonArray>();
      numPatternRows = pattern.size();
      if(numPatternRows * BYTES_PER_ROW > PATTERN_BUFFER_SIZE) {
        Serial.println("Error: Pattern too large for buffer!");
        numPatternRows = 0;
        return;
      }
      
      int bufferIndex = 0;
      for (JsonArray row : pattern) {
        byte rowData[BYTES_PER_ROW] = {0}; // This is safe, stack size is known and small.
        int valveIndex = 0;
        for (bool valveOn : row) {
          if (valveOn) {
            int bytePos = valveIndex / BITS_PER_BYTE;
            int bitPos = valveIndex % BITS_PER_BYTE;
            if(bytePos < BYTES_PER_ROW) {
                bitSet(rowData[bytePos], bitPos); 
            }
          }
          valveIndex++;
        }
        memcpy(&patternBuffer[bufferIndex], rowData, BYTES_PER_ROW);
        bufferIndex += BYTES_PER_ROW;
      }
      Serial.print("Loaded pattern with ");
      Serial.print(numPatternRows);
      Serial.println(" rows.");
    }
  }
}

void setupSTA() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(config.ssid, config.password);
    Serial.print("Connecting to WiFi...");
    int retries = 20; // Try for 10 seconds
    while (WiFi.status() != WL_CONNECTED && retries > 0) {
        delay(500);
        Serial.print(".");
        retries--;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nFailed to connect to WiFi. Rebooting into AP mode.");
        clearConfiguration();
        delay(1000);
        ESP.restart();
    }

    Serial.println("");
    Serial.print("Connected! IP Address: ");
    Serial.println(WiFi.localIP());

    ws.onEvent(onWsEvent);
    server.addHandler(&ws);
    
    // --- Simplified Server Logic for Bundled App ---
    server.on("/app.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(SPIFFS, "/app.js", "text/javascript");
    });
    server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(SPIFFS, "/style.css", "text/css");
    });
    server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(SPIFFS, "/favicon.ico", "image/x-icon");
    });

    // Fallback to index.html for root and any other client-side routes
    server.onNotFound([](AsyncWebServerRequest *request){
        if (request->method() == HTTP_GET) {
           request->send(SPIFFS, "/index.html", "text/html");
        } else {
           request->send(404, "text/plain", "Not found");
        }
    });

    server.begin();
}

void setupAP() {
    Serial.println("Starting in AP Mode for configuration.");
    WiFi.softAP(ap_ssid);
    IPAddress IP = WiFi.softAPIP();
    Serial.print("AP IP address: ");
    Serial.println(IP);

    server.on("/", HTTP_GET, handleRoot);
    server.on("/save", HTTP_POST, handleSave);
    server.onNotFound([](AsyncWebServerRequest *request) {
        request->send(404, "text/plain", "Not found. Go to / to configure.");
    });
    server.begin();
}

// =================================================================
// MAIN SETUP & LOOP
// =================================================================
void setup() {
  Serial.begin(115200);

  pinMode(LATCH_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  EEPROM.begin(EEPROM_SIZE);
  loadConfiguration();

  if (!SPIFFS.begin(true)) {
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }

  if (config.configured) {
    Serial.println("Device is configured. Starting in STA mode.");
    setupHardware();
    setupSTA();
  } else {
    Serial.println("Device not configured. Starting in AP mode.");
    setupAP();
  }
}

void loop() {
    if (config.configured) {
        ws.cleanupClients();

        if (isPlaying && numPatternRows > 0 && millis() - lastUpdateTime > animationSpeed) {
            lastUpdateTime = millis();
            
            // The pattern is stored top-to-bottom. The animation should also play top-to-bottom.
            // The visualizer on the web might play bottom-to-top, but the physical curtain is top-to-bottom.
            int currentRowOffset = currentPatternRow * BYTES_PER_ROW;
            
            // Check bounds to be extra safe and prevent crashes
            if ((currentRowOffset + BYTES_PER_ROW) <= PATTERN_BUFFER_SIZE) {
                // Pass pointer directly from the main buffer to avoid stack allocation
                writeShiftRegisters(&patternBuffer[currentRowOffset]);
            } else {
                Serial.println("Error: Animation index out of bounds! Stopping playback.");
                isPlaying = false;
            }

            currentPatternRow++;
            if (currentPatternRow >= numPatternRows) {
                currentPatternRow = 0; // Loop the animation
            }
        }
    }
}
