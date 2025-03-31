// Basic Looker API Type Definitions (Add more properties as needed)
export interface Looker {
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
    };
}

export interface VisConfig {
    // Add configuration options defined in the 'options' property of your vis definition
    // Example: show_row_numbers?: boolean;
    [key: string]: any; // Allow other properties
}

export interface QueryResponse {
    fields: {
        dimensions: Field[];
        measures: Field[];
        // Add other field types if used (table_calculations, pivots)
    };
    data: Row[];
    [key: string]: any; // Allow other properties like pivots, totals, etc.
}

export interface Field {
    name: string;
    label: string;
    label_short?: string;
    is_measure: boolean;
    type?: string; // e.g., 'string', 'number', 'time'
    value_format?: string | null;
    // Add other field properties if needed
}

export interface Cell {
    value: any;
    rendered?: string;
    html?: string;
    links?: Link[];
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

// Visualization Definition Interface
export interface VisualizationDefinition {
    id: string;
    label: string;
    options?: { [key: string]: VisOption };
    // Core methods
    create: (element: HTMLElement, config: VisConfig) => void;
    updateAsync: (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) => void;
    // Add other methods used by your vis
    [key: string]: any;
}

export interface VisOption {
    type: string; // e.g., 'string', 'number', 'array', 'boolean'
    label: string;
    display?: string; // e.g., 'text', 'colors', 'radio'
    default?: any;
    values?: { [label: string]: string }[];
    section?: string;
    placeholder?: string;
    order?: number;
}

// Application State & Elements
export interface VisState {
    originalData: Row[];
    queryResponse: QueryResponse | null;
    config: VisConfig | null; // Store Looker's config object
    selectedFieldName: string;
    showRowNumbers: boolean;
    filterCaseSensitive: boolean;
    highlightCaseSensitive: boolean;
    isDragging: boolean; // For minimap
    // Add other state properties
}

export interface VisElements {
    visElement: HTMLElement | null;
    filterInput: HTMLInputElement | null;
    highlightInput: HTMLInputElement | null;
    fieldSelectElement: HTMLSelectElement | null;
    logHeaderArea: HTMLElement | null;
    logLinesArea: HTMLElement | null;
    minimapContainer: HTMLElement | null;
    minimapThumb: HTMLElement | null;
    rowNumberCheckbox: HTMLInputElement | null;
    clearFilterButton: HTMLButtonElement | null;
    clearHighlightButton: HTMLButtonElement | null;
    filterCaseChk: HTMLInputElement | null;
    highlightCaseChk: HTMLInputElement | null;
    // Add other element references
}
