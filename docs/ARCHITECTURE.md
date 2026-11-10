# Architecture Specification

## 1. System Overview

The **NIT Trichy Titanium Additive Manufacturing Platform** is engineered as a zero-dependency, ultra-lightweight, high-performance Pure Java application. It unifies analytical thermo-kinetic simulation engines, empirical literature databases, publication-grade chart rendering, and an interactive single-page dashboard.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Standalone Interactive Browser Client                    │
│   (process_windows_dashboard.html: 60 FPS Canvas, SVG Isotherms, ES6 Math)   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTP / REST APIs (Port 8080)
┌─────────────────────────────────────▼───────────────────────────────────────┐
│              Pure Java AM Platform Server (AmPlatformApplication)           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Embedded HTTP Server (com.sun.net.httpserver.HttpServer)            │   │
│   │ - Static Dashboard Server (/dashboard, /)                          │   │
│   │ - REST API Router (/api/stats, /api/evaluate, /api/meltpool, etc.)  │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│   ┌──────────────────────────────────▼──────────────────────────────────┐   │
│   │ Scientific Physics & Metallurgical Engines                          │   │
│   │ - KU Leuven Hybrid Melt Pool (Coen et al. 2022)                     │   │
│   │ - Rosenthal 3D Analytical Moving Point Source                       │   │
│   │ - Bontha et al. (2006, 2009) 2D/3D Solidification (Bessel Engine)  │   │
│   │ - VED Multi-Route Solver & Defect Windows                           │   │
│   │ - Koistinen-Marburger Kinetics & ASTM F2924 Yield/UTS Predictor     │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│   ┌──────────────────────────────────▼──────────────────────────────────┐   │
│   │ Java2D Publication Plot Generation Engine (/plots/*.png)            │   │
│   │ - Defect Processing Window Plot                                     │   │
│   │ - ASTM Ashby Qualification Map                                      │   │
│   │ - VED vs Density Tradeoff Plot                                      │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ Dual-Persistence Layer
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     Local CSV Datasets        │             │    Supabase Cloud Database    │
│  (data/*.csv: 54 papers,      │ ◄─────────► │ (PostgreSQL: 6 core tables    │
│   289 variants, 6 tables)     │   REST Sync │  via HTTPS REST endpoint)     │
└───────────────────────────────┘             └───────────────────────────────┘
```

---

## 2. Architecture Patterns & Design Decisions

### A. Zero External Framework Overhead
Rather than utilizing heavy frameworks (e.g., Spring Boot, Tomcat, Node.js, Python Flask/FastAPI), the backend leverages the standard library `com.sun.net.httpserver.HttpServer` bundled with Java 21+. This yields instantaneous cold startup (<150 ms) and a tiny memory footprint (<35 MB RAM).

### B. Single Source of Truth
The separate Vite React development server has been completely excised. The client is delivered as a unified, standalone HTML document (`process_windows_dashboard.html`) containing high-speed vanilla JavaScript physics implementations that match the server-side Java algorithms bit-for-bit.

### C. Dual-Persistence Synchronization
1. **Local CSV**: Instantaneous offline loading from `data/papers.csv`, `data/process_parameters.csv`, `data/thermal_physics.csv`, `data/microstructure.csv`, `data/mechanical_properties.csv`, and `data/predictions_and_models.csv`.
2. **Cloud Supabase**: Real-time cloud persistence via Supabase PostgreSQL (`iismzfileyuvqgdpivgx.supabase.co`).

---

## 3. Technology Stack

- **Core Backend Language**: Java 21 LTS
- **Build & Compilation**: Standard `javac` compiler (`javac -d bin src/com/nit/am/**/*.java`)
- **Embedded Web Server**: `com.sun.net.httpserver.HttpServer`
- **Graphics & Plotting**: Java2D (`java.awt.Graphics2D`, `java.awt.image.BufferedImage`)
- **Database Engine**: PostgreSQL on Supabase + Local RFC-4180 CSVs
- **Frontend Engine**: Vanilla ES6+ JavaScript, HTML5 Canvas API, Inline Scalable Vector Graphics (SVG)
- **Math & Physics**: Numerical integration, modified Bessel functions of the second kind ($K_0, K_1$), Eagar-Tsai conduction theory, and Fabbro recoil pressure scaling.

---

## 4. Directory Structure

```text
NIT Internship Project/
│
├── bin/                             # Compiled Java bytecodes
│   └── com/nit/am/...
│
├── data/                            # 6 Core Empirical Datasets
│   ├── papers.csv                   # 54 peer-reviewed publications
│   ├── process_parameters.csv       # Machine parameters for 289 variants
│   ├── thermal_physics.csv          # Melt pool dimensions & cooling rates
│   ├── microstructure.csv           # Phase fractions, grain & lath sizes
│   ├── mechanical_properties.csv    # Hardness, UTS, yield, elongation
│   └── predictions_and_models.csv   # Validation model outputs
│
├── docs/                            # Vibe Coding Documentation Suite
│   ├── PRD.md
│   ├── DESIGN_SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   └── ...
│
├── plots/                           # Generated Java2D Publication Figures
│   ├── ti64_lpbf_defect_processing_window.png
│   ├── ti64_astm_qualification_ashby_map.png
│   └── ti64_energy_density_density_tradeoff.png
│
├── src/com/nit/am/                  # Java Platform Source Code
│   ├── AmPlatformApplication.java   # HTTP Server & Master Application Entry
│   ├── data/
│   │   ├── CsvDataLoader.java       # High-speed CSV parsing
│   │   └── SupabaseClient.java      # Supabase cloud REST sync
│   ├── model/                       # Data transfer objects
│   ├── physics/                     # Mathematical simulation engines
│   │   ├── MeltPoolSimulator.java   # KU Leuven & Rosenthal models
│   │   ├── BonthaEngine.java        # Bessel-driven 2D/3D solidification
│   │   └── VedSolver.java           # Multi-route parameter solver
│   ├── plot/
│   │   └── Java2DPlotEngine.java    # Automated chart generation
│   └── util/
│       └── DashboardVerifier.java   # Automated 14-point regression runner
│
├── process_windows_dashboard.html   # Main Standalone Interactive Dashboard
└── README.md
```

---

## 5. Data Flow

1. **User Interaction**: User shifts Laser Power ($P$) slider on `process_windows_dashboard.html`.
2. **Client Physics Loop**:
   - `onSliderChange()` fires immediately.
   - `calculatePhysics()` recomputes VED, Rosenthal dimensions, cooling rates, and defect indices.
   - `updateMeltPoolAndThermal()` computes KU Leuven hybrid dimensions, liquidus/mushy/HAZ isotherms, and updates SVG visuals.
   - `renderBonthaSolidificationPhysics()` solves Bessel equations and animates radar cursor to $(R, G)$ coordinates.
3. **Server-Side REST Verification**:
   - Client or external API consumers can request `GET /api/evaluate?power=280&speed=960`.
   - `AmPlatformApplication` runs identical Java physics methods and returns JSON telemetry within 2 ms.
4. **Cloud Synchronization**:
   - `SupabaseClient` pushes custom evaluated variants to Supabase cloud tables.

---

## 6. Failure Scenarios & Fault Tolerance

- **Network / Cloud Supabase Outage**: The platform transparently operates 100% offline using local CSV datasets with zero degradation in simulation capabilities.
- **Extreme / Unphysical Input Values**: Process parameter inputs are strictly clamped to physical boundaries ($P \le 5000\text{ W}$, $v \ge 1\text{ mm/s}$) to prevent arithmetic divide-by-zero or numerical divergence in Bessel functions.
- **Port Conflicts**: Server automatically logs diagnostic messages if port 8080 is in use, enabling graceful termination and restart.
