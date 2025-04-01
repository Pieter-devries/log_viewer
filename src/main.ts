import {
    Looker, LookerChartUtils, VisualizationDefinition, VisConfig, QueryResponse, Row, Field, Cell
} from './types';
import { state, elements, updateCoreState } from './state';
import { setupHTML, findElements } from './dom';
import { escapeRegExp } from './utils';
import { Grid, html, h } from 'gridjs';

// Declare Looker globals
declare var looker: Looker;
declare var LookerCharts: LookerChartUtils;

// --- State for Minimap Dragging ---
let isDraggingMinimap = false;
// Store references to global listeners to remove them later
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;


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

/** Removes highlights from the grid AND minimap. */
function clearHighlight(): void {
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
        // Clear only markers, not the container itself if it has structure
        const markers = elements.minimapContainer.querySelectorAll('.minimap-marker');
        markers.forEach(marker => marker.remove());
    }
}

/** Helper function to highlight text within text nodes of an element. */
function highlightTextNodes(element: Node, regex: RegExp): boolean {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    const nodesToProcess: Text[] = [];
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
        const fragment = document.createDocumentFragment();
        // Reset regex state for each node
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            // Create and add the highlight mark
            const mark = document.createElement('mark');
            mark.className = 'gridjs-highlight';
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = regex.lastIndex;
            highlightsMade = true;
            // Prevent infinite loops with zero-length matches
            if (match[0].length === 0) {
                regex.lastIndex++;
            }
        }

        // If matches were found, replace the original text node
        if (lastIndex > 0) {
            // Add any remaining text after the last match
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            textNode.parentNode?.replaceChild(fragment, textNode);
        }
    });
    return highlightsMade;
}


/** Applies highlighting and updates the minimap. */
function applyHighlight(term: string | undefined): void {
    console.log(`ApplyHighlight called with term: "${term}"`);
    clearHighlight(); // Clear previous highlights and markers
    const searchTerm = term?.trim();

    if (!searchTerm || !elements.gridJsContainer) {
        console.log("Highlight skipped: No search term or grid container.");
        updateMinimap(); // Still update minimap (to ensure it's clear)
        return;
    }

    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) {
        console.error("Highlight skipped: grid wrapper not found.");
        return;
    }

    console.log(`Highlighting with regex for: "${searchTerm}"`);
    try {
        // Create regex (case-insensitive, global)
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        const tds = gridWrapper.querySelectorAll('td.gridjs-td'); // Target only data cells
        console.log(`Found ${tds.length} cells to check.`);
        let highlightsAppliedCount = 0;

        tds.forEach(td => {
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
        return {
            id: field.name,
            name: field.label_short || field.label || field.name,
            sort: true,
            resizable: true,
            formatter: (cellValue: any, gridJsRowObject: any) => {
                // Find the original Looker row index (stored in a hidden column)
                let originalIndex: number | undefined;
                try {
                    // Prefer finding by ID for robustness
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { console.error("Error finding index cell by ID", e); }

                // Fallback to assuming last cell if ID search fails (less robust)
                if (originalIndex === undefined) {
                    try {
                        originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data;
                    } catch (e) { console.error("Error finding index via last cell", e); }
                }

                // Validate index and get original Looker row/cell
                if (originalIndex === undefined || originalIndex < 0 || originalIndex >= data.length) {
                    // Handle cases where index is invalid - render raw value or error placeholder
                    return html(String(cellValue ?? '[Render Error - Invalid Index]'));
                }
                const lookerRow = data[originalIndex];
                const lookerCell: Cell | undefined = lookerRow ? lookerRow[field.name] : undefined;

                if (!lookerCell) {
                    // Handle cases where cell data is missing for the field
                    return html(String(cellValue ?? '[No Cell Data]'));
                }

                // --- Cell Rendering Logic ---
                let content: string | HTMLElement = cellValue ?? '[NULL]'; // Default to raw value or placeholder

                // Use Looker's HTML rendering if available
                if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.htmlForCell) {
                    try {
                        content = LookerCharts.Utils.htmlForCell(lookerCell);
                        // Check if Looker added links AND if the content is just plain text (no <a> tag yet)
                        // If so, wrap it to make it clickable for drilling
                        if (lookerCell.links && lookerCell.links.length > 0 && typeof content === 'string' && !content.includes('<a')) {
                            const linkElement = document.createElement('span');
                            linkElement.classList.add('drillable');
                            linkElement.innerHTML = content; // Use Looker's formatted HTML
                            linkElement.onclick = (event: MouseEvent) => {
                                event.stopPropagation(); // Prevent grid row click events
                                LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                            };
                            content = linkElement; // Replace content with the clickable span
                        }
                    } catch (e) {
                        console.error(`Error using Looker htmlForCell for ${field.name}:`, e);
                        // Fallback to rendered or value if Looker's function fails
                        content = lookerCell.rendered ?? String(lookerCell.value ?? '[Format Error]');
                    }
                } else if (lookerCell.rendered) {
                    // Use Looker's basic rendered string if htmlForCell isn't available
                    content = lookerCell.rendered;
                }

                // If content is still a string and there are links, wrap it for drilling
                // (This handles cases where htmlForCell wasn't used or didn't add the link wrapper)
                if (!(content instanceof HTMLElement) && lookerCell.links && lookerCell.links.length > 0) {
                    const linkElement = document.createElement('span');
                    linkElement.classList.add('drillable');
                    linkElement.innerHTML = String(content); // Use the determined content string
                    linkElement.onclick = (event: MouseEvent) => {
                        event.stopPropagation();
                        if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                            LookerCharts.Utils.openDrillMenu({ links: lookerCell.links!, event });
                        } else {
                            console.error("LookerCharts.Utils.openDrillMenu is not available.");
                        }
                    };
                    // Use Grid.js html() to render the outerHTML of the created span
                    return html(linkElement.outerHTML);
                }

                // Return content: Use Grid.js h() for existing HTML elements, html() for strings
                return (content instanceof HTMLElement)
                    ? h(content.tagName.toLowerCase(), { dangerouslySetInnerHTML: { __html: content.outerHTML } })
                    : html(String(content)); // Ensure content is stringified
            }
        };
    });

    // Add Row Number Column Definition if configured
    if (config?.showRowNumbers) {
        columns.unshift({
            id: '_rowNum',
            name: '#',
            sort: false, // Row numbers shouldn't be sortable
            resizable: false, // Fixed width
            width: '50px',
            formatter: (cell: any, gridJsRowObject: any) => {
                // Find the original Looker row index (stored in a hidden column)
                let originalIndex: number | undefined;
                try {
                    const indexCell = gridJsRowObject?.cells.find((c: any) => c.column?.id === '_originalIndex');
                    originalIndex = indexCell?.data;
                } catch (e) { console.error("Error finding index cell in row num formatter", e); }
                if (originalIndex === undefined) {
                    try {
                        originalIndex = gridJsRowObject?.cells[gridJsRowObject.cells.length - 1]?.data;
                    } catch (e) { console.error("Error finding index via last cell in row num formatter", e); }
                }
                // Display 1-based row number
                const displayIndex = originalIndex !== undefined ? originalIndex + 1 : '?';
                return html(`<span style="color:#999; user-select:none; font-size: 0.9em;">${displayIndex}</span>`);
            }
        });
    }

    // Add Hidden Index Column Definition - Crucial for linking back to original data
    columns.push({
        id: '_originalIndex',
        hidden: true // This column won't be visible to the user
    });

    // --- Transform Looker Row data ---
    const gridData = data.map((lookerRow, originalIndex) => {
        // Map Looker fields to an array for the Grid.js row
        const rowData: any[] = lookerFields.map(field => lookerRow[field.name]?.value); // Get raw value

        // Add placeholder for row number if enabled (unshift adds to beginning)
        if (config?.showRowNumbers) {
            rowData.unshift(null); // Value doesn't matter, formatter uses index
        }

        // Add the original index to the end of the row data (for the hidden column)
        rowData.push(originalIndex);
        return rowData;
    });

    return { columns, data: gridData as any[][] };
}


// --- Looker Visualization Definition ---
const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs', // Unique ID for the visualization
    label: 'Log Viewer (Grid.js)', // Display name in Looker
    options: { // User-configurable options
        showRowNumbers: {
            type: 'boolean',
            label: 'Show Row Numbers',
            default: true,
            section: 'Display', // Group options in UI
            order: 1
        },
        // Add other options here if needed
    },

    /**
     * Called by Looker to create the visualization instance.
     * Sets up the initial HTML and initializes the Grid.js instance.
     */
    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            // Set up the basic HTML structure and CSS
            setupHTML(element);
            console.log("Create: HTML structure setup attempted.");

            // Defer Grid.js initialization until the DOM is ready
            setTimeout(() => {
                console.log("Create (setTimeout): Finding elements...");
                if (!findElements(element)) {
                    console.error("Create (setTimeout): Critical elements not found. Cannot initialize grid.");
                    element.innerHTML = `<div style='color:red; padding:10px;'>Error: Visualization container structure could not be found. Check CSS selectors.</div>`;
                    return;
                }
                console.log("Create (setTimeout): Elements found. Initializing Grid...");

                let grid: Grid | null = null;
                try {
                    // Initialize Grid.js with configuration
                    grid = new Grid({
                        columns: [], // Will be populated by updateAsync
                        data: [],    // Will be populated by updateAsync
                        sort: { multiColumn: true }, // Enable multi-column sorting
                        search: true, // Enable global search
                        language: { 'search': { 'placeholder': 'Filter value...' } },
                        resizable: true, // Allow column resizing
                        fixedHeader: true, // Keep header visible (relies on CSS for scrolling)
                        pagination: false, // Disable pagination
                        // @ts-ignore - autoHeight might not be in standard types but can exist
                        autoHeight: false, // Rely on CSS for height
                        width: '100%', // Grid takes full width of its container
                        // height: '100%', // <<< REMOVED - Rely on CSS absolute positioning for wrapper height
                    });
                    console.log("Create (setTimeout): Grid instance created:", grid);

                    // Render the grid into its container element
                    grid.render(elements.gridJsContainer!);
                    console.log("Create (setTimeout): Grid rendered.");

                    // Store the grid instance in state for later updates
                    state.gridInstance = grid;
                    console.log("Create (setTimeout): Stored grid instance:", state.gridInstance);

                    // Attach event listeners (highlight, minimap drag)
                    attachListeners();
                    console.log("Create (setTimeout): Listeners attached.");

                    console.log("Log Viewer Vis (Grid.js): Create finished successfully (async part).");

                } catch (initError) {
                    console.error("!!!! Create (setTimeout): Error initializing or rendering Grid.js !!!!", initError);
                    const errorMsg = initError instanceof Error ? initError.message : String(initError);
                    // Display error within the visualization container if possible
                    const container = elements.gridJsContainer || element;
                    container.innerHTML = `<p style="color:red; padding: 10px;">Grid Initialization Error: ${errorMsg}</p>`;
                    state.gridInstance = null; // Ensure instance is null on error
                }
            }, 0); // setTimeout 0 ensures this runs after current execution stack

        } catch (error) {
            console.error("Error during visualization creation (setupHTML):", error);
            element.innerHTML = `<div style="color:red; padding:10px;">Create Error: ${error instanceof Error ? error.message : String(error)}</div>`;
        }
    },

    /**
     * Called by Looker when data or configuration changes.
     * Updates the Grid.js instance with new data and configuration.
     */
    updateAsync: function (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START. Grid instance:", state.gridInstance ? 'Exists' : 'NULL');
        const logError = (message: string, err?: any) => {
            console.error(message, err);
            // Optionally use Looker's error reporting:
            // this.addError?.({ title: 'Update Error', message: message });
        };

        // Ensure the grid instance exists (might not if create failed or is pending)
        if (!state.gridInstance) {
            console.warn("UpdateAsync: Grid instance not ready yet. Skipping update cycle.");
            done(); // Signal completion
            return;
        }

        try {
            console.log("UpdateAsync: Checking elements...");
            // Re-find elements in case the DOM was manipulated externally (less likely here)
            if (!findElements(element)) {
                logError("Update Error: Critical elements missing during update.");
                done();
                return;
            }
            console.log("UpdateAsync: Elements found.");

            // Re-attach listeners *only if* necessary. If setupHTML doesn't run again,
            // and the core elements (#gridjs-container, #highlight-input, #gridjs-minimap) persist,
            // then re-attaching might create duplicates. Usually safe to attach only in create.
            // If drag/highlight stops working after updates, uncomment below.
            // attachListeners();

            console.log("UpdateAsync: Updating core state...");
            updateCoreState(data, queryResponse, config); // Update shared state
            console.log("UpdateAsync: Core state updated.");

            console.log("UpdateAsync: Transforming data...");
            // Transform Looker data into Grid.js format
            const { columns, data: gridData } = transformLookerDataForGridJs(state.originalData, state.queryResponse, state.config);
            console.log(`UpdateAsync: Data transformed (${columns?.length} cols, ${gridData?.length} rows).`);

            // Determine if the grid should be cleared (no columns/data)
            const shouldClearGrid = (!columns || columns.length === 0) && (!gridData || gridData.length === 0);
            console.log(`UpdateAsync: Should clear grid? ${shouldClearGrid}`);

            console.log("UpdateAsync: Updating grid config...");
            // Update the Grid.js instance configuration with new columns and data
            state.gridInstance.updateConfig({
                columns: shouldClearGrid ? [] : columns,
                data: shouldClearGrid ? [] : gridData,
                // Re-apply other necessary config options
                search: true,
                language: { 'search': { 'placeholder': 'Filter value...' } },
                sort: { multiColumn: true },
                resizable: true,
                fixedHeader: true, // Keep header fixed
                pagination: false,
                // @ts-ignore
                autoHeight: false, // Rely on CSS
                width: '100%',
                // height: '100%', // <<< REMOVED
            });
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            // Force Grid.js to re-render with the updated configuration
            state.gridInstance.forceRender();
            console.log("UpdateAsync: forceRender called.");

            // Apply highlighting and update minimap *after* rendering is likely complete
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try {
                    // Re-apply highlight based on current term in state
                    applyHighlight(state.highlightTerm);
                } catch (highlightError) {
                    logError("Error during post-render highlight/minimap update:", highlightError);
                } finally {
                    console.log("UpdateAsync: setTimeout callback calling done().");
                    done(); // Signal Looker that the update is complete
                }
            }, 50); // Small delay to allow DOM updates

        } catch (err) {
            logError(`UpdateAsync: CAUGHT ERROR during update logic: ${err instanceof Error ? err.message : String(err)}`, err);
            if (err instanceof Error) { console.error(err.stack); }
            done(); // Ensure done() is called even on error
        }
    }
    // Add other lifecycle methods like destroy if needed
    // destroy: function() { ... }
};

// Register the visualization with Looker
looker.plugins.visualizations.add(visDefinition);

// Add CSS for the grabbing cursor dynamically
// This ensures the style is available regardless of CSS load order
const grabbingStyle = document.createElement('style');
grabbingStyle.textContent = `
  #gridjs-minimap.grabbing {
    cursor: grabbing !important; /* Use grabbing cursor during drag */
  }
`;
// Append the style element to the document's head
if (document.head) {
    document.head.appendChild(grabbingStyle);
} else {
    // Fallback if head isn't ready immediately (less likely)
    document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(grabbingStyle);
    });
}

