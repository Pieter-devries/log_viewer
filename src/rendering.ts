import { state, elements } from './state';
import { Field, Row, LookerChartUtils, Cell } from './types';
import { applyHighlight } from './highlighting';
import { updateThumb } from './minimap';

// Declare global LookerCharts utility
declare var LookerCharts: LookerChartUtils;

// --- Constants ---
const NARROW_COLUMN_WIDTH_THRESHOLD_PX = 150; // Max width for a column to be considered "narrow"
const MIN_FLEX_COLUMN_WIDTH_PX = 50; // Minimum width for flexible columns
const MAX_ROWS_TO_MEASURE = 100; // Optimization: Limit how many rows we measure for width calculation
const SEPARATOR_WIDTH_PX = 15; // Estimate width needed for separators

// --- Helper Functions for Rendering ---

/**
 * Filters the data based on the current filter settings in the state.
 * (No changes)
 */
function filterData(data: Row[]): Row[] {
    // ... (same as before) ...
    if (!elements.filterInput) return data;
    let filterValue = elements.filterInput.value;
    if (!filterValue) { return data; }
    if (!state.filterCaseSensitive) { filterValue = filterValue.toLowerCase(); }
    const selectedFieldName = state.selectedFieldName;
    const fieldsToSearch = (state.queryResponse?.fields)
        ? [...(state.queryResponse.fields.dimensions || []), ...(state.queryResponse.fields.measures || [])]
        : [];
    if (fieldsToSearch.length === 0) return data;
    try {
        return data.filter(row => {
            const checkMatch = (field: Field): boolean => {
                const cell = row[field.name];
                let cellValueStr = cell?.value?.toString();
                if (cellValueStr == null) return false;
                if (!state.filterCaseSensitive) { cellValueStr = cellValueStr.toLowerCase(); }
                return cellValueStr.includes(filterValue);
            };
            if (selectedFieldName === 'all') { return fieldsToSearch.some(checkMatch); }
            else { const selectedField = fieldsToSearch.find(f => f.name === selectedFieldName); return selectedField ? checkMatch(selectedField) : false; }
        });
    } catch (filterError) { console.error("Error during data filtering:", filterError); return data; }
}

/**
 * Creates the document fragment for the log header row items.
 * (No changes)
 * @param fieldsToRender - Array of fields to include in the header.
 * @returns A DocumentFragment containing the header elements.
 */
function renderHeaderContent(fieldsToRender: Field[]): DocumentFragment {
    // ... (same as before, using original layout with separators) ...
    const headerFragment = document.createDocumentFragment();
    if (state.showRowNumbers) {
        const rowNumHeader = document.createElement('div');
        rowNumHeader.className = 'log-row-num-header'; // Base class
        rowNumHeader.textContent = '#';
        headerFragment.appendChild(rowNumHeader);
    }
    fieldsToRender.forEach((field, fieldIndex) => {
        if (fieldIndex > 0 || state.showRowNumbers) {
            const sepHeader = document.createElement('div');
            sepHeader.className = 'log-header-separator'; // Base class
            sepHeader.textContent = '|';
            headerFragment.appendChild(sepHeader);
        }
        const headerCell = document.createElement('div');
        const fieldType = field.is_measure ? 'measure' : 'dimension';
        headerCell.className = 'log-header-cell'; // Base class
        headerCell.classList.add(`field-${fieldIndex}`, `field-type-${fieldType}`);
        headerCell.textContent = field.label_short || field.label || field.name;
        headerCell.title = field.label || field.name;
        headerFragment.appendChild(headerCell);
    });
    return headerFragment;
}


/**
 * Creates the HTML element for a single log line (without dynamic width styles initially).
 * (No changes)
 * @param row - The data row for this line.
 * @param fieldsToRender - Array of fields to include.
 * @param index - The original index of the row (for row numbering).
 * @returns An object containing the log line element and its raw text content.
 */
function renderLogLine(row: Row, fieldsToRender: Field[], index: number): { element: HTMLDivElement, text: string } {
    // ... (same logic as original to create elements, but NO inline styles yet) ...
    const logEntry = document.createElement('div');
    logEntry.className = 'log-line';
    let fullLineTextParts: string[] = [];
    // Add row number if enabled
    if (state.showRowNumbers) {
        const rowNumSpan = document.createElement('span');
        rowNumSpan.className = 'log-row-num'; // Base class
        const rowNumText = `${index + 1}: `;
        rowNumSpan.textContent = rowNumText;
        logEntry.appendChild(rowNumSpan);
        fullLineTextParts.push(rowNumText);
    }
    // Add content for each field
    fieldsToRender.forEach((field, fieldIndex) => {
        // Add separator
        if (fieldIndex > 0 || state.showRowNumbers) {
            const sepSpan = document.createElement('span');
            sepSpan.className = 'log-field-separator'; // Base class
            sepSpan.textContent = ' | ';
            logEntry.appendChild(sepSpan);
            fullLineTextParts.push(' | ');
        }
        // Create field span
        const fieldSpan = document.createElement('span');
        const fieldType = field.is_measure ? 'measure' : 'dimension';
        fieldSpan.classList.add(`log-field`, `field-${fieldIndex}`, `field-type-${fieldType}`); // Base classes

        const cell = row[field.name];
        let formattedValue = '[NULL]'; let rawValueString = '[NULL]';
        if (cell?.value != null) {
            rawValueString = cell.value.toString();
            try { formattedValue = LookerCharts?.Utils?.htmlForCell(cell) ?? rawValueString; }
            catch (formatError) { formattedValue = rawValueString; }
        } else if (cell?.rendered) { rawValueString = cell.rendered; formattedValue = cell.rendered; }

        fieldSpan.innerHTML = formattedValue;
        fullLineTextParts.push(rawValueString);

        // Add Drill Functionality
        if (cell?.links && cell.links.length > 0) {
            fieldSpan.classList.add('drillable');
            fieldSpan.onclick = (event: MouseEvent) => {
                if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils?.openDrillMenu) {
                    LookerCharts.Utils.openDrillMenu({ links: cell.links!, event: event });
                } else { console.error("LookerCharts.Utils.openDrillMenu is not available."); }
            };
        }
        logEntry.appendChild(fieldSpan);
    });
    // Store original text and HTML for highlighting restoration
    const fullLineText = fullLineTextParts.join('');
    logEntry.dataset.originalText = fullLineText;
    logEntry.dataset.originalHtml = logEntry.innerHTML; // Store HTML based on initial render
    return { element: logEntry, text: fullLineText };
}

/**
 * Renders the log lines initially using fallback CSS.
 * (No changes)
 * @param dataToRender - The filtered data array to render.
 * @param fieldsToRender - Array of fields to include in each line.
 * @returns A DocumentFragment containing the initially rendered .log-line elements.
 */
function renderLogLinesInitial(dataToRender: Row[], fieldsToRender: Field[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const originalIndices = new Map<Row, number>();
    state.originalData.forEach((row, index) => originalIndices.set(row, index));

    dataToRender.forEach((row) => {
        const originalIndex = originalIndices.get(row) ?? -1;
        const { element } = renderLogLine(row, fieldsToRender, originalIndex); // No widths passed
        fragment.appendChild(element);
    });
    return fragment;
}

/**
 * Measures column widths and applies dynamic styles using fixed width for narrow columns.
 */
function applyColumnWidths() {
    if (!elements.logHeaderArea || !elements.logLinesArea) return;
    console.log("Applying dynamic column widths (fixed narrow)...");

    const logHeaderArea = elements.logHeaderArea;
    const logLinesArea = elements.logLinesArea;
    // Get all direct children of header (includes separators)
    const headerChildElements = Array.from(logHeaderArea.children) as HTMLElement[];
    const logLineElements = Array.from(logLinesArea.children) as HTMLElement[]; // These are .log-line wrappers
    const numHeaderChildren = headerChildElements.length;

    if (numHeaderChildren === 0 || logLineElements.length === 0) {
        console.log("No header or line elements found to apply widths.");
        // Reset styles if needed? Or just return.
        return;
    }

    // Map header elements to column data (including separators)
    const columnData: {
        element: HTMLElement; // Header element for this column/separator
        elementsToStyle: HTMLElement[]; // Header + All corresponding data cells
        isDataColumn: boolean; // Is it a field/row-num or a separator?
        isNarrowCandidate: boolean;
        maxWidth: number;
    }[] = [];

    // --- Pass 1: Collect elements and measure max scrollWidth per column/separator ---
    console.time("Measure Column Widths");
    for (let i = 0; i < numHeaderChildren; i++) {
        const headerElement = headerChildElements[i];
        const isDataColumn = headerElement.classList.contains('log-header-cell') || headerElement.classList.contains('log-row-num-header');
        const isRowNum = headerElement.classList.contains('log-row-num-header');
        const isSeparator = headerElement.classList.contains('log-header-separator');

        let maxWidth = headerElement.scrollWidth;
        let isNarrowCandidate = true; // Assume narrow initially, only relevant for data columns
        const elementsToStyle: HTMLElement[] = [headerElement];

        // Get corresponding cells in data rows (up to MAX_ROWS_TO_MEASURE)
        for (let j = 0; j < Math.min(logLineElements.length, MAX_ROWS_TO_MEASURE); j++) {
            const lineElement = logLineElements[j];
            // Important: Check if the number of children matches header before accessing
            if (lineElement.children.length === numHeaderChildren) {
                const cellElement = lineElement.children[i] as HTMLElement;
                if (cellElement) {
                    elementsToStyle.push(cellElement); // Collect data cell
                    // Only measure data cells for width if it's a data column
                    if (isDataColumn) {
                        const cellWidth = cellElement.scrollWidth;
                        maxWidth = Math.max(maxWidth, cellWidth);
                        if (cellWidth > NARROW_COLUMN_WIDTH_THRESHOLD_PX) {
                            isNarrowCandidate = false;
                        }
                    }
                }
            } else {
                console.warn(`Row ${j} has ${lineElement.children.length} children, expected ${numHeaderChildren}. Skipping style application for this row.`);
            }
        }
        // For separators, use a fixed width or measure precisely if needed
        if (isSeparator) {
            maxWidth = Math.max(SEPARATOR_WIDTH_PX, maxWidth); // Use estimate or measured
            isNarrowCandidate = true; // Treat separators as narrow
        }
        // Override row number width if fixed
        if (isRowNum) {
            maxWidth = 45; // Use the fixed width from CSS
            isNarrowCandidate = true;
        }

        columnData[i] = { element: headerElement, elementsToStyle, isDataColumn, isNarrowCandidate, maxWidth };
    }
    console.timeEnd("Measure Column Widths");
    // console.log("Column Data:", columnData.map(c => ({ narrow: c.isNarrowCandidate, width: c.maxWidth })));


    // --- Pass 2: Apply styles based on measurements ---
    console.time("Apply Column Styles");
    columnData.forEach((col, i) => {
        let flexStyle = ''; // Use flex for wide columns
        let widthStyle = ''; // Use fixed width for narrow columns
        let whiteSpaceStyle = '';
        let overflowStyle = '';
        let textOverflowStyle = '';
        let textAlignStyle = '';

        const isNarrow = col.isNarrowCandidate && col.maxWidth < NARROW_COLUMN_WIDTH_THRESHOLD_PX;
        const isWideData = col.isDataColumn && !isNarrow; // Identify the wide data column(s)

        if (!col.isDataColumn || isNarrow) {
            // Apply fixed width for narrow data columns, row nums, and separators
            widthStyle = `${col.maxWidth}px`;
            flexStyle = 'none'; // Remove from flex flow
            whiteSpaceStyle = 'nowrap';
            overflowStyle = 'hidden';
            // Apply ellipsis only to actual header cells, not separators/row-num headers
            if (col.element.classList.contains('log-header-cell')) {
                textOverflowStyle = 'ellipsis';
            }
            // Right align specific narrow columns (adjust field indices as needed)
            if (col.element.classList.contains('field-2') || col.element.classList.contains('field-3') || col.element.classList.contains('log-row-num-header')) {
                textAlignStyle = 'right';
            }
        } else {
            // Apply flexible style for wide data columns
            flexStyle = `1 1 ${MIN_FLEX_COLUMN_WIDTH_PX}px`; // Grow, Shrink, Minimum basis
            // Styles for wrapping/overflow are handled by base CSS classes (.log-field)
            // We just need to ensure overflow isn't hidden on data cells
            whiteSpaceStyle = ''; // Use default
            overflowStyle = ''; // Use default
            // Header specific styles for wide column
            if (col.element.classList.contains('log-header-cell')) {
                whiteSpaceStyle = 'nowrap';
                overflowStyle = 'hidden';
                textOverflowStyle = 'ellipsis';
            }
        }

        // Apply styles to all elements collected for this column index
        col.elementsToStyle.forEach(el => {
            el.style.flex = flexStyle; // Set flex behavior (none or flexible)
            if (widthStyle) {
                el.style.width = widthStyle; // Apply fixed width if calculated
                el.style.minWidth = widthStyle; // Ensure min width matches fixed width
            } else {
                el.style.width = ''; // Clear fixed width if flexible
                el.style.minWidth = ''; // Clear fixed min-width if flexible (rely on flex-basis)
            }

            // Apply text handling styles
            if (whiteSpaceStyle) el.style.whiteSpace = whiteSpaceStyle; else el.style.whiteSpace = '';
            if (overflowStyle) el.style.overflow = overflowStyle; else el.style.overflow = ''; // Reset to default if not set
            if (textOverflowStyle) el.style.textOverflow = textOverflowStyle; else el.style.textOverflow = '';

            // Apply alignment
            if (textAlignStyle) el.style.textAlign = textAlignStyle; else el.style.textAlign = '';

            // Ensure wide data columns can wrap vertically
            if (isWideData && el.classList.contains('log-field')) {
                el.style.overflow = 'visible'; // Override potential hidden default
                el.style.whiteSpace = 'pre-wrap'; // Ensure wrapping styles
                el.style.wordBreak = 'break-word';
                el.style.overflowWrap = 'break-word';
            }
        });
    });
    console.timeEnd("Apply Column Styles");

    // --- Trigger Minimap/Highlight Update ---
    requestAnimationFrame(() => {
        console.log("Updating thumb and highlights after width sync.");
        updateThumb();
        applyHighlight();
    });
}


// --- Main Rendering Function ---

/**
 * Main function to render the visualization content (headers and log lines).
 * Uses JS to measure content and apply dynamic widths for alignment.
 */
export function renderViz(): void {
    console.log("RenderViz called (JS Fixed Width Sync).");

    // --- 1. Check Prerequisites ---
    const requiredElements = [elements.visElement, elements.logLinesArea, elements.logHeaderArea, elements.minimapContainer, elements.minimapThumb, elements.filterInput, elements.highlightInput, elements.fieldSelectElement, elements.rowNumberCheckbox, elements.filterCaseChk, elements.highlightCaseChk];
    if (requiredElements.some(el => !el) || !state.originalData || !state.queryResponse) {
        console.warn("RenderViz aborted: Missing critical elements or state data.");
        if (elements.logLinesArea) { elements.logLinesArea.innerHTML = '<p style="padding: 5px; color: orange;">Waiting for data or elements...</p>'; }
        return;
    }
    const logLinesArea = elements.logLinesArea!;
    const logHeaderArea = elements.logHeaderArea!;
    const rowNumberCheckbox = elements.rowNumberCheckbox!;
    const filterCaseChk = elements.filterCaseChk!;
    const highlightCaseChk = elements.highlightCaseChk!;

    // --- 2. Update UI Controls from State ---
    rowNumberCheckbox.checked = state.showRowNumbers;
    filterCaseChk.checked = state.filterCaseSensitive;
    highlightCaseChk.checked = state.highlightCaseSensitive;

    // --- 3. Determine Fields to Render ---
    const fieldsToRender: Field[] = [
        ...(state.queryResponse.fields.dimensions || []),
        ...(state.queryResponse.fields.measures || [])
    ];

    if (fieldsToRender.length === 0) { /* ... handle no fields ... */ return; }

    // --- 4. Filter Data ---
    const dataToRender = filterData(state.originalData);
    console.log(`RenderViz: Rendering ${dataToRender.length} rows out of ${state.originalData.length}.`);

    // --- 5. Initial Render (Header and Lines with Fallback CSS) ---
    logHeaderArea.innerHTML = '';
    logLinesArea.innerHTML = ''; // Clear lines area before rendering
    try {
        const headerFragment = renderHeaderContent(fieldsToRender);
        logHeaderArea.appendChild(headerFragment); // Append header

        if (dataToRender.length === 0) {
            const noDataMsg = document.createElement('p');
            noDataMsg.style.color = 'orange'; noDataMsg.style.padding = '5px';
            noDataMsg.textContent = elements.filterInput!.value ? 'No logs match filter.' : 'Query returned no data.';
            logLinesArea.appendChild(noDataMsg);
            if (elements.minimapContainer) elements.minimapContainer.style.display = 'none';
        } else {
            const linesFragment = renderLogLinesInitial(dataToRender, fieldsToRender);
            logLinesArea.appendChild(linesFragment); // Append lines
        }
    } catch (renderError) { /* ... handle render error ... */ return; }

    // --- 6. Apply Dynamic Column Widths (Deferred) ---
    if (dataToRender.length > 0 || fieldsToRender.length > 0) { // Apply even if no data, to size header
        requestAnimationFrame(applyColumnWidths);
    } else {
        requestAnimationFrame(() => { updateThumb(); }); // Update minimap anyway
    }
}
