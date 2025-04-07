// src/ui/header_controls.ts
import { elements, state } from '../core/state';

/**
 * Finds the Grid.js header and adds/updates the Search label and Highlight controls.
 * Idempotent: Checks if elements already exist before adding.
 * Restores the highlight input value from state.
 * @param visElement The root visualization element (needed to re-run findElements).
 * @returns True if controls were successfully added/verified, false otherwise.
 */
export function addControlsToHeader(visElement: HTMLElement): boolean {
    if (!elements.gridJsContainer) {
        console.error("addControlsToHeader: gridJsContainer not found.");
        return false;
    }
    const gridHead = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-head');
    if (!gridHead) {
        console.error("addControlsToHeader: .gridjs-head not found.");
        return false;
    }

    // --- 1. Add Search Label ---
    const searchContainer = gridHead.querySelector<HTMLElement>('.gridjs-search');
    const searchInput = gridHead.querySelector<HTMLInputElement>('.gridjs-search-input');
    const searchLabelId = 'gridjs-search-label';

    let searchLabel = gridHead.querySelector<HTMLLabelElement>(`#${searchLabelId}`);
    if (searchContainer && !searchLabel) {
        searchLabel = document.createElement('label');
        searchLabel.id = searchLabelId;
        if (searchInput) {
            if (!searchInput.id) searchInput.id = 'gridjs-search-input-dynamic';
            searchLabel.htmlFor = searchInput.id;
        }
        searchLabel.textContent = 'Search:';
        searchLabel.style.color = '#aaa';
        searchLabel.style.fontSize = '11px'; // Smaller font
        searchLabel.style.marginRight = '3px'; // Reduced margin
        searchContainer.parentNode?.insertBefore(searchLabel, searchContainer);
        console.log("Dynamically added Search label.");
    } else if (searchLabel) {
        // Update existing label style if needed
        searchLabel.style.fontSize = '11px';
        searchLabel.style.marginRight = '3px';
    }
    // --- End Search Label ---

    // --- 2. Add/Update Highlight Controls ---
    let highlightInput = gridHead.querySelector<HTMLInputElement>('#highlight-input');
    let highlightLabel = gridHead.querySelector<HTMLLabelElement>('label[for="highlight-input"]');

    if (highlightInput && highlightLabel) {
        console.log("Highlight controls already exist in header.");
        if (highlightInput.value !== state.highlightTerm) {
            highlightInput.value = state.highlightTerm || '';
        }
        // Update styles for tighter fit
        highlightLabel.style.fontSize = '11px';
        highlightLabel.style.marginRight = '3px';
        highlightLabel.style.marginLeft = '10px'; // Reduced margin
        highlightInput.style.padding = '2px 5px'; // Reduced padding
        highlightInput.style.fontSize = '12px';
        highlightInput.style.lineHeight = '1.3';

    } else {
        // Remove potentially orphaned elements if one exists but not the other
        if (highlightInput) highlightInput.remove();
        if (highlightLabel) highlightLabel.remove();

        // Create Label
        highlightLabel = document.createElement('label');
        highlightLabel.htmlFor = 'highlight-input';
        highlightLabel.textContent = 'Highlight:';
        highlightLabel.style.color = '#aaa';
        highlightLabel.style.fontSize = '11px'; // Smaller font
        highlightLabel.style.marginRight = '3px'; // Reduced margin
        highlightLabel.style.marginLeft = '10px'; // Reduced margin

        // Create Input
        highlightInput = document.createElement('input');
        highlightInput.type = 'text';
        highlightInput.id = 'highlight-input';
        highlightInput.placeholder = 'Highlight text...';
        highlightInput.style.backgroundColor = '#2a2a2a';
        highlightInput.style.border = '1px solid #444';
        highlightInput.style.color = '#ddd';
        highlightInput.style.borderRadius = '3px'; // Slightly smaller radius
        highlightInput.style.padding = '2px 5px'; // Reduced padding
        highlightInput.style.fontSize = '12px'; // Match base font
        highlightInput.style.lineHeight = '1.3'; // Reduced line-height
        highlightInput.style.boxSizing = 'border-box';
        highlightInput.value = state.highlightTerm || '';

        // Append the label and input (after search)
        gridHead.appendChild(highlightLabel);
        gridHead.appendChild(highlightInput);
        console.log("Dynamically added Highlight controls to .gridjs-head.");
    }
    return true;
}
