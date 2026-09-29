/** Reads a Daraja value as text: strings as-is, numbers and booleans stringified, else ''. */
export const str = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';

/** Numeric strings become numbers; other codes (such as "R000002") stay strings. */
export const code = (value: unknown): number | string => {
  const text = str(value);
  return /^-?\d+$/.test(text) ? Number(text) : text;
};
