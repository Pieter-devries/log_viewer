/**
 * Debounce utility function. Limits the rate at which a function can fire.
 * @param func - The function to debounce.
 * @param wait - The number of milliseconds to delay.
 * @returns A debounced version of the function.
 */
export function debounce(func: (...args: any[]) => void, wait: number): (...args: any[]) => void {
    let timeout: number | undefined;

    const executedFunction = (...args: any[]): void => {
        const later = () => {
            clearTimeout(timeout);
            func(...args); // Execute the original function
        };
        clearTimeout(timeout); // Clear the previous timeout
        timeout = window.setTimeout(later, wait); // Set a new timeout
    };

    return executedFunction;
}
