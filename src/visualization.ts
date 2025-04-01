// src/visualization.ts
import {
    VisualizationDefinition, VisConfig, VisQueryResponse, VisData, VisOptions, Row, Field // Use official types where possible
} from './core/types';
import { state, elements, updateCoreState, calculateMeasureMinMax } from './core/state';
import { setupHTML, findElements } from './ui/dom';
import { attachAllListeners } from './ui/listeners';
import { applyHighlight } from './ui/highlight';
import { transformLookerDataForGridJs } from './core/dataTransformer';
import { getGridJsOptions } from './core/gridOptions';
import { Grid } from 'gridjs'; // Import Grid type

// --- Looker Visualization Definition ---
export const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs',
    label: 'Log Viewer (Grid.js)',
    options: { // Static options object
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
        showMeasureSparklines: { type: 'boolean', label: 'Show Sparklines for Measures', default: false, section: 'Display', order: 2 },
    },

    /** Create Method */
    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);
            console.log("Create: HTML structure setup attempted.");

            // Defer Grid.js initialization
            setTimeout(() => {
                console.log("Create (setTimeout): Finding elements...");
                if (!findElements(element)) {
                    console.error("Create (setTimeout): Critical elements not found.");
                    element.innerHTML = `<div style='color:red; padding:10px;'>Error: Vis structure not found.</div>`;
                    return;
                }
                console.log("Create (setTimeout): Elements found. Initializing Grid...");

                // <<< Ensure container is empty before rendering >>>
                if (elements.gridJsContainer) {
                    elements.gridJsContainer.innerHTML = ''; // Explicitly clear
                    console.log("Create (setTimeout): Ensured #gridjs-container is empty.");
                } else {
                    console.error("Create (setTimeout): Cannot find #gridjs-container to clear or render into.");
                    return; // Don't proceed if container is missing
                }


                try {
                    // Get initial Grid.js options (empty data/columns)
                    const initialGridOptions = getGridJsOptions(config);
                    const grid = new Grid(initialGridOptions);

                    // <<< Wrap render in try/catch >>>
                    try {
                        grid.render(elements.gridJsContainer); // Render into the now guaranteed empty container
                        console.log("Create (setTimeout): Grid render call succeeded.");
                    } catch (renderError) {
                        console.error("!!!! Create (setTimeout): grid.render() threw an error !!!!", renderError);
                        // Handle render error (e.g., display message in container)
                        elements.gridJsContainer.innerHTML = `<p style="color:red; padding: 10px;">Grid Render Error: ${renderError instanceof Error ? renderError.message : String(renderError)}</p>`;
                        state.gridInstance = null; // Ensure instance is null if render fails
                        return; // Stop execution if render fails
                    }


                    state.gridInstance = grid; // Store instance
                    console.log("Create (setTimeout): Stored grid instance.");

                    attachAllListeners(); // Attach event listeners
                    console.log("Create (setTimeout): Listeners attached.");

                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");

                } catch (initError) { // Catch errors from `new Grid()`
                    console.error("!!!! Create (setTimeout): Error initializing Grid.js (new Grid()) !!!!", initError);
                    const errorMsg = initError instanceof Error ? initError.message : String(initError);
                    elements.gridJsContainer.innerHTML = `<p style="color:red; padding: 10px;">Grid Init Error: ${errorMsg}</p>`;
                    state.gridInstance = null;
                }
            }, 0);
        } catch (error) { // Catch errors from setupHTML
            console.error("Error during visualization creation (setupHTML):", error);
            element.innerHTML = `<div style="color:red; padding:10px;">Create Error: ${error instanceof Error ? error.message : String(error)}</div>`;
        }
    },

    /** UpdateAsync Method */
    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START. Grid instance:", state.gridInstance ? 'Exists' : 'NULL');
        const logError = (message: string, err?: any) => { console.error(message, err); };

        // <<< More robust check: Ensure grid instance exists AND its container exists >>>
        // It's possible the instance exists but its DOM was removed or failed to render
        if (!state.gridInstance || !elements.gridJsContainer || !state.gridInstance.config.container) {
            console.warn("UpdateAsync: Grid instance or its container not ready/valid. Skipping update.");
            // Attempt to re-render if container exists but grid thinks it's empty? Risky.
            // Best approach is to ensure 'create' succeeds fully.
            done();
            return;
        }


        try {
            // Re-find elements just in case
            if (!findElements(element)) { logError("Update Error: Critical elements missing."); done(); return; }

            // Update core state
            updateCoreState(data, queryResponse, config);

            // Log raw field structure
            if (queryResponse?.fields?.measures?.[0]) { /* console.log(...) */ }
            if (queryResponse?.fields?.dimensions?.[0]) { /* console.log(...) */ }

            // Calculate Min/Max for sparklines
            calculateMeasureMinMax();

            // Transform data
            const { columns, data: gridData } = transformLookerDataForGridJs(
                state.originalData, state.queryResponse, state.config, state.measureMinMax
            );

            // Get updated Grid.js options
            const gridOptions = getGridJsOptions(state.config, columns, gridData);

            // Update the grid instance
            console.log("UpdateAsync: Updating grid config...");
            state.gridInstance.updateConfig(gridOptions);
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            // <<< Wrap forceRender in try/catch as it was failing >>>
            try {
                state.gridInstance.forceRender();
                console.log("UpdateAsync: forceRender called successfully.");
            } catch (forceRenderError) {
                logError("UpdateAsync: forceRender() failed!", forceRenderError);
                // Handle error - maybe grid state is corrupted?
                // Attempting a full re-render might be an option, but complex.
            }


            // Post-render actions
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                (window as any).__logged_sparkline_gen = {};
                (window as any).__logged_sparkline = {};
                try {
                    applyHighlight(state.highlightTerm); // Apply highlighting
                } catch (highlightError) {
                    logError("Error during post-render highlight/minimap update:", highlightError);
                } finally {
                    console.log("UpdateAsync: setTimeout callback calling done().");
                    done(); // Signal Looker completion
                }
            }, 50);

        } catch (err) {
            logError(`UpdateAsync: CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`, err);
            if (err instanceof Error) { console.error(err.stack); }
            done();
        }
    },

    // Add Empty trigger function
    trigger: (event: string, config: any[]) => {
        console.log("Vis Triggered:", event, config);
    },

    // Optional: Add destroy method for cleanup
    destroy: function () {
        console.log("Log Viewer Vis (Grid.js): Destroy called.");
        if (state.gridInstance) {
            try {
                // Grid.js doesn't have a public destroy. Clear container.
                if (elements.gridJsContainer) { elements.gridJsContainer.innerHTML = ''; }
            } catch (e) { console.error("Error during destroy cleanup:", e); }
            state.gridInstance = null;
        }
        // Clear element references
        elements.gridJsContainer = null;
        elements.highlightInput = null;
        elements.minimapContainer = null;
        elements.visElement = null;
        // Reset other relevant state
        state.highlightTerm = '';
        state.measureMinMax = {};
        console.log("Log Viewer Vis (Grid.js): Destroy cleanup finished.");
    }
};

