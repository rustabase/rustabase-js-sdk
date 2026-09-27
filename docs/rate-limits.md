# Rate limits

Transient 429 responses can be retried. The client honors `Retry-After` seconds or HTTP dates and exposes the parsed delay as `error.retryAfter`.
