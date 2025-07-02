
const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

async function main() {
    console.log('Starting ESP32 preparation script (v5 - Robust Bundling)...');

    const outDir = path.join(__dirname, '..', 'out');
    const dataDir = path.join(__dirname, '..', 'data');
    const esp32Dir = path.join(__dirname, '..', 'esp32');
    
    if (!fs.existsSync(outDir)) {
        console.error(`Error: '${outDir}' not found. Did you run "next build" first?`);
        process.exit(1);
    }

    await fs.emptyDir(dataDir);
    await fs.emptyDir(esp32Dir);
    console.log('Cleaned target directories.');

    const originalHtmlPath = path.join(outDir, 'index.html');
    if (!fs.existsSync(originalHtmlPath)) {
        console.error('Error: index.html not found in out directory.');
        process.exit(1);
    }

    const htmlContent = await fs.readFile(originalHtmlPath, 'utf-8');
    const $ = cheerio.load(htmlContent);

    // Remove original stylesheets from the HTML first
    $('link[rel="stylesheet"]').remove();
    
    // Bundle CSS
    const cssFiles = [];
    $('head').find('link[href*=".css"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/_next/')) {
            cssFiles.push(path.join(outDir, href));
        }
    });

    let bundledCss = '';
    for (const file of cssFiles) {
        if (fs.existsSync(file)) {
            bundledCss += await fs.readFile(file, 'utf-8') + '\n';
        } else {
            console.warn(`Warning: CSS file not found: ${file}`);
        }
    }
    if (bundledCss) {
        await fs.writeFile(path.join(dataDir, 'style.css'), bundledCss);
        console.log('Bundled CSS into style.css');
        // Add the new stylesheet link
        $('head').append('<link rel="stylesheet" href="/style.css">');
    }
    
    // Bundle JavaScript in order
    const scriptFiles = [];
    $('script[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('/_next/')) {
            scriptFiles.push(path.join(outDir, src));
        }
    });

    let bundledJs = '';
    for (const file of scriptFiles) {
        if (fs.existsSync(file)) {
            bundledJs += await fs.readFile(file, 'utf-8') + ';\n'; // Add semicolon for safety
        } else {
             console.warn(`Warning: JS file not found: ${file}`);
        }
    }
    if (bundledJs) {
        await fs.writeFile(path.join(dataDir, 'app.js'), bundledJs);
        console.log('Bundled JS into app.js');
        // Remove original script tags from the HTML
        $('script[src]').remove();
        // Add the bundled script at the end of the body with 'defer' to ensure HTML is parsed first
        $('body').append('<script src="/app.js" defer></script>');
    }
    

    // Get the final, modified HTML
    const newHtml = $.html();
    await fs.writeFile(path.join(dataDir, 'index.html'), newHtml);
    console.log('Created new bundled index.html');

    // Copy other necessary files
    const faviconPath = path.join(outDir, 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
        await fs.copy(faviconPath, path.join(dataDir, 'favicon.ico'));
        console.log('Copied favicon.ico');
    }

    // Generate and write the main.ino file
    const inoContent = generateInoCode();
    await fs.writeFile(path.join(esp32Dir, 'main.ino'), inoContent);
    console.log(`Generated ${path.join(esp32Dir, 'main.ino')}`);

    console.log('\n✅ ESP32 preparation complete! Your data folder is now optimized.');
    console.log('\nNext steps:');
    console.log('1. Open the \`esp32\` folder in your IDE (Arduino IDE or PlatformIO).');
    console.log('2. Upload the \`data\` folder to ESP32 SPIFFS.');
    console.log('3. Compile and upload the sketch to your ESP32.');
}

function generateInoCode() {
    return `
/*
  Digital Water Curtain - ESP32 Controller Firmware
  Developed by JA3Jou3 & Ehsen
  Firmware Version: 4.1 (Robust Save & Bundling)
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
  // Also clear the in-memory config
  memcpy(&config, &blankConfig, sizeof(Configuration));
}

void loadConfiguration() {
  EEPROM.get(0, config);
  if (config.magic != CONFIG_MAGIC || config.numValves <= 0 || config.numLeds <= 0) {
    Serial.println("Magic number mismatch or invalid config data found. Resetting to defaults.");
    clearConfiguration();
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
<!DOCTYPE html><html><head><title>Digital Water Curtain Setup</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background-color:#121212;color:#E0E0E0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.container{background-color:#1E1E1E;padding:2rem;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.5);width:100%;max-width:400px;border:1px solid #333}h1{color:#BB86FC;text-align:center;margin-bottom:2rem}label{display:block;margin-bottom:.5rem;color:#B0B0B0}input{width:calc(100% - 20px);padding:10px;margin-bottom:1rem;border-radius:6px;border:1px solid #444;background-color:#2C2C2C;color:#E0E0E0;font-size:1rem}input:focus{outline:none;border-color:#BB86FC}button{background-color:#03DAC6;color:#000;border:none;padding:12px 20px;text-align:center;font-size:1rem;margin-top:1rem;cursor:pointer;border-radius:6px;width:100%;font-weight:bold}button:hover{background-color:#35fbe8}</style></head><body><div class="container"><h1>Device Configuration</h1><form action="/save" method="POST"><label for="ssid">WiFi SSID:</label><input type="text" id="ssid" name="ssid" required><label for="password">WiFi Password:</label><input type="password" id="password" name="password"><label for="valves">Number of Valves (multiple of 8):</label><input type="number" id="valves" name="valves" value="16" step="8" min="8" required><label for="leds">Number of LEDs:</label><input type="number" id="leds" name="leds" value="16" min="1" required><button type="submit">Save and Reboot</button></form></div></body></html>
)rawliteral";

void handleRoot(AsyncWebServerRequest *request){
    request->send_P(200, "text/html", setupPage);
}

void handleSave(AsyncWebServerRequest *request) {
    bool success = false;
    if(request->hasParam("ssid", true) && request->hasParam("valves", true) && request->hasParam("leds", true)) {
        String ssid = request->getParam("ssid", true)->value();
        String valves = request->getParam("valves", true)->value();
        String leds = request->getParam("leds", true)->value();

        if (ssid.length() > 0 && valves.toInt() > 0 && leds.toInt() > 0) {
            strncpy(config.ssid, ssid.c_str(), sizeof(config.ssid) - 1);
            
            // Safely handle optional password
            if (request->hasParam("password", true)) {
                strncpy(config.password, request->getParam("password", true)->value().c_str(), sizeof(config.password) - 1);
            } else {
                config.password[0] = '\\0';
            }
            
            config.numValves = valves.toInt();
            config.numLeds = leds.toInt();
            config.configured = true;
            
            saveConfiguration();
            success = true;
        }
    }
    
    if (success) {
        request->send(200, "text/plain", "Configuration saved. Rebooting...");
        delay(1000);
        ESP.restart();
    } else {
        request->send(400, "text/plain", "Bad Request. Please provide all required fields.");
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
    
    server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");

    server.onNotFound([](AsyncWebServerRequest *request){
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
    `;
}

main().catch(console.error);
