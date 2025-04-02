// src/core/gridOptions.ts
import { VisConfig } from './types';

/**
 * Generates the configuration object for the Grid.js instance.
 */
export function getGridJsOptions(
    config: VisConfig | null,
    columns: any[] | undefined = [],
    data: any[][] | undefined = []
): any { // Use 'any' or Record<string, any> as GridOptions type isn't exported

    const shouldClearGrid = (!columns || columns.length === 0) && (!data || data.length === 0);
    console.log(`getGridJsOptions: Should clear grid? ${shouldClearGrid}`);

    return {
        columns: shouldClearGrid ? [] : columns,
        data: shouldClearGrid ? [] : data,
        sort: { multiColumn: true },
        search: true,
        language: { 'search': { 'placeholder': 'Filter value...' } },
        resizable: true,
        fixedHeader: true, // <<< Re-enable fixed header with JS height calc >>>
        pagination: false,
        autoHeight: false, // <<< Keep FALSE for internal scroll >>>
        width: '100%',
        // height property is not set here; managed by JS/CSS
    };
}
