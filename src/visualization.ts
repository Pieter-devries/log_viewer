// src/visualization.ts
import { VisualizationDefinition, VisConfig, VisQueryResponse, VisData, VisOptions } from './core/types';
import { state, elements, updateCoreState, calculateMeasureMinMax } from './core/state';
import { setupHTML, findElements } from './ui/dom';
import { attachAllListeners } from './ui/listeners';
import { applyHighlight } from './ui/highlight';
import { transformLookerDataForGridJs } from './core/dataTransformer';
import { getGridJsOptions } from './core/gridOptions';
import { setGridWrapperHeight } from './ui/layout';
import { updateMinimapThumb } from './ui/minimap'; // Import thumb update function
import { Grid } from 'gridjs';

// Declare the looker global object
declare var looker: any;

export const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs', // Unique ID for the visualization
    label: 'Log Viewer (Grid.js)', // Display name
    options: { // Configuration options displayed in the Looker UI
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
        showMeasureSparklines: { type: 'boolean', label: 'Show Sparklines for Measures', default: false, section: 'Display', order: 2 },
    },

    // Called once to set up the initial state and DOM structure
    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);
            // Use setTimeout to ensure DOM elements are ready after innerHTML assignment
            setTimeout(() => {
                // Ensure base elements are found after setupHTML
                if (!findElements(element)) {
                    console.error("Create Error: Critical elements not found after setupHTML.");
                    return;
                }
                // Ensure the container exists and clear it (Grid.js expects an empty container)
                if (elements.gridJsContainer) {
                    elements.gridJsContainer.innerHTML = ""; // Clear container
                } else {
                    console.error("Create Error: Grid container element not found.");
                    return;
                }

                try {
                    // Initialize grid options in 'create' with the passed config,
                    // but use empty arrays for columns and data as they are not available yet.
                    const initialGridOptions = getGridJsOptions(config, [], []);

                    // Create the Grid.js instance with initial (likely empty) options
                    const grid = new Grid(initialGridOptions);

                    try {
                        // Render the grid into the container
                        grid.render(elements.gridJsContainer);
                        // Set initial height
                        setGridWrapperHeight();
                        // --- Call initial thumb update ---
                        updateMinimapThumb();
                        // --- End change ---
                    } catch (renderError) {
                        console.error("Create Error: grid.render() failed.", renderError);
                        state.gridInstance = null; // Ensure state reflects failure
                        return;
                    }

                    // Store the instance and attach listeners
                    state.gridInstance = grid;
                    attachAllListeners(); // Listeners should now find the grid instance

                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");

                } catch (initError) {
                    console.error("Create Error: Failed to initialize Grid.js.", initError);
                    state.gridInstance = null; // Ensure state reflects failure
                }
            }, 0); // setTimeout with 0 delay defers execution slightly

        } catch (error) {
            console.error("Create Error: setupHTML failed.", error);
        }
    },

    // Called whenever data or configuration changes
    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        // Check if grid instance exists before proceeding
        if (!state.gridInstance) {
            console.warn("UpdateAsync: Grid instance not available, possibly due to creation error. Aborting update.");
            done(); // Signal completion even if aborted
            return;
        }

        // Ensure elements are still findable (though usually handled in create)
        if (!findElements(element)) {
            logError("Update Error: Critical elements missing during update.");
            done();
            return;
        }

        try {
            // Update core state with new data/config
            updateCoreState(data, queryResponse, config);
            calculateMeasureMinMax(); // Calculate based on new data

            // Transform the actual data received from Looker
            const { columns, data: gridData } = transformLookerDataForGridJs(
                state.originalData, state.queryResponse, state.config, state.measureMinMax
            );

            // Get grid options using the *actual* columns and data
            const gridOptions = getGridJsOptions(state.config, columns, gridData);

            // Update the grid configuration with the new options
            state.gridInstance.updateConfig(gridOptions);
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            try {
                // Force the grid to re-render with the updated config/data
                state.gridInstance.forceRender();
                console.log("UpdateAsync: forceRender called successfully.");
                // Adjust height after rendering
                setGridWrapperHeight();
            } catch (forceRenderError) {
                logError("UpdateAsync: forceRender() failed!", forceRenderError);
                // Consider if we should still call done() or try to recover
            }

            // Post-render actions (like applying highlight)
            // Use setTimeout to ensure rendering is complete
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try {
                    // Apply highlighting based on the current term in state
                    applyHighlight(state.highlightTerm);
                    // --- Update thumb after potential DOM changes ---
                    updateMinimapThumb();
                    // --- End change ---
                } catch (highlightError) {
                    logError("Error during post-render highlight/minimap update:", highlightError);
                } finally {
                    console.log("UpdateAsync: setTimeout callback calling done().");
                    done(); // Signal Looker that the update is complete
                }
            }, 50); // Small delay might help ensure DOM is fully ready

        } catch (err) {
            logError(`UpdateAsync: CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`, err);
            if (err instanceof Error) { console.error(err.stack); }
            done(); // Ensure done() is called even if errors occur
        }
    },
    trigger: (event: string, config: any[]) => {
        console.log("Vis Triggered:", event, config);
        // Potentially handle specific triggers if needed
    },

    // Called when the visualization is removed or Looker updates visualization
    destroy: function () {
        console.log("Log Viewer Vis (Grid.js): Destroy called.");
        // Optional: Call removeAllListeners() here if you implement it
        if (state.gridInstance) {
            try {
                // Attempt to clean up the container used by Grid.js
                if (elements.gridJsContainer) {
                    elements.gridJsContainer.innerHTML = "";
                }
                // Call Grid.js destroy method if it exists (check Grid.js docs)
                // if (typeof state.gridInstance.destroy === 'function') {
                //     state.gridInstance.destroy();
                // }
            } catch (e) {
                console.error("Error during destroy cleanup:", e);
            }
            // Release the grid instance reference
            state.gridInstance = null;
        }
        // Clear element references
        elements.gridJsContainer = null;
        elements.highlightInput = null;
        elements.minimapContainer = null;
        elements.minimapThumb = null; // Clear thumb ref
        elements.visElement = null;
        // Reset other relevant state
        state.highlightTerm = '';
        state.measureMinMax = {};
        console.log("Log Viewer Vis (Grid.js): Destroy cleanup finished.");
    }
};

// --- Looker Visualization API Registration ---
// Add a check for the looker object for safety
if (looker && looker.plugins && looker.plugins.visualizations) {
    // Register the visualization with Looker
    looker.plugins.visualizations.add(visDefinition);
    console.log("Log Viewer (Grid.js) visualization registered.");
} else {
    console.error("Looker environment not found. Visualization not registered.");
}

// Optional: Add CSS for the grabbing cursor dynamically
const grabbingStyle = document.createElement('style');
grabbingStyle.textContent = ` #gridjs-minimap.grabbing { cursor: grabbing !important; } `;
if (document.head) { document.head.appendChild(grabbingStyle); }
else { document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(grabbingStyle); }); }

