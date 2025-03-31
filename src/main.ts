import {
    Looker, LookerChartUtils, VisualizationDefinition, VisConfig, QueryResponse, Row, Field
} from './types';
import { state, elements, updateCoreState } from './state';
import { setupHTML, findElements, attachListeners } from './dom';
import { renderViz } from './rendering'; // renderViz will now read state set by updateCoreState

declare var looker: Looker;
declare var LookerCharts: LookerChartUtils;

const visDefinition: VisualizationDefinition = {
    id: 'log-viewer-dev', // Consider removing '-dev' for production
    label: 'Log Viewer', // Updated label
    options: {
        // --- Configuration Options ---
        showRowNumbers: {
            type: 'boolean',
            label: 'Show Row Numbers',
            default: false,
            section: 'Display',
            order: 1
        },
        filterCaseSensitive: {
            type: 'boolean',
            label: 'Case-Sensitive Filter',
            default: false,
            section: 'Filtering & Search',
            order: 1 // Changed order
        },
        highlightCaseSensitive: {
            type: 'boolean',
            label: 'Case-Sensitive Search',
            default: false,
            section: 'Filtering & Search',
            order: 3 // Changed order
        },
        // Add other options here if needed (e.g., default filter field, theme, font size)
    },

    create: function (element: HTMLElement, config: VisConfig) {
        console.log("Log Viewer Vis: Create called");
        try {
            setupHTML(element);
            if (!findElements(element)) {
                console.error("Create: Failed to find critical elements.");
                element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis init failed (missing elements).</div>`;
                return;
            }
            // Initial state setup based on config might be needed if updateAsync isn't guaranteed on load
            // For now, relying on updateAsync to set initial state from config
            attachListeners();
            console.log("Log Viewer Vis: Create finished successfully.");
        } catch (error) {
            console.error("Error during visualization creation:", error);
            element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis init failed. ${error instanceof Error ? error.message : String(error)}</div>`;
        }
    },

    updateAsync: function (data: Row[], element: HTMLElement, config: VisConfig, queryResponse: QueryResponse, details: any, done: () => void) {
        console.log("Log Viewer Vis: updateAsync called");
        try {
            // --- 1. Update Core State ---
            // Pass the latest config from Looker to update the internal state
            updateCoreState(data, queryResponse, config);
            console.log("Log Viewer Vis: Core state updated with config:", config);

            // --- 2. Ensure Elements Are Present ---
            // It's possible the element was re-rendered, re-find elements
            if (!findElements(element)) {
                console.error("updateAsync: Failed to find critical elements during update.");
                // Avoid replacing entire element content if possible, maybe show error within structure
                if (elements.logLinesArea) {
                    elements.logLinesArea.innerHTML = `<p style="color:red; padding:10px;">Error: Vis update failed (missing elements).</p>`;
                } else {
                    element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis update failed (missing elements).</div>`;
                }
                done();
                return;
            }

            // --- 3. Update UI Controls (Reflecting State) ---
            // Checkboxes are now updated within renderViz or based on state changes triggering renderViz
            // We still need to update the field dropdown based on the new queryResponse
            if (queryResponse?.fields) {
                updateFieldDropdown(
                    queryResponse.fields.dimensions || [],
                    queryResponse.fields.measures || []
                );
            } else {
                console.warn("updateAsync: queryResponse.fields is missing or empty.");
                // Clear dropdown if fields are gone?
                updateFieldDropdown([], []);
            }

            // --- 4. Render Visualization ---
            // renderViz will read the updated state (including config options)
            renderViz();
            console.log("Log Viewer Vis: renderViz called after state update.");

        } catch (error) {
            console.error("Error during visualization update:", error);
            if (elements.logLinesArea) {
                elements.logLinesArea.innerHTML = `<p style="color:red; padding:10px;">Error: Vis update failed. ${error instanceof Error ? error.message : String(error)}</p>`;
            } else {
                element.innerHTML = `<div style="color:red; padding:10px;">Error: Vis update failed. ${error instanceof Error ? error.message : String(error)}</div>`;
            }
        } finally {
            // --- 5. Signal Completion ---
            console.log("Log Viewer Vis: updateAsync finished.");
            done();
        }
    }
};

/**
 * Updates the field dropdown selector based on the query response fields.
 * Ensures the currently selected field (from state) remains selected if possible.
 * @param dimensions - Array of dimension fields.
 * @param measures - Array of measure fields.
 */
function updateFieldDropdown(dimensions: Field[], measures: Field[]): void {
    if (!elements.fieldSelectElement) {
        console.error("updateFieldDropdown: fieldSelectElement is null.");
        return;
    }

    const fieldSelectElement = elements.fieldSelectElement;
    const currentSelectedValue = state.selectedFieldName; // Get current value from state
    fieldSelectElement.innerHTML = ''; // Clear existing options

    // Add "All Fields" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Fields';
    fieldSelectElement.appendChild(allOption);

    // Combine dimensions and measures
    const allFields = [...(dimensions || []), ...(measures || [])];

    // Add options for each field
    allFields.forEach(field => {
        if (!field || !field.name) return; // Skip invalid field definitions
        const option = document.createElement('option');
        option.value = field.name;
        // Use short label, fallback to label, fallback to name
        option.textContent = field.label_short || field.label || field.name;
        fieldSelectElement.appendChild(option);
    });

    // Try to restore previous selection, otherwise default to 'all'
    const selectedOptionExists = allFields.some(field => field.name === currentSelectedValue);
    const finalSelectedValue = selectedOptionExists ? currentSelectedValue : 'all';

    fieldSelectElement.value = finalSelectedValue;

    // Ensure state reflects the actual dropdown value (in case it changed to 'all')
    if (state.selectedFieldName !== finalSelectedValue) {
        console.log(`updateFieldDropdown: Selected field changed from "${currentSelectedValue}" to "${finalSelectedValue}"`);
        state.selectedFieldName = finalSelectedValue;
        // Note: Changing state.selectedFieldName here might ideally trigger a re-render,
        // but since updateFieldDropdown is called within updateAsync just before renderViz,
        // the upcoming renderViz call will use the correct state.
    }
}

// Register the visualization with Looker
looker.plugins.visualizations.add(visDefinition);
