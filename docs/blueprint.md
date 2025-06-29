# **App Name**: AquaGlyph

## Core Features:

- AI Pattern Generation: Generate water curtain patterns from images or text input using generative AI; the tool will attempt to convert complex imagery to a low-resolution equivalent appropriate for the output.
- Live Pattern Preview: Live preview of the generated pattern in a popup window.
- Speed Control: Speed control to adjust the valve activation speed within the live preview.
- Pattern Sequencing: Drag and drop interface for ordering and adding patterns to a sequence.
- Pattern Grid Display: Display generated patterns in a square grid format for easy selection.
- ESP32 Code Generation: Generate ESP32 code with the interface server, which can be uploaded to the ESP32 SPIFFS; this includes code for controlling the valves via the 74HC595 shift registers and LED control via the WS2812B LEDs.
- Embedded Code Generation: Automatic code generation of ESP32 that integrate the web user interface to manage and configure pattern of Digital Water Curtain.

## Style Guidelines:

- Primary color: Electric blue (#7DF9FF) to evoke the neon laser effect, inspired by the user's request for 'black laser neon.'
- Background color: Dark gray (#222222) to provide a 'black laser neon' backdrop.
- Accent color: Lime green (#32CD32) for buttons, fulfilling the user's request.
- Body and headline font: 'Space Grotesk', a sans-serif, for a techy, computerized feel.
- Neon-style icons to match the overall 'black laser neon' theme.
- Grid layout for displaying pattern previews in square formats as per the attached image.
- Subtle animations for generating new patterns and transitioning between patterns.