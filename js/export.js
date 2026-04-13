        // --- 6. Export Video Engine ---
        function renderExportFrame() {
            if (!isRecording) return;
            
            const mapCanvas = document.querySelector('.maplibregl-canvas');
            if (mapCanvas) {
                exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
                const scale = Math.max(exportCanvas.width, exportCanvas.height) >= 1280 ? 1.5 : 1;
                
                // Deterministic Clock Tick
                const frameStep = 1000 / renderConfig.targetFPS;
                renderConfig.exportClock += frameStep;
                const now = renderConfig.exportClock;

                if (exportPhase === 'intro') {
                    exportCtx.drawImage(mapCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
                    
                    const introText = renderConfig.introText || "";
                    const elapsed = now - phaseStartTime;
                    const introProgress = Math.min(1, elapsed / 3000);
                    
                    let overlayAlpha = 1.0;
                    if (elapsed > 2500) overlayAlpha = Math.max(0, 1.0 - ((elapsed - 2500) / 500));
                    
                    exportCtx.fillStyle = '#000000';
                    exportCtx.fillRect(0, 0, exportCanvas.width, 100 * scale);
                    exportCtx.fillRect(0, exportCanvas.height - 100 * scale, exportCanvas.width, 100 * scale);

                    exportCtx.fillStyle = `rgba(10, 15, 30, ${Math.min(0.9, overlayAlpha)})`;
                    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                    
                    exportCtx.globalAlpha = Math.min(1.0, overlayAlpha);
                    
                    // Draw Dynamic 2D Line diagram behind text
                    drawPathOnCanvas(exportCtx, exportCanvas.width, exportCanvas.height, exportCanvas.height * 0.25, routeData.distance * introProgress, 6 * scale);

                    exportCtx.textAlign = 'center';
                    exportCtx.textBaseline = 'middle';
                    
                    // Draw Accent glowing line
                    exportCtx.shadowColor = 'rgba(56, 189, 248, 0.8)';
                    exportCtx.shadowBlur = 15 * scale;
                    exportCtx.fillStyle = '#38bdf8';
                    exportCtx.fillRect(exportCanvas.width/2 - 50*scale, exportCanvas.height/2 - 50*scale, 100*scale, 4*scale);

                    if (introText) {
                        const textX = exportCanvas.width / 2;
                        const textY = exportCanvas.height / 2 - 10 * scale;
                        
                        exportCtx.font = `800 ${56 * scale}px Inter, sans-serif`;
                        
                        // Glow & Deep Shadow
                        exportCtx.shadowColor = 'rgba(56, 189, 248, 0.6)';
                        exportCtx.shadowBlur = 40 * scale;
                        exportCtx.shadowOffsetY = 8 * scale;
                        exportCtx.fillStyle = '#0f172a';
                        exportCtx.fillText(introText.toUpperCase(), textX, textY + 6 * scale);
                        
                        // 3D Extrusion
                        exportCtx.shadowColor = 'transparent';
                        exportCtx.shadowBlur = 0;
                        exportCtx.shadowOffsetY = 0;
                        exportCtx.fillStyle = '#475569';
                        for (let i = 6; i >= 1; i--) {
                            exportCtx.fillText(introText.toUpperCase(), textX, textY + i * scale);
                        }
                        
                        // Bright Top Face
                        exportCtx.fillStyle = '#ffffff';
                        exportCtx.fillText(introText.toUpperCase(), textX, textY);
                    }
                    
                    // Subtitle stats
                    exportCtx.shadowColor = 'rgba(0,0,0,0.8)';
                    exportCtx.shadowBlur = 10 * scale;
                    exportCtx.shadowOffsetY = 2 * scale;
                    exportCtx.font = `500 ${20 * scale}px Inter, sans-serif`;
                    exportCtx.fillStyle = '#cbd5e1';
                    exportCtx.fillText(`DISTANCE: ${routeData.distance.toFixed(1)} KM   |   ELEVATION: ${Math.round(routeData.elevation)} M`, exportCanvas.width/2, exportCanvas.height/2 + 50*scale);
                    
                    exportCtx.globalAlpha = 1.0;
                    exportCtx.shadowColor = 'transparent';
                    exportCtx.shadowBlur = 0;
                    
                    
                    if (elapsed > 3000) {
                        exportPhase = 'playback';
                        phaseStartTime = renderConfig.exportClock;
                        togglePlay(); 
                    }
                } 
                else if (exportPhase === 'playback') {
                    
                    exportCtx.drawImage(mapCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
                    
                    if (renderConfig.showStats) {
                        const hasTime = routeData.totalTimeSec > 0;
                        const pad = 30 * scale; const boxW = 210 * scale; 
                        const boxH = hasTime ? (120 * scale) : (80 * scale);
                        const startY = pad + (24 * scale); const lineH = 32 * scale;
                        
                        exportCtx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                        exportCtx.beginPath(); exportCtx.roundRect(pad, pad, boxW, boxH, 16 * scale); exportCtx.fill();
                        exportCtx.lineWidth = 1.5 * scale; exportCtx.strokeStyle = 'rgba(255,255,255,0.2)'; exportCtx.stroke();

                        exportCtx.font = `600 ${10 * scale}px Inter, sans-serif`; exportCtx.fillStyle = '#94a3b8'; exportCtx.textAlign = 'left'; exportCtx.textBaseline = 'alphabetic';
                        exportCtx.fillText('DISTANCE', pad + (20 * scale), startY);
                        exportCtx.fillText('ALTITUDE', pad + (20 * scale), startY + lineH);
                        if (hasTime) exportCtx.fillText('SPEED', pad + (20 * scale), startY + (lineH * 2));

                        exportCtx.font = `700 ${16 * scale}px Inter, sans-serif`; exportCtx.fillStyle = '#ffffff';
                        exportCtx.fillText((renderConfig.currentDist || 0).toFixed(2) + ' km', pad + (95 * scale), startY + (1 * scale));
                        exportCtx.fillText((renderConfig.currentAlt || 0).toLocaleString() + ' m', pad + (95 * scale), startY + lineH + (1 * scale));
                        
                        if (hasTime) {
                            exportCtx.fillStyle = '#38bdf8';
                            exportCtx.fillText((renderConfig.currentSpeed || 0).toFixed(1) + ' km/h', pad + (95 * scale), startY + (lineH * 2) + (1 * scale));
                        }
                    }

                    if (renderConfig.showChart) {
                        const ch = 100 * scale;
                        const cy = exportCanvas.height - ch;
                        const grad = exportCtx.createLinearGradient(0, cy, 0, exportCanvas.height);
                        grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.9)');
                        exportCtx.fillStyle = grad; exportCtx.fillRect(0, cy, exportCanvas.width, ch);
                        exportCtx.drawImage(eleCanvas, 0, cy, exportCanvas.width, ch);
                        
                        exportCtx.font = `800 ${22 * scale}px Inter, sans-serif`;
                        exportCtx.fillStyle = '#fc4c02';
                        exportCtx.textAlign = 'left';
                        exportCtx.textBaseline = 'bottom';
                        exportCtx.shadowColor = 'rgba(0,0,0,0.8)';
                        exportCtx.shadowOffsetX = 2 * scale;
                        exportCtx.shadowOffsetY = 2 * scale;
                        exportCtx.shadowBlur = 4 * scale;
                        exportCtx.fillText((renderConfig.currentAlt || 0).toLocaleString() + ' m', 20 * scale, exportCanvas.height - 15 * scale);
                        exportCtx.shadowOffsetX = 0;
                        exportCtx.shadowOffsetY = 0;
                        exportCtx.shadowBlur = 0;
                    }

                    // Render Custom Text Popup
                    if (currentActiveText && now < currentActiveText.endTime) {
                        let alpha = 1;
                        const elapsedText = now - currentActiveText.startTime;
                        const timeLeftText = currentActiveText.endTime - now;
                        if (elapsedText < 500) alpha = elapsedText / 500;
                        if (timeLeftText < 500) alpha = timeLeftText / 500;
                        
                        exportCtx.globalAlpha = alpha;
                        
                        if (currentActiveText.style === '3d-pin' && currentActiveText.coord) {
                            const textStr = currentActiveText.text;
                            const p = map.project(currentActiveText.coord);
                            exportCtx.font = `600 ${16 * scale}px Inter, sans-serif`;
                            const tW = exportCtx.measureText(textStr).width;
                            const py = p.y - 70 * scale; // Increased offset to accommodate icon
                            
                            // 1. Draw Actual Icon as Base
                            const iconSize = 32 * scale;
                            exportCtx.drawImage(textIconImg, p.x - iconSize/2, p.y - iconSize*1.1, iconSize, iconSize*1.25);
                            
                            // 2. Draw Connection Stalk
                            exportCtx.beginPath(); exportCtx.moveTo(p.x, p.y - iconSize*0.9); exportCtx.lineTo(p.x, py + 20 * scale);
                            exportCtx.lineWidth = 1.5 * scale; exportCtx.strokeStyle = 'rgba(255,255,255,0.4)'; exportCtx.stroke();
                            
                            // 3. Draw Sync Card (Dark Glass)
                            const cardW = tW + 48 * scale; // 24px padding each side
                            const cardH = 50 * scale;     // Dedicated height
                            
                            exportCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                            exportCtx.shadowColor = 'rgba(0,0,0,0.6)'; exportCtx.shadowBlur = 15 * scale; exportCtx.shadowOffsetY = 5 * scale;
                            exportCtx.beginPath(); exportCtx.roundRect(p.x - cardW/2, py - cardH, cardW, cardH, 12 * scale); exportCtx.fill();
                            exportCtx.shadowBlur = 0; exportCtx.shadowOffsetY = 0;
                            
                            exportCtx.lineWidth = 1 * scale; exportCtx.strokeStyle = 'rgba(255,255,255,0.2)'; exportCtx.stroke();
                            
                            // 4. Draw Text with Shadow
                            exportCtx.fillStyle = '#ffffff'; exportCtx.textAlign = 'center'; exportCtx.textBaseline = 'middle';
                            exportCtx.shadowColor = 'rgba(0,0,0,0.8)'; exportCtx.shadowBlur = 4 * scale; exportCtx.shadowOffsetY = 2 * scale;
                            exportCtx.fillText(textStr, p.x, py - cardH/2);
                            exportCtx.shadowBlur = 0; exportCtx.shadowOffsetY = 0;
                        } else {
                            exportCtx.font = `800 ${36 * scale}px Inter, sans-serif`;
                            const textStr = currentActiveText.text.toUpperCase();
                            const textWidth = exportCtx.measureText(textStr).width;
                            const padX = 32 * scale;
                            const padY = 20 * scale;
                            const boxH = 40 * scale + padY * 2;
                            const boxW = textWidth + padX * 2;
                            const startX = exportCanvas.width / 2 - boxW / 2;
                            const startY = exportCanvas.height * 0.8 - boxH;

                            exportCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                            exportCtx.beginPath();
                            exportCtx.roundRect(startX, startY, boxW, boxH, 8 * scale);
                            exportCtx.fill();

                            exportCtx.fillStyle = '#ffffff';
                            exportCtx.beginPath();
                            exportCtx.roundRect(startX, startY, 6 * scale, boxH, 8 * scale);
                            exportCtx.fill();

                            exportCtx.fillStyle = '#ffffff';
                            exportCtx.textAlign = 'center';
                            exportCtx.textBaseline = 'middle';
                            exportCtx.shadowColor = 'rgba(0,0,0,0.8)';
                            exportCtx.shadowBlur = 10 * scale;
                            exportCtx.fillText(textStr, exportCanvas.width / 2, startY + boxH / 2 + 2*scale);
                        }

                        exportCtx.globalAlpha = 1.0;
                        exportCtx.shadowBlur = 0;
                    }

                    // Render Fullscreen or Corner Photo Popup in Video Export
                    if (currentActivePhoto && currentActivePhoto.img.complete && currentActivePhoto.img.naturalWidth > 0) {
                        if (now < currentActivePhoto.endTime) {
                            let alpha = 1;
                            const elapsedPhoto = now - currentActivePhoto.startTime;
                            const timeLeftPhoto = currentActivePhoto.endTime - now;
                            if (elapsedPhoto < 500) alpha = elapsedPhoto / 500;
                            if (timeLeftPhoto < 500) alpha = timeLeftPhoto / 500;
                            
                            exportCtx.globalAlpha = alpha;
                            
                            const isFullScreen = currentActivePhoto.style === 'fullscreen';
                            
                            if (currentActivePhoto.style === '3d-pin' && currentActivePhoto.coord) {
                                const pt = map.project(currentActivePhoto.coord);
                                const iw = 180 * scale; // Match common browser card width
                                const ih = (currentActivePhoto.img.height / currentActivePhoto.img.width) * iw;
                                const py = pt.y - 65 * scale - ih;
                                
                                // 1. Draw Icon Base
                                const iconSize = 32 * scale;
                                exportCtx.drawImage(cameraIconImg, pt.x - iconSize/2, pt.y - iconSize*1.1, iconSize, iconSize*1.25);
                                
                                // 2. Connection Stalk
                                exportCtx.beginPath(); exportCtx.moveTo(pt.x, pt.y - iconSize*0.9); exportCtx.lineTo(pt.x, py + ih + 10 * scale);
                                exportCtx.lineWidth = 1.5 * scale; exportCtx.strokeStyle = 'rgba(255,255,255,0.6)'; exportCtx.stroke();
                                
                                // 3. Photo Card (Solid white shadow box)
                                exportCtx.fillStyle = '#ffffff';
                                exportCtx.shadowColor = 'rgba(0,0,0,0.6)'; exportCtx.shadowBlur = 18 * scale; exportCtx.shadowOffsetY = 8 * scale;
                                
                                const framePad = 4 * scale;
                                exportCtx.beginPath(); exportCtx.roundRect(pt.x - iw/2 - framePad, py - framePad, iw + framePad*2, ih + framePad*2, 12 * scale); exportCtx.fill();
                                exportCtx.shadowBlur = 0; exportCtx.shadowOffsetY = 0;
                                
                                // 4. Draw Image (Filling the card)
                                exportCtx.save();
                                exportCtx.beginPath(); exportCtx.roundRect(pt.x - iw/2 - framePad, py - framePad, iw + framePad*2, ih + framePad*2, 12 * scale); exportCtx.clip();
                                exportCtx.drawImage(currentActivePhoto.img, pt.x - iw/2, py, iw, ih);
                                exportCtx.restore();
                            } else if (isFullScreen) {
                                exportCtx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`;
                                exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                                
                                const maxW = exportCanvas.width * 0.85;
                                const maxH = exportCanvas.height * 0.85;
                                let iw = currentActivePhoto.img.width;
                                let ih = currentActivePhoto.img.height;
                                const ratio = Math.min(maxW / iw, maxH / ih);
                                iw *= ratio; ih *= ratio;
                                
                                const x = (exportCanvas.width - iw) / 2;
                                const y = (exportCanvas.height - ih) / 2;
                                
                                exportCtx.beginPath();
                                exportCtx.roundRect(x - 8*scale, y - 8*scale, iw + 16*scale, ih + 16*scale, 16*scale);
                                exportCtx.lineWidth = 4 * scale;
                                exportCtx.strokeStyle = 'rgba(255,255,255,0.8)';
                                exportCtx.stroke();
                                
                                exportCtx.drawImage(currentActivePhoto.img, x, y, iw, ih);
                            } else {
                                const sizeMult = parseFloat(currentActivePhoto.style || 1.0);
                                const maxW = 400 * scale * sizeMult;
                                const maxH = 300 * scale * sizeMult;
                                let iw = currentActivePhoto.img.width;
                                let ih = currentActivePhoto.img.height;
                                const ratio = Math.min(maxW / iw, maxH / ih);
                                iw *= ratio; ih *= ratio;
                                
                                const pad = 40 * scale;
                                const x = exportCanvas.width - iw - pad;
                                const y = pad + 40 * scale; 
                                
                                exportCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                                exportCtx.beginPath();
                                exportCtx.roundRect(x - 12*scale, y - 12*scale, iw + 24*scale, ih + 24*scale, 16*scale);
                                exportCtx.fill();
                                exportCtx.lineWidth = 3 * scale;
                                exportCtx.strokeStyle = 'rgba(255,255,255,0.8)';
                                exportCtx.stroke();
                                
                                exportCtx.drawImage(currentActivePhoto.img, x, y, iw, ih);
                            }
                            
                            exportCtx.globalAlpha = 1.0;
                        }
                    }
                }
                else if (exportPhase === 'outro') {
                    
                    exportCtx.drawImage(mapCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
                    
                    const fadeProgress = Math.min(0.6, (now - phaseStartTime) / 2000); 
                    exportCtx.fillStyle = `rgba(10, 15, 30, ${fadeProgress})`;
                    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

                    const outroText = renderConfig.outroText || "";

                    const textOpacity = Math.max(0, Math.min(1, (now - phaseStartTime - 500) / 1000));
                    exportCtx.globalAlpha = textOpacity;
                    
                    exportCtx.textAlign = 'center';
                    exportCtx.textBaseline = 'middle';

                    let textY = exportCanvas.height/2 - 40*scale;

                    if (outroText) {
                        exportCtx.font = `800 ${56 * scale}px Inter, sans-serif`;
                        
                        // Glow & Shadow
                        exportCtx.shadowColor = 'rgba(252, 76, 2, 0.6)';
                        exportCtx.shadowBlur = 40 * scale;
                        exportCtx.shadowOffsetY = 8 * scale;
                        exportCtx.fillStyle = '#0f172a';
                        exportCtx.fillText(outroText.toUpperCase(), exportCanvas.width/2, textY + 6 * scale);
                        
                        // 3D Extrusion
                        exportCtx.shadowColor = 'transparent';
                        exportCtx.shadowBlur = 0;
                        exportCtx.shadowOffsetY = 0;
                        exportCtx.fillStyle = '#475569';
                        for(let i = 6; i >= 1; i--) {
                            exportCtx.fillText(outroText.toUpperCase(), exportCanvas.width/2, textY + i * scale);
                        }
                        
                        // Bright Face
                        exportCtx.fillStyle = '#ffffff';
                        exportCtx.fillText(outroText.toUpperCase(), exportCanvas.width/2, textY);
                    }
                    
                    // Reset shadows for lines and stats
                    exportCtx.shadowColor = 'rgba(0,0,0,0.8)';
                    exportCtx.shadowBlur = 15 * scale;
                    exportCtx.shadowOffsetY = 4 * scale;
                    
                    exportCtx.fillStyle = '#fc4c02';
                    exportCtx.fillRect(exportCanvas.width/2 - 40*scale, textY + 50*scale, 80*scale, 4*scale);
                    
                    exportCtx.font = `600 ${22 * scale}px Inter, sans-serif`;
                    
                    exportCtx.fillStyle = '#e2e8f0';
                    exportCtx.fillText(`TOTAL DISTANCE`, exportCanvas.width/2, textY + 100*scale);
                    exportCtx.fillStyle = '#38bdf8';
                    exportCtx.fillText(`${routeData.distance.toFixed(1)} KM`, exportCanvas.width/2, textY + 130*scale);
                    
                    exportCtx.fillStyle = '#e2e8f0';
                    exportCtx.fillText(`TOTAL ELEVATION`, exportCanvas.width/2, textY + 180*scale);
                    exportCtx.fillStyle = '#4ade80';
                    exportCtx.fillText(`${Math.round(routeData.elevation)} M`, exportCanvas.width/2, textY + 210*scale);
                    
                    exportCtx.globalAlpha = 1.0;
                    exportCtx.shadowColor = 'transparent';
                    exportCtx.shadowBlur = 0;
                    exportCtx.shadowOffsetY = 0;

                    if (now - phaseStartTime > 5000) {
                        stopRecording();
                    }
                }
                // Watermark removed
            }
            
            recordingFrameId = requestAnimationFrame(renderExportFrame);
        }

        let pendingExportMode = null;

        function startRecording(mode) {
            if (!routeData) return;
            pendingExportMode = mode;
            const mapContainer = document.getElementById('map-container');
            document.getElementById('backdrop').style.display = 'block'; 
            
            mapContainer.classList.add('recording-' + mode);
            uiPanel.classList.add('export-mode');
            document.body.classList.add('exporting');
            
            document.getElementById('loading').style.display = 'flex';
            document.getElementById('loading-text').innerText = "CACHING HIGH-RES TERRAIN...";
            document.getElementById('loading-bar-container').style.display = 'block';
            document.getElementById('loading-bar').style.width = '0%';
            
            setTimeout(() => {
                map.resize(); 
                
                exportCanvas.width = mode === 'horizontal' ? 1920 : 1080;
                exportCanvas.height = mode === 'horizontal' ? 1080 : 1920;
                exportCanvas.style.display = 'block';

                isPlaying = false; 
                isPreloading = true;
                currentDist = 0;
                activeCameraCenter = null;
                phaseStartTime = performance.now();
            }, 100); 
        }

        function beginExportRecording() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('loading-bar-container').style.display = 'none';
            
            document.getElementById('export-progress-bar').style.width = '0%';
            document.getElementById('export-progress-text').innerText = '0%';
            document.getElementById('recording-indicator').style.display = 'flex';

            setTimeout(() => {
                const stream = exportCanvas.captureStream(30); 
                try { mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 12000000 }); } 
                catch (e) { mediaRecorder = new MediaRecorder(stream); }

                recordedChunks = [];
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    const blob = new Blob(recordedChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none'; a.href = url; a.download = `3d-trek-${pendingExportMode}.webm`;
                    document.body.appendChild(a); a.click();
                    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
                };

                mediaRecorder.start(); 
                isRecording = true;
                
                currentDist = 0; timeline.value = 0; 
                photoMarkersArray.forEach(p => p.shown = false);
                textMarkersArray.forEach(t => t.shown = false);
                activeCameraCenter = null;
                
                // Initialize Deterministic Clock
                renderConfig.exportClock = 100000; // Arbitrary high base to avoid 0 issues
                phaseStartTime = renderConfig.exportClock;
                
                updateRender(); drawElevationChart(routeData);

                enableOutroConfig = renderConfig.enableOutro;
                if (renderConfig.enableIntro) {
                    exportPhase = 'intro';
                } else {
                    exportPhase = 'playback';
                    togglePlay(); 
                }

                renderExportFrame();

            }, 500); 
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            isRecording = false; isPlaying = false; isPreloading = false;
            if (recordingFrameId) cancelAnimationFrame(recordingFrameId);

            document.getElementById('icon-play').style.display = 'block';
            document.getElementById('icon-pause').style.display = 'none';

            const mapContainer = document.getElementById('map-container');
            mapContainer.classList.remove('recording-horizontal', 'recording-vertical');
            document.getElementById('backdrop').style.display = 'none';
            document.getElementById('recording-indicator').style.display = 'none';
            uiPanel.classList.remove('export-mode');
            document.body.classList.remove('exporting');
            exportCanvas.style.display = 'none';
            setTimeout(() => { map.resize(); drawElevationChart(routeData); }, 100);
        }

        document.getElementById('btn-export-h').addEventListener('click', () => {
            if (!routeData) return;
            pendingExportMode = 'horizontal';
            document.getElementById('export-modal-backdrop').style.display = 'flex';
        });
        
        document.getElementById('btn-export-v').addEventListener('click', () => {
            if (!routeData) return;
            pendingExportMode = 'vertical';
            document.getElementById('export-modal-backdrop').style.display = 'flex';
        });

        document.getElementById('btn-modal-cancel').addEventListener('click', () => {
            document.getElementById('export-modal-backdrop').style.display = 'none';
        });

        document.getElementById('btn-modal-start').addEventListener('click', () => {
            document.getElementById('export-modal-backdrop').style.display = 'none';
            startRecording(pendingExportMode);
        });

        document.getElementById('btn-stop-rec').addEventListener('click', stopRecording);

        // --- Welcome Panel Expansion Logic ---
        document.getElementById('btn-wp-expand').addEventListener('click', () => {
            const wp = document.getElementById('welcome-panel');
            const extended = document.getElementById('wp-extended-content');
            const quickInfo = document.getElementById('wp-quick-info');
            const text = document.getElementById('wp-expand-text');
            const icon = document.querySelector('#btn-wp-expand svg');
            
            if (wp.classList.contains('expanded')) {
                wp.classList.remove('expanded');
                extended.style.display = 'none';
                quickInfo.style.display = 'flex';
                text.innerText = 'Read Full Guide';
                icon.style.transform = 'rotate(0deg)';
            } else {
                wp.classList.add('expanded');
                extended.style.display = 'flex';
                quickInfo.style.display = 'none';
                text.innerText = 'Show Less';
                icon.style.transform = 'rotate(180deg)';
            }
        });

