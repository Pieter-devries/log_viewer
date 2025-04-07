// src/core/gridOptions.ts
import { VisConfig } from './types';
// import { GridOptions, Column } from 'gridjs'; // Optional Grid.js types

/**
 * Generates the configuration object for the Grid.js instance.
 * Applies resizable: true to each column definition.
 * Uses default autoWidth.
 */
export function getGridJsOptions(
    config: VisConfig | null,
    inputColumns: any[] | undefined = [],
    data: any[][] | undefined = []
): any { // Using 'any' as return type, consider GridOptions

    console.log(`getGridJsOptions called with ${inputColumns?.length ?? 0} columns and ${data?.length ?? 0} data rows.`);

    // Process columns to add resizable: true
    const processedColumns = (inputColumns || []).map(col => {
        let columnDef: any = {};

        if (typeof col === 'string') {
            columnDef = { name: col };
        } else if (typeof col === 'object' && col !== null) {
            columnDef = { ...col };
        } else {
            console.warn("Unexpected column format:", col);
            columnDef = { name: 'unknown' };
        }

        // Apply resizable: true if it's not explicitly set to false
        if (columnDef.resizable !== false) {
            columnDef.resizable = true;
            // Ensure NO explicit minWidth is set here
        }

        if (!columnDef.name) {
            columnDef.name = columnDef.id || 'Unnamed Column';
        }

        return columnDef;
    });

    // Return the Grid.js options object
    return {
        columns: processedColumns,
        data: data || [],
        sort: { multiColumn: true },
        search: true,
        language: { 'search': { 'placeholder': 'Filter value...' } },
        // resizable: true, // Set per-column
        fixedHeader: true,
        pagination: false,
        // autoWidth: true, // Default is true, no need to explicitly set
        width: '100%',
        // height is managed by JS/CSS
    };
}
