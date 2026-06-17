"""
Starts Aternos server using Playwright browser automation.

GitHub Secrets required:
  ATERNOS_USERNAME
  ATERNOS_PASSWORD
"""
import os, sys, time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

USERNAME = os.environ.get('ATERNOS_USERNAME', '')
PASSWORD = os.environ.get('ATERNOS_PASSWORD', '')
PLAYER   = os.environ.get('PLAYER_NAME', 'unknown')

if not USERNAME or not PASSWORD:
    print('ERROR: ATERNOS_USERNAME or ATERNOS_PASSWORD not set.')
    sys.exit(1)

print(f'[MC] Start requested by: {PLAYER}')

USERNAME_SELECTORS = [
    'input[name="username"]', '#user', '[autocomplete="username"]',
    'input[type="text"]', '.login-username',
]
PASSWORD_SELECTORS = [
    'input[type="password"]', 'input[name="password"]',
    '#password', '[autocomplete="current-password"]',
]
SUBMIT_SELECTORS = [
    'button[type="submit"]', '#login-button', 'input[type="submit"]',
    '.btn-login', 'button.btn',
]
STATUS_SELECTORS  = ['.statuslabel-label', '.server-status', '.status-label']
START_SELECTORS   = ['#start-button', '.btn-start', '[data-id="start"]', 'button.start']


def find_selector(page, selectors, timeout_ms=3000, state='visible'):
    for sel in selectors:
        try:
            page.wait_for_selector(sel, state=state, timeout=timeout_ms)
            return sel
        except Exception:
            pass
    return None


def login(page):
    page.goto('https://aternos.org/go/', wait_until='domcontentloaded', timeout=30_000)

    # Wait for Cloudflare to pass — try up to 30 s
    username_sel = None
    for delay in [5, 10, 15]:
        time.sleep(delay)
        page.screenshot(path=f'/tmp/login-wait-{delay}.png')
        username_sel = find_selector(page, USERNAME_SELECTORS, timeout_ms=3000)
        if username_sel:
            break
    with open('/tmp/login-page.html', 'w', errors='replace') as f:
        f.write(page.content()[:50_000])

    if not username_sel:
        print(f'[MC] Login form not found. URL={page.url}')
        return False

    password_sel = find_selector(page, PASSWORD_SELECTORS)
    if not password_sel:
        print('[MC] Password field not found.')
        return False

    page.fill(username_sel, USERNAME)
    page.fill(password_sel, PASSWORD)
    page.screenshot(path='/tmp/login-filled.png')

    submit_sel = find_selector(page, SUBMIT_SELECTORS)
    if submit_sel:
        page.click(submit_sel)
    else:
        page.keyboard.press('Enter')

    try:
        page.wait_for_url(
            lambda url: 'aternos.org' in url and '/go/' not in url,
            timeout=25_000,
        )
        page.screenshot(path='/tmp/login-success.png')
        print(f'[MC] Logged in — {page.url}')
        return True
    except PWTimeout:
        page.screenshot(path='/tmp/login-failed.png')
        print(f'[MC] Login redirect timed out. URL={page.url}')
        return False


def start_server(page):
    # Navigate to server if not already there
    if '/server' not in page.url:
        page.goto('https://aternos.org/servers', wait_until='networkidle', timeout=20_000)
        page.screenshot(path='/tmp/server-list.png')
        server_sel = find_selector(page, ['.server-body', '.server', 'a[href*="/server"]'])
        if server_sel:
            page.click(server_sel)
            page.wait_for_url('**/server**', timeout=15_000)

    time.sleep(2)
    page.screenshot(path='/tmp/server-page.png')

    status_sel = find_selector(page, STATUS_SELECTORS, timeout_ms=5000)
    status = page.text_content(status_sel, timeout=3000).strip() if status_sel else ''
    print(f'[MC] Status: {status!r}')

    if any(s in status.lower() for s in ['online', 'starting', 'loading', 'preparing']):
        print('[MC] Server is already running.')
        return True

    start_sel = find_selector(page, START_SELECTORS, timeout_ms=5000)
    if not start_sel:
        print('[MC] Start button not found.')
        page.screenshot(path='/tmp/no-start-button.png')
        return False

    page.click(start_sel)
    time.sleep(3)
    page.screenshot(path='/tmp/after-start.png')

    status_after = ''
    if status_sel:
        try:
            status_after = page.text_content(status_sel, timeout=3000).strip()
        except Exception:
            pass
    print(f'[MC] Status after click: {status_after!r}')
    print('[MC] Start command sent.')
    return True


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800',
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
        page = ctx.new_page()

        try:
            if not login(page):
                return False
            return start_server(page)
        except PWTimeout as e:
            page.screenshot(path='/tmp/timeout.png')
            print(f'[MC] Timeout: {e}')
            return False
        except Exception as e:
            page.screenshot(path='/tmp/error.png')
            print(f'[MC] Error: {e}')
            return False
        finally:
            browser.close()


if run():
    print('[MC] Done.')
else:
    print('[MC] Failed — download the uploaded screenshots artifact to diagnose.')
    sys.exit(1)
