@echo off
chcp 65001 >nul
rem 서울 응급실 시뮬레이션 실행: 로컬 서버(E-Gen 실시간 병상)를 켜고 브라우저를 연다.
rem 인증키는 seoul_er_simulation\.env.local 의 EGEN_SERVICE_KEY=... 줄에서 읽는다(커밋 금지).
curl -s -o nul http://localhost:8787/api/health && (
  echo 서버가 이미 켜져 있습니다. 브라우저만 엽니다.
  start "" http://localhost:8787
  exit /b
)
where node >nul 2>&1 || (echo Node.js 18 이상이 필요합니다: https://nodejs.org & pause & exit /b 1)
cd /d "%~dp0seoul_er_simulation"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8787"
node scripts\8_live_server.js
pause
