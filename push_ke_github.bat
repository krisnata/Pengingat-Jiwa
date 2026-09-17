@echo off
title Push Pengingat Jiwa ke GitHub
cls
echo =======================================================
echo          UPLOAD KODE KE GITHUB REPOSITORY
echo       https://github.com/krisnata/Pengingat-Jiwa.git
echo =======================================================
echo.
cd /d "%~dp0"

echo Menyiapkan berkas dan commit...
git add .
git commit -m "update: sinkronisasi kode Pengingat Jiwa" 2>nul

echo.
echo Mengunggah ke GitHub (branch main)...
echo.
echo (Jendela otorisasi GitHub di browser akan muncul)
echo.

git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo =======================================================
    echo  BERHASIL! Kode aplikasi telah terunggah ke GitHub:
    echo  https://github.com/krisnata/Pengingat-Jiwa
    echo =======================================================
) else (
    echo =======================================================
    echo  Proses upload memerlukan otorisasi akun GitHub Anda.
    echo =======================================================
)

echo.
pause
