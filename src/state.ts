import { VisState, VisElements, QueryResponse, Row, VisConfig } from './types';

// Export state directly or wrap in a class/object for more complex management
export const state: VisState = {
    originalData: [],
    queryResponse: null,
    config: null,
    selectedFieldName: 'all',
    showRowNumbers: false,
    filterCaseSensitive: false,
    highlightCaseSensitive: false,
    isDragging: false,
};

// Hold element references (populated by dom.ts)
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

// Example function to update state (could be more sophisticated)
export function updateCoreState(newData: Row[], newQueryResponse: QueryResponse, newConfig: VisConfig) {
    console.log("Updating core state");
    state.originalData = newData;
    state.queryResponse = newQueryResponse;
    state.config = newConfig; // Update config as well
}