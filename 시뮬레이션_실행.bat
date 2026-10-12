@echo off
rem Seoul ER simulation launcher: starts the local E-Gen live-bed server and opens the browser.
rem On first run the server asks for the data.go.kr key and saves it to seoul_er_simulation\.env.local (git-ignored).
curl -s -o nul http://localhost:8787/api/health
if not errorlevel 1 (
  start "" http://localhost:8787
  exit /b
)
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ is required: https://nodejs.org
  pause
  exit /b 1
)
chcp 65001 >nul
cd /d "%~dp0seoul_er_simulation"
set OPEN_BROWSER=1
node scripts\8_live_server.js
pause
