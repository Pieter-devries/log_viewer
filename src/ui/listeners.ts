// src/ui/listeners.ts
import { elements, state } from '../core/state';
import { debounce } from '../utils/debounce';
import { applyHighlight } from './highlight';
import { handleMinimapMouseDown } from './minimap';
// import { updateMinimap } from './minimap'; // If needed

/**
 * Attaches all necessary event listeners.
 */
export function attachAllListeners(): void {
    console.log("Attaching listeners...");

    // --- Highlight Input Listener ---
    if (elements.highlightInput) {
        const listenerKey = '__debouncedHighlightListener';
        if (!(elements.highlightInput as any)[listenerKey]) {
            const debouncedHandler = debounce((event: Event) => {
                const inputElement = event.target as HTMLInputElement;
                state.highlightTerm = inputElement.value;
                console.log(`Highlight input changed (debounced): "${state.highlightTerm}". Applying highlight.`);
                applyHighlight(state.highlightTerm);
                // updateMinimap(); // If needed
            }, 250);
            elements.highlightInput.addEventListener('input', debouncedHandler);
            (elements.highlightInput as any)[listenerKey] = debouncedHandler;
            console.log("Attached debounced highlight input listener.");
        }
    } else {
        console.error("Cannot attach listener: Highlight input element not found.");
    }

    // --- Minimap Drag Listener ---
    if (elements.minimapContainer) {
        const listenerKey = '__minimapMouseDownListener';
        const existingListener = (elements.minimapContainer as any)[listenerKey];
        if (existingListener) {
            elements.minimapContainer.removeEventListener('mousedown', existingListener);
            // console.log("Removed existing minimap mousedown listener."); // Optional log
        }
        elements.minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);
        (elements.minimapContainer as any)[listenerKey] = handleMinimapMouseDown;
        console.log("Attached minimap mousedown listener.");
        elements.minimapContainer.style.cursor = 'grab';
    } else {
        console.error("Cannot attach listener: Minimap container element not found.");
    }

    // --- Grid.js Search Listener (for Filter Updates) ---
    if (state.gridInstance) {
        const listenerKey = '__gridSearchListener'; // Changed key name
        const gridInstanceWithListener = state.gridInstance as any;
        const existingListener = gridInstanceWithListener[listenerKey];

        // Define the handler function for the 'search' event
        const gridSearchHandler = (results: any) => { // 'search' event might pass results
            console.log("Grid.js 'search' event detected. Re-applying highlight for current term:", state.highlightTerm, "Search results:", results);
            // Use a minimal timeout to ensure the DOM has likely finished updating
            setTimeout(() => {
                applyHighlight(state.highlightTerm);
                // updateMinimap(); // If needed
            }, 50); // Adjust delay if needed
        };

        // --- MODIFIED SECTION ---
        // Remove previous listener if exists (using specific .off() is best if available)
        if (existingListener) {
            console.warn("Existing Grid.js 'search' listener detected. Attempting removal/reattachment.");
            // If Grid.js provides an 'off' method:
            try {
                state.gridInstance.off('search', existingListener); // Use specific event name
                console.log("Removed existing Grid.js 'search' listener via .off().");
            } catch (offError) {
                console.error("Failed to remove listener using .off()", offError);
            }
        }

        // Attach the 'search' event listener using Grid.js's .on() method
        state.gridInstance.on('search', gridSearchHandler);
        // Store the handler function on the instance
        gridInstanceWithListener[listenerKey] = gridSearchHandler;
        console.log("Attached 'search' event listener to Grid.js instance.");
        // --- END MODIFIED SECTION ---

    } else {
        console.warn("Grid.js instance not found, grid event listeners not attached.");
    }

    console.log("Finished attaching listeners.");
}

// Optional: Update removeAllListeners if implemented
// export function removeAllListeners(): void { ... }
