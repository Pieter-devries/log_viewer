// src/core/gridOptions.ts
import { VisConfig } from './types';
// Consider importing Grid.js types if available for better type safety
// import { GridOptions, Column } from 'gridjs';

/**
 * Generates the configuration object for the Grid.js instance.
 * Applies resizable: true to each column definition.
 */
export function getGridJsOptions(
    config: VisConfig | null, // Keep config for potential future use
    // Expect columns array from transformLookerDataForGridJs
    // It might contain strings or partial column definition objects
    inputColumns: any[] | undefined = [], // Using 'any[]' as per original, consider specific type
    data: any[][] | undefined = []
    // Removed the 'resizable: true' argument from the signature
): any { // Using 'any' as per original, consider GridOptions type

    console.log(`getGridJsOptions called with ${inputColumns?.length ?? 0} columns and ${data?.length ?? 0} data rows.`);

    // Process columns to add resizable: true to each one
    const processedColumns = (inputColumns || []).map(col => {
        let columnDef: any = {}; // Using 'any', consider a specific ColumnDef type

        // Handle case where columns might just be strings (names)
        if (typeof col === 'string') {
            columnDef = { name: col };
        } else if (typeof col === 'object' && col !== null) {
            columnDef = { ...col }; // Copy existing properties from object
        } else {
            console.warn("Unexpected column format:", col);
            // Fallback or skip? For now, create a minimal object.
            columnDef = { name: 'unknown' };
        }

        // --- Apply resizable: true to each column ---
        columnDef.resizable = true;
        // -------------------------------------------

        // Optional: Ensure an ID exists if needed (useful for state/API interactions)
        // if (!columnDef.id && columnDef.name && typeof columnDef.name === 'string') {
        //     columnDef.id = columnDef.name.toLowerCase().replace(/\s+/g, '_');
        // }

        return columnDef;
    });

    // The shouldClearGrid logic is removed, assuming create/updateAsync handle
    // providing empty vs. populated arrays appropriately.

    // Return the Grid.js options object
    return {
        columns: processedColumns, // Use the processed columns array
        data: data || [], // Ensure data is at least an empty array
        sort: { multiColumn: true }, // Keep user's sort config
        search: true, // Keep search enabled
        language: { 'search': { 'placeholder': 'Filter value...' } }, // Keep custom placeholder
        resizable: true, // REMOVED top-level resizable
        fixedHeader: true, // Keep fixed header
        pagination: false, // Keep pagination disabled
        // autoHeight: false, // Keep autoHeight disabled (Note: Grid.js might manage height differently)
        width: '100%', // Keep width setting
        // height property is not set here; managed by JS/CSS
    };
}
