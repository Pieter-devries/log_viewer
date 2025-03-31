import { state, elements } from './state';
import { escapeRegExp } from './utils';

/**
 * Recursively traverses DOM nodes and applies highlighting spans to text nodes.
 */
export function highlightNode(node: Node, regex: RegExp, highlightClass: string): boolean {
    if (node.nodeType === 3) { // Text node
        const text = node.nodeValue;
        if (!text) return false; // Skip empty text nodes
        const matches = text.matchAll(regex);
        const matchesArray = Array.from(matches);
        if (matchesArray.length > 0) {
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            for (const match of matchesArray) {
                const matchText = match[0];
                const index = match.index;
                if (index === undefined) continue;
                // Add text before match
                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                }
                // Add highlighted span
                const span = document.createElement('span');
                span.className = highlightClass;
                span.textContent = matchText;
                fragment.appendChild(span);
                lastIndex = index + matchText.length;
            }
            // Add text after last match
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            // Safety check before replacing
            if (node.parentNode) {
                try {
                    node.parentNode.replaceChild(fragment, node);
                } catch (e) {
                    console.error("highlightNode: Error during replaceChild:", e, { node: node, parent: node.parentNode });
                    return false; // Indicate failure
                }
            } else {
                console.warn("highlightNode: node.parentNode was null.", { node: node });
                return false; // Indicate failure
            }
            return true; // Indicate success
        }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test((node as Element).tagName) && (node as Element).className !== highlightClass) { // Element node
        const children = Array.from(node.childNodes);
        let highlightedInChildren = false;
        for (let i = 0; i < children.length; i++) {
            // Use recursion and update flag
            if (highlightNode(children[i], regex, highlightClass)) {
                highlightedInChildren = true;
            }
        }
        return highlightedInChildren;
    }
    return false; // No highlight occurred
}

/**
 * Applies highlighting to log lines based on input and state.
 * Also updates minimap markers.
 */
export function applyHighlight(): void {
    // console.log("ApplyHighlight called");
    if (!elements.highlightInput || !elements.logLinesArea || !elements.minimapContainer) {
        console.warn("applyHighlight: Missing required elements.");
        return;
    }
    const highlightTerm = elements.highlightInput.value;
    const logLines = elements.logLinesArea.querySelectorAll<HTMLElement>('.log-line'); // Type assertion
    const minimap = elements.minimapContainer;
    const logArea = elements.logLinesArea;
    const highlightClass = 'highlight-match';

    // Clear previous markers
    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    const minimapIsVisible = minimap.style.display !== 'none';
    const regexFlags = state.highlightCaseSensitive ? 'g' : 'gi'; // Use state
    const highlightRegex = highlightTerm ? new RegExp(escapeRegExp(highlightTerm), regexFlags) : null;

    const markerFragment = document.createDocumentFragment();
    const minimapHeight = minimap.clientHeight;
    const contentScrollHeight = Math.max(1, logArea.scrollHeight);
    const markerHeight = 2;

    logLines.forEach((line, index) => {
        const originalHtml = line.dataset.originalHtml;
        if (originalHtml === undefined) {
            // Basic fallback
            const textContent = line.dataset.originalText || line.textContent || '';
            if (highlightRegex) { line.innerHTML = textContent.replace(highlightRegex, `<span class="${highlightClass}">$&</span>`); }
            else { line.textContent = textContent; }
            return;
        }
        // Restore original HTML first
        line.innerHTML = originalHtml;

        let lineContainsHighlight = false;
        if (highlightRegex) {
            try {
                // Apply highlighting recursively
                lineContainsHighlight = highlightNode(line, highlightRegex, highlightClass);
            } catch (e) {
                console.error(`ApplyHighlight Error processing line ${index}:`, e);
                try { line.innerHTML = originalHtml; } // Attempt restore
                catch (restoreError) { console.error("ApplyHighlight: Failed to restore HTML after highlight error", restoreError); }
            }
        }

        // Add minimap marker if needed
        if (minimapIsVisible && lineContainsHighlight && minimapHeight > 0) {
            const lineOffsetTop = line.offsetTop;
            const relativePos = lineOffsetTop / contentScrollHeight;
            const markerTop = Math.max(0, Math.min(minimapHeight - markerHeight, relativePos * minimapHeight));
            if (!isNaN(markerTop) && isFinite(markerTop)) {
                const marker = document.createElement('div');
                marker.className = 'minimap-marker';
                marker.style.top = markerTop + 'px';
                markerFragment.appendChild(marker);
            }
        }
    }); // End forEach logLine

    minimap.appendChild(markerFragment);
}
