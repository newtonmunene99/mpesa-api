import { ValidationError } from '../core/errors';
import { Issues } from '../core/validate';
import { readCents } from './shared';

/** One account from a packed Daraja balance string. */
export interface AccountBalanceEntry {
  /** The account's name, such as "Working Account" or "Utility Account". */
  account: string;
  /** Usually "KES". */
  currency: string;
  /** The third field: funds available, in cents (KES 700,000.00 is 70000000). */
  availableCents: number;
  /** The fourth field: uncleared funds, in cents. */
  unclearedCents: number;
  /** The fifth field: reserved funds, in cents. */
  reservedCents: number;
  /** The sixth field, in cents. Daraja's docs leave it unlabelled; the name is provisional. */
  unreservedCents: number;
}

/** The four amount fields, in the order they appear in each entry, with their issue paths. */
const AMOUNTS = [
  ['availableCents', 'available'],
  ['unclearedCents', 'uncleared'],
  ['reservedCents', 'reserved'],
  ['unreservedCents', 'unreserved'],
] as const;

/**
 * Splits the packed balance string in Account Balance's `AccountBalance` and Reversal's
 * `DebitAccountBalance` parameters: `'Name|KES|available|uncleared|reserved|unreserved&…'`.
 * Takes `unknown` so a parameter can be passed straight from `parseResult`; anything but a
 * string throws `ValidationError`.
 */
export function parseBalances(value: unknown): AccountBalanceEntry[] {
  if (typeof value !== 'string') {
    throw new ValidationError('parseBalances', [{ path: 'value', message: 'must be a string' }]);
  }
  const issues = new Issues();
  const entries: AccountBalanceEntry[] = [];
  value
    .split('&')
    .filter((part) => part.trim() !== '')
    .forEach((part, index) => {
      const fields = part.split('|');
      if (fields.length !== 6) {
        issues.add(`[${index}]`, 'must have 6 fields');
        return;
      }
      const [account, currency, ...amounts] = fields;
      const entry: AccountBalanceEntry = {
        account: account!,
        currency: currency!,
        availableCents: 0,
        unclearedCents: 0,
        reservedCents: 0,
        unreservedCents: 0,
      };
      AMOUNTS.forEach(([field, name], i) => {
        entry[field] = readCents(issues, `[${index}].${name}`, amounts[i]) ?? 0;
      });
      entries.push(entry);
    });
  issues.throwIfAny('parseBalances');
  return entries;
}
