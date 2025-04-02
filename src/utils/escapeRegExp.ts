// src/utils/escapeRegExp.ts

/**
 * Escapes special characters in a string for use in a regular expression.
 */
export function escapeRegExp(string: string): string {
    if (!string) return '';
    // Escape characters with special meaning in regex
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
