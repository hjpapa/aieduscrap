@echo off
setlocal
cd /d "%~dp0.."
set "PATH=%LOCALAPPDATA%\Programs\nodejs;C:\Program Files\Git\cmd;%PATH%"
call npm run dev -- --hostname 127.0.0.1 --port 3000
