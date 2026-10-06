# iPhone widget (Scriptable)

A medium Home Screen widget: today's and overdue Todoist tasks on the left, last
night's Garmin sleep on the right. A PWA cannot provide iOS widgets (they need
WidgetKit), so this runs in [Scriptable](https://scriptable.app) and reads the
same sources as the site: Todoist API v1, plus the `garmin_wellness` sheet read
with the public Sheets key.

## Setup on the phone

1. Install **Scriptable** from the App Store.
2. In Scriptable, tap **+**, paste in [abepasion-widget.js](abepasion-widget.js),
   and rename the script to `abepasion`.
3. Copy your setup code to the clipboard (see below), then run the script in
   the app. The setup alert fills in the code from the clipboard. Tap **Save**
   and a preview appears.
4. Long-press the Home Screen → **Edit** → **Add Widget** → Scriptable →
   **Medium**. Long-press the new widget → **Edit Widget** → Script:
   `abepasion`. Taps open the site page for the side you tapped (the
   widget's URLs override the When Interacting setting).

To change or remove credentials later, run the script in the app again.

## Setup code

One string carrying all three values, so nothing has to be typed on the phone:

```
abw1.<base64 of {"todoistToken": "...", "sheetsId": "...", "sheetsKey": "..."}>
```

Build it from the site's `.env`:

```bash
node -e "const e=Object.fromEntries(require('fs').readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^[\"']|[\"']$/g,'').trim()]));console.log('abw1.'+Buffer.from(JSON.stringify({todoistToken:e.VITE_TODOIST_API_TOKEN,sheetsId:e.VITE_SHEETS_SPREADSHEET_ID,sheetsKey:e.VITE_SHEETS_API_KEY})).toString('base64'))"
```

The code contains the Todoist token. Send it to the phone privately, never
commit it. The alert also accepts the three values separately (the Todoist token
is in the Todoist app under Settings → Integrations → Developer).

## Behaviour

- **Tasks** use Todoist's `today | overdue` filter. That is the same set as
  `getTasksOfTheDay`, without paging through every active task. Rows are sorted
  by due date, then time, then priority. The dot shows Todoist's priority colour.
- **Sleep** comes from the newest row with a `sleep_score`. If that row is not
  today's, the header shows its date and "not synced today".
- **Offline**: each side falls back to its last good payload, cached in
  Scriptable's documents folder and marked "offline".
- iOS decides when the widget refreshes, roughly every 15–30 minutes. Taps open
  Safari, because iOS cannot open a Home Screen web app from a URL.
