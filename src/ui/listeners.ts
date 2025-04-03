// src/ui/listeners.ts
import { elements, state } from '../core/state';
import { debounce } from '../utils/debounce';
import { applyHighlight } from './highlight';
import { handleMinimapMouseDown, updateMinimapThumb } from './minimap'; // Import thumb update
import { getScrollWrapper } from './dom'; // Import helper

/**
 * Attaches all necessary event listeners to the DOM elements.
 */
export function attachAllListeners(): void {
    console.log("Attaching listeners...");

    // --- Highlight Input Listener ---
    if (elements.highlightInput) {
        const listenerKey = '__debouncedHighlightListener';
        // Ensure listener isn't attached multiple times if create/update runs again
        if (!(elements.highlightInput as any)[listenerKey]) {
            const debouncedHandler = debounce((event: Event) => {
                const inputElement = event.target as HTMLInputElement;
                state.highlightTerm = inputElement.value;
                console.log(`Highlight input changed (debounced): "${state.highlightTerm}". Applying highlight.`);
                applyHighlight(state.highlightTerm);
            }, 250);
            elements.highlightInput.addEventListener('input', debouncedHandler);
            (elements.highlightInput as any)[listenerKey] = debouncedHandler; // Store listener ref
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
            // Remove previous listener if it exists (e.g., during update)
            elements.minimapContainer.removeEventListener('mousedown', existingListener);
        }
        elements.minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);
        (elements.minimapContainer as any)[listenerKey] = handleMinimapMouseDown; // Store listener ref
        console.log("Attached minimap mousedown listener.");
        elements.minimapContainer.style.cursor = 'grab';
    } else {
        console.error("Cannot attach listener: Minimap container element not found.");
    }

    // --- Grid Wrapper Scroll Listener (for Minimap Thumb) ---
    const gridWrapper = getScrollWrapper();
    if (gridWrapper) {
        const listenerKey = '__gridWrapperScrollListener';
        const existingListener = (gridWrapper as any)[listenerKey];
        if (existingListener) {
            gridWrapper.removeEventListener('scroll', existingListener);
            // console.log("Removed existing grid wrapper scroll listener.");
        }
        // Use a throttled handler if performance becomes an issue, but direct call is fine for now
        const scrollHandler = () => updateMinimapThumb();
        gridWrapper.addEventListener('scroll', scrollHandler);
        (gridWrapper as any)[listenerKey] = scrollHandler; // Store listener ref
        console.log("Attached scroll listener to grid wrapper for minimap thumb.");
    } else {
        console.warn("Grid wrapper not found, cannot attach scroll listener for minimap thumb.");
    }

    // --- Grid.js Search Listener (for Filter Updates) ---
    if (state.gridInstance) {
        const listenerKey = '__gridSearchListener';
        const gridInstanceWithListener = state.gridInstance as any; // Type assertion if needed
        const existingListener = gridInstanceWithListener[listenerKey];

        // Define the handler
        const gridSearchHandler = (results: any) => { // 'search' event might pass results
            console.log("Grid.js 'search' event detected. Re-applying highlight for current term:", state.highlightTerm, "Search results:", results);
            // Delay slightly to allow Grid.js to update the DOM
            setTimeout(() => {
                applyHighlight(state.highlightTerm);
            }, 50); // Adjust delay if needed
        };

        // Remove old listener if it exists
        if (existingListener) {
            console.warn("Existing Grid.js 'search' listener detected. Attempting removal/reattachment.");
            try {
                state.gridInstance.off('search', existingListener); // Use specific event name
                console.log("Removed existing Grid.js 'search' listener via .off().");
            } catch (offError) {
                console.error("Failed to remove listener using .off()", offError);
                // Potentially try other removal methods if Grid.js API changes or is different
            }
        }

        // Attach the new listener
        state.gridInstance.on('search', gridSearchHandler);
        // Store the new listener reference on the instance
        gridInstanceWithListener[listenerKey] = gridSearchHandler;
        console.log("Attached 'search' event listener to Grid.js instance.");
    } else {
        console.warn("Grid.js instance not found, grid event listeners not attached.");
    }


    console.log("Finished attaching listeners.");
}
