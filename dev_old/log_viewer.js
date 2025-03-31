looker.plugins.visualizations.add({
  // Visualization Definition Object
  id: 'log-viewer-dev', // Development ID
  label: 'Log Viewer (Dev)', // Development Label

  // --- State Storage --- (Added new elements and state)
  originalData: [], queryResponse: null, visElement: null, filterInput: null, highlightInput: null,
  fieldSelectElement: null, logLinesArea: null, logHeaderArea: null,
  minimapContainer: null, minimapThumb: null,
  isDragging: false, _boundMouseMove: null, _boundMouseUp: null, selectedFieldName: 'all',
  showRowNumbers: false, rowNumberCheckbox: null,
  // New elements
  clearFilterButton: null, clearHighlightButton: null,
  filterCaseChk: null, highlightCaseChk: null,
  // New state
  filterCaseSensitive: false, highlightCaseSensitive: false,


  // --- Helper Function ---
  escapeRegExp: function (string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },

  // --- Recursive Highlighting Function (Includes parentNode check) ---
  highlightNode: function (node, regex, highlightClass) {
    if (node.nodeType === 3) { // Text node
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
        if (node.parentNode) {
          try { node.parentNode.replaceChild(fragment, node); }
          catch (e) { console.error("highlightNode: Error during replaceChild:", e); return false; }
        } else { console.warn("highlightNode: node.parentNode was null."); return false; }
        return true;
      }
    } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName) && node.className !== highlightClass) { // Element node
      const children = Array.from(node.childNodes);
      let highlightedInChildren = false;
      for (let i = 0; i < children.length; i++) { if (this.highlightNode(children[i], regex, highlightClass)) { highlightedInChildren = true; } }
      return highlightedInChildren;
    }
    return false;
  },

  // --- Highlighting & Minimap Marker Function (MODIFIED for case sensitivity) ---
  applyHighlight: function () {
    // console.log("ApplyHighlight called (v17)");
    if (!this.highlightInput || !this.logLinesArea || !this.minimapContainer) return;
    const highlightTerm = this.highlightInput.value; // Raw value
    const logLines = this.logLinesArea.querySelectorAll('.log-line');
    const minimap = this.minimapContainer;
    const logArea = this.logLinesArea;
    const highlightClass = 'highlight-match';
    const existingMarkers = minimap.querySelectorAll('.minimap-marker');
    existingMarkers.forEach(marker => marker.remove());
    const minimapIsVisible = minimap.style.display !== 'none';

    // Regex flags based on state
    const regexFlags = this.highlightCaseSensitive ? 'g' : 'gi';
    const highlightRegex = highlightTerm ? new RegExp(this.escapeRegExp(highlightTerm), regexFlags) : null;

    const markerFragment = document.createDocumentFragment();
    const minimapHeight = minimap.clientHeight;
    const contentScrollHeight = Math.max(1, logArea.scrollHeight);
    const markerHeight = 2;

    logLines.forEach((line, index) => {
      const originalHtml = line.dataset.originalHtml;
      if (originalHtml === undefined) {
        // Fallback if originalHtml isn't set
        if (highlightRegex) { line.innerHTML = (line.dataset.originalText || line.textContent).replace(highlightRegex, `<span class="${highlightClass}">$&</span>`); }
        else { line.textContent = line.dataset.originalText || line.textContent; }
        return;
      }
      line.innerHTML = originalHtml; // Restore original
      let lineContainsHighlight = false;
      if (highlightRegex) {
        try { lineContainsHighlight = this.highlightNode(line, highlightRegex, highlightClass); }
        catch (e) { console.error(`ApplyHighlight Error: line ${index}:`, e); try { line.innerHTML = originalHtml; } catch (restoreError) { console.error("ApplyHighlight: Failed to restore HTML after highlight error", restoreError); } }
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
    });
    minimap.appendChild(markerFragment);
  },

  // --- Scroll Thumb Update Function ---
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
  // --- Event Handler for Log Area Scroll ---
  syncThumbPosition: function () { if (this.isDragging) return; this.updateThumb(); },
  // --- Event Handlers for Minimap Dragging ---
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
    this.updateThumb();
  },
  handleMinimapMouseUp: function (event) {
    if (!this.isDragging) return; event.preventDefault();
    this.isDragging = false;
    if (this.minimapThumb) this.minimapThumb.classList.remove('dragging');
    if (this._boundMouseMove) { window.removeEventListener('mousemove', this._boundMouseMove); delete this._boundMouseMove; }
    if (this._boundMouseUp) { window.removeEventListener('mouseup', this._boundMouseUp); delete this._boundMouseUp; }
  },

  // --- Find & Store Elements (MODIFIED) ---
  _findElements: function (element) {
    // console.log("_findElements called (v17)"); // Keep commented unless needed
    this.visElement = element;
    this.filterInput = element.querySelector("#log-filter-input");
    this.highlightInput = element.querySelector("#log-highlight-input");
    this.fieldSelectElement = element.querySelector("#log-field-select");
    this.logHeaderArea = element.querySelector("#log-header-area");
    this.logLinesArea = element.querySelector("#log-lines-area");
    this.minimapContainer = element.querySelector("#minimap-container");
    this.minimapThumb = element.querySelector("#minimap-thumb");
    this.rowNumberCheckbox = element.querySelector("#show-row-numbers-chk");
    this.clearFilterButton = element.querySelector("#clear-filter-btn");
    this.clearHighlightButton = element.querySelector("#clear-highlight-btn");
    this.filterCaseChk = element.querySelector("#filter-case-chk");
    this.highlightCaseChk = element.querySelector("#highlight-case-chk");

    const criticalElementsFound = !!this.logLinesArea && !!this.logHeaderArea && !!this.rowNumberCheckbox && !!this.filterInput && !!this.highlightInput && !!this.fieldSelectElement && !!this.minimapContainer && !!this.minimapThumb && !!this.clearFilterButton && !!this.clearHighlightButton && !!this.filterCaseChk && !!this.highlightCaseChk;
    // console.log("_findElements: Critical elements found:", criticalElementsFound);
    if (!criticalElementsFound) { console.error("_findElements: One or more critical elements NOT found!"); }
    return criticalElementsFound;
  },

  // --- Rendering Function (MODIFIED for case sensitivity) ---
  renderViz: function () {
    // console.log("RenderViz called (v17)");
    if (!this.visElement || !this.originalData || !this.queryResponse || !this.filterInput || !this.logLinesArea || !this.logHeaderArea || !this.minimapContainer || !this.fieldSelectElement || !this.rowNumberCheckbox || !this.highlightInput || !this.minimapThumb) {
      console.warn("RenderViz aborted: Missing critical elements or data"); return;
    }
    const data = this.originalData; const queryResponse = this.queryResponse; const filterInput = this.filterInput;
    const logLinesArea = this.logLinesArea; const logHeaderArea = this.logHeaderArea;
    const minimap = this.minimapContainer;
    const selectedFieldName = this.selectedFieldName; const showRowNumbers = this.showRowNumbers;

    const fieldsToRender = [
      ...(queryResponse.fields.dimensions || []),
      ...(queryResponse.fields.measures || [])
    ];

    if (fieldsToRender.length === 0) {
      logLinesArea.innerHTML = '<p style="padding: 5px; color: orange;">Query returned no fields to display.</p>';
      logHeaderArea.innerHTML = '';
      return;
    }

    // --- Filtering (MODIFIED for case sensitivity) ---
    let filterValue = filterInput.value; // Raw value
    if (!this.filterCaseSensitive) { filterValue = filterValue.toLowerCase(); }
    let dataToRender;
    const allFieldsForFilter = fieldsToRender;
    if (filterValue) {
      try {
        dataToRender = data.filter(row => {
          const checkMatch = (field) => {
            const cell = row[field.name];
            let cellValueStr = cell?.value?.toString();
            if (cellValueStr == null) return false;
            if (!this.filterCaseSensitive) { cellValueStr = cellValueStr.toLowerCase(); }
            return cellValueStr.includes(filterValue);
          };
          if (selectedFieldName === 'all') { return allFieldsForFilter.some(checkMatch); }
          else { const selectedField = allFieldsForFilter.find(f => f.name === selectedFieldName); return selectedField ? checkMatch(selectedField) : false; }
        });
      }
      catch (filterError) { console.error("Filter error:", filterError); dataToRender = data; }
    } else {
      dataToRender = data;
    }
    // --- END Filtering Modification ---

    // console.log(`RenderViz: Rendering ${dataToRender ? dataToRender.length : 0} rows.`);

    // --- Populate Header ---
    logHeaderArea.innerHTML = '';
    try {
      const headerFragment = document.createDocumentFragment();
      if (showRowNumbers) {
        const rowNumHeader = document.createElement('div');
        rowNumHeader.className = 'log-header-cell log-row-num-header';
        rowNumHeader.textContent = '#';
        headerFragment.appendChild(rowNumHeader);
      }
      fieldsToRender.forEach((field, fieldIndex) => {
        if (fieldIndex > 0) {
          const sepHeader = document.createElement('div');
          sepHeader.className = 'log-header-separator';
          sepHeader.textContent = '|';
          headerFragment.appendChild(sepHeader);
        }
        const headerCell = document.createElement('div');
        const fieldType = field.is_measure ? 'measure' : 'dimension';
        headerCell.className = 'log-header-cell';
        headerCell.classList.add(`field-${fieldIndex}`, `field-type-${fieldType}`);
        headerCell.textContent = field.label_short || field.label || field.name;
        headerFragment.appendChild(headerCell);
      });
      logHeaderArea.appendChild(headerFragment);
      // console.log("RenderViz: Headers populated.");
    } catch (headerError) {
      console.error("RenderViz: Error populating headers:", headerError);
      logHeaderArea.innerHTML = '<div style="color: red; padding: 2px 5px;">Error loading headers</div>';
    }


    // --- Rendering Log Lines ---
    logLinesArea.innerHTML = '';
    if (!dataToRender || dataToRender.length === 0) {
      const noDataMsg = document.createElement('p');
      noDataMsg.style.color = 'orange'; noDataMsg.style.padding = '5px';
      noDataMsg.textContent = filterValue ? 'No logs match filter.' : 'Query returned no data.';
      logLinesArea.appendChild(noDataMsg);
    }
    else {
      try {
        const fragment = document.createDocumentFragment();
        dataToRender.forEach((row, index) => {
          const logEntry = document.createElement('div');
          logEntry.className = 'log-line';
          let fullLineTextParts = [];
          if (showRowNumbers) {
            const rowNumSpan = document.createElement('span');
            rowNumSpan.className = 'log-row-num';
            const rowNumText = `${index + 1}: `;
            rowNumSpan.textContent = rowNumText;
            logEntry.appendChild(rowNumSpan);
            fullLineTextParts.push(rowNumText);
          }
          fieldsToRender.forEach((field, fieldIndex) => {
            if (fieldIndex > 0) {
              const sepSpan = document.createElement('span');
              sepSpan.className = 'log-field-separator';
              sepSpan.textContent = ' | ';
              logEntry.appendChild(sepSpan);
              fullLineTextParts.push(' | ');
            }
            const fieldSpan = document.createElement('span');
            const fieldType = field.is_measure ? 'measure' : 'dimension';
            fieldSpan.classList.add(`log-field`, `field-${fieldIndex}`, `field-type-${fieldType}`);
            const cell = row[field.name];
            const formattedValue = cell?.value != null ? LookerCharts.Utils.htmlForCell(cell) : '[NULL]';
            fieldSpan.innerHTML = formattedValue;
            fullLineTextParts.push(cell?.value != null ? cell.value.toString() : '[NULL]');
            if (cell && cell.links) {
              fieldSpan.classList.add('drillable');
              fieldSpan.onclick = (event) => {
                LookerCharts.Utils.openDrillMenu({ links: cell.links, event: event });
              };
            }
            logEntry.appendChild(fieldSpan);
          });
          logEntry.dataset.originalText = fullLineTextParts.join('');
          logEntry.dataset.originalHtml = logEntry.innerHTML;
          fragment.appendChild(logEntry);
        });
        logLinesArea.appendChild(fragment);
        // console.log("RenderViz finished processing rows.");
      } catch (renderError) {
        console.error("RenderViz: Error during rendering loop:", renderError);
        logLinesArea.innerHTML = '<p style="color: red; padding: 5px;">Error rendering data.</p>';
      }
    }

    // --- Check Overflow & Update Minimap/Thumb ---
    requestAnimationFrame(() => {
      if (!this.logLinesArea || !this.minimapContainer) return;
      const logAreaScrollHeight = this.logLinesArea.scrollHeight;
      const logAreaClientHeight = this.logLinesArea.clientHeight;
      if (logAreaScrollHeight > logAreaClientHeight) {
        this.minimapContainer.style.display = 'block';
        this.updateThumb();
        this.applyHighlight();
      } else {
        this.minimapContainer.style.display = 'none';
        this.applyHighlight();
      }
    });
  }, // --- End of renderViz function ---


  // --- Looker API Methods ---
  // *** FULL create function ***
  create: function (element, config) {
    console.log("Log Viewer Viz (Dev): Create called (v17)"); // Updated version marker
    this.visElement = element;

    // --- Inline CSS Block (Includes UI enhancement styles) ---
    const styles = `
          /* Base container */
          .log-viewer-container { background-color: black; color: #ccc; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; height: 100%; position: relative; display: flex; flex-direction: column; overflow: hidden; }

          /* Controls area */
          #controls-area {
            position: relative; z-index: 10; background-color: #1c1c1c; padding: 5px 8px;
            display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
            border-bottom: 1px solid #444; margin-bottom: 0;
          }
          /* Control Groups */
          .control-group { display: flex; align-items: center; gap: 4px; }
          .control-group label { color: #aaa; font-size: 0.9em; white-space: nowrap; }
          .control-group input[type="text"], .control-group select {
             padding: 3px 5px; border: 1px solid #555; background-color: #333; color: #eee; font-size: 0.9em;
          }
          #row-number-toggle { order: -1; margin-right: 10px;}
          #row-number-toggle label { cursor: pointer; }
          #row-number-toggle input[type="checkbox"] { cursor: pointer; }

          /* Input wrapper for clear button */
          .input-wrapper { position: relative; display: inline-block; }
          .input-wrapper input[type="text"] { padding-right: 18px; }

          /* Clear button */
          .clear-button {
            position: absolute; right: 1px; top: 1px; bottom: 1px;
            border: none; background: transparent; color: #888;
            cursor: pointer; padding: 0 4px; font-size: 1.1em; line-height: 1;
            display: none; /* Hidden by default */
          }
          .input-wrapper input[type="text"]:not(:placeholder-shown) + .clear-button {
             display: inline-block; /* Show only when input has value */
          }
          .clear-button:hover { color: #ccc; }

          /* Case sensitivity checkbox */
          .case-sensitivity-toggle { display: flex; align-items: center; margin-left: -6px; }
          .case-sensitivity-toggle input[type="checkbox"] { cursor: pointer; margin-right: 3px;}
          .case-sensitivity-toggle label { color: #aaa; font-size: 0.85em; cursor: pointer; }

          /* Main Content Area */
          .main-content-area { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; box-sizing: border-box; }

          /* Header Area */
          #log-header-area { display: flex; align-items: baseline; background-color: #1a1a1a; border-bottom: 1px solid #555; padding: 4px 5px; flex-shrink: 0; color: #ddd; font-weight: bold; padding-right: 20px; box-sizing: border-box; }
          .log-header-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; padding: 0; }
          .log-row-num-header { flex-shrink: 0; margin-right: 8px; color: #aaa; user-select: none; -webkit-user-select: none; font-weight: normal; }
          .log-header-cell.field-0 { flex-shrink: 0; }
          .log-header-separator { margin: 0 5px; color: #666; flex-shrink: 0; font-weight: normal; }

          /* Log Scroll Container */
          .log-scroll-container { display: flex; flex-grow: 1; overflow: hidden; }
          #log-lines-area { flex-grow: 1; overflow: auto; box-sizing: border-box; }
          #log-lines-area::-webkit-scrollbar { width: 0px; height: 8px; }
          #log-lines-area::-webkit-scrollbar-thumb:horizontal { background: #555; border-radius: 4px; }
          #log-lines-area::-webkit-scrollbar-track:horizontal { background: #222; }

          /* Minimap */
          #minimap-container { position: relative; width: 15px; background-color: #222; border-left: 1px solid #444; display: none; box-sizing: border-box; flex-shrink: 0; cursor: pointer; user-select: none; -webkit-user-select: none; -ms-user-select: none; }
          #minimap-thumb { position: absolute; left: 1px; right: 1px; background-color: rgba(100, 100, 100, 0.5); border-radius: 2px; opacity: 0; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; cursor: ns-resize; }
          #minimap-container:hover #minimap-thumb, #minimap-thumb.dragging { opacity: 1; background-color: rgba(150, 150, 150, 0.7); }

          /* Log Line styles */
          .log-line { display: flex; align-items: baseline; margin: 0; padding: 2px 5px; border-bottom: 1px dotted #444; color: #ccc; box-sizing: border-box; }
          .log-row-num { flex-shrink: 0; margin-right: 8px; color: #888; user-select: none; -webkit-user-select: none; }
          .log-field { white-space: pre-wrap; word-break: break-all; min-width: 0; }
          .log-field.field-0 { flex-shrink: 0; }
          .field-type-measure { /* Optional styling */ }
          .log-field-separator { margin: 0 5px; color: #666; flex-shrink: 0; }
          .highlight-match { background-color: yellow; color: black; }
          .minimap-marker { position: absolute; left: 1px; right: 1px; height: 2px; background-color: yellow; opacity: 0.7; pointer-events: none; border-radius: 1px; }
          .drillable { cursor: pointer; text-decoration: underline; text-decoration-color: #555; }
          .drillable:hover { text-decoration-color: #999; background-color: rgba(255, 255, 255, 0.05); }
        `;
    // --- End of Inline CSS Block ---

    // Create HTML structure (Includes UI enhancements)
    element.innerHTML = `
          <style>${styles}</style>
          <div class="log-viewer-container">
            <div id="controls-area">
              <div id="row-number-toggle"><input type="checkbox" id="show-row-numbers-chk" /><label for="show-row-numbers-chk">Show Row #</label></div>
              <div class="control-group">
                 <label for="log-field-select">Field:</label>
                 <select id="log-field-select"><option value="all">All Fields</option></select>
              </div>
              <div class="control-group">
                 <label for="log-filter-input">Filter:</label>
                 <span class="input-wrapper">
                    <input type="text" id="log-filter-input" placeholder="Filter rows..." />
                    <button id="clear-filter-btn" class="clear-button" title="Clear filter">&times;</button>
                 </span>
                 <span class="case-sensitivity-toggle">
                    <input type="checkbox" id="filter-case-chk" title="Case sensitive filter"/>
                    <label for="filter-case-chk">Aa</label>
                 </span>
              </div>
              <div class="control-group">
                 <label for="log-highlight-input">Search:</label>
                 <span class="input-wrapper">
                    <input type="text" id="log-highlight-input" placeholder="Highlight text..." />
                    <button id="clear-highlight-btn" class="clear-button" title="Clear search">&times;</button>
                 </span>
                  <span class="case-sensitivity-toggle">
                    <input type="checkbox" id="highlight-case-chk" title="Case sensitive search"/>
                    <label for="highlight-case-chk">Aa</label>
                 </span>
              </div>
            </div>
            <div class="main-content-area">
              <div id="log-header-area"></div>
              <div class="log-scroll-container">
                 <div id="log-lines-area"> <p style="padding: 5px;">Log Viewer Initializing...</p> </div>
                 <div id="minimap-container"> <div id="minimap-thumb"></div> </div>
              </div>
            </div>
          </div>
        `;

    // Find elements and store references
    const elementsFound = this._findElements(element);
    if (!elementsFound) { console.error("Create: Critical elements not found!"); return; }

    // Add event listeners (Includes listeners for new controls)
    if (this.filterInput) { this.filterInput.addEventListener('input', this.renderViz.bind(this)); }
    if (this.clearFilterButton) {
      this.clearFilterButton.addEventListener('click', () => {
        if (this.filterInput.value) { this.filterInput.value = ''; this.renderViz(); }
      });
    }
    if (this.filterCaseChk) {
      this.filterCaseChk.addEventListener('change', (event) => { this.filterCaseSensitive = event.target.checked; this.renderViz(); });
    }
    let highlightTimeout;
    if (this.highlightInput) {
      this.highlightInput.addEventListener('input', () => { clearTimeout(highlightTimeout); highlightTimeout = setTimeout(() => this.applyHighlight(), 100); });
    }
    if (this.clearHighlightButton) {
      this.clearHighlightButton.addEventListener('click', () => {
        if (this.highlightInput.value) { this.highlightInput.value = ''; this.applyHighlight(); }
      });
    }
    if (this.highlightCaseChk) {
      this.highlightCaseChk.addEventListener('change', (event) => { this.highlightCaseSensitive = event.target.checked; this.applyHighlight(); });
    }
    if (this.logLinesArea) { this.logLinesArea.addEventListener('scroll', this.syncThumbPosition.bind(this), { passive: true }); }
    if (this.minimapContainer) { this.minimapContainer.addEventListener('mousedown', this.handleMinimapMouseDown.bind(this)); }
    if (this.fieldSelectElement) { this.fieldSelectElement.addEventListener('change', (event) => { this.selectedFieldName = event.target.value; this.renderViz(); }); }
    if (this.rowNumberCheckbox) { this.rowNumberCheckbox.addEventListener('change', (event) => { this.showRowNumbers = event.target.checked; this.renderViz(); }); }
  },

  // *** FULL updateAsync function (Modified to set checkbox states) ***
  updateAsync: function (data, element, config, queryResponse, details, done) {
    // console.log("updateAsync called (v17)");
    this.originalData = data; this.queryResponse = queryResponse;
    this.visElement = element;
    const elementsFound = this._findElements(element);
    if (!elementsFound) { console.error("UpdateAsync: Aborting render - critical elements not found!"); done(); return; }

    // Populate dropdown
    if (this.fieldSelectElement && queryResponse.fields) {
      const currentSelectedValue = this.selectedFieldName; this.fieldSelectElement.innerHTML = '';
      const allOption = document.createElement('option'); allOption.value = 'all'; allOption.textContent = 'All Fields'; this.fieldSelectElement.appendChild(allOption);
      const allFields = [...(queryResponse.fields.dimensions || []), ...(queryResponse.fields.measures || [])];
      allFields.forEach(field => { const option = document.createElement('option'); option.value = field.name; option.textContent = field.label_short || field.label || field.name; this.fieldSelectElement.appendChild(option); });
      const selectedOptionExists = Array.from(this.fieldSelectElement.options).some(opt => opt.value === currentSelectedValue);
      this.fieldSelectElement.value = selectedOptionExists ? currentSelectedValue : 'all';
      this.selectedFieldName = this.fieldSelectElement.value;
    } else {
      console.warn("updateAsync: fieldSelectElement or queryResponse.fields missing, cannot populate dropdown.");
    }

    // Set checkbox states based on stored state
    if (this.rowNumberCheckbox) { this.rowNumberCheckbox.checked = this.showRowNumbers; }
    if (this.filterCaseChk) { this.filterCaseChk.checked = this.filterCaseSensitive; }
    if (this.highlightCaseChk) { this.highlightCaseChk.checked = this.highlightCaseSensitive; }

    this.renderViz();
    done();
  }
});