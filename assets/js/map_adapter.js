/*
 * assets/js/map_adapter.js
 * Manages adding alert markers to the map and updating the alerts feed.
 */
window.RTWQMS = window.RTWQMS || {};
window.RTWQMS.Map = (function() {
    "use strict";
    let mapInstance = null;
    const ALERTS_STORAGE_KEY = 'rtwqms_alerts';

    /**
     * Initializes the map adapter.
     * It will try to find the global map instance.
     */
    function init() {
        // Find the map instance, assuming it's globally available
        // as `regionalMap` or attached to the RTWQMS namespace.
        setTimeout(() => {
            if (window.regionalMap) {
                mapInstance = window.regionalMap;
            } else if (window.RTWQMS && window.RTWQMS.regionalMap) {
                mapInstance = window.RTWQMS.regionalMap;
            }

            if (mapInstance) {
                console.log("Map adapter initialized successfully.");
                renderStoredAlerts();
            } else {
                console.warn("Map adapter could not find a map instance.");
            }
        }, 500); // Delay to ensure map has time to initialize
    }

    /**
     * Adds a single alert marker to the map.
     * @param {object} alert - The alert object.
     */
    function addAlertMarker(alert) {
        if (!mapInstance || !alert.lat || !alert.lon) return;

        const color = alert.hmpi > 75 ? 'red' : 'orange';
        const marker = L.circleMarker([alert.lat, alert.lon], {
            radius: 8,
            color: 'white',
            weight: 1,
            fillColor: color,
            fillOpacity: 0.9
        }).addTo(mapInstance);

        const popupContent = `
            <b>Station:</b> ${alert.station_name}<br>
            <b>Status:</b> <span style="color:${color}; font-weight:bold;">Critical</span><br>
            <b>HMPI Value:</b> ${alert.hmpi}<br>
            <b>Timestamp:</b> ${new Date(alert.timestamp).toLocaleString()}
        `;
        marker.bindPopup(popupContent);
    }

    /**
     * Updates the simple alerts feed UI.
     * @param {object} alert - The alert object.
     */
    function updateAlertsFeed(alert) {
        const feed = document.getElementById('alertsFeed');
        if (!feed) return;

        const alertEl = document.createElement('div');
        alertEl.className = 'p-3 bg-red-900/50 border-l-4 border-red-500 mb-2 rounded-r-md';
        alertEl.innerHTML = `
            <p class="font-semibold text-sm text-red-300">
                Critical HMPI Alert: ${alert.hmpi}
            </p>
            <p class="text-xs text-gray-300">
                ${alert.station_name} on ${new Date(alert.timestamp).toLocaleDateString()}
            </p>
        `;
        feed.prepend(alertEl); // Add new alerts to the top
    }

    /**
     * Renders alerts that are already in localStorage on page load.
     */
    function renderStoredAlerts() {
        const storedAlerts = RTWQMS.utils.storageGet(ALERTS_STORAGE_KEY) || [];
        storedAlerts.forEach(alert => {
            addAlertMarker(alert);
            updateAlertsFeed(alert);
        });
    }

    return {
        init,
        addAlertMarker,
        updateAlertsFeed
    };
})();