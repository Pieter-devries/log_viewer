import { state, elements } from './state';
import { VisualizationDefinition } from './types';
// Import functions needed for listeners
import { renderViz } from './rendering';
import { applyHighlight } from './highlighting';
import { syncThumbPosition, handleMinimapMouseDown } from './minimap';

/*** Sets up the initial HTML structure and styles.*/
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up HTML structure");
    const styles = `
      /* Base container */
      .log-viewer-container { background-color: black; color: #ccc; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; height: 100%; position: relative; display: flex; flex-direction: column; overflow: hidden; }
      /* Controls area */
      #controls-area { position: relative; z-index: 10; background-color: #1c1c1c; padding: 5px 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; border-bottom: 1px solid #444; margin-bottom: 0; }
      .control-group { display: flex; align-items: center; gap: 4px; }
      .control-group label { color: #aaa; font-size: 0.9em; white-space: nowrap; }
      .control-group input[type="text"], .control-group select { padding: 3px 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 0.9em; }
      #row-number-toggle { order: -1; margin-right: 10px;}
      #row-number-toggle label { cursor: pointer; }
      #row-number-toggle input[type="checkbox"] { cursor: pointer; }
      .input-wrapper { position: relative; display: inline-block; }
      .input-wrapper input[type="text"] { padding-right: 18px; }
      .clear-button { position: absolute; right: 1px; top: 1px; bottom: 1px; border: none; background: transparent; color: #888; cursor: pointer; padding: 0 4px; font-size: 1.1em; line-height: 1; display: none; }
      .input-wrapper input[type="text"]:not(:placeholder-shown) + .clear-button { display: inline-block; }
      .clear-button:hover { color: #ccc; }
      .case-sensitivity-toggle { display: flex; align-items: center; margin-left: -6px; }
      .case-sensitivity-toggle input[type="checkbox"] { cursor: pointer; margin-right: 3px;}
      .case-sensitivity-toggle label { color: #aaa; font-size: 0.85em; cursor: pointer; }
      /* Main Content Area */
      .main-content-area { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; box-sizing: border-box; }
      /* Header Area */
      #log-header-area { display: flex; align-items: baseline; background-color: #1a1a1a; border-bottom: 1px solid #555; padding: 4px 5px; flex-shrink: 0; color: #ddd; font-weight: bold; padding-right: 20px; box-sizing: border-box; }
      .log-header-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; padding: 0; }
      .log-row-num-header { flex-shrink: 0; margin-right: 8px; color: #aaa; user-select: none; font-weight: normal; }
      .log-header-cell.field-0 { flex-shrink: 0; }
      .log-header-separator { margin: 0 5px; color: #666; flex-shrink: 0; font-weight: normal; }
      /* Log Scroll Container */
      .log-scroll-container { display: flex; flex-grow: 1; overflow: hidden; }
      #log-lines-area { flex-grow: 1; overflow: auto; box-sizing: border-box; }
      #log-lines-area::-webkit-scrollbar { width: 0px; height: 8px; }
      #log-lines-area::-webkit-scrollbar-thumb:horizontal { background: #555; border-radius: 4px; }
      #log-lines-area::-webkit-scrollbar-track:horizontal { background: #222; }
      /* Minimap */
      #minimap-container { position: relative; width: 15px; background-color: #222; border-left: 1px solid #444; display: none; box-sizing: border-box; flex-shrink: 0; cursor: pointer; user-select: none; }
      #minimap-thumb { position: absolute; left: 1px; right: 1px; background-color: rgba(100, 100, 100, 0.5); border-radius: 2px; opacity: 0; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; cursor: ns-resize; }
      #minimap-container:hover #minimap-thumb, #minimap-thumb.dragging { opacity: 1; background-color: rgba(150, 150, 150, 0.7); }
      /* Log Line styles */
      .log-line { display: flex; align-items: baseline; margin: 0; padding: 2px 5px; border-bottom: 1px dotted #444; color: #ccc; box-sizing: border-box; }
      .log-row-num { flex-shrink: 0; margin-right: 8px; color: #888; user-select: none; }
      .log-field { white-space: pre-wrap; word-break: break-all; min-width: 0; }
      .log-field.field-0 { flex-shrink: 0; }
      .field-type-measure { /* Optional */ }
      .log-field-separator { margin: 0 5px; color: #666; flex-shrink: 0; }
      .highlight-match { background-color: yellow; color: black; }
      .minimap-marker { position: absolute; left: 1px; right: 1px; height: 2px; background-color: yellow; opacity: 0.7; pointer-events: none; border-radius: 1px; }
      .drillable { cursor: pointer; text-decoration: underline; text-decoration-color: #555; }
      .drillable:hover { text-decoration-color: #999; background-color: rgba(255, 255, 255, 0.05); }
    `;

    visElement.innerHTML = `
      <style>${styles}</style>
      <div class="log-viewer-container">
        <div id="controls-area">
          <div id="row-number-toggle"><input type="checkbox" id="show-row-numbers-chk" /><label for="show-row-numbers-chk">Show Row #</label></div>
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
             <span class="case-sensitivity-toggle">
                <input type="checkbox" id="filter-case-chk" title="Case sensitive filter"/>
                <label for="filter-case-chk">Aa</label>
             </span>
          </div>
          <div class="control-group">
             <label for="log-highlight-input">Search:</label>
             <span class="input-wrapper">
                <input type="text" id="log-highlight-input" placeholder="Highlight text..." />
                <button id="clear-highlight-btn" class="clear-button" title="Clear search">&times;</button>
             </span>
              <span class="case-sensitivity-toggle">
                <input type="checkbox" id="highlight-case-chk" title="Case sensitive search"/>
                <label for="highlight-case-chk">Aa</label>
             </span>
          </div>
        </div>
        <div class="main-content-area">
          <div id="log-header-area"></div>
          <div class="log-scroll-container">
             <div id="log-lines-area"> <p style="padding: 5px;">Log Viewer Initializing...</p> </div>
             <div id="minimap-container"> <div id="minimap-thumb"></div> </div>
          </div>
        </div>
      </div>
    `;
}

//*** Finds and stores references to important DOM elements. */
export function findElements(visElement: HTMLElement): boolean {
    console.log("findElements called");
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
    console.log("findElements: Critical elements found:", criticalElementsFound);
    if (!criticalElementsFound) { console.error("findElements: One or more critical elements NOT found!"); }
    return criticalElementsFound;
}

function checkElementsExist(...elementsToCheck: (HTMLElement | null)[]): boolean {
    return elementsToCheck.every(element => element !== null);
}

/**
 * Attaches event listeners to the controls. (MODIFIED)
 */
export function attachListeners(): void { // Removed visObject parameter
    console.log("Attaching event listeners");

    if (!elements.filterInput || !elements.clearFilterButton || !elements.filterCaseChk ||
        !elements.highlightInput || !elements.clearHighlightButton || !elements.highlightCaseChk ||
        !elements.logLinesArea || !elements.minimapContainer || !elements.fieldSelectElement ||
        !elements.rowNumberCheckbox) {
        console.error("attachListeners: Cannot attach listeners, some elements are missing.");
        return;
    }

    // Filter input - calls imported renderViz
    elements.filterInput.addEventListener('input', renderViz);
    elements.clearFilterButton.addEventListener('click', () => {
        if (elements.filterInput && elements.filterInput.value) {
            elements.filterInput.value = '';
            renderViz(); // Call imported function
        }
    });
    elements.filterCaseChk.addEventListener('change', (event) => {
        state.filterCaseSensitive = (event.target as HTMLInputElement).checked; // Update imported state
        renderViz(); // Call imported function
    });

    // Highlight input - calls imported applyHighlight
    let highlightTimeout: number | undefined;
    elements.highlightInput.addEventListener('input', () => {
        clearTimeout(highlightTimeout);
        highlightTimeout = window.setTimeout(applyHighlight, 100); // Call imported function
    });
    elements.clearHighlightButton.addEventListener('click', () => {
        if (elements.highlightInput && elements.highlightInput.value) {
            elements.highlightInput.value = '';
            applyHighlight(); // Call imported function
        }
    });
    elements.highlightCaseChk.addEventListener('change', (event) => {
        state.highlightCaseSensitive = (event.target as HTMLInputElement).checked; // Update imported state
        applyHighlight(); // Call imported function
    });

    // Other listeners - call imported functions
    elements.logLinesArea.addEventListener('scroll', syncThumbPosition, { passive: true }); // Call imported function
    elements.minimapContainer.addEventListener('mousedown', handleMinimapMouseDown); // Call imported function
    elements.fieldSelectElement.addEventListener('change', (event) => {
        state.selectedFieldName = (event.target as HTMLSelectElement).value; // Update imported state
        renderViz(); // Call imported function
    });
    elements.rowNumberCheckbox.addEventListener('change', (event) => {
        state.showRowNumbers = (event.target as HTMLInputElement).checked; // Update imported state
        renderViz(); // Call imported function
    });

    console.log("Event listeners attached.");
}