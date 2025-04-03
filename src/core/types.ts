// src/core/types.ts

// API Globals (Based on official types provided)
export interface Looker {
    plugins: {
        visualizations: {
            add: (visualization: VisualizationDefinition) => void
        }
    }
}

export interface LookerChartUtils {
    Utils: {
        openDrillMenu: (options: { links: Link[], event: object }) => void
        openUrl: (url: string, event: object) => void
        textForCell: (cell: Cell) => string
        filterableValueForCell: (cell: Cell) => string
        htmlForCell: (cell: Cell, context?: string, fieldDefinitionForCell?: Field, customHtml?: string) => string // Added Field type hint
    }
}

// Looker visualization types (Based on official types provided)
export interface VisualizationDefinition {
    id?: string
    label?: string
    options: VisOptions // Expects an object
    addError?: (error: VisualizationError) => void
    clearErrors?: (errorName?: string) => void
    create: (element: HTMLElement, settings: VisConfig) => void
    trigger?: (event: string, config: object[]) => void
    updateAsync?: (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: VisUpdateDetails | undefined, updateComplete: () => void) => void
    destroy?: () => void
    // Add other methods like update if needed
    [key: string]: any; // Allow other properties Looker might add
}

export interface VisOptions { [optionName: string]: VisOption }

export interface VisOptionValue { [label: string]: string }

export interface VisQueryResponse {
    [key: string]: any
    data: VisData
    fields: {
        // Use specific optional properties
        dimensions?: Field[]
        measures?: Field[]
        pivots?: Field[]
        table_calculations?: Field[]
    }
    pivots?: Pivot[]
}

// Define Field based on usage and available properties
export interface Field {
    name: string;
    label: string;
    label_short?: string;
    // is_measure: boolean; // Removed as unreliable
    type?: string; // e.g., 'number', 'string', 'date_date', etc.
    value_format?: string | null;
    can_filter?: boolean;
    category?: 'dimension' | 'measure'; // Often available
    align?: string;
    description?: string;
    tags?: string[];
    // Add other potentially useful properties
    view?: string;
    view_label?: string;
    suggest_dimension?: string;
    suggest_explore?: string;
    suggestable?: boolean;
    is_numeric?: boolean;
    is_filterable?: boolean;
    is_fiscal?: boolean;
    is_timeframe?: boolean;
    // ... any other properties observed from console logs
}


export interface Pivot {
    key: string
    is_total: boolean
    data: { [key: string]: string }
    metadata: { [key: string]: { [key: string]: string } }
}

export interface Link {
    label: string
    type: string
    type_label: string
    url: string
}

export interface Cell {
    [key: string]: any // Allow other properties Looker might add to cells
    value: any
    rendered?: string
    html?: string
    links?: Link[]
}

export type VisData = Row[] // Alias for clarity

export interface Row {
    [fieldName: string]: Cell | PivotCell // Looker data rows map field names to Cells (or PivotCells if pivoted)
}

// Define PivotCell based on official types (though likely not used in this vis)
export interface PivotCell {
    [pivotKey: string]: Cell
}


export interface VisConfig {
    [key: string]: any // Config object holds option values
}

export type VisConfigValue = any

export interface VisUpdateDetails {
    changed: {
        config?: string[]
        data?: boolean
        queryResponse?: boolean
        size?: boolean
    }
}

export interface VisOption {
    type: string,
    values?: VisOptionValue[],
    display?: string,
    default?: any,
    label: string,
    section?: string,
    placeholder?: string,
    display_size?: 'half' | 'third' | 'normal'
    order?: number
    min?: number
    max?: number
    step?: number
    required?: boolean
    supports?: string[]
}

export interface VisualizationError {
    group?: string
    message?: string
    title?: string
    retryable?: boolean
    warning?: boolean
}


// --- State & Elements Interfaces ---
export interface MeasureMinMax { min: number; max: number; }

export interface VisState {
    originalData: Row[]; // Use Row[] which is VisData
    queryResponse: VisQueryResponse | null;
    config: VisConfig | null;
    gridInstance: any | null; // Grid.js instance type
    highlightTerm?: string;
    measureMinMax?: Record<string, MeasureMinMax>;
}

export interface VisElements {
    visElement: HTMLElement | null;
    gridJsContainer: HTMLElement | null;
    highlightInput: HTMLInputElement | null;
    minimapContainer: HTMLElement | null;
    minimapThumb: HTMLElement | null;
}
