@echo off
title Pengingat Jiwa - Puskesmas Sesela
cls
echo =================================================================
echo        SISTEM PENGINGAT JADWAL KONTROL ^& OBAT ODGJ
echo              UPTD BLUD PUSKESMAS SESELA
echo     Berdasarkan UU No. 17/2023 ^& Standar Pelayanan Minimal (SPM)
echo =================================================================
echo.
echo Menyiapkan dan menjalankan aplikasi...

:: Cari runtime node yang tersedia di sistem
set "RUNNER="

if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    set "RUNNER=%APPDATA%\Antigravity\bin\agy-node.cmd"
) else (
    where node >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "RUNNER=node"
    )
)

if "%RUNNER%"=="" (
    echo [ERROR] Runtime Node.js tidak ditemukan!
    echo Pastikan Node.js atau Antigravity terpasang di komputer ini.
    pause
    exit /b 1
)

:: Pindah ke folder kerja saat ini
cd /d "%~dp0"

:: Bersihkan proses zombie lama yang mungkin masih mengunci port 3000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo Menggunakan runtime: %RUNNER%
echo Memulai server di http://localhost:3000 ...
echo Browser akan terbuka secara otomatis begitu server siap.
echo.

call "%RUNNER%" server.js

pause
