// Basic Looker API Type Definitions
export interface Looker {
    // <<< FIX: Ensure plugins structure is defined >>>
    plugins: {
        visualizations: {
            add: (vis: VisualizationDefinition) => void;
        };
    };
}
export interface LookerChartUtils {
    Utils: {
        htmlForCell: (cell: Cell) => string;
        openDrillMenu: (options: { links: Link[], event: Event }) => void;
        // Add other Utils properties if used (like openUrl, toggleCrossfilter mentioned in sandy.js)
        openUrl?: (url: string, event?: Event, useModal?: boolean, modalOptions?: any) => void;
        toggleCrossfilter?: (options: { pivot_key?: string, event?: any }) => void; // Define based on usage if needed
    };
}
export interface VisConfig {
    showRowNumbers?: boolean;
    [key: string]: any;
}
export interface QueryResponse {
    // <<< FIX: Ensure 'fields' property is correctly defined >>>
    fields: {
        dimensions: Field[];
        measures: Field[];
        // Add pivots, table_calculations etc. if used by your vis
        pivots?: Field[];
        table_calculations?: Field[];
        [key: string]: any; // Allow other field types
    };
    data: Row[];
    [key: string]: any; // Allow other properties like pivots, totals, etc.
}
export interface Field {
    name: string;
    label: string;
    label_short?: string;
    is_measure: boolean;
    type?: string;
    value_format?: string | null;
    can_filter?: boolean; // Added based on usage in previous code
    // Add other field properties if needed
}
export interface Cell {
    value: any;
    rendered?: string;
    html?: string;
    links?: Link[];
    filterable_value?: any; // Added based on usage in previous code
    // Add other cell properties if needed
}
export interface Link {
    label: string;
    type: string;
    type_label: string;
    url: string;
    // Add other link properties if needed
}
export interface Row {
    [fieldName: string]: Cell;
}
export interface VisualizationDefinition {
    id: string;
    label: string;
    options?: { [key: string]: VisOption };
    create: (element: HTMLElement, config: VisConfig) => void;
    updateAsync: (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) => void;
    destroy?: () => void; // Add destroy if implemented
    trigger?: (event: string, config: any[]) => void; // Add trigger if implemented
    addError?: (error: { title?: string, message?: string, group?: string }) => void; // Add error handling if implemented
    clearErrors?: (group?: string) => void; // Add error handling if implemented
    [key: string]: any;
}
export interface VisOption { /* ... */ }

// --- Updated State & Elements ---
type GridJsInstance = any;
export interface VisState {
    originalData: Row[];
    queryResponse: QueryResponse | null;
    config: VisConfig | null;
    gridInstance: GridJsInstance | null;
    highlightTerm?: string;
}
export interface VisElements {
    visElement: HTMLElement | null;
    gridJsContainer: HTMLElement | null;
    highlightInput: HTMLInputElement | null;
    minimapContainer: HTMLElement | null;
}

