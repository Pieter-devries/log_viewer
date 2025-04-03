// src/ui/dom.ts
import { elements } from '../core/state';

/**
 * Sets up the basic HTML structure for the visualization.
 * CSS is expected to be loaded separately via the build process.
 * @param visElement - The HTMLElement provided by Looker.
 */
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up base HTML structure (Controls merged into header).");

    // REMOVED #controls-area. Highlight input will be added dynamically.
    // Added #gridjs-minimap-thumb inside #gridjs-minimap
    const htmlContent = `
        <div class="log-viewer-container">
            <div id="content-area">
                <div id="gridjs-container">
                    </div>
                </div>
            <div id="gridjs-minimap">
                <div id="gridjs-minimap-thumb"></div>
                </div>
            </div>
    `;

    visElement.innerHTML = htmlContent;
    elements.visElement = visElement;
    console.log("setupHTML: Base HTML structure set (No separate controls area).");
}

/**
 * Finds and stores references to important DOM elements.
 * Note: highlightInput might be null initially if called before dynamic addition.
 * @param visElement - The root HTMLElement of the visualization.
 * @returns True if grid container and minimap container are found, false otherwise.
 */
export function findElements(visElement: HTMLElement): boolean {
    console.log("findElements: Attempting to find elements...");
    const baseElement = visElement || elements.visElement;
    if (!baseElement) {
        console.error("findElements: visElement is null!");
        return false;
    }

    elements.gridJsContainer = baseElement.querySelector<HTMLElement>("#gridjs-container");
    elements.minimapContainer = baseElement.querySelector<HTMLElement>("#gridjs-minimap");
    elements.minimapThumb = baseElement.querySelector<HTMLElement>("#gridjs-minimap-thumb");
    // Find highlight input - might be added later dynamically
    elements.highlightInput = baseElement.querySelector<HTMLInputElement>("#highlight-input");

    // Critical elements are the grid and minimap containers for basic layout
    const criticalElementsFound = !!elements.gridJsContainer && !!elements.minimapContainer;

    if (!criticalElementsFound) {
        console.error("findElements: Grid or Minimap container could not be found.");
        if (!elements.gridJsContainer) console.error("... #gridjs-container is missing");
        if (!elements.minimapContainer) console.error("... #gridjs-minimap is missing");
    } else {
        console.log("findElements: Core layout elements found.");
        // Log warnings if optional/dynamic elements are missing at this stage
        if (!elements.highlightInput) console.warn("findElements: #highlight-input not found (may be added dynamically).");
        if (!elements.minimapThumb) console.warn("findElements: #gridjs-minimap-thumb not found.");
    }

    return criticalElementsFound; // Return true if core layout is present
}

// Function to get the scroll wrapper
export function getScrollWrapper(): HTMLElement | null {
    if (!elements.gridJsContainer) {
        console.warn("getScrollWrapper: gridJsContainer not found");
        return null;
    }
    return elements.gridJsContainer.querySelector<HTMLElement>(".gridjs-wrapper");
}
