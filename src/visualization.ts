// src/visualization.ts
import { VisualizationDefinition, VisConfig, VisQueryResponse, VisData } from './core/types';
import { state, elements, updateCoreState, calculateMeasureMinMax } from './core/state';
import { setupHTML, findElements, getScrollWrapper } from './ui/dom';
import { attachAllListeners } from './ui/listeners';
import { applyHighlight } from './ui/highlight';
import { transformLookerDataForGridJs } from './core/dataTransformer';
import { getGridJsOptions } from './core/gridOptions';
import { setGridWrapperHeight } from './ui/layout';
import { updateMinimapThumb, updateMinimapMarkers } from './ui/minimap';
import { Grid } from 'gridjs';

// Declare the looker global object
declare var looker: any;

// --- Helper function to add highlight controls ---
/**
 * Finds the Grid.js header and prepends the Highlight label and input elements.
 * Idempotent: Checks if the input already exists before adding.
 * Restores the input value from state if the input is recreated.
 * @param visElement The root visualization element.
 * @returns True if controls were successfully added or already existed, false otherwise.
 */
function addHighlightControlsToHeader(visElement: HTMLElement): boolean {
    if (!elements.gridJsContainer) {
        console.error("addHighlightControlsToHeader: gridJsContainer not found.");
        return false; // Indicate failure
    }

    const gridHead = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-head');
    if (gridHead) {
        // Check if highlight input already exists (e.g., if forceRender didn't remove it)
        let highlightInput = gridHead.querySelector<HTMLInputElement>('#highlight-input');
        if (highlightInput) {
            console.log("Highlight controls already exist in header.");
            // Ensure the value is up-to-date if it exists
            if (highlightInput.value !== state.highlightTerm) {
                // --- FIX: Provide fallback for potentially undefined state.highlightTerm ---
                highlightInput.value = state.highlightTerm || '';
            }
            return true; // Indicate success (already present)
        }

        // Create Label
        const highlightLabel = document.createElement('label');
        highlightLabel.htmlFor = 'highlight-input';
        highlightLabel.textContent = 'Highlight:';
        highlightLabel.style.color = '#aaa';
        highlightLabel.style.fontSize = '0.9em';
        highlightLabel.style.marginRight = '5px';

        // Create Input
        highlightInput = document.createElement('input'); // Assign to existing variable
        highlightInput.type = 'text';
        highlightInput.id = 'highlight-input';
        highlightInput.placeholder = 'Highlight text...';
        highlightInput.style.backgroundColor = '#2a2a2a';
        highlightInput.style.border = '1px solid #444';
        highlightInput.style.color = '#ddd';
        highlightInput.style.borderRadius = '4px';
        highlightInput.style.padding = '4px 8px';
        highlightInput.style.fontSize = '13px';
        highlightInput.style.lineHeight = '1.4';
        highlightInput.style.boxSizing = 'border-box';
        // Restore previous value from state if available
        // --- FIX: Provide fallback for potentially undefined state.highlightTerm ---
        highlightInput.value = state.highlightTerm || '';


        // Prepend the label and input to the grid header
        gridHead.prepend(highlightInput);
        gridHead.prepend(highlightLabel);
        console.log("Dynamically added Highlight controls to .gridjs-head.");
        return true; // Indicate success

    } else {
        console.error("Cannot add highlight controls: .gridjs-head not found.");
        return false; // Indicate failure
    }
}
// --- End Helper Function ---


export const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs',
    label: 'Log Viewer (Grid.js)',
    options: {
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
        showMeasureSparklines: { type: 'boolean', label: 'Show Sparklines for Measures', default: false, section: 'Display', order: 2 },
    },

    // Called once to set up the initial state and DOM structure
    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);

            setTimeout(() => {
                if (!findElements(element)) {
                    console.error("Create Error: Core elements not found after setupHTML.");
                    return;
                }
                if (!elements.gridJsContainer) { /* safety check */ return; }
                elements.gridJsContainer.innerHTML = "";

                try {
                    const initialGridOptions = getGridJsOptions(config, [], []);
                    const grid = new Grid(initialGridOptions);

                    try {
                        grid.render(elements.gridJsContainer);
                        setGridWrapperHeight();
                        updateMinimapThumb();
                    } catch (renderError) {
                        console.error("Create Error: grid.render() failed.", renderError);
                        state.gridInstance = null;
                        return;
                    }

                    state.gridInstance = grid;

                    // Call dynamic addition AFTER render
                    if (addHighlightControlsToHeader(element)) {
                        // Re-find elements and attach listeners AFTER adding controls
                        if (findElements(element)) {
                            attachAllListeners();
                        } else {
                            console.error("Create Error: Failed to find elements after adding highlight controls.");
                        }
                    }

                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");

                } catch (initError) {
                    console.error("Create Error: Failed to initialize Grid.js.", initError);
                    state.gridInstance = null;
                }
            }, 0);

        } catch (error) { console.error("Create Error: setupHTML failed.", error); }
    },

    // Called whenever data or configuration changes
    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) {
            console.warn("UpdateAsync: Grid instance not available. Aborting update.");
            done();
            return;
        }
        if (!findElements(element)) {
            logError("Update Error: Critical elements missing during update.");
            done();
            return;
        }

        try {
            updateCoreState(data, queryResponse, config);
            calculateMeasureMinMax();

            const { columns, data: gridData } = transformLookerDataForGridJs(
                state.originalData, state.queryResponse, state.config, state.measureMinMax
            );
            const gridOptions = getGridJsOptions(state.config, columns, gridData);

            state.gridInstance.updateConfig(gridOptions);
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            try {
                state.gridInstance.forceRender();
                console.log("UpdateAsync: forceRender called successfully.");
                setGridWrapperHeight();

                // Add/Verify controls, Re-find elements, Re-attach listeners AFTER forceRender
                if (addHighlightControlsToHeader(element)) {
                    if (findElements(element)) {
                        attachAllListeners();
                    } else {
                        logError("UpdateAsync Error: Failed to find elements after forceRender and adding controls.");
                    }
                }

            } catch (forceRenderError) {
                logError("UpdateAsync: forceRender() failed!", forceRenderError);
            }

            // Post-render actions
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try {
                    applyHighlight(state.highlightTerm);
                    updateMinimapMarkers();
                    updateMinimapThumb();
                } catch (highlightError) {
                    logError("Error during post-render highlight/minimap update:", highlightError);
                } finally {
                    console.log("UpdateAsync: setTimeout callback calling done().");
                    done();
                }
            }, 50);

        } catch (err) {
            logError(`UpdateAsync: CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`, err);
            if (err instanceof Error) { console.error(err.stack); }
            done();
        }
    },
    trigger: (event: string, config: any[]) => {
        console.log("Vis Triggered:", event, config);
    },

    destroy: function () {
        console.log("Log Viewer Vis (Grid.js): Destroy called.");
        if (state.gridInstance) {
            try {
                if (elements.gridJsContainer) {
                    elements.gridJsContainer.innerHTML = "";
                }
            } catch (e) { console.error("Error during destroy cleanup:", e); }
            state.gridInstance = null;
        }
        elements.gridJsContainer = null;
        elements.highlightInput = null;
        elements.minimapContainer = null;
        elements.minimapThumb = null;
        elements.visElement = null;
        state.highlightTerm = '';
        state.measureMinMax = {};
        console.log("Log Viewer Vis (Grid.js): Destroy cleanup finished.");
    }
};

// --- Looker Visualization API Registration ---
if (looker && looker.plugins && looker.plugins.visualizations) {
    looker.plugins.visualizations.add(visDefinition);
    console.log("Log Viewer (Grid.js) visualization registered.");
} else { console.error("Looker environment not found. Visualization not registered."); }

// Add grabbing cursor style dynamically
const grabbingStyle = document.createElement('style');
grabbingStyle.textContent = ` #gridjs-minimap.grabbing { cursor: grabbing !important; } `;
if (document.head) { document.head.appendChild(grabbingStyle); }
else { document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(grabbingStyle); }); }
