# Administration

Superuser sessions can manage collections, settings, logs, backups, crons, API keys, webhooks, functions, RLS policies, and SQL.

## Webhook deliveries

```ts
const failed = await rb.admin.webhooks.deliveries(hook.id, { status: "error", limit: 50 });
await rb.admin.webhooks.clearDeliveries(hook.id);
```
