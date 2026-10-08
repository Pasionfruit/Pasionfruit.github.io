# News dashboard and Ace article summaries

The dashboard shows four headlines per feed in a scrolling list, keeping all
20 returned stories available. Each story's **Ask Ace** button opens Ace with
a high-level summary request ready to send. Users can also ask Ace to summarize
a public HTTPS article link directly.

## Deploy

Deploy this Worker alongside the site update for article summaries to work:

```powershell
cd workers/news
npx wrangler deploy
```

The existing `DB_API` binding verifies the admin session. No additional secrets
or bindings are needed. Ace must already be configured through
`VITE_ACE_BASE_URL` and `VITE_ACE_MODEL`.

## Sources

Google News RSS answers Cloudflare's egress IPs with a 503 "Sorry…" page
whatever the User-Agent, so it cannot be read from a Worker. Instead:

- **Nation** blends NPR National, CBS News US, ABC News US and PBS News.
- **International** blends BBC World, NPR World, CBS News World and ABC News
  International.
- **Local** and **City** are Bing News RSS searches for the place, limited to
  the past week. Bing's click-tracking links are unwrapped to the publisher URL.

Outlets take turns filling the 20 slots, so one busy feed cannot crowd out the
others, and a feed that fails only thins the card out.

## Routes

- `GET /news?feed=nation|world` or `GET /news?place=...&region=...`: up to 20 headlines.
- `GET /article?url=...`: publisher URL, title, available plain text and an
  `excerpt` flag. Uses the same bearer authentication as `/news`.

Article retrieval runs only when the user sends a linked article request.
MSN links (common in Bing's local results) render client-side, so their text
is read from MSN's content API, citing the original publisher. Google News
links are still resolved to their publisher through Google's signed
redirect RPC, following the approach used by
[newspaper4k](https://github.com/AndyTheFactory/newspaper4k/blob/master/newspaper/google_news.py).
This private Google endpoint may change. Retrieval is capped at 15 seconds and
2 MB; the returned text is capped at 14,000 characters. Redirects must stay on
public HTTPS destinations, without credentials or custom ports.

The reader prefers structured `articleBody`, then article paragraphs. Main-page
paragraphs or metadata descriptions are marked as excerpts. Ace is instructed
to summarize only supplied text in 2–3 bullets under 120 words, cite the source,
and label excerpts. Blocked, paywalled or unreadable pages ask the user to paste
the article text instead. Only the latest article's full text is replayed to
Ace; older requests and summaries remain in conversation history.
