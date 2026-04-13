# GPX 3D Visualizer - Design Document

## 1. Architecture Overview

This project is a high-performance web-based 3D terrain visualizer for `.gpx` tracks. It transforms GPS logs into interactive 3D flyover experiences and provides a built-in cinematic video export pipeline using browser-native MediaRecorder APIs.

### Key Technologies
- **Vanilla HTML/CSS/JS**: Eliminates build-step overhead. State is managed via a high-speed `renderConfig` cache to ensure 60 FPS performance without React/Vue overhead.
- **MapLibre GL JS**: Renders the 3D globe and handles Digital Elevation Models (DEM).
- **Web Workers**: Offloads heavy XML parsing to background threads.
- **Deterministic Canvas Engine**: A custom video engine that decoupling simulation time from real-world frame rates to guarantee stutter-free video exports.

---

## 2. Core Subsystems

### 2.1 File Ingestion and the GPX Worker (`js/gpx-worker.js`)
When a GPX file is ingested, a Web Worker parses the tracks, calculates Haversine distances, bounds, and altitude variations. It generates a pre-simplified point array to optimize 2D canvas drawing performance during the "Path Overview" phase.

### 2.2 Global State & Performance Architecture (`js/globals.js`)
To avoid "DOM Thrashing" (expensive `getElementById` calls inside the 60fps render loop), all UI settings and telemetry data are cached in a global `renderConfig` object.
- **Event-Driven Sync**: UI listeners in `ui.js` update the cache only when inputs change.
- **Loop Consumption**: The `gameLoop` and `renderExportFrame` read purely from this memory object, reducing CPU overhead significantly.

### 2.3 Game Loop and Cinematic Cameras (`js/main.js`)
The `gameLoop` drives cinematic camera movement using smoothing algorithms:
- **Rubber-band & Drone Pilot**: SMOOTH interpolation of camera centers and bearings.
- **FPS Throttling**: The loop respects a `targetFPS` (30/60) to prevent thermal throttling on high-refresh-rate displays.

### 2.4 Rendering The Dashboard (`js/chart.js` & `js/ui.js`)
A canvas-based elevation profile creates a timeline mapping distance to pixels. Interactive tooltips and steepness color mapping (e.g., Strava-style coloring) use pre-calculated grade arrays for instant feedback without real-time math overhead.

### 2.5 Deterministic Video Export Engine (`js/export.js`)
Unlike real-time screen recorders, our engine uses a **Synthetic Simulation Clock**:
1. **Fixed Timesteps**: Each frame advanced the simulation by exactly `1/fps` seconds (e.g., 33.3ms for 30fps).
2. **Buffer Capture**: The engine captures the WebGL and 2D overlay buffers only after they have been mathematically transformed for that specific frame.
3. **High-Fidelity Markers**: Exported pins and text use specialized SVG vector rendering on canvas to ensure video quality matches the "Retina" UI of the browser.

---

## 3. Code Structure (File Breakdown)

- **`index.html`**: Pure DOM framework with Aero-inspired glass-morphism components.
- **`css/styles.css`**: Design system tokens and layout constraints.
- **`js/globals.js`**: Central `renderConfig` state and high-res SVG asset definitions.
- **`js/utils.js`**: Geographical tools (`calculateBearing`, `haversine`, `getGradeColor`).
- **`js/gpx-worker.js`**: Multi-threaded parsing logic.
- **`js/chart.js`**: Elevation profile rendering.
- **`js/map-init.js`**: MapLibre lifecycle management.
- **`js/ui.js`**: Input controller and `renderConfig` synchronization.
- **`js/export.js`**: The deterministic "Locked Clock" recording engine.
- **`js/main.js`**: Playback controller and cinematic camera orchestration.

---

## 4. Graphics & Performance Strategy

### FPS Throttling
The internal clocks detect the user's desired "Smoothness" (30 or 60 FPS) and adjust the `requestAnimationFrame` pressure accordingly.

### Vector-to-Canvas Synchronization
To maintain 1:1 visual parity between the live UI and the final video, the application uses a shared drawing library in `export.js` that mirrors the styling (padding, glass backgrounds, text shadows) of the CSS-based markers found in the live view.
