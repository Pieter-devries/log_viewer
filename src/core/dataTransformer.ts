// src/core/dataTransformer.ts
import { VisQueryResponse, VisConfig, Row, Field, Cell, VisData, MeasureMinMax, Link, LookerChartUtils } from './types'; // Ensure all needed types are imported
import { html } from 'gridjs'; // Import Grid.js html helper

// Declare LookerChartUtils global if used within this file
// Ensure LookerCharts global is available in the execution environment
declare var LookerCharts: LookerChartUtils; // Use the specific interface

// --- Type Predicate Helper ---
/**
 * Type predicate function to check if a value is an HTMLElement.
 * @param value - The value to check.
 * @returns True if the value is an HTMLElement, false otherwise.
 */
function isHTMLElement(value: any): value is HTMLElement {
    // Check if it's an object, not null, and has nodeType === 1 (ELEMENT_NODE)
    return typeof value === 'object' && value !== null && value.nodeType === 1;
}

/**
 * Transforms Looker data and query response into the format required by Grid.js.
 * Also handles cell formatting, drilling, and sparkline generation.
 */
export function transformLookerDataForGridJs(
    data: VisData,
    queryResponse: VisQueryResponse | null,
    config: VisConfig | null,
    measureMinMax: Record<string, MeasureMinMax> | undefined
): { columns: any[], data: any[][] } {

    if (!queryResponse || !queryResponse.fields) {
        console.warn("transformLookerDataForGridJs: No queryResponse or queryResponse.fields found.");
        return { columns: [], data: [] };
    }
    // Combine dimensions and measures from the official structure
    const lookerFields: Field[] = [
        ...(queryResponse.fields.dimensions || []),
        ...(queryResponse.fields.measures || [])
    ];
    // Create a Set of measure names for efficient checking
    const measureNames = new Set(queryResponse.fields.measures?.map(m => m.name) || []);

    if (lookerFields.length === 0) {
        console.warn("transformLookerDataForGridJs: No dimensions or measures found.");
        return { columns: [], data: [] };
    }

    // Define Grid.js Columns configuration based on Looker fields
    let columns: any[] = lookerFields.map((field) => {
        const isMeasure = measureNames.has(field.name);

        return {
            id: field.name, // Use Looker field name as column ID
            name: field.label_short || field.label || field.name, // Use best available label
            sort: true, // Enable sorting for this column
            resizable: true, // Enable resizing for this column
            /** Custom cell formatter */
            formatter: (cellValue: any, gridJsRowObject: any) => {
                // Find the original Looker row index (stored in a hidden column)
                let originalIndex: number | undefined;
                try {
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { console.error(`Error finding index cell by ID for field ${field.name}:`, e); }
                // Fallback if ID search fails
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { console.error(`Error finding index via last cell for field ${field.name}:`, e); }
                }

                // Validate index and get original Looker row/cell
                if (originalIndex === undefined || originalIndex < 0 || originalIndex >= data.length) {
                    return html(String(cellValue ?? '[Render Error - Invalid Index]'));
                }
                const lookerRow = data[originalIndex];
                // Need type assertion as Row type includes PivotCell
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] as Cell : undefined;

                if (!lookerCell) { return html(String(cellValue ?? '[No Cell Data]')); }

                let initialContent: string | HTMLElement;
                let finalContentString: string = ''; // Initialize
                let contentAlreadyHasLink = false;

                // --- Step 1: Get initial content string or element ---
                if (isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try {
                        // Use Looker's HTML rendering for measures
                        initialContent = LookerCharts.Utils.htmlForCell(lookerCell, undefined, field);
                    } catch (e) {
                        // Fallback if htmlForCell fails
                        initialContent = lookerCell.rendered ?? String(lookerCell.value ?? '[Format Error]');
                        console.error(`Error using Looker htmlForCell for measure ${field.name}:`, e);
                    }
                } else if (!isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.textForCell) {
                    // Use Looker's text rendering for dimensions to avoid unwanted links
                    initialContent = LookerCharts.Utils.textForCell(lookerCell);
                } else {
                    // Final fallback for dimensions or if utils unavailable
                    initialContent = String(lookerCell.value ?? '');
                }

                // --- Step 2: Check for links and finalize contentString ---
                let potentialElement: HTMLElement | null = null;
                if (isHTMLElement(initialContent)) { // Use type predicate
                    potentialElement = initialContent;
                    // Check if Looker already rendered the link
                    if (initialContent.tagName === 'A' || initialContent.querySelector('a')) {
                        contentAlreadyHasLink = true;
                    }
                    // If no link yet, but should have one (measure + links defined)
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span');
                        linkElement.classList.add('drillable');
                        linkElement.innerHTML = potentialElement.outerHTML; // Safe: potentialElement is HTMLElement
                        linkElement.onclick = (event: MouseEvent) => {
                            event.stopPropagation();
                            if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            } else { console.error("LookerChartUtils.Utils.openDrillMenu is not available."); }
                        };
                        finalContentString = linkElement.outerHTML; // Final content is the wrapper's HTML
                    } else {
                        // Otherwise, the final content is just the element's HTML
                        finalContentString = potentialElement.outerHTML;
                    }
                } else { // It's a string
                    const contentStr = String(initialContent);
                    // Only check for links in string if it's a measure, prevent accidental dimension linking
                    if (isMeasure && contentStr.includes('<a')) {
                        contentAlreadyHasLink = true;
                    }
                    // Wrap if needed (only measures)
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span');
                        linkElement.classList.add('drillable');
                        linkElement.innerHTML = contentStr; // Use the string content
                        linkElement.onclick = (event: MouseEvent) => {
                            event.stopPropagation();
                            if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            } else { console.error("LookerChartUtils.Utils.openDrillMenu is not available."); }
                        };
                        finalContentString = linkElement.outerHTML; // Final content is the wrapper's HTML
                    } else {
                        finalContentString = contentStr; // Use the string directly
                    }
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
                    // <<< Ensure MULTIPLE bars are generated >>>
                    for (let i = 0; i < numBars; i++) {
                        const filledClass = i < filledBars ? 'sparkline-hist-bar--filled' : '';
                        barsHtml += `<span class="sparkline-hist-bar ${filledClass}"></span>`;
                    }
                    sparklineHtml = `<span class="sparkline-container" title="Value: ${value}\nRange: ${stats.min} - ${stats.max}">${barsHtml}</span>`;
                }
                // --- End Sparkline Logic ---

                // --- Combine final content string and sparkline string ---
                // No outer wrapper span needed if TD is not flexbox
                const finalHtml = `${finalContentString}${sparklineHtml}`;

                return html(finalHtml); // Return Grid.js compatible HTML object
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

    // Add Hidden Index Column (used by formatter to find original row data)
    columns.push({ id: '_originalIndex', hidden: true });

    // Transform Row Data for Grid.js (array of arrays)
    const gridData = data.map((lookerRow, originalIndex) => {
        const rowData: any[] = lookerFields.map(field => {
            const cellData = lookerRow[field.name];
            // Basic handling for potential PivotCell vs Cell structure
            return (cellData && typeof cellData === 'object' && 'value' in cellData) ? (cellData as Cell).value : cellData;
        });
        // Add placeholder for row number column if enabled
        if (config?.showRowNumbers) { rowData.unshift(null); }
        // Add original index for the hidden column
        rowData.push(originalIndex);
        return rowData;
    });

    return { columns, data: gridData as any[][] };
}
