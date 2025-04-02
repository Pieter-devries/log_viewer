// src/ui/minimap.ts
import { elements } from '../core/state';

// State for Minimap Dragging (Internal)
let isDraggingMinimap = false;
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;

/**
 * Gets the element that should be scrolled.
 * In the current layout, this is the main .log-viewer-container.
 * @returns The scrollable HTMLElement or null if not found.
 */
function getScrollContainer(): HTMLElement | null {
    // Check if the root visualization element exists first
    if (!elements.visElement) {
        console.warn("getScrollContainer: elements.visElement is null.");
        return null;
    }
    // Find the specific container within the vis element
    const container = elements.visElement.querySelector<HTMLElement>('.log-viewer-container');
    if (!container) {
        console.warn("getScrollContainer: Could not find .log-viewer-container within visElement. Falling back to visElement.");
        // Fallback to the main element if the specific container isn't found
        // This might happen during initial setup or if the structure changes
        return elements.visElement;
    }
    // Return the found container
    return container;
}


/**
 * Updates minimap markers based on highlights.
 */
export function updateMinimap(): void {
    const scrollContainer = getScrollContainer(); // <<< Use updated function
    const minimap = elements.minimapContainer;

    // Exit if essential elements aren't found
    if (!minimap || !scrollContainer || !elements.gridJsContainer) {
        console.warn("updateMinimap skipped: Essential elements (minimap, scrollContainer, gridJsContainer) not found.");
        return;
    }

    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) { return; } // Need wrapper to find highlights
    const tableBody = gridWrapper.querySelector<HTMLElement>('.gridjs-tbody');
    if (!tableBody) { return; } // Need table body for offsets

    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    const minimapHeight = minimap.offsetHeight;

    console.log(`updateMinimap - Scroll Heights: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (scrollHeight <= clientHeight || minimapHeight <= 0) { return; } // No scroll or minimap not visible

    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    if (highlightedMarks.length === 0) { return; } // No highlights

    const processedRows = new Set<HTMLElement>();
    const scrollContainerRectTop = scrollContainer.getBoundingClientRect().top;
    const gridWrapperRectTop = gridWrapper.getBoundingClientRect().top;
    // Calculate offset between scroll container top and grid wrapper top, adjusted by current scroll
    const wrapperTopOffset = gridWrapperRectTop - scrollContainerRectTop + scrollContainer.scrollTop;

    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr');
        if (!(row instanceof HTMLElement) || processedRows.has(row)) { return; }
        processedRows.add(row);

        // Calculate row's position relative to the scroll container's content
        const rowOffsetTop = row.offsetTop + tableBody.offsetTop + wrapperTopOffset;

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
    const scrollContainer = getScrollContainer(); // <<< Use updated function
    if (!elements.minimapContainer || !scrollContainer) return;

    event.preventDefault();
    isDraggingMinimap = true;
    elements.minimapContainer.classList.add('grabbing');

    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    console.log(`Minimap MouseDown: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (scrollHeight <= clientHeight) {
        console.log("Minimap MouseDown: No scrolling needed.");
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
    scrollContainer.scrollTop = targetScrollTop; // Set scrollTop on container
    console.log(`Minimap MouseDown: scrollTop is now ${scrollContainer.scrollTop}`);

    // Add global listeners
    globalMouseMoveListener = (moveEvent: MouseEvent) => handleMinimapMouseMove(moveEvent);
    globalMouseUpListener = (upEvent: MouseEvent) => handleMinimapMouseUp(upEvent);
    document.addEventListener('mousemove', globalMouseMoveListener);
    document.addEventListener('mouseup', globalMouseUpListener);
}

/** Handles mousemove during drag */
function handleMinimapMouseMove(event: MouseEvent): void {
    const scrollContainer = getScrollContainer(); // <<< Use updated function
    if (!isDraggingMinimap || !elements.minimapContainer || !scrollContainer) return;

    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    if (scrollHeight <= clientHeight) return; // Safety check

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapHeight = elements.minimapContainer.offsetHeight;
    let mouseY = event.clientY - rect.top;
    mouseY = Math.max(0, Math.min(mouseY, minimapHeight)); // Clamp Y

    let targetScrollTop = (mouseY / minimapHeight) * (scrollHeight - clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight)); // Clamp scroll

    scrollContainer.scrollTop = targetScrollTop; // Set scrollTop on container
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
