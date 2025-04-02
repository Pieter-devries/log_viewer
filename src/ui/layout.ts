// src/ui/layout.ts
import { elements } from '../core/state'; // Use relative path

console.log("--- MODULE LOADED: src/ui/layout.ts ---");

/**
 * Calculates and sets the height of the grid wrapper dynamically
 * to enable scrolling within the available space.
 */
export function setGridWrapperHeight(): void {
    // Use requestAnimationFrame to ensure layout calculations are fresh
    window.requestAnimationFrame(() => {
        if (!elements.gridJsContainer) {
            console.warn("setGridWrapperHeight: Cannot find #gridjs-container");
            return;
        }
        const container = elements.gridJsContainer;
        const gridWrapper = container.querySelector<HTMLElement>('.gridjs-wrapper');
        const header = container.querySelector<HTMLElement>('.gridjs-head');
        const footer = container.querySelector<HTMLElement>('.gridjs-footer');

        if (!gridWrapper) {
            console.warn("setGridWrapperHeight: Cannot find .gridjs-wrapper");
            return;
        }

        const containerHeight = container.clientHeight;
        // Ensure header/footer exist before getting offsetHeight
        const headerHeight = header?.offsetHeight ?? 0;
        const footerHeight = footer?.offsetHeight ?? 0;

        // Calculate available height for the wrapper
        const availableHeight = Math.max(0, containerHeight - headerHeight - footerHeight);

        // Set a minimum height (e.g., 50px) to avoid complete collapse
        const targetHeight = Math.max(50, availableHeight);

        console.log(`setGridWrapperHeight: ContainerH=${containerHeight}, HeaderH=${headerHeight}, FooterH=${footerHeight}, TargetH=${targetHeight}`);

        // Set the wrapper's height explicitly
        gridWrapper.style.height = `${targetHeight}px`;

        // Re-check scroll vs client height AFTER setting explicit height and allowing reflow
        // Use another timeout or rAF if needed for absolute certainty after styles apply
        setTimeout(() => {
            if (!gridWrapper) return; // Check again
            const scrollHeight = gridWrapper.scrollHeight;
            const clientHeight = gridWrapper.clientHeight;
            if (scrollHeight > clientHeight) {
                console.log(`setGridWrapperHeight: Scrolling CHECK - scrollH=${scrollHeight}, clientH=${clientHeight} -> SCROLLING ENABLED`);
            } else {
                console.warn(`setGridWrapperHeight: Scrolling CHECK - scrollH=${scrollHeight}, clientH=${clientHeight} -> SCROLLING DISABLED`);
            }
        }, 0); // setTimeout 0 allows potential reflow
    }); // End requestAnimationFrame
}
