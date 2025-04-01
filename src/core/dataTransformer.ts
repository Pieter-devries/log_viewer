// src/core/dataTransformer.ts
import { VisQueryResponse, VisConfig, Row, Field, Cell, VisData, MeasureMinMax } from './types';
import { html } from 'gridjs';

declare var LookerCharts: any;

function isHTMLElement(value: any): value is HTMLElement {
    return typeof value === 'object' && value !== null && value.nodeType === 1;
}

export function transformLookerDataForGridJs(
    data: VisData,
    queryResponse: VisQueryResponse | null,
    config: VisConfig | null,
    measureMinMax: Record<string, MeasureMinMax> | undefined
): { columns: any[], data: any[][] } {

    if (!queryResponse || !queryResponse.fields) { return { columns: [], data: [] }; }
    const lookerFields: Field[] = [
        ...(queryResponse.fields.dimensions || []),
        ...(queryResponse.fields.measures || [])
    ];
    const measureNames = new Set(queryResponse.fields.measures?.map(m => m.name) || []);

    if (lookerFields.length === 0) { return { columns: [], data: [] }; }

    let columns: any[] = lookerFields.map((field) => {
        const isMeasure = measureNames.has(field.name);

        return {
            id: field.name,
            name: field.label_short || field.label || field.name,
            sort: true,
            resizable: true,
            formatter: (cellValue: any, gridJsRowObject: any) => {
                let originalIndex: number | undefined;
                try {
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { /* ignore */ }
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { /* ignore */ }
                }
                if (originalIndex === undefined || originalIndex < 0 || originalIndex >= data.length) {
                    return html(String(cellValue ?? '[Render Error]'));
                }
                const lookerRow = data[originalIndex];
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] as Cell : undefined;
                if (!lookerCell) { return html(String(cellValue ?? '[No Cell Data]')); }

                const isMeasure = measureNames.has(field.name);
                let initialContent: string | HTMLElement;
                let finalContentString: string = '';
                let contentAlreadyHasLink = false;

                // --- Get initial content (using textForCell for dimensions) ---
                if (isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try { initialContent = LookerCharts.Utils.htmlForCell(lookerCell, undefined, field); }
                    catch (e) { initialContent = lookerCell.rendered ?? String(lookerCell.value ?? ''); }
                } else if (!isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.textForCell) {
                    initialContent = LookerCharts.Utils.textForCell(lookerCell);
                } else {
                    initialContent = String(lookerCell.value ?? '');
                }

                // --- Check for links and finalize contentString ---
                let potentialElement: HTMLElement | null = null;
                if (isHTMLElement(initialContent)) {
                    potentialElement = initialContent;
                    if (initialContent.tagName === 'A' || initialContent.querySelector('a')) { contentAlreadyHasLink = true; }
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span');
                        linkElement.classList.add('drillable');
                        linkElement.innerHTML = potentialElement.outerHTML;
                        linkElement.onclick = (event: MouseEvent) => { /* drill handler */
                            event.stopPropagation();
                            if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            }
                        };
                        finalContentString = linkElement.outerHTML;
                    } else { finalContentString = potentialElement.outerHTML; }
                } else {
                    const contentStr = String(initialContent);
                    if (isMeasure && contentStr.includes('<a')) { contentAlreadyHasLink = true; }
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span');
                        linkElement.classList.add('drillable');
                        linkElement.innerHTML = contentStr;
                        linkElement.onclick = (event: MouseEvent) => { /* drill handler */
                            event.stopPropagation();
                            if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            }
                        };
                        finalContentString = linkElement.outerHTML;
                    } else { finalContentString = contentStr; }
                }
                // --- End Link Handling ---

                // --- Sparkline Logic (Single Vertical Bar) ---
                let sparklineHtml = '';
                const cellVal = lookerCell.value;
                const numericValue = Number(cellVal);

                if (
                    isMeasure &&
                    config && config.showMeasureSparklines === true &&
                    typeof numericValue === 'number' &&
                    isFinite(numericValue) &&
                    measureMinMax &&
                    measureMinMax[field.name]
                ) {
                    const stats = measureMinMax[field.name];
                    const value = numericValue;
                    const range = stats.max - stats.min;
                    let relativeValue = 0;
                    if (range > 0) { relativeValue = (value - stats.min) / range; }
                    else if (value === stats.min) { relativeValue = 0.5; } // Or 1.0 for full bar
                    relativeValue = Math.max(0, Math.min(relativeValue, 1));
                    const barHeightPercent = Math.round(relativeValue * 100);

                    // <<< Generate SINGLE bar with inline height style >>>
                    sparklineHtml = `
                        <span class="sparkline-container" title="Value: ${value}\nRange: ${stats.min} - ${stats.max}">
                            <span class="sparkline-bar" style="height: ${barHeightPercent}%;"></span>
                        </span>
                    `;
                }
                // --- End Sparkline Logic ---

                // --- Combine content (wrapped) and sparkline ---
                // <<< Wrap finalContentString in cell-value span >>>
                const finalHtml = `<span class="cell-value">${finalContentString}</span>${sparklineHtml}`;

                return html(finalHtml);
            }
            // --- End of formatter function ---
        };
    });

    // Add Row Number Column if configured
    if (config?.showRowNumbers) { /* ... */
        columns.unshift({
            id: '_rowNum', name: '#', sort: false, resizable: false, width: '50px',
            formatter: (cell: any, gridJsRowObject: any) => {
                let originalIndex: number | undefined;
                try {
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { /* ignore */ }
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { /* ignore */ }
                }
                const displayIndex = originalIndex !== undefined ? originalIndex + 1 : '?';
                return html(`<span style="color:#999; user-select:none; font-size: 0.9em;">${displayIndex}</span>`);
            }
        });
    }

    // Add Hidden Index Column
    columns.push({ id: '_originalIndex', hidden: true });

    // Transform Row Data
    const gridData = data.map((lookerRow, originalIndex) => { /* ... */
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
