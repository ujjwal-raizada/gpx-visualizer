        // --- 1. Map Initialization (Performance Tweaked & Everest Default) ---
        const map = new maplibregl.Map({
            container: 'map',
            preserveDrawingBuffer: true,
            antialias: window.innerWidth > 600, // Disable antialias on mobile to save GPU processing
            pixelRatio: Math.min(window.devicePixelRatio, 1.5), 
            maxTileCacheSize: 500, 
            style: {
                "version": 8,
                "sources": {
                    "satellite": {
                        "type": "raster",
                        "tiles": ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
                        "tileSize": 256, "maxzoom": 19
                    },
                    "topo": {
                        "type": "raster",
                        "tiles": ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
                        "tileSize": 256, "maxzoom": 17
                    },
                    "dark": {
                        "type": "raster",
                        "tiles": ["https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"],
                        "tileSize": 256, "maxzoom": 19
                    },
                    "terrain": {
                        "type": "raster-dem",
                        "tiles": ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
                        "encoding": "terrarium", "tileSize": 256, 
                        "maxzoom": window.innerWidth <= 600 ? 10 : 11 // Lower maxzoom heavily stabilizes mobile performance
                    }
                },
                "layers": [
                    { "id": "background", "type": "background", "paint": { "background-color": "#0f172a" } },
                    { "id": "satellite-layer", "type": "raster", "source": "satellite", "layout": {"visibility": "visible"} },
                    { "id": "topo-layer", "type": "raster", "source": "topo", "layout": {"visibility": "none"} },
                    { "id": "dark-layer", "type": "raster", "source": "dark", "layout": {"visibility": "none"} }
                ]
            },
            center: [86.85, 27.85], // Backed off slightly to keep Everest framed correctly
            zoom: 11.2, pitch: 65, bearing: 40, maxPitch: 75, attributionControl: false
        });

        const navControl = new maplibregl.NavigationControl({ visualizePitch: true, showZoom: false });
        map.addControl(navControl, 'bottom-right');

        map.on('load', () => {
            map.setTerrain({ source: 'terrain', exaggeration: 1.2 });

            // Gentle orbital panning for the home screen
            let startOrbit = true;
            map.on('dragstart', () => { startOrbit = false; });
            const orbitLoop = () => {
                if(!routeData && startOrbit) {
                    map.setBearing(map.getBearing() + 0.03);
                }
                if(!routeData) requestAnimationFrame(orbitLoop);
            };
            orbitLoop();

            requestAnimationFrame(gameLoop);
            
            window.addEventListener('resize', () => {
                if(routeData && !isRecording) drawElevationChart(routeData);
            });
        });

        // Map User Zoom Syncing
        map.on('zoom', () => {
            if (document.getElementById('sel-camera').value === 'free' && !isRecording) {
                document.getElementById('cam-zoom').value = map.getZoom().toFixed(1);
            }
        });

