import {
    Looker, LookerChartUtils, VisualizationDefinition, VisConfig, QueryResponse, Row, Field
} from './types';
import { state, elements, updateCoreState } from './state';
import { setupHTML, findElements, attachListeners } from './dom';
import { renderViz } from './rendering';

declare var looker: Looker;
declare var LookerCharts: LookerChartUtils;

const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-dev',
    label: 'Log Viewer (Dev)',
    options: { /* ... */ },

    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis (Dev): Create called (main.ts)");
        try {
            setupHTML(element);
            if (!findElements(element)) {
                console.error("Create: Failed to find critical elements.");
                element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis init failed (missing elements).</div>`;
                return;
            }
            attachListeners();
        } catch (error) {
            console.error("Error during visualization creation:", error);
            element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis init failed. ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
        }
    },

    updateAsync: function (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) {
        console.log("Log Viewer Vis (Dev): updateAsync called (main.ts)");
        try {
            updateCoreState(data, queryResponse, config);

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

            // Update field dropdown
            if (queryResponse.fields) {
                updateFieldDropdown(queryResponse.fields.dimensions, queryResponse.fields.measures);
            } else {
                console.warn("updateAsync: queryResponse.fields is undefined during update.");
            }

            renderViz();

        } catch (error) {
            console.error("Error during visualization update:", error);
            element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis update failed. ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
        } finally {
            done();
        }
    }
};

/**
 * Updates the field dropdown with new fields from the query response.
 * @param dimensions - Array of dimension fields.
 * @param measures - Array of measure fields.
 */
function updateFieldDropdown(dimensions: Field[], measures: Field[]): void {
    if (!elements.fieldSelectElement) {
        console.error("updateFieldDropdown: fieldSelectElement is null.");
        return;
    }

    const fieldSelectElement = elements.fieldSelectElement;
    const currentSelectedValue = state.selectedFieldName;
    fieldSelectElement.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Fields';
    fieldSelectElement.appendChild(allOption);

    const allFields = [...dimensions, ...measures];
    allFields.forEach(field => {
        const option = document.createElement('option');
        option.value = field.name;
        option.textContent = field.label_short || field.label || field.name;
        fieldSelectElement.appendChild(option);
    });

    const selectedOptionExists = Array.from(fieldSelectElement.options).some(opt => opt.value === currentSelectedValue);
    fieldSelectElement.value = selectedOptionExists ? currentSelectedValue : 'all';
    state.selectedFieldName = fieldSelectElement.value;
}

looker.plugins.visualizations.add(visDefinition);
