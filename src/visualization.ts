// src/visualization.ts
import { VisualizationDefinition, VisConfig, VisQueryResponse, VisData } from './core/types';
import { state, elements, updateCoreState, calculateMeasureMinMax } from './core/state';
import { setupHTML, findElements } from './ui/dom'; // Removed getScrollWrapper import if not used directly here
import { attachAllListeners } from './ui/listeners';
import { applyHighlight } from './ui/highlight';
import { transformLookerDataForGridJs } from './core/dataTransformer';
import { getGridJsOptions } from './core/gridOptions';
// --- Import layout functions ---
import { updateLayout, setupHeaderResizeObserver, disconnectHeaderResizeObserver } from './ui/layout';
import { updateMinimapThumb, updateMinimapMarkers } from './ui/minimap';
import { Grid } from 'gridjs';
import { addControlsToHeader } from './ui/header_controls';

declare var looker: any;

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

            setTimeout(() => {
                if (!findElements(element)) { return; }
                if (!elements.gridJsContainer) { return; }
                elements.gridJsContainer.innerHTML = "";

                try {
                    const initialGridOptions = getGridJsOptions(config, [], []);
                    const grid = new Grid(initialGridOptions);

                    try {
                        grid.render(elements.gridJsContainer);
                        updateLayout(); // Call initial layout adjustments
                        updateMinimapThumb();
                    } catch (renderError) { console.error("Create Error: grid.render() failed.", renderError); state.gridInstance = null; return; }

                    state.gridInstance = grid;

                    if (addControlsToHeader(element)) {
                        if (findElements(element)) {
                            attachAllListeners();
                            updateLayout(); // Adjust layout AGAIN after controls added
                            updateMinimapThumb();
                            setupHeaderResizeObserver(); // Setup observer AFTER final layout adjustments
                        } else { console.error("Create Error: Failed to find elements after adding controls."); }
                    }

                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");

                } catch (initError) { console.error("Create Error: Failed to initialize Grid.js.", initError); state.gridInstance = null; }
            }, 0);

        } catch (error) { console.error("Create Error: setupHTML failed.", error); }
    },

    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) { done(); return; }
        if (!findElements(element)) { done(); return; }

        try {
            updateCoreState(data, queryResponse, config);
            calculateMeasureMinMax();

            const { columns, data: gridData } = transformLookerDataForGridJs(state.originalData, state.queryResponse, state.config, state.measureMinMax);
            const gridOptions = getGridJsOptions(state.config, columns, gridData);

            state.gridInstance.updateConfig(gridOptions);
            console.log("UpdateAsync: Grid config updated.");

            console.log("UpdateAsync: Calling forceRender...");
            try {
                state.gridInstance.forceRender();
                console.log("UpdateAsync: forceRender called successfully.");

                // Add/Verify controls, Re-find elements, Adjust Layout, Re-attach listeners AFTER forceRender
                if (addControlsToHeader(element)) {
                    if (findElements(element)) {
                        updateLayout(); // Adjust layout based on potentially new header height
                        attachAllListeners();
                        setupHeaderResizeObserver(); // Ensure observer is watching the potentially new header
                    } else { logError("UpdateAsync Error: Failed to find elements after forceRender and adding controls."); }
                } else {
                    updateLayout(); // Still adjust layout even if controls failed
                }

            } catch (forceRenderError) { logError("UpdateAsync: forceRender() failed!", forceRenderError); }

            // Post-render actions
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try {
                    applyHighlight(state.highlightTerm);
                    updateMinimapMarkers();
                    updateMinimapThumb();
                } catch (highlightError) { logError("Error during post-render highlight/minimap update:", highlightError); }
                finally { console.log("UpdateAsync: setTimeout callback calling done()."); done(); }
            }, 50);

        } catch (err) { logError(`UpdateAsync: CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`, err); if (err instanceof Error) { console.error(err.stack); } done(); }
    },
    trigger: (event: string, config: any[]) => { console.log("Vis Triggered:", event, config); },

    destroy: function () {
        console.log("Log Viewer Vis (Grid.js): Destroy called.");
        disconnectHeaderResizeObserver(); // Disconnect observer
        if (state.gridInstance) {
            try { if (elements.gridJsContainer) { elements.gridJsContainer.innerHTML = ""; } }
            catch (e) { console.error("Error during destroy cleanup:", e); }
            state.gridInstance = null;
        }
        // Clear element references, reset state...
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
