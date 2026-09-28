# Files

Plain values and files are encoded using the Go server’s `@jsonPayload` multipart contract. Protected files use a short-lived token from `rb.files.token()`.

The Go server only issues file tokens to signed-in users. Guests get a `401` error, so request the token after sign-in (or with a cookie session on the same site).
