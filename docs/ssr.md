# Server rendering

Use `MemorySession`, load the incoming cookie, and emit `session.toCookie()` on the response. Never share one mutable client between requests.
