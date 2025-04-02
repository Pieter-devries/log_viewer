// src/core/dataTransformer.ts
import { VisQueryResponse, VisConfig, Row, Field, Cell, VisData, MeasureMinMax, Link, LookerChartUtils } from './types';
import { html } from 'gridjs';

declare var LookerCharts: LookerChartUtils;

// Type Predicate Helper
function isHTMLElement(value: any): value is HTMLElement {
    return typeof value === 'object' && value !== null && value.nodeType === 1;
}

/**
 * Transforms Looker data and query response into the format required by Grid.js.
 */
export function transformLookerDataForGridJs(
    data: VisData,
    queryResponse: VisQueryResponse | null,
    config: VisConfig | null,
    measureMinMax: Record<string, MeasureMinMax> | undefined
): { columns: any[], data: any[][] } {

    if (!queryResponse || !queryResponse.fields) {
        console.warn("dataTransformer: No queryResponse or fields");
        return { columns: [], data: [] };
    }
    const lookerFields: Field[] = [
        ...(queryResponse.fields.dimensions || []),
        ...(queryResponse.fields.measures || [])
    ];
    const measureNames = new Set(queryResponse.fields.measures?.map(m => m.name) || []);

    if (lookerFields.length === 0) {
        console.warn("dataTransformer: No fields found");
        return { columns: [], data: [] };
    }

    // Define Grid.js Columns configuration
    let columns: any[] = lookerFields.map((field) => {
        const isMeasure = measureNames.has(field.name);

        return {
            id: field.name,
            name: field.label_short || field.label || field.name,
            sort: true,
            resizable: true,
            /** Custom cell formatter */
            formatter: (cellValue: any, gridJsRowObject: any) => {
                // Find original index and Looker cell data
                let originalIndex: number | undefined;
                try {
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { console.error(`Error finding index cell for ${field.name}`, e); }
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { console.error(`Error finding index via last cell for ${field.name}`, e); }
                }
                if (originalIndex === undefined || originalIndex < 0 || originalIndex >= data.length) {
                    return html(String(cellValue ?? '[Render Error - Invalid Index]'));
                }
                const lookerRow = data[originalIndex];
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] as Cell : undefined;
                if (!lookerCell) { return html(String(cellValue ?? '[No Cell Data]')); }

                let initialContent: string | HTMLElement;
                let finalContentString: string = ''; // Initialize
                let contentAlreadyHasLink = false;

                // --- Get initial content string or element ---
                if (isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try { initialContent = LookerCharts.Utils.htmlForCell(lookerCell, undefined, field); }
                    catch (e) { initialContent = lookerCell.rendered ?? String(lookerCell.value ?? ''); console.error(`Error using Looker htmlForCell for ${field.name}:`, e); }
                } else if (!isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.textForCell) {
                    initialContent = LookerCharts.Utils.textForCell(lookerCell); // Use textForCell for dimensions
                } else {
                    initialContent = String(lookerCell.value ?? ''); // Fallback ONLY to value for dimensions/others
                }

                // --- Check for links and finalize contentString ---
                let potentialElement: HTMLElement | null = null;
                if (isHTMLElement(initialContent)) { // Use type predicate
                    potentialElement = initialContent;
                    if (initialContent.tagName === 'A' || initialContent.querySelector('a')) { contentAlreadyHasLink = true; }
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span'); linkElement.classList.add('drillable');
                        linkElement.innerHTML = potentialElement.outerHTML;
                        linkElement.onclick = (event: MouseEvent) => { event.stopPropagation(); if (LookerCharts.Utils?.openDrillMenu) LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event }); };
                        finalContentString = linkElement.outerHTML;
                    } else { finalContentString = potentialElement.outerHTML; }
                } else { // It's a string
                    const contentStr = String(initialContent);
                    if (isMeasure && contentStr.includes('<a')) { contentAlreadyHasLink = true; }
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span'); linkElement.classList.add('drillable');
                        linkElement.innerHTML = contentStr;
                        linkElement.onclick = (event: MouseEvent) => { event.stopPropagation(); if (LookerCharts.Utils?.openDrillMenu) LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event }); };
                        finalContentString = linkElement.outerHTML;
                    } else { finalContentString = contentStr; }
                }
                // --- End Link Handling ---

                // --- Sparkline Logic (Histogram) ---
                let sparklineHtml = '';
                const cellVal = lookerCell.value;
                const numericValue = Number(cellVal);
                if (isMeasure && config?.showMeasureSparklines === true && typeof numericValue === 'number' && isFinite(numericValue) && measureMinMax?.[field.name]) {
                    const stats = measureMinMax[field.name];
                    const value = numericValue; const range = stats.max - stats.min;
                    let relativeValue = range > 0 ? (value - stats.min) / range : 0.5;
                    relativeValue = Math.max(0, Math.min(relativeValue, 1));
                    const numBars = 10;
                    const filledBars = Math.max(0, Math.round(relativeValue * numBars));
                    let barsHtml = '';
                    // Generate MULTIPLE bars for histogram
                    for (let i = 0; i < numBars; i++) {
                        const filledClass = i < filledBars ? 'sparkline-hist-bar--filled' : '';
                        barsHtml += `<span class="sparkline-hist-bar ${filledClass}"></span>`;
                    }
                    sparklineHtml = `<span class="sparkline-container" title="Value: ${value}\nRange: ${stats.min} - ${stats.max}">${barsHtml}</span>`;
                }
                // --- End Sparkline Logic ---

                // --- Combine content and sparkline ---
                // No outer wrapper needed if TD is not flex
                const finalHtml = `${finalContentString}${sparklineHtml}`;
                return html(finalHtml);
            }
            // --- End of formatter function ---
        };
    });

    // Add Row Number Column if configured
    if (config?.showRowNumbers) {
        columns.unshift({
            id: '_rowNum', name: '#', sort: false, resizable: false, width: '50px',
            formatter: (cell: any, gridJsRowObject: any) => {
                let originalIndex: number | undefined;
                try { const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex'); originalIndex = indexCell?.data; } catch (e) { /* ignore */ }
                if (originalIndex === undefined) { try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; } catch (e) { /* ignore */ } }
                const displayIndex = originalIndex !== undefined ? originalIndex + 1 : '?';
                return html(`<span style="color:#999; user-select:none; font-size: 0.9em;">${displayIndex}</span>`);
            }
        });
    }

    // Add Hidden Index Column
    columns.push({ id: '_originalIndex', hidden: true });

    // Transform Row Data
    const gridData = data.map((lookerRow, originalIndex) => {
        const rowData: any[] = lookerFields.map(field => {
            const cellData = lookerRow[field.name];
            return (cellData && typeof cellData === 'object' && 'value' in cellData) ? (cellData as Cell).value : cellData;
        });
        if (config?.showRowNumbers) { rowData.unshift(null); }
        rowData.push(originalIndex);
        return rowData;
    });

    return { columns, data: gridData as any[][] };
}
