looker.plugins.visualizations.add({
  // Visualization Definition Object
  id: 'log-viewer-dev',
  label: 'Log Viewer (Dev)',

  // --- State Storage ---
  originalData: [], queryResponse: null, visElement: null, filterInput: null, highlightInput: null,
  fieldSelectElement: null, logLinesArea: null, minimapContainer: null, minimapThumb: null,
  isDragging: false, _boundMouseMove: null, _boundMouseUp: null, selectedFieldName: 'all',
  showRowNumbers: false, rowNumberCheckbox: null,

  // --- Helper Function ---
  escapeRegExp: function (string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },

  // --- Recursive Highlighting Function (NEW) ---
  highlightNode: function (node, regex, highlightClass) {
    // Node Types: 1=Element, 3=Text, 8=Comment
    if (node.nodeType === 3) { // Text node
      const text = node.nodeValue;
      const matches = text.match(regex);
      if (matches) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        text.replace(regex, (match, index) => {
          // Add text before the match
          if (index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
          }
          // Add the highlighted span
          const span = document.createElement('span');
          span.className = highlightClass;
          span.textContent = match;
          fragment.appendChild(span);
          lastIndex = index + match.length;
        });
        // Add any remaining text after the last match
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        // Replace the original text node with the fragment
        node.parentNode.replaceChild(fragment, node);
        return true; // Indicated a highlight occurred
      }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName) && node.className !== highlightClass) {
      // Element node (but not script/style tags or already highlighted spans)
      // Iterate over a static copy of child nodes because the collection might change
      const children = Array.from(node.childNodes);
      let highlightedInChildren = false;
      for (let i = 0; i < children.length; i++) {
        if (this.highlightNode(children[i], regex, highlightClass)) {
          highlightedInChildren = true;
        }
      }
      return highlightedInChildren;
    }
    return false; // No highlight occurred in this node or its children
  },

  // --- Highlighting & Minimap Marker Function (MODIFIED to use highlightNode) ---
  applyHighlight: function () {
    if (!this.highlightInput || !this.logLinesArea || !this.minimapContainer) return;

    const highlightTerm = this.highlightInput.value; // Use raw value for regex, check case later if needed
    const logLines = this.logLinesArea.querySelectorAll('.log-line');
    const minimap = this.minimapContainer;
    const logArea = this.logLinesArea;
    const highlightClass = 'highlight-match'; // Define class here

    // Clear previous markers ONLY
    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());

    const minimapIsVisible = minimap.style.display !== 'none';
    // Create Regex only if term exists, 'gi' for global, case-insensitive
    const highlightRegex = highlightTerm ? new RegExp(this.escapeRegExp(highlightTerm), 'gi') : null;
    const markerFragment = document.createDocumentFragment();
    const minimapHeight = minimap.clientHeight;
    const contentScrollHeight = logArea.scrollHeight; // Get scroll height *before* potential changes
    const markerHeight = 2;

    logLines.forEach((line, index) => {
      const originalHtml = line.dataset.originalHtml;
      if (originalHtml === undefined) {
        console.warn(`ApplyHighlight: Row ${index} missing originalHtml dataset.`);
        // Basic fallback if originalHtml isn't set (shouldn't happen often)
        if (highlightRegex) {
          line.innerHTML = (line.dataset.originalText || line.textContent).replace(highlightRegex, `<span class="${highlightClass}">$&</span>`);
        } else {
          line.textContent = line.dataset.originalText || line.textContent;
        }
        return;
      }

      // Always restore original HTML first to clear previous highlights
      line.innerHTML = originalHtml;

      let lineContainsHighlight = false;
      if (highlightRegex) {
        try {
          // Use the recursive highlightNode function starting from the line element itself
          lineContainsHighlight = this.highlightNode(line, highlightRegex, highlightClass);
        } catch (e) {
          console.error(`ApplyHighlight: Error processing line ${index}:`, e, "Original HTML:", originalHtml);
          // Restore original HTML on error
          line.innerHTML = originalHtml;
        }
      }

      // Add minimap marker if needed (check AFTER highlighting attempts)
      if (minimapIsVisible && lineContainsHighlight && contentScrollHeight > 0 && minimapHeight > 0) {
        // Ensure offsetTop is read *after* potential DOM changes from highlighting
        const lineOffsetTop = line.offsetTop;
        const relativePos = lineOffsetTop / contentScrollHeight;
        const markerTop = Math.max(0, Math.min(minimapHeight - markerHeight, relativePos * minimapHeight));

        // Basic check for NaN or invalid marker position
        if (!isNaN(markerTop) && isFinite(markerTop)) {
          const marker = document.createElement('div');
          marker.className = 'minimap-marker';
          marker.style.top = markerTop + 'px';
          markerFragment.appendChild(marker);
        } else {
          // console.warn(`ApplyHighlight: Invalid marker position calculated for line ${index}`, { lineOffsetTop, contentScrollHeight, minimapHeight, markerTop });
        }
      }
    });

    // Append all markers at once
    minimap.appendChild(markerFragment);
  },


  // --- Scroll Thumb Update Function --- (Unchanged from v4)
  updateThumb: function () {
    if (!this.logLinesArea || !this.minimapContainer || !this.minimapThumb) return;
    const logArea = this.logLinesArea; const minimapHeight = this.minimapContainer.clientHeight;
    const contentHeight = logArea.scrollHeight; const visibleHeight = logArea.clientHeight;
    if (contentHeight <= visibleHeight || minimapHeight <= 0) { this.minimapThumb.style.opacity = '0'; this.minimapThumb.style.height = '0px'; return; }
    const thumbHeight = Math.max(20, (visibleHeight / contentHeight) * minimapHeight);
    const maxScrollTop = contentHeight - visibleHeight; const currentScrollTop = Math.min(logArea.scrollTop, maxScrollTop);
    const thumbTop = maxScrollTop > 0 ? (currentScrollTop / maxScrollTop) * (minimapHeight - thumbHeight) : 0;
    const clampedThumbTop = Math.max(0, Math.min(thumbTop, minimapHeight - thumbHeight));
    this.minimapThumb.style.height = `${thumbHeight}px`; this.minimapThumb.style.top = `${clampedThumbTop}px`; this.minimapThumb.style.opacity = '1';
  },

  // --- Event Handler for Log Area Scroll --- (Unchanged from v4)
  syncThumbPosition: function () { if (this.isDragging) return; this.updateThumb(); },

  // --- Event Handlers for Minimap Dragging --- (Unchanged from v4)
  handleMinimapMouseDown: function (event) {
    if (!this.logLinesArea || !this.minimapContainer || !this.minimapThumb) return; event.preventDefault();
    const logArea = this.logLinesArea; const minimapHeight = this.minimapContainer.clientHeight; const contentHeight = logArea.scrollHeight; const visibleHeight = logArea.clientHeight;
    if (contentHeight <= visibleHeight || minimapHeight <= 0) return;
    const bounds = this.minimapContainer.getBoundingClientRect(); const clickY = event.clientY - bounds.top; const thumbHeight = this.minimapThumb.offsetHeight;
    const draggableThumbRange = minimapHeight - thumbHeight; const scrollableContentRange = contentHeight - visibleHeight;
    const scrollRatio = draggableThumbRange > 0 ? (clickY - thumbHeight / 2) / draggableThumbRange : 0;
    const targetScrollTop = scrollRatio * scrollableContentRange;
    logArea.scrollTop = Math.max(0, Math.min(scrollableContentRange, targetScrollTop));
    this.updateThumb(); this.isDragging = true; this.minimapThumb.classList.add('dragging');
    if (!this._boundMouseMove) { this._boundMouseMove = this.handleMinimapMouseMove.bind(this); window.addEventListener('mousemove', this._boundMouseMove); }
    if (!this._boundMouseUp) { this._boundMouseUp = this.handleMinimapMouseUp.bind(this); window.addEventListener('mouseup', this._boundMouseUp); }
  },
  handleMinimapMouseMove: function (event) {
    if (!this.isDragging || !this.logLinesArea || !this.minimapContainer || !this.minimapThumb) return; event.preventDefault();
    const logArea = this.logLinesArea; const minimapHeight = this.minimapContainer.clientHeight; const contentHeight = logArea.scrollHeight; const visibleHeight = logArea.clientHeight;
    const thumbHeight = this.minimapThumb.offsetHeight;
    const bounds = this.minimapContainer.getBoundingClientRect();
    const mouseY = event.clientY - bounds.top;
    const draggableThumbRange = minimapHeight - thumbHeight;
    const scrollableContentRange = contentHeight - visibleHeight;
    const scrollRatio = draggableThumbRange > 0 ? (mouseY - thumbHeight / 2) / draggableThumbRange : 0;
    const targetScrollTop = scrollRatio * scrollableContentRange;
    const maxScrollTop = contentHeight - visibleHeight;
    const newScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));
    logArea.scrollTop = newScrollTop;
    this.updateThumb(); // Force thumb update during drag
  },
  handleMinimapMouseUp: function (event) {
    if (!this.isDragging) return; event.preventDefault();
    this.isDragging = false;
    if (this.minimapThumb) this.minimapThumb.classList.remove('dragging');
    if (this._boundMouseMove) { window.removeEventListener('mousemove', this._boundMouseMove); delete this._boundMouseMove; }
    if (this._boundMouseUp) { window.removeEventListener('mouseup', this._boundMouseUp); delete this._boundMouseUp; }
  },


  // --- Find & Store Elements --- (Unchanged from v4)
  _findElements: function (element) {
    this.visElement = element;
    this.filterInput = element.querySelector("#log-filter-input");
    this.highlightInput = element.querySelector("#log-highlight-input");
    this.fieldSelectElement = element.querySelector("#log-field-select");
    this.logLinesArea = element.querySelector("#log-lines-area");
    this.minimapContainer = element.querySelector("#minimap-container");
    this.minimapThumb = element.querySelector("#minimap-thumb");
    this.rowNumberCheckbox = element.querySelector("#show-row-numbers-chk");
    const criticalElementsFound = !!this.logLinesArea && !!this.rowNumberCheckbox && !!this.filterInput && !!this.fieldSelectElement && !!this.highlightInput && !!this.minimapContainer && !!this.minimapThumb;
    if (!criticalElementsFound) { console.error("_findElements: One or more critical elements NOT found!"); }
    return criticalElementsFound;
  },

  // --- Rendering Function (Store original HTML) --- (Unchanged from v4)
  renderViz: function () {
    if (!this.visElement || !this.originalData || !this.queryResponse || !this.filterInput || !this.logLinesArea || !this.minimapContainer || !this.fieldSelectElement || !this.rowNumberCheckbox || !this.highlightInput || !this.minimapThumb) { return; }
    const data = this.originalData; const queryResponse = this.queryResponse; const filterInput = this.filterInput;
    const logLinesArea = this.logLinesArea; const minimap = this.minimapContainer;
    const selectedFieldName = this.selectedFieldName; const showRowNumbers = this.showRowNumbers;
    const allFields = [...(queryResponse.fields.dimensions || []), ...(queryResponse.fields.measures || [])];
    if (allFields.length === 0) { return; }

    // --- Filtering ---
    const filterValue = filterInput.value.toLowerCase();
    let dataToRender;
    if (filterValue) {
      try { dataToRender = data.filter(row => { if (selectedFieldName === 'all') { return allFields.some(field => { const cell = row[field.name]; const cellValue = cell?.value; return cellValue != null && cellValue.toString().toLowerCase().includes(filterValue); }); } else { const cell = row[selectedFieldName]; const cellValue = cell?.value; return cellValue != null && cellValue.toString().toLowerCase().includes(filterValue); } }); }
      catch (filterError) { console.error("Filter error:", filterError); dataToRender = data; }
    } else { dataToRender = data; }

    // --- Rendering (Flexbox structure, store original HTML) ---
    logLinesArea.innerHTML = '';
    if (!dataToRender || dataToRender.length === 0) {
      const noDataMsg = document.createElement('p'); noDataMsg.style.color = 'orange'; noDataMsg.style.padding = '5px';
      noDataMsg.textContent = filterValue ? 'No logs match filter.' : 'Query returned no data.';
      logLinesArea.appendChild(noDataMsg);
    }
    else {
      try {
        const fragment = document.createDocumentFragment();
        const fieldsToRender = queryResponse.fields.dimensions || [];
        dataToRender.forEach((row, index) => {
          const logEntry = document.createElement('div'); logEntry.className = 'log-line';
          let fullLineTextParts = []; // For plain text version

          // Build inner HTML with spans
          if (showRowNumbers) { const rowNumSpan = document.createElement('span'); rowNumSpan.className = 'log-row-num'; const rowNumText = `${index + 1}: `; rowNumSpan.textContent = rowNumText; logEntry.appendChild(rowNumSpan); fullLineTextParts.push(rowNumText); }
          fieldsToRender.forEach((field, fieldIndex) => { if (fieldIndex > 0) { const sepSpan = document.createElement('span'); sepSpan.className = 'log-field-separator'; sepSpan.textContent = ' | '; logEntry.appendChild(sepSpan); fullLineTextParts.push(' | '); } const fieldSpan = document.createElement('span'); fieldSpan.className = `log-field field-${fieldIndex}`; const cell = row[field.name]; const cellValue = cell?.value; const formattedValue = cellValue != null ? cellValue.toString() : '[NULL]'; fieldSpan.textContent = formattedValue; logEntry.appendChild(fieldSpan); fullLineTextParts.push(formattedValue); });

          // Store BOTH plain text and original HTML structure
          logEntry.dataset.originalText = fullLineTextParts.join('');
          logEntry.dataset.originalHtml = logEntry.innerHTML; // Store HTML structure

          fragment.appendChild(logEntry);
        });
        logLinesArea.appendChild(fragment);
      } catch (renderError) { console.error("RenderViz: Error during rendering:", renderError); logLinesArea.innerHTML = '<p style="color: red; padding: 5px;">Error rendering data.</p>'; }
    }

    // --- Check Overflow & Update Minimap/Thumb ---
    requestAnimationFrame(() => {
      if (!this.logLinesArea || !this.minimapContainer) return;
      const logAreaScrollHeight = this.logLinesArea.scrollHeight; const logAreaClientHeight = this.logLinesArea.clientHeight;
      if (logAreaScrollHeight > logAreaClientHeight) {
        this.minimapContainer.style.display = 'block';
        this.updateThumb();
        // Apply highlight AFTER thumb update and potential display change
        this.applyHighlight();
      } else {
        this.minimapContainer.style.display = 'none';
        // Still apply highlight even if minimap is hidden
        this.applyHighlight();
      }
    });
  }, // --- End of renderViz function ---


  // --- Looker API Methods ---
  create: function (element, config) { // (Unchanged from v4)
    console.log("Log Viewer Viz: Create called");
    this.visElement = element;

    // --- Inline CSS Block (Includes wrap/scrollbar fixes from v4) ---
    const styles = `
          /* Base container */
          .log-viewer-container { background-color: black; color: #ccc; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; height: 100%; position: relative; display: flex; flex-direction: column; overflow: hidden; }
          /* Controls area */
          #controls-area { position: absolute; top: 0; right: 0; z-index: 10; background-color: #1c1c1c; padding: 5px; display: flex; flex-wrap: wrap; align-items: center; border-bottom: 1px solid #444; border-left: 1px solid #444; border-radius: 0 0 0 5px; }
          /* Row Number Toggle */
          #row-number-toggle { display: flex; align-items: center; margin-left: 5px; margin-right: 10px; order: -1; }
          #row-number-toggle label { color: #aaa; font-size: 0.9em; margin-left: 4px; white-space: nowrap; cursor: pointer; }
          #row-number-toggle input[type="checkbox"] { cursor: pointer; }
          /* Other Control Groups */
          .control-group { display: flex; align-items: center; margin-left: 10px; }
          .control-group label { color: #aaa; font-size: 0.9em; margin-right: 5px; white-space: nowrap; }
          .control-group input[type="text"], .control-group select { padding: 3px 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 0.9em; margin-left: 2px; }
          /* Main Content Area */
          .main-content-area { display: flex; flex-grow: 1; overflow: hidden; padding-top: 45px; box-sizing: border-box; }

          /* Log Lines Area */
          #log-lines-area {
            flex-grow: 1;
            overflow-x: auto;
            overflow-y: scroll;
            box-sizing: border-box;
            padding-right: 5px;
          }
          #log-lines-area::-webkit-scrollbar {
             width: 0px;
             height: 8px;
          }
          #log-lines-area::-webkit-scrollbar-thumb:horizontal { background: #555; border-radius: 4px; }
          #log-lines-area::-webkit-scrollbar-track:horizontal { background: #222; }

          /* Minimap */
          #minimap-container { position: relative; width: 15px; background-color: #222; border-left: 1px solid #444; display: none; box-sizing: border-box; flex-shrink: 0; cursor: pointer; user-select: none; -webkit-user-select: none; -ms-user-select: none; }
          #minimap-thumb { position: absolute; left: 1px; right: 1px; background-color: rgba(100, 100, 100, 0.5); border-radius: 2px; opacity: 0; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; cursor: ns-resize; }
          #minimap-container:hover #minimap-thumb, #minimap-thumb.dragging { opacity: 1; background-color: rgba(150, 150, 150, 0.7); }

          /* Log Line */
          .log-line {
             display: flex;
             align-items: baseline;
             margin: 0; padding: 2px 5px; border-bottom: 1px dotted #444;
             color: #ccc;
             box-sizing: border-box;
          }
          /* Row number style */
          .log-row-num { flex-shrink: 0; margin-right: 8px; color: #888; user-select: none; -webkit-user-select: none; }
          /* Individual field style */
          .log-field {
             white-space: pre-wrap;
             word-break: break-all;
             min-width: 0;
          }
           .log-field.field-0 {
               flex-shrink: 0;
           }
          /* Separator style */
          .log-field-separator { margin: 0 5px; color: #666; flex-shrink: 0; }
          /* Highlight style */
          .highlight-match { background-color: yellow; color: black; }
          /* Minimap marker style */
          .minimap-marker { position: absolute; left: 1px; right: 1px; height: 2px; background-color: yellow; opacity: 0.7; pointer-events: none; border-radius: 1px; }
        `;
    // --- End of Inline CSS Block ---

    // Create HTML structure
    element.innerHTML = `
          <style>${styles}</style>
          <div class="log-viewer-container"> <div id="controls-area"> <div id="row-number-toggle"><input type="checkbox" id="show-row-numbers-chk" /><label for="show-row-numbers-chk">Show Row #</label></div> <div class="control-group"> <label for="log-field-select">Field:</label> <select id="log-field-select"><option value="all">All Fields</option></select> </div> <div class="control-group"> <label for="log-filter-input">Filter:</label> <input type="text" id="log-filter-input" placeholder="Filter rows..." /> </div> <div class="control-group"> <label for="log-highlight-input">Search:</label> <input type="text" id="log-highlight-input" placeholder="Highlight text..." /> </div> </div> <div class="main-content-area"> <div id="log-lines-area"> <p style="padding: 5px;">Log Viewer Initializing...</p> </div> <div id="minimap-container"> <div id="minimap-thumb"></div> </div> </div> </div>
        `;

    // Find elements and store references
    const elementsFound = this._findElements(element);
    if (!elementsFound) { console.error("Create: Critical elements not found!"); return; }

    // Add event listeners
    if (this.filterInput) { this.filterInput.addEventListener('input', this.renderViz.bind(this)); }
    // Debounce highlight input slightly to prevent excessive re-renders on fast typing
    let highlightTimeout;
    if (this.highlightInput) {
      this.highlightInput.addEventListener('input', () => {
        clearTimeout(highlightTimeout);
        highlightTimeout = setTimeout(() => this.applyHighlight(), 100); // 100ms delay
      });
    }
    if (this.logLinesArea) { this.logLinesArea.addEventListener('scroll', this.syncThumbPosition.bind(this), { passive: true }); }
    if (this.minimapContainer) { this.minimapContainer.addEventListener('mousedown', this.handleMinimapMouseDown.bind(this)); }
    if (this.fieldSelectElement) { this.fieldSelectElement.addEventListener('change', (event) => { this.selectedFieldName = event.target.value; this.renderViz(); }); }
    if (this.rowNumberCheckbox) { this.rowNumberCheckbox.addEventListener('change', (event) => { this.showRowNumbers = event.target.checked; this.renderViz(); }); }

  },

  updateAsync: function (data, element, config, queryResponse, details, done) { // (Unchanged from v4)
    this.originalData = data; this.queryResponse = queryResponse;
    this.visElement = element;

    // Update element references
    const elementsFound = this._findElements(element);
    if (!elementsFound) { console.error("UpdateAsync: Aborting render - critical elements not found!"); done(); return; }

    // Populate dropdown
    if (this.fieldSelectElement && queryResponse.fields) {
      const currentSelectedValue = this.selectedFieldName; this.fieldSelectElement.innerHTML = '';
      const allOption = document.createElement('option'); allOption.value = 'all'; allOption.textContent = 'All Fields'; this.fieldSelectElement.appendChild(allOption);
      const allFields = [...(queryResponse.fields.dimensions || []), ...(queryResponse.fields.measures || [])];
      allFields.forEach(field => { const option = document.createElement('option'); option.value = field.name; option.textContent = field.label_short || field.label || field.name; this.fieldSelectElement.appendChild(option); });
      // Restore previous selection if possible
      const selectedOptionExists = Array.from(this.fieldSelectElement.options).some(opt => opt.value === currentSelectedValue);
      this.fieldSelectElement.value = selectedOptionExists ? currentSelectedValue : 'all';
      this.selectedFieldName = this.fieldSelectElement.value; // Update state
    }

    // Set checkbox state
    if (this.rowNumberCheckbox) { this.rowNumberCheckbox.checked = this.showRowNumbers; }

    // Trigger rendering
    this.renderViz();
    done();
  }
});