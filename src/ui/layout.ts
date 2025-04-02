// src/ui/layout.ts
import { elements } from '../core/state';

// <<< Ensure this log is present >>>
console.log("--- MODULE LOADED: src/ui/layout.ts ---");

/**
 * Calculates and sets the height of the grid wrapper dynamically
 * to enable scrolling within the available space.
 */
export function setGridWrapperHeight(): void {
    // Use requestAnimationFrame to wait for layout stabilization
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
        const headerHeight = header?.offsetHeight ?? 0;
        const footerHeight = footer?.offsetHeight ?? 0;
        const availableHeight = Math.max(0, containerHeight - headerHeight - footerHeight);
        const targetHeight = Math.max(50, availableHeight); // Min height 50px

        console.log(`setGridWrapperHeight: ContainerH=${containerHeight}, HeaderH=${headerHeight}, FooterH=${footerHeight}, TargetH=${targetHeight}`);

        gridWrapper.style.height = `${targetHeight}px`;

        // Re-check scroll vs client height AFTER setting explicit height
        setTimeout(() => {
            if (!gridWrapper) return;
            const scrollHeight = gridWrapper.scrollHeight;
            const clientHeight = gridWrapper.clientHeight;
            if (scrollHeight > clientHeight) {
                console.log(`setGridWrapperHeight: Scrolling CHECK - scrollH=${scrollHeight}, clientH=${clientHeight} -> SCROLLING ENABLED`);
            } else {
                console.warn(`setGridWrapperHeight: Scrolling CHECK - scrollH=${scrollHeight}, clientH=${clientHeight} -> SCROLLING DISABLED`);
            }
        }, 0);
    }); // End requestAnimationFrame
}
