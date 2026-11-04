# NIT Internship Project: Additive Manufacturing of Titanium Alloy (Ti-6Al-4V)

A pure Java scientific modeling, materials informatics, and defect prediction platform for Additive Manufacturing (AM) of **Ti-6Al-4V** (Grade 5) and **Ti-6Al-4V ELI** (Grade 23).

---

## 🔬 Core Scope: The 4 Designated AM Processes

In strict accordance with the project research roadmap, the system focuses exclusively on the **four fundamental Additive Manufacturing processes** and their post-processing regimes:

1. **LPBF (Laser Powder Bed Fusion / SLM / DMLS)**
   - High cooling rates ($10^5 - 10^6\text{ K/s}$), yielding fine acicular $\alpha'$ martensite.
   - Optimal volumetric energy density window: $55 \leq E_v \leq 95\text{ J/mm}^3$.
2. **DED (Directed Energy Deposition — Powder & Wire LENS)**
   - Moderate cooling rates ($10^3 - 10^4\text{ K/s}$), coarse prior-$\beta$ columnar grains oriented along build direction.
   - Linear heat input control: $80 \leq HI \leq 220\text{ J/mm}$.
3. **WAAM (Wire Arc Additive Manufacturing — CMT & Plasma Arc)**
   - High deposition rates ($> 1\text{--}3\text{ kg/h}$), thermal accumulation requires interpass temperature control ($\leq 150^\circ\text{C}$) to suppress prior-$\beta$ grain coarsening.
4. **Binder Jetting (BJ)**
   - Room-temperature liquid binder deposition followed by debinding and high-vacuum solid-state sintering ($1250 - 1350^\circ\text{C}$).
5. **HIP (Hot Isostatic Pressing)**
   - Universal qualification post-processing: $900 - 930^\circ\text{C}$ at $100 - 105\text{ MPa}$ argon pressure for $2 - 4\text{ hours}$. Decomposes brittle $\alpha'$ martensite into ductile lamellar $\alpha+\beta$, closes internal gas pores and lack-of-fusion voids to satisfy **ASTM F2924** and **ASTM F3001** standards.

---

## 🏛️ Two-Stream Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               54 Research Papers Dataset               │
                    │        (Ti-6Al-4V & Ti-6Al-4V ELI Grade 23)            │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                 ┌──────────────────────────────┴─────────────────────────────┐
                 ▼                                                            ▼
      [STREAM A: Thermal Physics]                                [STREAM B: Microstructure & Mechanics]
   - Analytical Rosenthal Melt Pool                           - Phase Transformations:
   - Thermal Gradient (G) & Cooling Rate (R)                    Liquid -> Prior-β -> α' (Martensitic)
   - Volumetric Energy Density (Ev)                             α' -> Lamellar α+β -> Equiaxed α+β
   - Defect Regimes:                                          - Hall-Petch Strengthening (σ = σ0 + kd^(-1/2))
     * Lack of Fusion (Ev < 55 J/mm³)                         - Murakami Defect-Tolerant Fatigue
     * Keyhole Vaporization (Ev > 115 J/mm³)                  - ASTM F2924 / F3001 Qualification Verification:
     * Balling / Rayleigh Capillary                               * Yield Strength ≥ 825 MPa
     * Optimal Densification (>99.5%)                             * UTS ≥ 895 MPa
                                                                  * Elongation ≥ 10.0%
                 │                                                            │
                 └──────────────────────────────┬─────────────────────────────┘
                                                │
                                                ▼
                         ┌───────────────────────────────────────────┐
                         │   Pure Java AM Platform Engine (JDK 21)   │
                         │   - Built-in Java2D Scientific Plotter    │
                         │   - Native HTTP Server (port 8080)        │
                         │   - REST API (Physics, Materials, Recipe) │
                         │   - Interactive Process Map Dashboard     │
                         └───────────────────────────────────────────┘
```

---

## 📊 Scientific Deliverables & Generated Plots

All scientific plots are rendered programmatically via **Java2D** at $1200 \times 800$ publication resolution:

1. **`plots/ti64_lpbf_defect_processing_window.png`**:
   - Laser Power ($P$) vs. Scan Speed ($v$) processing window mapping Lack of Fusion, Keyhole, Balling, and the Optimal Window ($55 \leq E_v \leq 95\text{ J/mm}^3$).
2. **`plots/ti64_ded_waam_process_window.png`**:
   - Power vs. Travel Speed identifying the stable deposition corridor ($80 \leq HI \leq 220\text{ J/mm}$) for blown-powder DED and Wire Arc AM.
3. **`plots/ti64_astm_qualification_ashby_map.png`**:
   - Ashby material property chart: Yield Strength vs. Elongation, highlighting the **ASTM F2924 Qualified Box** and showing how HIP heat treatment shifts brittle as-built martensitic specimens into the compliant zone.
4. **`plots/ti64_energy_density_density_tradeoff.png`**:
   - Relative density bell-curve showing the drop in density at low $E_v$ (Lack of Fusion) and high $E_v$ (Keyhole gas entrapment).
5. **`process_windows_dashboard.html`**:
   - Standalone, interactive HTML dashboard visualizing all maps, paper statistics, and metallurgy physics models.

---

## 🗄️ Database Architecture

- **Supabase Cloud PostgreSQL**:
  - `papers`: 54 extracted peer-reviewed publications.
  - `process_parameters`: Laser power, scan speed, beam diameter, layer thickness, hatch spacing, preheat temp.
  - `thermal_physics`: Melt pool length/width/depth, cooling rates, energy densities, defect regimes.
  - `microstructure`: Phase volume fractions ($\alpha, \beta, \alpha'$), grain morphology, prior-$\beta$ width.
  - `mechanical_properties`: Yield strength, UTS, elongation, Vickers hardness, fracture toughness ($K_{IC}$), fatigue limit.
  - `predictions_and_models`: Hall-Petch predictions, Murakami fatigue limit, ASTM compliance status.
- **Local SQLite Engine**:
  - `ti6al4v_materials_database.db`: Mirrors the complete schema for offline analytical execution.
- **Normalized Materials Registry**:
  - `data/materials.csv`: 209 alloy variants with 42 quantitative metrics each, filtered strictly to the 4 AM processes.

---

## 🚀 Quickstart & Execution

### Prerequisites
- Java JDK 21+ installed and available on PATH (`javac`, `java`).
- No external libraries, build tools (Maven/Gradle), or Python dependencies required for execution.

### Build and Run (One-Click)
- **Windows Batch**:
  ```cmd
  run.bat
  ```
- **PowerShell**:
  ```powershell
  .\run.ps1
  ```

### Manual Compilation
```bash
# Compile pure Java sources
javac -encoding UTF-8 -d bin -sourcepath src src/com/matsci/Main.java src/com/nit/am/AmPlatformApplication.java src/com/nit/am/ProcessWindowPlotter.java

# Run full evaluation & regenerate scientific plots
java -cp bin com.nit.am.AmPlatformApplication

# Start embedded web server & REST API
java -cp bin com.nit.am.AmPlatformApplication --serve
```

---

## 🌐 Endpoints & API Reference

When running with `--serve`, the native HTTP server listens on `http://localhost:8080`:

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | `GET` | Interactive scientific process window dashboard and Ashby maps |
| `/api/stats` | `GET` | Global statistics (Literature papers, ASTM pass rate, Alloy variants) |
| `/api/evaluate?power=250&speed=1000&layer=30&hatch=100` | `GET` | Real-time Rosenthal melt pool physics & ASTM qualification evaluator |
| `/api/materials` | `GET` | Complete 42-metric materials informatics registry |
| `/api/recipe?variant=TIV-00001` | `GET` | Synthesizes full operational AM manufacturing recipe from material properties |
