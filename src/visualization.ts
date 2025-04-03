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
import { addControlsToHeader } from './ui/header_controls'; // <-- Import the helper

// Declare the looker global object
declare var looker: any;

// --- REMOVED Helper function addControlsToHeader (moved to ./ui/header_controls.ts) ---

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
                if (!findElements(element)) { /* ... error handling ... */ return; }
                if (!elements.gridJsContainer) { /* safety check */ return; }
                elements.gridJsContainer.innerHTML = "";

                try {
                    const initialGridOptions = getGridJsOptions(config, [], []);
                    const grid = new Grid(initialGridOptions);

                    try {
                        grid.render(elements.gridJsContainer);
                        setGridWrapperHeight();
                        updateMinimapThumb();
                    } catch (renderError) { /* ... error handling ... */ state.gridInstance = null; return; }

                    state.gridInstance = grid;

                    // --- Call dynamic addition AFTER render ---
                    if (addControlsToHeader(element)) { // Use imported helper
                        // --- Re-find elements and attach listeners AFTER adding controls ---
                        if (findElements(element)) {
                            attachAllListeners();
                        } else {
                            console.error("Create Error: Failed to find elements after adding controls.");
                        }
                    }

                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");

                } catch (initError) { /* ... error handling ... */ state.gridInstance = null; }
            }, 0);

        } catch (error) { console.error("Create Error: setupHTML failed.", error); }
    },

    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) { /* ... handle missing instance ... */ done(); return; }
        if (!findElements(element)) { /* ... handle missing elements ... */ done(); return; }

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

                // --- Add/Verify controls, Re-find elements, Re-attach listeners AFTER forceRender ---
                if (addControlsToHeader(element)) { // Use imported helper
                    if (findElements(element)) {
                        attachAllListeners();
                    } else {
                        logError("UpdateAsync Error: Failed to find elements after forceRender and adding controls.");
                    }
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

        } catch (err) { /* ... error handling ... */ done(); }
    },
    trigger: (event: string, config: any[]) => { console.log("Vis Triggered:", event, config); },

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

