// src/ui/highlight.ts
import { elements } from '../core/state'; // Use relative path
import { escapeRegExp } from '../utils/escapeRegExp'; // Use relative path
import { updateMinimap } from './minimap';

/**
 * Recursively finds text nodes within an element and wraps matches in <mark> tags.
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
        let match; let lastIndex = 0;
        const fragment = document.createDocumentFragment();
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) { fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index))); }
            const mark = document.createElement('mark');
            mark.className = 'gridjs-highlight';
            mark.textContent = match[0];
            fragment.appendChild(mark);
            lastIndex = regex.lastIndex;
            highlightsMade = true;
            if (match[0].length === 0) { regex.lastIndex++; }
        }

        if (lastIndex > 0) {
            if (lastIndex < text.length) { fragment.appendChild(document.createTextNode(text.substring(lastIndex))); }
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
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
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

    // Update minimap after clearing/applying highlights
    // Moved updateMinimap call to the end

    if (!searchTerm || !elements.gridJsContainer) {
        console.log("Highlight skipped: No search term or grid container.");
        updateMinimap(); // Update minimap to clear markers if term is empty
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
            if (highlightTextNodes(td, regex)) { highlightsAppliedCount++; }
        });
        console.log(`Applied highlights within ${highlightsAppliedCount} cells.`);
    } catch (e) { console.error("Error during highlight processing:", e); }

    // Update minimap *after* highlights are applied
    console.log("Calling updateMinimap after applying highlights.");
    try { updateMinimap(); }
    catch (minimapError) { console.error("Error calling updateMinimap:", minimapError); }
}
