@echo off
title Zombie Tiles - Pair Hue bridge
cd /d "%~dp0"
if exist "D:\AI\HomeHub\.venv\Scripts\python.exe" (set "PYEXE=D:\AI\HomeHub\.venv\Scripts\python.exe") else (where py >nul 2>nul && (set "PYEXE=py") || (set "PYEXE=python"))
"%PYEXE%" helper.py --pair --no-browser %*
echo.
pause
