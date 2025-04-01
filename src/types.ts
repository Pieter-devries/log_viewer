// types.ts

// Use the official Looker types provided by the user, with corrections

// API Globals
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
        htmlForCell: (cell: Cell, context?: string, fieldDefinitionForCell?: any, customHtml?: string) => string
    }
}
/**
 * Minimal representation of a Crossfilter action
 */
export interface Crossfilter {
    field: string
    values: string[]
    range?: [string, string]
}

// Looker visualization types
export interface VisualizationDefinition {
    id?: string
    label?: string
    options: VisOptions // Expects an object
    addError?: (error: VisualizationError) => void
    clearErrors?: (errorName?: string) => void
    create: (element: HTMLElement, settings: VisConfig) => void
    onCrossfilter?: (crossfilters: Crossfilter[], event: Event | null) => void,
    trigger?: (event: string, config: object[]) => void // Keep trigger definition
    update?: (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details?: VisUpdateDetails) => void
    updateAsync?: (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: VisUpdateDetails | undefined, updateComplete: () => void) => void
    destroy?: () => void
}

export interface VisOptions { [optionName: string]: VisOption }

export interface VisOptionValue { [label: string]: string }

// Use the official VisQueryResponse structure, fixing the 'fields' definition
export interface VisQueryResponse {
    [key: string]: any
    data: VisData
    fields: {
        // <<< Use specific optional properties instead of index signature >>>
        dimensions?: Field[]
        measures?: Field[]
        pivots?: Field[]
        table_calculations?: Field[]
        // Remove: [key: string]: any[] // <<< REMOVED to fix TS(2411)
    }
    pivots?: Pivot[] // Make optional based on usage
}

// Define Field based on usage and official types context
export interface Field {
    name: string;
    label: string;
    label_short?: string;
    // is_measure: boolean; // Removed as unreliable
    type?: string;
    value_format?: string | null;
    can_filter?: boolean;
    category?: 'dimension' | 'measure'; // Add category if available
    align?: string;
    description?: string;
    default_filter_value?: any;
    // Add other field properties if needed
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
    [key: string]: any
    value: any
    rendered?: string
    html?: string
    links?: Link[]
}

export interface FilterData {
    add: string
    field: string
    rendered: string
}

export interface PivotCell {
    [pivotKey: string]: Cell
}

export interface Row {
    [fieldName: string]: PivotCell | Cell
}

export type VisData = Row[]

export interface VisConfig {
    [key: string]: VisConfigValue
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
export interface VisState { originalData: Row[]; queryResponse: VisQueryResponse | null; config: VisConfig | null; gridInstance: any | null; highlightTerm?: string; measureMinMax?: Record<string, MeasureMinMax>; }
export interface VisElements { visElement: HTMLElement | null; gridJsContainer: HTMLElement | null; highlightInput: HTMLInputElement | null; minimapContainer: HTMLElement | null; }