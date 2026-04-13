        let activeCameraCenter = null;
        let pendingManualPhoto = null;
        let pendingTextDist = null;
        let lastCameraMode = 'director';
        
        let wasPlayingBeforeHidden = false;
        let hiddenStartTime = 0;

        // MapLibre Performance boost for fast 3D parsing & Multi-Threading
        if (navigator.hardwareConcurrency) {
            maplibregl.setWorkerCount(navigator.hardwareConcurrency);
        }

        // Base64 Pre-Loaded SVG Camera Icon for Canvas Elevation Chart Drawing
        const cameraIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" fill="none"><path d="M16 40C16 40 32 26 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 26 16 40 16 40Z" fill="#ffffff" stroke="#0f172a" stroke-width="2"/><path d="M22 18a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.5l1-1.5h3l1 1.5h1.5a1 1 0 0 1 1 1v4z" fill="#0f172a"/><circle cx="16" cy="15" r="2.5" fill="#ffffff"/></svg>';
        const cameraIconImg = new Image();
        cameraIconImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cameraIconSvg);

        const textIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" fill="none"><path d="M16 40C16 40 32 26 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 26 16 40 16 40Z" fill="#0f172a" stroke="#ffffff" stroke-width="2"/><path d="M11 11H21V19H15L11 23V11Z" fill="#ffffff"/></svg>';
        const textIconImg = new Image();
        textIconImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(textIconSvg);

        // --- 2. State & Math Tools ---
        let routeData = null;
        let isPlaying = false;
        let currentDist = 0;
        let lastTime = performance.now();
        let currentBearing = 0; 
        let markers = []; 
        let isBulletTime = false; 
        let currentRealTime = null; 
        let isPreloading = false;
        
        let mediaRecorder = null; let recordedChunks = []; let isRecording = false;
        let exportCanvas = document.getElementById('export-canvas');
        let exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
        let recordingFrameId = null;
        let exportPhase = 'playback'; // 'intro', 'playback', 'outro'
        let phaseStartTime = 0;
        let enableOutroConfig = true; 

        // Performance: Global config cache to avoid DOM thrashing in render loops
        let renderConfig = {
            targetFPS: 60,
            exportClock: 0,
            currentDist: 0,
            currentAlt: 0,
            currentSpeed: 0,
            enableIntro: true,
            enableOutro: true,
            introText: "",
            outroText: "",
            showStats: true,
            showChart: true,
            totalDurationMs: 20000,
            textDurationMs: 4000,
            imageDurationMs: 4000,
            showPhotos: true,
            cameraMode: 'director',
            useDayNight: true,
            isSteepnessMode: false,
            routeColor: '#fc4c02'
        };        
