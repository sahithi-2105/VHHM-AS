@echo off
echo Starting VHHM-AS Services...

:: Start Backend in a new window
echo Starting Backend...
cd "%~dp0vhhm-backend"
start "VHHM-AS Backend" cmd.exe /k "start_backend.bat"

:: Start Frontend in a new window
echo Starting Frontend...
cd "%~dp0vhhm-frontend"
start "VHHM-AS Frontend" cmd.exe /k "npm run dev"

echo Both services have been launched in separate terminal windows!
pause
