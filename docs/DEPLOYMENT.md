# Deployment & Operational Runbook

## 1. Prerequisites

- **Java Development Kit (JDK)**: Version 21 LTS or newer.
- **Operating System**: Windows 10/11, Ubuntu 20.04+, macOS Sonoma+.
- **Network Port**: `8080` (or custom port via `--port <num>`).
- **Dependencies**: None (100% pure Java standard library).

---

## 2. Compilation & Build Process

From the workspace root, compile all Java source files into the `bin/` directory:

```powershell
# Windows PowerShell
javac -encoding UTF-8 -d bin (Get-ChildItem -Recurse -Filter *.java src | Select-Object -ExpandProperty FullName)

# Linux / macOS Bash
javac -encoding UTF-8 -d bin $(find src -name "*.java")
```

---

## 3. Starting the Server

Launch the platform in background server mode:

```powershell
java -cp bin com.nit.am.AmPlatformApplication --serve
```

Expected startup output:
```text
==================================================================
>> Pure Java AM Platform Server is LIVE on: http://localhost:8080
   - Interactive Dashboard:  http://localhost:8080/dashboard
   - Physics Evaluation API: http://localhost:8080/api/evaluate?power=250&speed=1100
   - Melt Pool Physics API:  http://localhost:8080/api/meltpool?model=coen&power=200
   - Bontha Solidification:  http://localhost:8080/api/bontha?dim=3d-bulky&power=200
   - Materials Registry API: http://localhost:8080/api/materials
   - Recipe Synthesis API:   http://localhost:8080/api/recipe?variant=TIV-00001
   - Global Stats API:       http://localhost:8080/api/stats
==================================================================
```

---

## 4. Post-Deployment Verification

Verify system integrity by running the automated regression runner:

```powershell
java -cp bin com.nit.am.util.DashboardVerifier
```

All 14 checks must pass (`14 / 14 Checks Passed - 100% Pure Java Architecture`).

---

## 5. Rollback Procedure

If unexpected behavior occurs:
1. Revert Git working tree: `git checkout HEAD~1 -- process_windows_dashboard.html src/`.
2. Recompile bytecodes: `javac -encoding UTF-8 -d bin ...`.
3. Restart server and re-run `DashboardVerifier`.
