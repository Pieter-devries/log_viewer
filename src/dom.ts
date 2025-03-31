import { state, elements } from './state';
import { VisualizationDefinition } from './types';
// Import functions needed for listeners
import { renderViz } from './rendering';
import { applyHighlight } from './highlighting';
import { syncThumbPosition, handleMinimapMouseDown } from './minimap';

// Debounce timer variables (no changes)
let filterDebounceTimeout: number | undefined;
const FILTER_DEBOUNCE_DELAY = 250;
let highlightDebounceTimeout: number | undefined;
const HIGHLIGHT_DEBOUNCE_DELAY = 150;


/*** Sets up the initial HTML structure and styles. */
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up HTML structure with readability improvements");
    // Added readability styles (font, size, color, line-height, padding)
    // Fallback CSS remains simple flex
    const styles = `
      /* Base container */
      .log-viewer-container {
        background-color: black;
        color: #ddd; /* Brighter base text color */
        /* Modern monospace stack */
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 13px; /* Slightly larger base font size */
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      /* Controls area */
      #controls-area { position: relative; z-index: 10; background-color: #1c1c1c; padding: 5px 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; border-bottom: 1px solid #444; margin-bottom: 0; }
      .control-group { display: flex; align-items: center; gap: 4px; }
      .control-group label { color: #aaa; font-size: 0.9em; white-space: nowrap; }
      /* Ensure inputs inherit font */
      .control-group input[type="text"], .control-group select { padding: 3px 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: inherit; font-family: inherit; border-radius: 3px; }
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

      /* --- Fallback Flexbox Layout (Before JS Width Calculation) --- */

      /* Header Area & Log Line Flex Containers */
      #log-header-area, .log-line {
        display: flex;
        align-items: baseline;
        box-sizing: border-box;
        width: 100%;
        flex-wrap: nowrap;
      }
      #log-header-area {
        background-color: #1a1a1a; border-bottom: 1px solid #555; padding: 4px 5px;
        flex-shrink: 0; color: #eee; /* Header text slightly brighter */ font-weight: bold; padding-right: 20px;
        overflow: hidden;
      }
      .log-line {
        margin: 0; padding: 2px 0; /* Padding applied to cells now */ border-bottom: 1px dotted #444; color: #ddd; /* Base text color */
        /* font-size applied to container */
      }

      /* Default for cells/headers: Flexible, allow wrapping/truncating */
      .log-header-cell, .log-field {
        flex: 1 1 auto; /* Default: Grow, Shrink, Basis Auto */
        min-width: 40px; /* Prevent complete collapse */
        padding: 2px 5px; /* Increased padding */
        box-sizing: border-box;
        overflow: hidden; /* Hide overflow by default */
      }
      .log-header-cell {
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .log-field {
        white-space: pre-wrap; /* Allow wrapping */
        word-break: break-word;
        overflow-wrap: break-word;
        line-height: 1.5; /* Improved line spacing */
        /* overflow: visible; */ /* Let JS control overflow */
      }

      /* Row Number: Fixed Width */
      .log-row-num-header, .log-row-num {
        flex: 0 0 45px; /* Fixed width */
        min-width: 45px; /* Override default min-width */
        padding: 2px 10px 2px 5px; /* Adjusted padding */
        text-align: right;
        white-space: nowrap;
        color: #999; /* Dimmer color for row numbers */
        user-select: none;
        /* font-size: 0.9em; */ /* Inherit from container */
      }
      .log-row-num-header { color: #aaa; font-weight: normal; text-overflow: ellipsis; }

      /* Separators: Auto Width */
      .log-header-separator, .log-field-separator {
        flex: 0 0 auto; /* Size based on content */
        min-width: auto; /* Override default min-width */
        padding: 2px 5px; /* Consistent padding */
        color: #666; font-weight: normal;
      }
      /* --- End Fallback Flexbox Layout --- */


      /* Log Scroll Container */
      .log-scroll-container { display: flex; flex-grow: 1; overflow: hidden; }

      /* Log Lines Area - HIDE SCROLLBAR */
      #log-lines-area {
        flex-grow: 1; overflow: auto; box-sizing: border-box; padding-right: 5px;
        scrollbar-width: none; -ms-overflow-style: none;
      }
      #log-lines-area::-webkit-scrollbar { display: none; width: 0; height: 0; }

      /* Minimap (unchanged) */
      #minimap-container { position: relative; width: 15px; background-color: #222; border-left: 1px solid #444; display: none; box-sizing: border-box; flex-shrink: 0; cursor: pointer; user-select: none; }
      #minimap-thumb { position: absolute; left: 1px; right: 1px; background-color: rgba(100, 100, 100, 0.5); border-radius: 2px; opacity: 0; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; cursor: ns-resize; pointer-events: none; }
      #minimap-thumb.dragging { background-color: rgba(150, 150, 150, 0.8); }
      #minimap-container:hover #minimap-thumb { opacity: 1; background-color: rgba(150, 150, 150, 0.7); }
      /* Highlight/Marker/Drillable styles */
      .highlight-match { background-color: #550; color: #ff6; border-radius: 2px; padding: 0 1px; } /* Different highlight */
      .minimap-marker { position: absolute; left: 1px; right: 1px; height: 2px; background-color: rgba(255, 255, 0, 0.7); pointer-events: none; border-radius: 1px; }
      .drillable { cursor: pointer; text-decoration: underline; text-decoration-color: #66f; color: #9bf; } /* Brighter drill links */
      .drillable:hover { text-decoration-color: #aaf; color: #aef; background-color: rgba(100, 100, 255, 0.1); }
    `;

    // (The rest of the setupHTML function remains the same)
    visElement.innerHTML = `
      <style>${styles}</style>
      <div class="log-viewer-container">
        <div id="controls-area">
          <div id="row-number-toggle" class="control-group"><input type="checkbox" id="show-row-numbers-chk" /><label for="show-row-numbers-chk">Row&nbsp;#</label></div>
          <div class="control-group"><label for="log-field-select">Field:</label><select id="log-field-select"><option value="all">All Fields</option></select></div>
          <div class="control-group"><label for="log-filter-input">Filter:</label><span class="input-wrapper"><input type="text" id="log-filter-input" placeholder="Filter rows..." /><button id="clear-filter-btn" class="clear-button" title="Clear filter">&times;</button></span><span class="case-sensitivity-toggle" title="Case sensitive filter"><input type="checkbox" id="filter-case-chk" /><label for="filter-case-chk">Aa</label></span></div>
          <div class="control-group"><label for="log-highlight-input">Search:</label><span class="input-wrapper"><input type="text" id="log-highlight-input" placeholder="Highlight text..." /><button id="clear-highlight-btn" class="clear-button" title="Clear search">&times;</button></span><span class="case-sensitivity-toggle" title="Case sensitive search"><input type="checkbox" id="highlight-case-chk" /><label for="highlight-case-chk">Aa</label></span></div>
        </div>
        <div class="main-content-area">
          <div id="log-header-area"></div>
          <div class="log-scroll-container">
             <div id="log-lines-area"></div>
             <div id="minimap-container"><div id="minimap-thumb"></div></div>
          </div>
        </div>
      </div>
    `;
}

//*** Finds and stores references to important DOM elements. (No changes from original) */
export function findElements(visElement: HTMLElement): boolean {
    // ... (same as before) ...
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
    if (!criticalElementsFound) { console.error("findElements: One or more critical elements NOT found!"); }
    return criticalElementsFound;
}


/**
 * Attaches event listeners to the controls and interactive elements.
 * (No changes from previous refactored version)
 */
export function attachListeners(): void {
    // ... (same as before) ...
    console.log("Attaching event listeners");
    const requiredElements = [elements.filterInput, elements.clearFilterButton, elements.filterCaseChk, elements.highlightInput, elements.clearHighlightButton, elements.highlightCaseChk, elements.logLinesArea, elements.minimapContainer, elements.fieldSelectElement, elements.rowNumberCheckbox];
    if (requiredElements.some(el => !el)) { console.error("attachListeners: Cannot attach listeners, one or more required elements are missing."); return; }
    const filterInput = elements.filterInput!; const clearFilterButton = elements.clearFilterButton!; const filterCaseChk = elements.filterCaseChk!; const highlightInput = elements.highlightInput!; const clearHighlightButton = elements.clearHighlightButton!; const highlightCaseChk = elements.highlightCaseChk!; const logLinesArea = elements.logLinesArea!; const minimapContainer = elements.minimapContainer!; const fieldSelectElement = elements.fieldSelectElement!; const rowNumberCheckbox = elements.rowNumberCheckbox!;
    filterInput.addEventListener('input', () => { clearTimeout(filterDebounceTimeout); filterDebounceTimeout = window.setTimeout(() => { console.log("Filter Debounce: Calling renderViz"); renderViz(); }, FILTER_DEBOUNCE_DELAY); });
    clearFilterButton.addEventListener('click', () => { if (filterInput.value) { filterInput.value = ''; clearTimeout(filterDebounceTimeout); console.log("Clear Filter: Calling renderViz immediately"); renderViz(); } });
    filterCaseChk.addEventListener('change', (event) => { state.filterCaseSensitive = (event.target as HTMLInputElement).checked; console.log("Filter Case Change: Calling renderViz"); renderViz(); });
    highlightInput.addEventListener('input', () => { clearTimeout(highlightDebounceTimeout); highlightDebounceTimeout = window.setTimeout(() => { console.log("Highlight Debounce: Calling applyHighlight"); applyHighlight(); }, HIGHLIGHT_DEBOUNCE_DELAY); });
    clearHighlightButton.addEventListener('click', () => { if (highlightInput.value) { highlightInput.value = ''; clearTimeout(highlightDebounceTimeout); console.log("Clear Highlight: Calling applyHighlight immediately"); applyHighlight(); } });
    highlightCaseChk.addEventListener('change', (event) => { state.highlightCaseSensitive = (event.target as HTMLInputElement).checked; console.log("Highlight Case Change: Calling applyHighlight"); applyHighlight(); });
    logLinesArea.addEventListener('scroll', syncThumbPosition, { passive: true });
    minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);
    fieldSelectElement.addEventListener('change', (event) => { state.selectedFieldName = (event.target as HTMLSelectElement).value; console.log(`Field Selection Change: New field is "${state.selectedFieldName}". Calling renderViz.`); renderViz(); });
    rowNumberCheckbox.addEventListener('change', (event) => { state.showRowNumbers = (event.target as HTMLInputElement).checked; console.log(`Row Number Toggle Change: Show is ${state.showRowNumbers}. Calling renderViz.`); renderViz(); });
    console.log("Event listeners attached successfully.");
}
