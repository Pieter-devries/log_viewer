import {
    Looker, LookerChartUtils, VisualizationDefinition, VisConfig, QueryResponse, Row, Field, Cell
} from './types';
import { state, elements, updateCoreState } from './state';
import { setupHTML, findElements } from './dom'; // Removed helper imports from dom.ts
import { escapeRegExp } from './utils'; // Import utility
import { Grid, html, h } from 'gridjs';

// Declare Looker globals
declare var looker: Looker;
declare var LookerCharts: LookerChartUtils;

// --- Moved Helper Functions ---

/** Debounce utility function */
function debounce(func: (...args: any[]) => void, wait: number): (...args: any[]) => void {
    let timeout: number | undefined;
    const executedFunction = (...args: any[]): void => {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = window.setTimeout(later, wait);
    };
    return executedFunction;
}

/** Attaches event listeners */
function attachListeners(): void {
    console.log("Attaching listeners...");
    if (elements.highlightInput) {
        const debouncedHighlight = debounce((event: Event) => {
            const inputElement = event.target as HTMLInputElement;
            state.highlightTerm = inputElement.value;
            applyHighlight(state.highlightTerm);
        }, 250);
        const listenerKey = '__debouncedHighlightListener';
        if (!(elements.highlightInput as any)[listenerKey]) {
            elements.highlightInput.addEventListener('input', debouncedHighlight);
            (elements.highlightInput as any)[listenerKey] = debouncedHighlight;
            console.log("Attached highlight input listener.");
        }
    } else {
        console.error("Cannot attach listener: Highlight input element not found.");
    }
}

/** Removes highlights from the grid AND minimap. */
function clearHighlight(): void {
    // Implementation moved from dom.ts
    if (elements.gridJsContainer) {
        const marks = elements.gridJsContainer.querySelectorAll('mark.gridjs-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
                parent.normalize();
            }
        });
    }
    if (elements.minimapContainer) {
        elements.minimapContainer.innerHTML = '';
    }
}

/** Helper function to highlight text within text nodes of an element. */
function highlightTextNodes(element: Node, regex: RegExp): boolean {
    // Implementation moved from dom.ts
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    const nodesToProcess: Text[] = [];
    while (node = walker.nextNode()) {
        if (node.parentElement && node.parentElement.nodeName !== 'MARK' && node.parentElement.nodeName !== 'SCRIPT' && node.parentElement.nodeName !== 'STYLE') {
            nodesToProcess.push(node as Text);
        }
    }
    let highlightsMade = false;
    nodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue || '';
        let match; let lastIndex = 0;
        const fragment = document.createDocumentFragment();
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) { fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index))); }
            const mark = document.createElement('mark');
            mark.className = 'gridjs-highlight';
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = regex.lastIndex;
            highlightsMade = true;
        }
        if (lastIndex > 0) {
            if (lastIndex < text.length) { fragment.appendChild(document.createTextNode(text.substring(lastIndex))); }
            textNode.parentNode?.replaceChild(fragment, textNode);
        }
    });
    return highlightsMade;
}


/** Applies highlighting and updates the minimap. */
function applyHighlight(term: string | undefined): void {
    // Implementation moved from dom.ts
    console.log(`ApplyHighlight called with term: "${term}"`);
    clearHighlight();
    const searchTerm = term?.trim();
    if (!searchTerm || !elements.gridJsContainer) { console.log("Highlight skipped: No search term or grid container."); updateMinimap(); return; }
    const gridWrapper = elements.gridJsContainer.querySelector('.gridjs-wrapper');
    if (!gridWrapper) { console.error("Highlight skipped: grid wrapper not found."); return; }
    console.log(`Highlighting (robust) with regex for: "${searchTerm}"`);
    try {
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        const tds = gridWrapper.querySelectorAll('td.gridjs-td');
        console.log(`Found ${tds.length} cells to check.`);
        let highlightsAppliedCount = 0;
        tds.forEach(td => { if (highlightTextNodes(td, regex)) { highlightsAppliedCount++; } });
        console.log(`Applied highlights within ${highlightsAppliedCount} cells.`);
    } catch (e) { console.error("Error during highlight processing:", e); }
    console.log("Calling updateMinimap after applying highlights.");
    try { updateMinimap(); } catch (minimapError) { console.error("Error calling updateMinimap:", minimapError); }
}

/** Updates the Minimap based on highlights */
function updateMinimap(): void {
    // Implementation moved from dom.ts
    if (!elements.minimapContainer || !elements.gridJsContainer) { return; }
    const minimap = elements.minimapContainer;
    const gridWrapper = elements.gridJsContainer.querySelector('.gridjs-wrapper');
    const tableBody = gridWrapper?.querySelector('.gridjs-tbody');
    minimap.innerHTML = '';
    if (!(tableBody instanceof HTMLElement) || !gridWrapper) { return; }
    const scrollHeight = gridWrapper.scrollHeight;
    const minimapHeight = minimap.offsetHeight;
    if (scrollHeight <= 0 || minimapHeight <= 0) { return; }
    if (!state.highlightTerm?.trim()) { return; }

    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    const processedRows = new Set<HTMLElement>();
    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr');
        if (!(row instanceof HTMLElement) || processedRows.has(row)) { return; }
        processedRows.add(row);
        const rowOffsetTop = row.offsetTop;
        const tableBodyOffsetTop = tableBody.offsetTop;
        const totalOffset = rowOffsetTop + tableBodyOffsetTop;
        const markerTop = (totalOffset / scrollHeight) * minimapHeight;
        const marker = document.createElement('div');
        marker.className = 'minimap-marker';
        marker.style.top = `${Math.max(0, Math.min(markerTop, minimapHeight - 2))}px`;
        minimap.appendChild(marker);
    });
}


// --- Grid.js Helper Function ---
function transformLookerDataForGridJs(data: Row[], queryResponse: QueryResponse | null, config: VisConfig | null): { columns: any[], data: any[][] } {
    if (!queryResponse || !queryResponse.fields) {
        console.warn("transformLookerDataForGridJs: No queryResponse or queryResponse.fields found.");
        return { columns: [], data: [] };
    }
    const lookerFields: Field[] = [...(queryResponse.fields.dimensions || []), ...(queryResponse.fields.measures || [])];
    if (lookerFields.length === 0) {
        console.warn("transformLookerDataForGridJs: No dimensions or measures found.");
        return { columns: [], data: [] };
    }

    // Define Grid.js Columns from Looker fields
    let columns: any[] = lookerFields.map((field) => {
        // <<< Restore full column definition >>>
        return {
            id: field.name, name: field.label_short || field.label || field.name,
            sort: true, resizable: true,
            formatter: (cellValue: any, gridJsRowObject: any) => {
                let originalIndex: number | undefined;
                try {
                    const indexCell = gridJsRowObject.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { console.error("Error finding index cell by ID", e); }
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { console.error("Error finding index via last cell", e); }
                }
                if (originalIndex === undefined || originalIndex < 0 || originalIndex >= data.length) {
                    return html(String(cellValue ?? '[Render Error]'));
                }
                const lookerRow = data[originalIndex];
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] : undefined;
                if (!lookerCell) { return html(String(cellValue ?? '[No Cell Data]')); }

                let content: string | HTMLElement = cellValue ?? '[NULL]';
                if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try {
                        content = LookerCharts.Utils.htmlForCell(lookerCell);
                        if (lookerCell.links && lookerCell.links.length > 0 && typeof content === 'string' && !content.includes('<a')) {
                            const linkElement = document.createElement('span');
                            linkElement.classList.add('drillable'); linkElement.innerHTML = content;
                            linkElement.onclick = (event: MouseEvent) => {
                                event.stopPropagation(); LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            };
                            content = linkElement;
                        }
                    } catch (e) {
                        console.error(`Error using Looker htmlForCell for ${field.name}:`, e);
                        content = lookerCell.rendered ?? String(lookerCell.value ?? '[Format Error]');
                    }
                } else if (lookerCell.rendered) { content = lookerCell.rendered; }

                if (!(content instanceof HTMLElement) && lookerCell.links && lookerCell.links.length > 0) {
                    const linkElement = document.createElement('span');
                    linkElement.classList.add('drillable'); linkElement.innerHTML = String(content);
                    linkElement.onclick = (event: MouseEvent) => {
                        event.stopPropagation();
                        if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                            LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                        } else { console.error("LookerCharts.Utils.openDrillMenu is not available."); }
                    };
                    return html(linkElement.outerHTML);
                }
                return (content instanceof HTMLElement) ? h(content.tagName.toLowerCase(), { dangerouslySetInnerHTML: { __html: content.outerHTML } }) : html(String(content));
            }
        };
    });

    // Add Row Number Column Definition if configured
    if (config?.showRowNumbers) {
        // <<< Restore full row number column definition >>>
        columns.unshift({
            id: '_rowNum', name: '#', sort: false, resizable: false, width: '50px',
            formatter: (cell: any, gridJsRowObject: any) => {
                let originalIndex: number | undefined;
                try { const indexCell = gridJsRowObject.cells.find((c: any) => c.column?.id === '_originalIndex'); originalIndex = indexCell?.data; }
                catch (e) { console.error("Error finding index cell in row num formatter", e); }
                if (originalIndex === undefined) {
                    try { originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data; }
                    catch (e) { console.error("Error finding index via last cell in row num formatter", e); }
                }
                return html(`<span style="color:#999; user-select:none; font-size: 0.9em;">${originalIndex !== undefined ? originalIndex + 1 : '?'}</span>`);
            }
        });
    }

    // Add Hidden Index Column Definition
    columns.push({ id: '_originalIndex', hidden: true });

    // --- Transform Looker Row data ---
    const gridData = data.map((lookerRow, originalIndex) => {
        // <<< Restore full rowData creation logic >>>
        const rowData: any[] = lookerFields.map(field => lookerRow[field.name]?.value);
        if (config?.showRowNumbers) { rowData.unshift(null); }
        rowData.push(originalIndex);
        return rowData; // Ensure rowData is returned
    });

    // Ensure the function always returns the object
    return { columns, data: gridData as any[][] };
}


// --- Looker Visualization Definition ---
const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs', label: 'Log Viewer (Grid.js)',
    options: {
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
    },

    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);
            console.log("Create: HTML structure setup attempted.");

            setTimeout(() => {
                console.log("Create (setTimeout): Finding elements...");
                if (!findElements(element)) {
                    console.error("Create (setTimeout): Critical elements not found. Cannot initialize grid.");
                    element.innerHTML = `<div style='color:red; padding:10px;'>Error: Visualization container structure could not be found.</div>`;
                    return;
                }
                console.log("Create (setTimeout): Elements found. Initializing Grid...");

                let grid: Grid | null = null;
                try {
                    grid = new Grid({
                        columns: [], data: [],
                        sort: { multiColumn: true }, search: true,
                        language: { 'search': { 'placeholder': 'Filter value...' } },
                        resizable: true, fixedHeader: false, pagination: false,
                        width: '100%',
                        // height: '100%',　// THIS DESTROYS THE VERTICAL SCROLL!!
                    });
                    console.log("Create (setTimeout): Grid instance created:", grid);
                    grid.render(elements.gridJsContainer!);
                    console.log("Create (setTimeout): Grid rendered.");
                    state.gridInstance = grid;
                    console.log("Create (setTimeout): Stored grid instance:", state.gridInstance);
                    attachListeners(); // Uses helpers defined in this file now
                    console.log("Create (setTimeout): Listeners attached.");
                    console.log("Log Viewer Vis (Grid.js): Create finished successfully (async part).");
                } catch (initError) {
                    console.error("!!!! Create (setTimeout): Error initializing or rendering Grid.js !!!!", initError);
                    const errorMsg = initError instanceof Error ? initError.message : String(initError);
                    const container = elements.gridJsContainer || element;
                    container.innerHTML = `<p style="color:red; padding: 10px;">Init Error: ${errorMsg}</p>`;
                    state.gridInstance = null;
                }
            }, 0);

        } catch (error) {
            console.error("Error during visualization creation (setupHTML):", error);
            element.innerHTML = `<div style="color:red; padding:10px;">Create Error: ${error instanceof Error ? error.message : String(error)}</div>`;
        }
    },

    updateAsync: function (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START. state.gridInstance:", state.gridInstance);
        const error = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) {
            console.warn("UpdateAsync: Grid instance not ready yet. Skipping update cycle.");
            done(); return;
        }

        try {
            console.log("UpdateAsync: Checking elements...");
            if (!findElements(element)) { error("Update Error: Critical elements missing during update."); done(); return; }
            console.log("UpdateAsync: Elements found.");
            // attachListeners(); // Re-attaching might cause duplicate listeners if DOM isn't fully replaced

            console.log("UpdateAsync: Updating core state...");
            updateCoreState(data, queryResponse, config);
            console.log("UpdateAsync: Core state updated.");

            console.log("UpdateAsync: Transforming data...");
            const { columns, data: gridData } = transformLookerDataForGridJs(state.originalData, state.queryResponse, state.config);
            console.log(`UpdateAsync: Data transformed (${columns?.length} cols, ${gridData?.length} rows).`);
            const shouldClearGrid = (!columns || columns.length === 0) && gridData.length === 0;
            console.log(`UpdateAsync: Should clear grid? ${shouldClearGrid}`);

            console.log("UpdateAsync: Updating grid config...");
            state.gridInstance.updateConfig({
                columns: shouldClearGrid ? [] : columns,
                data: shouldClearGrid ? [] : gridData,
                search: true, language: { 'search': { 'placeholder': 'Filter value...' } },
                sort: { multiColumn: true }, resizable: true, fixedHeader: true, pagination: false,
                width: '100%',
                // height: '100%',
            });
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            state.gridInstance.forceRender();
            console.log("UpdateAsync: forceRender called.");

            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try {
                    applyHighlight(state.highlightTerm);
                } catch (highlightError) {
                    error("Error during post-render highlight/minimap update:", highlightError);
                } finally {
                    console.log("UpdateAsync: setTimeout callback calling done().");
                    done();
                }
            }, 50);

        } catch (err) {
            error(`UpdateAsync: CAUGHT ERROR during update logic: ${err instanceof Error ? err.message : String(err)}`, err);
            if (err instanceof Error) { console.error(err.stack); }
            done();
        }
    }
};

// Register the visualization with Looker
looker.plugins.visualizations.add(visDefinition);
