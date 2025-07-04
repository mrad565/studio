# Digital Water Curtain Controller

This project is a web-based controller for a Digital Water Curtain system using Next.js for the frontend and ESP32 for the hardware control.

## Features

- Interactive pattern generator for creating water curtain patterns
- Real-time hardware control via WebSocket connection
- Pattern sequence management with drag-and-drop reordering
- Responsive design for desktop and mobile devices
- ESP32 integration for controlling water valves and LED lighting

## Project Structure

- `/src`: Next.js application source code
- `/esp32`: ESP32 firmware and web interface files
- `/scripts`: Utility scripts for building and deployment

## Development

### Prerequisites

- Node.js 18+ and npm
- Arduino IDE or PlatformIO (for ESP32 firmware)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:9002](http://localhost:9002) in your browser.

## Building for ESP32

This project includes a script to prepare the Next.js build output for the ESP32's SPIFFS filesystem.

1. Build the project for ESP32:

```bash
npm run build:esp32
```

This will:
- Build the Next.js application
- Process the build output for ESP32 SPIFFS compatibility
- Copy the processed files to the `esp32/data` directory

2. Upload the firmware and web interface to the ESP32 using Arduino IDE or PlatformIO.

For detailed instructions, see the [ESP32 README](./esp32/README.md).

## ESP32 Web Interface

To prepare the web interface for ESP32:

1. Run `npm run build:esp32` to build the Next.js application and prepare it for ESP32 SPIFFS
2. The processed files will be available in the `esp32/data` directory
3. Use the Arduino IDE with ESP32 SPIFFS plugin to upload the data directory to your ESP32

### Testing the ESP32 Web Interface

Before uploading to the ESP32, you can test the web interface locally:

1. Run `npm run test:esp32` to start a local server that simulates the ESP32 web server
2. The server will automatically open your browser to http://localhost:8080
3. Verify that the web interface loads correctly and all assets are properly displayed
4. Press Ctrl+C in the terminal to stop the test server

## Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the Next.js application
- `npm run build:esp32`: Build and prepare for ESP32 deployment
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript type checking

For more information about the scripts, see the [Scripts README](./scripts/README.md).
