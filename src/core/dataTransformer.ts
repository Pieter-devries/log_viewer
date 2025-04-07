// src/core/dataTransformer.ts
import { VisQueryResponse, VisConfig, Row, Field, Cell, VisData, MeasureMinMax, Link, LookerChartUtils } from './types';
import { html } from 'gridjs';

// Declare LookerCharts global if needed (or ensure it's available)
declare var LookerCharts: LookerChartUtils;

// Type Predicate Helper
function isHTMLElement(value: any): value is HTMLElement {
    // Basic check for DOM nodes
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
    // Combine all field types into one array for easier processing
    const lookerFields: Field[] = [
        ...(queryResponse.fields.dimensions || []),
        ...(queryResponse.fields.measures || []),
        ...(queryResponse.fields.table_calculations || []) // Include table calcs if they exist
    ];
    // Determine if a field is a measure based on its presence in the measures array
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
            sort: true, // Enable sorting by default
            resizable: true, // Enable resizing by default (minWidth handled in gridOptions)
            /** Custom cell formatter */
            formatter: (cellValue: any, gridJsRowObject: any) => {
                let originalIndex: number | undefined;
                // Attempt to find the hidden index column first
                try {
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { console.error(`Error finding index cell for ${field.name}`, e); }

                // Fallback: try getting index from the last cell if the hidden column wasn't found (less reliable)
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { console.error(`Error finding index via last cell for ${field.name}`, e); }
                }

                // Validate index
                if (originalIndex === undefined || originalIndex < 0 || originalIndex >= data.length) {
                    console.error(`Invalid originalIndex (${originalIndex}) found for field ${field.name}. Data length: ${data.length}`);
                    return html(String(cellValue ?? '[Render Error - Invalid Index]'));
                }

                const lookerRow = data[originalIndex];
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] as Cell : undefined;

                // Handle cases where cell data might be missing
                if (!lookerCell) {
                    // console.warn(`No cell data found for field ${field.name} at index ${originalIndex}`);
                    return html(String(cellValue ?? '[No Cell Data]'));
                }

                let finalContentString: string = '';
                const hasLinks = lookerCell.links && lookerCell.links.length > 0;

                // --- MODIFIED: Prioritize htmlForCell if links exist ---
                // Try using Looker's built-in HTML rendering if links are present,
                // hoping it includes the necessary structure for native drill handling.
                if (hasLinks && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try {
                        const generatedHtml = LookerCharts.Utils.htmlForCell(lookerCell, undefined, field);
                        // htmlForCell can return string or HTMLElement
                        if (isHTMLElement(generatedHtml)) {
                            finalContentString = generatedHtml.outerHTML;
                        } else {
                            finalContentString = String(generatedHtml);
                        }
                        // console.log(`Used htmlForCell for ${field.name} due to links.`);
                    } catch (e) {
                        console.error(`Error using Looker htmlForCell for ${field.name} (with links):`, e);
                        // Fallback if htmlForCell fails
                        finalContentString = lookerCell.rendered ?? String(lookerCell.value ?? '');
                    }
                } else {
                    // --- Original Fallback Logic (if no links or htmlForCell unavailable/failed) ---
                    let initialContent: string | HTMLElement;
                    if (isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                        // Still use htmlForCell for measures even without links if available
                        try { initialContent = LookerCharts.Utils.htmlForCell(lookerCell, undefined, field); }
                        catch (e) { initialContent = lookerCell.rendered ?? String(lookerCell.value ?? ''); }
                    } else if (!isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.textForCell) {
                        // Use textForCell for dimensions without links
                        try { initialContent = LookerCharts.Utils.textForCell(lookerCell); }
                        catch (e) { initialContent = lookerCell.rendered ?? String(lookerCell.value ?? ''); }
                    } else {
                        // Absolute fallback
                        initialContent = lookerCell.rendered ?? String(lookerCell.value ?? '');
                    }

                    // Convert HTMLElement to string if necessary
                    if (isHTMLElement(initialContent)) {
                        finalContentString = initialContent.outerHTML;
                    } else {
                        finalContentString = String(initialContent);
                    }
                }
                // --- End Content Generation ---


                // --- REMOVED Manual Drill Wrapper ---
                // We now rely entirely on the HTML generated by Looker (hopefully via htmlForCell)
                // to handle drilling based on the presence of links in the data.


                // --- Sparkline Logic (Histogram) ---
                let sparklineHtml = '';
                const cellVal = lookerCell.value;
                const numericValue = Number(cellVal);
                if (isMeasure && config?.showMeasureSparklines === true && typeof numericValue === 'number' && isFinite(numericValue) && measureMinMax?.[field.name]) {
                    const stats = measureMinMax[field.name];
                    const value = numericValue;
                    const range = stats.max - stats.min;
                    let relativeValue = range > 0 ? (value - stats.min) / range : (stats.max === stats.min && stats.max !== 0 ? 1 : 0.5); // Handle range=0 case
                    relativeValue = Math.max(0, Math.min(relativeValue, 1)); // Clamp between 0 and 1
                    const numBars = 10; // Number of bars in the histogram
                    const filledBars = Math.max(0, Math.round(relativeValue * numBars)); // Ensure at least 0 bars
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
                const finalHtml = `${finalContentString}${sparklineHtml}`; // Append sparkline if it exists
                return html(finalHtml); // Use gridjs html() helper
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
                // Simple span for row number styling
                return html(`<span style="color:#999; user-select:none; font-size: 0.9em;">${displayIndex}</span>`);
            }
        });
    }

    // Add Hidden Index Column (used by formatter to get original row data)
    columns.push({ id: '_originalIndex', hidden: true });

    // Transform Row Data: Extract values and add original index
    const gridData = data.map((lookerRow, originalIndex) => {
        const rowData: any[] = lookerFields.map(field => {
            const cellData = lookerRow[field.name];
            // Extract the 'value' property if it's a Looker Cell object
            return (cellData && typeof cellData === 'object' && 'value' in cellData) ? (cellData as Cell).value : cellData;
        });
        // Add placeholder for row number column if it exists
        if (config?.showRowNumbers) { rowData.unshift(null); }
        // Add the original index to the end of the row data array
        rowData.push(originalIndex);
        return rowData;
    });

    return { columns, data: gridData as any[][] };
}
