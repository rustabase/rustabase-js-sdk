# Edge functions

Call an HTTP-triggered function through its public hook:

```ts
const result = await rb.admin.functions.invoke("send-welcome", {
    body: { userId: "u1" },
    secret: process.env.EDGE_SECRET, // only when the function has a secret
});
```

`invoke()` uses `POST` by default; pass `method` and `query` for other calls. The secret travels in the `X-Edge-Secret` header, never in the URL.
