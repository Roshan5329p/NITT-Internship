Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  NIT INTERNSHIP: Ti-6Al-4V Additive Manufacturing Platform (Java)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

if (-not (Test-Path "bin")) {
    New-Item -ItemType Directory -Path "bin" | Out-Null
}

Write-Host "[1/2] Compiling Pure Java sources..." -ForegroundColor Yellow
javac -encoding UTF-8 -d bin -sourcepath src src/com/matsci/Main.java src/com/nit/am/AmPlatformApplication.java src/com/nit/am/ProcessWindowPlotter.java src/com/nit/am/physics/*.java src/com/nit/am/util/*.java
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Java compilation failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[2/2] Launching Java Platform and Live Dashboard Server..." -ForegroundColor Green
java -cp bin com.nit.am.AmPlatformApplication --serve
