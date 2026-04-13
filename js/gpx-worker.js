        // --- 3. GPX Parser (Web Worker for Massive Files & Douglas-Peucker Decimation) ---
        function gpxWorkerCode() {
            self.onmessage = function(e) {
                const gpxString = e.data;
                const rawPoints = [];
                const waypoints = [];
                
                const ptRegex = /<(?:trkpt|rtept)[^>]*>([\s\S]*?)<\/(?:trkpt|rtept)>/gi;
                const tagRegex = /<(?:trkpt|rtept)([^>]+)>/i;
                const latRegex = /lat=["']([^"']+)["']/i;
                const lonRegex = /lon=["']([^"']+)["']/i;
                const eleRegex = /<ele>([^<]+)<\/ele>/i;
                const timeRegex = /<time>([^<]+)<\/time>/i;
                
                let match;
                let totalLen = gpxString.length;
                
                // 1. Raw Fast Parsing
                while ((match = ptRegex.exec(gpxString)) !== null) {
                    const tagMatch = tagRegex.exec(match[0]);
                    if (!tagMatch) continue;
                    
                    const latM = latRegex.exec(tagMatch[1]);
                    const lonM = lonRegex.exec(tagMatch[1]);
                    if (!latM || !lonM) continue;

                    const lat = parseFloat(latM[1]);
                    const lon = parseFloat(lonM[1]);
                    
                    const eleM = eleRegex.exec(match[1]);
                    const ele = eleM ? parseFloat(eleM[1]) : 0;
                    
                    const timeM = timeRegex.exec(match[1]);
                    const time = timeM ? new Date(timeM[1]).getTime() : null;

                    rawPoints.push({ coord: [lon, lat], ele: ele, time: time });
                    
                    if (rawPoints.length % 10000 === 0) {
                        self.postMessage({ type: 'progress', percent: (ptRegex.lastIndex / totalLen) * 40 }); 
                    }
                }

                if (rawPoints.length === 0) {
                    self.postMessage({ type: 'error', message: 'No valid track points found in GPX file.' });
                    return;
                }

                self.postMessage({ type: 'progress', percent: 50 });

                // 2. Data Simplification (Ramer-Douglas-Peucker + Radial Distance)
                function getSqDist(p1, p2) {
                    let dx = p1.coord[0] - p2.coord[0], dy = p1.coord[1] - p2.coord[1];
                    return dx * dx + dy * dy;
                }
                function getSqSegDist(p, p1, p2) {
                    let x = p1.coord[0], y = p1.coord[1];
                    let dx = p2.coord[0] - x, dy = p2.coord[1] - y;
                    if (dx !== 0 || dy !== 0) {
                        let t = ((p.coord[0] - x) * dx + (p.coord[1] - y) * dy) / (dx * dx + dy * dy);
                        if (t > 1) { x = p2.coord[0]; y = p2.coord[1]; }
                        else if (t > 0) { x += dx * t; y += dy * t; }
                    }
                    dx = p.coord[0] - x; dy = p.coord[1] - y;
                    return dx * dx + dy * dy;
                }

                function simplifyRadialDist(points, sqTolerance) {
                    let prevPoint = points[0];
                    let newPoints = [prevPoint];
                    let point;
                    for (let i = 1, len = points.length; i < len; i++) {
                        point = points[i];
                        if (getSqDist(point, prevPoint) > sqTolerance) {
                            newPoints.push(point);
                            prevPoint = point;
                        }
                    }
                    if (prevPoint !== point) newPoints.push(point);
                    return newPoints;
                }

                function simplifyDouglasPeucker(points, sqTolerance) {
                    let len = points.length;
                    let MarkerArray = new Uint8Array(len);
                    let first = 0, last = len - 1;
                    let stack = [];
                    let newPoints = [];
                    let i, maxSqDist, sqDist, index;

                    MarkerArray[first] = MarkerArray[last] = 1;

                    while (last !== undefined) {
                        maxSqDist = 0;
                        for (i = first + 1; i < last; i++) {
                            sqDist = getSqSegDist(points[i], points[first], points[last]);
                            if (sqDist > maxSqDist) {
                                index = i;
                                maxSqDist = sqDist;
                            }
                        }
                        if (maxSqDist > sqTolerance) {
                            MarkerArray[index] = 1;
                            stack.push(first, index, index, last);
                        }
                        last = stack.pop();
                        first = stack.pop();
                    }

                    for (i = 0; i < len; i++) {
                        if (MarkerArray[i]) newPoints.push(points[i]);
                    }
                    return newPoints;
                }

                self.postMessage({ type: 'progress', percent: 60 }); 
                
                // Decimate (~2.5m tolerance = ~0.000022 deg -> squared = ~5e-10)
                let sqTolerance = 5e-10; 
                let reducedPoints = simplifyRadialDist(rawPoints, sqTolerance);
                let simplifiedPoints = simplifyDouglasPeucker(reducedPoints, sqTolerance);
                
                self.postMessage({ type: 'progress', percent: 80 });

                // 3. Post-Processing Stats on Filtered Data
                function haversine(lat1, lon1, lat2, lon2) {
                    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                }
                function getGradeColor(grade) {
                    if (grade < -5) return '#38bdf8';
                    if (grade < 5) return '#4ade80';
                    if (grade < 15) return '#facc15';
                    return '#ef4444';
                }

                const points = [];
                const segments = [];
                let totalDistance = 0, elevationGain = 0;
                let minEle = Infinity, maxEle = -Infinity;
                let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
                let lastPoint = null;

                for (let i = 0; i < simplifiedPoints.length; i++) {
                    const p = simplifiedPoints[i];
                    const lat = p.coord[1];
                    const lon = p.coord[0];
                    const ele = p.ele;
                    
                    if (ele < minEle) minEle = ele;
                    if (ele > maxEle) maxEle = ele;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lon < minLon) minLon = lon;
                    if (lon > maxLon) maxLon = lon;

                    let distDelta = 0;
                    let grade = 0;
                    if (lastPoint) {
                        distDelta = haversine(lastPoint.coord[1], lastPoint.coord[0], lat, lon);
                        totalDistance += distDelta;
                        
                        // Anti-Jitter logic for calculating true elevation gain
                        if (ele > lastPoint.ele && (ele - lastPoint.ele) > 0.5) {
                            elevationGain += (ele - lastPoint.ele);
                        }
                        
                        if (distDelta > 0) {
                            grade = ((ele - lastPoint.ele) / (distDelta * 1000)) * 100;
                        }
                        
                        segments.push({
                            coords: [lastPoint.coord, [lon, lat]],
                            color: getGradeColor(grade)
                        });
                    }
                    
                    const pt = { coord: [lon, lat], ele: ele, dist: totalDistance, time: p.time };
                    points.push(pt);
                    lastPoint = pt;
                }

                self.postMessage({ type: 'progress', percent: 95 });

                const wptRegex = /<wpt([^>]+)>([\s\S]*?)<\/wpt>/gi;
                const nameRegex = /<name>([^<]+)<\/name>/i;
                while ((match = wptRegex.exec(gpxString)) !== null) {
                    const latM = latRegex.exec(match[1]);
                    const lonM = lonRegex.exec(match[1]);
                    if (!latM || !lonM) continue;
                    const nameM = nameRegex.exec(match[2]);
                    waypoints.push({
                        coord: [parseFloat(lonM[1]), parseFloat(latM[1])],
                        name: nameM ? nameM[1] : "Waypoint"
                    });
                }

                const startTime = points[0]?.time;
                const endTime = points[points.length-1]?.time;
                const totalTimeSec = (startTime && endTime) ? (endTime - startTime) / 1000 : 0;

                self.postMessage({ 
                    type: 'done', 
                    data: { 
                        points, segments, waypoints, 
                        boundsInfo: [[minLon, minLat], [maxLon, maxLat]], 
                        distance: totalDistance, elevation: elevationGain, 
                        minEle, maxEle, totalTimeSec 
                    } 
                });
            };
        }
        
        const workerBlob = new Blob([`(${gpxWorkerCode.toString()})()`], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);

