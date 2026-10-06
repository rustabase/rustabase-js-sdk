# Changelog

## 1.3.1

- Fixed `filter()` producing invalid expressions for `NaN`/`Infinity` and throwing on invalid `Date` values; both now bind as `null`.

## 1.3.0

- Added `npx rustabase gen-types`: generates TypeScript row, create and table-map types from your schema, plus a typed `table()` helper.

## 1.2.0

- Added `admin.webhooks.deliveries()` and `clearDeliveries()` for the Go server delivery history.
- Added `admin.functions.invoke()` for HTTP-triggered edge functions, with `X-Edge-Secret` support.
- Log list and stats accept `clientOnly`, `since`, `minLevel` and `search`.
- `settings.testStorage()` can test unsaved S3 settings.
- History limits are clamped to the server's 1-500 range.
- Typed results for SQL, RLS tests, run stats, deliveries, function logs and email templates.

## 1.1.0

- Added typed MFA challenge support across password, OTP, and OAuth sign-in.
- Added safe retries with exponential backoff and `Retry-After` support.
- Added request timeouts and cross-origin credential configuration.
- Realtime connections can include credentials for cross-origin cookie sessions.
- Malformed success responses now fail clearly instead of returning an empty object.
- Batch builders reset after successful sends and can be reused safely.
- Added typed health response data and current TypeScript compiler support.

## 1.0.3

- Renamed the package to `rustabase` — install with `npm install rustabase`.
- Added the GitHub release workflow that publishes to npm automatically.

## 1.0.2

- Non-JSON error responses now keep the HTTP status text as the error message.
- A `null` JSON response body is treated as an empty object instead of leaking through.
- The default auto-cancel key now includes the query string, so the same path with different filters no longer cancels itself.
- `all()` rejects a `chunk` smaller than 1 instead of looping forever.
- `update()` and `remove()` reject a missing id with a clear 404 error, like `get()`.
- `batch.send()` rejects an empty batch with a clear error.
- `files.url()` trims the file name before building the url.
- `isFormData()` no longer crashes on null-prototype objects.
- `session.toCookie()` ignores a non-numeric `exp` claim instead of producing an invalid expiry date.
- `realtime.subscribe()` rolls back its listener when the first connection fails.
- `realtime.onDisconnect` is no longer called when no topics were active.
- Fixed base64url padding for tokens whose payload ends on a 1-character remainder.
- `signOut()` now also cancels pending requests.
- `session.set()` only notifies listeners when the token or record actually changed.
- Exported `readQuery`, `seg`, `isFileLike`, `isFormData`, `prepareBody` and `splitBody`.
- Marked the package as side-effect free for better tree-shaking.

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
