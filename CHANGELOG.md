# Changelog

## 1.0.1

- Fixed the `react-native` package entry pointing at a non-existent build file.
- `RustaBaseError.from()` now keeps the `url`, `status` and `data` of wrapped errors.
- `tokenExpired()` treats a non-numeric `exp` claim as expired.
- `bindFilter()` no longer resolves placeholders from the object prototype chain.
- `realtime.unsubscribeByPrefix()` no longer matches sibling topics (e.g. `posts` no longer matches `posts2`).
- Exported the `bindFilter`, `joinUrl`, `withQuery` and `toQueryString` helpers.
- Added a `typecheck` script and removed a leftover registry config.

## 1.0.0

First release of the RustaBase JavaScript SDK, written from scratch.

- `createClient(url)` entry point with `rb.from()`, `rb.auth()`, `rb.files`, `rb.realtime`, `rb.batch()` and `rb.admin`.
- Sessions: `BrowserSession` (default in browsers), `MemorySession`, `AsyncSession`, with cookie helpers for server rendering.
- Sign-in with password, one-time code and OAuth2, plus optional `keepAlive` token refresh.
- Live updates over the `RB_CONNECT` realtime protocol.
- All errors are `RustaBaseError` with `status`, `data`, `fieldErrors` and `cancelled`.
