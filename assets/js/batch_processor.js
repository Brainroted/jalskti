/*
 * assets/js/batch_processor.js
 * Main logic for CSV parsing, HMPI calculation, and orchestrating updates.
 */

window.RTWQMS = window.RTWQMS || {};
window.RTWQMS.Batch = (function() {
    "use strict";

    // --- Configuration ---
    const HMPI_LIMITS = { Pb: 10, Cd: 3, Cr: 50, Ni: 70, As: 10, Fe: 300, Mn: 100, Cu: 2000, Zn: 3000, Hg: 1, Se: 10, U: 30 };
    const ALERTS_STORAGE_KEY = 'rtwqms_alerts';
    const AGGREGATE_DATA_KEY = 'rtwqms_aggregate_data';

    // --- DOM Elements ---
    let fileInput, previewContainer, alertsContainer, progressBar, progressText, processBtn, reportBtn, previewThead, previewTbody;
    let papaParser; // To hold the parser instance

    /**
     * Initializes the module by creating UI and attaching event listeners.
     */
    function init() {
        fileInput = document.getElementById('csvUpload'); // As specified in prompt
        if (!fileInput) {
            console.error("#csvUpload input not found. Batch processor cannot start.");
            return;
        }

        createUI(); // Create necessary UI elements dynamically
        fileInput.addEventListener('change', (e) => processFile(e.target.files[0]));
        processBtn.addEventListener('click', () => fileInput.click());
        reportBtn.addEventListener('click', () => {
             window.location.href = 'analytics.html?generateReport=true';
        });

        // Initialize map adapter
        if (window.RTWQMS.Map) window.RTWQMS.Map.init();
    }

    /**
     * Creates the required UI containers if they don't exist.
     */
    function createUI() {
        const container = fileInput.parentElement;

        // Main action buttons
        const btnContainer = document.createElement('div');
        btnContainer.className = 'mt-4 space-x-3';
        container.appendChild(btnContainer);

        processBtn = document.createElement('button');
        processBtn.textContent = 'Process New CSV File';
        processBtn.className = 'bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition';
        btnContainer.appendChild(processBtn);

        reportBtn = document.createElement('button');
        reportBtn.textContent = 'Generate Analytics Report';
        reportBtn.className = 'bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition';
        reportBtn.style.display = 'none'; // Initially hidden
        btnContainer.appendChild(reportBtn);
        
        // Progress Bar
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'w-full bg-gray-700 rounded-full mt-4 hidden';
        progressBar = document.createElement('div');
        progressBar.className = 'bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full';
        progressText = document.createElement('span');
        progressBar.appendChild(progressText);
        progressWrapper.appendChild(progressBar);
        container.appendChild(progressWrapper);

        // Preview & Alerts Containers
        const layoutContainer = document.createElement('div');
        layoutContainer.className = 'mt-6 grid grid-cols-1 md:grid-cols-3 gap-6';
        container.appendChild(layoutContainer);

        previewContainer = document.createElement('div');
        previewContainer.id = 'csv-preview-container';
        previewContainer.className = 'md:col-span-2 bg-gray-800 p-4 rounded-lg overflow-x-auto';
        previewContainer.innerHTML = '<h3 class="font-semibold mb-2">CSV Preview</h3><table id="csv-preview-table" class="w-full text-sm text-left"><thead><tr id="csv-preview-thead"></tr></thead><tbody id="csv-preview-tbody"></tbody></table>';
        layoutContainer.appendChild(previewContainer);
        
        alertsContainer = document.createElement('div');
        alertsContainer.className = 'bg-gray-800 p-4 rounded-lg';
        alertsContainer.innerHTML = '<h3 class="font-semibold mb-2">Critical Alerts Feed</h3><div id="alertsFeed" class="max-h-96 overflow-y-auto"></div>';
        layoutContainer.appendChild(alertsContainer);

        previewThead = document.getElementById('csv-preview-thead');
        previewTbody = document.getElementById('csv-preview-tbody');
    }

    /**
     * Main file processing function.
     * @param {File} file - The CSV file to process.
     */
    function processFile(file) {
        if (!file) return;

        // Reset UI and data
        previewThead.innerHTML = '';
        previewTbody.innerHTML = '';
        document.getElementById('alertsFeed').innerHTML = '';
        reportBtn.style.display = 'none';
        progressBar.parentElement.classList.remove('hidden');
        updateProgress(0);

        const allRows = [];
        const alerts = [];
        const aggregate = {
            dailyExceedances: {},
            turbidity: { x: [], y: [], meta: [] },
            dailyAvgParams: {},
            regionSummary: {},
            alerts: [],
            stats: { samples_processed: 0, critical_count: 0, total_metals: 0, top_metals: {} }
        };

        papaParser = Papa.parse(file, {
            worker: true,
            header: true,
            skipEmptyLines: true,
            chunk: (results, parser) => {
                results.data.forEach(row => {
                    const processedRow = processRow(row);
                    if (processedRow) {
                        allRows.push(processedRow);
                        updateAggregates(aggregate, processedRow);
                        if (processedRow._hmpi.status === 'Critical') {
                           const alert = createAlert(processedRow);
                           aggregate.alerts.push(alert);
                           alerts.push(alert);
                           if (window.RTWQMS.Map) {
                               window.RTWQMS.Map.addAlertMarker(alert);
                               window.RTWQMS.Map.updateAlertsFeed(alert);
                           }
                        }
                    }
                });
                updatePreviewTable(results.data);
                // A more advanced progress could use file.size and results.meta.cursor
                // For now, this is a simple visual indicator.
                updateProgress(allRows.length); 
            },
            complete: () => {
                console.log("Parsing complete. Total rows processed:", allRows.length);
                updateProgress(allRows.length, true);
                
                // Finalize aggregations (e.g., calculate averages)
                finalizeAggregates(aggregate);

                // Save data for other pages
                RTWQMS.utils.storageSet(ALERTS_STORAGE_KEY, alerts);
                RTWQMS.utils.storageSet(AGGREGATE_DATA_KEY, aggregate);

                reportBtn.style.display = 'inline-block';
                console.log("Final Aggregate Data:", aggregate);

                // Update analytics page charts if it has an updater function available
                if (window.RTWQMS.Charts && window.RTWQMS.Charts.updateAllCharts) {
                    window.RTWQMS.Charts.updateAllCharts(aggregate);
                }
            },
            error: (error) => console.error("PapaParse Error:", error)
        });
    }
    
    /**
     * Processes a single row: validates, computes HMPI.
     * @param {object} row - The raw row from PapaParse.
     * @returns {object|null} The processed row with HMPI data, or null if invalid.
     */
    function processRow(row) {
        // Basic validation
        if (!row.latitude || !row.longitude) return null;

        let subIndexSum = 0;
        let metalCount = 0;

        for (const metal in HMPI_LIMITS) {
            const value = RTWQMS.utils.parseNumber(row[metal]);
            if (value !== null) {
                subIndexSum += (value / HMPI_LIMITS[metal]);
                metalCount++;
            }
        }

        if (metalCount === 0) {
             row._hmpi = { value: 0, status: 'Good' };
        } else {
            const value = (subIndexSum / metalCount) * 100;
            let status = 'Good';
            if (value > 75) status = 'Critical';
            else if (value > 25) status = 'Bad';
            row._hmpi = { value: +value.toFixed(2), status };
        }
        return row;
    }
    
    /**
     * Creates a standardized alert object.
     * @param {object} row - The processed row.
     * @returns {object} The alert object.
     */
    function createAlert(row) {
        return {
            id: `alert-${Date.now()}-${row.station_id}`,
            station_id: row.station_id,
            station_name: row.station_name || 'N/A',
            lat: RTWQMS.utils.parseNumber(row.latitude),
            lon: RTWQMS.utils.parseNumber(row.longitude),
            timestamp: row.timestamp || new Date().toISOString(),
            hmpi: row._hmpi.value,
            message: `Critical HMPI value of ${row._hmpi.value} recorded.`
        };
    }

    /**
     * Updates the preview table with a new chunk of data.
     * @param {Array<object>} data - Chunk of rows.
     */
    const updatePreviewTable = RTWQMS.utils.debounce((data) => {
        if (!data || data.length === 0) return;

        // Create header if it doesn't exist
        if (previewThead.innerHTML === '') {
            const headers = Object.keys(data[0]).filter(h => h !== '_hmpi');
            previewThead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>HMPI_Value</th><th>HMPI_Status</th></tr>`;
        }

        const fragment = document.createDocumentFragment();
        data.forEach(row => {
            if (!row._hmpi) return; // Skip rows that failed processing
            const tr = document.createElement('tr');
            let rowClass = 'border-b border-gray-700';
            switch (row._hmpi.status) {
                case 'Critical': rowClass += ' bg-red-900/60'; break;
                case 'Bad': rowClass += ' bg-yellow-900/60'; break;
            }
            tr.className = rowClass;

            let cells = '';
            for (const key in row) {
                if (key !== '_hmpi') {
                    cells += `<td class="px-2 py-1">${row[key] || ''}</td>`;
                }
            }
            cells += `<td class="px-2 py-1 font-bold">${row._hmpi.value}</td>`;
            cells += `<td class="px-2 py-1">${row._hmpi.status}</td>`;
            tr.innerHTML = cells;
            fragment.appendChild(tr);
        });
        previewTbody.appendChild(fragment);
    }, 200);

    /**
     * Updates all aggregate data structures with a new row.
     * @param {object} aggregate - The main aggregate object.
     * @param {object} row - The processed row.
     */
    function updateAggregates(aggregate, row) {
        const date = RTWQMS.utils.formatDate(row.timestamp);
        const district = row.district || 'Unknown District';

        // 1. Stats
        aggregate.stats.samples_processed++;
        if (row._hmpi.status === 'Critical') aggregate.stats.critical_count++;
        
        // 2. Daily Exceedances (simple count of critical samples for now)
        if (row._hmpi.status === 'Critical') {
             aggregate.dailyExceedances[date] = (aggregate.dailyExceedances[date] || 0) + 1;
        }

        // 3. Turbidity vs DO
        const turbidity = RTWQMS.utils.parseNumber(row.turbidity);
        const DO = RTWQMS.utils.parseNumber(row.DO);
        if (turbidity !== null && DO !== null) {
            aggregate.turbidity.x.push(turbidity);
            aggregate.turbidity.y.push(DO);
            aggregate.turbidity.meta.push({
                station_name: row.station_name,
                date: date,
                hmpi: row._hmpi.value
            });
        }
        
        // 4. Daily Average Params (store sum and count for now)
        for (const key in row) {
             const val = RTWQMS.utils.parseNumber(row[key]);
             if (val !== null && typeof val === 'number') {
                if (!aggregate.dailyAvgParams[key]) aggregate.dailyAvgParams[key] = {};
                if (!aggregate.dailyAvgParams[key][date]) aggregate.dailyAvgParams[key][date] = { sum: 0, count: 0 };
                aggregate.dailyAvgParams[key][date].sum += val;
                aggregate.dailyAvgParams[key][date].count++;
                if (HMPI_LIMITS[key]) { // Track top metals
                    aggregate.stats.top_metals[key] = (aggregate.stats.top_metals[key] || 0) + 1;
                }
             }
        }
        
        // 5. Region Summary
        if (!aggregate.regionSummary[district]) {
            aggregate.regionSummary[district] = { hmpi_sum: 0, count: 0, critical_count: 0 };
        }
        aggregate.regionSummary[district].hmpi_sum += row._hmpi.value;
        aggregate.regionSummary[district].count++;
        if (row._hmpi.status === 'Critical') {
            aggregate.regionSummary[district].critical_count++;
        }
    }

    /**
     * Finalizes calculations after all rows are processed (e.g., averages).
     * @param {object} aggregate - The aggregate object.
     */
    function finalizeAggregates(aggregate) {
        // Finalize daily averages
        for (const param in aggregate.dailyAvgParams) {
            const datesData = aggregate.dailyAvgParams[param];
            const result = [];
            Object.keys(datesData).sort().forEach(date => {
                const day = datesData[date];
                result.push({ date: date, avg: day.sum / day.count });
            });
            aggregate.dailyAvgParams[param] = result;
        }

        // Finalize region summary
        for (const region in aggregate.regionSummary) {
            const data = aggregate.regionSummary[region];
            data.mean_HMPI = data.hmpi_sum / data.count;
            data.pct_critical = (data.critical_count / data.count) * 100;
        }
        
        // Finalize top metals
        aggregate.stats.top_metals = Object.entries(aggregate.stats.top_metals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([key]) => key);
    }

    /**
     * Updates the progress bar UI.
     * @param {number} count - Number of rows processed.
     * @param {boolean} isComplete - Flag for completion.
     */
    function updateProgress(count, isComplete = false) {
         if (isComplete) {
            progressBar.style.width = '100%';
            progressText.textContent = `Processing Complete (${count} rows)`;
         } else {
            // This is just a visual cue, not a real percentage
            const width = Math.min(100, (count / 1000) * 100); // Assume avg 1000 rows
            progressBar.style.width = `${width}%`;
            progressText.textContent = `Processing ${count} rows...`;
         }
    }

    return { init, processFile };
})();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', RTWQMS.Batch.init);