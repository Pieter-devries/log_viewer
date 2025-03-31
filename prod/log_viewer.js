// Based on log_viewer_v7_debug
// Test: Commented out highlightNode call in applyHighlight to isolate error

looker.plugins.visualizations.add({
  // Visualization Definition Object
  id: 'log-viewer-dev', // Development ID
  label: 'Log Viewer (Dev)', // Development Label

  // --- State Storage --- (Unchanged)
  originalData: [], queryResponse: null, visElement: null, filterInput: null, highlightInput: null,
  fieldSelectElement: null, logLinesArea: null, minimapContainer: null, minimapThumb: null,
  isDragging: false, _boundMouseMove: null, _boundMouseUp: null, selectedFieldName: 'all',
  showRowNumbers: false, rowNumberCheckbox: null,

  // --- Helper Function --- (Unchanged)
  escapeRegExp: function (string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },

  // --- Recursive Highlighting Function --- (Unchanged but potentially problematic)
  highlightNode: function (node, regex, highlightClass) {
    if (node.nodeType === 3) {
      const text = node.nodeValue;
      const matches = text.match(regex);
      if (matches) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        text.replace(regex, (match, index) => {
          if (index > lastIndex) { fragment.appendChild(document.createTextNode(text.substring(lastIndex, index))); }
          const span = document.createElement('span');
          span.className = highlightClass;
          span.textContent = match;
          fragment.appendChild(span);
          lastIndex = index + match.length;
        });
        if (lastIndex < text.length) { fragment.appendChild(document.createTextNode(text.substring(lastIndex))); }
        // This line might be the source of the "Node cannot be found" error
        node.parentNode.replaceChild(fragment, node);
        return true;
      }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName) && node.className !== highlightClass) {
      const children = Array.from(node.childNodes);
      let highlightedInChildren = false;
      for (let i = 0; i < children.length; i++) {
        if (this.highlightNode(children[i], regex, highlightClass)) { highlightedInChildren = true; }
      }
      return highlightedInChildren;
    }
    return false;
  },

  // --- Highlighting & Minimap Marker Function (MODIFIED FOR TEST) ---
  applyHighlight: function () {
    console.log("ApplyHighlight called (v8 Test - highlightNode disabled)"); // Log entry
    if (!this.highlightInput || !this.logLinesArea || !this.minimapContainer) return;
    const highlightTerm = this.highlightInput.value;
    const logLines = this.logLinesArea.querySelectorAll('.log-line');
    const minimap = this.minimapContainer;
    const logArea = this.logLinesArea;
    const highlightClass = 'highlight-match';

    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    const minimapIsVisible = minimap.style.display !== 'none';
    const highlightRegex = highlightTerm ? new RegExp(this.escapeRegExp(highlightTerm), 'gi') : null;
    const markerFragment = document.createDocumentFragment();
    const minimapHeight = minimap.clientHeight;
    const contentScrollHeight = Math.max(1, logArea.scrollHeight);
    const markerHeight = 2;

    logLines.forEach((line, index) => {
      const originalHtml = line.dataset.originalHtml;
      if (originalHtml === undefined) {
        // console.warn(`ApplyHighlight: Row ${index} missing originalHtml dataset.`); // Keep commented for now
        // Fallback logic remains unchanged
        if (highlightRegex) { line.innerHTML = (line.dataset.originalText || line.textContent).replace(highlightRegex, `<span class="${highlightClass}">$&</span>`); }
        else { line.textContent = line.dataset.originalText || line.textContent; }
        return;
      }
      // Restore original HTML (still necessary to clear previous highlights if any existed)
      line.innerHTML = originalHtml;

      let lineContainsHighlight = false; // Assume no highlight occurs in this test
      if (highlightRegex) {
        // *** TEST: Temporarily disable the actual highlighting DOM manipulation ***
        // try {
        //    lineContainsHighlight = this.highlightNode(line, highlightRegex, highlightClass);
        // } catch (e) {
        //    console.error(`ApplyHighlight: Error during highlightNode call on line ${index}:`, e);
        //    line.innerHTML = originalHtml; // Restore on error
        // }
        // Instead, just check if the text *would* contain a highlight for marker purposes
        const originalText = line.dataset.originalText || line.textContent;
        if (originalText.match(highlightRegex)) {
          lineContainsHighlight = true;
        }
        // *** END TEST MODIFICATION ***
      }

      // Add minimap marker if needed (logic remains the same)
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
    }); // End logLines.forEach

    minimap.appendChild(markerFragment);
    // console.log("ApplyHighlight finished (v8 Test)"); // Log finish
  }, // --- End of applyHighlight function ---

  // --- Scroll Thumb Update Function --- (Unchanged)
  updateThumb: function () { /* ... unchanged ... */ },

  // --- Event Handler for Log Area Scroll --- (Unchanged)
  syncThumbPosition: function () { /* ... unchanged ... */ },

  // --- Event Handlers for Minimap Dragging --- (Unchanged)
  handleMinimapMouseDown: function (event) { /* ... unchanged ... */ },
  handleMinimapMouseMove: function (event) { /* ... unchanged ... */ },
  handleMinimapMouseUp: function (event) { /* ... unchanged ... */ },

  // --- Find & Store Elements --- (Unchanged)
  _findElements: function (element) { /* ... unchanged ... */ },

  // --- Rendering Function (Includes Debug Logging from v7) ---
  renderViz: function () {
    console.log("RenderViz called (v8 Test)"); // Log start
    if (!this.visElement || !this.originalData || !this.queryResponse || !this.filterInput || !this.logLinesArea || !this.minimapContainer || !this.fieldSelectElement || !this.rowNumberCheckbox || !this.highlightInput || !this.minimapThumb) {
      console.warn("RenderViz aborted: Missing critical elements or data");
      return;
    }
    const data = this.originalData; const queryResponse = this.queryResponse; const filterInput = this.filterInput;
    const logLinesArea = this.logLinesArea; const minimap = this.minimapContainer;
    const selectedFieldName = this.selectedFieldName; const showRowNumbers = this.showRowNumbers;

    const fieldsToRender = [
      ...(queryResponse.fields.dimensions || []),
      ...(queryResponse.fields.measures || [])
    ];
    console.log("Fields to Render:", fieldsToRender.map(f => f.name)); // Log fields included

    if (fieldsToRender.length === 0) { /* ... unchanged ... */ }

    // --- Filtering ---
    const filterValue = filterInput.value.toLowerCase();
    let dataToRender;
    const allFieldsForFilter = fieldsToRender;
    if (filterValue) { /* ... unchanged ... */ }
    else { dataToRender = data; }
    console.log(`Rendering ${dataToRender ? dataToRender.length : 0} rows.`); // Log row count

    // --- Rendering ---
    logLinesArea.innerHTML = '';
    if (!dataToRender || dataToRender.length === 0) { /* ... unchanged ... */ }
    else {
      try {
        const fragment = document.createDocumentFragment();
        dataToRender.forEach((row, index) => {
          // Log only for the first row for brevity, remove 'if' to log all rows
          if (index === 0) console.log(`--- Processing Row ${index} ---`);
          const logEntry = document.createElement('div');
          logEntry.className = 'log-line';
          let fullLineTextParts = [];
          // Row Number
          if (showRowNumbers) { /* ... unchanged ... */ }
          // Field Spans Loop
          fieldsToRender.forEach((field, fieldIndex) => {
            // Log only for the first row for brevity
            if (index === 0) console.log(` -> Field ${fieldIndex}: ${field.name} (Measure: ${field.is_measure})`);
            // Separator
            if (fieldIndex > 0) { /* ... unchanged ... */ }
            // Field Span
            const fieldSpan = document.createElement('span');
            const fieldType = field.is_measure ? 'measure' : 'dimension';
            fieldSpan.classList.add(`log-field`, `field-${fieldIndex}`, `field-type-${fieldType}`);
            const cell = row[field.name];
            // *** DEBUG LOGGING for Cell & Formatting ***
            if (index === 0 && field.is_measure) { console.log(`    Measure Cell (${field.name}):`, cell); }
            const formattedValue = cell?.value != null ? LookerCharts.Utils.htmlForCell(cell) : '[NULL]';
            if (index === 0 && field.is_measure) { console.log(`    Formatted Value:`, formattedValue); }
            // *** END DEBUG LOGGING ***
            fieldSpan.innerHTML = formattedValue;
            fullLineTextParts.push(cell?.value != null ? cell.value.toString() : '[NULL]');
            // Drill Functionality
            if (cell && cell.links) { /* ... unchanged ... */ }
            // *** DEBUG LOGGING before append ***
            // if (index === 0) console.log(`    Appending span for ${field.name}`);
            logEntry.appendChild(fieldSpan);
          }); // End fieldsToRender loop
          logEntry.dataset.originalText = fullLineTextParts.join('');
          logEntry.dataset.originalHtml = logEntry.innerHTML;
          fragment.appendChild(logEntry);
        }); // End dataToRender loop
        logLinesArea.appendChild(fragment);
        console.log("RenderViz finished processing rows."); // Log finish
      } catch (renderError) { /* ... unchanged ... */ }
    }
    // --- Check Overflow & Update Minimap/Thumb ---
    requestAnimationFrame(() => {
      // console.log("requestAnimationFrame callback entered"); // Debug if needed
      if (!this.logLinesArea || !this.minimapContainer) {
        // console.log("requestAnimationFrame: Missing logLinesArea or minimapContainer");
        return;
      }
      const logAreaScrollHeight = this.logLinesArea.scrollHeight;
      const logAreaClientHeight = this.logLinesArea.clientHeight;
      if (logAreaScrollHeight > logAreaClientHeight) {
        this.minimapContainer.style.display = 'block';
        this.updateThumb();
        this.applyHighlight(); // Calls the modified applyHighlight
      } else {
        this.minimapContainer.style.display = 'none';
        this.applyHighlight(); // Calls the modified applyHighlight
      }
      // console.log("requestAnimationFrame callback finished");
    });
  }, // --- End of renderViz function ---

  // --- Looker API Methods ---
  create: function (element, config) { /* ... full function ... */ },
  updateAsync: function (data, element, config, queryResponse, details, done) { /* ... full function ... */ }
});