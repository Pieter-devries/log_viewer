// src/ui/highlight.ts
import { elements } from '../core/state';
import { escapeRegExp } from '../utils/escapeRegExp';
import { updateMinimap } from './minimap'; // Import minimap update function

/**
 * Recursively finds text nodes within an element (excluding script/style/mark)
 * and wraps matches of the regex in <mark> tags.
 * @param element - The container element to search within.
 * @param regex - The regular expression to match.
 * @returns True if any highlights were made, false otherwise.
 */
function highlightTextNodes(element: Node, regex: RegExp): boolean {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    const nodesToProcess: Text[] = [];
    while (node = walker.nextNode()) {
        if (node.nodeValue?.trim() && node.parentElement && !['MARK', 'SCRIPT', 'STYLE'].includes(node.parentElement.nodeName)) {
            nodesToProcess.push(node as Text);
        }
    }

    let highlightsMade = false;
    nodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue || '';
        let match;
        let lastIndex = 0;
        const fragment = document.createDocumentFragment();
        regex.lastIndex = 0; // Reset regex state

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            const mark = document.createElement('mark');
            mark.className = 'gridjs-highlight'; // Use class from highlight.css
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = regex.lastIndex;
            highlightsMade = true;
            if (match[0].length === 0) { regex.lastIndex++; } // Prevent infinite loops
        }

        if (lastIndex > 0) { // If matches were found
            if (lastIndex < text.length) { // Add remaining text
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            textNode.parentNode?.replaceChild(fragment, textNode); // Replace node
        }
    });
    return highlightsMade;
}

/**
 * Clears existing highlights from the grid container.
 */
export function clearHighlight(): void {
    if (!elements.gridJsContainer) return;
    // Find all existing mark elements within the grid container
    const marks = elements.gridJsContainer.querySelectorAll('mark.gridjs-highlight');
    marks?.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            // Replace the mark with its text content
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            // Merge adjacent text nodes for cleaner DOM and potentially better layout
            parent.normalize();
        }
    });
    // Note: Minimap clearing is handled separately if needed
}


/**
 * Applies highlighting to the grid content based on the search term.
 * @param term - The search term string.
 */
export function applyHighlight(term: string | undefined): void {
    console.log(`ApplyHighlight called with term: "${term}"`);
    clearHighlight(); // Clear previous highlights first
    const searchTerm = term?.trim();

    // Update minimap regardless (clears markers if term is empty)
    // Consider calling updateMinimap *after* applying highlights if markers depend on marks
    // updateMinimap(); // Moved after applying highlights

    if (!searchTerm || !elements.gridJsContainer) {
        console.log("Highlight skipped: No search term or grid container.");
        updateMinimap(); // Update minimap to clear markers
        return;
    }

    const gridWrapper = elements.gridJsContainer.querySelector<HTMLElement>('.gridjs-wrapper');
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
            if (highlightTextNodes(td, regex)) {
                highlightsAppliedCount++;
            }
        });
        console.log(`Applied highlights within ${highlightsAppliedCount} cells.`);
    } catch (e) {
        console.error("Error during highlight processing:", e);
    }

    // Update minimap *after* highlights are applied so markers can be generated
    console.log("Calling updateMinimap after applying highlights.");
    try {
        updateMinimap();
    } catch (minimapError) {
        console.error("Error calling updateMinimap:", minimapError);
    }
}

