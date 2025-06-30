// This script builds the React app, prepares it for SPIFFS, and generates the ESP32 firmware.
const fs = require('fs-extra');
const path = require('path');

async function main() {
    console.log('Starting ESP32 preparation script...');

    // 1. Define source and destination directories
    const outDir = path.join(__dirname, '..', 'out');
    const dataDir = path.join(__dirname, '..', 'data');
    const esp32Dir = path.join(__dirname, '..', 'esp32');
    const htmlPath = path.join(outDir, 'index.html');
    
    if (!fs.existsSync(htmlPath)) {
        console.error(`Error: '${htmlPath}' not found. Did you run "next build" first?`);
        process.exit(1);
    }

    // 2. Clean & create destination directories
    await fs.emptyDir(dataDir);
    await fs.emptyDir(esp32Dir);
    console.log('Cleaned target directories.');
    
    // 3. Copy all build files from `out` to `data`
    // This preserves the file structure Next.js creates, which is necessary for the app to work.
    console.log('Copying React app to data/ folder...');
    await fs.copy(outDir, dataDir);

    console.log('Copied React app to data/ folder.');

    // 4. Generate and write the main.ino file
    const inoContent = generateInoCode();
    await fs.writeFile(path.join(esp32Dir, 'main.ino'), inoContent);
    console.log(`Generated ${path.join(esp32Dir, 'main.ino')}.`);

    console.log('\n✅ ESP32 preparation complete!');
    console.log('\nNext steps:');
    console.log('1. Open the `esp32` folder in Arduino IDE or PlatformIO.');
    console.log('2. In `main.ino`, update your WiFi credentials.');
    console.log('3. Upload the `data` folder to ESP32 SPIFFS.');
    console.log('4. Compile and upload the sketch to your ESP32.');
}

function generateInoCode() {
    return `
/*
  AquaGlyph - ESP32 Digital Water Curtain Controller
  
  This firmware hosts the web interface from SPIFFS and provides a WebSocket
  API for real-time control of the water curtain.
  
  SETUP:
  1. Install required libraries in Arduino IDE -> Sketch -> Include Library -> Manage Libraries:
     - ESPAsyncWebServer
     - AsyncTCP
     - ArduinoJson
     - FastLED
  2. Install the ESP32 SPIFFS upload tool:
     https://github.com/me-no-dev/arduino-esp32fs-plugin
  3. Update your WiFi credentials below.
  4. Upload the 'data' directory to SPIFFS using "Tools > ESP32 Sketch Data Upload".
  5. Compile and upload this sketch.
*/

// =================================================================
// LIBRARIES
// =================================================================
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// =================================================================
// CONFIGURATION (UPDATE THESE VALUES)
// =================================================================
// -- WiFi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// -- Hardware Pin Definitions
#define LATCH_PIN    12  // 74HC595 Latch pin (ST_CP/RCLK)
#define CLOCK_PIN    14  // 74HC595 Clock pin (SH_CP/SRCLK)
#define DATA_PIN     13  // 74HC595 Data pin (DS/SER)
#define LED_PIN      19  // WS2812B data pin

// =================================================================
// GLOBAL VARIABLES
// =================================================================
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// -- Curtain Configuration (synced from web interface)
int NUM_VALVES = 16; // Default, will be updated by UI
int NUM_LEDS = 16;
int BYTES_PER_ROW = 2;

// Increase buffer size if you plan to use very long animations
// Max rows = PATTERN_BUFFER_SIZE / (NUM_VALVES / 8)
#define PATTERN_BUFFER_SIZE 4096 
byte patternBuffer[PATTERN_BUFFER_SIZE];
CRGB* leds = nullptr;

int numPatternRows = 0;
int currentPatternRow = 0;
unsigned long lastUpdateTime = 0;
int animationSpeed = 100; // Delay in ms
bool isPlaying = false;
const int BITS_PER_BYTE = 8;

// =================================================================
// HELPER FUNCTIONS
// =================================================================

// Function to control shift registers
void writeShiftRegisters(byte rowData[]) {
  digitalWrite(LATCH_PIN, LOW);
  // Send data MSB first for each byte, but send bytes in reverse order
  // to map valve 0 to the first bit of the first shift register.
  for (int i = BYTES_PER_ROW - 1; i >= 0; i--) {
    shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, rowData[i]);
  }
  digitalWrite(LATCH_PIN, HIGH);
}

// Re-initializes LED strip - must be called after NUM_VALVES changes
void setupLeds() {
    if (leds != nullptr) {
        delete[] leds;
    }
    leds = new CRGB[NUM_LEDS];
    FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
    FastLED.setBrightness(50);
    for(int i = 0; i < NUM_LEDS; i++) { leds[i] = CRGB::Black; }
    FastLED.show();
}

// Function to handle WebSocket events
void onWsEvent(AsyncWebSocket * server, AsyncWebSocketClient * client, AwsEventType type, void * arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.println("WebSocket client connected");
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.println("WebSocket client disconnected");
  } else if (type == WS_EVT_DATA) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, (char*)data, len);
    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.c_str());
      return;
    }

    const char* action = doc["action"];
    Serial.print("Received action: ");
    Serial.println(action);

    if (strcmp(action, "config") == 0) {
        int newNumValves = doc["valves"];
        if (newNumValves > 0 && newNumValves != NUM_VALVES) {
            NUM_VALVES = newNumValves;
            NUM_LEDS = newNumValves;
            BYTES_PER_ROW = (NUM_VALVES + BITS_PER_BYTE - 1) / BITS_PER_BYTE;
            setupLeds();
            Serial.print("Reconfigured for ");
            Serial.print(NUM_VALVES);
            Serial.println(" valves.");
        }
    } else if (strcmp(action, "play") == 0) {
      isPlaying = true;
      currentPatternRow = 0; // Reset animation
    } else if (strcmp(action, "pause") == 0) {
      isPlaying = false;
      // Turn off all valves when paused
      byte clearByte[BYTES_PER_ROW] = {0};
      writeShiftRegisters(clearByte);
    } else if (strcmp(action, "speed") == 0) {
      animationSpeed = doc["value"];
    } else if (strcmp(action, "color") == 0) {
      if (leds == nullptr) return;
      const char* colorStr = doc["value"]; // e.g., "#RRGGBB"
      long number = (long) strtol( &colorStr[1], NULL, 16);
      int r = number >> 16;
      int g = number >> 8 & 0xFF;
      int b = number & 0xFF;
      for(int i = 0; i < NUM_LEDS; i++) {
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
        byte rowData[BYTES_PER_ROW] = {0};
        int valveIndex = 0;
        for (bool valveOn : row) {
          if (valveOn) {
            int bytePos = valveIndex / BITS_PER_BYTE;
            int bitPos = valveIndex % BITS_PER_BYTE;
            // The bit order depends on how shift registers are wired.
            // This assumes valve 0 is the last bit of the first byte shifted out (physically the first valve).
            bitSet(rowData[bytePos], bitPos); 
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

// =================================================================
// SETUP
// =================================================================
void setup() {
  Serial.begin(115200);

  // -- Initialize Hardware
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  setupLeds(); // Initial LED setup

  // -- Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }

  // -- Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected! IP Address: ");
  Serial.println(WiFi.localIP());

  // -- Setup WebSocket
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  // -- Setup Web Server
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(SPIFFS, "/index.html", "text/html");
  });
  server.serveStatic("/", SPIFFS, "/");

  server.onNotFound([](AsyncWebServerRequest *request){
    if (request->method() == HTTP_GET) {
       request->send(SPIFFS, "/index.html", "text/html");
    } else {
       request->send(404, "text/plain", "Not found");
    }
  });

  server.begin();
}

// =================================================================
// LOOP
// =================================================================
void loop() {
  ws.cleanupClients();

  if (isPlaying && numPatternRows > 0 && millis() - lastUpdateTime > animationSpeed) {
    lastUpdateTime = millis();

    int bufferOffset = currentPatternRow * BYTES_PER_ROW;
    byte currentRowData[BYTES_PER_ROW];
    
    // The pattern is visualized top-down, but the physical curtain needs bottom-up.
    // We reverse the row order here before sending to hardware.
    int reversedRow = numPatternRows - 1 - currentPatternRow;
    int reversedOffset = reversedRow * BYTES_PER_ROW;
    memcpy(currentRowData, &patternBuffer[reversedOffset], BYTES_PER_ROW);
    
    writeShiftRegisters(currentRowData);

    currentPatternRow++;
    if (currentPatternRow >= numPatternRows) {
      currentPatternRow = 0; // Loop the animation
    }
  }
}
`;
}


main().catch(err => {
    console.error('An error occurred during the ESP32 preparation script:', err);
    process.exit(1);
});
