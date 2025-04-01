import {
    Looker, LookerChartUtils, VisualizationDefinition, VisConfig, VisQueryResponse, Row, Field, Cell, VisOptions, VisData
} from './types';
import { state, elements, updateCoreState, MeasureMinMax } from './state';
import { setupHTML, findElements } from './dom';
import { escapeRegExp } from './utils';
import { Grid, html, h } from 'gridjs';

// Declare Looker globals
declare var looker: Looker;
declare var LookerCharts: LookerChartUtils;

// --- State for Minimap Dragging ---
let isDraggingMinimap = false;
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;

// --- Type Predicate Helper ---
function isHTMLElement(value: any): value is HTMLElement {
    return typeof value === 'object' && value !== null && value.nodeType === 1;
}

// --- Other Helper Functions ---
// (Keep all existing helper functions: debounce, clearHighlight, highlightTextNodes, applyHighlight, updateMinimap, handleMinimapMouseDown, handleMinimapMouseMove, handleMinimapMouseUp, attachListeners)
// ...
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

/** Removes highlights from the grid AND minimap. */
function clearHighlight(): void {
    if (elements.gridJsContainer) {
        const marks = elements.gridJsContainer.querySelectorAll('mark.gridjs-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                // Replace mark with its text content
                parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
                parent.normalize(); // Merges adjacent text nodes
            }
        });
    }
    if (elements.minimapContainer) {
        const markers = elements.minimapContainer.querySelectorAll('.minimap-marker');
        markers.forEach(marker => marker.remove());
    }
}


/** Helper function to highlight text within text nodes of an element. */
function highlightTextNodes(element: Node, regex: RegExp): boolean {
    // Use TreeWalker to find all text nodes within the element
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    const nodesToProcess: Text[] = [];
    // Collect all relevant text nodes first to avoid issues with modifying the DOM while iterating
    while (node = walker.nextNode()) {
        // Ensure nodeValue is not null/empty and parent is not a MARK/SCRIPT/STYLE tag
        if (node.nodeValue?.trim() && node.parentElement && !['MARK', 'SCRIPT', 'STYLE'].includes(node.parentElement.nodeName)) {
            nodesToProcess.push(node as Text);
        }
    }

    let highlightsMade = false;
    nodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue || '';
        let match;
        let lastIndex = 0;
        const fragment = document.createDocumentFragment(); // Use a fragment to batch DOM changes
        regex.lastIndex = 0; // Reset regex state

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            // Create and add the <mark> element
            const mark = document.createElement('mark');
            mark.className = 'gridjs-highlight';
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = regex.lastIndex;
            highlightsMade = true;
            // Prevent infinite loops with zero-length matches (e.g., regex like /a*?/g)
            if (match[0].length === 0) {
                regex.lastIndex++;
            }
        }

        // If any highlights were made in this text node, replace the original node
        if (lastIndex > 0) {
            // Add any remaining text after the last match
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            // Replace the original text node with the fragment containing text and marks
            textNode.parentNode?.replaceChild(fragment, textNode);
        }
    });
    return highlightsMade; // Return true if any highlights were applied
}


/** Applies highlighting and updates the minimap. */
function applyHighlight(term: string | undefined): void {
    console.log(`ApplyHighlight called with term: "${term}"`);
    // --- Clear existing highlights first ---
    // Find all existing mark elements
    const marks = elements.gridJsContainer?.querySelectorAll('mark.gridjs-highlight');
    marks?.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            // Replace the mark with its text content
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            parent.normalize(); // Merge adjacent text nodes
        }
    });
    // --- End Clear ---

    const searchTerm = term?.trim();

    // Update minimap regardless of search term (to clear markers if term is empty)
    updateMinimap();

    if (!searchTerm || !elements.gridJsContainer) {
        console.log("Highlight skipped: No search term or grid container.");
        return; // Exit if no term or container
    }

    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) {
        console.error("Highlight skipped: grid wrapper not found.");
        return;
    }

    console.log(`Highlighting with regex for: "${searchTerm}"`);
    try {
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        // Target only the TD elements for applying highlights
        const tds = gridWrapper.querySelectorAll('td.gridjs-td');
        console.log(`Found ${tds.length} cells to check.`);
        let highlightsAppliedCount = 0;

        tds.forEach(td => {
            // Apply highlighting recursively within each cell
            if (highlightTextNodes(td, regex)) {
                highlightsAppliedCount++;
            }
        });
        console.log(`Applied highlights within ${highlightsAppliedCount} cells.`);
    } catch (e) {
        console.error("Error during highlight processing:", e);
    }

    console.log("Calling updateMinimap after applying highlights.");
    try {
        updateMinimap(); // Update minimap based on new highlights
    } catch (minimapError) {
        console.error("Error calling updateMinimap:", minimapError);
    }
}

/** Updates the Minimap based on highlights */
function updateMinimap(): void {
    if (!elements.minimapContainer || !elements.gridJsContainer) { return; }
    const minimap = elements.minimapContainer;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');

    // Clear existing markers first
    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    if (!gridWrapper) { return; } // Need wrapper to find highlights and scroll height
    const tableBody = gridWrapper.querySelector<HTMLElement>('.gridjs-tbody'); // Find tbody within wrapper
    if (!tableBody) { return; } // Need table body for row offsets

    const scrollHeight = gridWrapper.scrollHeight;
    const minimapHeight = minimap.offsetHeight;

    // If nothing to scroll or minimap isn't visible, exit
    if (scrollHeight <= gridWrapper.clientHeight || minimapHeight <= 0) { return; }

    // Find highlighted elements *within the grid wrapper*
    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    if (highlightedMarks.length === 0) { return; } // No highlights, no markers needed

    const processedRows = new Set<HTMLElement>(); // Avoid duplicate markers for same row

    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr'); // Find the parent row
        if (!(row instanceof HTMLElement) || processedRows.has(row)) { return; } // Skip if not found or already processed

        processedRows.add(row);

        // Calculate the vertical position of the row within the scrollable content
        const rowOffsetTop = row.offsetTop; // Offset relative to table/tbody
        const tableBodyOffsetTop = tableBody.offsetTop; // Offset of tbody within wrapper
        const totalOffset = rowOffsetTop + tableBodyOffsetTop; // Row's position within the scrollable wrapper

        // Calculate the proportional position on the minimap
        const markerTop = (totalOffset / scrollHeight) * minimapHeight;

        // Create and add the marker element
        const marker = document.createElement('div');
        marker.className = 'minimap-marker';
        // Clamp marker position to be within minimap bounds (accounting for marker height)
        marker.style.top = `${Math.max(0, Math.min(markerTop, minimapHeight - 2))}px`; // -2 for marker height
        minimap.appendChild(marker);
    });
}

// --- Minimap Drag Handlers ---

/** Handles the initial click on the minimap to start scrolling/dragging. */
function handleMinimapMouseDown(event: MouseEvent): void {
    // Ensure the necessary elements exist
    if (!elements.minimapContainer || !elements.gridJsContainer) return;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) return;

    event.preventDefault(); // Prevent default drag behavior (like text selection)
    isDraggingMinimap = true;
    elements.minimapContainer.classList.add('grabbing'); // Visual feedback: grabbing cursor

    const rect = elements.minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - rect.top; // Click position relative to minimap top
    const minimapHeight = elements.minimapContainer.offsetHeight;
    const scrollableHeight = gridWrapper.scrollHeight;
    const wrapperHeight = gridWrapper.clientHeight; // Visible height of the grid wrapper

    // Calculate initial scroll position based on the click location
    // Aim to position the view such that the clicked proportion matches the scroll proportion
    let targetScrollTop = (mouseY / minimapHeight) * (scrollableHeight - wrapperHeight);

    // Clamp the scroll position to valid bounds
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollableHeight - wrapperHeight));
    gridWrapper.scrollTop = targetScrollTop;


    // Define global listeners for move and up events
    // These need to be global so dragging continues even if the cursor leaves the minimap
    globalMouseMoveListener = (moveEvent: MouseEvent) => handleMinimapMouseMove(moveEvent);
    globalMouseUpListener = (upEvent: MouseEvent) => handleMinimapMouseUp(upEvent);

    // Add global listeners
    document.addEventListener('mousemove', globalMouseMoveListener);
    document.addEventListener('mouseup', globalMouseUpListener);
}

/** Handles mouse movement during minimap drag to update scroll position. */
function handleMinimapMouseMove(event: MouseEvent): void {
    // Only run if dragging is active and elements exist
    if (!isDraggingMinimap || !elements.minimapContainer || !elements.gridJsContainer) return;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) return;

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapHeight = elements.minimapContainer.offsetHeight;
    const scrollableHeight = gridWrapper.scrollHeight;
    const wrapperHeight = gridWrapper.clientHeight;

    // Calculate current mouse Y relative to minimap top, clamped within its bounds
    let mouseY = event.clientY - rect.top;
    mouseY = Math.max(0, Math.min(mouseY, minimapHeight)); // Clamp Y to minimap height

    // Calculate target scroll position based on the dragged proportion
    let targetScrollTop = (mouseY / minimapHeight) * (scrollableHeight - wrapperHeight);

    // Clamp the scroll position
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollableHeight - wrapperHeight));

    gridWrapper.scrollTop = targetScrollTop;
}

/** Handles mouse button release to stop minimap dragging. */
function handleMinimapMouseUp(event: MouseEvent): void {
    if (!isDraggingMinimap) return; // Only run if dragging was active
    isDraggingMinimap = false;
    elements.minimapContainer?.classList.remove('grabbing'); // Remove grabbing cursor style

    // Remove the global listeners that were added on mousedown
    if (globalMouseMoveListener) {
        document.removeEventListener('mousemove', globalMouseMoveListener);
        globalMouseMoveListener = null; // Clear reference
    }
    if (globalMouseUpListener) {
        document.removeEventListener('mouseup', globalMouseUpListener);
        globalMouseUpListener = null; // Clear reference
    }
}


/** Attaches event listeners for highlight input and minimap dragging. */
function attachListeners(): void {
    console.log("Attaching listeners...");

    // Highlight Input Listener
    if (elements.highlightInput) {
        const listenerKey = '__debouncedHighlightListener';
        // Check if listener already exists
        if (!(elements.highlightInput as any)[listenerKey]) {
            const debouncedHighlight = debounce((event: Event) => {
                const inputElement = event.target as HTMLInputElement;
                state.highlightTerm = inputElement.value;
                applyHighlight(state.highlightTerm); // Apply highlight and update minimap
            }, 250); // Debounce time

            elements.highlightInput.addEventListener('input', debouncedHighlight);
            (elements.highlightInput as any)[listenerKey] = debouncedHighlight; // Store listener reference
            console.log("Attached highlight input listener.");
        }
    } else {
        console.error("Cannot attach listener: Highlight input element not found.");
    }

    // Minimap Drag Listeners
    if (elements.minimapContainer) {
        const listenerKey = '__minimapMouseDownListener';
        // Clean up potential previous listener before adding a new one
        // This helps prevent duplicates if attachListeners is called multiple times
        const existingListener = (elements.minimapContainer as any)[listenerKey];
        if (existingListener) {
            elements.minimapContainer.removeEventListener('mousedown', existingListener);
        }

        // Add the new mousedown listener
        elements.minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);
        (elements.minimapContainer as any)[listenerKey] = handleMinimapMouseDown; // Store reference
        console.log("Attached minimap mousedown listener.");

        // Set initial cursor style for the minimap
        elements.minimapContainer.style.cursor = 'grab';

    } else {
        console.error("Cannot attach listener: Minimap container element not found.");
    }
}


// --- Grid.js Helper Function ---
/**
 * Transforms Looker data and query response into the format required by Grid.js.
 */
function transformLookerDataForGridJs(
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

    // Define Grid.js Columns configuration
    let columns: any[] = lookerFields.map((field) => {
        const isMeasure = measureNames.has(field.name);

        return {
            id: field.name,
            name: field.label_short || field.label || field.name,
            sort: true,
            resizable: true,
            // --- Corrected formatter function ---
            formatter: (cellValue: any, gridJsRowObject: any) => {
                // Find original index and Looker cell data
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
                    return html(String(cellValue ?? '[Render Error - Invalid Index]'));
                }
                const lookerRow = data[originalIndex];
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] as Cell : undefined;
                if (!lookerCell) { return html(String(cellValue ?? '[No Cell Data]')); }

                const isMeasure = measureNames.has(field.name);
                let initialContent: string | HTMLElement;
                let finalContentString: string = ''; // Initialize
                let contentAlreadyHasLink = false;

                // --- Step 1: Get initial content string or element ---
                // <<< Use textForCell for non-measures to avoid auto-links >>>
                if (isMeasure && typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try {
                        initialContent = LookerCharts.Utils.htmlForCell(lookerCell, undefined, field);
                    } catch (e) {
                        initialContent = lookerCell.rendered ?? String(lookerCell.value ?? '[Format Error]');
                        console.error(`Error using Looker htmlForCell for ${field.name}:`, e);
                    }
                } else if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.textForCell) {
                    // <<< Use textForCell for dimensions >>>
                    initialContent = LookerCharts.Utils.textForCell(lookerCell);
                }
                else {
                    // Fallback if textForCell isn't available
                    initialContent = lookerCell.rendered ?? String(lookerCell.value ?? '');
                }

                // --- Step 2: Check for links and finalize contentString ---
                let potentialElement: HTMLElement | null = null;
                if (isHTMLElement(initialContent)) { // Use type predicate
                    potentialElement = initialContent;
                    if (initialContent.tagName === 'A' || initialContent.querySelector('a')) {
                        contentAlreadyHasLink = true;
                    }
                    // Wrap if needed (only applies if initialContent was an element from htmlForCell)
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span');
                        linkElement.classList.add('drillable');
                        linkElement.innerHTML = potentialElement.outerHTML; // Safe
                        linkElement.onclick = (event: MouseEvent) => { /* ... drill handler ... */
                            event.stopPropagation();
                            if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            }
                        };
                        finalContentString = linkElement.outerHTML;
                    } else {
                        finalContentString = potentialElement.outerHTML; // Use original element HTML
                    }
                } else { // It's a string
                    const contentStr = String(initialContent);
                    if (contentStr.includes('<a')) {
                        contentAlreadyHasLink = true; // Link might exist in rendered/value string
                    }
                    // Wrap if needed (only measures)
                    if (!contentAlreadyHasLink && isMeasure && lookerCell.links && lookerCell.links.length > 0) {
                        const linkElement = document.createElement('span');
                        linkElement.classList.add('drillable');
                        linkElement.innerHTML = contentStr;
                        linkElement.onclick = (event: MouseEvent) => { /* ... drill handler ... */
                            event.stopPropagation();
                            if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            }
                        };
                        finalContentString = linkElement.outerHTML;
                    } else {
                        finalContentString = contentStr; // Use the string directly
                    }
                }
                // --- End Link Handling ---


                // --- Sparkline Logic (Histogram) ---
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
                    else if (value === stats.min) { relativeValue = 0.5; }
                    relativeValue = Math.max(0, Math.min(relativeValue, 1));

                    // Generate Histogram Bars
                    const numBars = 10;
                    const filledBars = Math.max(0, Math.round(relativeValue * numBars));
                    let barsHtml = '';
                    for (let i = 0; i < numBars; i++) {
                        const filledClass = i < filledBars ? 'sparkline-hist-bar--filled' : '';
                        barsHtml += `<span class="sparkline-hist-bar ${filledClass}"></span>`;
                    }

                    sparklineHtml = `
                        <span class="sparkline-container" title="Value: ${value}\nRange: ${stats.min} - ${stats.max}">
                            ${barsHtml}
                        </span>
                    `;
                    // <<< Add log to confirm generation >>>
                    console.log(`>>> Generated sparkline HTML for ${field.name}`);

                } else if (isMeasure && config?.showMeasureSparklines) {
                    // Optional: Log why sparkline was skipped for a measure if option is on
                    // console.log(`--- Skipped sparkline for ${field.name} (Value: ${cellVal}, Type: ${typeof cellVal}, MinMax: ${!!(measureMinMax && measureMinMax[field.name])})`);
                }
                // --- End Sparkline Logic ---

                // --- Combine final content string and sparkline string ---
                // <<< REMOVED cell-content-wrapper span >>>
                const finalHtml = `${finalContentString}${sparklineHtml}`;

                return html(finalHtml); // Return Grid.js compatible HTML
            }
            // --- End of formatter function ---
        };
    });

    // Add Row Number Column if configured
    if (config?.showRowNumbers) { /* ... row number config ... */
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
    const gridData = data.map((lookerRow, originalIndex) => { /* ... row data mapping ... */
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


// --- Looker Visualization Definition ---
const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs',
    label: 'Log Viewer (Grid.js)',
    options: { // Static options object
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
        showMeasureSparklines: { type: 'boolean', label: 'Show Sparklines for Measures', default: false, section: 'Display', order: 2 },
    },

    /** Create Method */
    create: function (element: HTMLElement, config: VisConfig) {
        // (Keep existing create implementation)
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);
            console.log("Create: HTML structure setup attempted.");
            setTimeout(() => {
                console.log("Create (setTimeout): Finding elements...");
                if (!findElements(element)) { /* error handling */ return; }
                console.log("Create (setTimeout): Elements found. Initializing Grid...");
                let grid: Grid | null = null;
                try {
                    grid = new Grid({ /* ... grid config ... */
                        columns: [], data: [], sort: { multiColumn: true }, search: true,
                        language: { 'search': { 'placeholder': 'Filter value...' } },
                        resizable: true, fixedHeader: true, pagination: false,
                        // @ts-ignore
                        autoHeight: false, width: '100%',
                    });
                    grid.render(elements.gridJsContainer!);
                    state.gridInstance = grid;
                    attachListeners(); // Attach listeners after grid is rendered
                    console.log("Log Viewer Vis (Grid.js): Create finished successfully (async part).");
                } catch (initError) { /* error handling */ state.gridInstance = null; }
            }, 0);
        } catch (error) { /* error handling */ }
    },

    /** UpdateAsync Method */
    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        // (Keep existing updateAsync implementation - includes preprocessing loop using static option)
        console.log("UpdateAsync: START. Grid instance:", state.gridInstance ? 'Exists' : 'NULL');
        const logError = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) { /* handle missing instance */ done(); return; }

        try {
            console.log("UpdateAsync: Checking elements...");
            if (!findElements(element)) { /* error handling */ done(); return; }
            console.log("UpdateAsync: Elements found.");

            console.log("UpdateAsync: Updating core state...");
            updateCoreState(data, queryResponse, config); // Update state
            console.log("UpdateAsync: Core state updated.");

            // Log raw field structure
            if (queryResponse?.fields?.measures?.[0]) {
                console.log("Inspecting first measure field:", queryResponse.fields.measures[0]);
            }
            if (queryResponse?.fields?.dimensions?.[0]) {
                console.log("Inspecting first dimension field:", queryResponse.fields.dimensions[0]);
            }

            // Preprocessing for Sparklines (Using Static Config)
            state.measureMinMax = {};
            if (config.showMeasureSparklines === true && queryResponse?.fields?.measures && data.length > 0) { // Use static option
                const measures = queryResponse.fields.measures;
                console.log(`Preprocessing sparkline data for ${measures.length} measures.`);
                measures.forEach(measureField => {
                    let minVal = Infinity, maxVal = -Infinity, hasNumeric = false;
                    data.forEach(row => {
                        const cellData = row[measureField.name];
                        const value = (cellData && typeof cellData === 'object' && 'value' in cellData) ? (cellData as Cell).value : cellData;
                        const numericValue = Number(value);
                        if (typeof numericValue === 'number' && isFinite(numericValue)) {
                            minVal = Math.min(minVal, numericValue);
                            maxVal = Math.max(maxVal, numericValue);
                            hasNumeric = true;
                        }
                    });
                    if (hasNumeric) { state.measureMinMax![measureField.name] = { min: minVal, max: maxVal }; }
                });
                console.log("Calculated Measure Min/Max:", state.measureMinMax);
            }

            console.log("UpdateAsync: Transforming data...");
            const { columns, data: gridData } = transformLookerDataForGridJs(
                state.originalData, state.queryResponse, state.config, state.measureMinMax
            );
            console.log(`UpdateAsync: Data transformed (${columns?.length} cols, ${gridData?.length} rows).`);

            const shouldClearGrid = (!columns || columns.length === 0) && (!gridData || gridData.length === 0);
            console.log(`UpdateAsync: Should clear grid? ${shouldClearGrid}`);

            console.log("UpdateAsync: Updating grid config...");
            state.gridInstance.updateConfig({ /* ... update config ... */
                columns: shouldClearGrid ? [] : columns, data: shouldClearGrid ? [] : gridData,
                search: true, language: { 'search': { 'placeholder': 'Filter value...' } },
                sort: { multiColumn: true }, resizable: true, fixedHeader: true, pagination: false,
                // @ts-ignore
                autoHeight: false, width: '100%',
            });
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            state.gridInstance.forceRender();
            console.log("UpdateAsync: forceRender called.");

            // Post-render actions
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                (window as any).__logged_sparkline_gen = {}; // Reset log flags
                (window as any).__logged_sparkline = {};
                try { applyHighlight(state.highlightTerm); }
                catch (highlightError) { logError("Error during post-render highlight/minimap update:", highlightError); }
                finally { console.log("UpdateAsync: setTimeout callback calling done()."); done(); }
            }, 50);

        } catch (err) {
            logError(`UpdateAsync: CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`, err);
            if (err instanceof Error) { console.error(err.stack); }
            done();
        }
    },

    // Add Empty trigger function
    trigger: (event: string, config: any[]) => {
        console.log("Vis Triggered:", event, config);
    },
};

// Register the visualization with Looker
looker.plugins.visualizations.add(visDefinition);

// Add CSS for the grabbing cursor dynamically
const grabbingStyle = document.createElement('style');
grabbingStyle.textContent = ` #gridjs-minimap.grabbing { cursor: grabbing !important; } `;
if (document.head) { document.head.appendChild(grabbingStyle); }
else { document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(grabbingStyle); }); }

