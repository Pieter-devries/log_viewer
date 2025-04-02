// src/visualization.ts
import { VisualizationDefinition, VisConfig, VisQueryResponse, VisData, VisOptions, Row, Field } from './core/types';
import { state, elements, updateCoreState, calculateMeasureMinMax } from './core/state';
import { setupHTML, findElements } from './ui/dom';
import { attachAllListeners } from './ui/listeners';
import { applyHighlight } from './ui/highlight';
import { transformLookerDataForGridJs } from './core/dataTransformer';
import { getGridJsOptions } from './core/gridOptions';
import { setGridWrapperHeight } from './ui/layout';
import { Grid } from 'gridjs';

export const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-gridjs',
    label: 'Log Viewer (Grid.js)',
    options: { /* ... options ... */
        showRowNumbers: { type: 'boolean', label: 'Show Row Numbers', default: true, section: 'Display', order: 1 },
        showMeasureSparklines: { type: 'boolean', label: 'Show Sparklines for Measures', default: false, section: 'Display', order: 2 },
    },

    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Grid.js): Create called.");
        try {
            setupHTML(element);
            setTimeout(() => {
                if (!findElements(element)) { return; }
                if (elements.gridJsContainer) { elements.gridJsContainer.innerHTML = ''; } else { return; }
                try {
                    const initialGridOptions = getGridJsOptions(config);
                    const grid = new Grid(initialGridOptions);
                    try {
                        grid.render(elements.gridJsContainer);
                        setGridWrapperHeight();
                    }
                    catch (renderError) { /* error handling */ state.gridInstance = null; return; }
                    state.gridInstance = grid;
                    attachAllListeners();
                    console.log("Log Viewer Vis (Grid.js): Create finished successfully.");
                } catch (initError) { /* error handling */ state.gridInstance = null; }
            }, 0);
        } catch (error) { /* error handling */ }
    },

    updateAsync: function (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: any, done: () => void) {
        console.log("UpdateAsync: START.");
        const logError = (message: string, err?: any) => { console.error(message, err); };

        if (!state.gridInstance) { /* ... handle missing instance ... */ done(); return; }

        try {
            if (!findElements(element)) { logError("Update Error: Critical elements missing."); done(); return; }
            updateCoreState(data, queryResponse, config);
            // if (queryResponse?.fields?.measures?.[0]) { console.log(...) } // Optional logs
            // if (queryResponse?.fields?.dimensions?.[0]) { console.log(...) }
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
            } catch (forceRenderError) { logError("UpdateAsync: forceRender() failed!", forceRenderError); }

            // Post-render actions
            setTimeout(() => {
                console.log("UpdateAsync: setTimeout callback START.");
                (window as any).__logged_sparkline_gen = {};
                try { applyHighlight(state.highlightTerm); }
                catch (highlightError) { logError("Error during post-render highlight/minimap update:", highlightError); }
                finally { console.log("UpdateAsync: setTimeout callback calling done()."); done(); }
            }, 50);

        } catch (err) { /* error handling */ done(); }
    },

    trigger: (event: string, config: any[]) => { /* ... */ },
    destroy: function () { /* ... */ }
};
