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
            setTimeout(() => {
                if (!findElements(element)) { console.error("Create Error: Critical elements not found."); return; }
                if (elements.gridJsContainer) { elements.gridJsContainer.innerHTML = ''; }
                else { console.error("Create Error: Grid container not found."); return; }
                try {
                    const initialGridOptions = getGridJsOptions(config);
                    const grid = new Grid(initialGridOptions);
                    try {
                        grid.render(elements.gridJsContainer);
                        setGridWrapperHeight(); // Call after initial render
                    }
                    catch (renderError) { console.error("Create Error: grid.render() failed.", renderError); state.gridInstance = null; return; }
                    state.gridInstance = grid;
                    attachAllListeners();
                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");
                } catch (initError) { console.error("Create Error: Failed to initialize Grid.js.", initError); state.gridInstance = null; }
            }, 0);
        } catch (error) { console.error("Create Error: setupHTML failed.", error); }
    },

    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) {
            console.warn("UpdateAsync: Grid instance not ready.");
            done(); return;
        }

        try {
            if (!findElements(element)) { logError("Update Error: Critical elements missing."); done(); return; }
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
                // Call height adjustment AFTER forceRender
                setGridWrapperHeight();
            } catch (forceRenderError) { logError("UpdateAsync: forceRender() failed!", forceRenderError); }

            // Post-render actions
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                try { applyHighlight(state.highlightTerm); }
                catch (highlightError) { logError("Error during post-render highlight/minimap update:", highlightError); }
                finally { console.log("UpdateAsync: setTimeout callback calling done()."); done(); }
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
            try { if (elements.gridJsContainer) { elements.gridJsContainer.innerHTML = ''; } }
            catch (e) { console.error("Error during destroy cleanup:", e); }
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
