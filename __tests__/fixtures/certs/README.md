# Test certificates

**These are throwaway test fixtures, not Safaricom certificates.** The private key in `test-key.pem` was generated for this repository's tests only, protects nothing, and is safe to publish. Tests use it to decrypt the security credentials that the SDK encrypts with `test-cert.pem`.

They were generated with OpenSSL 3:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout test-key.pem -out test-cert.pem -days 36500 -subj "/CN=mpesa-api test"
openssl x509 -in test-cert.pem -pubkey -noout > test-spki.pem
openssl x509 -in test-cert.pem -outform DER -out test-cert.der
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout /dev/null -out test-ec-cert.pem -days 1 -subj "/CN=ec"
openssl req -x509 -key test-key.pem -out test-expired-cert.pem -subj "/CN=expired" -not_before 20200101000000Z -not_after 20210101000000Z
```

`test-expired-cert.pem` uses the same key as `test-cert.pem`, so credentials made with it also decrypt with `test-key.pem`.
