# Assistant Ace gateway

The Cloudflare Worker that fronts Ollama. It does one job: prove the caller is
the admin, then proxy.

**Setup lives in [`docs/assistant-ace-setup.md`](../../docs/assistant-ace-setup.md)** —
Ollama, the tunnel, this Worker and the site, in order. This file is reference
only.

## Why it exists

Ollama has no authentication. Its tunnel hostname must therefore never reach the
browser, which rules out calling the tunnel directly. Cloudflare Access cannot
stand in either — it answers a cross-origin fetch with a login redirect that
CORS then kills — and an Access service token in the bundle would be public,
the same trap as `VITE_SHEETS_API_KEY`.

So the Worker holds the tunnel hostname and the service token, and authenticates
callers with the Google ID token the site already has. That is the same check
`requireAuthorizedUser_` does in Apps Script, and it means nothing secret ships
to the browser.

## Routes

Only `/api/chat` and `/api/tags` are proxied. Everything else is a 404, so a
stray path cannot reach Ollama's model-management endpoints.

Responses stream through untouched — Ollama emits NDJSON token by token, and
buffering here would cost the responsiveness a local model buys.

## Configuration

`ALLOWED_ORIGINS` is a plain var in `wrangler.toml`. The rest are secrets:

| Secret | Value |
|---|---|
| `OLLAMA_URL` | Tunnel hostname, e.g. `https://ace-tunnel.abepasion.com` |
| `ADMIN_EMAIL` | The only account served |
| `GOOGLE_CLIENT_ID` | Same as `VITE_GOOGLE_CLIENT_ID`; rejects tokens minted for another app |
| `TUNNEL_CLIENT_ID` | Optional, Cloudflare Access service token |
| `TUNNEL_CLIENT_SECRET` | Optional, pairs with the above |

```bash
npx wrangler secret put OLLAMA_URL
npx wrangler deploy
```

Without the two `TUNNEL_*` secrets the Worker still works, but the tunnel is
open to anyone who guesses its hostname. Set them.

## Checking it

```bash
curl https://ace.<subdomain>.workers.dev/api/tags
# {"error":"Missing bearer token"}
```

A 200 there means the auth check is not running.
