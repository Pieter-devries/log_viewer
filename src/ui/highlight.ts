// src/ui/highlight.ts
import { elements } from '../core/state';
import { escapeRegExp } from '../utils/escapeRegExp';
import { updateMinimapMarkers, updateMinimapThumb } from './minimap'; // Import thumb update

/**
 * Recursively finds text nodes within an element and wraps matches in <mark> tags.
 */
function highlightTextNodes(element: Node, regex: RegExp): boolean {
    // ... (implementation unchanged) ...
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    const nodesToProcess: Text[] = [];
    while (node = walker.nextNode()) {
        // Ensure it's a text node with content and not inside script/style/mark
        if (node.nodeValue?.trim() && node.parentElement && !['MARK', 'SCRIPT', 'STYLE'].includes(node.parentElement.nodeName)) {
            nodesToProcess.push(node as Text);
        }
    }

    let highlightsMade = false;
    nodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue || '';
        let match; let lastIndex = 0;
        const fragment = document.createDocumentFragment();
        regex.lastIndex = 0; // Reset regex state for each node

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) { fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index))); }
            // Create and add the mark tag
            const mark = document.createElement('mark');
            mark.className = 'gridjs-highlight';
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = regex.lastIndex;
            highlightsMade = true;
            // Handle potential zero-length matches from some regexes
            if (match[0].length === 0) { regex.lastIndex++; }
        }

        // Add any remaining text after the last match
        if (lastIndex > 0) { // Only replace if matches were found
            if (lastIndex < text.length) { fragment.appendChild(document.createTextNode(text.substring(lastIndex))); }
            // Replace the original text node with the fragment
            textNode.parentNode?.replaceChild(fragment, textNode);
        }
    });
    return highlightsMade;
}


/**
 * Clears existing highlights from the grid container.
 */
export function clearHighlight(): void {
    if (!elements.gridJsContainer) return;
    const marks = elements.gridJsContainer.querySelectorAll('mark.gridjs-highlight');
    marks?.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            // Replace the mark tag with its text content
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            // Optional: Normalize the parent to merge adjacent text nodes
            parent.normalize();
        }
    });
}


/**
 * Applies highlighting to the grid content based on the search term.
 */
export function applyHighlight(term: string | undefined): void {
    console.log(`ApplyHighlight called with term: "${term}"`);
    clearHighlight();
    const searchTerm = term?.trim();

    // --- Call minimap updates even if no term ---
    if (!searchTerm || !elements.gridJsContainer) {
        console.log("Highlight skipped: No search term or grid container.");
        updateMinimapMarkers(); // Update minimap markers (will clear if no highlights)
        updateMinimapThumb();   // Update thumb visibility/position
        return;
    }
    // --- End change ---

    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>(".gridjs-wrapper");
    if (!gridWrapper) {
        console.error("Highlight skipped: grid wrapper not found.");
        return;
    }

    console.log(`Highlighting with regex for: "${searchTerm}"`);
    try {
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        const tds = gridWrapper.querySelectorAll('td.gridjs-td');
        console.log(`Found ${tds.length} cells to check for highlighting.`);
        let highlightsAppliedCount = 0;
        tds.forEach(td => {
            if (highlightTextNodes(td, regex)) { highlightsAppliedCount++; }
        });
        console.log(`Applied highlights within ${highlightsAppliedCount} cells.`);
    } catch (e) {
        console.error("Error during highlight processing:", e);
    }

    // Update minimap *after* highlights are applied
    console.log("Calling updateMinimap after applying highlights.");
    try {
        updateMinimapMarkers(); // Update markers based on new highlights
        updateMinimapThumb();   // Update thumb visibility/position
    } catch (e) {
        console.error("Error calling updateMinimap:", e);
    }
}
