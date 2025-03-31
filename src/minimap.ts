import { state, elements } from './state';

// Store bound functions locally within the module scope
let boundMouseMove: ((event: MouseEvent) => void) | null = null;
let boundMouseUp: ((event: MouseEvent) => void) | null = null;

/**
 * Updates the size and position of the minimap scroll thumb.
 */
export function updateThumb(): void {
    if (!elements.logLinesArea || !elements.minimapContainer || !elements.minimapThumb) return;
    const logArea = elements.logLinesArea;
    const minimapHeight = elements.minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight;
    const visibleHeight = logArea.clientHeight;

    if (contentHeight <= visibleHeight || minimapHeight <= 0) {
        elements.minimapThumb.style.opacity = '0';
        elements.minimapThumb.style.height = '0px';
        return;
    }
    const thumbHeight = Math.max(20, (visibleHeight / contentHeight) * minimapHeight);
    const maxScrollTop = contentHeight - visibleHeight;
    const currentScrollTop = Math.min(logArea.scrollTop, maxScrollTop);
    const thumbTop = maxScrollTop > 0 ? (currentScrollTop / maxScrollTop) * (minimapHeight - thumbHeight) : 0;
    const clampedThumbTop = Math.max(0, Math.min(thumbTop, minimapHeight - thumbHeight));

    elements.minimapThumb.style.height = `${thumbHeight}px`;
    elements.minimapThumb.style.top = `${clampedThumbTop}px`;
    elements.minimapThumb.style.opacity = '1';
}

/**
 * Syncs the thumb position when the log area is scrolled (if not dragging).
 */
export function syncThumbPosition(): void {
    if (state.isDragging) return; // Use imported state
    updateThumb();
}

/**
 * Handles mouse movement during minimap drag.
 */
function handleMinimapMouseMoveInternal(event: MouseEvent): void {
    if (!state.isDragging || !elements.logLinesArea || !elements.minimapContainer || !elements.minimapThumb) return;
    event.preventDefault();

    const logArea = elements.logLinesArea;
    const minimapHeight = elements.minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight;
    const visibleHeight = logArea.clientHeight;
    const thumbHeight = elements.minimapThumb.offsetHeight;
    const bounds = elements.minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - bounds.top;
    const draggableThumbRange = minimapHeight - thumbHeight;
    const scrollableContentRange = contentHeight - visibleHeight;

    // Prevent division by zero or negative range
    if (draggableThumbRange <= 0 || scrollableContentRange < 0) return;

    const scrollRatio = (mouseY - thumbHeight / 2) / draggableThumbRange;
    const targetScrollTop = scrollRatio * scrollableContentRange;
    const maxScrollTop = contentHeight - visibleHeight;
    const newScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));

    logArea.scrollTop = newScrollTop;
    updateThumb(); // Force thumb update during drag
}

/**
 * Handles mouse up event after minimap drag.
 */
function handleMinimapMouseUpInternal(event: MouseEvent): void {
    if (!state.isDragging) return;
    event.preventDefault();
    state.isDragging = false; // Update imported state

    if (elements.minimapThumb) elements.minimapThumb.classList.remove('dragging');

    // Remove global listeners using the stored bound references
    if (boundMouseMove) {
        window.removeEventListener('mousemove', boundMouseMove);
        boundMouseMove = null; // Clear reference
    }
    if (boundMouseUp) {
        window.removeEventListener('mouseup', boundMouseUp);
        boundMouseUp = null; // Clear reference
    }
}

/**
 * Handles mouse down event on the minimap to initiate scrolling/dragging.
 */
export function handleMinimapMouseDown(event: MouseEvent): void {
    if (!elements.logLinesArea || !elements.minimapContainer || !elements.minimapThumb) return;
    event.preventDefault();

    const logArea = elements.logLinesArea;
    const minimapHeight = elements.minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight;
    const visibleHeight = logArea.clientHeight;

    // Don't start drag if not scrollable
    if (contentHeight <= visibleHeight || minimapHeight <= 0) return;

    const bounds = elements.minimapContainer.getBoundingClientRect();
    const clickY = event.clientY - bounds.top;
    const thumbHeight = elements.minimapThumb.offsetHeight;
    const draggableThumbRange = minimapHeight - thumbHeight;
    const scrollableContentRange = contentHeight - visibleHeight;

    // Initial scroll based on click position
    if (draggableThumbRange > 0 && scrollableContentRange > 0) {
        const scrollRatio = (clickY - thumbHeight / 2) / draggableThumbRange;
        const targetScrollTop = scrollRatio * scrollableContentRange;
        logArea.scrollTop = Math.max(0, Math.min(scrollableContentRange, targetScrollTop));
        updateThumb();
    }

    function handleMinimapMouseUpInternal(event: MouseEvent): void {
        if (!state.isDragging) return;
        event.preventDefault();
        state.isDragging = false; // Update imported state

        if (elements.minimapThumb) elements.minimapThumb.classList.remove('dragging');

        // Remove global listeners using the stored bound references
        if (boundMouseMove) {
            window.removeEventListener('mousemove', boundMouseMove);
            boundMouseMove = null; // Clear reference
        }
        if (boundMouseUp) {
            window.removeEventListener('mouseup', boundMouseUp);
            boundMouseUp = null; // Clear reference
        }
    }

}