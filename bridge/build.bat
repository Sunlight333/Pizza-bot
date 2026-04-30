@echo off
REM Build a single self-installing bridge.exe.
REM Run from Windows cmd.exe inside the bridge\ directory.

python -m pip install --upgrade pip || goto :err
python -m pip install httpx==0.28.1 pyinstaller==6.11.1 || goto :err

REM Use "python -m PyInstaller" so we don't depend on PATH.
python -m PyInstaller --onefile --console --name bridge ^
    --hidden-import firebird_reader ^
    bridge_service.py || goto :err

echo.
echo ============================================================
if exist dist\bridge.exe (
    echo  Pronto! O instalador esta em:
    echo      %CD%\dist\bridge.exe
    echo  Envie este unico arquivo para o cliente.
) else (
    echo  ERRO: dist\bridge.exe nao foi gerado.
)
echo ============================================================
pause
exit /b 0

:err
echo.
echo ============================================================
echo  ERRO durante o build. Veja as mensagens acima.
echo ============================================================
pause
exit /b 1
