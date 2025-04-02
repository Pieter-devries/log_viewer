// src/ui/minimap.ts
import { elements } from '../core/state';

// State for Minimap Dragging (Internal)
let isDraggingMinimap = false;
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;

/**
 * Updates minimap markers based on highlights.
 */
export function updateMinimap(): void {
    if (!elements.minimapContainer || !elements.gridJsContainer) { return; }
    const minimap = elements.minimapContainer;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');

    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    if (!gridWrapper) { return; }
    const tableBody = gridWrapper.querySelector<HTMLElement>('.gridjs-tbody');
    if (!tableBody) { return; }

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    const minimapHeight = minimap.offsetHeight;

    // <<< Log scroll heights for debugging >>>
    console.log(`updateMinimap - Scroll Heights: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (scrollHeight <= clientHeight || minimapHeight <= 0) { return; }
    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    if (highlightedMarks.length === 0) { return; }

    const processedRows = new Set<HTMLElement>();
    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr');
        if (!(row instanceof HTMLElement) || processedRows.has(row)) { return; }
        processedRows.add(row);
        const rowOffsetTop = row.offsetTop;
        const tableBodyOffsetTop = tableBody.offsetTop;
        const totalOffset = rowOffsetTop + tableBodyOffsetTop;
        const markerTop = (totalOffset / scrollHeight) * minimapHeight;
        const marker = document.createElement('div');
        marker.className = 'minimap-marker';
        marker.style.top = `${Math.max(0, Math.min(markerTop, minimapHeight - 2))}px`;
        minimap.appendChild(marker);
    });
}


// --- Minimap Drag Handlers ---

/** Handles mousedown on minimap */
export function handleMinimapMouseDown(event: MouseEvent): void {
    if (!elements.minimapContainer || !elements.gridJsContainer) return;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) return;

    event.preventDefault();
    isDraggingMinimap = true;
    elements.minimapContainer.classList.add('grabbing');

    // <<< Log scroll heights on click >>>
    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    console.log(`Minimap MouseDown: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    // Check if scrolling is actually possible
    if (scrollHeight <= clientHeight) {
        console.log("Minimap MouseDown: No scrolling needed (scrollHeight <= clientHeight).");
        isDraggingMinimap = false; // Reset state
        elements.minimapContainer.classList.remove('grabbing');
        return; // Don't attach listeners if no scroll needed
    }

    const rect = elements.minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    const minimapHeight = elements.minimapContainer.offsetHeight;

    let targetScrollTop = (mouseY / minimapHeight) * (scrollHeight - clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight));

    console.log(`Minimap MouseDown: Attempting to set scrollTop to ${targetScrollTop}`);
    gridWrapper.scrollTop = targetScrollTop;
    // <<< Log scrollTop *after* setting it >>>
    console.log(`Minimap MouseDown: scrollTop is now ${gridWrapper.scrollTop}`);


    // Add global listeners
    globalMouseMoveListener = (moveEvent: MouseEvent) => handleMinimapMouseMove(moveEvent);
    globalMouseUpListener = (upEvent: MouseEvent) => handleMinimapMouseUp(upEvent);
    document.addEventListener('mousemove', globalMouseMoveListener);
    document.addEventListener('mouseup', globalMouseUpListener);
}

/** Handles mousemove during drag */
function handleMinimapMouseMove(event: MouseEvent): void {
    if (!isDraggingMinimap || !elements.minimapContainer || !elements.gridJsContainer) return;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) return;

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapHeight = elements.minimapContainer.offsetHeight;
    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;

    if (scrollHeight <= clientHeight) return; // Extra safety check

    let mouseY = event.clientY - rect.top;
    mouseY = Math.max(0, Math.min(mouseY, minimapHeight)); // Clamp Y

    let targetScrollTop = (mouseY / minimapHeight) * (scrollHeight - clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight)); // Clamp scroll

    gridWrapper.scrollTop = targetScrollTop;
    // console.log(`Minimap MouseMove: scrollTop set to ${targetScrollTop}`); // Optional verbose log
}

/** Handles mouseup to end drag */
function handleMinimapMouseUp(event: MouseEvent): void {
    if (!isDraggingMinimap) return;
    isDraggingMinimap = false;
    elements.minimapContainer?.classList.remove('grabbing');
    if (globalMouseMoveListener) { document.removeEventListener('mousemove', globalMouseMoveListener); globalMouseMoveListener = null; }
    if (globalMouseUpListener) { document.removeEventListener('mouseup', globalMouseUpListener); globalMouseUpListener = null; }
    console.log("Minimap MouseUp: Drag ended, listeners removed.");
}
