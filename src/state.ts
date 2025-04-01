// state.ts
// <<< Import the correct interface name from types.ts >>>
import { VisQueryResponse, Row, VisConfig } from './types';

// Define the structure for storing min/max values for a measure
// Needs to be exported because main.ts imports it
export interface MeasureMinMax {
    min: number;
    max: number;
}

// Define the overall state structure for the visualization
export interface VisState {
    // Use VisData (Row[]) and VisQueryResponse from types.ts
    originalData: Row[]; // Assuming Row[] is equivalent to VisData
    queryResponse: VisQueryResponse | null;
    config: VisConfig | null;
    gridInstance: any | null; // Replace 'any' with GridJs type if available
    highlightTerm?: string;
    measureMinMax?: Record<string, MeasureMinMax>; // Store min/max for measures by field name
}

// Define the structure for holding references to key DOM elements
export interface VisElements {
    visElement: HTMLElement | null;
    gridJsContainer: HTMLElement | null;
    highlightInput: HTMLInputElement | null;
    minimapContainer: HTMLElement | null;
}

// Export the application state singleton
export const state: VisState = {
    originalData: [],
    queryResponse: null,
    config: null,
    gridInstance: null,
    highlightTerm: '',
    measureMinMax: {}, // Initialize as an empty object
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
 * @param newData - The new data array from Looker (should match VisData type).
 * @param newQueryResponse - The new query response object from Looker.
 * @param newConfig - The new configuration object from Looker.
 */
// <<< Use VisQueryResponse in the function signature >>>
export function updateCoreState(newData: Row[], newQueryResponse: VisQueryResponse, newConfig: VisConfig) {
    console.log("Updating core state", { hasData: !!newData, hasQuery: !!newQueryResponse, hasConfig: !!newConfig });
    state.originalData = newData || [];
    state.queryResponse = newQueryResponse;
    state.config = newConfig;
    // Note: measureMinMax is calculated separately in updateAsync after core state is updated
}
