@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Minecraft local server launcher
REM  Starts the management API and Cloudflare Tunnel, then shows the public URL.
REM
REM  Prerequisites (one-time):
REM    pip install flask
REM    winget install Cloudflare.cloudflared   (or download from cloudflare.com/products/tunnel)
REM
REM  Setup:
REM    1. Copy mc_server.env.example → mc_server.env and fill in your values
REM    2. Run this file
REM    3. Copy the "trycloudflare.com" URL shown below
REM    4. Paste it into your repo .env as VITE_MC_LOCAL_API=https://xxxx.trycloudflare.com
REM    5. Rebuild and redeploy the site (git commit + push)
REM ─────────────────────────────────────────────────────────────────────────────

REM Load mc_server.env into this session
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0mc_server.env") do (
    if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
)

if "%MC_JAR_PATH%"=="" (
    echo ERROR: MC_JAR_PATH is not set. Edit mc_server.env first.
    pause
    exit /b 1
)

echo Starting MC API on port %API_PORT%...
start "MC API Server" cmd /c "python "%~dp0mc_server_api.py" 2>&1"

timeout /t 2 /nobreak >nul

echo.
echo Starting Cloudflare Tunnel...
echo The public HTTPS URL will appear below ^(starts with https://...trycloudflare.com^).
echo Copy it and set VITE_MC_LOCAL_API=^<that URL^> in your repo .env, then redeploy.
echo.
cloudflared tunnel --url http://localhost:%API_PORT%

pause
