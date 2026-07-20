@echo off
title PostgreSQL 17 — Diagnose & Start
setlocal enabledelayedexpansion

set "LOG=%TEMP%\pg_start_%DATE:~-4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOG=%LOG: =0%"
echo Starting PostgreSQL 17 Diagnose at %DATE% %TIME% > "%LOG%"

call :main %*

echo.
echo ============================================
echo Script finished. Log saved to:
echo %LOG%
echo ============================================
echo Press any key to exit.
pause >nul
exit /b %ERRORLEVEL%

:main
echo.
echo ============================================
echo    PostgreSQL 17 — Diagnose & Start
echo ============================================
echo.>> "%LOG%"
echo ============================================>> "%LOG%"
echo    PostgreSQL 17 — Diagnose & Start>> "%LOG%"
echo ============================================>> "%LOG%"

set "PG_MAJOR=17"
set "FOUND="
set "PG_BIN="
set "PG_DATA="
set "PG_PORT="

rem ---- 1. Locate PostgreSQL ----
echo.
echo [1/7] Locating PostgreSQL %PG_MAJOR% installation...
echo [1/7] Locating...>> "%LOG%"

for %%p in (
  "C:\Program Files\PostgreSQL\%PG_MAJOR%"
  "C:\Program Files (x86)\PostgreSQL\%PG_MAJOR%"
) do (
  if exist %%p\bin\pg_ctl.exe (
    set "FOUND=%%~p"
    set "PG_BIN=%%~p\bin"
    goto :found_pg
  )
)

for %%i in (pg_ctl.exe) do set "PG_CTL_PATH=%%~$PATH:i"
if defined PG_CTL_PATH (
  for %%i in ("%PG_CTL_PATH%") do set "PG_BIN=%%~dpi"
  set "PG_BIN=!PG_BIN:~0,-1!"
  set "FOUND=!PG_BIN!\.."
  goto :found_pg
)

echo    [FAIL] PostgreSQL %PG_MAJOR% not found.
echo    Install from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
goto :end

:found_pg
echo    [OK] !FOUND!
echo    [OK] !FOUND!>> "%LOG%"
set "PATH=!PG_BIN!;%PATH%"

rem ---- 2. Data directory + port from config ----
echo.
echo [2/7] Locating data directory and config...
echo [2/7] Data directory...>> "%LOG%"

if exist "!FOUND!\data\PG_VERSION" (
  set "PG_DATA=!FOUND!\data"
) else if exist "%ProgramData%\PostgreSQL\%PG_MAJOR%\data\PG_VERSION" (
  set "PG_DATA=%ProgramData%\PostgreSQL\%PG_MAJOR%\data"
) else (
  set "PG_DATA=!FOUND!\data"
)
echo    [OK] !PG_DATA!
echo    [OK] !PG_DATA!>> "%LOG%"

rem Read port from postgresql.conf
set "PG_PORT=5432"
if exist "!PG_DATA!\postgresql.conf" (
  for /f "tokens=1,2 delims== " %%a in ('type "!PG_DATA!\postgresql.conf" ^| findstr /b "port"') do set "PG_PORT=%%b"
)
echo    Port: !PG_PORT! (from postgresql.conf)
echo    Port: !PG_PORT!>> "%LOG%"

rem ---- 3. Stale lock file ----
echo.
echo [3/7] Checking for stale lock files...
echo [3/7] Stale locks...>> "%LOG%"

if exist "!PG_DATA!\postmaster.pid" (
  echo    Found postmaster.pid — removing...
  del /f /q "!PG_DATA!\postmaster.pid"
  if exist "!PG_DATA!\postmaster.pid" (
    echo    [WARN] Could not delete. Run as Administrator.
  ) else (
    echo    [OK] Removed.
  )
) else (
  echo    [OK] None found.
)

rem ---- 4. Check if already running ----
echo.
echo [4/7] Checking if PostgreSQL is already running...
echo [4/7] Already running?...>> "%LOG%"

tasklist /fi "imagename eq postgres.exe" /nh 2>nul | findstr /i postgres >nul
if !errorlevel! equ 0 (
  echo    [OK] postgres.exe process is running.
  echo    [OK] postgres.exe process is running.>> "%LOG%"
  netstat -ano | findstr ":!PG_PORT! " | findstr "LISTENING" >nul 2>&1
  if !errorlevel! equ 0 (
    echo    [OK] Listening on port !PG_PORT!.
    echo    [OK] Listening on port !PG_PORT!.>> "%LOG%"
    goto :verify
  ) else (
    echo    [WARN] Process running but NOT listening on port !PG_PORT!.
    echo    [WARN] Not listening on port !PG_PORT!.>> "%LOG%"
  )
) else (
  echo    [OK] Not running.
  echo    [OK] Not running.>> "%LOG%"
)

rem ---- 5. Kill any process holding the port ----
echo.
echo [5/7] Killing any process on port !PG_PORT!...
echo [5/7] Killing port processes...>> "%LOG%"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":!PG_PORT! " ^| findstr "LISTENING"') do (
  echo    Found PID %%a holding port !PG_PORT! — terminating...
  taskkill /f /pid %%a >nul 2>&1
  if !errorlevel! equ 0 (
    echo    [OK] Killed PID %%a.
    echo    [OK] Killed PID %%a>> "%LOG%"
  ) else (
    echo    [WARN] Could not kill PID %%a. Run as Administrator.
    echo    [WARN] Could not kill PID %%a>> "%LOG%"
  )
)
timeout /t 2 /nobreak >nul

rem ---- 6. Try to start ----
echo.
echo [6/7] Starting PostgreSQL...
echo [6/7] Starting...>> "%LOG%"

rem Check if running as a Windows service
for %%s in ("postgresql-x64-%PG_MAJOR%" "postgresql-%PG_MAJOR%") do (
  sc query "%%~s" >nul 2>&1
  if !errorlevel! equ 0 (
    echo    Service found: %%~s — starting...
    net start "%%~s" 2>&1
    if !errorlevel! equ 0 (
      echo    [OK] Service started.
      goto :verify
    ) else (
      echo    [FAIL] Service could not start. Try as Administrator.
    )
  )
)

rem No service — use pg_ctl
echo    No Windows service found. Using pg_ctl...
if not exist "!PG_DATA!" (
  echo    [FAIL] Data directory not found: !PG_DATA!
  goto :end
)

md "!PG_DATA!\pg_log" 2>nul
"!PG_BIN!\pg_ctl.exe" start -D "!PG_DATA!" -w -t 30 -l "!PG_DATA!\pg_log\startup.log" 2>&1
if !errorlevel! equ 0 (
  echo    [OK] pg_ctl started PostgreSQL.
  echo    [OK] pg_ctl started successfully.>> "%LOG%"
  goto :verify
) else (
  echo    [FAIL] pg_ctl could not start the server.
  echo.
  echo --- Server log (last 15 lines) ---
  if exist "!PG_DATA!\pg_log\startup.log" (
    type "!PG_DATA!\pg_log\startup.log" 2>nul
  ) else if exist "!PG_DATA!\log\postgresql-*.log" (
    for /f "delims=" %%f in ('dir /b /o-d "!PG_DATA!\log\postgresql-*.log" 2^>nul') do (
      type "!PG_DATA!\log\%%f" 2>nul
      goto :log_done
    )
  )
  :log_done
  echo.
  echo Try running this batch file AS ADMINISTRATOR.
  goto :end
)

:verify
echo.
echo [7/7] Verifying connection...
echo [7/7] Verifying...>> "%LOG%"

"!PG_BIN!\pg_isready.exe" -h localhost -p !PG_PORT! 2>&1
if !errorlevel! equ 0 (
  echo.
  echo ============================================
  echo    SUCCESS — PostgreSQL 17 IS RUNNING
  echo ============================================
  echo.
  echo    Host: localhost  Port: !PG_PORT!
  echo    Data: !PG_DATA!
  echo    Bins: !PG_BIN!
  echo.
  echo ============================================>> "%LOG%"
  echo    SUCCESS>> "%LOG%"
) else (
  echo    [FAIL] No response on localhost:!PG_PORT!
)

:end
echo.>> "%LOG%"
echo Script ended at %DATE% %TIME%>> "%LOG%"
exit /b 0
