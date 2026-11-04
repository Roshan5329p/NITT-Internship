@echo off
title Ti-6Al-4V AM Platform - NIT Internship
echo ==================================================================
echo   NIT INTERNSHIP: Ti-6Al-4V Additive Manufacturing Platform (Java)
echo ==================================================================
if not exist "bin" mkdir bin
echo [1/2] Compiling Pure Java sources...
javac -encoding UTF-8 -d bin -sourcepath src src/com/matsci/Main.java src/com/nit/am/AmPlatformApplication.java src/com/nit/am/ProcessWindowPlotter.java
if %errorlevel% neq 0 (
    echo [ERROR] Java compilation failed!
    pause
    exit /b %errorlevel%
)
echo [2/2] Launching Java Platform and Live Dashboard Server...
java -cp bin com.nit.am.AmPlatformApplication --serve
pause
