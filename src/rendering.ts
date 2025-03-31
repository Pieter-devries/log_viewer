import { state, elements } from './state';
import { Field, Row, LookerChartUtils, Cell } from './types';
import { applyHighlight } from './highlighting';
import { updateThumb } from './minimap';

// Declare global LookerCharts utility
declare var LookerCharts: LookerChartUtils;

// --- Helper Functions for Rendering ---

/**
 * Filters the data based on the current filter settings in the state.
 * @param data - The original data array.
 * @returns The filtered data array.
 */
function filterData(data: Row[]): Row[] {
    if (!elements.filterInput) return data; // Should not happen if checks pass

    let filterValue = elements.filterInput.value;
    if (!filterValue) {
        return data; // No filter applied
    }

    // Adjust filter value based on case sensitivity state
    if (!state.filterCaseSensitive) {
        filterValue = filterValue.toLowerCase();
    }

    const selectedFieldName = state.selectedFieldName;
    const fieldsToSearch = (state.queryResponse?.fields)
        ? [...(state.queryResponse.fields.dimensions || []), ...(state.queryResponse.fields.measures || [])]
        : [];

    if (fieldsToSearch.length === 0) return data; // No fields to filter on

    try {
        return data.filter(row => {
            const checkMatch = (field: Field): boolean => {
                const cell = row[field.name];
                let cellValueStr = cell?.value?.toString();
                if (cellValueStr == null) return false; // Skip null/undefined values

                // Adjust cell value based on case sensitivity state
                if (!state.filterCaseSensitive) {
                    cellValueStr = cellValueStr.toLowerCase();
                }
                return cellValueStr.includes(filterValue);
            };

            if (selectedFieldName === 'all') {
                // Check all fields
                return fieldsToSearch.some(checkMatch);
            } else {
                // Check only the selected field
                const selectedField = fieldsToSearch.find(f => f.name === selectedFieldName);
                return selectedField ? checkMatch(selectedField) : false;
            }
        });
    } catch (filterError) {
        console.error("Error during data filtering:", filterError);
        return data; // Return original data on error
    }
}

/**
 * Creates the document fragment for the log header row.
 * @param fieldsToRender - Array of fields to include in the header.
 * @returns A DocumentFragment containing the header elements.
 */
function renderHeaderContent(fieldsToRender: Field[]): DocumentFragment {
    const headerFragment = document.createDocumentFragment();

    // Add row number header if enabled
    if (state.showRowNumbers) {
        const rowNumHeader = document.createElement('div');
        rowNumHeader.className = 'log-header-cell log-row-num-header';
        rowNumHeader.textContent = '#';
        headerFragment.appendChild(rowNumHeader);
    }

    // Add headers for each field
    fieldsToRender.forEach((field, fieldIndex) => {
        // Add separator before fields other than the first one
        if (fieldIndex > 0) {
            const sepHeader = document.createElement('div');
            sepHeader.className = 'log-header-separator';
            sepHeader.textContent = '|'; // Use '|' for consistency
            headerFragment.appendChild(sepHeader);
        }

        // Create header cell
        const headerCell = document.createElement('div');
        const fieldType = field.is_measure ? 'measure' : 'dimension';
        headerCell.className = 'log-header-cell';
        headerCell.classList.add(`field-${fieldIndex}`, `field-type-${fieldType}`);
        headerCell.textContent = field.label_short || field.label || field.name; // Use appropriate label
        headerCell.title = field.label || field.name; // Add tooltip with full label/name
        headerFragment.appendChild(headerCell);
    });

    return headerFragment;
}

/**
 * Creates the HTML element for a single log line.
 * @param row - The data row for this line.
 * @param fieldsToRender - Array of fields to include.
 * @param index - The original index of the row (for row numbering).
 * @returns An object containing the log line element and its raw text content.
 */
function renderLogLine(row: Row, fieldsToRender: Field[], index: number): { element: HTMLDivElement, text: string } {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-line';
    let fullLineTextParts: string[] = []; // Array to build raw text

    // Add row number if enabled
    if (state.showRowNumbers) {
        const rowNumSpan = document.createElement('span');
        rowNumSpan.className = 'log-row-num';
        const rowNumText = `${index + 1}: `; // Use original index + 1
        rowNumSpan.textContent = rowNumText;
        logEntry.appendChild(rowNumSpan);
        fullLineTextParts.push(rowNumText);
    }

    // Add content for each field
    fieldsToRender.forEach((field, fieldIndex) => {
        // Add separator
        if (fieldIndex > 0) {
            const sepSpan = document.createElement('span');
            sepSpan.className = 'log-field-separator';
            sepSpan.textContent = ' | ';
            logEntry.appendChild(sepSpan);
            fullLineTextParts.push(' | ');
        }

        // Create field span
        const fieldSpan = document.createElement('span');
        const fieldType = field.is_measure ? 'measure' : 'dimension';
        fieldSpan.classList.add(`log-field`, `field-${fieldIndex}`, `field-type-${fieldType}`);

        const cell = row[field.name];

        // Use Looker's formatter for HTML rendering
        // Fallback to raw value or '[NULL]' if LookerCharts or cell is unavailable
        let formattedValue = '[NULL]';
        let rawValueString = '[NULL]';
        if (cell?.value != null) {
            rawValueString = cell.value.toString();
            try {
                formattedValue = LookerCharts?.Utils?.htmlForCell(cell) ?? rawValueString;
            } catch (formatError) {
                console.warn(`Error formatting cell for field ${field.name}:`, formatError);
                formattedValue = rawValueString; // Fallback to raw value on format error
            }
        } else if (cell?.rendered) { // Use rendered value if value is null but rendered exists
            rawValueString = cell.rendered;
            formattedValue = cell.rendered;
        }


        fieldSpan.innerHTML = formattedValue; // Use innerHTML as htmlForCell returns HTML
        fullLineTextParts.push(rawValueString);

        // Add Drill Functionality if links exist
        if (cell?.links && cell.links.length > 0) {
            fieldSpan.classList.add('drillable');
            fieldSpan.onclick = (event: MouseEvent) => {
                // Ensure LookerCharts context is available
                if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils && LookerCharts.Utils.openDrillMenu) {
                    LookerCharts.Utils.openDrillMenu({ links: cell.links!, event: event }); // Use non-null assertion as we checked length
                } else {
                    console.error("LookerCharts.Utils.openDrillMenu is not available.");
                }
            };
        }

        logEntry.appendChild(fieldSpan);
    });

    // Store original text and HTML for highlighting restoration
    const fullLineText = fullLineTextParts.join('');
    logEntry.dataset.originalText = fullLineText; // Store raw text
    logEntry.dataset.originalHtml = logEntry.innerHTML; // Store initially rendered HTML

    return { element: logEntry, text: fullLineText };
}

/**
 * Creates the document fragment containing all log line elements.
 * @param dataToRender - The filtered data array to render.
 * @param fieldsToRender - Array of fields to include in each line.
 * @returns A DocumentFragment containing the log line elements.
 */
function renderLogLinesContent(dataToRender: Row[], fieldsToRender: Field[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    // Find the original index map if data was filtered
    const originalIndices = new Map<Row, number>();
    state.originalData.forEach((row, index) => originalIndices.set(row, index));

    dataToRender.forEach((row) => {
        const originalIndex = originalIndices.get(row) ?? -1; // Get original index, default to -1 if not found
        if (originalIndex === -1) {
            console.warn("Could not find original index for a filtered row.", row);
        }
        const { element } = renderLogLine(row, fieldsToRender, originalIndex);
        fragment.appendChild(element);
    });
    return fragment;
}


// --- Main Rendering Function ---

/**
 * Main function to render the visualization content (headers and log lines).
 * Reads configuration and filter settings directly from the 'state' object.
 */
export function renderViz(): void {
    console.log("RenderViz called. Current state:", {
        showNums: state.showRowNumbers,
        filterCase: state.filterCaseSensitive,
        highlightCase: state.highlightCaseSensitive,
        selectedField: state.selectedFieldName
    });

    // --- 1. Check Prerequisites ---
    const requiredElements = [
        elements.visElement, elements.logLinesArea, elements.logHeaderArea,
        elements.minimapContainer, elements.minimapThumb, elements.filterInput,
        elements.highlightInput, elements.fieldSelectElement, elements.rowNumberCheckbox,
        elements.filterCaseChk, elements.highlightCaseChk
    ];
    if (requiredElements.some(el => !el) || !state.originalData || !state.queryResponse) {
        console.warn("RenderViz aborted: Missing critical elements or state data.");
        // Optionally display an error message in the UI
        if (elements.logLinesArea) {
            elements.logLinesArea.innerHTML = '<p style="padding: 5px; color: orange;">Waiting for data or elements...</p>';
        }
        return;
    }
    // Destructure elements for convenience (already checked they exist)
    const logLinesArea = elements.logLinesArea!;
    const logHeaderArea = elements.logHeaderArea!;
    const minimapContainer = elements.minimapContainer!;
    const rowNumberCheckbox = elements.rowNumberCheckbox!;
    const filterCaseChk = elements.filterCaseChk!;
    const highlightCaseChk = elements.highlightCaseChk!;

    // --- 2. Update UI Controls from State ---
    // Ensure UI controls reflect the current state (driven by Looker config)
    rowNumberCheckbox.checked = state.showRowNumbers;
    filterCaseChk.checked = state.filterCaseSensitive;
    highlightCaseChk.checked = state.highlightCaseSensitive;
    // fieldSelectElement.value is managed by updateFieldDropdown in main.ts

    // --- 3. Determine Fields to Render ---
    const fieldsToRender: Field[] = [
        ...(state.queryResponse.fields.dimensions || []),
        ...(state.queryResponse.fields.measures || [])
    ];

    if (fieldsToRender.length === 0) {
        logLinesArea.innerHTML = '<p style="padding: 5px; color: orange;">Query returned no fields to display.</p>';
        logHeaderArea.innerHTML = '';
        minimapContainer.style.display = 'none'; // Hide minimap if no content
        return;
    }

    // --- 4. Filter Data ---
    const dataToRender = filterData(state.originalData);
    console.log(`RenderViz: Rendering ${dataToRender.length} rows out of ${state.originalData.length}.`);

    // --- 5. Render Header ---
    logHeaderArea.innerHTML = ''; // Clear previous header
    try {
        const headerFragment = renderHeaderContent(fieldsToRender);
        logHeaderArea.appendChild(headerFragment);
    } catch (headerError) {
        console.error("RenderViz: Error populating headers:", headerError);
        logHeaderArea.innerHTML = '<div style="color: red; padding: 2px 5px;">Error loading headers</div>';
    }

    // --- 6. Render Log Lines ---
    logLinesArea.innerHTML = ''; // Clear previous lines
    if (dataToRender.length === 0) {
        const noDataMsg = document.createElement('p');
        noDataMsg.style.color = 'orange';
        noDataMsg.style.padding = '5px';
        noDataMsg.textContent = elements.filterInput!.value ? 'No logs match filter.' : 'Query returned no data.';
        logLinesArea.appendChild(noDataMsg);
        minimapContainer.style.display = 'none'; // Hide minimap if no content
    } else {
        try {
            const linesFragment = renderLogLinesContent(dataToRender, fieldsToRender);
            logLinesArea.appendChild(linesFragment);
        } catch (renderError) {
            console.error("RenderViz: Error during rendering loop:", renderError);
            logLinesArea.innerHTML = '<p style="color: red; padding: 5px;">Error rendering data.</p>';
            minimapContainer.style.display = 'none'; // Hide minimap on error
        }
    }

    // --- 7. Update Minimap and Apply Highlighting (Deferred) ---
    // Use requestAnimationFrame to ensure layout is calculated before measuring scrollHeight
    requestAnimationFrame(() => {
        // Re-check elements as this runs async
        if (!elements.logLinesArea || !elements.minimapContainer) return;

        const logAreaScrollHeight = elements.logLinesArea.scrollHeight;
        const logAreaClientHeight = elements.logLinesArea.clientHeight;

        if (logAreaScrollHeight > logAreaClientHeight) {
            elements.minimapContainer.style.display = 'block'; // Show minimap
            updateThumb(); // Update thumb size/position based on new content
            applyHighlight(); // Apply highlighting (which also updates minimap markers)
        } else {
            elements.minimapContainer.style.display = 'none'; // Hide minimap
            applyHighlight(); // Still apply highlighting even if minimap is hidden
        }
        console.log("RenderViz: Minimap and highlighting updated.");
    });
}
