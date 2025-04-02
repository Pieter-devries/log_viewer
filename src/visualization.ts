// src/visualization.ts
import { VisualizationDefinition, VisConfig, VisQueryResponse, VisData, VisOptions } from './core/types';
import { state, elements, updateCoreState, calculateMeasureMinMax } from './core/state';
import { setupHTML, findElements } from './ui/dom';
import { attachAllListeners } from './ui/listeners';
import { applyHighlight } from './ui/highlight';
import { transformLookerDataForGridJs } from './core/dataTransformer';
import { getGridJsOptions } from './core/gridOptions';
import { setGridWrapperHeight } from './ui/layout'; // <<< Import height function
import { Grid } from 'gridjs';

export const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs',
    label: 'Log Viewer (Grid.js)',
    options: {
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
        showMeasureSparklines: { type: 'boolean', label: 'Show Sparklines for Measures', default: false, section: 'Display', order: 2 },
    },

    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);
            // Use setTimeout to ensure DOM elements are ready
            setTimeout(() => {
                // Ensure base elements are found after setupHTML
                if (!findElements(element)) {
                    console.error("Create Error: Critical elements not found after setupHTML.");
                    return;
                }
                // Ensure the container exists and clear it
                if (elements.gridJsContainer) {
                    elements.gridJsContainer.innerHTML = '';
                } else {
                    console.error("Create Error: Grid container element not found.");
                    return;
                }

                try {
                    // --- MODIFIED LINE ---
                    // Initialize grid options in 'create' with the passed config,
                    // but use empty arrays for columns and data as they are not available yet.
                    // Provide 'true' for the required 'resizable' argument.
                    const initialGridOptions = getGridJsOptions(config, [], []);
                    // --- END MODIFIED LINE ---

                    // Create the Grid.js instance with initial (likely empty) options
                    const grid = new Grid(initialGridOptions);

                    try {
                        // Render the grid into the container
                        grid.render(elements.gridJsContainer);
                        // Set initial height
                        setGridWrapperHeight();
                    }
                    catch (renderError) {
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

    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        // Do not proceed if grid wasn't successfully created
        if (!state.gridInstance) {
            console.warn("UpdateAsync: Grid instance not available, possibly due to creation error. Aborting update.");
            done(); // Signal completion even if aborted
            return;
        }

        // Ensure elements are still available (though usually handled in create)
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
            }

            // Post-render actions (like applying highlight)
            // Use setTimeout to ensure rendering is complete
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try {
                    // Apply highlighting based on the current term in state
                    applyHighlight(state.highlightTerm);
                }
                catch (highlightError) {
                    logError("Error during post-render highlight/minimap update:", highlightError);
                }
                finally {
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
    },

    destroy: function () {
        console.log("Log Viewer Vis (Grid.js): Destroy called.");
        // Optional: Call removeAllListeners() here if you implement it
        if (state.gridInstance) {
            try {
                // Attempt to clean up the container
                if (elements.gridJsContainer) {
                    elements.gridJsContainer.innerHTML = '';
                }
            }
            catch (e) {
                console.error("Error during destroy cleanup:", e);
            }
            // Release the grid instance reference
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
