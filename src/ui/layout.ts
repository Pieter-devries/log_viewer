// src/ui/layout.ts
import { elements } from '../core/state';
import { debounce } from '../utils/debounce';

let headerResizeObserver: ResizeObserver | null = null;

/**
 * Adjusts the minimap's top position based on the grid header's actual height.
 */
export function adjustMinimapPosition(): void {
    if (!elements.gridJsContainer || !elements.minimapContainer) return;
    const gridHead = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-head');
    if (!gridHead) return;

    const headerHeight = gridHead.offsetHeight;
    // --- ADD DEBUG LOG ---
    console.log(`adjustMinimapPosition: gridHead found, offsetHeight = ${headerHeight}px. Setting minimap top.`);
    // --- END DEBUG LOG ---

    if (elements.minimapContainer) { // Check again as it might be destroyed
        elements.minimapContainer.style.top = `${headerHeight}px`;
    }
}

/**
 * Sets up a ResizeObserver to monitor the grid header's height changes
 * and trigger minimap position adjustments.
 */
export function setupHeaderResizeObserver(): void {
    if (!elements.gridJsContainer) return;
    const gridHead = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-head');

    if (gridHead) {
        if (headerResizeObserver) headerResizeObserver.disconnect(); // Disconnect old one if exists

        const debouncedAdjust = debounce(adjustMinimapPosition, 50);

        headerResizeObserver = new ResizeObserver(entries => {
            if (entries[0]) debouncedAdjust();
        });

        headerResizeObserver.observe(gridHead);
        console.log("ResizeObserver attached to .gridjs-head.");
    } else {
        console.warn("setupHeaderResizeObserver: .gridjs-head not found.");
    }
}

/**
 * Disconnects the ResizeObserver.
 */
export function disconnectHeaderResizeObserver(): void {
    if (headerResizeObserver) {
        headerResizeObserver.disconnect();
        headerResizeObserver = null;
        console.log("ResizeObserver disconnected.");
    }
}

/**
 * Calculates and sets the height of the grid wrapper dynamically.
 */
export function setGridWrapperHeight(): void {
    window.requestAnimationFrame(() => {
        if (!elements.gridJsContainer) { return; }
        const container = elements.gridJsContainer;
        const gridWrapper = container.querySelector<HTMLElement>(".gridjs-wrapper");
        const header = container.querySelector<HTMLElement>(".gridjs-head");
        const footer = container.querySelector<HTMLElement>(".gridjs-footer");

        if (!gridWrapper) { return; }

        const containerHeight = container.clientHeight;
        const headerHeight = header?.offsetHeight ?? 0;
        const footerHeight = footer?.offsetHeight ?? 0;
        const availableHeight = Math.max(0, containerHeight - headerHeight - footerHeight);
        const targetHeight = Math.max(50, availableHeight); // Min height 50px

        gridWrapper.style.height = `${targetHeight}px`;

        // Optional check
        setTimeout(() => {
            if (!gridWrapper) return;
            const scrollHeight = gridWrapper.scrollHeight;
            const clientHeight = gridWrapper.clientHeight;
            // console.log(`setGridWrapperHeight: Scrolling CHECK - scrollH=${scrollHeight}, clientH=${clientHeight}`);
        }, 0);
    });
}

/** Convenience function to run all layout adjustments */
export function updateLayout(): void {
    setGridWrapperHeight();
    adjustMinimapPosition();
    // Note: setupHeaderResizeObserver is usually called once after elements are stable
}
