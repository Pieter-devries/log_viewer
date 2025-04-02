// src/ui/listeners.ts
import { elements, state } from '../core/state'; // Use relative path
import { debounce } from '../utils/debounce'; // Use relative path
import { applyHighlight } from './highlight';
import { handleMinimapMouseDown } from './minimap'; // Import only the mousedown handler

/**
 * Attaches all necessary event listeners to the DOM elements.
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
                applyHighlight(state.highlightTerm);
            }, 250);
            elements.highlightInput.addEventListener('input', debouncedHandler);
            (elements.highlightInput as any)[listenerKey] = debouncedHandler;
            console.log("Attached highlight input listener.");
        }
    } else { console.error("Cannot attach listener: Highlight input element not found."); }

    // --- Minimap Drag Listener ---
    if (elements.minimapContainer) {
        const listenerKey = '__minimapMouseDownListener';
        const existingListener = (elements.minimapContainer as any)[listenerKey];
        if (existingListener) {
            elements.minimapContainer.removeEventListener('mousedown', existingListener);
        }
        elements.minimapContainer.addEventListener('mousedown', handleMinimapMouseDown);
        (elements.minimapContainer as any)[listenerKey] = handleMinimapMouseDown;
        console.log("Attached minimap mousedown listener.");
        elements.minimapContainer.style.cursor = 'grab';
    } else { console.error("Cannot attach listener: Minimap container element not found."); }
}
