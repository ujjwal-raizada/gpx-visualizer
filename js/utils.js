        function haversine(lat1, lon1, lat2, lon2) {
            const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }

        function calculateBearing(startLat, startLng, destLat, destLng) {
            startLat = startLat * Math.PI / 180; startLng = startLng * Math.PI / 180;
            destLat = destLat * Math.PI / 180; destLng = destLng * Math.PI / 180;
            const y = Math.sin(destLng - startLng) * Math.cos(destLat);
            const x = Math.cos(startLat) * Math.sin(destLat) - Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
            return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
        }

        function formatTime(sec) {
            if (!sec || isNaN(sec) || sec === 0) return "--:--";
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
        }

        function getGradeColor(grade) {
            if (grade < -5) return '#38bdf8'; // Fast Downhill (Blue)
            if (grade < 5) return '#4ade80';  // Flat/Easy (Green)
            if (grade < 15) return '#facc15'; // Hard Climb (Yellow)
            return '#ef4444';                 // Brutal Climb (Red)
        }

        // Fast binary search to find target distance across a GPS track array
        function findPointIndex(points, targetDist, startIndex = 0) {
            let low = startIndex, high = points.length - 1;
            let best = startIndex;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                if (points[mid].dist >= targetDist) {
                    best = mid;
                    high = mid - 1;
                } else {
                    low = mid + 1;
                }
            }
            return best;
        }

