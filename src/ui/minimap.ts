// src/ui/minimap.ts
import { elements } from '../core/state'; // Use relative path
import { getScrollWrapper } from './dom'; // Import helper

// State for Minimap Dragging (Internal)
let isDraggingMinimap = false;
let globalMouseMoveListener: ((event: MouseEvent) => void) | null = null;
let globalMouseUpListener: ((event: MouseEvent) => void) | null = null;

// --- Minimap Thumb Logic ---

/**
 * Updates the position and visibility of the minimap thumb based on the scroll state.
 */
export function updateMinimapThumb(): void {
    const gridWrapper = getScrollWrapper();
    const minimapContainer = elements.minimapContainer;
    const minimapThumb = elements.minimapThumb;

    if (!minimapContainer || !gridWrapper || !minimapThumb) {
        // console.warn("updateMinimapThumb: Missing required elements.");
        if (minimapThumb) minimapThumb.style.opacity = '0'; // Ensure thumb is hidden if elements missing
        return;
    }

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    const scrollTop = gridWrapper.scrollTop;
    const minimapContainerHeight = minimapContainer.offsetHeight;

    // Check if scrolling is possible
    if (scrollHeight <= clientHeight || minimapContainerHeight <= 0) {
        minimapThumb.style.opacity = '0'; // Hide thumb if no scroll needed
        // console.log("updateMinimapThumb: No scrolling needed, hiding thumb.");
        return;
    }

    // Calculate thumb height and position
    // Thumb height is proportional to the visible content ratio
    const thumbHeightRatio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(10, thumbHeightRatio * minimapContainerHeight); // Min height 10px

    // Thumb top position is proportional to the scroll position within the scrollable range
    const scrollableRange = scrollHeight - clientHeight;
    const thumbTopRatio = scrollableRange > 0 ? scrollTop / scrollableRange : 0;
    const availableThumbSpace = minimapContainerHeight - thumbHeight;
    const thumbTop = thumbTopRatio * availableThumbSpace;

    // Apply styles
    minimapThumb.style.height = `${thumbHeight}px`;
    minimapThumb.style.top = `${thumbTop}px`;
    minimapThumb.style.opacity = '1'; // Show thumb
    // console.log(`updateMinimapThumb: Updated - Top: ${thumbTop.toFixed(1)}px, Height: ${thumbHeight.toFixed(1)}px`);
}

/** Updates minimap markers */
export function updateMinimapMarkers(): void {
    const gridWrapper = getScrollWrapper();
    const minimapContainer = elements.minimapContainer;

    if (!minimapContainer || !gridWrapper) return;

    // Clear existing markers
    const existingMarkers = minimapContainer.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    const tableBody = gridWrapper.querySelector<HTMLElement>('.gridjs-tbody');
    if (!tableBody) return;

    const scrollHeight = gridWrapper.scrollHeight;
    // const clientHeight = gridWrapper.clientHeight;
    const minimapHeight = minimapContainer.offsetHeight;

    // console.log(`updateMinimapMarkers - Scroll Heights: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (minimapHeight <= 0) { return; } // No minimap height means we can't draw

    const highlightedMarks = gridWrapper.querySelectorAll('mark.gridjs-highlight');
    if (highlightedMarks.length === 0) { return; } // No highlights

    const processedRows = new Set<HTMLElement>(); // Keep track of rows we've added markers for

    highlightedMarks.forEach(mark => {
        const row = mark.closest('tr');
        // Ensure row is a valid HTMLElement and we haven't processed it yet
        if (!(row instanceof HTMLElement) || processedRows.has(row)) {
            return;
        }
        processedRows.add(row);

        // Calculate row's position relative to the wrapper's scrollable content

        const rowOffsetTop = row.offsetTop + tableBody.offsetTop;
        // Use scrollHeight for positioning, even if not scrollable,
        // to represent relative position within the total content.
        const markerTop = (rowOffsetTop / scrollHeight) * minimapHeight;

        // Create and add the marker
        const marker = document.createElement('div');
        marker.className = 'minimap-marker';
        // Clamp marker position within minimap bounds (consider marker height)
        marker.style.top = `${Math.max(0, Math.min(markerTop, minimapHeight - 2))}px`;
        minimapContainer.appendChild(marker);
    });
}


// --- Minimap Drag Handlers ---

/** Handles mousedown on minimap */
export function handleMinimapMouseDown(event: MouseEvent): void {
    const gridWrapper = getScrollWrapper();
    if (!elements.minimapContainer || !gridWrapper) return;

    event.preventDefault();
    isDraggingMinimap = true;
    elements.minimapContainer.classList.add('grabbing');

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    // console.log(`Minimap MouseDown: scrollH=${scrollHeight}, clientH=${clientHeight}`);

    if (scrollHeight <= clientHeight) {
        console.log("Minimap MouseDown: No scrolling needed (scrollHeight <= clientHeight).");
        isDraggingMinimap = false;
        elements.minimapContainer.classList.remove('grabbing');
        return;
    }

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapContainerHeight = elements.minimapContainer.offsetHeight;

    // Initial scroll based on click position
    let mouseY = event.clientY - rect.top;
    let targetScrollTop = (mouseY / minimapContainerHeight) * (scrollHeight - clientHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight));

    // console.log(`Minimap MouseDown: Attempting to set scrollTop to ${targetScrollTop}`);
    gridWrapper.scrollTop = targetScrollTop; // Set scrollTop on wrapper
    // console.log(`Minimap MouseDown: scrollTop is now ${gridWrapper.scrollTop}`);
    updateMinimapThumb(); // Update thumb position immediately

    // Add global listeners
    globalMouseMoveListener = (moveEvent: MouseEvent) => handleMinimapMouseMove(moveEvent);
    globalMouseUpListener = (upEvent: MouseEvent) => handleMinimapMouseUp(upEvent);
    document.addEventListener('mousemove', globalMouseMoveListener);
    document.addEventListener('mouseup', globalMouseUpListener);
}

/** Handles mousemove during drag */
function handleMinimapMouseMove(event: MouseEvent): void {
    const gridWrapper = getScrollWrapper();
    if (!isDraggingMinimap || !elements.minimapContainer || !gridWrapper) return;

    const scrollHeight = gridWrapper.scrollHeight;
    const clientHeight = gridWrapper.clientHeight;
    if (scrollHeight <= clientHeight) return; // Should not happen if drag started, but safe check

    const rect = elements.minimapContainer.getBoundingClientRect();
    const minimapContainerHeight = elements.minimapContainer.offsetHeight;
    let mouseY = event.clientY - rect.top;
    mouseY = Math.max(0, Math.min(mouseY, minimapContainerHeight)); // Clamp Y

    // Calculate target scroll based on mouse position relative to minimap height
    const scrollableRange = scrollHeight - clientHeight;
    let targetScrollTop = (mouseY / minimapContainerHeight) * scrollableRange;
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, scrollableRange)); // Clamp scroll

    gridWrapper.scrollTop = targetScrollTop; // Set scrollTop on wrapper
    updateMinimapThumb(); // Update thumb position during drag
}

/** Handles mouseup to end drag */
function handleMinimapMouseUp(event: MouseEvent): void {
    if (!isDraggingMinimap) return;
    isDraggingMinimap = false;
    elements.minimapContainer?.classList.remove('grabbing');
    // Remove global listeners
    if (globalMouseMoveListener) { document.removeEventListener('mousemove', globalMouseMoveListener); globalMouseMoveListener = null; }
    if (globalMouseUpListener) { document.removeEventListener('mouseup', globalMouseUpListener); globalMouseUpListener = null; }
    console.log("Minimap MouseUp: Drag ended, listeners removed.");
}
