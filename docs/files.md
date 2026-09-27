# Files

Plain values and files are encoded using the Go server’s `@jsonPayload` multipart contract. Protected files use a short-lived token from `rb.files.token()`.
