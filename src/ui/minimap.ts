// src/ui/minimap.ts
import { elements } from '../core/state';

// --- State for Minimap Dragging (Internal to this module) ---
let isDraggingMinimap = false;
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;

/**
 * Updates the position markers on the minimap based on highlighted elements in the grid.
 */
export function updateMinimap(): void {
    // Ensure necessary elements exist
    if (!elements.minimapContainer || !elements.gridJsContainer) {
        console.warn("updateMinimap skipped: Minimap or Grid container not found.");
        return;
    }
    const minimap = elements.minimapContainer;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');

    // Clear existing markers first
    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    if (!gridWrapper) {
        console.warn("updateMinimap skipped: Grid wrapper not found.");
        return;
    }
    const tableBody = gridWrapper.querySelector<HTMLElement>('.gridjs-tbody');
    if (!tableBody) {
        console.warn("updateMinimap skipped: Table body not found.");
        return;
    }

    const scrollHeight = gridWrapper.scrollHeight; // Total scrollable height
    const clientHeight = gridWrapper.clientHeight; // Visible height
    const minimapHeight = minimap.offsetHeight; // Height of the minimap element

    // If content doesn't overflow or minimap has no height, no markers needed
    if (scrollHeight <= clientHeight || minimapHeight <= 0) {
        return;
    }

    // Find highlighted elements *within the grid wrapper*
    // This assumes highlights are marked with <mark class="gridjs-highlight">
    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    if (highlightedMarks.length === 0) {
        // console.log("updateMinimap: No highlights found, clearing markers."); // Optional log
        return; // No highlights, no markers needed
    }

    const processedRows = new Set<HTMLElement>(); // Avoid duplicate markers for same row

    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr'); // Find the parent table row
        if (!(row instanceof HTMLElement) || processedRows.has(row)) {
            return; // Skip if not a valid row or already processed
        }
        processedRows.add(row);

        // Calculate the vertical position of the row within the scrollable content
        const rowOffsetTop = row.offsetTop; // Offset relative to table/tbody
        const tableBodyOffsetTop = tableBody.offsetTop; // Offset of tbody within wrapper
        const totalOffset = rowOffsetTop + tableBodyOffsetTop; // Row's top position within the scrollable wrapper

        // Calculate the proportional position on the minimap
        // markerTop represents the top position of the marker on the minimap track
        const markerTop = (totalOffset / scrollHeight) * minimapHeight;

        // Create and add the marker element
        const marker = document.createElement('div');
        marker.className = 'minimap-marker'; // Use class from main.css or equivalent
        // Clamp marker position to be within minimap bounds (accounting for marker height ~2px)
        marker.style.top = `${Math.max(0, Math.min(markerTop, minimapHeight - 2))}px`;
        minimap.appendChild(marker);
    });
    // console.log(`updateMinimap: Added markers for ${processedRows.size} rows.`); // Optional log
}


// --- Minimap Drag Handlers ---

/** Handles the initial click on the minimap to start scrolling/dragging. */
export function handleMinimapMouseDown(event: MouseEvent): void {
    if (!elements.minimapContainer || !elements.gridJsContainer) return;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) return;

    event.preventDefault();
    isDraggingMinimap = true;
    elements.minimapContainer.classList.add('grabbing'); // Add grabbing cursor style

    const rect = elements.minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    const minimapHeight = elements.minimapContainer.offsetHeight;
    const scrollableHeight = gridWrapper.scrollHeight;
    const wrapperHeight = gridWrapper.clientHeight;

    // Calculate initial scroll position
    let targetScrollTop = (mouseY / minimapHeight) * (scrollableHeight - wrapperHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollableHeight - wrapperHeight));
    gridWrapper.scrollTop = targetScrollTop;

    // Define global listeners
    globalMouseMoveListener = (moveEvent: MouseEvent) => handleMinimapMouseMove(moveEvent);
    globalMouseUpListener = (upEvent: MouseEvent) => handleMinimapMouseUp(upEvent);

    // Add global listeners
    document.addEventListener('mousemove', globalMouseMoveListener);
    document.addEventListener('mouseup', globalMouseUpListener);
}

/** Handles mouse movement during minimap drag. */
function handleMinimapMouseMove(event: MouseEvent): void {
    if (!isDraggingMinimap || !elements.minimapContainer || !elements.gridJsContainer) return;
    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
    if (!gridWrapper) return;

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapHeight = elements.minimapContainer.offsetHeight;
    const scrollableHeight = gridWrapper.scrollHeight;
    const wrapperHeight = gridWrapper.clientHeight;

    let mouseY = event.clientY - rect.top;
    mouseY = Math.max(0, Math.min(mouseY, minimapHeight)); // Clamp Y

    let targetScrollTop = (mouseY / minimapHeight) * (scrollableHeight - wrapperHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollableHeight - wrapperHeight)); // Clamp scroll

    gridWrapper.scrollTop = targetScrollTop;
}

/** Handles mouse button release to stop minimap dragging. */
function handleMinimapMouseUp(event: MouseEvent): void {
    if (!isDraggingMinimap) return;
    isDraggingMinimap = false;
    elements.minimapContainer?.classList.remove('grabbing'); // Remove grabbing cursor style

    // Remove global listeners
    if (globalMouseMoveListener) {
        document.removeEventListener('mousemove', globalMouseMoveListener);
        globalMouseMoveListener = null;
    }
    if (globalMouseUpListener) {
        document.removeEventListener('mouseup', globalMouseUpListener);
        globalMouseUpListener = null;
    }
}
