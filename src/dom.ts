// dom.ts
import { state, elements } from './state';

// URL for Grid.js default CSS (ensure this is accessible in your Looker environment)
const GRIDJS_CSS_URL = "mermaids.css"; // Assuming handled or replace with a CDN/correct path

/***
 * Sets up the initial HTML structure for the visualization.
 * Uses CSS variables for key dimensions and absolute positioning
 * for the grid wrapper and minimap overlay. Includes sparkline styles.
 * @param visElement - The HTMLElement provided by Looker to render the visualization into.
 */
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up HTML structure (Using innerHTML, init deferred)");

    // --- Define Estimated/Fixed Heights & Widths ---
    // !!! IMPORTANT: Inspect your actual rendered .gridjs-head and .gridjs-footer
    // heights using Developer Tools and adjust these CSS variable values if necessary.
    const estimatedHeaderHeight = '40px'; // Adjusted based on previous user feedback
    const estimatedFooterHeight = '5px';  // Adjusted based on previous user feedback
    const minimapWidth = '15px';          // Width of the minimap element
    const minimapGap = '2px';             // Small gap between grid and minimap overlay
    // ------------------------------------------------

    // 1. Define Styles
    const styles = `
      :root {
        /* Define CSS variables for header/footer height and minimap dimensions */
        --gridjs-header-height: ${estimatedHeaderHeight};
        --gridjs-footer-height: ${estimatedFooterHeight};
        --gridjs-minimap-width: ${minimapWidth};
        --gridjs-minimap-gap: ${minimapGap};
        /* Calculate padding needed for the grid container based on minimap */
        --gridjs-container-padding-right: calc(var(--gridjs-minimap-width) + var(--gridjs-minimap-gap));
        /* Define link colors */
        --link-color-default: #9bf; /* Light blue */
        --link-color-visited: #a9d; /* Lighter purple/magenta */
        --link-color-hover: #bff;  /* Cyan */
      }

      /* Base container for the entire visualization */
       .log-viewer-container {
         background-color: black;
         color: #ddd;
         font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
         font-size: 13px;
         height: 100%;
         position: relative;
         display: flex;
         flex-direction: column;
         overflow: hidden; /* Prevent container itself from scrolling */
         box-sizing: border-box;
       }

       /* Area for top controls like the highlight input */
       #controls-area {
         position: relative;
         z-index: 10; /* Above grid content */
         background-color: #1c1c1c;
         padding: 5px 8px;
         border-bottom: 1px solid #444;
         flex-shrink: 0; /* Prevent shrinking */
         min-height: 35px;
         display: flex;
         align-items: center;
         gap: 15px;
         flex-wrap: wrap;
         box-sizing: border-box;
       }
       #controls-area label {
         color: #aaa;
         font-size: 0.9em;
         margin-right: 5px;
       }
       #controls-area input[type="text"],
       #controls-area input.gridjs-input { /* Style gridjs inputs if they appear here */
         background-color: #2a2a2a;
         border: 1px solid #444;
         color: #ddd;
         border-radius: 4px;
         padding: 4px 8px;
         font-size: 13px;
         line-height: 1.4;
         box-sizing: border-box;
       }
       #controls-area input[type="text"]:focus {
         border-color: #66f;
         box-shadow: 0 0 0 2px rgba(100, 100, 255, 0.3);
         outline: none;
       }


      /* Content Area - Holds the grid container and the absolute minimap */
      #content-area {
          flex-grow: 1; /* Takes remaining vertical space */
          display: flex;
          flex-direction: row; /* Grid and minimap conceptually side-by-side */
          overflow: hidden; /* Clip content */
          position: relative; /* Positioning context for the minimap */
          height: 100%; /* Necessary for children height % */
          min-height: 0; /* Prevent flex blowout */
      }

      /* Grid.js Container - Takes up available space, provides padding for minimap */
      #gridjs-container {
          flex-grow: 1; /* Takes available horizontal space */
          position: relative; /* Positioning context for wrapper/header/footer */
          display: flex;
          flex-direction: column; /* Stack header, wrapper, footer */
          height: 100%;
          min-height: 0;
          box-sizing: border-box;
          padding-right: var(--gridjs-container-padding-right); /* Space for minimap */
      }

      /* Grid.js Header - Sits at the top of #gridjs-container */
      .gridjs-head {
         flex-shrink: 0; /* Prevent shrinking */
         height: var(--gridjs-header-height); /* Use variable */
         position: relative; /* For z-index */
         z-index: 1; /* Above wrapper */
         border-bottom: 1px solid #555;
         box-sizing: border-box;
         padding-top: 0; /* Reset padding if needed */
      }
       /* Position search within the header */
       .gridjs-search {
         position: absolute;
         top: 5px; /* Adjust as needed */
         left: 8px; /* Adjust as needed */
       }
       input.gridjs-input.gridjs-search-input {
         width: 200px; /* Example width */
       }

      /* Grid.js Footer - Sits at the bottom of #gridjs-container */
      .gridjs-footer {
          flex-shrink: 0; /* Prevent shrinking */
          height: var(--gridjs-footer-height); /* Use variable */
          position: relative; /* For z-index */
          z-index: 1; /* Above wrapper */
          background-color: #1c1c1c;
          border-top: 1px solid #555;
          box-shadow: none;
          padding: 5px 10px;
          color: #aaa;
          box-sizing: border-box;
      }
       /* Collapse footer visually if it's empty */
       .gridjs-footer:empty {
         height: 0;
         padding: 0;
         border: none;
       }

      /* Grid.js Scrollable Wrapper - Positioned absolutely to fill space between header/footer */
      .gridjs-wrapper {
          position: absolute;
          /* Positioned relative to #gridjs-container's padding box */
          top: var(--gridjs-header-height);
          bottom: var(--gridjs-footer-height);
          left: 0;
          right: 0; /* Respects parent's padding-right */
          overflow: auto; /* <<< THIS element has the scrollbars */
          z-index: 0; /* Behind header/footer */
          background-color: black;
          box-sizing: border-box;
      }

      /* Table within the wrapper */
       table.gridjs-table {
         border-collapse: collapse;
         text-align: left;
         width: 100%;
         table-layout: fixed;
       }

       /* Table Header Cells - Sticky relative to the scrolling wrapper */
       th.gridjs-th {
         background-color: #1a1a1a;
         color: #eee;
         border: none;
         border-right: 1px solid #333;
         border-bottom: 1px solid #555;
         padding: 8px 10px;
         font-weight: bold;
         text-align: left;
         overflow: hidden;
         text-overflow: ellipsis;
         white-space: nowrap;
         position: sticky !important; /* Make header sticky */
         top: 0 !important;           /* Stick to top of .gridjs-wrapper */
         z-index: 2 !important;       /* Above table body content */
         box-sizing: border-box;
         vertical-align: middle;
         user-select: none;
       }
       th.gridjs-th:last-child {
         border-right: none;
       }
       /* Style for fixed columns header cells if using that feature */
       th.gridjs-th-fixed {
         background-color: #1a1a1a;
       }
        /* Inner content div within TH */
       th.gridjs-th .gridjs-th-content {
         float: left;
         overflow: hidden;
         text-overflow: ellipsis;
         width: 100%;
       }

       /* Sort Indicator Styles */
       th.gridjs-th-sort { cursor: pointer; position: relative; }
       th.gridjs-th-sort:focus,
       th.gridjs-th-sort:hover { background-color: #333 !important; }
       th.gridjs-th-sort .gridjs-th-content { width: calc(100% - 25px); } /* Space for indicator */
       button.gridjs-sort { background: none !important; border: none !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; float: right; height: 100%; width: 20px; cursor: pointer; vertical-align: middle; opacity: 0; position: absolute; right: 5px; top: 0; }
       th.gridjs-th-sort::after { content: ''; display: block; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; opacity: 0.4; pointer-events: none; }
       th.gridjs-th-sort[aria-sort="none"]::after,
       th.gridjs-th-sort:not([aria-sort])::after { opacity: 0.2; border-top: 0; border-bottom: 0; }
       th.gridjs-th-sort[aria-sort="ascending"]::after { border-bottom: 6px solid #eee; border-top: 0; opacity: 1; }
       th.gridjs-th-sort[aria-sort="descending"]::after { border-top: 6px solid #eee; border-bottom: 0; opacity: 1; }

       /* Resizer Styles */
       .gridjs-resizable { position: absolute !important; top: 0; bottom: 0; right: -5px; width: 10px; cursor: ew-resize; z-index: 3 !important; }
       .gridjs-resizable:hover { background-color: rgba(100, 100, 255, 0.5) !important; }

       /* Table Body */
       .gridjs-tbody { background-color: black; z-index: 0; }
       .gridjs-tr { border: none; }
       .gridjs-tr:nth-child(odd) { background-color: black; }
       .gridjs-tr:nth-child(even) { background-color: #111; }

   /* Table Body & Cells */
      .gridjs-tbody { background-color: black; z-index: 0; }
      .gridjs-tr { border: none; }
      .gridjs-tr:nth-child(odd) { background-color: black; }
      .gridjs-tr:nth-child(even) { background-color: #111; }
      td.gridjs-td { color: #ddd; padding: 4px 10px; border: none; border-bottom: 1px dotted #444; line-height: 1.5; white-space: normal; overflow-wrap: break-word; word-break: break-word; box-sizing: border-box; height: 1%; }
      /* Style for drillable links created by our code */
      td.gridjs-td .drillable { cursor: pointer; text-decoration: underline; text-decoration-color: var(--link-color-default); color: var(--link-color-default); }
      td.gridjs-td .drillable:hover { text-decoration-color: var(--link-color-hover); color: var(--link-color-hover); background-color: rgba(100, 100, 255, 0.1); }
      /* <<< NEW: Style for ALL links within table cells >>> */
      td.gridjs-td a {
          color: var(--link-color-default);
          text-decoration: underline;
          text-decoration-color: var(--link-color-default);
      }
      td.gridjs-td a:visited {
          color: var(--link-color-visited); /* Softer visited color */
          text-decoration-color: var(--link-color-visited);
      }
      td.gridjs-td a:hover,
      td.gridjs-td a:focus {
          color: var(--link-color-hover);
          text-decoration-color: var(--link-color-hover);
      }
      /* <<< End Link Color Styles >>> */
       /* Style for messages like 'Loading...' or 'No data' */
       td.gridjs-message {
         text-align: center;
         padding: 15px;
         color: #aaa;
         background-color: black;
       }


      /* Minimap Styles - Positioned absolutely over the scrollbar area */
      #gridjs-minimap {
          position: absolute; /* Position absolutely within #content-area */
          top: 0;             /* Align to top */
          bottom: 0;          /* Stretch to bottom */
          right: 0;           /* Align to right edge of #content-area */
          width: var(--gridjs-minimap-width); /* Use variable */
          height: 100%;       /* Ensure full height */
          background-color: #222; /* Background of the minimap */
          overflow: hidden;      /* Hide markers that might overflow */
          box-shadow: inset 2px 0 5px -2px rgba(0,0,0,0.5); /* Inner shadow */
          z-index: 3;          /* Sit on top of grid container */
          box-sizing: border-box;
          cursor: grab; /* Add grab cursor */
      }
      #gridjs-minimap.grabbing { cursor: grabbing !important; } /* Add grabbing cursor style */


      /* Individual markers on the minimap */
      .minimap-marker {
          position: absolute;
          left: 1px; /* Small inset */
          right: 1px; /* Small inset */
          height: 2px; /* Height of marker */
          background-color: rgba(255, 215, 0, 0.6); /* Highlight color */
          pointer-events: none; /* Don't intercept clicks */
          border-radius: 1px;
          z-index: 1; /* Stacking within minimap */
      }

      /* Scrollbar Styles (apply to the wrapper where overflow:auto is set) */
      .gridjs-wrapper::-webkit-scrollbar {
         width: var(--gridjs-minimap-width); /* Try to match minimap width */
         height: 10px; /* Height for horizontal scrollbar */
       }
      .gridjs-wrapper::-webkit-scrollbar-thumb {
          background: #555; /* Color of the draggable thumb */
          border-radius: 5px;
          /* Add border matching background to make thumb seem inset */
          border: 2px solid #222; /* Use minimap background color */
       }
      .gridjs-wrapper::-webkit-scrollbar-track {
          background: transparent; /* Make track invisible */
       }
       /* Firefox scrollbar styling */
      .gridjs-wrapper {
          scrollbar-width: thin; /* Or 'auto' or 'none' */
          /* thumb color, track color */
          scrollbar-color: #555 transparent;
       }

      /* Highlight Style within table cells */
      mark.gridjs-highlight {
        background-color: #ffd700; /* Yellow highlight */
        color: black; /* Text color on highlight */
        padding: 0;
        border-radius: 2px;
        box-shadow: 0 0 0 1px #ffd700; /* Subtle outline */
      }

      /* Sparkline Styles - Updated for Histogram */
      .sparkline-container {
          display: inline-flex; /* Arrange bars horizontally */
          align-items: flex-end; /* Align bars to bottom */
          /* width: 50px; */ /* Width determined by bars inside */
          height: 16px; /* Overall height */
          /* background-color: #333; */ /* Remove container background */
          /* border: 1px solid #555; */ /* Remove container border */
          margin-left: 8px;
          vertical-align: middle;
          gap: 1px; /* Space between bars */
          position: relative;
          box-sizing: border-box;
      }

      .sparkline-hist-bar { /* Style for individual bars */
          display: block;
          width: 3px; /* <<< Width of each bar */
          background-color: #444; /* <<< Default color for empty part */
          /* height is set via inline style */
          box-sizing: border-box;
          flex-shrink: 0;
      }
      .sparkline-hist-bar--filled { /* Modifier for filled bars */
         background-color: #66f; /* <<< Active bar color */
      }
      /* <<< End Sparkline Styles >>> */

       /* Wrapper for cell content to help layout */


    `;

    // 2. Define the *complete* HTML structure string
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

    // 3. Set innerHTML ONCE to the visualization element
    visElement.innerHTML = htmlContent;

    // 4. Store reference to the main element, but defer finding child elements
    elements.visElement = visElement;
    console.log("setupHTML: innerHTML set. Element finding deferred.");
}

/**
 * Finds and stores references to important DOM elements within the visualization.
 * Should be called after setupHTML and the DOM has likely been updated.
 * @param visElement - The root HTMLElement of the visualization.
 * @returns {boolean} - True if all critical elements were found, false otherwise.
 */
export function findElements(visElement: HTMLElement): boolean {
    console.log("findElements: Attempting to find elements...");
    const baseElement = visElement || elements.visElement;
    if (!baseElement) {
        console.error("findElements: visElement is null!");
        return false;
    }

    // Find the main container where Grid.js will render
    elements.gridJsContainer = baseElement.querySelector<HTMLElement>("#gridjs-container");
    // Find the input element for highlighting text
    elements.highlightInput = baseElement.querySelector<HTMLInputElement>("#highlight-input");
    // Find the container element for the minimap overlay
    elements.minimapContainer = baseElement.querySelector<HTMLElement>("#gridjs-minimap");

    // Check if all essential elements were found
    const criticalElementsFound = !!elements.gridJsContainer && !!elements.highlightInput && !!elements.minimapContainer;

    if (!criticalElementsFound) {
        console.error("findElements: One or more critical elements could not be found.");
        if (!elements.gridJsContainer) console.error("... #gridjs-container is missing");
        if (!elements.highlightInput) console.error("... #highlight-input is missing");
        if (!elements.minimapContainer) console.error("... #gridjs-minimap is missing");
        // Log parent structure for debugging if elements are missing
        console.log("Parent structure for debugging:", baseElement.innerHTML);
    } else {
        console.log("findElements: All critical elements found.");
    }
    return criticalElementsFound;
}
