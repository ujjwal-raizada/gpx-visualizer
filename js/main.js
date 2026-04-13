        // --- 5. Animation & Camera Engine ---
        const timeline = document.getElementById('timeline');
        const speedSelect = document.getElementById('sel-speed');
        const cameraSelect = document.getElementById('sel-camera');
        const zoomSlider = document.getElementById('cam-zoom');
        const btnPlay = document.getElementById('btn-play');
        const btnRestart = document.getElementById('btn-restart');
        
        const domElements = {};
        function $el(id) {
            if (!domElements[id]) domElements[id] = document.getElementById(id);
            return domElements[id];
        }

        let lastRouteActiveUpdate = 0;

        function togglePlay() {
            if (!isPlaying && routeData && currentDist >= routeData.distance - 0.01) {
                currentDist = 0; timeline.value = 0; activeCameraCenter = null;
                photoMarkersArray.forEach(p => p.shown = false);
                textMarkersArray.forEach(t => t.shown = false);
                updateRender(); drawElevationChart(routeData);
            }
            isPlaying = !isPlaying;
            document.getElementById('icon-play').style.display = isPlaying ? 'none' : 'block';
            document.getElementById('icon-pause').style.display = isPlaying ? 'block' : 'none';
            
            if (isPlaying) {
                lastTime = performance.now(); 
                document.getElementById('btn-chart-add-text').style.display = 'none';
                
                if (cameraSelect.value === 'free') {
                    cameraSelect.value = lastCameraMode;
                    document.getElementById('btn-resume').style.display = 'none';
                }

                if (window.innerWidth <= 600 && !uiPanel.classList.contains('collapsed')) {
                    uiPanel.classList.add('collapsed');
                }
            }
        }

        function restartTrek() {
            currentDist = 0; timeline.value = 0;
            activeCameraCenter = null;
            photoMarkersArray.forEach(p => p.shown = false);
            textMarkersArray.forEach(t => t.shown = false);
            updateRender(); drawElevationChart(routeData);
            if (!isPlaying) togglePlay();
        }

        btnPlay.addEventListener('click', togglePlay);
        btnRestart.addEventListener('click', restartTrek);
        
        timeline.addEventListener('input', (e) => {
            if (!routeData) return;
            currentDist = (parseFloat(e.target.value) / 100) * routeData.distance;
            activeCameraCenter = null;
            photoMarkersArray.forEach(p => p.shown = false);
            textMarkersArray.forEach(t => t.shown = false);
            updateRender(); drawElevationChart(routeData);
        });

        const setFreeRoam = () => { 
            if(!isRecording) {
                cameraSelect.value = 'free'; 
                if (isPlaying) document.getElementById('btn-resume').style.display = 'flex';
            }
        };
        map.on('dragstart', setFreeRoam); map.on('wheel', setFreeRoam);

        document.getElementById('btn-resume').addEventListener('click', () => {
            cameraSelect.value = lastCameraMode;
            document.getElementById('btn-resume').style.display = 'none';
        });

        function updateRender() {
            if (!routeData) return null;

            let idx = findPointIndex(routeData.points, currentDist);

            let currentCoord = routeData.points[idx].coord;
            let currentEle = routeData.points[idx].ele;
            currentRealTime = routeData.points[idx].time;
            let currentSpeed = 0;

            if (idx > 0 && routeData.points[idx].dist > currentDist) {
                const p1 = routeData.points[idx-1];
                const p2 = routeData.points[idx];
                const segmentDist = p2.dist - p1.dist; 
                
                if (segmentDist > 0) {
                    const ratio = (currentDist - p1.dist) / segmentDist;
                    currentCoord = [
                        p1.coord[0] + (p2.coord[0] - p1.coord[0]) * ratio,
                        p1.coord[1] + (p2.coord[1] - p1.coord[1]) * ratio
                    ];
                    currentEle = p1.ele + (p2.ele - p1.ele) * ratio;

                    if (p1.time && p2.time) {
                        const timeDeltaHours = (p2.time - p1.time) / 1000 / 3600;
                        if (timeDeltaHours > 0) currentSpeed = segmentDist / timeDeltaHours;
                        currentRealTime = p1.time + (p2.time - p1.time) * ratio;
                    }
                }
            }

            // Sync Stats UI with Smoothing
            const altEl = $el('val-alt');
            const displayedAlt = parseFloat(altEl.innerText.replace(/,/g, '')) || 0;
            const smoothAlt = displayedAlt + (currentEle - displayedAlt) * 0.1;
            renderConfig.currentAlt = Math.round(smoothAlt);
            altEl.innerText = renderConfig.currentAlt.toLocaleString();

            const distEl = $el('val-dist');
            const displayedDist = parseFloat(distEl.innerText) || 0;
            const smoothDist = displayedDist + (currentDist - displayedDist) * 0.2;
            renderConfig.currentDist = parseFloat(smoothDist.toFixed(2));
            distEl.innerText = renderConfig.currentDist;

            const speedEl = $el('val-speed');
            if (routeData.totalTimeSec > 0) {
                const displayedSpeed = parseFloat(speedEl.innerText) || 0;
                const smoothSpeed = displayedSpeed + (currentSpeed - displayedSpeed) * 0.1;
                renderConfig.currentSpeed = parseFloat(smoothSpeed.toFixed(1));
                speedEl.innerText = renderConfig.currentSpeed;
            }

            if (currentRealTime) {
                const d = new Date(currentRealTime);
                $el('val-clock').innerText = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            // Segment Feature Building for Steepness
            let activeFeatures = [];
            const isSteep = renderConfig.isSteepnessMode;
            const routeColor = renderConfig.routeColor;

            if (isSteep) {
                activeFeatures = routeData.segments.slice(0, idx).map(s => ({
                    type: "Feature", properties: { color: s.color }, geometry: { type: "LineString", coordinates: s.coords }
                }));
                if (idx < routeData.points.length - 1) {
                    activeFeatures.push({
                        type: "Feature", properties: { color: routeData.segments[idx]?.color || routeColor },
                        geometry: { type: "LineString", coordinates: [routeData.points[idx].coord, currentCoord] }
                    });
                }
            } else {
                const drawnCoords = routeData.points.slice(0, idx).map(p => p.coord);
                drawnCoords.push(currentCoord); 
                activeFeatures = [{ type: "Feature", properties: { color: routeColor }, geometry: { type: "LineString", coordinates: drawnCoords } }];
            }

            if (map.getSource('route-active')) {
                // Throttle heavy Vector Tile line generations to ~30 FPS to stop MapLibre from Worker-locking & flickering
                const now = performance.now();
                if (now - lastRouteActiveUpdate > 33 || !isPlaying) {
                    map.getSource('route-active').setData({ type: "FeatureCollection", features: activeFeatures });
                    lastRouteActiveUpdate = now;
                }
                
                map.getSource('route-head').setData({ type: "Feature", properties: { color: isSteep ? (activeFeatures[activeFeatures.length-1]?.properties.color || routeColor) : routeColor }, geometry: { type: "Point", coordinates: currentCoord } });
            }

            renderMinimapUI();

            return { currentCoord, currentIdx: idx, currentEle };
        }

        // --- Day/Night Lighting System ---
        function updateDayNightLighting() {
            if (!renderConfig.useDayNight) {
                document.getElementById('map-container').style.background = 'linear-gradient(180deg, #0f172a 0%, #1e293b 40%, #38bdf8 100%)';
                if (map.getLayer('satellite-layer')) map.setPaintProperty('satellite-layer', 'raster-brightness-max', 1);
                return;
            }

            let hour = 12;
            if (currentRealTime && routeData.totalTimeSec > 0) {
                const date = new Date(currentRealTime);
                hour = date.getHours() + date.getMinutes() / 60;
            } else {
                hour = 6 + (currentDist / routeData.distance) * 12; 
            }

            let darkness = 0;
            let skyGrad = '';
            
            if (hour < 5 || hour > 19) {
                darkness = 0.8; 
                skyGrad = 'linear-gradient(180deg, #020617 0%, #0f172a 100%)';
            } else if (hour >= 5 && hour < 7) {
                darkness = 0.8 - ((hour - 5) / 2) * 0.8; 
                skyGrad = 'linear-gradient(180deg, #0f172a 0%, #7e22ce 40%, #f59e0b 100%)';
            } else if (hour >= 17 && hour <= 19) {
                darkness = ((hour - 17) / 2) * 0.8; 
                skyGrad = 'linear-gradient(180deg, #1e1b4b 0%, #9f1239 40%, #fb923c 100%)';
            } else {
                darkness = 0; 
                skyGrad = 'linear-gradient(180deg, #0ea5e9 0%, #38bdf8 40%, #7dd3fc 100%)';
            }

            document.getElementById('map-container').style.background = skyGrad;
            if (map.getLayer('satellite-layer')) {
                map.setPaintProperty('satellite-layer', 'raster-brightness-max', 1 - (darkness * 0.6));
            }
        }

        let currentActivePhoto = null;
        let currentActiveText = null;
        let activePhotoTimeout = null;
        let activeTextTimeout = null;

        function showTextPopup(textObj, now = performance.now()) {
            const overlay = document.getElementById('text-popup-overlay');
            const content = document.getElementById('text-popup-content');
            
            const displayTimeMs = renderConfig.textDurationMs;
            currentActiveText = { text: textObj.text, style: textObj.style, coord: textObj.marker.getLngLat(), startTime: now, endTime: now + displayTimeMs + 500 };

            if (isPreloading) return;

            if (textObj.style === '3d-pin' && textObj.el) {
                textObj.el.classList.add('active-3d-pin');
                
                if (textObj.localTimeout) clearTimeout(textObj.localTimeout);
                textObj.localTimeout = setTimeout(() => {
                    textObj.el.classList.remove('active-3d-pin');
                }, displayTimeMs);
            } else {
                content.innerText = textObj.text;
                overlay.style.display = 'block';
                void overlay.offsetWidth; 
                overlay.style.opacity = 1;

                if (activeTextTimeout) clearTimeout(activeTextTimeout);
                activeTextTimeout = setTimeout(() => {
                    overlay.style.opacity = 0;
                    setTimeout(() => { if (overlay.style.opacity == 0) overlay.style.display = 'none'; }, 500);
                }, displayTimeMs);
            }
        }

        function showPhotoPopup(p, now = performance.now()) {
            const url = p.url;
            const overlay = document.getElementById('photo-popup-overlay');
            const img = document.getElementById('photo-popup-img');
            const styleMode = renderConfig.photoStyle || '3d-pin';
            
            const displayTimeMs = renderConfig.imageDurationMs;

            const canvasImg = new Image();
            canvasImg.src = url;
            currentActivePhoto = {
                img: canvasImg,
                style: styleMode,
                coord: p.marker.getLngLat(),
                startTime: now,
                endTime: now + displayTimeMs + 500
            };

            if (isPreloading) return;

            if (styleMode === '3d-pin' && p.el) {
                p.el.classList.add('active-3d-pin');
                
                if (p.localTimeout) clearTimeout(p.localTimeout);
                p.localTimeout = setTimeout(() => {
                    p.el.classList.remove('active-3d-pin');
                }, displayTimeMs);
            } else if (styleMode === 'fullscreen') {
                if (activePhotoTimeout) clearTimeout(activePhotoTimeout);
                img.src = url;
                overlay.style.display = styleMode === 'fullscreen' ? 'flex' : 'block';
                void overlay.offsetWidth; 
                overlay.style.opacity = 1;
                overlay.style.transform = styleMode === 'fullscreen' ? 'none' : 'translateY(0)';

                activePhotoTimeout = setTimeout(() => {
                    overlay.style.opacity = 0;
                    if (styleMode !== 'fullscreen') overlay.style.transform = 'translateY(20px)';
                    setTimeout(() => { if (overlay.style.opacity == 0) overlay.style.display = 'none'; }, 500);
                }, displayTimeMs);
            } else {
                if (activePhotoTimeout) clearTimeout(activePhotoTimeout);
                img.src = url;
                overlay.style.display = styleMode === 'fullscreen' ? 'flex' : 'block';
                void overlay.offsetWidth; 
                overlay.style.opacity = 1;
                overlay.style.transform = styleMode === 'fullscreen' ? 'none' : 'translateY(0)';

                activePhotoTimeout = setTimeout(() => {
                    overlay.style.opacity = 0;
                    if (styleMode !== 'fullscreen') overlay.style.transform = 'translateY(20px)';
                    setTimeout(() => { if (overlay.style.opacity == 0) overlay.style.display = 'none'; }, 500);
                }, displayTimeMs);
            }
        }

        function gameLoop(timestamp) {
            const dt = timestamp - lastTime;
            const targetDelta = 1000 / renderConfig.targetFPS;

            if (dt < targetDelta && !isRecording) {
                requestAnimationFrame(gameLoop);
                return;
            }
            
            lastTime = timestamp;

            if (!routeData) {
                requestAnimationFrame(gameLoop);
                return;
            }

            if (isPreloading) {
                const frames = Math.max(300, routeData.distance * 3); 
                currentDist += routeData.distance / frames; 
                
                if (currentDist >= routeData.distance) {
                    isPreloading = false;
                    currentDist = 0;
                    activeCameraCenter = null;
                    updateRender(); 
                    
                    document.getElementById('loading-text').innerText = "FINALIZING CACHE...";
                    document.getElementById('loading-bar').style.width = '100%';
                    
                    setTimeout(beginExportRecording, 2500);
                    requestAnimationFrame(gameLoop);
                    return; 
                }
                const prog = (currentDist / routeData.distance) * 100;
                document.getElementById('loading-bar').style.width = `${prog}%`;
                
                let etaText = "";
                const elapsed = performance.now() - phaseStartTime;
                if (prog > 5 && elapsed > 1000) {
                    const totalEst = elapsed / (prog / 100);
                    const remaining = Math.max(0, (totalEst - elapsed) / 1000);
                    etaText = ` - ETA: ${Math.ceil(remaining)}s`;
                }
                document.getElementById('loading-text').innerText = `CACHING HIGH-RES TERRAIN... ${Math.floor(prog)}%${etaText}`;
            }

            let renderData = null;
            if (exportPhase === 'playback' || !isRecording) {
                renderData = updateRender();
                let activeSpeedMultiplier = parseFloat(document.getElementById('sel-speed').value);
                let mode = renderConfig.cameraMode;
                let trackingMode = document.getElementById('sel-tracking').value;
                let dynamicPadding = { bottom: 0, top: 0, left: 0, right: 0 };
                
                updateDayNightLighting();
                if (mode !== 'free') document.getElementById('btn-resume').style.display = 'none';

                if (mode === 'director') {
                    const progress = currentDist / routeData.distance;
                    if (progress < 0.15) mode = 'orbit';
                    else if (progress < 0.35) mode = 'drone';
                    else if (progress < 0.65) mode = 'cinematic';
                    else if (progress < 0.85) mode = 'cinematic2';
                    else mode = 'orbit';
                }

                if (mode === 'cinematic2' && renderData) {
                    let minDistToWpt = Infinity;
                    if (routeData.waypoints && routeData.waypoints.length > 0) {
                        routeData.waypoints.forEach(wpt => {
                            const dist = haversine(renderData.currentCoord[1], renderData.currentCoord[0], wpt.coord[1], wpt.coord[0]);
                            if (dist < minDistToWpt) minDistToWpt = dist;
                        });
                    }

                    photoMarkersArray.forEach(p => {
                        const dist = haversine(renderData.currentCoord[1], renderData.currentCoord[0], p.coord[1], p.coord[0]);
                        if (dist < minDistToWpt) minDistToWpt = dist;
                    });

                    if (minDistToWpt < 0.2) { 
                        isBulletTime = true;
                        activeSpeedMultiplier *= 0.15; 
                    } else {
                        isBulletTime = false;
                        if (routeData.points.length > renderData.currentIdx + 10) {
                            const futurePt = routeData.points[renderData.currentIdx + 10];
                            const eleDiff = futurePt.ele - renderData.currentEle;
                            const distDiff = futurePt.dist - currentDist;
                            if (distDiff > 0) {
                                const grade = eleDiff / (distDiff * 1000); 
                                if (grade > 0.08) activeSpeedMultiplier *= 0.6; 
                                else if (grade < -0.08) activeSpeedMultiplier *= 1.5; 
                                else activeSpeedMultiplier *= 1.2; 
                            }
                        }
                    }
                    dynamicPadding = { bottom: window.innerHeight * 0.15 };
                }

                if (isPlaying && !isPreloading) {
                    const durationMs = renderConfig.totalDurationMs; 
                    const baseSpeed = routeData.distance / durationMs; 
                    
                    let popupSlowdown = 1.0;
                    const now = isRecording ? renderConfig.exportClock : performance.now();
                    const frameDt = isRecording ? (1000 / renderConfig.targetFPS) : dt;

                    if ((currentActivePhoto && currentActivePhoto.endTime > now) || (currentActiveText && currentActiveText.endTime > now)) {
                        popupSlowdown = 0.05; 
                    }

                    currentDist += (baseSpeed * activeSpeedMultiplier * frameDt) * popupSlowdown;
                    
                    // Photo Crossing Check
                    photoMarkersArray.forEach(p => {
                        if (!p.shown) {
                            const distToPhoto = Math.abs(currentDist - p.dist); 
                            if (distToPhoto < 0.05) { 
                                p.shown = true;
                                const simNow = isRecording ? renderConfig.exportClock : performance.now();
                                showPhotoPopup(p, simNow);
                            }
                        }
                    });

                    // Text Marker Crossing Check
                    textMarkersArray.forEach(t => {
                        if (!t.shown) {
                            const distToText = Math.abs(currentDist - t.dist); 
                            if (distToText < 0.05) { 
                                t.shown = true;
                                const simNow = isRecording ? renderConfig.exportClock : performance.now();
                                showTextPopup(t, simNow);
                            }
                        }
                    });

                    if (currentDist >= routeData.distance) {
                        currentDist = routeData.distance;
                        isPlaying = false;
                        document.getElementById('icon-play').style.display = 'block';
                        document.getElementById('icon-pause').style.display = 'none';
                        
                        if (isRecording) {
                            if (enableOutroConfig) {
                                exportPhase = 'outro';
                                phaseStartTime = performance.now();
                            } else {
                                stopRecording();
                            }
                        }
                    }
                    
                    const progressPct = (currentDist / routeData.distance) * 100;
                    timeline.value = progressPct;
                    drawElevationChart(routeData);

                    if (isRecording) {
                        document.getElementById('export-progress-bar').style.width = progressPct + '%';
                        
                        let etaText = "";
                        const elapsed = performance.now() - phaseStartTime;
                        if (progressPct > 5 && elapsed > 2000) {
                            const totalEst = elapsed / (progressPct / 100);
                            const remaining = Math.max(0, (totalEst - elapsed) / 1000);
                            etaText = ` • ETA: ${Math.ceil(remaining)}s`;
                        }
                        
                        document.getElementById('export-progress-text').innerText = `${Math.floor(progressPct)}%${etaText}`;
                    }
                }

                // Normal Camera Execution Block
                const baseZoom = parseFloat(zoomSlider.value);
                const smoothVal = parseFloat(document.getElementById('cam-smoothness').value); 
                const smoothFactor = Math.pow(20, (smoothVal - 50) / 50); 
                
                if (!activeCameraCenter) {
                    activeCameraCenter = [...renderData.currentCoord];
                }

                let targetCamCoord = [...renderData.currentCoord];

                if (trackingMode === 'lookahead') {
                    let fDist = currentDist + Math.min(routeData.distance * 0.02, 0.2); 
                    let fIdx = findPointIndex(routeData.points, fDist, renderData.currentIdx);
                    let fCoord = routeData.points[fIdx].coord;
                    targetCamCoord = [(renderData.currentCoord[0] + fCoord[0]) / 2, (renderData.currentCoord[1] + fCoord[1]) / 2];
                }

                let lerpFactor = 0.08; 
                if (trackingMode === 'dronepilot') lerpFactor = 0.015;

                let safeDt = Math.min(dt, 100);
                let adjustedLerp = 1 - Math.pow(1 - lerpFactor, safeDt / 16.66);
                if (isNaN(adjustedLerp)) adjustedLerp = 1.0;

                activeCameraCenter[0] += (targetCamCoord[0] - activeCameraCenter[0]) * adjustedLerp;
                activeCameraCenter[1] += (targetCamCoord[1] - activeCameraCenter[1]) * adjustedLerp;

                if (mode === 'orbit') {
                    currentBearing += (15 * dt / 1000);
                    const currentPitch = map.getPitch();
                    map.jumpTo({ 
                        center: activeCameraCenter,
                        bearing: currentBearing,
                        pitch: currentPitch + (60 - currentPitch) * 0.05,
                        zoom: baseZoom - 0.5 
                    });
                } 
                else if ((mode === 'follow' || mode === 'drone' || mode === 'cinematic' || mode === 'cinematic2') && renderData) {
                    
                    let aheadPoint = renderData.currentCoord;
                    let lookAheadDist = 0.02; 
                    if (mode === 'drone') lookAheadDist = 0.04;
                    if (mode === 'cinematic') lookAheadDist = 0.40; 
                    if (mode === 'cinematic2') lookAheadDist = 0.40; 
                    
                    lookAheadDist *= smoothFactor; 
                    
                    let aIdx = findPointIndex(routeData.points, currentDist + lookAheadDist, renderData.currentIdx);
                    aheadPoint = routeData.points[aIdx].coord;
                    if (aheadPoint === renderData.currentCoord && routeData.points.length > 0) aheadPoint = routeData.points[routeData.points.length - 1].coord;

                    if (aheadPoint[0] !== activeCameraCenter[0] || aheadPoint[1] !== activeCameraCenter[1]) {
                        let targetBearing = calculateBearing(activeCameraCenter[1], activeCameraCenter[0], aheadPoint[1], aheadPoint[0]);
                        
                        if (mode === 'cinematic' || mode === 'cinematic2') targetBearing += Math.sin(timestamp / 6000) * 15; 
                        if (mode === 'cinematic2' && isBulletTime) targetBearing = currentBearing + 20; 

                        let diff = targetBearing - currentBearing;
                        if (diff > 180) diff -= 360;
                        if (diff < -180) diff += 360;
                        
                        let turnSmoothing = 0.04; 
                        if (mode === 'drone') turnSmoothing = 0.015;
                        if (mode === 'cinematic') turnSmoothing = 0.0015; 
                        if (mode === 'cinematic2') turnSmoothing = isBulletTime ? 0.01 : 0.0015; 
                        
                        turnSmoothing /= smoothFactor; 
                        
                        currentBearing += diff * turnSmoothing; 
                    }

                    const currentPitch = map.getPitch();
                    let targetPitch = 60;
                    let targetZoom = baseZoom;
                    
                    if (mode === 'drone') {
                        targetPitch = 55; targetZoom = baseZoom + 1.0;
                    } else if (mode === 'cinematic' || mode === 'cinematic2') {
                        const eleRange = Math.max(1, routeData.maxEle - routeData.minEle);
                        const eleNorm = Math.max(0, Math.min(1, (renderData.currentEle - routeData.minEle) / eleRange));
                        targetZoom = baseZoom + ((1 - eleNorm) * 0.5); 
                        targetPitch = 50 + (eleNorm * 10); 

                        if (mode === 'cinematic2' && isBulletTime) { targetPitch = 65; targetZoom = baseZoom + 0.8; }
                    }
                    
                    const newPitch = currentPitch + (targetPitch - currentPitch) * 0.02;
                    const currentMapZoom = map.getZoom();
                    const newZoom = currentMapZoom + (targetZoom - currentMapZoom) * 0.01;

                    map.jumpTo({ center: activeCameraCenter, bearing: currentBearing, pitch: newPitch, zoom: newZoom, padding: dynamicPadding });
                }
            } 
            else if (exportPhase === 'intro') {
                currentDist = 0;
                updateRender();
                currentBearing += (15 * dt / 1000); 
                const currentPitch = map.getPitch();
                const currentMapZoom = map.getZoom();
                const baseZoom = parseFloat(zoomSlider.value);
                
                map.jumpTo({
                    center: routeData.points[0].coord,
                    bearing: currentBearing,
                    pitch: currentPitch + (60 - currentPitch) * 0.05,
                    zoom: currentMapZoom + ((baseZoom - 0.5) - currentMapZoom) * 0.05,
                    padding: { bottom: 0, top: 0, left: 0, right: 0 }
                });
            }
            else if (exportPhase === 'outro') {
                currentDist = routeData.distance;
                updateRender();
                currentBearing += (5 * dt / 1000); 
                
                const targetCam = map.cameraForBounds(routeData.bounds, { padding: 100 });
                const targetZoom = targetCam ? targetCam.zoom : parseFloat(zoomSlider.value) - 2;
                const targetCenter = targetCam ? [targetCam.center.lng, targetCam.center.lat] : [routeData.bounds.getCenter().lng, routeData.bounds.getCenter().lat];

                const currentPitch = map.getPitch();
                const currentMapZoom = map.getZoom();
                const currentCenterObj = map.getCenter();

                map.jumpTo({
                    center: [
                        currentCenterObj.lng + (targetCenter[0] - currentCenterObj.lng) * 0.02,
                        currentCenterObj.lat + (targetCenter[1] - currentCenterObj.lat) * 0.02
                    ],
                    bearing: currentBearing,
                    pitch: currentPitch + (0 - currentPitch) * 0.03,
                    zoom: currentMapZoom + (targetZoom - currentMapZoom) * 0.02,
                    padding: { bottom: 0, top: 0, left: 0, right: 0 }
                });
            }

            requestAnimationFrame(gameLoop);
        }

        // --- 7. Setup Route & File Handling ---
        function processGPXString(gpxString) {
            // Re-initialize state structures
            photoMarkersArray.forEach(p => { if (p.marker) p.marker.remove(); });
            photoMarkersArray.length = 0;
            if (typeof updatePhotoListUI === 'function') updatePhotoListUI();

            textMarkersArray.forEach(t => { if (t.marker) t.marker.remove(); });
            textMarkersArray.length = 0;
            if (typeof updateTextListUI === 'function') updateTextListUI();

            if (document.getElementById('icon-play')) document.getElementById('icon-play').style.display = 'block';
            if (document.getElementById('icon-pause')) document.getElementById('icon-pause').style.display = 'none';

            document.getElementById('val-dist').innerText = '0.00';
            document.getElementById('val-alt').innerText = '0';
            document.getElementById('val-speed').innerText = '0.0';
            timeline.value = 0;

            routeData = null;
            isPlaying = false;
            currentDist = 0;
            isPreloading = false;

            document.getElementById('welcome-panel').style.display = 'none';

            document.getElementById('loading').style.display = 'flex';
            document.getElementById('loading-text').innerText = "PARSING GPX FILE...";
            document.getElementById('loading-bar-container').style.display = 'block'; 
            document.getElementById('loading-bar').style.width = '0%';

            const gpxWorker = new Worker(workerUrl);
            gpxWorker.postMessage(gpxString);
            
            gpxWorker.onmessage = function(msg) {
                if (msg.data.type === 'progress') {
                    document.getElementById('loading-bar').style.width = `${msg.data.percent}%`;
                }
                else if (msg.data.type === 'done') {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('loading-bar-container').style.display = 'none';
                    displayRoute(msg.data.data);
                    
                    drawElevationChart(msg.data.data);
                    
                    // Auto-collapse side menu on mobile
                    if (window.innerWidth <= 600 && !uiPanel.classList.contains('collapsed')) {
                        uiPanel.classList.add('collapsed');
                    }
                    
                    gpxWorker.terminate();
                }
                else if (msg.data.type === 'error') {
                    document.getElementById('loading').style.display = 'none';
                    showToast(msg.data.message);
                    gpxWorker.terminate();
                }
            };
        }

        function displayRoute(data) {
            routeData = data;
            routeData.bounds = new maplibregl.LngLatBounds(data.boundsInfo[0], data.boundsInfo[1]);
            
            // Performance: Generate simplified point list for 2D Canvas Path rendering
            const points = routeData.points;
            if (points.length > 500) {
                const step = Math.ceil(points.length / 500);
                routeData.canvasPoints = points.filter((_, i) => i % step === 0);
                // Ensure last point is always included
                if (routeData.canvasPoints[routeData.canvasPoints.length - 1] !== points[points.length - 1]) {
                    routeData.canvasPoints.push(points[points.length - 1]);
                }
            } else {
                routeData.canvasPoints = points;
            }
            
            currentDist = 0; isPlaying = false; 
            activeCameraCenter = null;
            document.getElementById('icon-play').style.display = 'none';
            document.getElementById('icon-pause').style.display = 'block';
            timeline.value = 0;
            if(cameraSelect.value === 'free') cameraSelect.value = lastCameraMode; 

            markers.forEach(m => m.remove());
            markers = [];
            const routeColor = document.getElementById('route-color').value;
            const isSteep = document.getElementById('chk-steepness').checked;

            // Generate 3D Hologram Waypoints
            data.waypoints.forEach(wpt => {
                const el = document.createElement('div');
                el.className = 'hologram-marker';
                el.innerText = wpt.name;
                
                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] })
                    .setLngLat(wpt.coord)
                    .addTo(map);
                markers.push(marker);
            });

            document.getElementById('val-dist').textContent = data.distance.toFixed(1);
            document.getElementById('val-alt').textContent = "0"; 
            document.getElementById('val-ele').textContent = Math.round(data.elevation).toLocaleString();
            
            if (data.totalTimeSec > 0) {
                document.getElementById('val-time').textContent = formatTime(data.totalTimeSec);
                document.getElementById('stat-time-container').style.display = 'flex';
                document.getElementById('stat-speed-container').style.display = 'flex';
                document.getElementById('stat-clock-container').style.display = 'flex';
            } else {
                document.getElementById('stat-time-container').style.display = 'none';
                document.getElementById('stat-speed-container').style.display = 'none';
                document.getElementById('stat-clock-container').style.display = 'none';
            }

            document.getElementById('stats').style.display = 'grid';
            document.getElementById('playback-panel').style.display = 'flex';
            eleContainer.style.display = 'block';
            
            const fullCoords = data.points.map(p => p.coord);
            const fullGeoJSON = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: fullCoords } }] };
            const emptyGeoJSON = { type: "FeatureCollection", features: [] };

            if (!map.getSource('route-bg')) {
                map.addSource('route-bg', { type: 'geojson', data: fullGeoJSON });
                map.addSource('route-active', { type: 'geojson', data: emptyGeoJSON });
                map.addSource('route-head', { type: 'geojson', data: { type: "Feature", geometry: { type: "Point", coordinates: fullCoords[0] } } });
                
                map.addLayer({ 'id': 'route-line-bg', 'type': 'line', 'source': 'route-bg', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.2 } });
                map.addLayer({ 'id': 'route-line-glow', 'type': 'line', 'source': 'route-active', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': isSteep ? ['get', 'color'] : routeColor, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 20], 'line-opacity': 0.7, 'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 12] } });
                map.addLayer({ 'id': 'route-line', 'type': 'line', 'source': 'route-active', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5], 'line-opacity': 1 } });
                
                map.addLayer({ 'id': 'route-head-glow', 'type': 'circle', 'source': 'route-head', 'paint': { 'circle-translate': [0, -20], 'circle-radius': 14, 'circle-color': isSteep ? ['get', 'color'] : routeColor, 'circle-opacity': 0.6, 'circle-blur': 0.8 } });
                map.addLayer({ 'id': 'route-head-core', 'type': 'circle', 'source': 'route-head', 'paint': { 'circle-translate': [0, -20], 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-width': 2, 'circle-stroke-color': isSteep ? ['get', 'color'] : routeColor } });
            } else {
                map.getSource('route-bg').setData(fullGeoJSON);
                map.getSource('route-active').setData(emptyGeoJSON);
                updateRouteColorDisplay(isSteep ? ['get', 'color'] : routeColor);
            }
            
            drawElevationChart(data);

            map.fitBounds(data.bounds, { padding: { top: 80, bottom: 180, left: window.innerWidth > 600 ? 400 : 80, right: 80 }, pitch: 65, bearing: map.getBearing() + 45, duration: 3000, maxZoom: 15 });
            currentBearing = map.getBearing(); 
            
            // Wait for tiles & terrain to fully download before starting heavy movement, preventing initial flickering
            map.once('idle', () => {
                if (!isPlaying && !isRecording && currentDist === 0) {
                    togglePlay();
                }
            });
        }

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        function showToast(msg, duration = 5000) { 
            const toast = document.getElementById('toast'); 
            toast.textContent = msg; 
            toast.style.display = 'block'; 
            setTimeout(() => { 
                if(!pendingManualPhoto) toast.style.display = 'none'; 
            }, duration); 
        }

        function handleFile(file) {
            if (!file || !file.name.toLowerCase().endsWith('.gpx')) { showToast("Please upload a valid .gpx file."); return; }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                processGPXString(e.target.result);
            };
            reader.onerror = () => { showToast("Error reading file."); }
            reader.readAsText(file);
        }

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
        fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); fileInput.value = ''; });
