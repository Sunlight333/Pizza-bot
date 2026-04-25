@echo off
REM Build bridge.exe using PyInstaller.
REM Run from Windows cmd.exe inside the bridge/ directory.

python -m pip install -r requirements.txt
pyinstaller --onefile --name bridge --console bridge_service.py

echo.
echo Build complete. Copy dist\bridge.exe to the pizzeria PC
echo along with config.ini and the bundled tax_cache.json (if any).
pause
