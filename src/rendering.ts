import { state, elements } from './state';
import { Field, Row, LookerChartUtils } from './types';
import { applyHighlight } from './highlighting';
import { updateThumb } from './minimap';

// Declare global LookerCharts utility
declare var LookerCharts: LookerChartUtils;

/**
 * Main function to render the visualization content (headers and log lines).
 */
export function renderViz(): void {
    console.log("RenderViz called");
    if (!elements.visElement || !state.originalData || !state.queryResponse || !elements.filterInput || !elements.logLinesArea || !elements.logHeaderArea || !elements.minimapContainer || !elements.fieldSelectElement || !elements.rowNumberCheckbox || !elements.highlightInput || !elements.minimapThumb) {
        console.warn("RenderViz aborted: Missing critical elements or state data"); return;
    }
    // Destructure for easier access, but use state/elements directly
    const data = state.originalData;
    const queryResponse = state.queryResponse;
    const filterInput = elements.filterInput;
    const logLinesArea = elements.logLinesArea;
    const logHeaderArea = elements.logHeaderArea;
    const minimap = elements.minimapContainer;
    const selectedFieldName = state.selectedFieldName;
    const showRowNumbers = state.showRowNumbers;

    const fieldsToRender: Field[] = [ // Explicitly type
        ...(queryResponse.fields.dimensions || []),
        ...(queryResponse.fields.measures || [])
    ];
    console.log("RenderViz: Fields to Render:", fieldsToRender.map(f => f.name));

    if (fieldsToRender.length === 0) {
        logLinesArea.innerHTML = '<p style="padding: 5px; color: orange;">Query returned no fields to display.</p>';
        logHeaderArea.innerHTML = '';
        return;
    }

    // --- Filtering (Using state.filterCaseSensitive) ---
    let filterValue = filterInput.value;
    if (!state.filterCaseSensitive) { filterValue = filterValue.toLowerCase(); }
    let dataToRender: Row[]; // Explicitly type
    const allFieldsForFilter = fieldsToRender;
    if (filterValue) {
        try {
            dataToRender = data.filter(row => {
                const checkMatch = (field: Field) => {
                    const cell = row[field.name];
                    let cellValueStr = cell?.value?.toString();
                    if (cellValueStr == null) return false;
                    if (!state.filterCaseSensitive) { cellValueStr = cellValueStr.toLowerCase(); }
                    return cellValueStr.includes(filterValue);
                };
                if (selectedFieldName === 'all') { return allFieldsForFilter.some(checkMatch); }
                else { const selectedField = allFieldsForFilter.find(f => f.name === selectedFieldName); return selectedField ? checkMatch(selectedField) : false; }
            });
        }
        catch (filterError) { console.error("Filter error:", filterError); dataToRender = data; }
    } else {
        dataToRender = data;
    }
    console.log(`RenderViz: Rendering ${dataToRender ? dataToRender.length : 0} rows.`);

    // --- Populate Header ---
    logHeaderArea.innerHTML = '';
    try {
        const headerFragment = document.createDocumentFragment();
        if (showRowNumbers) {
            const rowNumHeader = document.createElement('div');
            rowNumHeader.className = 'log-header-cell log-row-num-header';
            rowNumHeader.textContent = '#';
            headerFragment.appendChild(rowNumHeader);
        }
        fieldsToRender.forEach((field, fieldIndex) => {
            if (fieldIndex > 0) {
                const sepHeader = document.createElement('div');
                sepHeader.className = 'log-header-separator';
                sepHeader.textContent = '|';
                headerFragment.appendChild(sepHeader);
            }
            const headerCell = document.createElement('div');
            const fieldType = field.is_measure ? 'measure' : 'dimension';
            headerCell.className = 'log-header-cell';
            headerCell.classList.add(`field-${fieldIndex}`, `field-type-${fieldType}`);
            headerCell.textContent = field.label_short || field.label || field.name;
            headerFragment.appendChild(headerCell);
        });
        logHeaderArea.appendChild(headerFragment);
    } catch (headerError) {
        console.error("RenderViz: Error populating headers:", headerError);
        logHeaderArea.innerHTML = '<div style="color: red; padding: 2px 5px;">Error loading headers</div>';
    }

    // --- Rendering Log Lines ---
    logLinesArea.innerHTML = '';
    if (!dataToRender || dataToRender.length === 0) {
        const noDataMsg = document.createElement('p');
        noDataMsg.style.color = 'orange'; noDataMsg.style.padding = '5px';
        noDataMsg.textContent = filterValue ? 'No logs match filter.' : 'Query returned no data.';
        logLinesArea.appendChild(noDataMsg);
    }
    else {
        try {
            const fragment = document.createDocumentFragment();
            dataToRender.forEach((row, index) => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-line';
                let fullLineTextParts: string[] = []; // Type array
                if (showRowNumbers) {
                    const rowNumSpan = document.createElement('span');
                    rowNumSpan.className = 'log-row-num';
                    const rowNumText = `${index + 1}: `;
                    rowNumSpan.textContent = rowNumText;
                    logEntry.appendChild(rowNumSpan);
                    fullLineTextParts.push(rowNumText);
                }
                fieldsToRender.forEach((field, fieldIndex) => {
                    if (fieldIndex > 0) {
                        const sepSpan = document.createElement('span');
                        sepSpan.className = 'log-field-separator';
                        sepSpan.textContent = ' | ';
                        logEntry.appendChild(sepSpan);
                        fullLineTextParts.push(' | ');
                    }
                    const fieldSpan = document.createElement('span');
                    const fieldType = field.is_measure ? 'measure' : 'dimension';
                    fieldSpan.classList.add(`log-field`, `field-${fieldIndex}`, `field-type-${fieldType}`);
                    const cell = row[field.name];
                    // Use Looker's formatter
                    const formattedValue = cell?.value != null ? LookerCharts.Utils.htmlForCell(cell) : '[NULL]';
                    fieldSpan.innerHTML = formattedValue;
                    fullLineTextParts.push(cell?.value != null ? cell.value.toString() : '[NULL]');
                    // Add Drill Functionality
                    if (cell && cell.links) {
                        fieldSpan.classList.add('drillable');
                        fieldSpan.onclick = (event: MouseEvent) => { // Type event
                            LookerCharts.Utils.openDrillMenu({ links: cell.links!, event: event }); // Use non-null assertion for links
                        };
                    }
                    logEntry.appendChild(fieldSpan);
                });
                logEntry.dataset.originalText = fullLineTextParts.join('');
                logEntry.dataset.originalHtml = logEntry.innerHTML;
                fragment.appendChild(logEntry);
            });
            logLinesArea.appendChild(fragment);
            // console.log("RenderViz finished processing rows.");
        } catch (renderError) {
            console.error("RenderViz: Error during rendering loop:", renderError);
            logLinesArea.innerHTML = '<p style="color: red; padding: 5px;">Error rendering data.</p>';
        }
    }

    // --- Check Overflow & Update Minimap/Thumb ---
    requestAnimationFrame(() => {
        if (!elements.logLinesArea || !elements.minimapContainer) return;
        const logAreaScrollHeight = elements.logLinesArea.scrollHeight;
        const logAreaClientHeight = elements.logLinesArea.clientHeight;
        if (logAreaScrollHeight > logAreaClientHeight) {
            elements.minimapContainer.style.display = 'block';
            updateThumb(); // Call imported function
            applyHighlight(); // Call imported function
        } else {
            elements.minimapContainer.style.display = 'none';
            applyHighlight(); // Call imported function
        }
    });
}