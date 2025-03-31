import {
    Looker, LookerChartUtils, VisualizationDefinition, VisConfig, QueryResponse, Row
} from './types';
import { state, elements, updateCoreState } from './state';
import { setupHTML, findElements, attachListeners } from './dom';
import { renderViz } from './rendering';
// Import other functions only if they need to be directly on visDefinition (unlikely now)
// import { applyHighlight } from './highlighting';
// import { syncThumbPosition, handleMinimapMouseDown } from './minimap';

declare var looker: Looker;
declare var LookerCharts: LookerChartUtils; // Make sure LookerCharts is available

const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-dev',
    label: 'Log Viewer (Dev)',
    options: { /* ... */ },

    // No need to spread state here if functions import it directly

    // --- Looker API Methods ---
    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Dev): Create called (main.ts)");
        try {
            setupHTML(element);
            if (!findElements(element)) {
                console.error("Create: Failed to find critical elements.");
                element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis init failed (missing elements).</div>`;
                return;
            }
            // Attach listeners - they now directly call imported functions or update state
            attachListeners();

            // Update initial state from config if necessary
            // state.showRowNumbers = config.show_row_numbers_default ?? false; // Example

        } catch (error) {
            console.error("Error during visualization creation:", error);
            if (element) { element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis init failed. ${error.message}</div>`; }
        }
    },

    updateAsync: function (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) {
        console.log("Log Viewer Vis (Dev): updateAsync called (main.ts)");
        try {
            // Update core state (imported function)
            updateCoreState(data, queryResponse, config);

            // Ensure elements are found (might be redundant if create guarantees it)
            if (!findElements(element)) {
                console.error("updateAsync: Failed to find critical elements during update.");
                element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis update failed (missing elements).</div>`;
                done();
                return;
            }

            // Update UI elements based on state
            if (elements.rowNumberCheckbox) elements.rowNumberCheckbox.checked = state.showRowNumbers;
            if (elements.filterCaseChk) elements.filterCaseChk.checked = state.filterCaseSensitive;
            if (elements.highlightCaseChk) elements.highlightCaseChk.checked = state.highlightCaseSensitive;

            // Update field dropdown (using imported elements/state)
            if (queryResponse.fields) {
                if (elements.fieldSelectElement) {
                    const fieldSelectElement = elements.fieldSelectElement; // Create a local variable
                    const currentSelectedValue = state.selectedFieldName;
                    fieldSelectElement.innerHTML = ''; // TypeScript knows this is safe
                    const allOption = document.createElement('option');
                    allOption.value = 'all';
                    allOption.textContent = 'All Fields';
                    fieldSelectElement.appendChild(allOption);
                    const allFields = [...(queryResponse.fields.dimensions || []), ...(queryResponse.fields.measures || [])];
                    allFields.forEach(field => {
                        const option = document.createElement('option');
                        option.value = field.name;
                        option.textContent = field.label_short || field.label || field.name;
                        fieldSelectElement.appendChild(option);
                    });
                    const selectedOptionExists = Array.from(fieldSelectElement.options).some(opt => opt.value === currentSelectedValue);
                    fieldSelectElement.value = selectedOptionExists ? currentSelectedValue : 'all';
                    state.selectedFieldName = fieldSelectElement.value; // Update imported state
                }
            } else {
                console.warn("updateAsync: queryResponse.fields is undefined during update.");
            }

            // Call the main rendering function (imported)
            renderViz();

        } catch (error) {
            console.error("Error during visualization update:", error);
            if (element) { element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis update failed. ${error.message}</div>`; }
        } finally {
            done();
        }
    }
};

looker.plugins.visualizations.add(visDefinition);
