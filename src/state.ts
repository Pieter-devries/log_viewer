import { VisState, VisElements, QueryResponse, Row, VisConfig } from './types';

// Export state directly or wrap in a class/object for more complex management
export const state: VisState = {
    // Data and Query Info
    originalData: [],
    queryResponse: null,
    config: null, // Store the latest config object from Looker

    // UI / Interaction State
    selectedFieldName: 'all', // Default filter field
    showRowNumbers: false, // Default, will be overridden by config
    filterCaseSensitive: false, // Default, will be overridden by config
    highlightCaseSensitive: false, // Default, will be overridden by config
    isDragging: false, // For minimap dragging
};

// Hold element references (populated by dom.ts's findElements)
export const elements: VisElements = {
    visElement: null,
    filterInput: null,
    highlightInput: null,
    fieldSelectElement: null,
    logHeaderArea: null,
    logLinesArea: null,
    minimapContainer: null,
    minimapThumb: null,
    rowNumberCheckbox: null,
    clearFilterButton: null,
    clearHighlightButton: null,
    filterCaseChk: null,
    highlightCaseChk: null,
};

/**
 * Updates the core state of the visualization.
 * Called from updateAsync when new data or configuration arrives.
 * @param newData - The raw data rows from the Looker query.
 * @param newQueryResponse - The full query response object from Looker.
 * @param newConfig - The configuration object from Looker, containing user settings.
 */
export function updateCoreState(newData: Row[], newQueryResponse: QueryResponse, newConfig: VisConfig) {
    console.log("Updating core state with new data and config:", newConfig);

    // Update data and query response
    state.originalData = newData || []; // Ensure data is always an array
    state.queryResponse = newQueryResponse;
    state.config = newConfig; // Store the latest config

    // Update state based on Looker configuration options
    // Use '??' nullish coalescing operator to safely fallback to defaults if config options are missing
    state.showRowNumbers = newConfig?.showRowNumbers ?? false;
    state.filterCaseSensitive = newConfig?.filterCaseSensitive ?? false;
    state.highlightCaseSensitive = newConfig?.highlightCaseSensitive ?? false;

    // Note: state.selectedFieldName is updated directly via its change listener in dom.ts
    // and potentially corrected in main.ts's updateFieldDropdown if the field disappears.
    // It's not directly controlled by a Looker config option in this setup, but could be.

    console.log("Core state after update:", {
        showRowNumbers: state.showRowNumbers,
        filterCaseSensitive: state.filterCaseSensitive,
        highlightCaseSensitive: state.highlightCaseSensitive,
        dataLength: state.originalData.length
    });
}
