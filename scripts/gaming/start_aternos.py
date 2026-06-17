"""
Triggered by GitHub Actions (start-mc-server.yml).
Reads ATERNOS_USERNAME / ATERNOS_PASSWORD from environment (GitHub Secrets)
and starts the first server on the account.
"""

import os
import sys
import time
import traceback

from aternos import Client, ServerStatus

username = os.environ.get('ATERNOS_USERNAME', '')
password = os.environ.get('ATERNOS_PASSWORD', '')
player   = os.environ.get('PLAYER_NAME', 'unknown')

if not username or not password:
    print('ERROR: ATERNOS_USERNAME or ATERNOS_PASSWORD not set in GitHub Secrets.')
    sys.exit(1)

print(f'[MC] Server start requested by: {player}')

TARGET = 'pasionabe.aternos.me'

try:
    print('[MC] Logging in to Aternos...')
    client  = Client.from_credentials(username, password)
    servers = client.list_servers()
    print(f'[MC] Found {len(servers)} server(s) on account.')

    if not servers:
        print('ERROR: No Aternos servers found on this account.')
        sys.exit(1)

    server = next((s for s in servers if TARGET in s.address), servers[0])
    print(f'[MC] Target server: {server.address}  status={server.status}')

    if server.status in (ServerStatus.ON, ServerStatus.STARTING, ServerStatus.LOADING):
        print(f'[MC] Server is already {server.status} — nothing to do.')
        sys.exit(0)

    print('[MC] Sending start command...')
    server.start()
    print('[MC] Start command sent. Waiting 5s to confirm status change...')

    time.sleep(5)
    # Refresh server state and log final status
    try:
        servers2 = client.list_servers()
        server2  = next((s for s in servers2 if TARGET in s.address), servers2[0])
        print(f'[MC] Status after start: {server2.status}')
    except Exception:
        print('[MC] Could not re-fetch status (non-fatal).')

    print('[MC] Done.')

except Exception as e:
    print(f'ERROR: {e}')
    traceback.print_exc()
    sys.exit(1)
