# Unloop relay Worker

Stateless **postman** for Buddy (ADR-006 / ADR-010): TTL opaque mailboxes + `mailboxId → pushToken` map. No plaintext message store, no profiles.

## Local

```bash
cd workers/relay
npm install
# Optional: create preview KV and uncomment bindings in wrangler.toml
npx wrangler kv namespace create unloop-relay-mailbox
npx wrangler kv namespace create unloop-relay-mailbox --preview
npx wrangler dev
curl http://127.0.0.1:8787/health
```

Without a KV binding, `/health` still works; mailbox routes return `503`.

## Deploy (human / autonomy after go-ahead)

Uses Cloudflare account from repo-root `.env.local` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

```bash
cd workers/relay
npx wrangler kv namespace create unloop-relay-mailbox
# paste id into wrangler.toml [[kv_namespaces]]
npx wrangler deploy
```

Never commit service-account JSON, API tokens, or mailbox contents.

## API sketch

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/health` | — | Liveness |
| PUT | `/v1/mailbox/:mailboxId/:eventId` | `{ ciphertext, ttlSec? }` | Opaque blob |
| GET | `/v1/mailbox/:mailboxId/:eventId` | — | 404 if missing/expired |
| DELETE | `/v1/mailbox/:mailboxId/:eventId` | — | Cancel |
| PUT | `/v1/push-token/:mailboxId` | `{ token }` | FCM token register |
| DELETE | `/v1/push-token/:mailboxId` | — | Forget |
| POST | `/v1/notify/:mailboxId` | optional | Stub until P3-04 FCM |

Auth hardening (signed mailbox tokens) comes with the crypto follow-up ADR.
