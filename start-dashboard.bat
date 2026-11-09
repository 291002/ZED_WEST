@echo off
cd /d "%~dp0"
echo ZED West dashboard: http://localhost:5186
start "" http://localhost:5186
python serve.py
