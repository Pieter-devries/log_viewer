// src/index.ts
import { visDefinition } from './visualization';
import { Looker } from './core/types';

// <<< ADD Import for base Grid.js theme FIRST >>>
import 'gridjs/dist/theme/mermaid.css'; // Or genesis.css if you prefer that base

// Import custom styles AFTER the base theme
import './styles/main.css';
import './styles/gridjs-theme.css'; // Your overrides and specific styles
import './styles/links.css';
import './styles/sparkline.css';
import './styles/highlight.css';

// Declare the looker global
declare var looker: Looker;

// Add a check for the looker object for safety
if (looker && looker.plugins && looker.plugins.visualizations) {
    // Register the visualization with Looker
    looker.plugins.visualizations.add(visDefinition);
    console.log("Log Viewer (Grid.js) visualization registered.");
} else {
    console.error("Looker environment not found. Visualization not registered.");
}

// Optional: Add CSS for the grabbing cursor dynamically if not in main.css
const grabbingStyle = document.createElement('style');
grabbingStyle.textContent = ` #gridjs-minimap.grabbing { cursor: grabbing !important; } `;
if (document.head) { document.head.appendChild(grabbingStyle); }
else { document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(grabbingStyle); }); }
