# Teller API Certificates

This directory should contain your Teller API client certificates for mTLS authentication.

## Required Files

1. **certificate.pem** - Your Teller API public certificate
2. **private_key.pem** - Your Teller API private key

## How to Get Your Certificates

### Option 1: Download from Teller Dashboard

1. Visit https://teller.io
2. Log into your account
3. Navigate to **Settings** → **API** or **Certificates**
4. Download both files:
   - `certificate.pem`
   - `private_key.pem`
5. Place them in this directory

### Option 2: Generate via Teller CLI (if available)

```bash
# If Teller provides a CLI tool
teller certificates download
```

### Option 3: Contact Teller Support

If you can't find the certificates:
- Email: support@teller.io
- Or check their documentation at https://teller.io/docs

## Security Notes

⚠️ **IMPORTANT**:
- These certificates contain sensitive credentials
- **NEVER** commit them to version control
- The `.gitignore` file should exclude `*.pem` files
- Keep them secure and private

## Verification

Once you've placed the files here, run:

```bash
npm run test:teller
# or
npx tsx scripts/test-teller-api.ts
```

This will verify that your certificates are properly configured.

## File Structure

```
teller_certificates/
├── README.md          (this file)
├── certificate.pem    (YOUR PUBLIC CERTIFICATE - download from Teller)
└── private_key.pem    (YOUR PRIVATE KEY - download from Teller)
```

## Troubleshooting

### "Missing certificate" error
- Ensure both `certificate.pem` and `private_key.pem` exist in this directory
- Check file permissions (should be readable)
- Verify the files are valid PEM format

### "Invalid certificate" error
- Certificate may be expired - download fresh ones from Teller
- Ensure you're using the correct certificate for your API token

### "Certificate not found" error
- Check the paths in your `.env` or `advisor-env.yaml`:
  ```
  TELLER_CERT_PATH=./teller_certificates/certificate.pem
  TELLER_KEY_PATH=./teller_certificates/private_key.pem
  ```

