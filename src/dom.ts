import { state, elements } from './state';
// No longer importing escapeRegExp here, will be used in main.ts
// No longer defining highlight/minimap/listener functions here

const GRIDJS_CSS_URL = "mermaids.css"; // Assuming handled

/*** Sets up the initial HTML structure using innerHTML. Grid init deferred. */
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up HTML structure (Using innerHTML, init deferred)");

    // 1. Define Styles
    const styles = `
      /* Styles remain the same as v12 */
      /* Base container */
      .log-viewer-container { background-color: black; color: #ddd; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; height: 100%; position: relative; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; }
      /* Controls area */
      #controls-area { position: relative; z-index: 10; background-color: #1c1c1c; padding: 5px 8px; border-bottom: 1px solid #444; flex-shrink: 0; min-height: 35px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap; box-sizing: border-box; }
      #controls-area label { color: #aaa; font-size: 0.9em; margin-right: 5px; }
      #controls-area input[type="text"], #controls-area input.gridjs-input { background-color: #2a2a2a; border: 1px solid #444; color: #ddd; border-radius: 4px; padding: 4px 8px; font-size: 13px; line-height: 1.4; box-sizing: border-box; }
      #controls-area input[type="text"]:focus { border-color: #66f; box-shadow: 0 0 0 2px rgba(100, 100, 255, 0.3); outline: none; }

      /* NEW: Simplified Layout - Controls + Content Area */
      #content-area {
          flex-grow: 1;
          display: flex; /* Grid + Minimap side-by-side */
          flex-direction: row;
          overflow: hidden; /* Important */
          position: relative;
      }

      /* Grid.js Container */
      #gridjs-container { flex-grow: 1; /* Take available width */ overflow: hidden; position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; box-sizing: border-box; }
      /* Grid.js Search Input positioning */
      .gridjs-head { padding-top: 40px; position: relative; flex-shrink: 0; border-bottom: 1px solid #555; box-sizing: border-box; }
      .gridjs-search { position: absolute; top: 5px; left: 8px; }
      input.gridjs-input.gridjs-search-input { width: 200px; }
      /* Grid.js Scrollable Wrapper */
      .gridjs-wrapper { flex-grow: 1; overflow: auto; position: relative; border: none; box-shadow: none; border-radius: 0; width: 100%; z-index: 1; background-color: black; box-sizing: border-box; }
      /* Table */
      table.gridjs-table { border-collapse: collapse; text-align: left; width: 100%; table-layout: fixed; }
      /* Header Cells */
      th.gridjs-th { background-color: #1a1a1a; color: #eee; border: none; border-right: 1px solid #333; border-bottom: 1px solid #555; padding: 8px 10px; font-weight: bold; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: sticky !important; top: 0 !important; z-index: 2 !important; box-sizing: border-box; vertical-align: middle; user-select: none; }
      th.gridjs-th:last-child { border-right: none; }
      th.gridjs-th-fixed { background-color: #1a1a1a; }
      th.gridjs-th .gridjs-th-content { float: left; overflow: hidden; text-overflow: ellipsis; width: 100%; }
      /* Sort Indicator */
      th.gridjs-th-sort { cursor: pointer; position: relative; }
      th.gridjs-th-sort:focus, th.gridjs-th-sort:hover { background-color: #333 !important; }
      th.gridjs-th-sort .gridjs-th-content { width: calc(100% - 25px); }
      button.gridjs-sort { background: none !important; border: none !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; float: right; height: 100%; width: 20px; cursor: pointer; vertical-align: middle; opacity: 0; position: absolute; right: 5px; top: 0; }
      th.gridjs-th-sort::after { content: ''; display: block; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; opacity: 0.4; pointer-events: none; }
      th.gridjs-th-sort[aria-sort="none"]::after, th.gridjs-th-sort:not([aria-sort])::after { opacity: 0.2; border-top: 0; border-bottom: 0; }
      th.gridjs-th-sort[aria-sort="ascending"]::after { border-bottom: 6px solid #eee; border-top: 0; opacity: 1; }
      th.gridjs-th-sort[aria-sort="descending"]::after { border-top: 6px solid #eee; border-bottom: 0; opacity: 1; }
      /* Resizer */
      .gridjs-resizable { position: absolute !important; top: 0; bottom: 0; right: -5px; width: 10px; cursor: ew-resize; z-index: 3 !important; }
      .gridjs-resizable:hover { background-color: rgba(100, 100, 255, 0.5) !important; }
      /* Table Body */
      .gridjs-tbody { background-color: black; z-index: 0; }
      .gridjs-tr { border: none; }
      .gridjs-tr:nth-child(odd) { background-color: black; }
      .gridjs-tr:nth-child(even) { background-color: #111; }
      /* Table Cells */
      td.gridjs-td { color: #ddd; padding: 4px 10px; border: none; border-bottom: 1px dotted #444; line-height: 1.5; white-space: normal; overflow-wrap: break-word; word-break: break-word; box-sizing: border-box; height: 1%; }
      td.gridjs-td .drillable { cursor: pointer; text-decoration: underline; text-decoration-color: #66f; color: #9bf; }
      td.gridjs-td .drillable:hover { text-decoration-color: #aaf; color: #aef; background-color: rgba(100, 100, 255, 0.1); }
      td.gridjs-message { text-align: center; padding: 15px; color: #aaa; background-color: black; }
      /* Footer */
      .gridjs-footer { background-color: #1c1c1c; border-top: 1px solid #555; box-shadow: none; padding: 5px 10px; flex-shrink: 0; color: #aaa; }
      .gridjs-footer:empty { padding: 0; border: none; }
      /* Scrollbars */
      .gridjs-container ::-webkit-scrollbar, .gridjs-wrapper::-webkit-scrollbar { width: 10px; height: 10px; }
      .gridjs-container ::-webkit-scrollbar-thumb, .gridjs-wrapper::-webkit-scrollbar-thumb { background: #555; border-radius: 5px; border: 2px solid black; }
      .gridjs-container ::-webkit-scrollbar-track, .gridjs-wrapper::-webkit-scrollbar-track { background: #222; }
      .gridjs-container, .gridjs-wrapper { scrollbar-width: thin; scrollbar-color: #555 #222; }
      /* Highlight Style */
      mark.gridjs-highlight { background-color: #ffd700; color: black; padding: 0; border-radius: 2px; box-shadow: 0 0 0 1px #ffd700; }
      /* Minimap Styles */
      #gridjs-minimap { width: 15px; height: 100%; background-color: #222; position: relative; overflow: hidden; flex-shrink: 0; box-shadow: inset 2px 0 5px -2px rgba(0,0,0,0.5); }
      .minimap-marker { position: absolute; left: 1px; right: 1px; height: 2px; background-color: rgba(255, 215, 0, 0.6); pointer-events: none; border-radius: 1px; z-index: 1; }
    `;

    // 2. Define the *complete* HTML structure string (Simplified wrapper)
    const htmlContent = `
        <link href="${GRIDJS_CSS_URL}" rel="stylesheet" />
        <style id="gridjs-custom-styles">${styles}</style>
        <div class="log-viewer-container">
            <div id="controls-area">
                <label for="highlight-input">Highlight:</label>
                <input type="text" id="highlight-input" placeholder="Highlight text..." />
                </div>
            <div id="content-area">
                 <div id="gridjs-container"></div>
                 <div id="gridjs-minimap"></div>
            </div>
        </div>
    `;

    // 3. Set innerHTML ONCE
    visElement.innerHTML = htmlContent;

    // 4. DO NOT find elements here. Defer to create function's setTimeout.
    elements.visElement = visElement; // Store the main element reference
    console.log("setupHTML: innerHTML set. Element finding deferred.");
}

//*** Finds and stores references to important DOM elements. Called by create/updateAsync. */
export function findElements(visElement: HTMLElement): boolean {
    console.log("findElements: Attempting to find elements...");
    // Use visElement passed in, or fallback to stored elements.visElement
    const baseElement = visElement || elements.visElement;
    if (!baseElement) {
        console.error("findElements: visElement is null!");
        return false;
    }

    elements.gridJsContainer = baseElement.querySelector<HTMLElement>("#gridjs-container");
    elements.highlightInput = baseElement.querySelector<HTMLInputElement>("#highlight-input");
    elements.minimapContainer = baseElement.querySelector<HTMLElement>("#gridjs-minimap");

    const criticalElementsFound = !!elements.gridJsContainer && !!elements.highlightInput && !!elements.minimapContainer;

    if (!criticalElementsFound) {
        console.error("findElements: One or more critical elements could not be found.");
        if (!elements.gridJsContainer) console.error("... #gridjs-container is missing");
        if (!elements.highlightInput) console.error("... #highlight-input is missing");
        if (!elements.minimapContainer) console.error("... #gridjs-minimap is missing");
        // Log parent structure for debugging
        console.log("Parent structure for debugging:", baseElement.innerHTML);
    } else {
        console.log("findElements: All critical elements found.");
    }
    return criticalElementsFound;
}

// Remove helper functions - they will be moved to main.ts
// function debounce(...) {}
// export function attachListeners(...) {}
// function clearHighlight(...) {}
// export function applyHighlight(...) {}
// function highlightTextNodes(...) {}
// export function updateMinimap(...) {}
