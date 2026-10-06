# Token store

Each new Daraja token invalidates the previous one, so every process sharing a consumer key should share one token. By default tokens are cached in a `MemoryTokenStore`, per client. To share them across processes or serverless instances, pass a `TokenStore`, for example backed by Redis:

```ts
import { type CachedToken, type TokenStore } from 'mpesa-api';

const tokenStore: TokenStore = {
  async get(key) {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as CachedToken) : undefined;
  },
  async set(key, token) {
    await redis.set(key, JSON.stringify(token), 'PXAT', token.expiresAt);
  },
};
```

Keys include the environment and a hash of the consumer key, never the key itself. A failing store never fails a request: a failed `set` is reported through `onWarning`, and a failed `get` falls back to fetching a new token. A `CachedToken` is `{ accessToken, expiresAt }`, with `expiresAt` in epoch milliseconds.
