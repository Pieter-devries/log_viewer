import { VisState, VisElements, QueryResponse, Row, VisConfig } from './types';

type GridJsInstance = any;

// Export state directly
export const state: VisState = {
    originalData: [],
    queryResponse: null,
    config: null,
    gridInstance: null as GridJsInstance | null,
    highlightTerm: '',
};

// Hold element references
export const elements: VisElements = {
    visElement: null,
    gridJsContainer: null,
    highlightInput: null,
    minimapContainer: null, // <<< Initialize minimap reference
};

/** Updates the core state */
export function updateCoreState(newData: Row[], newQueryResponse: QueryResponse, newConfig: VisConfig) {
    state.originalData = newData || [];
    state.queryResponse = newQueryResponse;
    state.config = newConfig;
}
