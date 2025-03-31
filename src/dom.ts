import { state, elements } from './state';
import { VisualizationDefinition } from './types';
// Import functions needed for listeners
import { renderViz } from './rendering';
import { applyHighlight } from './highlighting';
import { syncThumbPosition, handleMinimapMouseDown } from './minimap';

// Debounce timer variable for filter input
let filterDebounceTimeout: number | undefined;
const FILTER_DEBOUNCE_DELAY = 250; // milliseconds

// Debounce timer variable for highlight input
let highlightDebounceTimeout: number | undefined;
const HIGHLIGHT_DEBOUNCE_DELAY = 150; // milliseconds


/*** Sets up the initial HTML structure and styles. */
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up HTML structure with ORIGINAL layout CSS");
    // Reverted layout CSS to original, kept scrollbar hiding
    const styles = `
      /* Base container */
      .log-viewer-container { background-color: black; color: #ccc; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; height: 100%; position: relative; display: flex; flex-direction: column; overflow: hidden; }
      /* Controls area */
      #controls-area { position: relative; z-index: 10; background-color: #1c1c1c; padding: 5px 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; border-bottom: 1px solid #444; margin-bottom: 0; }
      .control-group { display: flex; align-items: center; gap: 4px; }
      .control-group label { color: #aaa; font-size: 0.9em; white-space: nowrap; }
      .control-group input[type="text"], .control-group select { padding: 3px 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 0.9em; border-radius: 3px; }
      #row-number-toggle { order: -1; }
      #row-number-toggle label { cursor: pointer; user-select: none; }
      #row-number-toggle input[type="checkbox"] { cursor: pointer; margin-right: 3px; }
      .input-wrapper { position: relative; display: inline-flex; align-items: center; }
      .input-wrapper input[type="text"] { padding-right: 18px; }
      .clear-button { position: absolute; right: 1px; top: 1px; bottom: 1px; border: none; background: transparent; color: #888; cursor: pointer; padding: 0 4px; font-size: 1.1em; line-height: 1; display: none; }
      .input-wrapper input[type="text"]:not(:placeholder-shown) + .clear-button { display: inline-block; }
      .clear-button:hover { color: #ccc; }
      .case-sensitivity-toggle { display: flex; align-items: center; }
      .case-sensitivity-toggle input[type="checkbox"] { cursor: pointer; margin-right: 3px;}
      .case-sensitivity-toggle label { color: #aaa; font-size: 0.85em; cursor: pointer; user-select: none; }
      /* Main Content Area */
      .main-content-area { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; box-sizing: border-box; }

      /* --- START ORIGINAL LAYOUT CSS --- */

      /* Header Area */
      #log-header-area {
        display: flex;           /* Use flexbox */
        align-items: baseline;   /* Align text baselines */
        background-color: #1a1a1a;
        border-bottom: 1px solid #555;
        padding: 4px 5px;
        flex-shrink: 0;          /* Prevent header area itself from shrinking */
        color: #ddd;
        font-weight: bold;
        padding-right: 20px;     /* Space for scrollbar/minimap */
        box-sizing: border-box;
        overflow: hidden;        /* Hide potential header overflow */
      }
      /* Default header cell style */
      .log-header-cell {
        white-space: nowrap;     /* Keep header text on one line */
        overflow: hidden;        /* Hide overflow */
        text-overflow: ellipsis; /* Show ellipsis (...) for overflow */
        min-width: 0;            /* Allow shrinking */
        padding: 0 2px;          /* Original had 0, added slight padding */
        /* No explicit flex properties - relies on default flex behavior */
      }
      /* Row number header */
      .log-row-num-header {
        flex-shrink: 0;          /* Prevent shrinking */
        margin-right: 8px;       /* Original margin */
        color: #aaa;
        user-select: none;
        font-weight: normal;
      }
      /* Special rule for the first field's header */
      .log-header-cell.field-0 {
        flex-shrink: 0;          /* Prevent the first column header from shrinking */
      }
       /* Header separator */
      .log-header-separator {
        margin: 0 5px;           /* Original margin */
        color: #666;
        flex-shrink: 0;          /* Prevent shrinking */
        font-weight: normal;
      }

      /* Log Line styles */
      .log-line {
        display: flex;           /* Use flexbox */
        align-items: baseline;   /* Align text baselines */
        margin: 0;
        padding: 2px 5px;
        border-bottom: 1px dotted #444;
        color: #ccc;
        box-sizing: border-box;
        font-size: 0.9em;        /* Added from previous refinement */
      }
      /* Row number in log line */
      .log-row-num {
        flex-shrink: 0;          /* Prevent shrinking */
        margin-right: 8px;       /* Original margin */
        color: #888;
        user-select: none;
        font-size: 0.9em;        /* Match line font size */
      }
      /* Default data field style */
      .log-field {
        white-space: pre-wrap;   /* Allow wrapping */
        word-break: break-all;   /* Break long words (original had this) */
        min-width: 0;            /* Allow shrinking */
        padding: 0 2px;          /* Added slight padding */
         /* No explicit flex properties - relies on default flex behavior */
      }
      /* Special rule for the first field's data */
      .log-field.field-0 {
        flex-shrink: 0;          /* Prevent the first column data area from shrinking */
      }
      .field-type-measure { /* Optional styling for measures */ }
      /* Field separator in log line */
      .log-field-separator {
        margin: 0 5px;           /* Original margin */
        color: #666;
        flex-shrink: 0;          /* Prevent shrinking */
      }

      /* --- END ORIGINAL LAYOUT CSS --- */


      /* Log Scroll Container */
      .log-scroll-container { display: flex; flex-grow: 1; overflow: hidden; }

      /* Log Lines Area - HIDE SCROLLBAR */
      #log-lines-area {
        flex-grow: 1;
        overflow: auto; /* Keep this for scrollability */
        box-sizing: border-box;
        padding-right: 5px; /* Add padding to avoid text hitting minimap */
        /* --- HIDE DEFAULT SCROLLBAR --- */
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }
      #log-lines-area::-webkit-scrollbar {
          display: none; /* WebKit browsers (Chrome, Safari, new Edge) */
          width: 0; /* Fallback for some older versions */
          height: 0; /* Fallback for some older versions */
      }
      /* --- End HIDE DEFAULT SCROLLBAR --- */

      /* Minimap */
      #minimap-container { position: relative; width: 15px; background-color: #222; border-left: 1px solid #444; display: none; /* Initially hidden */ box-sizing: border-box; flex-shrink: 0; cursor: pointer; user-select: none; }
      #minimap-thumb { position: absolute; left: 1px; right: 1px; background-color: rgba(100, 100, 100, 0.5); border-radius: 2px; opacity: 0; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; cursor: ns-resize; pointer-events: none; /* Initially disabled */ }
      #minimap-thumb.dragging { background-color: rgba(150, 150, 150, 0.8); /* Darker when dragging */ }
      #minimap-container:hover #minimap-thumb { opacity: 1; background-color: rgba(150, 150, 150, 0.7); } /* Show on hover */
      /* Highlight/Marker/Drillable styles (unchanged) */
      .highlight-match { background-color: yellow; color: black; border-radius: 2px; padding: 0 1px; }
      .minimap-marker { position: absolute; left: 1px; right: 1px; height: 2px; background-color: rgba(255, 255, 0, 0.7); pointer-events: none; border-radius: 1px; }
      .drillable { cursor: pointer; text-decoration: underline; text-decoration-color: #555; }
      .drillable:hover { text-decoration-color: #999; background-color: rgba(255, 255, 255, 0.05); }
    `;

    // (The rest of the setupHTML function remains the same)
    visElement.innerHTML = `
      <style>${styles}</style>
      <div class="log-viewer-container">
        <div id="controls-area">
          <div id="row-number-toggle" class="control-group">
             <input type="checkbox" id="show-row-numbers-chk" />
             <label for="show-row-numbers-chk">Row&nbsp;#</label> </div>
          <div class="control-group">
             <label for="log-field-select">Field:</label>
             <select id="log-field-select"><option value="all">All Fields</option></select>
          </div>
          <div class="control-group">
             <label for="log-filter-input">Filter:</label>
             <span class="input-wrapper">
                <input type="text" id="log-filter-input" placeholder="Filter rows..." />
                <button id="clear-filter-btn" class="clear-button" title="Clear filter">&times;</button>
             </span>
             <span class="case-sensitivity-toggle" title="Case sensitive filter">
                <input type="checkbox" id="filter-case-chk" />
                <label for="filter-case-chk">Aa</label>
             </span>
          </div>
          <div class="control-group">
             <label for="log-highlight-input">Search:</label>
             <span class="input-wrapper">
                <input type="text" id="log-highlight-input" placeholder="Highlight text..." />
                <button id="clear-highlight-btn" class="clear-button" title="Clear search">&times;</button>
             </span>
              <span class="case-sensitivity-toggle" title="Case sensitive search">
                <input type="checkbox" id="highlight-case-chk" />
                <label for="highlight-case-chk">Aa</label>
             </span>
          </div>
        </div>
        <div class="main-content-area">
          <div id="log-header-area"></div>
          <div class="log-scroll-container">
             <div id="log-lines-area">
                <p style="padding: 5px;">Log Viewer Initializing...</p>
             </div>
             <div id="minimap-container">
                <div id="minimap-thumb"></div>
                </div>
          </div>
        </div>
      </div>
    `;
}

//*** Finds and stores references to important DOM elements. (No changes from original) */
export function findElements(visElement: HTMLElement): boolean {
    // console.log("findElements called");
    elements.visElement = visElement;
    elements.filterInput = visElement.querySelector<HTMLInputElement>("#log-filter-input");
    elements.highlightInput = visElement.querySelector<HTMLInputElement>("#log-highlight-input");
    elements.fieldSelectElement = visElement.querySelector<HTMLSelectElement>("#log-field-select");
    elements.logHeaderArea = visElement.querySelector<HTMLElement>("#log-header-area");
    elements.logLinesArea = visElement.querySelector<HTMLElement>("#log-lines-area");
    elements.minimapContainer = visElement.querySelector<HTMLElement>("#minimap-container");
    elements.minimapThumb = visElement.querySelector<HTMLElement>("#minimap-thumb");
    elements.rowNumberCheckbox = visElement.querySelector<HTMLInputElement>("#show-row-numbers-chk");
    elements.clearFilterButton = visElement.querySelector<HTMLButtonElement>("#clear-filter-btn");
    elements.clearHighlightButton = visElement.querySelector<HTMLButtonElement>("#clear-highlight-btn");
    elements.filterCaseChk = visElement.querySelector<HTMLInputElement>("#filter-case-chk");
    elements.highlightCaseChk = visElement.querySelector<HTMLInputElement>("#highlight-case-chk");

    const criticalElementsFound = !!elements.logLinesArea && !!elements.logHeaderArea && !!elements.rowNumberCheckbox && !!elements.filterInput && !!elements.highlightInput && !!elements.fieldSelectElement && !!elements.minimapContainer && !!elements.minimapThumb && !!elements.clearFilterButton && !!elements.clearHighlightButton && !!elements.filterCaseChk && !!elements.highlightCaseChk;

    if (!criticalElementsFound) {
        console.error("findElements: One or more critical elements NOT found!", {
            logLinesArea: !!elements.logLinesArea, logHeaderArea: !!elements.logHeaderArea,
            rowNumberCheckbox: !!elements.rowNumberCheckbox, filterInput: !!elements.filterInput,
            highlightInput: !!elements.highlightInput, fieldSelectElement: !!elements.fieldSelectElement,
            minimapContainer: !!elements.minimapContainer, minimapThumb: !!elements.minimapThumb,
            clearFilterButton: !!elements.clearFilterButton, clearHighlightButton: !!elements.clearHighlightButton,
            filterCaseChk: !!elements.filterCaseChk, highlightCaseChk: !!elements.highlightCaseChk
        });
    }
    return criticalElementsFound;
}


/**
 * Attaches event listeners to the controls and interactive elements.
 * (No changes from previous refactored version)
 */
export function attachListeners(): void {
    console.log("Attaching event listeners");

    // Check if all required elements for listeners are present
    const requiredElements = [
        elements.filterInput, elements.clearFilterButton, elements.filterCaseChk,
        elements.highlightInput, elements.clearHighlightButton, elements.highlightCaseChk,
        elements.logLinesArea, elements.minimapContainer, elements.fieldSelectElement,
        elements.rowNumberCheckbox
    ];
    if (requiredElements.some(el => !el)) {
        console.error("attachListeners: Cannot attach listeners, one or more required elements are missing.");
        return;
    }
    // Use non-null assertion operator (!) as we've checked elements exist
    const filterInput = elements.filterInput!;
    const clearFilterButton = elements.clearFilterButton!;
    const filterCaseChk = elements.filterCaseChk!;
    const highlightInput = elements.highlightInput!;
    const clearHighlightButton = elements.clearHighlightButton!;
    const highlightCaseChk = elements.highlightCaseChk!;
    const logLinesArea = elements.logLinesArea!;
    const minimapContainer = elements.minimapContainer!;
    const fieldSelectElement = elements.fieldSelectElement!;
    const rowNumberCheckbox = elements.rowNumberCheckbox!;

    // --- Filter Input Listener (Debounced) ---
    filterInput.addEventListener('input', () => {
        clearTimeout(filterDebounceTimeout); // Clear previous timeout
        filterDebounceTimeout = window.setTimeout(() => {
            console.log("Filter Debounce: Calling renderViz");
            renderViz(); // Call renderViz after delay
        }, FILTER_DEBOUNCE_DELAY);
    });

    // --- Clear Filter Button Listener ---
    clearFilterButton.addEventListener('click', () => {
        if (filterInput.value) {
            filterInput.value = '';
            clearTimeout(filterDebounceTimeout); // Clear any pending debounce
            console.log("Clear Filter: Calling renderViz immediately");
            renderViz(); // Re-render immediately
        }
    });

    // --- Filter Case Sensitivity Checkbox Listener ---
    filterCaseChk.addEventListener('change', (event) => {
        state.filterCaseSensitive = (event.target as HTMLInputElement).checked;
        // Maybe trigger Looker update here if using options: Looker.plugins.visualizations.vis_update_config(...)
        console.log("Filter Case Change: Calling renderViz");
        renderViz(); // Re-render with new case sensitivity
    });

    // --- Highlight Input Listener (Debounced) ---
    highlightInput.addEventListener('input', () => {
        clearTimeout(highlightDebounceTimeout); // Clear previous timeout
        highlightDebounceTimeout = window.setTimeout(() => {
            console.log("Highlight Debounce: Calling applyHighlight");
            applyHighlight(); // Call applyHighlight after delay
        }, HIGHLIGHT_DEBOUNCE_DELAY);
    });

    // --- Clear Highlight Button Listener ---
    clearHighlightButton.addEventListener('click', () => {
        if (highlightInput.value) {
            highlightInput.value = '';
            clearTimeout(highlightDebounceTimeout); // Clear any pending debounce
            console.log("Clear Highlight: Calling applyHighlight immediately");
            applyHighlight(); // Re-apply (which clears) immediately
        }
    });

    // --- Highlight Case Sensitivity Checkbox Listener ---
    highlightCaseChk.addEventListener('change', (event) => {
        state.highlightCaseSensitive = (event.target as HTMLInputElement).checked;
        // Maybe trigger Looker update here if using options
        console.log("Highlight Case Change: Calling applyHighlight");
        applyHighlight(); // Re-apply highlighting with new case sensitivity
    });

    // --- Log Area Scroll Listener ---
    // Use passive: true for potentially smoother scrolling
    logLinesArea.addEventListener('scroll', syncThumbPosition, { passive: true });

    // --- Minimap Interaction Listener ---
    minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);

    // --- Field Selector Listener ---
    fieldSelectElement.addEventListener('change', (event) => {
        state.selectedFieldName = (event.target as HTMLSelectElement).value;
        console.log(`Field Selection Change: New field is "${state.selectedFieldName}". Calling renderViz.`);
        renderViz(); // Re-render when selected field changes
    });

    // --- Row Number Toggle Listener ---
    rowNumberCheckbox.addEventListener('change', (event) => {
        state.showRowNumbers = (event.target as HTMLInputElement).checked;
        // Maybe trigger Looker update here if using options
        console.log(`Row Number Toggle Change: Show is ${state.showRowNumbers}. Calling renderViz.`);
        renderViz(); // Re-render when row number visibility changes
    });

    console.log("Event listeners attached successfully.");
}
