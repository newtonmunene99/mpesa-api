import { Issues } from '../core/validate';
import { readNumber } from './shared';

/** One account from a packed Daraja balance string. */
export interface AccountBalanceEntry {
  account: string;
  currency: string;
  available: number;
  uncleared: number;
  reserved: number;
  /** The sixth field, which Daraja's docs leave unlabelled. The name is provisional. */
  unreserved: number;
}

const AMOUNTS = ['available', 'uncleared', 'reserved', 'unreserved'] as const;

/**
 * Splits the packed balance string in Account Balance's `AccountBalance` and Reversal's
 * `DebitAccountBalance` parameters: `'Name|KES|available|uncleared|reserved|unreserved&…'`.
 */
export function parseBalances(value: string): AccountBalanceEntry[] {
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
        available: 0,
        uncleared: 0,
        reserved: 0,
        unreserved: 0,
      };
      AMOUNTS.forEach((name, i) => {
        const path = `[${index}].${name}`;
        const raw = amounts[i]!;
        if (raw.trim() === '') issues.add(path, 'must be a number');
        else entry[name] = readNumber(issues, path, raw) ?? 0;
      });
      entries.push(entry);
    });
  issues.throwIfAny('parseBalances');
  return entries;
}
