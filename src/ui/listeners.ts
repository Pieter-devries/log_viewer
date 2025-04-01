// src/ui/listeners.ts
import { elements, state } from '../core/state';
import { debounce } from '../utils/debounce';
import { applyHighlight } from './highlight';
import { handleMinimapMouseDown } from './minimap'; // Import only the mousedown handler

/**
 * Attaches all necessary event listeners to the DOM elements.
 * Ensures listeners are not attached multiple times.
 */
export function attachAllListeners(): void {
    console.log("Attaching listeners...");

    // --- Highlight Input Listener ---
    if (elements.highlightInput) {
        const listenerKey = '__debouncedHighlightListener';
        // Check if listener already exists on the element
        if (!(elements.highlightInput as any)[listenerKey]) {
            const debouncedHandler = debounce((event: Event) => {
                const inputElement = event.target as HTMLInputElement;
                // Update state directly or call a state update function
                state.highlightTerm = inputElement.value;
                applyHighlight(state.highlightTerm); // Trigger highlight logic
            }, 250); // 250ms debounce time

            elements.highlightInput.addEventListener('input', debouncedHandler);
            // Store reference on the element itself to check later
            (elements.highlightInput as any)[listenerKey] = debouncedHandler;
            console.log("Attached highlight input listener.");
        }
    } else {
        console.error("Cannot attach listener: Highlight input element not found.");
    }

    // --- Minimap Drag Listener ---
    if (elements.minimapContainer) {
        const listenerKey = '__minimapMouseDownListener';
        // Clean up potential previous listener before adding
        const existingListener = (elements.minimapContainer as any)[listenerKey];
        if (existingListener) {
            elements.minimapContainer.removeEventListener('mousedown', existingListener);
            console.log("Removed previous minimap mousedown listener.");
        }

        // Add the new mousedown listener (which sets up move/up listeners)
        elements.minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);
        // Store reference on the element
        (elements.minimapContainer as any)[listenerKey] = handleMinimapMouseDown;
        console.log("Attached minimap mousedown listener.");

        // Set initial cursor style for the minimap
        elements.minimapContainer.style.cursor = 'grab';
    } else {
        console.error("Cannot attach listener: Minimap container element not found.");
    }

    // Add other listeners here if needed (e.g., window resize)
}
