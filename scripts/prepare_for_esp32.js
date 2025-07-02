
const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

async function main() {
    console.log('Starting ESP32 preparation script (v3 - Flattening Mode)...');

    const outDir = path.join(__dirname, '..', 'out');
    const dataDir = path.join(__dirname, '..', 'data');
    const esp32Dir = path.join(__dirname, '..', 'esp32');
    
    if (!fs.existsSync(outDir)) {
        console.error(`Error: '${outDir}' not found. Did you run "next build" first?`);
        process.exit(1);
    }

    // Clean & create destination directories
    await fs.emptyDir(dataDir);
    await fs.emptyDir(esp32Dir);
    console.log('Cleaned target directories.');
    
    // Copy main index.html
    const originalHtmlPath = path.join(outDir, 'index.html');
    if (!fs.existsSync(originalHtmlPath)) {
        console.error('Error: index.html not found in out directory.');
        process.exit(1);
    }
    await fs.copy(originalHtmlPath, path.join(dataDir, 'index.html'));
    console.log('Copied index.html');

    // Copy favicon
    const faviconPath = path.join(outDir, 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
        await fs.copy(faviconPath, path.join(dataDir, 'favicon.ico'));
        console.log('Copied favicon.ico');
    }

    // Find and copy all static assets, FLATTENING them
    const staticDir = path.join(outDir, '_next', 'static');
    if (fs.existsSync(staticDir)) {
        const allFiles = await fs.readdir(staticDir, { recursive: true });
        for (const file of allFiles) {
            const sourceFile = path.join(staticDir, file);
            const stats = await fs.stat(sourceFile);
            if (stats.isFile()) {
                const destFile = path.join(dataDir, path.basename(file));
                await fs.copy(sourceFile, destFile);
                console.log(`Copied ${path.basename(file)} to data root.`);
            }
        }
    } else {
        console.warn('Warning: _next/static directory not found. Skipping asset copy.');
    }
    
    // Copy other root files if they exist (like 404.html)
    const otherFiles = await fs.readdir(outDir);
    for (const file of otherFiles) {
        if(file.endsWith('.html') && file !== 'index.html' || file.endsWith('.txt')) {
             await fs.copy(path.join(outDir, file), path.join(dataDir, file));
             console.log(`Copied ${file}`);
        }
    }

    // Generate and write the main.ino file with the new server logic
    const inoContent = generateInoCode();
    await fs.writeFile(path.join(esp32Dir, 'main.ino'), inoContent);
    console.log(`Generated ${path.join(esp32Dir, 'main.ino')} with intelligent routing.`);

    console.log('\n✅ ESP32 preparation complete!');
    console.log('\nNext steps:');
    console.log('1. Open the `esp32` folder in your IDE (Arduino IDE or PlatformIO).');
    console.log('2. Upload the `data` folder to ESP32 SPIFFS.');
    console.log('3. Compile and upload the sketch to your ESP32.');
}

function generateInoCode() {
    return `
/*
  Digital Water Curtain - ESP32 Controller Firmware
  Developed by JA3Jou3 & Ehsen
*/

// LIBRARIES
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <EEPROM.h>

// CONFIGURATION
#define LATCH_PIN    12
#define CLOCK_PIN    14
#define DATA_PIN     13
#define LED_PIN      19

#define EEPROM_SIZE 256
#define CONFIG_MAGIC 0x44574346 // "DWCF"
struct Configuration {
  uint32_t magic;
  char ssid[64];
  char password[64];
  int numValves;
  int numLeds;
  bool configured;
};

const char* ap_ssid = "DigitalWaterCurtain-Setup";

// GLOBAL VARIABLES
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
Configuration config;

int BYTES_PER_ROW = 2;
#define PATTERN_BUFFER_SIZE 8192
byte patternBuffer[PATTERN_BUFFER_SIZE];
CRGB* leds = nullptr;

int numPatternRows = 0;
int currentPatternRow = 0;
unsigned long lastUpdateTime = 0;
int animationSpeed = 100;
bool isPlaying = false;
const int BITS_PER_BYTE = 8;

String getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  else if (filename.endsWith(".css")) return "text/css";
  else if (filename.endsWith(".js")) return "application/javascript";
  else if (filename.endsWith(".ico")) return "image/x-icon";
  else if (filename.endsWith(".txt")) return "text/plain";
  return "text/plain";
}

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
  if (config.magic != CONFIG_MAGIC) {
    Serial.println("Magic number mismatch or config not found. Resetting to defaults.");
    clearConfiguration();
    EEPROM.get(0, config);
  }
}

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

const char* setupPage = R"rawliteral(
<!DOCTYPE html><html><head><title>Digital Water Curtain Setup</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background-color:#121212;color:#E0E0E0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.container{background-color:#1E1E1E;padding:2rem;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.5);width:100%;max-width:400px;border:1px solid #333}h1{color:#BB86FC;text-align:center;margin-bottom:2rem}label{display:block;margin-bottom:.5rem;color:#B0B0B0}input{width:calc(100% - 20px);padding:10px;margin-bottom:1rem;border-radius:6px;border:1px solid #444;background-color:#2C2C2C;color:#E0E0E0;font-size:1rem}input:focus{outline:none;border-color:#BB86FC}button{background-color:#03DAC6;color:#000;border:none;padding:12px 20px;text-align:center;font-size:1rem;margin-top:1rem;cursor:pointer;border-radius:6px;width:100%;font-weight:bold}button:hover{background-color:#35fbe8}.msg{background-color:#333;padding:1rem;border-radius:6px;text-align:center;display:none;margin-top:1rem}</style></head><body><div class="container"><h1>Device Configuration</h1><form action="/save" method="POST"><label for="ssid">WiFi SSID:</label><input type="text" id="ssid" name="ssid" required><label for="password">WiFi Password:</label><input type="password" id="password"><label for="valves">Number of Valves (multiple of 8):</label><input type="number" id="valves" name="valves" value="16" step="8" min="8" required><label for="leds">Number of LEDs:</label><input type="number" id="leds" name="leds" value="16" min="1" required><button type="submit">Save and Reboot</button></form><div id="msg" class="msg"></div></div><script>document.querySelector('form').addEventListener('submit',function(e){e.preventDefault();const t=document.getElementById('msg');t.style.display='block',t.innerText='Saving configuration... The device will reboot. Connect to your WiFi and find the device IP address to continue.';const n=new FormData(e.target);fetch('/save',{method:'POST',body:new URLSearchParams(n)})</script></body></html>
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

void onWsEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        Serial.println("WebSocket client connected");
    } else if (type == WS_EVT_DISCONNECT) {
        Serial.println("WebSocket client disconnected");
    } else if (type == WS_EVT_DATA) {
        DynamicJsonDocument doc(8192);
        DeserializationError error = deserializeJson(doc, (char*)data, len);
        
        if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.c_str());
            return;
        }

        const char* action = doc["action"];
        if (!action) return;

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
                saveConfiguration();
                Serial.printf("Reconfigured for %d valves and %d LEDs.\\n", config.numValves, config.numLeds);
            }
        } else if (strcmp(action, "play") == 0) {
            isPlaying = true;
            currentPatternRow = 0;
        } else if (strcmp(action, "pause") == 0) {
            isPlaying = false;
            byte* clearByte = new byte[BYTES_PER_ROW]();
            if (clearByte) {
                writeShiftRegisters(clearByte);
                delete[] clearByte;
            }
        } else if (strcmp(action, "speed") == 0) {
            animationSpeed = doc["value"];
        } else if (strcmp(action, "color") == 0) {
            if (!leds) return;
            const char* colorStr = doc["value"];
            long number = strtol( &colorStr[1], NULL, 16);
            for(int i = 0; i < config.numLeds; i++) {
                leds[i] = CRGB((number >> 16) & 0xFF, (number >> 8) & 0xFF, number & 0xFF);
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
                byte rowData[BYTES_PER_ROW] = {0};
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
            Serial.printf("Loaded pattern with %d rows.\\n", numPatternRows);
        }
    }
}

void setupSTA() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(config.ssid, config.password);
    Serial.print("Connecting to WiFi...");
    int retries = 20;
    while (WiFi.status() != WL_CONNECTED && retries > 0) {
        delay(500);
        Serial.print(".");
        retries--;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\\nFailed to connect to WiFi. Rebooting into AP mode.");
        clearConfiguration();
        delay(1000);
        ESP.restart();
    }

    Serial.println("");
    Serial.print("Connected! IP Address: ");
    Serial.println(WiFi.localIP());

    ws.onEvent(onWsEvent);
    server.addHandler(&ws);
    
    // --- INTELLIGENT onNotFound HANDLER (v2) ---
    server.onNotFound([](AsyncWebServerRequest *request){
        String path = request->url();
        
        // Heuristic: if the path has a file extension in its last segment,
        // it's likely a request for a static asset.
        int lastSlash = path.lastIndexOf('/');
        int lastDot = path.lastIndexOf('.');

        if (lastDot > lastSlash) {
            // This looks like a file request.
            // Extract the filename and try to serve it from the root of SPIFFS.
            String filename = path.substring(lastSlash + 1);
            String spiffsPath = "/" + filename;

            if (SPIFFS.exists(spiffsPath)) {
                request->send(SPIFFS, spiffsPath, getContentType(spiffsPath));
                return;
            }
        }
        
        // For any client-side route (e.g., "/about") or a file that wasn't found,
        // serve the main app shell. The client-side router will handle the rest.
        request->send(SPIFFS, "/index.html", "text/html");
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
        request->send_P(200, "text/html", setupPage);
    });
    server.begin();
}

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
            int currentRowOffset = currentPatternRow * BYTES_PER_ROW;
            if ((currentRowOffset + BYTES_PER_ROW) <= PATTERN_BUFFER_SIZE) {
                writeShiftRegisters(&patternBuffer[currentRowOffset]);
            }
            currentPatternRow = (currentPatternRow + 1) % numPatternRows;
        }
    }
}
    `
}

main().catch(console.error);
