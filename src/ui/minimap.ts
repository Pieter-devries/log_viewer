// src/ui/minimap.ts
import { elements } from '../core/state'; // Use relative path

// State for Minimap Dragging (Internal)
let isDraggingMinimap = false;
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;

/**
 * Gets the element that should be scrolled.
 * This should be the .gridjs-wrapper element.
 * @returns The scrollable HTMLElement or null if not found.
 */
function getScrollWrapper(): HTMLElement | null {
    if (!elements.gridJsContainer) {
        console.warn("getScrollWrapper: gridJsContainer not found");
        return null;
    }
    return elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
}

/** Updates minimap markers */
export function updateMinimap(): void {
    const gridWrapper = getScrollWrapper(); // Target wrapper
    const minimap = elements.minimapContainer;

    if (!minimap || !gridWrapper) return;

    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    const tableBody = gridWrapper.querySelector<HTMLElement>('.gridjs-tbody');
    if (!tableBody) return;

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    const minimapHeight = minimap.offsetHeight;

    console.log(`updateMinimap - Scroll Heights: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (scrollHeight <= clientHeight || minimapHeight <= 0) { return; }

    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    if (highlightedMarks.length === 0) { return; }

    const processedRows = new Set<HTMLElement>();
    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr');
        if (!(row instanceof HTMLElement) || processedRows.has(row)) { return; }
        processedRows.add(row);
        // Calculate row's position relative to the wrapper's scrollable content
        const rowOffsetTop = row.offsetTop + tableBody.offsetTop; // Offset within wrapper
        const markerTop = (rowOffsetTop / scrollHeight) * minimapHeight;
        const marker = document.createElement('div');
        marker.className = 'minimap-marker';
        marker.style.top = `${Math.max(0, Math.min(markerTop, minimapHeight - 2))}px`;
        minimap.appendChild(marker);
    });
}


// --- Minimap Drag Handlers ---

/** Handles mousedown on minimap */
export function handleMinimapMouseDown(event: MouseEvent): void {
    const gridWrapper = getScrollWrapper(); // Target wrapper
    if (!elements.minimapContainer || !gridWrapper) return;

    event.preventDefault();
    isDraggingMinimap = true;
    elements.minimapContainer.classList.add('grabbing');

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    console.log(`Minimap MouseDown: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (scrollHeight <= clientHeight) {
        console.log("Minimap MouseDown: No scrolling needed (scrollHeight <= clientHeight).");
        isDraggingMinimap = false;
        elements.minimapContainer.classList.remove('grabbing');
        return;
    }

    const rect = elements.minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    const minimapHeight = elements.minimapContainer.offsetHeight;
    let targetScrollTop = (mouseY / minimapHeight) * (scrollHeight - clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight));

    console.log(`Minimap MouseDown: Attempting to set scrollTop to ${targetScrollTop}`);
    gridWrapper.scrollTop = targetScrollTop; // Set scrollTop on wrapper
    console.log(`Minimap MouseDown: scrollTop is now ${gridWrapper.scrollTop}`);

    // Add global listeners
    globalMouseMoveListener = (moveEvent: MouseEvent) => handleMinimapMouseMove(moveEvent);
    globalMouseUpListener = (upEvent: MouseEvent) => handleMinimapMouseUp(upEvent);
    document.addEventListener('mousemove', globalMouseMoveListener);
    document.addEventListener('mouseup', globalMouseUpListener);
}

/** Handles mousemove during drag */
function handleMinimapMouseMove(event: MouseEvent): void {
    const gridWrapper = getScrollWrapper(); // Target wrapper
    if (!isDraggingMinimap || !elements.minimapContainer || !gridWrapper) return;

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    if (scrollHeight <= clientHeight) return;

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapHeight = elements.minimapContainer.offsetHeight;
    let mouseY = event.clientY - rect.top;
    mouseY = Math.max(0, Math.min(mouseY, minimapHeight)); // Clamp Y

    let targetScrollTop = (mouseY / minimapHeight) * (scrollHeight - clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight)); // Clamp scroll

    gridWrapper.scrollTop = targetScrollTop; // Set scrollTop on wrapper
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
