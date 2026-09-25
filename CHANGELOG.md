# Changelog

## 1.0.0

First release of the RustaBase JavaScript SDK, written from scratch.

- `createClient(url)` entry point with `rb.from()`, `rb.auth()`, `rb.files`, `rb.realtime`, `rb.batch()` and `rb.admin`.
- Sessions: `BrowserSession` (default in browsers), `MemorySession`, `AsyncSession`, with cookie helpers for server rendering.
- Sign-in with password, one-time code and OAuth2, plus optional `keepAlive` token refresh.
- Live updates over the `RB_CONNECT` realtime protocol.
- All errors are `RustaBaseError` with `status`, `data`, `fieldErrors` and `cancelled`.
