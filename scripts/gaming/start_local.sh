#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Minecraft local server launcher (Linux / macOS)
#  Starts the management API and Cloudflare Tunnel.
#
#  Prerequisites (one-time):
#    pip install flask
#    # Linux:
#    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
#         -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
#    # macOS:
#    brew install cloudflare/cloudflare/cloudflared
#
#  Setup:
#    1. Copy mc_server.env.example → mc_server.env and fill in your values
#    2. chmod +x start_local.sh && ./start_local.sh
#    3. Copy the "trycloudflare.com" URL shown
#    4. Set VITE_MC_LOCAL_API=https://xxxx.trycloudflare.com in your repo .env
#    5. Rebuild and redeploy (git commit + push)
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/mc_server.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy mc_server.env.example → mc_server.env first."
  exit 1
fi

# Load env file (skip comments and blank lines)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "$MC_JAR_PATH" ]; then
  echo "ERROR: MC_JAR_PATH is not set. Edit mc_server.env first."
  exit 1
fi

API_PORT="${API_PORT:-8080}"

echo "Starting MC API on port $API_PORT..."
python "$SCRIPT_DIR/mc_server_api.py" &
API_PID=$!
echo "MC API running (PID $API_PID)"

sleep 2

echo ""
echo "Starting Cloudflare Tunnel..."
echo "The public HTTPS URL will appear below."
echo "Copy it and set VITE_MC_LOCAL_API=<that URL> in your repo .env, then redeploy."
echo ""
cloudflared tunnel --url "http://localhost:$API_PORT"

# Cleanup when tunnel exits
kill "$API_PID" 2>/dev/null || true
