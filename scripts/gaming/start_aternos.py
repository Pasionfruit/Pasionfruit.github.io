"""
Triggered by GitHub Actions (start-mc-server.yml).
Reads ATERNOS_USERNAME / ATERNOS_PASSWORD from environment (GitHub Secrets)
and starts the first server on the account.
"""

import os
import sys
from aternos import Client, ServerStatus

username = os.environ.get('ATERNOS_USERNAME', '')
password = os.environ.get('ATERNOS_PASSWORD', '')
player   = os.environ.get('PLAYER_NAME', 'unknown')

if not username or not password:
    print('ERROR: ATERNOS_USERNAME or ATERNOS_PASSWORD not set in GitHub Secrets.')
    sys.exit(1)

print(f'[MC] Server start requested by: {player}')

TARGET = 'pasionabe.aternos.me'

client  = Client.from_credentials(username, password)
servers = client.list_servers()

if not servers:
    print('ERROR: No Aternos servers found on this account.')
    sys.exit(1)

server = next((s for s in servers if TARGET in s.address), servers[0])
print(f'[MC] Found server: {server.address}  status={server.status}')

if server.status in (ServerStatus.ON, ServerStatus.STARTING, ServerStatus.LOADING):
    print('[MC] Server is already online or starting — nothing to do.')
    sys.exit(0)

server.start()
print('[MC] Start command sent successfully.')
