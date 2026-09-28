# Migrating to 1.2

1.2 is backwards compatible. Notable type changes:

- `admin.sql()` now returns `SqlResult` with `execTime`, `affectedRows`, `columns` and `rows`. `columns` holds `{ name, type, nullable }` objects, as the server always did.
- `admin.settings.testEmail()` only accepts the server's template names.
- `admin.rls.test()` takes `RlsTestInput` and returns `RlsTestResult`.
- Webhook and function `stats()` return a map of `RunStats` keyed by id.
