"""
Local Minecraft server management API.
Run this on the same machine as your Minecraft server.
Expose it to the internet via Cloudflare Tunnel (see start_local.bat / start_local.sh).

Endpoints:
  GET  /status  — is the server running?
  POST /start   — start the server process
  POST /stop    — stop the server gracefully
  GET  /stats   — read player stats from world/stats/*.json

Configuration (set in mc_server.env or as environment variables):
  MC_JAR_PATH    path to your server.jar
  MC_WORLD_PATH  path to world folder (default: <jar_dir>/world)
  MC_JVM_ARGS    JVM flags (default: -Xmx2G -Xms1G)
  MC_API_TOKEN   secret token — also set as VITE_MC_API_TOKEN in .env
  MC_PORT        Minecraft port (default: 25565)
  API_PORT       port this API listens on (default: 8080)
"""

import glob
import json
import os
import socket
import subprocess
import urllib.request
from pathlib import Path

from flask import Flask, jsonify, request, abort

app = Flask(__name__)

MC_JAR_PATH   = os.environ.get('MC_JAR_PATH', '')
MC_WORLD_PATH = os.environ.get('MC_WORLD_PATH', '')
MC_JVM_ARGS   = os.environ.get('MC_JVM_ARGS', '-Xmx2G -Xms1G')
MC_API_TOKEN  = os.environ.get('MC_API_TOKEN', '')
MC_PORT       = int(os.environ.get('MC_PORT', '25565'))
API_PORT      = int(os.environ.get('API_PORT', '8080'))

_server_process = None


# ── Auth ──────────────────────────────────────────────────────────────────────

def require_auth():
    if not MC_API_TOKEN:
        return
    auth = request.headers.get('Authorization', '')
    if auth != f'Bearer {MC_API_TOKEN}':
        abort(401)


# ── CORS (needed because the PWA origin differs from the tunnel URL) ──────────

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def options_preflight(path):
    return app.make_default_options_response()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _port_open(port: int) -> bool:
    try:
        with socket.create_connection(('localhost', port), timeout=2):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def _server_running() -> bool:
    global _server_process
    if _server_process and _server_process.poll() is None:
        return True
    return _port_open(MC_PORT)


def _world_stats_dir() -> str:
    world = MC_WORLD_PATH or str(Path(MC_JAR_PATH).parent / 'world')
    return str(Path(world) / 'stats')


def _get_player_name(uuid: str) -> str:
    clean = uuid.replace('-', '')
    try:
        with urllib.request.urlopen(
            f'https://api.mojang.com/user/profile/{clean}', timeout=5
        ) as r:
            return json.loads(r.read()).get('name', uuid[:8])
    except Exception:
        return uuid[:8]


def _parse_stats(raw: str) -> dict:
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


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get('/status')
def status():
    running = _server_running()
    return jsonify({'online': running, 'port': MC_PORT})


@app.post('/start')
def start():
    require_auth()
    global _server_process

    if _server_running():
        return jsonify({'ok': True, 'message': 'already running'})

    if not MC_JAR_PATH or not Path(MC_JAR_PATH).exists():
        return jsonify({'ok': False, 'error': f'MC_JAR_PATH not found: {MC_JAR_PATH!r}'}), 500

    jar_dir = str(Path(MC_JAR_PATH).parent)
    jvm_args = MC_JVM_ARGS.split()
    cmd = ['java'] + jvm_args + ['-jar', Path(MC_JAR_PATH).name, 'nogui']

    _server_process = subprocess.Popen(
        cmd,
        cwd=jar_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    player = (request.get_json(silent=True) or {}).get('playerName', 'unknown')
    print(f'[API] Server started by {player!r} — PID {_server_process.pid}')
    return jsonify({'ok': True, 'pid': _server_process.pid})


@app.post('/stop')
def stop():
    require_auth()
    global _server_process

    if _server_process and _server_process.poll() is None:
        _server_process.terminate()
        _server_process = None
        return jsonify({'ok': True})

    return jsonify({'ok': False, 'error': 'server not running via this API'})


@app.get('/stats')
def stats():
    stats_dir = _world_stats_dir()
    if not os.path.isdir(stats_dir):
        return jsonify([])

    players = []
    for json_file in glob.glob(os.path.join(stats_dir, '*.json')):
        uuid = os.path.splitext(os.path.basename(json_file))[0]
        try:
            with open(json_file, encoding='utf-8') as fh:
                s = _parse_stats(fh.read())
            name = _get_player_name(uuid)
            players.append({
                'player_name':    name,
                'kills':          s['kills'],
                'deaths':         s['deaths'],
                'playtime_hours': s['playtime_hours'],
                'last_updated':   os.path.getmtime(json_file),
            })
        except Exception as exc:
            print(f'[API] Skipping {uuid}: {exc}')

    players.sort(key=lambda p: p['playtime_hours'], reverse=True)
    return jsonify(players)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if not MC_JAR_PATH:
        print('WARNING: MC_JAR_PATH not set — /start will fail.')
    print(f'[API] Listening on http://0.0.0.0:{API_PORT}')
    app.run(host='0.0.0.0', port=API_PORT, debug=False)
