"""
Pulls Minecraft player stats from Aternos via the python-aternos web API
(no FTP needed) and posts them to the Apps Script endpoint.

GitHub Secrets required:
  ATERNOS_USERNAME   (already set for mc-server-start)
  ATERNOS_PASSWORD   (already set for mc-server-start)
  SHEETS_SCRIPT_URL  your deployed Apps Script web app URL ending in /exec
"""

import os
import sys
import json
import traceback
import urllib.request
from datetime import datetime, timezone

from aternos import Client

USERNAME   = os.environ.get('ATERNOS_USERNAME', '')
PASSWORD   = os.environ.get('ATERNOS_PASSWORD', '')
SCRIPT_URL = os.environ.get('SHEETS_SCRIPT_URL', '')
TARGET     = 'pasionabe.aternos.me'

if not all([USERNAME, PASSWORD, SCRIPT_URL]):
    print('ERROR: Missing required environment variables.')
    print(f'  ATERNOS_USERNAME: {"set" if USERNAME   else "MISSING"}')
    print(f'  ATERNOS_PASSWORD: {"set" if PASSWORD   else "MISSING"}')
    print(f'  SHEETS_SCRIPT_URL: {"set" if SCRIPT_URL else "MISSING"}')
    sys.exit(1)


def get_player_name(uuid: str) -> str:
    clean = uuid.replace('-', '')
    try:
        with urllib.request.urlopen(
            f'https://api.mojang.com/user/profile/{clean}', timeout=5
        ) as r:
            return json.loads(r.read()).get('name', uuid[:8])
    except Exception:
        return uuid[:8]


def parse_stats(raw: str | bytes) -> dict:
    data   = json.loads(raw)
    custom = data.get('stats', {}).get('minecraft:custom', {})
    killed = data.get('stats', {}).get('minecraft:killed', {})

    deaths  = int(custom.get('minecraft:deaths', 0))
    kills   = int(custom.get('minecraft:player_kills', 0)
                  or killed.get('minecraft:player', 0))
    # post-1.17 uses play_time; pre-1.17 uses play_one_minute (same unit: ticks)
    ticks   = int(custom.get('minecraft:play_time',
                  custom.get('minecraft:play_one_minute', 0)))
    hours   = round(ticks / 72000, 2)  # 20 ticks/s × 3600 s/hr

    return {'kills': kills, 'deaths': deaths, 'playtime_hours': hours}


try:
    print('[Sync] Logging in to Aternos...')
    client  = Client.from_credentials(USERNAME, PASSWORD)
    servers = client.list_servers()
    server  = next((s for s in servers if TARGET in s.address), servers[0])
    print(f'[Sync] Server: {server.address}')

    # List files in world/stats/
    print('[Sync] Listing world/stats/ ...')
    stat_files = server.list_files('world/stats')

    uuid_files = [f for f in stat_files if str(f).endswith('.json')]
    print(f'[Sync] Found {len(uuid_files)} stat file(s).')

    players  = []
    now_iso  = datetime.now(timezone.utc).isoformat()

    for stat_file in uuid_files:
        filename = str(stat_file).split('/')[-1]
        uuid     = filename.replace('.json', '')
        try:
            content = server.get_file(f'world/stats/{filename}')
            stats   = parse_stats(content)
            name    = get_player_name(uuid)
            k, d, h = stats['kills'], stats['deaths'], stats['playtime_hours']
            print(f'[Sync] {name}: kills={k} deaths={d} hrs={h}')
            players.append({'player_name': name, **stats, 'last_updated': now_iso})
        except Exception as e:
            print(f'[Sync] Skipping {uuid}: {e}')

    if not players:
        print('[Sync] No player data found.')
        sys.exit(0)

    # Post to Apps Script
    body = json.dumps({'action': 'updateMcPlayerStats', 'stats': players}).encode()
    req  = urllib.request.Request(
        SCRIPT_URL,
        data=body,
        headers={'Content-Type': 'text/plain;charset=utf-8'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        if result.get('ok'):
            print(f'[Sync] Sheet updated — {len(players)} player(s).')
        else:
            print(f'ERROR: Apps Script returned: {result}')
            sys.exit(1)

except Exception as e:
    print(f'ERROR: {e}')
    traceback.print_exc()
    sys.exit(1)
