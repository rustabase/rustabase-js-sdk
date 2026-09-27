# Multi-factor authentication

A 401 response can include `error.mfaId`. Request an OTP for the same identity and repeat the authentication call with `{ mfaId: error.mfaId }`.
