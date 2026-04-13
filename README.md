# ujjwal.needs.respawn GPX Studio

**GPX Studio** is a high-performance, cinematic 3D terrain visualizer for GPS tracks. Transform your Strava, Garmin, or AllTrails `.gpx` logs into stunning flyover videos with telemetry overlays, geo-tagged photos, and custom text markers.

## <img src="assets/icons/features.svg" width="20" height="20" style="vertical-align: middle;"> Features

- **Cinematic Drone Cameras**: Multiple tracking algorithms including Director’s Cut, Drone Pilot, and Rubber-Band smoothing.
- **3D Terrain Rendering**: Real-time altitude mapping and high-resolution topographic/satellite terrain.
- **Dynamic Media Overlays**:
    - Place **geo-tagged photos** directly on the 3D map.
    - Synchronize **text markers** and narrative cards to specific trek points.
- **Deterministic 4K Export**: A custom frame-by-frame rendering engine ensures perfectly smooth 30 or 60 FPS video output, regardless of hardware speed.
- **Environment Controls**: Real-time steepness color mapping, day/night cycles, and high-performance elevation charts.
- **Privacy-First**: All processing (parsing, rendering, and export) happens entirely in your browser. No data ever leaves your computer.

## <img src="assets/icons/getting-started.svg" width="20" height="20" style="vertical-align: middle;"> Getting Started

1.  **Load your track**: Drag and drop any `.gpx` file into the studio.
2.  **Add Media**: Upload geo-tagged photos or click the elevation chart to add text markers at specific points.
3.  **Choose your view**: Select a camera mode (like *Director's Cut* or *Cinematic 2.0*).
4.  **Export**: Click "Export Video," configure your intro/outro settings, and hit RECORD.

## <img src="assets/icons/tech-stack.svg" width="20" height="20" style="vertical-align: middle;"> Technology Stack

- **Graphics**: [MapLibre GL JS](https://maplibre.org/) for the 3D WebGL context.
- **Concurrency**: Web Workers for heavy GPX parsing and geometric calculations.
- **Video Logic**: Browser-native `MediaRecorder` API with a deterministic frame-tick synchronization.
- **Styling**: Modern CSS with glass-mophism aesthetics and responsive panels.

## <img src="assets/icons/project-structure.svg" width="20" height="20" style="vertical-align: middle;"> Project Structure

- `index.html`: The core application framework.
- `js/main.js`: The project controller and camera orchestration.
- `js/export.js`: The recording engine and deterministic clock logic.
- `js/globals.js`: Centralized high-performance state management (`renderConfig`).
- `js/gpx-worker.js`: Multi-threaded GPX ingestion.
- `css/styles.css`: The "Aero" inspired design system.

## <img src="assets/icons/contributing.svg" width="20" height="20" style="vertical-align: middle;"> Contributing

This project is built for performance and visual excellence. For architectural details, please refer to the [Design Document](design.md).

---

Built with precision by [ujjwal.needs.respawn](https://www.instagram.com/ujjwal.needs.respawn/)
