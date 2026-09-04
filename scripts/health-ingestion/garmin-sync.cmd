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

setlocal
set PYTHONIOENCODING=utf-8
set PYTHON=C:\Users\almpk\AppData\Local\Programs\Python\Python313\python.exe
set HERE=%~dp0
set LOG=D:\backups\garmin-sync.log

echo ===== %date% %time% ===== >> "%LOG%"

if not exist "%PYTHON%" (
  echo   FAILED: python not found at %PYTHON% >> "%LOG%"
  endlocal
  exit /b 1
)

set FAILED=0

"%PYTHON%" "%HERE%ingest_garmin.py" --api >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   FAILED: ingest_garmin.py did not exit cleanly >> "%LOG%"
  set FAILED=1
)

"%PYTHON%" "%HERE%ingest_garmin_wellness.py" --days 7 >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   FAILED: ingest_garmin_wellness.py did not exit cleanly >> "%LOG%"
  set FAILED=1
)

REM A non-zero exit surfaces in the task's LastTaskResult, so a broken sync is
REM visible from Task Scheduler without opening the log.
if "%FAILED%"=="1" (
  endlocal
  exit /b 1
)

echo   OK >> "%LOG%"
endlocal
exit /b 0
