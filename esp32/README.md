# Digital Water Curtain ESP32 Web Interface

This directory contains the ESP32 firmware and web interface for the Digital Water Curtain project.

## Structure

- `main.ino`: The main ESP32 firmware that controls the water valves and LEDs
- `data/`: Directory containing the web interface files for SPIFFS filesystem

## Preparing the Web Interface

The web interface is built using Next.js and needs to be processed for the ESP32's SPIFFS filesystem. To prepare the web interface:

1. Navigate to the project root directory
2. Run the build script:

```bash
npm run build:esp32
```

This will:
1. Build the Next.js application
2. Process the build output for ESP32 SPIFFS compatibility
3. Copy the processed files to the `esp32/data` directory

### Testing the Web Interface Locally

Before uploading to the ESP32, you can test the web interface locally:

1. From the project root directory, run:
   ```
   npm run test:esp32
   ```

2. This will start a local server that simulates the ESP32 web server and automatically open your browser to http://localhost:8080.

3. Verify that the web interface loads correctly and all assets are properly displayed.

4. Press Ctrl+C in the terminal to stop the test server.

## Uploading to ESP32

After preparing the web interface, you need to upload both the firmware and the web interface to the ESP32:

1. Open the `main.ino` file in Arduino IDE or PlatformIO
2. Install the required libraries:
   - WiFi
   - ESPAsyncWebServer
   - SPIFFS
   - ArduinoJson
   - FastLED
3. Upload the firmware to the ESP32
4. Upload the SPIFFS data folder to the ESP32
   - In Arduino IDE: Tools > ESP32 Sketch Data Upload
   - In PlatformIO: Upload Filesystem Image

## Connecting to the ESP32

### First-time Setup

1. Power on the ESP32
2. Connect to the WiFi network named "DigitalWaterCurtain-Setup"
3. Open a web browser and navigate to `http://192.168.4.1`
4. Configure your WiFi network settings and hardware parameters
5. The ESP32 will restart and connect to your WiFi network

### Normal Operation

1. Connect your device to the same WiFi network as the ESP32
2. Open a web browser and navigate to the ESP32's IP address
3. Use the web interface to control the Digital Water Curtain

## Troubleshooting

- If the ESP32 cannot connect to your WiFi network, it will restart in AP mode
- To reset the configuration, send the `reboot_to_ap` command via WebSocket