/*
 * assets/js/report.js
 * Assembles and generates the multi-page PDF report.
 */
window.RTWQMS = window.RTWQMS || {};
window.RTWQMS.Report = (function() {
    "use strict";

    const AGGREGATE_DATA_KEY = 'rtwqms_aggregate_data';

    /**
     * Main function to generate the PDF report.
     */
    async function generate() {
        const data = RTWQMS.utils.storageGet(AGGREGATE_DATA_KEY);
        if (!data) {
            alert("No data available to generate a report. Please process a CSV file first.");
            return;
        }
        
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal) loadingModal.classList.remove('hidden');

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            
            // --- Page 1: Executive Summary ---
            generateExecutiveSummary(pdf, data);

            // --- Subsequent Pages: Charts ---
            const chartIds = ['calendar-heatmap', 'scatter-plot', 'trend-lines'];
            for (const id of chartIds) {
                pdf.addPage();
                const chartElement = document.getElementById(id);
                if (chartElement && chartElement._fullLayout) { // Check if Plotly chart is rendered
                    const imageData = await Plotly.toImage(chartElement, { format: 'png', width: 800, height: 450 });
                    const title = chartElement.parentElement.querySelector('h3').textContent;
                    
                    pdf.setFontSize(16);
                    pdf.setTextColor(44, 122, 123); // Primary color
                    pdf.text(title, 105, 20, { align: 'center' });
                    pdf.addImage(imageData, 'PNG', 15, 30, 180, 101);
                }
            }
            
            pdf.save(`RTWQMS-Analytics-Report-${new Date().toISOString().slice(0,10)}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("An error occurred while creating the PDF report.");
        } finally {
            if (loadingModal) loadingModal.classList.add('hidden');
        }
    }

    /**
     * Generates the first page of the PDF with KPIs and summaries.
     * @param {jsPDF} pdf - The jsPDF instance.
     * @param {object} data - The aggregated data.
     */
    function generateExecutiveSummary(pdf, data) {
        // Header
        pdf.setFontSize(24);
        pdf.setTextColor('#06b6d4'); // Tailwind cyan-500
        pdf.text('Water Quality Analytics Report', 105, 25, { align: 'center' });
        pdf.setFontSize(12);
        pdf.setTextColor(150);
        pdf.text(`Report Generated: ${new Date().toLocaleString()}`, 105, 35, { align: 'center' });

        // --- KPI Cards ---
        const { stats, regionSummary } = data;
        const kpis = [
            { label: 'Samples Processed', value: stats.samples_processed.toLocaleString() },
            { label: 'Critical Samples', value: `${stats.critical_count} (${(stats.critical_count/stats.samples_processed*100).toFixed(1)}%)` },
            { label: 'Districts Monitored', value: Object.keys(regionSummary).length },
        ];
        
        kpis.forEach((kpi, index) => {
            const x = 20 + (index * 60);
            pdf.setFillColor(243, 244, 246); // gray-100
            pdf.roundedRect(x - 5, 50, 55, 30, 3, 3, 'F');
            pdf.setFontSize(18);
            pdf.setTextColor(17, 24, 39); // gray-900
            pdf.text(kpi.value, x + 22.5, 65, { align: 'center' });
            pdf.setFontSize(10);
            pdf.setTextColor(75, 85, 99); // gray-500
            pdf.text(kpi.label, x + 22.5, 73, { align: 'center' });
        });
        
        // --- Key Insights & Hotspots ---
        pdf.setLineWidth(0.5);
        pdf.setDrawColor(229, 231, 235); // gray-200
        pdf.line(20, 95, 190, 95);

        pdf.setFontSize(16);
        pdf.setTextColor(44, 122, 123);
        pdf.text('Key Insights', 20, 105);

        // Top problematic metals
        pdf.setFontSize(11);
        pdf.setTextColor(55, 65, 81); // gray-600
        const topMetalsText = `The most frequently recorded metals in samples were: ${stats.top_metals.join(', ')}.`;
        pdf.text(topMetalsText, 20, 115, { maxWidth: 170 });
        
        // Hotspot Regions
        const hotspots = Object.entries(regionSummary)
            .sort(([, a], [, b]) => b.pct_critical - a.pct_critical)
            .slice(0, 3);

        const hotspotsText = 'Top 3 hotspot districts with the highest percentage of critical samples:';
        pdf.text(hotspotsText, 20, 130, { maxWidth: 170 });
        hotspots.forEach(( [name, data], index) => {
            const text = `${index + 1}. ${name}: ${data.pct_critical.toFixed(1)}% critical samples (Avg HMPI: ${data.mean_HMPI.toFixed(1)})`;
            pdf.text(text, 25, 140 + (index * 7));
        });
    }

    return { generate };
})();