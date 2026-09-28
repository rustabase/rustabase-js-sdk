# Logs

```ts
const page = await rb.admin.logs.list({ clientOnly: true, minLevel: 4, search: "timeout" });
const chart = await rb.admin.logs.stats({ since: new Date(Date.now() - 86400000) });
```

`clientOnly` hides superuser dashboard traffic, `since` limits the time range, `minLevel` filters by level and `search` matches message and request data.
