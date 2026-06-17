"""
Syncs Minecraft player stats from Aternos via Playwright browser automation.
Logs in, navigates to Files > world/stats/, reads each UUID.json via
authenticated AJAX, then posts results to the Apps Script endpoint.

GitHub Secrets required:
  ATERNOS_USERNAME
  ATERNOS_PASSWORD
  SHEETS_SCRIPT_URL
"""
import json
import os
import sys
import time
import traceback
import urllib.request
from datetime import datetime, timezone

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

USERNAME   = os.environ.get('ATERNOS_USERNAME', '')
PASSWORD   = os.environ.get('ATERNOS_PASSWORD', '')
SCRIPT_URL = os.environ.get('SHEETS_SCRIPT_URL', '')

if not all([USERNAME, PASSWORD, SCRIPT_URL]):
    print('ERROR: Missing ATERNOS_USERNAME, ATERNOS_PASSWORD, or SHEETS_SCRIPT_URL.')
    sys.exit(1)

USERNAME_SELECTORS = [
    'input[name="username"]', '#user', '[autocomplete="username"]',
    'input[type="text"]',
]
PASSWORD_SELECTORS = [
    'input[type="password"]', 'input[name="password"]',
    '#password', '[autocomplete="current-password"]',
]
SUBMIT_SELECTORS = [
    'button[type="submit"]', '#login-button', 'input[type="submit"]',
    '.btn-login', 'button.btn',
]


def find_sel(page, selectors, timeout_ms=3000):
    for sel in selectors:
        try:
            page.wait_for_selector(sel, state='visible', timeout=timeout_ms)
            return sel
        except Exception:
            pass
    return None


def login(page):
    page.goto('https://aternos.org/go/', wait_until='domcontentloaded', timeout=30_000)

    username_sel = None
    for delay in [5, 10, 15]:
        time.sleep(delay)
        page.screenshot(path=f'/tmp/sync-login-{delay}.png')
        username_sel = find_sel(page, USERNAME_SELECTORS, timeout_ms=3000)
        if username_sel:
            break

    with open('/tmp/sync-login.html', 'w', errors='replace') as fh:
        fh.write(page.content()[:50_000])

    if not username_sel:
        print(f'[Sync] Login form not found. URL={page.url}')
        return False

    password_sel = find_sel(page, PASSWORD_SELECTORS)
    if not password_sel:
        print('[Sync] Password field not found.')
        return False

    page.fill(username_sel, USERNAME)
    page.fill(password_sel, PASSWORD)

    submit_sel = find_sel(page, SUBMIT_SELECTORS)
    if submit_sel:
        page.click(submit_sel)
    else:
        page.keyboard.press('Enter')

    try:
        page.wait_for_url(
            lambda url: 'aternos.org' in url and '/go/' not in url,
            timeout=25_000,
        )
        print(f'[Sync] Logged in — {page.url}')
        return True
    except PWTimeout:
        page.screenshot(path='/tmp/sync-login-failed.png')
        print(f'[Sync] Login timed out. URL={page.url}')
        return False


def get_player_name(uuid):
    clean = uuid.replace('-', '')
    try:
        with urllib.request.urlopen(
            f'https://api.mojang.com/user/profile/{clean}', timeout=5
        ) as resp:
            return json.loads(resp.read()).get('name', uuid[:8])
    except Exception:
        return uuid[:8]


def parse_stats(raw):
    data   = json.loads(raw)
    custom = data.get('stats', {}).get('minecraft:custom', {})
    killed = data.get('stats', {}).get('minecraft:killed', {})
    deaths = int(custom.get('minecraft:deaths', 0))
    kills  = int(
        custom.get('minecraft:player_kills', 0)
        or killed.get('minecraft:player', 0)
    )
    ticks  = int(
        custom.get('minecraft:play_time',
                   custom.get('minecraft:play_one_minute', 0))
    )
    return {
        'kills':          kills,
        'deaths':         deaths,
        'playtime_hours': round(ticks / 72000, 2),
    }


def fetch_stats(page):
    """
    After login, navigate to the server page then use authenticated
    fetch() calls (inside the browser context) to read world/stats/ files.
    """
    # Navigate to server
    if '/server' not in page.url:
        page.goto('https://aternos.org/servers', wait_until='networkidle', timeout=20_000)
        server_sel = find_sel(page, ['.server-body', '.server', 'a[href*="/server"]'])
        if server_sel:
            page.click(server_sel)
            page.wait_for_url('**/server**', timeout=15_000)

    time.sleep(2)
    page.screenshot(path='/tmp/sync-server.png')
    print(f'[Sync] Server page — {page.url}')

    # List stats files via the Aternos panel AJAX endpoint.
    # These requests run inside the authenticated browser context.
    print('[Sync] Listing world/stats/ ...')
    list_result = page.evaluate("""
        async () => {
            try {
                const r = await fetch(
                    '/panel/ajax/files/list.php?file=world%2Fstats',
                    {credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}}
                );
                return {status: r.status, body: await r.text()};
            } catch (e) {
                return {error: String(e)};
            }
        }
    """)
    print(f'[Sync] List response: status={list_result.get("status")} '
          f'body_preview={list_result.get("body","")[:200]}')

    if list_result.get('status') != 200 or 'error' in list_result:
        print('[Sync] File list API failed — see response above.')
        page.screenshot(path='/tmp/sync-list-fail.png')
        return []

    try:
        files = json.loads(list_result['body'])
        # Aternos returns [{name, size, ...}, ...]
        if isinstance(files, dict):
            # Some API versions wrap in {"files": [...]}
            files = files.get('files', files.get('data', []))
        uuid_files = [
            f['name'] if isinstance(f, dict) else str(f)
            for f in files
            if (f['name'] if isinstance(f, dict) else str(f)).endswith('.json')
        ]
    except Exception as exc:
        print(f'[Sync] Error parsing file list: {exc}')
        print(f'[Sync] Raw body: {list_result.get("body","")[:500]}')
        return []

    print(f'[Sync] Found {len(uuid_files)} stats file(s): {uuid_files[:5]}')
    players  = []
    now_iso  = datetime.now(timezone.utc).isoformat()

    for filename in uuid_files:
        uuid = filename.replace('.json', '')
        read_result = page.evaluate(f"""
            async () => {{
                try {{
                    const r = await fetch(
                        '/panel/ajax/files/read.php?file=world%2Fstats%2F{filename}',
                        {{credentials: 'include', headers: {{'X-Requested-With': 'XMLHttpRequest'}}}}
                    );
                    return {{status: r.status, body: await r.text()}};
                }} catch (e) {{
                    return {{error: String(e)}};
                }}
            }}
        """)

        if read_result.get('status') != 200 or 'error' in read_result:
            print(f'[Sync] Skipping {filename}: {read_result}')
            continue

        try:
            stats = parse_stats(read_result['body'])
            name  = get_player_name(uuid)
            print(f'[Sync] {name}: kills={stats["kills"]} '
                  f'deaths={stats["deaths"]} hrs={stats["playtime_hours"]}')
            players.append({'player_name': name, **stats, 'last_updated': now_iso})
        except Exception as exc:
            print(f'[Sync] Error parsing {filename}: {exc}')

    return players


def post_to_sheets(players):
    body = json.dumps({'action': 'updateMcPlayerStats', 'stats': players}).encode()
    req  = urllib.request.Request(
        SCRIPT_URL,
        data=body,
        headers={'Content-Type': 'text/plain;charset=utf-8'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
            ],
        )
        ctx = browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1280, 'height': 800},
        )
        ctx.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = browser.new_page()

        try:
            if not login(page):
                print('[Sync] Login failed.')
                sys.exit(1)

            players = fetch_stats(page)
        except Exception as exc:
            page.screenshot(path='/tmp/sync-error.png')
            traceback.print_exc()
            raise
        finally:
            browser.close()

    if not players:
        print('[Sync] No player data — sheet not updated.')
        sys.exit(0)

    result = post_to_sheets(players)
    if result.get('ok'):
        print(f'[Sync] Sheet updated — {len(players)} player(s).')
    else:
        print(f'[Sync] Apps Script error: {result}')
        sys.exit(1)

except SystemExit:
    raise
except Exception as exc:
    print(f'ERROR: {exc}')
    traceback.print_exc()
    sys.exit(1)
