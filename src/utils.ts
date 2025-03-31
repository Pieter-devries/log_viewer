/**
 * Escapes special characters in a string for use in a regular expression.
 */
export function escapeRegExp(string: string): string {
    if (!string) return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
