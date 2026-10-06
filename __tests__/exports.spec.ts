import { expect, test } from 'vite-plus/test';
import * as api from '../src/index';

test('exports exactly the 4.0 runtime API', () => {
  expect(Object.keys(api).sort()).toEqual(
    [
      'AuthError',
      'DarajaApiError',
      'MemoryTokenStore',
      'MpesaError',
      'NetworkError',
      'ValidationError',
      'c2bValidationResponse',
      'createMpesa',
      'parseBalances',
      'parseC2BNotification',
      'parseResult',
      'parseStkCallback',
    ].sort(),
  );
});
