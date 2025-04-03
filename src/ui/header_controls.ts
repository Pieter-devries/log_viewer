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
    const searchInput = gridHead.querySelector<HTMLInputElement>('.gridjs-search-input'); // Find the actual input
    const searchLabelId = 'gridjs-search-label'; // Use an ID for the label

    if (searchContainer && !gridHead.querySelector(`#${searchLabelId}`)) {
        const searchLabel = document.createElement('label');
        searchLabel.id = searchLabelId; // Assign ID
        if (searchInput) {
            // Try to associate label with input if possible (Grid.js might not assign an ID)
            if (!searchInput.id) searchInput.id = 'gridjs-search-input-dynamic'; // Assign dynamic ID if none exists
            searchLabel.htmlFor = searchInput.id;
        }
        searchLabel.textContent = 'Search:';
        searchLabel.style.color = '#aaa';
        searchLabel.style.fontSize = '0.9em';
        searchLabel.style.marginRight = '5px';
        searchContainer.parentNode?.insertBefore(searchLabel, searchContainer);
        console.log("Dynamically added Search label.");
    } else if (searchContainer && gridHead.querySelector(`#${searchLabelId}`)) {
        console.log("Search label already exists.");
    } else {
        console.warn("addControlsToHeader: .gridjs-search container not found. Cannot add Search label.");
    }

    // --- 2. Add/Update Highlight Controls ---
    let highlightInput = gridHead.querySelector<HTMLInputElement>('#highlight-input');
    if (highlightInput) {
        console.log("Highlight controls already exist in header.");
        // Ensure the value is up-to-date
        if (highlightInput.value !== state.highlightTerm) {
            highlightInput.value = state.highlightTerm || '';
        }
    } else {
        // Create Label
        const highlightLabel = document.createElement('label');
        highlightLabel.htmlFor = 'highlight-input';
        highlightLabel.textContent = 'Highlight:';
        highlightLabel.style.color = '#aaa';
        highlightLabel.style.fontSize = '0.9em';
        highlightLabel.style.marginRight = '5px';
        highlightLabel.style.marginLeft = '15px'; // Space before highlight

        // Create Input
        highlightInput = document.createElement('input');
        highlightInput.type = 'text';
        highlightInput.id = 'highlight-input';
        highlightInput.placeholder = 'Highlight text...';
        highlightInput.style.backgroundColor = '#2a2a2a';
        highlightInput.style.border = '1px solid #444';
        highlightInput.style.color = '#ddd';
        highlightInput.style.borderRadius = '4px';
        highlightInput.style.padding = '1px 5px'; // Use reduced padding
        highlightInput.style.fontSize = '13px';
        highlightInput.style.lineHeight = '1.4';
        highlightInput.style.boxSizing = 'border-box';
        highlightInput.value = state.highlightTerm || '';

        // Append the label and input (after search)
        gridHead.appendChild(highlightLabel);
        gridHead.appendChild(highlightInput);
        console.log("Dynamically added Highlight controls to .gridjs-head.");
    }
    return true; // Indicate success
}
