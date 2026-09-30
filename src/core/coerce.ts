/** Coerces loosely typed Daraja values. Shared by the API modules and the callback parsers. */

/** Reads a Daraja value as text: strings as-is, numbers and booleans stringified, else ''. */
export const str = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';

/**
 * Canonical integer strings ("0", "2001") become numbers; anything else, such as "R000002",
 * "00" or an integer too large to represent exactly, stays a string.
 */
export const code = (value: unknown): number | string => {
  const text = str(value);
  const n = Number(text);
  return /^-?\d+$/.test(text) && Number.isSafeInteger(n) && String(n) === text ? n : text;
};
