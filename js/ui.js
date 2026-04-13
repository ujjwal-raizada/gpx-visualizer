        // --- Accordion Logic ---
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                item.classList.toggle('active');
            });
        });

        // --- Keyboard Shortcuts ---
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
            if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
            if (e.code === 'ArrowRight' && routeData) {
                timeline.value = Math.min(100, parseFloat(timeline.value) + 2);
                activeCameraCenter = null;
                photoMarkersArray.forEach(p => p.shown = false);
                textMarkersArray.forEach(t => t.shown = false);
                timeline.dispatchEvent(new Event('input'));
            }
            if (e.code === 'ArrowLeft' && routeData) {
                timeline.value = Math.max(0, parseFloat(timeline.value) - 2);
                activeCameraCenter = null;
                photoMarkersArray.forEach(p => p.shown = false);
                textMarkersArray.forEach(t => t.shown = false);
                timeline.dispatchEvent(new Event('input'));
            }
            if (e.code === 'KeyF') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
                else document.exitFullscreen().catch(()=>{});
            }
        });

        // --- Configuration Modal Input Disablers ---
        // Performance: Initialize config from DOM
        renderConfig.enableIntro = document.getElementById('chk-modal-intro').checked;
        renderConfig.enableOutro = document.getElementById('chk-modal-outro').checked;
        renderConfig.introText = document.getElementById('modal-intro-text').value;
        renderConfig.outroText = document.getElementById('modal-outro-text').value;
        renderConfig.showStats = document.getElementById('chk-modal-stats').checked;
        renderConfig.showChart = document.getElementById('chk-modal-chart').checked;
        renderConfig.cameraMode = document.getElementById('sel-camera').value;
        renderConfig.showPhotos = document.getElementById('chk-show-photos').checked;
        renderConfig.imageDurationMs = parseFloat(document.getElementById('num-photo-time').value) * 1000;
        renderConfig.textDurationMs = parseFloat(document.getElementById('num-text-time').value) * 1000;
        renderConfig.useDayNight = document.getElementById('chk-daynight').checked;
        renderConfig.routeColor = document.getElementById('route-color').value;
        renderConfig.isSteepnessMode = document.getElementById('chk-steepness').checked;
        renderConfig.targetFPS = parseInt(document.getElementById('sel-fps').value);

        document.getElementById('chk-modal-intro').addEventListener('change', (e) => {
            renderConfig.enableIntro = e.target.checked;
            document.getElementById('modal-intro-text').disabled = !e.target.checked;
        });
        document.getElementById('chk-modal-outro').addEventListener('change', (e) => {
            renderConfig.enableOutro = e.target.checked;
            document.getElementById('modal-outro-text').disabled = !e.target.checked;
        });
        document.getElementById('modal-intro-text').addEventListener('input', (e) => {
            renderConfig.introText = e.target.value;
        });
        document.getElementById('modal-outro-text').addEventListener('input', (e) => {
            renderConfig.outroText = e.target.value;
        });
        document.getElementById('chk-modal-stats').addEventListener('change', (e) => {
            renderConfig.showStats = e.target.checked;
        });
        document.getElementById('chk-modal-chart').addEventListener('change', (e) => {
            renderConfig.showChart = e.target.checked;
        });

        document.getElementById('sel-fps').addEventListener('change', (e) => {
            renderConfig.targetFPS = parseInt(e.target.value);
            document.getElementById('modal-sel-fps').value = e.target.value;
        });

        document.getElementById('modal-sel-fps').addEventListener('change', (e) => {
            renderConfig.targetFPS = parseInt(e.target.value);
            document.getElementById('sel-fps').value = e.target.value;
        });

        document.getElementById('sel-camera').addEventListener('change', (e) => {
            if (e.target.value !== 'free') lastCameraMode = e.target.value;
        });

        // --- Tab Visibility Manager (Fixes Jumps and Freezes during background) ---
        document.addEventListener('visibilitychange', () => {
            const pauseOverlay = document.getElementById('pause-overlay');
            if (document.hidden) {
                hiddenStartTime = performance.now();
                pauseOverlay.style.display = 'flex';
                if (isPlaying) {
                    wasPlayingBeforeHidden = true;
                    isPlaying = false;
                    document.getElementById('icon-play').style.display = 'block';
                    document.getElementById('icon-pause').style.display = 'none';
                }
            } else {
                const hiddenDuration = performance.now() - hiddenStartTime;
                
                // Keep export timers perfectly in sync so fades don't jump
                if (isRecording && phaseStartTime > 0) {
                    phaseStartTime += hiddenDuration;
                }
                
                if (currentActivePhoto) {
                    currentActivePhoto.startTime += hiddenDuration;
                    currentActivePhoto.endTime += hiddenDuration;
                }
                if (currentActiveText) {
                    currentActiveText.startTime += hiddenDuration;
                    currentActiveText.endTime += hiddenDuration;
                }

                lastTime = performance.now(); // Essential to prevent 'dt' from spiking and breaking tracking
                pauseOverlay.style.display = 'none';
                
                if (wasPlayingBeforeHidden) {
                    wasPlayingBeforeHidden = false;
                    isPlaying = true;
                    document.getElementById('icon-play').style.display = 'none';
                    document.getElementById('icon-pause').style.display = 'block';
                }
            }
        });

        // --- UI Interactions ---
        const uiPanel = document.getElementById('ui-panel');
        const eleContainer = document.getElementById('elevation-container');
        const minimapCanvas = document.getElementById('minimap-canvas');
        
        document.getElementById('btn-toggle-ui').addEventListener('click', () => {
            const isCollapsing = !uiPanel.classList.contains('collapsed');
            uiPanel.classList.toggle('collapsed');
            
            // On desktop, keep elements in sync with the menu toggle. On mobile, leave the chart alone!
            if (window.innerWidth > 600) {
                eleContainer.classList.toggle('collapsed', isCollapsing);
                minimapCanvas.classList.toggle('chart-collapsed', isCollapsing);
                document.querySelector('.maplibregl-ctrl-bottom-right').classList.toggle('chart-collapsed', isCollapsing);
            }
        });

        document.getElementById('sel-mapstyle').addEventListener('change', (e) => {
            const styles = ['satellite', 'topo', 'dark'];
            styles.forEach(s => {
                map.setLayoutProperty(`${s}-layer`, 'visibility', s === e.target.value ? 'visible' : 'none');
            });
        });

        document.getElementById('route-color').addEventListener('input', (e) => {
            if (document.getElementById('chk-steepness').checked) return; 
            updateRouteColorDisplay(e.target.value);
        });

        document.getElementById('chk-steepness').addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.getElementById('steepness-legend').style.display = checked ? 'block' : 'none';
            document.getElementById('steepness-labels').style.display = checked ? 'flex' : 'none';
            updateRouteColorDisplay(checked ? ['get', 'color'] : document.getElementById('route-color').value);
        });

        function updateRouteColorDisplay(colorOrExpression) {
            if (map.getLayer('route-line-glow')) map.setPaintProperty('route-line-glow', 'line-color', colorOrExpression);
            if (map.getLayer('route-head-glow')) map.setPaintProperty('route-head-glow', 'circle-color', colorOrExpression);
            if (map.getLayer('route-head-core')) map.setPaintProperty('route-head-core', 'circle-stroke-color', colorOrExpression);
            if (routeData) drawElevationChart(routeData); 
        }

        // --- Photo Geo-Tagging Logic ---
        let photoMarkersArray = [];
        let textMarkersArray = [];
        
        function updatePhotoListUI() {
            const container = document.getElementById('photo-list');
            container.innerHTML = '';
            photoMarkersArray.forEach((p, index) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:6px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);';
                
                const thumb = document.createElement('img');
                thumb.src = p.url;
                thumb.style.cssText = 'width:32px; height:32px; object-fit:cover; border-radius:4px;';
                
                const label = document.createElement('span');
                label.style.cssText = 'font-size:11px; color:#cbd5e1; flex-grow:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                label.innerText = p.name || `Photo ${index + 1}`;
                
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                delBtn.style.cssText = 'background:none; border:none; color:#ef4444; cursor:pointer; padding:4px; display:flex;';
                delBtn.onclick = () => {
                    p.marker.remove();
                    photoMarkersArray.splice(index, 1);
                    updatePhotoListUI();
                    if (routeData) drawElevationChart(routeData);
                };
                
                item.appendChild(thumb);
                item.appendChild(label);
                item.appendChild(delBtn);
                container.appendChild(item);
            });
        }

        function updateTextListUI() {
            const container = document.getElementById('text-list');
            if (!container) return;
            container.innerHTML = '';
            
            textMarkersArray.forEach((t, index) => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.05); padding:6px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);';
                
                const thumb = document.createElement('div');
                thumb.innerHTML = textIconSvg;
                thumb.style.cssText = 'width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:none; border-radius:4px; transform: scale(0.8);';
                
                const label = document.createElement('span');
                label.style.cssText = 'font-size:11px; color:#cbd5e1; flex-grow:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                label.textContent = t.text;
                
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                delBtn.style.cssText = 'background:none; border:none; color:#ef4444; cursor:pointer; padding:4px; display:flex;';
                delBtn.onclick = () => {
                    t.marker.remove();
                    textMarkersArray.splice(index, 1);
                    updateTextListUI();
                    if (routeData) drawElevationChart(routeData);
                };
                
                item.appendChild(thumb);
                item.appendChild(label);
                item.appendChild(delBtn);
                container.appendChild(item);
            });
        }

        document.getElementById('btn-upload-photos').addEventListener('click', () => {
            document.getElementById('photo-upload-modal').style.display = 'flex';
        });
        
        document.getElementById('btn-cancel-upload').addEventListener('click', () => {
            document.getElementById('photo-upload-modal').style.display = 'none';
        });
        
        document.getElementById('btn-confirm-upload').addEventListener('click', () => {
            document.getElementById('photo-upload-modal').style.display = 'none';
            document.getElementById('photo-input').click();
        });

        document.getElementById('photo-input').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            // Instantly clear the input value so the same file can be re-uploaded immediately
            e.target.value = '';
            
            if (!routeData) {
                showToast("Please load a GPX route first before adding photos.");
                return;
            }
            
            document.getElementById('loading').style.display = 'flex';
            document.getElementById('loading-text').innerText = "EXTRACTING GPS DATA...";
            
            for (let file of files) {
                try {
                    const exifData = await exifr.parse(file);
                    const url = URL.createObjectURL(file);
                    
                    if (exifData && exifData.latitude && exifData.longitude) {
                        const el = document.createElement('div');
                        el.className = 'camera-map-marker';
                        el.innerHTML = `${cameraIconSvg}<div class="pin-3d-card" style="position:absolute; bottom:15px;"><img src="${url}"></div>`;
                        
                        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([exifData.longitude, exifData.latitude]).addTo(map);
                        
                        let dist = undefined;
                        let minDist = Infinity;
                        let closestDist = 0;
                        routeData.points.forEach(pt => {
                            const d = haversine(pt.coord[1], pt.coord[0], exifData.latitude, exifData.longitude);
                            if (d < minDist) { minDist = d; closestDist = pt.dist; }
                        });
                        dist = closestDist;

                        photoMarkersArray.push({ name: file.name, marker, coord: [exifData.longitude, exifData.latitude], url, el, shown: false, dist: dist });
                        showToast(`Geo-tagged photo added!`);
                    } else {
                        // Triggers manual non-geotagged photo placement
                        pendingManualPhoto = { name: file.name, url };
                        showToast("Photo lacks GPS. Tap on the elevation chart below to place it!", 6000);
                        eleCanvas.classList.add('placing-photo');
                        break; 
                    }
                } catch (err) { 
                    console.error("Could not parse EXIF", err);
                    pendingManualPhoto = { name: file.name, url: URL.createObjectURL(file) };
                    showToast("Photo lacks GPS. Tap on the elevation chart below to place it!", 6000);
                    eleCanvas.classList.add('placing-photo');
                    break;
                }
            }
            document.getElementById('loading').style.display = 'none';
            updatePhotoListUI();
            if (routeData) drawElevationChart(routeData);
        });

        document.getElementById('chk-show-photos').addEventListener('change', (e) => {
            renderConfig.showPhotos = e.target.checked;
            photoMarkersArray.forEach(p => p.el.style.display = e.target.checked ? 'flex' : 'none');
            textMarkersArray.forEach(t => t.el.style.display = e.target.checked ? 'flex' : 'none');
        });

        document.getElementById('num-photo-time').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            renderConfig.imageDurationMs = val * 1000;
            document.getElementById('photo-time-val').textContent = val.toFixed(1) + 's';
        });

        document.getElementById('num-text-time').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            renderConfig.textDurationMs = val * 1000;
            document.getElementById('text-time-val').textContent = val.toFixed(1) + 's';
        });

        document.getElementById('route-color').addEventListener('input', (e) => {
            renderConfig.routeColor = e.target.value;
            if (map.getLayer('route-line-glow')) map.setPaintProperty('route-line-glow', 'line-color', e.target.value);
            if (routeData) drawElevationChart(routeData);
        });

        document.getElementById('chk-steepness').addEventListener('change', (e) => {
            renderConfig.isSteepnessMode = e.target.checked;
            if (routeData) drawElevationChart(routeData);
        });

        document.getElementById('chk-daynight').addEventListener('change', (e) => {
            renderConfig.useDayNight = e.target.checked;
        });

        document.getElementById('sel-camera').addEventListener('change', (e) => {
            renderConfig.cameraMode = e.target.value;
            if (e.target.value !== 'free') lastCameraMode = e.target.value;
        });

        document.getElementById('sel-photo-style').addEventListener('change', (e) => {
            const sizeVal = e.target.value;
            renderConfig.photoStyle = sizeVal; // Added to config
            const overlay = document.getElementById('photo-popup-overlay');
            const img = document.getElementById('photo-popup-img');
            
            if (sizeVal === 'fullscreen') {
                overlay.classList.add('fullscreen');
                img.style.maxWidth = ''; 
                img.style.maxHeight = '';
            } else {
                overlay.classList.remove('fullscreen');
                const sizeMult = parseFloat(sizeVal);
                img.style.maxWidth = (320 * sizeMult) + 'px';
                img.style.maxHeight = (240 * sizeMult) + 'px';
            }
        });

        // --- Text Marker Placement Handlers ---
        document.getElementById('btn-chart-add-text').addEventListener('click', () => {
            document.getElementById('btn-chart-add-text').style.display = 'none';
            document.getElementById('text-modal-backdrop').style.display = 'flex';
        });

        document.getElementById('btn-text-cancel').addEventListener('click', () => {
            document.getElementById('text-modal-backdrop').style.display = 'none';
        });

        document.getElementById('btn-text-save').addEventListener('click', () => {
            const text = document.getElementById('modal-text-input').value.trim();
            if (text && routeData) {
                let closestPt = routeData.points[0];
                let minDistDiff = Infinity;
                for(let i=0; i<routeData.points.length; i++) {
                    const diff = Math.abs(routeData.points[i].dist - pendingTextDist);
                    if (diff < minDistDiff) { minDistDiff = diff; closestPt = routeData.points[i]; }
                }
                const lon = closestPt.coord[0];
                const lat = closestPt.coord[1];

                const style = document.getElementById('modal-text-style').value;
                const el = document.createElement('div');
                el.className = 'camera-map-marker';
                
                if (style === '3d-pin') {
                    el.innerHTML = `${textIconSvg}<div class="pin-3d-card text-pin" style="position:absolute; bottom:15px; white-space:nowrap;"><h3>${text}</h3></div>`;
                } else {
                    el.innerHTML = textIconSvg;
                }
                
                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(map);
                textMarkersArray.push({ text: text, dist: closestPt.dist, marker: marker, el: el, shown: false, style: style });
                
                updateTextListUI();
                drawElevationChart(routeData);
                document.getElementById('modal-text-input').value = '';
                showToast("Text marker placed!");
            }
            document.getElementById('text-modal-backdrop').style.display = 'none';
        });


