@echo off
"%~dp0node.exe" "%~dp0server.cjs"
if errorlevel 1 pause
