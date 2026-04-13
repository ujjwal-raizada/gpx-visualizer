        // --- 4. Interactive Elevation Chart & Minimap ---
        const eleCanvas = document.getElementById('ele-canvas');
        const tooltip = document.getElementById('chart-tooltip');
        function drawPathOnCanvas(ctx, w, h, padding, progressDist, lineWeight = 3) {
            if (!routeData || !routeData.points.length) return;
            const b = routeData.bounds;
            const minLng = b.getWest(), maxLng = b.getEast();
            const minLat = b.getSouth(), maxLat = b.getNorth();
            
            const mapW = w - padding * 2;
            const mapH = h - padding * 2;
            
            const lngDiff = maxLng - minLng;
            const latDiff = maxLat - minLat;
            const scale = Math.min(mapW / lngDiff, mapH / latDiff);
            
            const offsetX = padding + (mapW - lngDiff * scale) / 2;
            const offsetY = padding + (mapH - latDiff * scale) / 2;
            
            const routeColor = renderConfig.routeColor;
            const pointsToDraw = routeData.canvasPoints || routeData.points;

            // Faint total path
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = lineWeight;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            pointsToDraw.forEach((p, i) => {
                const x = offsetX + (p.coord[0] - minLng) * scale;
                const y = offsetY + mapH - (p.coord[1] - minLat) * scale;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Bright active progress path
            if (progressDist > 0) {
                ctx.beginPath();
                ctx.lineWidth = lineWeight + 1;
                ctx.strokeStyle = routeColor;
                ctx.shadowColor = routeColor;
                ctx.shadowBlur = 12;
                
                let lastXY = null;
                for (let i = 0; i < pointsToDraw.length; i++) {
                    const p = pointsToDraw[i];
                    const x = offsetX + (p.coord[0] - minLng) * scale;
                    const y = offsetY + mapH - (p.coord[1] - minLat) * scale;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    
                    lastXY = [x, y];
                    if (p.dist > progressDist) break;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
                
                if (lastXY) {
                    ctx.beginPath();
                    ctx.arc(lastXY[0], lastXY[1], lineWeight * 1.5, 0, Math.PI*2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
            }
        }

        let bgCacheCanvas = document.createElement('canvas');
        let lastCacheKey = "";

        function drawElevationChart(data) {
            const ctx = eleCanvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            eleCanvas.width = eleCanvas.clientWidth * dpr;
            eleCanvas.height = eleCanvas.clientHeight * dpr;
            ctx.scale(dpr, dpr);

            const width = eleCanvas.clientWidth;
            const height = eleCanvas.clientHeight;
            const eleRange = Math.max(1, data.maxEle - data.minEle);
            const isSteepness = document.getElementById('chk-steepness').checked;
            const routeColor = document.getElementById('route-color').value;
            const showPhotos = document.getElementById('chk-show-photos').checked;

            const cacheKey = `${width}x${height}_${isSteepness}_${routeColor}_${showPhotos}_${data.distance}_${photoMarkersArray.length}_${textMarkersArray.length}_${isRecording}`;

            if (lastCacheKey !== cacheKey) {
                lastCacheKey = cacheKey;
                bgCacheCanvas.width = width * dpr;
                bgCacheCanvas.height = height * dpr;
                const bCtx = bgCacheCanvas.getContext('2d');
                bCtx.scale(dpr, dpr);
                bCtx.clearRect(0, 0, width, height);

                bCtx.beginPath();
                bCtx.moveTo(0, height);
                data.points.forEach(p => {
                    const x = (p.dist / data.distance) * width;
                    const y = height - ((p.ele - data.minEle) / eleRange) * (height - 20) - 10;
                    bCtx.lineTo(x, y);
                });
                bCtx.lineTo(width, height);
                bCtx.closePath();

                const grad = bCtx.createLinearGradient(0, 0, 0, height);
                const hex = routeColor.replace('#', '');
                const r = parseInt(hex.length == 3 ? hex.slice(0, 1).repeat(2) : hex.slice(0, 2), 16);
                const g = parseInt(hex.length == 3 ? hex.slice(1, 2).repeat(2) : hex.slice(2, 4), 16);
                const b = parseInt(hex.length == 3 ? hex.slice(2, 3).repeat(2) : hex.slice(4, 6), 16);
                grad.addColorStop(0, isSteepness ? 'rgba(255,255,255,0.4)' : `rgba(${r},${g},${b},0.6)`);
                grad.addColorStop(1, `rgba(${r},${g},${b},0.0)`);
                bCtx.fillStyle = grad;
                bCtx.fill();
                
                // Draw Line
                data.segments.forEach(s => {
                    const p1 = data.points[findPointIndex(data.points, s.startDist || 0)]; // Use approximation if startDist not available, wait, s.coords?
                    // Wait, original relies on finding points by coord.
                    // Instead of altering how segments work:
                    const p1_orig = data.points.find(p => p.coord[0] === s.coords[0][0] && p.coord[1] === s.coords[0][1]);
                    const p2_orig = data.points.find(p => p.coord[0] === s.coords[1][0] && p.coord[1] === s.coords[1][1]);
                    if(p1_orig && p2_orig) {
                        bCtx.beginPath();
                        bCtx.moveTo((p1_orig.dist / data.distance) * width, height - ((p1_orig.ele - data.minEle) / eleRange) * (height - 20) - 10);
                        bCtx.lineTo((p2_orig.dist / data.distance) * width, height - ((p2_orig.ele - data.minEle) / eleRange) * (height - 20) - 10);
                        bCtx.lineWidth = 2;
                        bCtx.strokeStyle = isSteepness ? s.color : routeColor;
                        bCtx.stroke();
                    }
                });

                // Draw Photo Camera Icons on the elevation profile (Fixed Top Clipping and Aspect Ratio)
                if (showPhotos && !isRecording) {
                    photoMarkersArray.forEach(p => {
                        if (p.dist !== undefined && cameraIconImg.complete) {
                            const px = (p.dist / data.distance) * width;
                            let pEleY = height;
                            let idx = findPointIndex(data.points, p.dist);
                            if (data.points[idx]) pEleY = height - ((data.points[idx].ele - data.minEle) / eleRange) * (height - 20) - 10;
                            
                            const iconY = Math.max(24, pEleY - 24); 
                            
                            bCtx.beginPath();
                            bCtx.moveTo(px, iconY);
                            bCtx.lineTo(px, pEleY);
                            bCtx.lineWidth = 2;
                            bCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                            bCtx.stroke();

                            bCtx.beginPath();
                            bCtx.arc(px, iconY, 14, 0, Math.PI * 2);
                            bCtx.fillStyle = '#ffffff';
                            bCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            bCtx.shadowBlur = 8;
                            bCtx.shadowOffsetY = 2;
                            bCtx.fill();

                            bCtx.shadowColor = 'transparent';
                            bCtx.shadowBlur = 0;
                            bCtx.shadowOffsetY = 0;
                            bCtx.lineWidth = 2;
                            bCtx.strokeStyle = '#0f172a';
                            bCtx.stroke();
                            
                            // Vector Camera
                            bCtx.fillStyle = '#0f172a';
                            bCtx.beginPath(); bCtx.roundRect(px - 7, iconY - 4, 14, 10, 2); bCtx.fill();
                            bCtx.beginPath(); bCtx.arc(px, iconY + 1, 3, 0, Math.PI*2); bCtx.fillStyle = '#ffffff'; bCtx.fill();
                            bCtx.beginPath(); bCtx.roundRect(px - 3, iconY - 6, 6, 2, 1); bCtx.fillStyle = '#0f172a'; bCtx.fill();
                        }
                    });
                }

                if (!isRecording) {
                    // Draw Text Icons
                    textMarkersArray.forEach(t => {
                        if (t.dist !== undefined && textIconImg.complete) {
                            const px = (t.dist / data.distance) * width;
                            let pEleY = height;
                            let idx = findPointIndex(data.points, t.dist);
                            if (data.points[idx]) pEleY = height - ((data.points[idx].ele - data.minEle) / eleRange) * (height - 20) - 10;
                            
                            const iconY = Math.max(24, pEleY - 24); 
                            
                            bCtx.beginPath(); bCtx.moveTo(px, iconY); bCtx.lineTo(px, pEleY);
                            bCtx.lineWidth = 2; bCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; bCtx.stroke();

                            bCtx.beginPath(); bCtx.arc(px, iconY, 14, 0, Math.PI * 2);
                            bCtx.fillStyle = '#0f172a'; bCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            bCtx.shadowBlur = 8; bCtx.shadowOffsetY = 2; bCtx.fill();

                            bCtx.shadowColor = 'transparent'; bCtx.shadowBlur = 0; bCtx.shadowOffsetY = 0;
                            bCtx.lineWidth = 2; bCtx.strokeStyle = '#ffffff'; bCtx.stroke();
                            
                            // Vector Text lines
                            bCtx.fillStyle = '#ffffff';
                            bCtx.beginPath(); bCtx.roundRect(px - 6, iconY - 6, 12, 12, 2); bCtx.fill();
                            bCtx.beginPath(); bCtx.moveTo(px - 3, iconY - 2); bCtx.lineTo(px + 3, iconY - 2); 
                            bCtx.moveTo(px - 3, iconY + 2); bCtx.lineTo(px + 3, iconY + 2); 
                            bCtx.lineWidth = 2; bCtx.strokeStyle = '#0f172a'; bCtx.stroke();
                        }
                    });
                }
            }

            // Restore from Cache
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(bgCacheCanvas, 0, 0, bgCacheCanvas.width, bgCacheCanvas.height, 0, 0, width, height);

            // Draw Dynamic Playback Line
            if (data.distance > 0) {
                const currentX = (currentDist / data.distance) * width;
                ctx.beginPath(); ctx.moveTo(currentX, 0); ctx.lineTo(currentX, height);
                ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.stroke();

                let currentEleY = height;
                let activeColor = routeColor;
                
                let idx = findPointIndex(data.points, currentDist);
                if (data.points[idx]) {
                    currentEleY = height - ((data.points[idx].ele - data.minEle) / eleRange) * (height - 20) - 10;
                    if (isSteepness && idx > 0 && data.segments[idx-1]) activeColor = data.segments[idx-1].color || activeColor;
                }
                
                ctx.beginPath(); ctx.arc(currentX, currentEleY, 5, 0, Math.PI*2);
                ctx.fillStyle = "#fff"; ctx.fill();
                ctx.strokeStyle = activeColor; ctx.stroke();
            }
        }

        function renderMinimapUI() {
            if (!routeData || isRecording) return;
            const ctx = minimapCanvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            if (minimapCanvas.width !== minimapCanvas.clientWidth * dpr) {
                minimapCanvas.width = minimapCanvas.clientWidth * dpr;
                minimapCanvas.height = minimapCanvas.clientHeight * dpr;
            }
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, minimapCanvas.clientWidth, minimapCanvas.clientHeight);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fill();

            drawPathOnCanvas(ctx, minimapCanvas.clientWidth, minimapCanvas.clientHeight, 15, currentDist, 2);
            ctx.restore();
            
            minimapCanvas.style.display = 'block';
        }

        function placeManualPhoto(targetDist) {
            if (!pendingManualPhoto || !routeData) return;
            let closestPt = routeData.points[0];
            let minDistDiff = Infinity;
            for(let i=0; i<routeData.points.length; i++) {
                const diff = Math.abs(routeData.points[i].dist - targetDist);
                if (diff < minDistDiff) { minDistDiff = diff; closestPt = routeData.points[i]; }
            }
            const lon = closestPt.coord[0];
            const lat = closestPt.coord[1];
            const el = document.createElement('div');
            el.className = 'camera-map-marker';
            el.innerHTML = `${cameraIconSvg}<div class="pin-3d-card" style="position:absolute; bottom:15px;"><img src="${pendingManualPhoto.url}"></div>`;
            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(map);
            photoMarkersArray.push({ name: pendingManualPhoto.name, marker, coord: [lon, lat], url: pendingManualPhoto.url, el, shown: false, dist: closestPt.dist });
            updatePhotoListUI();
            drawElevationChart(routeData);
            pendingManualPhoto = null;
            document.getElementById('toast').style.display = 'none';
            showToast("Photo manually placed!", 3000);
            eleCanvas.classList.remove('placing-photo');
        }

        let addTextTimeout = null;
        function updateAddTextButton(clientX, rectTop, dist) {
            const btn = document.getElementById('btn-chart-add-text');
            btn.style.display = 'block';
            btn.style.left = Math.max(40, Math.min(clientX, window.innerWidth - 60)) + 'px';
            btn.style.top = (rectTop - 36) + 'px';
            pendingTextDist = dist;
            clearTimeout(addTextTimeout);
            addTextTimeout = setTimeout(() => { btn.style.display = 'none'; }, 3000);
        }

        function updateChartInteraction(clientX, rect) {
            if(!routeData || isRecording) return currentDist;
            const ratio = (clientX - rect.left) / rect.width;
            const targetDist = Math.max(0, Math.min(ratio * routeData.distance, routeData.distance));

            let closestPt = routeData.points[0];
            let grade = 0;
            for(let i=0; i<routeData.points.length; i++) {
                if (routeData.points[i].dist >= targetDist) {
                    closestPt = routeData.points[i];
                    if (i > 0 && routeData.segments[i-1]) {
                        const eleDiff = routeData.points[i].ele - routeData.points[i-1].ele;
                        const distDiff = routeData.points[i].dist - routeData.points[i-1].dist;
                        if(distDiff > 0) grade = (eleDiff / (distDiff * 1000)) * 100;
                    }
                    break;
                }
            }

            tooltip.style.display = 'block';
            tooltip.style.left = Math.max(10, Math.min(clientX, window.innerWidth - 150)) + 'px';
            tooltip.style.top = (rect.top - 10) + 'px';
            
            tooltip.innerHTML = `
                <div class="tt-row"><span class="tt-label">Distance</span><span class="tt-val">${closestPt.dist.toFixed(2)} km</span></div>
                <div class="tt-row"><span class="tt-label">Elevation</span><span class="tt-val">${Math.round(closestPt.ele)} m</span></div>
                <div class="tt-row"><span class="tt-label">Grade</span><span class="tt-val" style="color:${getGradeColor(grade)};">${grade > 0 ? '+' : ''}${grade.toFixed(1)}%</span></div>
            `;
            return targetDist;
        }

        // Unified Desktop & Mobile Scrubber Interaction
        eleCanvas.addEventListener('mousedown', (e) => {
            if(!routeData) return;
            const rect = eleCanvas.getBoundingClientRect();
            const targetDist = updateChartInteraction(e.clientX, rect);
            
            if (pendingManualPhoto) {
                placeManualPhoto(targetDist);
            } else {
                photoMarkersArray.forEach(p => p.shown = false); 
                textMarkersArray.forEach(t => t.shown = false); 
                currentDist = targetDist;
                activeCameraCenter = null;
                document.getElementById('timeline').value = (currentDist / routeData.distance) * 100;
                updateRender(); drawElevationChart(routeData);
                updateAddTextButton(e.clientX, rect.top, currentDist);
            }
        });

        eleCanvas.addEventListener('mousemove', (e) => {
            if(!routeData || isRecording) return;
            const rect = eleCanvas.getBoundingClientRect();
            if (e.buttons === 1 && !pendingManualPhoto) { 
                currentDist = updateChartInteraction(e.clientX, rect);
                activeCameraCenter = null;
                document.getElementById('btn-chart-add-text').style.display = 'none';
                document.getElementById('timeline').value = (currentDist / routeData.distance) * 100;
                updateRender(); drawElevationChart(routeData);
            } else { 
                updateChartInteraction(e.clientX, rect);
            }
        });
        
        eleCanvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

        // Native Mobile Swipe Support on Elevation Chart
        eleCanvas.addEventListener('touchstart', (e) => {
            if(!routeData || isRecording) return;
            e.preventDefault(); 
            const rect = eleCanvas.getBoundingClientRect();
            const targetDist = updateChartInteraction(e.touches[0].clientX, rect);
            
            if (pendingManualPhoto) {
                placeManualPhoto(targetDist);
            } else {
                photoMarkersArray.forEach(p => p.shown = false); 
                textMarkersArray.forEach(t => t.shown = false);
                currentDist = targetDist;
                activeCameraCenter = null;
                document.getElementById('timeline').value = (currentDist / routeData.distance) * 100;
                updateRender(); drawElevationChart(routeData);
                updateAddTextButton(e.touches[0].clientX, rect.top, currentDist);
            }
        }, {passive: false});

        eleCanvas.addEventListener('touchmove', (e) => {
            if(!routeData || isRecording || pendingManualPhoto) return;
            e.preventDefault();
            const rect = eleCanvas.getBoundingClientRect();
            currentDist = updateChartInteraction(e.touches[0].clientX, rect);
            activeCameraCenter = null;
            document.getElementById('btn-chart-add-text').style.display = 'none';
            document.getElementById('timeline').value = (currentDist / routeData.distance) * 100;
            updateRender(); drawElevationChart(routeData);
        }, {passive: false});

        eleCanvas.addEventListener('touchend', () => { tooltip.style.display = 'none'; });

