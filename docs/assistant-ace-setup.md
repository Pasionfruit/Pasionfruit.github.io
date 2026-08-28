# Assistant Ace — setup

Everything needed to bring the card on the admin home page to life. The front
end is already built and tested; nothing here touches application code.

## What you are building

```
browser (any device)
  │  POST /api/chat   with your Google ID token
  ▼
Cloudflare Worker  ── verifies the token, email must be yours
  │
  ▼
Cloudflare Tunnel  ── the only way in from outside
  │
  ▼
Ollama  http://127.0.0.1:11434  on the i9 box
```

**Ollama has no authentication of any kind.** Anything that can reach port
11434 can use the GPU and prompt a model that has been handed your inbox. That
single fact is why the tunnel hostname never reaches the browser and why the
Worker exists.

## Time

Do these in order. Phase A is worth doing on its own first even though you want
the full thing — it proves the model, the prompts and the card all work while
there is only one moving part, so anything that breaks in Phase B is
definitively transport.

| | Step | Time |
|---|---|---|
| **A** | Install Ollama, pull the model | 20 min (mostly a 5.2 GB download) |
| | Point the site at localhost, verify | 10 min |
| | **Phase A total — works on the desktop** | **~30 min** |
| **B** | Cloudflare Tunnel | 20–30 min |
| | Cloudflare Access service token | 20–30 min |
| | Deploy the Worker | 15 min |
| | Repoint the site, verify from your phone | 15 min |
| | Something will go wrong | 30–60 min |
| | **Phase B total — works everywhere** | **1.5–2.5 hrs** |

Budget a weekend morning. The Access step is the one that eats time; it is
where the 403s come from.

---

# Phase A — desktop only

## A1. Install Ollama and pull the model

```powershell
winget install --id Ollama.Ollama
ollama pull qwen3:8b
```

`qwen3:8b` at Q4_K_M is ~5.2 GB, which fits the 4060's 8 GB with room for the
KV cache. Check it answers:

```powershell
ollama run qwen3:8b "Reply with exactly: ready"
```

> **If it is slow or the fans scream**, the model spilled to system RAM. Run
> `ollama ps` — the `PROCESSOR` column should say `100% GPU`. If it says
> anything with `CPU`, drop to `qwen3:4b` and set `VITE_ACE_MODEL` to match.

## A2. Let the browser talk to it

Ollama rejects cross-origin requests by default. Add this **user environment
variable** (System Properties → Environment Variables, or the command below),
then **restart Ollama from the tray** — it does not pick up env changes while
running. `npm run dev` uses port 5173 unless it is taken, in which case Vite
prints the one it actually picked; add that origin if it differs:

```powershell
setx OLLAMA_ORIGINS "https://abepasion.com,http://localhost:5173,http://localhost:5174"
```

## A3. Point the site at it

In `.env`:

```
VITE_ACE_BASE_URL=http://localhost:11434
VITE_ACE_MODEL=qwen3:8b
```

```powershell
npm run dev
```

Open the admin home. **Checkpoint:** the pill top-right of the Assistant Ace
card reads `qwen3:8b` rather than `Offline`, and pressing **Good morning**
streams a briefing in a few seconds.

This works only in a browser on this machine, and only in Chrome or Edge —
they exempt `http://localhost` from mixed-content blocking, Safari does not.
Phones will show the offline state until Phase B.

---

# Phase B — reachable everywhere

## B1. Bind Ollama to loopback

Before exposing anything, make sure Ollama is not already listening on your
LAN. Loopback is the default, but set it explicitly and restart from the tray:

```powershell
setx OLLAMA_HOST "127.0.0.1:11434"
```

The tunnel is now the only route in.

## B2. Create the tunnel

You already run abepasion.com on Cloudflare, so the account and domain are
done. The dashboard-managed route is less error-prone than the CLI one:

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** →
   **Create a tunnel** → **Cloudflared**.
2. Name it `ace`. Copy the install command it shows you — it embeds the tunnel
   token — and run it in an **admin** PowerShell. That installs `cloudflared`
   as a Windows service, so it survives reboots.
3. On the **Public Hostname** tab, add:
   - Subdomain `ace-tunnel`, domain `abepasion.com`
   - Service **HTTP** → `localhost:11434`

**Checkpoint:** from your phone, off wifi,
`https://ace-tunnel.abepasion.com/api/tags` returns JSON listing your models.

> That also means anyone who guesses the hostname can use your GPU right now.
> B3 closes it. Do not stop here.

<details>
<summary>CLI equivalent, if you prefer config files</summary>

```powershell
cloudflared tunnel login
cloudflared tunnel create ace
cloudflared tunnel route dns ace ace-tunnel.abepasion.com
cloudflared tunnel run --url http://127.0.0.1:11434 ace
cloudflared service install
```
</details>

## B3. Lock the tunnel with a service token

1. Zero Trust → **Access** → **Service Auth** → **Create Service Token**. Name
   it `ace-worker`. **Copy both values now** — the secret is shown once.
2. Zero Trust → **Access** → **Applications** → **Add an application** →
   **Self-hosted**.
   - Domain: `ace-tunnel.abepasion.com`
   - Add a policy: action **Service Auth**, include **Service Token** →
     `ace-worker`.

**Checkpoint:** `https://ace-tunnel.abepasion.com/api/tags` in a normal browser
now returns a Cloudflare Access block page, not JSON. That is the goal — only
the Worker, holding the token, gets through.

## B4. Deploy the Worker

```powershell
cd workers/ace
npx wrangler secret put OLLAMA_URL            # https://ace-tunnel.abepasion.com
npx wrangler secret put ADMIN_EMAIL           # pasionabe@gmail.com
npx wrangler secret put GOOGLE_CLIENT_ID      # same value as VITE_GOOGLE_CLIENT_ID
npx wrangler secret put TUNNEL_CLIENT_ID      # from B3
npx wrangler secret put TUNNEL_CLIENT_SECRET  # from B3
npx wrangler deploy
```

Note the deployed URL. Sanity check that it refuses anonymous callers:

```powershell
curl.exe https://ace.<subdomain>.workers.dev/api/tags
```

**Checkpoint:** `{"error":"Missing bearer token"}`. A 200 here means the auth
check is not running — stop and fix it before going further.

## B5. Point the site at the Worker

In `.env`, and in whatever you use for the production build:

```
VITE_ACE_BASE_URL=https://ace.<subdomain>.workers.dev
VITE_ACE_MODEL=qwen3:8b
```

Both are baked into the public bundle. That is fine and intended: the Worker URL
is not a secret, and the Worker serves nobody but your account. **Never put the
tunnel hostname in `VITE_ACE_BASE_URL`** — that would hand every visitor a
direct line to your GPU.

Deploy, then open the admin home on your phone.

**Checkpoint:** the pill reads `qwen3:8b` and **Good morning** streams a
briefing over cellular.

---

# Operating it

**Sign-in expiry.** The card sends the Google ID token from `localStorage`, and
those last about an hour. After that Ace returns *"Ace refused the request"*
until you sign in again — the same behaviour Apps Script writes already have.

**Model residency.** Every request asks Ollama to hold the model for 30 minutes,
so 5.2 GB of VRAM stays occupied that long after you last use it. If you want it
released sooner for gaming, change `KEEP_ALIVE` in
[`src/admin/ace/client.ts`](../src/admin/ace/client.ts) and rebuild — the
per-request value overrides the server's `OLLAMA_KEEP_ALIVE`, so setting that
env var alone will not do anything.

**Changing model.** Pull it, set `VITE_ACE_MODEL` to the tag exactly as
`ollama list` prints it, rebuild. No code change.

**Cost.** Nothing. Cloudflare Tunnel, Access service tokens and the Workers free
tier all cover this comfortably; the only bill is electricity.

---

# Troubleshooting

Matched to the exact text the card shows you.

| What you see | Cause | Fix |
|---|---|---|
| Pill says **Offline** | `VITE_ACE_BASE_URL` empty at build time | Set it and rebuild. Vite inlines env vars at build, not runtime. |
| **Failed to fetch** | CORS, or the host is down | Phase A: `OLLAMA_ORIGINS` unset or Ollama not restarted after setting it. Phase B: origin missing from `ALLOWED_ORIGINS` in `wrangler.toml`. |
| **Ace refused the request — sign in again** | Worker rejected the token | Expired (>1 hr) → sign in again. Otherwise `ADMIN_EMAIL` or `GOOGLE_CLIENT_ID` secret is wrong. |
| **That model is not pulled on the host yet** | Tag mismatch | `ollama list` and copy the tag verbatim into `VITE_ACE_MODEL`. |
| **Ace is not reachable — is Ollama running and the tunnel up?** | Worker got there, upstream did not answer | `ollama ps`, then check the tunnel is **Healthy** in Zero Trust → Tunnels. |
| `{"error":"No such route"}` | Path other than `/api/chat` or `/api/tags` | Expected. The Worker only proxies those two. |
| Briefing is confidently wrong | Model inventing what the context lacks | The card lists unreachable sources under the counts. If Gmail or Calendar are listed there, Ace was told nothing about them and is guessing — fix the source, not the prompt. |
| Replies are slow or rambling | 8B with thinking enabled | `qwen3:4b` is markedly faster. Answer quality on summarising is close; structured extraction is where 4B gets shakier. |

## Verifying the Worker directly

Grab a live token from the browser console on the admin page:

```js
copy(localStorage.getItem('google-id-token'))
```

```powershell
curl.exe -H "Authorization: Bearer <token>" https://ace.<subdomain>.workers.dev/api/tags
```

Your model list means every hop works and the problem is in the browser.

---

# Not built yet

**The scheduled overnight report.** Right now the briefing generates when you
first open the page and caches for the day. Having it waiting at 6am needs
context assembled server-side — a Worker cron calling Apps Script for mail and
calendar, then Ollama. Worth doing once the tunnel is proven, not before.

**Ace on pages other than home.** The card only reads the home dashboard's
sources today.
