import { state, elements } from './state';

// Store bound functions locally within the module scope to ensure correct removal
let boundMouseMove: ((event: MouseEvent) => void) | null = null;
let boundMouseUp: ((event: MouseEvent) => void) | null = null;

/**
 * Calculates the required height of the minimap thumb.
 * @param visibleHeight - The visible height of the scrollable content area.
 * @param contentHeight - The total scrollable height of the content area.
 * @param minimapHeight - The height of the minimap container.
 * @returns The calculated thumb height (with a minimum value).
 */
function calculateThumbHeight(visibleHeight: number, contentHeight: number, minimapHeight: number): number {
    const minThumbHeight = 20; // Minimum pixels for the thumb
    const calculatedHeight = (visibleHeight / contentHeight) * minimapHeight;
    return Math.max(minThumbHeight, calculatedHeight);
}

/**
 * Calculates the required top position of the minimap thumb.
 * @param currentScrollTop - The current scroll position of the content area.
 * @param maxScrollTop - The maximum scroll position of the content area.
 * @param minimapHeight - The height of the minimap container.
 * @param thumbHeight - The height of the thumb itself.
 * @returns The calculated and clamped top position for the thumb.
 */
function calculateThumbTop(currentScrollTop: number, maxScrollTop: number, minimapHeight: number, thumbHeight: number): number {
    const draggableThumbRange = minimapHeight - thumbHeight;
    // Calculate position based on scroll ratio, handle maxScrollTop being 0
    const thumbTop = maxScrollTop > 0 ? (currentScrollTop / maxScrollTop) * draggableThumbRange : 0;
    // Clamp position within the minimap bounds
    return Math.max(0, Math.min(thumbTop, draggableThumbRange));
}

/**
 * Updates the size and position of the minimap scroll thumb based on the log area's scroll state.
 */
export function updateThumb(): void {
    if (!elements.logLinesArea || !elements.minimapContainer || !elements.minimapThumb) return;

    const logArea = elements.logLinesArea;
    const minimapContainer = elements.minimapContainer;
    const minimapThumb = elements.minimapThumb;

    const minimapHeight = minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight;
    const visibleHeight = logArea.clientHeight;

    // Hide thumb if content isn't scrollable or minimap has no height
    if (contentHeight <= visibleHeight || minimapHeight <= 0) {
        minimapThumb.style.opacity = '0';
        minimapThumb.style.height = '0px';
        minimapThumb.style.pointerEvents = 'none'; // Disable interaction
        return;
    }

    const thumbHeight = calculateThumbHeight(visibleHeight, contentHeight, minimapHeight);
    const maxScrollTop = contentHeight - visibleHeight;
    const currentScrollTop = Math.min(logArea.scrollTop, maxScrollTop); // Ensure current scroll isn't beyond max
    const thumbTop = calculateThumbTop(currentScrollTop, maxScrollTop, minimapHeight, thumbHeight);

    // Apply calculated styles
    minimapThumb.style.height = `${thumbHeight}px`;
    minimapThumb.style.top = `${thumbTop}px`;
    minimapThumb.style.opacity = '1'; // Make visible
    minimapThumb.style.pointerEvents = 'auto'; // Enable interaction
}

/**
 * Syncs the thumb position when the log area is scrolled (but only if not currently dragging the thumb).
 */
export function syncThumbPosition(): void {
    if (state.isDragging) return; // Don't update if user is actively dragging the thumb
    updateThumb();
}

/**
 * Handles mouse movement *during* a minimap drag operation.
 * This function is attached to the window to capture mouse movements anywhere.
 */
function handleMinimapMouseMoveInternal(event: MouseEvent): void {
    // Ensure dragging state and necessary elements are present
    if (!state.isDragging || !elements.logLinesArea || !elements.minimapContainer || !elements.minimapThumb) return;

    event.preventDefault(); // Prevent text selection during drag

    const logArea = elements.logLinesArea;
    const minimapContainer = elements.minimapContainer;
    const minimapThumb = elements.minimapThumb;

    const minimapHeight = minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight;
    const visibleHeight = logArea.clientHeight;
    const thumbHeight = minimapThumb.offsetHeight; // Get actual thumb height

    const bounds = minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - bounds.top; // Mouse Y relative to minimap container

    // Calculate the ranges
    const draggableThumbRange = minimapHeight - thumbHeight;
    const scrollableContentRange = contentHeight - visibleHeight;

    // Prevent division by zero or invalid calculations if not scrollable/draggable
    if (draggableThumbRange <= 0 || scrollableContentRange < 0) return;

    // Calculate desired scroll position based on mouse position within the draggable range
    // Adjust mouseY by half thumb height to center the drag point on the thumb
    const scrollRatio = (mouseY - thumbHeight / 2) / draggableThumbRange;
    const targetScrollTop = scrollRatio * scrollableContentRange;

    // Clamp the scroll position within valid bounds [0, maxScrollTop]
    const newScrollTop = Math.max(0, Math.min(scrollableContentRange, targetScrollTop));

    // Apply the new scroll position
    logArea.scrollTop = newScrollTop;

    // updateThumb(); // Update thumb position immediately as we scroll
    // Optimization: Instead of calling full updateThumb, just update the top style directly
    const newThumbTop = calculateThumbTop(newScrollTop, scrollableContentRange, minimapHeight, thumbHeight);
    minimapThumb.style.top = `${newThumbTop}px`;
}

/**
 * Handles the mouse up event *after* a minimap drag operation.
 * This function is attached to the window to capture mouse up anywhere.
 */
function handleMinimapMouseUpInternal(event: MouseEvent): void {
    if (!state.isDragging) return; // Only act if we were dragging

    event.preventDefault();
    state.isDragging = false; // Update state: dragging finished

    if (elements.minimapThumb) {
        elements.minimapThumb.classList.remove('dragging'); // Remove visual dragging indicator
    }

    // Remove the global mouse move and mouse up listeners using the stored bound references
    if (boundMouseMove) {
        window.removeEventListener('mousemove', boundMouseMove);
        boundMouseMove = null; // Clear reference
        // console.log("Removed mousemove listener");
    }
    if (boundMouseUp) {
        window.removeEventListener('mouseup', boundMouseUp);
        boundMouseUp = null; // Clear reference
        // console.log("Removed mouseup listener");
    }
}

/**
 * Handles the mouse down event on the minimap container or thumb to initiate scrolling/dragging.
 */
export function handleMinimapMouseDown(event: MouseEvent): void {
    // Ensure necessary elements are present
    if (!elements.logLinesArea || !elements.minimapContainer || !elements.minimapThumb) return;

    // Prevent default text selection behavior
    event.preventDefault();

    const logArea = elements.logLinesArea;
    const minimapContainer = elements.minimapContainer;
    const minimapThumb = elements.minimapThumb;

    const minimapHeight = minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight;
    const visibleHeight = logArea.clientHeight;

    // Don't start drag if content isn't scrollable or minimap isn't visible/valid
    if (contentHeight <= visibleHeight || minimapHeight <= 0) return;

    // --- Immediate Scroll on Click ---
    const bounds = minimapContainer.getBoundingClientRect();
    const clickY = event.clientY - bounds.top; // Click Y relative to minimap
    const thumbHeight = minimapThumb.offsetHeight;
    const draggableThumbRange = minimapHeight - thumbHeight;
    const scrollableContentRange = contentHeight - visibleHeight;

    // Calculate target scroll based on click position (centering click on thumb)
    if (draggableThumbRange > 0 && scrollableContentRange >= 0) { // Allow scroll even if range is 0
        const scrollRatio = (clickY - thumbHeight / 2) / draggableThumbRange;
        const targetScrollTop = scrollRatio * scrollableContentRange;
        logArea.scrollTop = Math.max(0, Math.min(scrollableContentRange, targetScrollTop));
        updateThumb(); // Update thumb immediately after jump-scroll
    }

    // --- Start Dragging ---
    state.isDragging = true; // Set state to indicate dragging has started
    minimapThumb.classList.add('dragging'); // Add visual indicator

    // Remove any *previous* listeners first (safety measure)
    if (boundMouseMove) window.removeEventListener('mousemove', boundMouseMove);
    if (boundMouseUp) window.removeEventListener('mouseup', boundMouseUp);

    // Create *new* bound functions for this drag instance
    // Binding ensures 'this' context is correct if these functions were methods of a class
    // (though here they are module-level functions, binding doesn't hurt)
    boundMouseMove = handleMinimapMouseMoveInternal; //.bind(this);
    boundMouseUp = handleMinimapMouseUpInternal; //.bind(this);

    // Add global listeners to track mouse movement and release *anywhere* on the window
    window.addEventListener('mousemove', boundMouseMove);
    window.addEventListener('mouseup', boundMouseUp);
    // console.log("Added mousemove and mouseup listeners");
}
