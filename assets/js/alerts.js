/*
 * assets/js/alerts.js
 * Manages alert creation, persistence in localStorage, and map marker rendering.
 */

// Create a global namespace to avoid polluting the global scope
window.RTWQMS = window.RTWQMS || {};

(function(RTWQMS) {
    "use strict";

    // Key for storing alerts in the browser's local storage
    const ALERTS_STORAGE_KEY = 'rtwqms_alerts';

    // In-memory array to hold the current session's alerts
    let alerts = [];

    /**
     * The Leaflet map instance. This needs to be set from another script
     * where the map is initialized, e.g., window.RTWQMS.regionalMap
     */
    let mapInstance = null;

    /**
     * Initializes the alerts module.
     * @param {L.Map} map - The Leaflet map instance.
     */
    function init(map) {
        mapInstance = map;
        alerts = loadAlerts();
        renderAllAlertsOnMap();
        console.log("Alerts module initialized and loaded", alerts.length, "alerts from storage.");
    }

    /**
     * Loads alerts from localStorage.
     * @returns {Array} An array of alert objects.
     */
    function loadAlerts() {
        try {
            const storedAlerts = localStorage.getItem(ALERTS_STORAGE_KEY);
            return storedAlerts ? JSON.parse(storedAlerts) : [];
        } catch (e) {
            console.error("Failed to parse alerts from localStorage", e);
            return [];
        }
    }

    /**
     * Saves the current alerts array to localStorage.
     */
    function saveAlerts() {
        try {
            localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
        } catch (e) {
            console.error("Failed to save alerts to localStorage", e);
        }
    }

    /**
     * Creates a new alert object and adds it to the in-memory array and localStorage.
     * @param {Object} rowData - The data row from the CSV.
     * @param {Object} hmpiResult - The result from the HMPI calculation.
     * @returns {Object} The created alert object.
     */
    function createAlert(rowData, hmpiResult) {
        if (!rowData.station_id || !rowData.latitude || !rowData.longitude) {
            console.warn("Skipping alert creation due to missing data:", rowData);
            return null;
        }

        const newAlert = {
            id: `alert-${Date.now()}-${rowData.station_id}`,
            station_id: rowData.station_id,
            station_name: rowData.station_name || 'N/A',
            lat: parseFloat(rowData.latitude),
            lon: parseFloat(rowData.longitude),
            timestamp: rowData.timestamp || new Date().toISOString(),
            severity: hmpiResult.status.toLowerCase(),
            message: `HMPI value of ${hmpiResult.value} recorded at ${rowData.station_name}.`,
            hmpi: hmpiResult.value
        };

        // Add to the start of the array to show newest first
        alerts.unshift(newAlert);
        saveAlerts();
        addAlertMarkerToMap(newAlert);

        return newAlert;
    }

    /**
     * Adds a single alert marker to the map.
     * @param {Object} alert - The alert object to display.
     */
    function addAlertMarkerToMap(alert) {
        if (!mapInstance || isNaN(alert.lat) || isNaN(alert.lon)) {
            console.error("Map not initialized or invalid coordinates for alert:", alert);
            return;
        }

        const color = alert.severity === 'critical' ? 'red' : 'orange';
        const radius = alert.severity === 'critical' ? 10 : 6;

        const circleMarker = L.circleMarker([alert.lat, alert.lon], {
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            radius: radius
        }).addTo(mapInstance);

        const popupContent = `
            <b>Station:</b> ${alert.station_name}<br>
            <b>Status:</b> ${alert.severity}<br>
            <b>HMPI:</b> ${alert.hmpi}<br>
            <b>Time:</b> ${new Date(alert.timestamp).toLocaleString()}
        `;
        circleMarker.bindPopup(popupContent);
    }

    /**
     * Renders all currently loaded alerts on the map.
     */
    function renderAllAlertsOnMap() {
        alerts.forEach(addAlertMarkerToMap);
    }
    
    /**
     * Clears all alerts from memory, storage, and the map.
     */
    function clearAllAlerts() {
        alerts = [];
        localStorage.removeItem(ALERTS_STORAGE_KEY);
        // This requires a way to remove layers, simple for now
        console.log("All alerts cleared. Please reload the page to see map changes.");
    }


    // Expose public functions to the RTWQMS namespace
    RTWQMS.alerts = {
        init,
        createAlert,
        loadAlerts,
        clearAllAlerts
    };

})(window.RTWQMS);