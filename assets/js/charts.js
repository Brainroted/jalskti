/*
 * assets/js/charts.js
 * Renders and updates all Plotly charts for the analytics page.
 */
window.RTWQMS = window.RTWQMS || {};
window.RTWQMS.Charts = (function() {
    "use strict";

    const AGGREGATE_DATA_KEY = 'rtwqms_aggregate_data';
    
    // --- Chart Layouts & Config ---
    const baseLayout = {
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        font: { color: '#374151' }, // gray-700
        xaxis: { 
            gridcolor: '#e5e7eb', // gray-200
            zerolinecolor: '#d1d5db' // gray-300
        },
        yaxis: { 
            gridcolor: '#e5e7eb', // gray-200
            zerolinecolor: '#d1d5db' // gray-300
        },
        legend: { 
            bgcolor: 'rgba(255,255,255,0.5)',
            bordercolor: '#e5e7eb',
            borderwidth: 1
        },
        margin: { l: 50, r: 20, t: 40, b: 50 } // Adjust margins for better fit
    };

    const responsiveConfig = {
        responsive: true
    };
    
    /**
     * Main initialization function for the analytics page.
     */
    function init() {
        const data = RTWQMS.utils.storageGet(AGGREGATE_DATA_KEY);
        if (data) {
            updateAllCharts(data);
        } else {
            // Show placeholder text if no data is available
            document.getElementById('calendar-heatmap').innerHTML = '<p class="text-center text-gray-400 p-8">Generate a prediction on the Dashboard page to see analytics.</p>';
            document.getElementById('scatter-plot').innerHTML = '';
            document.getElementById('trend-lines').innerHTML = '';
        }

        // Add a listener to resize charts on window resize
        window.addEventListener('resize', () => {
             const data = RTWQMS.utils.storageGet(AGGREGATE_DATA_KEY);
             if(data) {
                // Use debounce to avoid excessive re-renders
                debounce(updateAllCharts(data), 250);
             }
        });
    }

    // Debounce function to limit the rate at which a function gets called.
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    /**
     * Main function to update all charts with new data.
     * @param {object} aggregate - The aggregated data object.
     */
    function updateAllCharts(aggregate) {
        if (!aggregate) return;
        updateCalendarHeatmap(aggregate.dailyExceedances);
        updateScatterPlot(aggregate.turbidity);
        updateTrendLines(aggregate.dailyAvgParams);
    }
    
    // --- Individual Chart Update Functions ---

    function updateCalendarHeatmap(data) {
        const container = document.getElementById('calendar-heatmap');
        if (!container || !data || Object.keys(data).length === 0) {
            if(container) container.innerHTML = '<p class="text-center text-gray-400 p-8">No exceedance data available.</p>';
            return;
        }

        const dates = Object.keys(data);
        const values = Object.values(data);
        const trace = {
            type: 'heatmap',
            x: dates.map(d => new Date(d)),
            y: Array(dates.length).fill('Exceedances'),
            z: [values],
            colorscale: 'YlOrRd',
            showscale: true,
            colorbar: {
                title: 'Count',
                titleside: 'right'
            }
        };
        const layout = { ...baseLayout, title: '' };
        Plotly.react(container, [trace], layout, responsiveConfig);
    }

    function updateScatterPlot(data) {
        const container = document.getElementById('scatter-plot');
        if (!container || !data || data.x.length === 0) return;
        
        const trace = {
            x: data.x,
            y: data.y,
            mode: 'markers',
            type: 'scatter',
            text: data.meta.map(m => `Station: ${m.station_name}<br>HMPI: ${m.hmpi}`),
            marker: {
                color: data.meta.map(m => m.hmpi),
                colorscale: 'Portland',
                showscale: true,
                colorbar: { title: 'HMPI' },
                size: 10
            }
        };
        const layout = { ...baseLayout, title: '', xaxis: {title: 'Turbidity (NTU)'}, yaxis: {title: 'DO (mg/L)'}};
        Plotly.react(container, [trace], layout, responsiveConfig);
    }

    function updateTrendLines(data) {
        const container = document.getElementById('trend-lines');
        if (!container || !data || Object.keys(data).length === 0) return;
        
        const parametersToShow = ['Pb', 'Cr', 'As', 'turbidity', 'pH', 'DO'];
        const traces = [];

        parametersToShow.forEach(param => {
            if (data[param] && data[param].length > 0) {
                traces.push({
                    x: data[param].map(d => d.date),
                    y: data[param].map(d => d.avg),
                    mode: 'lines+markers',
                    name: param
                });
            }
        });

        const layout = { ...baseLayout, title: '', yaxis: {title: 'Average Value'} };
        Plotly.react(container, traces, layout, responsiveConfig);
    }

    // Auto-initialize on analytics page
    if (window.location.pathname.includes('analytics.html')) {
        document.addEventListener('DOMContentLoaded', init);
    }

    return { init, updateAllCharts };

})();

