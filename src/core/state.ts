// src/core/state.ts
// <<< Import Cell and use VisQueryResponse >>>
import { VisQueryResponse, Row, VisConfig, VisState, VisElements, MeasureMinMax, Cell, VisData } from './types';

// Export the application state singleton
export const state: VisState = {
    originalData: [],
    queryResponse: null,
    config: null,
    gridInstance: null,
    highlightTerm: '',
    measureMinMax: {},
};

// Export the elements references singleton
export const elements: VisElements = {
    visElement: null,
    gridJsContainer: null,
    highlightInput: null,
    minimapContainer: null,
};

/**
 * Updates the core parts of the state (data, queryResponse, config).
 * Called typically at the beginning of updateAsync.
 */
// <<< Use VisData type for newData >>>
export function updateCoreState(newData: VisData, newQueryResponse: VisQueryResponse | null, newConfig: VisConfig | null) {
    console.log("Updating core state", { hasData: !!newData, hasQuery: !!newQueryResponse, hasConfig: !!newConfig });
    state.originalData = newData || [];
    state.queryResponse = newQueryResponse;
    state.config = newConfig;
    // Note: measureMinMax is calculated separately
}

/**
 * Calculates and updates the min/max values for measures if sparklines are enabled.
 */
export function calculateMeasureMinMax() {
    const { config, queryResponse, originalData } = state;
    state.measureMinMax = {}; // Reset

    // Use static option from config
    if (config?.showMeasureSparklines === true && queryResponse?.fields?.measures && originalData.length > 0) {
        const measures = queryResponse.fields.measures;
        console.log(`Preprocessing sparkline data for ${measures.length} measures.`);
        measures.forEach(measureField => {
            let minVal = Infinity, maxVal = -Infinity, hasNumeric = false;
            originalData.forEach(row => {
                const cellData = row[measureField.name];
                // Handle potential PivotCell structure (basic handling)
                const value = (cellData && typeof cellData === 'object' && 'value' in cellData) ? (cellData as Cell).value : cellData;
                const numericValue = Number(value);
                if (typeof numericValue === 'number' && isFinite(numericValue)) {
                    minVal = Math.min(minVal, numericValue);
                    maxVal = Math.max(maxVal, numericValue);
                    hasNumeric = true;
                }
            });
            if (hasNumeric) {
                // Ensure measureMinMax is not undefined before assigning
                if (!state.measureMinMax) state.measureMinMax = {};
                state.measureMinMax[measureField.name] = { min: minVal, max: maxVal };
            }
        });
        console.log("Calculated Measure Min/Max:", state.measureMinMax);
    }
}
