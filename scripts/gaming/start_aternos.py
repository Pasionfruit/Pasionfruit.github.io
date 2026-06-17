"""
Starts Aternos server using Playwright browser automation.
Handles Cloudflare and the full Aternos login + start flow.

GitHub Secrets required:
  ATERNOS_USERNAME  your Aternos login email/username
  ATERNOS_PASSWORD  your Aternos password
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

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        )
        ctx  = browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1280, 'height': 800},
        )
        page = ctx.new_page()

        try:
            # ── Login ────────────────────────────────────────────────────────
            print('[MC] Opening Aternos login page...')
            page.goto('https://aternos.org/go/', wait_until='domcontentloaded', timeout=30_000)
            time.sleep(2)  # let Cloudflare settle

            page.screenshot(path='/tmp/step1-login.png')
            print('[MC] Filling credentials...')
            page.fill('input[name="username"], #user', USERNAME, timeout=10_000)
            page.fill('input[name="password"], #password', PASSWORD, timeout=10_000)
            page.click('button[type="submit"], #login-button', timeout=10_000)

            # ── Wait for server list ─────────────────────────────────────────
            print('[MC] Waiting for server list...')
            page.wait_for_url('**/servers**', timeout=20_000)
            page.screenshot(path='/tmp/step2-servers.png')

            # ── Click first server ───────────────────────────────────────────
            print('[MC] Clicking server...')
            page.click('.server-body, .server', timeout=10_000)
            page.wait_for_url('**/server**', timeout=15_000)
            time.sleep(2)
            page.screenshot(path='/tmp/step3-server.png')

            # ── Check status ─────────────────────────────────────────────────
            status = page.text_content('.statuslabel-label, .server-status', timeout=5_000) or ''
            print(f'[MC] Status: {status.strip()}')

            if any(s in status.lower() for s in ['online', 'starting', 'loading', 'preparing']):
                print('[MC] Server is already running.')
                return True

            # ── Click Start ──────────────────────────────────────────────────
            print('[MC] Clicking Start...')
            page.click('#start-button, .btn-start, [data-id="start"]', timeout=10_000)
            time.sleep(3)
            page.screenshot(path='/tmp/step4-after-start.png')

            status_after = page.text_content('.statuslabel-label, .server-status', timeout=5_000) or ''
            print(f'[MC] Status after start: {status_after.strip()}')
            print('[MC] Start command sent.')
            return True

        except PWTimeout as e:
            print(f'[MC] Timeout: {e}')
            page.screenshot(path='/tmp/error.png')
            return False
        except Exception as e:
            print(f'[MC] Error: {e}')
            page.screenshot(path='/tmp/error.png')
            return False
        finally:
            browser.close()

if run():
    print('[MC] Done.')
else:
    print('[MC] Failed to start server — check /tmp/*.png screenshots in the Actions log.')
    sys.exit(1)
