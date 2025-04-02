// src/core/gridOptions.ts
import { VisConfig } from './types';

export function getGridJsOptions(
    config: VisConfig | null,
    columns: any[] | undefined = [],
    data: any[][] | undefined = []
): any {
    const shouldClearGrid = (!columns || columns.length === 0) && (!data || data.length === 0);
    return {
        columns: shouldClearGrid ? [] : columns,
        data: shouldClearGrid ? [] : data,
        sort: { multiColumn: true },
        search: true,
        language: { 'search': { 'placeholder': 'Filter value...' } },
        resizable: true,
        fixedHeader: true, // Keep FALSE
        pagination: false,
        autoHeight: true, // <<< ENABLE autoHeight: Grid grows, container scrolls
        width: '100%',
    };
}
