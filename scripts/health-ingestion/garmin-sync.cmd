@echo off
REM Daily Garmin sync, run by the "GarminDailySync" scheduled task.
REM
REM Runs locally on purpose. Garmin answers datacenter IPs with 429, which is
REM why the GitHub Actions workflow was retired in 4edbacd — a residential IP
REM is the whole point, so this belongs on the desktop and not in the cloud.
REM
REM Every path resolves from this file's own location (%~dp0). The previous
REM version hard-coded the repo at Desktop\Life\Vibing; when the repo moved to
REM Projects\ the task went on firing at 09:30 for five days, writing nothing
REM but "No such file or directory" into a log nobody reads. Living inside the
REM repo means the scripts can never drift away from their launcher again.
REM
REM Wellness runs with --days 7 so a few missed days heal themselves on the
REM next successful run rather than leaving permanent holes in the sheet.
REM
REM The task launches this as "conhost.exe --headless cmd.exe /c ..." so no
REM blank console window pops up and steals focus at 09:00 and 21:00.
REM
REM   garmin-sync.cmd --test-alert    send a test failure alert, then exit
REM
REM Keep CRLF line endings: with LF-only, cmd can miss the labels below.

setlocal
set PYTHONIOENCODING=utf-8
set PYTHON=C:\Users\almpk\AppData\Local\Programs\Python\Python313\python.exe
set HERE=%~dp0
set LOG=D:\backups\garmin-sync.log
REM The ntfy topic is the homelab's (shared with Grafana and the update
REM checks). It is read from there at run time so it never lands in this
REM public repo.
set NTFY_ENV=D:\homelab\monitoring\.env

if /i "%~1"=="--test-alert" goto :test_alert

echo ===== %date% %time% ===== >> "%LOG%"

if not exist "%PYTHON%" (
  echo   FAILED: python not found at %PYTHON% >> "%LOG%"
  call :alert "python not found at %PYTHON%"
  endlocal
  exit /b 1
)

set FAILED=

"%PYTHON%" "%HERE%ingest_garmin.py" --api >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   FAILED: ingest_garmin.py did not exit cleanly >> "%LOG%"
  set FAILED=%FAILED% ingest_garmin.py
)

"%PYTHON%" "%HERE%ingest_garmin_wellness.py" --days 7 >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   FAILED: ingest_garmin_wellness.py did not exit cleanly >> "%LOG%"
  set FAILED=%FAILED% ingest_garmin_wellness.py
)

REM conhost exits 0 whatever this script returns, so the task's LastTaskResult
REM reads 0 even on a failed run. The ntfy alert is what makes a broken sync
REM visible without opening the log; the exit code only matters by hand.
if defined FAILED (
  call :alert "Failed:%FAILED%. Details in %LOG%"
  endlocal
  exit /b 1
)

echo   OK >> "%LOG%"
endlocal
exit /b 0


:test_alert
echo ===== %date% %time% ===== --test-alert >> "%LOG%"
call :alert "Test: a failed run will look like this."
if not defined SENT (
  echo Not sent, see the end of %LOG%
  endlocal
  exit /b 1
)
echo Sent.
endlocal
exit /b 0


REM Posts %1 to ntfy and sets SENT when ntfy accepts it. A send that fails is
REM logged and never changes the run's own result.
:alert
set SENT=
set TOPIC=
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"NTFY_TOPIC=" "%NTFY_ENV%" 2^>nul') do set TOPIC=%%B
if not defined TOPIC (
  echo   ALERT NOT SENT: no NTFY_TOPIC in %NTFY_ENV% >> "%LOG%"
  exit /b 0
)
"%SystemRoot%\System32\curl.exe" -sSf -o nul -m 15 -H "Title: Garmin sync failed" -H "Tags: warning" -d %1 "https://ntfy.sh/%TOPIC%" 2>> "%LOG%"
if errorlevel 1 (
  echo   ALERT NOT SENT: ntfy.sh did not accept it >> "%LOG%"
  exit /b 0
)
set SENT=1
exit /b 0
