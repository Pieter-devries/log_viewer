// src/core/gridOptions.ts
import { VisConfig } from './types';
// <<< Remove GridOptions import if it doesn't exist >>>
// import { GridOptions } from 'gridjs';

/**
 * Generates the configuration object for the Grid.js instance.
 * @param config - The Looker visualization config object.
 * @param columns - The columns definition array.
 * @param data - The data array for the grid.
 * @returns Grid.js options object.
 */
export function getGridJsOptions(
    config: VisConfig | null,
    columns: any[] | undefined = [],
    data: any[][] | undefined = []
): any { // <<< Use 'any' or Record<string, any> instead of GridOptions >>>

    const shouldClearGrid = (!columns || columns.length === 0) && (!data || data.length === 0);
    console.log(`getGridJsOptions: Should clear grid? ${shouldClearGrid}`);

    return {
        columns: shouldClearGrid ? [] : columns,
        data: shouldClearGrid ? [] : data,
        sort: { multiColumn: true },
        search: true,
        language: { 'search': { 'placeholder': 'Filter value...' } },
        resizable: true,
        fixedHeader: true,
        pagination: false,
        // @ts-ignore - autoHeight might not be in standard types but can exist
        autoHeight: false,
        width: '100%',
        // height: '100%', // Removed
    };
}
