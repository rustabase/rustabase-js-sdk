# RustaBase JavaScript SDK

Official JavaScript / TypeScript client for [RustaBase](https://rustabase.com). Works in browsers, Node.js 18+, Deno, Bun and React Native.

```sh
npm install rustabase-js-sdk
```

## Quick start

```js
import { createClient } from "rustabase-js-sdk";

const rb = createClient("https://my-app.rustabase.net");

// sign in
await rb.auth("users").signInWithPassword("me@example.com", "secret");

// read
const page = await rb.from("posts").list({ filter: rb.filter("status = {:s}", { s: "live" }), sort: "-created" });
const all = await rb.from("posts").all();
const post = await rb.from("posts").get("RECORD_ID", { expand: "author" });
const latest = await rb.from("posts").first("featured = true");

// write
const created = await rb.from("posts").create({ title: "Hello", cover: fileInput.files[0] });
await rb.from("posts").update(created.id, { title: "Hello again" });
await rb.from("posts").remove(created.id);

// live updates
const stop = await rb.from("posts").subscribe("*", ({ action, record }) => console.log(action, record));
await stop();
```

## Sessions

| Class | Where it keeps the session |
| --- | --- |
| `BrowserSession` | `localStorage`, synced across tabs (default in browsers) |
| `MemorySession` | memory only (default on servers) |
| `AsyncSession` | any async storage, e.g. React Native AsyncStorage |

```js
rb.session.token;        // current token
rb.session.record;       // signed-in record
rb.session.isValid;      // token present and not expired
rb.session.isSuperuser;
rb.session.onChange((token, record) => {});
rb.signOut();
```

Server rendering:

```js
const rb = createClient(URL, { session: new MemorySession() });
rb.session.loadCookie(request.headers.get("cookie") ?? "");
// ...
response.headers.append("set-cookie", rb.session.toCookie());
```

## Sign-in

```js
const users = rb.auth("users");

await users.signInWithPassword(email, password, { keepAlive: 1800 }); // refresh 30 min before expiry
await users.signInWithOAuth({ provider: "google" });                 // opens a popup
const { otpId } = await users.requestOtp(email);
await users.signInWithOtp(otpId, "123456");
await users.refresh();
await users.methods();

await users.requestPasswordReset(email);
await users.confirmPasswordReset(token, password, passwordConfirm);
await users.requestVerification(email);
await users.confirmVerification(token);
await users.requestEmailChange(newEmail);
await users.confirmEmailChange(token, password);
```

## Files

```js
rb.files.url(record, record.avatar, { thumb: "100x100" });
const token = await rb.files.token(); // for protected files
rb.files.url(record, record.contract, { token });
```

## Batch writes

```js
const batch = rb.batch();
batch.from("posts").create({ title: "A" });
batch.from("posts").update("id1", { title: "B" });
batch.from("posts").upsert({ id: "id2", title: "C" });
batch.from("comments").remove("id3");
const results = await batch.send();
```

## Admin (superusers)

`rb.admin.collections`, `settings`, `logs`, `backups`, `crons`, `apiKeys`, `webhooks`, `functions`, `rls` and `rb.admin.sql(query)`.

## Errors and cancelling

Every failure throws a `RustaBaseError`:

```js
try {
    await rb.from("posts").create({});
} catch (err) {
    err.status;       // 0 when the server couldn't be reached
    err.fieldErrors;  // { title: { code, message } }
    err.cancelled;    // true when auto-cancelled
}
```

Identical requests cancel the older one. Pass `requestKey: null` to opt out, a custom `requestKey` to group requests, or set `rb.autoCancel = false`. Use `rb.cancel(key)` / `rb.cancelAll()` to cancel manually.

## Hooks

```js
rb.onRequest = (url, init) => ({ url, init: { ...init, headers: { ...init.headers, "X-Trace": "1" } } });
rb.onResponse = (response, data) => data;
```

## License

MIT
