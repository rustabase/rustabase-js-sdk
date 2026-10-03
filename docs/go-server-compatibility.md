# Go server compatibility

The SDK follows the Go server REST routes, JSON error envelope, multipart format, batch request shape, token claims, and realtime handshake.

## Admin route coverage

| SDK method | Go server route |
| --- | --- |
| `admin.webhooks.deliveries(id)` | `GET /api/webhooks/{id}/deliveries` |
| `admin.webhooks.clearDeliveries(id)` | `DELETE /api/webhooks/{id}/deliveries` |
| `admin.webhooks.stats()` | `GET /api/webhooks/stats` |
| `admin.functions.invoke(name)` | `/edge-hook/{name}` (any method) |
| `admin.functions.logs(id)` | `GET /api/functions/{id}/logs` |
| `admin.logs.list({ clientOnly, since, minLevel, search })` | `GET /api/logs` |
| `admin.settings.testStorage(fs, { overrides })` | `POST /api/settings/test/s3` |
| `admin.rls.test(input)` | `POST /api/rls/test` |
| `admin.sql(query)` | `POST /api/sql` |

History limits are clamped to 1-500, the range the server accepts.
