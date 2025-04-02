// src/ui/dom.ts
import { elements } from '../core/state'; // Use relative path

/**
 * Sets up the basic HTML structure for the visualization.
 * CSS is expected to be loaded separately via the build process.
 * @param visElement - The HTMLElement provided by Looker.
 */
export function setupHTML(visElement: HTMLElement): void {
    console.log("Setting up base HTML structure.");

    // Define the basic HTML structure string
    const htmlContent = `
        <div class="log-viewer-container">
            <div id="controls-area">
                <label for="highlight-input">Highlight:</label>
                <input type="text" id="highlight-input" placeholder="Highlight text..." />
                </div>
            <div id="content-area">
                 <div id="gridjs-container">
                     </div>
                 <div id="gridjs-minimap">
                     </div>
            </div>
        </div>
    `;

    // Set innerHTML ONCE
    visElement.innerHTML = htmlContent;

    // Store reference to the main element, defer finding children
    elements.visElement = visElement;
    console.log("setupHTML: Base HTML structure set.");
}

/**
 * Finds and stores references to important DOM elements.
 * @param visElement - The root HTMLElement of the visualization.
 * @returns True if all critical elements were found, false otherwise.
 */
export function findElements(visElement: HTMLElement): boolean {
    console.log("findElements: Attempting to find elements...");
    const baseElement = visElement || elements.visElement;
    if (!baseElement) {
        console.error("findElements: visElement is null!");
        return false;
    }

    // Find key elements and store references in the shared 'elements' object
    elements.gridJsContainer = baseElement.querySelector<HTMLElement>("#gridjs-container");
    elements.highlightInput = baseElement.querySelector<HTMLInputElement>("#highlight-input");
    elements.minimapContainer = baseElement.querySelector<HTMLElement>("#gridjs-minimap");

    // Verify that critical elements were found
    const criticalElementsFound = !!elements.gridJsContainer && !!elements.highlightInput && !!elements.minimapContainer;

    if (!criticalElementsFound) {
        console.error("findElements: One or more critical elements could not be found.");
        if (!elements.gridJsContainer) console.error("... #gridjs-container is missing");
        if (!elements.highlightInput) console.error("... #highlight-input is missing");
        if (!elements.minimapContainer) console.error("... #gridjs-minimap is missing");
        console.log("Parent structure for debugging:", baseElement.innerHTML);
    } else {
        console.log("findElements: All critical elements found.");
    }
    return criticalElementsFound;
}
