@echo off
echo =============================================
echo   CafeteriaMS - Instalador QZ Tray
echo =============================================
echo.

REM 1. Descargar QZ Tray
echo [1/3] Descargando QZ Tray...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/qzind/tray/releases/download/v2.2.6/qz-tray-2.2.6-x86_64.exe' -OutFile '%TEMP%\qz-tray-setup.exe' -UseBasicParsing"
if %errorlevel% neq 0 (
    echo ERROR: No se pudo descargar QZ Tray. Verifica tu conexion a internet.
    pause
    exit /b 1
)

REM 2. Instalar QZ Tray
echo [2/3] Instalando QZ Tray (sigue el asistente)...
"%TEMP%\qz-tray-setup.exe"

REM 3. Importar certificado de confianza
echo [3/3] Configurando certificado CafeteriaMS...
powershell -Command "certutil -addstore -user Root '%~dp0certs\digital-certificate.txt'" >nul 2>&1
if %errorlevel% equ 0 (
    echo Certificado importado correctamente.
) else (
    echo Advertencia: No se pudo importar el certificado automaticamente.
    echo Puedes hacerlo manualmente mas tarde.
)

echo.
echo =============================================
echo   Instalacion completada.
echo   Abre CafeteriaMS en el navegador, intenta
echo   imprimir y selecciona "Allow" + marca
echo   "Remember this decision" en QZ Tray.
echo   Despues de eso nunca volvera a preguntar.
echo =============================================
pause
