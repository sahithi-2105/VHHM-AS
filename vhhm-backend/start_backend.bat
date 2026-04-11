@echo off
set "PYTHON_PATH=C:\Users\sahit_8xxavm7\AppData\Local\Programs\Python\Python312\python.exe"

echo [VHHM-AS] Initializing Backend...
if not exist "%PYTHON_PATH%" (
    echo [ERROR] Python not found at %PYTHON_PATH%. Please update the path in start_backend.bat.
    pause
    exit /b 1
)

echo [VHHM-AS] Installing dependencies...
"%PYTHON_PATH%" -m pip install -r requirements.txt

echo [VHHM-AS] Starting FastAPI Backend on http://localhost:8000...
"%PYTHON_PATH%" -m app.main
pause
