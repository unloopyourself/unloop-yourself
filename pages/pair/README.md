# Unloop pair landing (Cloudflare Pages)

HTTPS host for Buddy invites + Digital Asset Links.

- Site root must serve `/.well-known/assetlinks.json` (see `_headers` for `Content-Type`).
- Debug fingerprint is baked for local/dev builds; **add Play App Signing + upload-key SHA-256** before production App Links.

## Deploy

```bash
# from repo root, with CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npx wrangler pages project create unloop-pair --production-branch main
npx wrangler pages deploy pages/pair --project-name unloop-pair
```

Document the resulting `*.pages.dev` URL in `factory/STATUS.md` and optionally set `EXPO_PUBLIC_PAIR_HOST`.
