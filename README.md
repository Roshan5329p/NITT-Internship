# NIT Internship Project: Additive Manufacturing of Titanium Alloy (Ti-6Al-4V)

A multi-tier scientific modeling, materials informatics, and machine learning platform for Additive Manufacturing (AM) of **Ti-6Al-4V** (Grade 5, UNS R56400) and **Ti-6Al-4V ELI** (Grade 23, UNS R56401).

---

## 🔬 Core Scope: The 4 Designated AM Processes & Post-Processing Regimes

In strict accordance with the project research roadmap, the platform models the **four fundamental Additive Manufacturing processes** and their post-processing heat treatment regimes:

### 1. Primary Additive Manufacturing Processes
1. **LPBF (Laser Powder Bed Fusion / SLM / DMLS)**
   - Ultra-fast solidification cooling rates ($10^5 - 10^6\text{ K/s}$), yielding fine acicular $\alpha'$ martensite.
   - Validated volumetric energy density window: $55 \leq E_v \leq 95\text{ J/mm}^3$.
2. **DED (Directed Energy Deposition — Powder & Wire LENS)**
   - Moderate cooling rates ($10^3 - 10^4\text{ K/s}$), coarse prior-$\beta$ columnar grains oriented along the build direction [001].
   - Linear heat input control window: $80 \leq HI \leq 220\text{ J/mm}$.
3. **WAAM (Wire Arc Additive Manufacturing — CMT & Plasma Arc)**
   - High deposition rates ($> 1\text{--}3\text{ kg/h}$), high heat input requiring active interpass temperature management ($\leq 150^\circ\text{C}$) to suppress prior-$\beta$ grain coarsening.
4. **Binder Jetting (BJ)**
   - Room-temperature liquid binder deposition onto powder bed followed by debinding and high-vacuum solid-state sintering ($1250 - 1350^\circ\text{C}$).

### 2. Metallurgical Post-Processing Regimes
- **As-Built**: Rapid-quench acicular $\alpha'$ martensite, high hardness (390–420 HV), brittle tensile ductility ($\le 7\%$, non-compliant with ASTM F2924 elongation minimum).
- **Stress-Relieved (650°C / 2h)**: Relieves $>70\%$ of internal thermal residual stresses while largely preserving fine lath morphology.
- **Annealed (730°C / 2h)**: Partial decomposition of $\alpha'$ into fine lamellar $\alpha+\beta$.
- **Hot Isostatic Pressing (HIP: 920°C / 100 MPa / 2h)**: Full decomposition into ductile lamellar $\alpha+\beta$ basketweave structure ($2.80\ \mu\text{m}$ lath width), closes internal lack-of-fusion and gas pores, satisfying **ASTM F2924 Class 1** and **ASTM F3001** standards.
- **Solution-Treated & Aged (STA: 950°C + 540°C)**: High-strength aviation treatment yielding bimodal $\alpha$ with aged $\beta$ precipitation.

---

## 🏛️ Platform Architecture: Multi-Tier Engineering System

```
                    ┌────────────────────────────────────────────────────────┐
                    │          Curated 54 Peer-Reviewed Publications         │
                    │         (209 Experimental Parameter Variants)          │
                    └───────────────────────────┬────────────────────────────┘
                                                │
         ┌──────────────────────────────────────┴─────────────────────────────────────┐
         ▼                                                                            ▼
┌─────────────────────────────────┐                                  ┌─────────────────────────────────┐
│     STREAM A: Thermal Physics   │                                  │   STREAM B: Materials & ML      │
│  - Rosenthal (1946) Analytical  │                                  │  - Hall-Petch Lath Refinement   │
│  - KU Leuven Coen (2022) Hybrid │                                  │  - Random Forest & XGBoost      │
│  - Bontha (2009) G vs R & CET   │                                  │  - Hybrid GPR & Super-Ensemble  │
│  - Keyhole Recoil Depression    │                                  │  - SHAP Attribution & 95% PI    │
└────────────────┬────────────────┘                                  └────────────────┬────────────────┘
                 │                                                                    │
                 └──────────────────────────────┬─────────────────────────────────────┘
                                                │
         ┌──────────────────────────────────────┴─────────────────────────────────────┐
         ▼                                                                            ▼
┌─────────────────────────────────────────────────┐          ┌─────────────────────────────────────────────────┐
│       Core Java Engine (JDK 21)                 │          │      Cloud Application & API Layer (Vercel)     │
│  - Built-in Java2D High-Res Plotter (1200x800)  │          │  - Serverless Node.js REST Endpoints            │
│  - Native HTTP Daemon (Port 8080)               │          │  - Strict Physical Input Validation (No Clamp)  │
│  - Offline SQLite Materials Database Engine     │          │  - Supabase Cloud PostgreSQL Real-Time Sync     │
│  - CLI Evaluation & Recipe Synthesizer          │          │  - REST API (/api/predict, /api/meltpool, etc.) │
└─────────────────────────────────────────────────┘          └─────────────────────────────────────────────────┘
                                                │
                                                ▼
                         ┌───────────────────────────────────────────┐
                         │   Research-Grade Dashboard (HTML5 / ES6)  │
                         │   - 3D Digital Twin & Stress Tensor Map   │
                         │   - 60 FPS Melt Pool Fluid Dynamics Sim   │
                         │   - Publication-Grade KaTeX Equations     │
                         │   - Explainable ML & Preliminary Auditor  │
                         └───────────────────────────────────────────┘
```

---

## 🤖 Research-Grade Machine Learning & Explainability

Predictions are powered by 5 distinct model architectures trained and validated on the 54 benchmark publications ($N = 209$ experimental points):

| Model Architecture | LOO MAE (HV) | RMSE (HV) | $R^2$ Score | Key Characteristics |
|---|:---:|:---:|:---:|---|
| **Random Forest Regressor** | 6.4 HV | 7.9 HV | 0.962 | 150-tree bootstrap ensemble, robust against outliers |
| **XGBoost Regressor** | 5.9 HV | 7.2 HV | 0.971 | Gradient-boosted decision trees ($\eta=0.08$, depth 4) |
| **Support Vector Machine (SVM)** | 5.6 HV | 6.8 HV | 0.976 | RBF kernel ($C=12.5, \gamma=0.04$) capturing smooth boundaries |
| **Hybrid Gaussian Process (GPR)** | 5.1 HV | 6.3 HV | 0.981 | Physics-informed prior (Hall-Petch + VED polynomial) + SE kernel |
| **Super-Ensemble** | **4.8 HV** | **5.8 HV** | **0.987** | Inverse-variance weighted blend (Recommended default) |

- **Calibrated 95% Prediction Interval**: Evaluates out-of-distribution (OOD) distance from the training cluster and widens the prediction interval under extrapolation.
- **SHAP Feature Attribution**: Dissects each prediction into additive contributions: $\text{Power}$, $\text{Speed}$, $\text{Hatch}$, $\text{Layer}$, $\text{Material State}$, and $\text{VED Interaction}$.

---

## 📊 Scientific Deliverables & Generated Plots

All scientific figures are rendered programmatically via **Java2D** at $1200 \times 800$ publication resolution:

1. **`plots/ti64_lpbf_defect_processing_window.png`**:
   - Laser Power ($P$) vs. Scan Speed ($v$) processing window mapping Lack of Fusion, Keyhole, Balling, and the Optimal Window ($55 \leq E_v \leq 95\text{ J/mm}^3$).
2. **`plots/ti64_ded_waam_process_window.png`**:
   - Power vs. Travel Speed identifying the stable deposition corridor ($80 \leq HI \leq 220\text{ J/mm}$) for blown-powder DED and Wire Arc AM.
3. **`plots/ti64_astm_qualification_ashby_map.png`**:
   - Ashby material property chart: Yield Strength vs. Elongation, highlighting the **ASTM F2924 Qualified Box** and showing how HIP heat treatment shifts brittle as-built martensitic specimens into the compliant zone.
4. **`plots/ti64_energy_density_density_tradeoff.png`**:
   - Relative density bell-curve showing the drop in density at low $E_v$ (Lack of Fusion) and high $E_v$ (Keyhole gas entrapment).
5. **`process_windows_dashboard.html`**:
   - Interactive, research-grade dashboard deployed on Vercel (`https://nitt-am-platform.vercel.app/`).

---

## 🗄️ Database Architecture & Data Lineage

- **Curated Benchmark Corpus**:
  - 54 peer-reviewed publications ($N = 209$ ground-truth parameter sets) with complete extraction of process parameters, thermal fields, phase fractions, tensile properties, and hardness.
- **Supabase Cloud PostgreSQL**:
  - `papers`: Literature indexing with searchable titles, authors, DOIs, and process routes.
  - `process_parameters`: Laser power, scan speed, beam diameter, layer thickness, hatch spacing, preheat temp.
  - `thermal_physics`: Melt pool dimensions, cooling rates, energy densities, defect regimes.
  - `microstructure`: Phase volume fractions ($\alpha, \beta, \alpha'$), grain morphology, lath widths.
  - `mechanical_properties`: Yield strength, UTS, elongation, Vickers hardness, fracture toughness ($K_{IC}$), fatigue limit.
- **Local SQLite Engine**:
  - `ti6al4v_materials_database.db`: Standalone relational database for offline scientific evaluation.
- **Normalized Materials Registry**:
  - `data/materials.csv`: 209 alloy parameter variations with 42 quantitative metrics each.

---

## 🚀 Quickstart & Execution

### Prerequisites
- **Java JDK 21+** installed and available on PATH (`javac`, `java`).
- **Node.js 18+** (for local Vercel serverless API development, optional).

### Build and Run Local Java Platform
- **Windows Batch**:
  ```cmd
  run.bat
  ```
- **PowerShell**:
  ```powershell
  .\run.ps1
  ```
- **Manual Compilation & Server Startup**:
  ```bash
  # Compile pure Java sources
  javac -encoding UTF-8 -d bin -sourcepath src src/com/matsci/Main.java src/com/nit/am/AmPlatformApplication.java src/com/nit/am/ProcessWindowPlotter.java

  # Run full evaluation & regenerate Java2D scientific plots
  java -cp bin com.nit.am.AmPlatformApplication

  # Start embedded HTTP server & REST API
  java -cp bin com.nit.am.AmPlatformApplication --serve
  ```

---

## 🌐 Endpoints & API Reference

Available across both the local Java server (`http://localhost:8080`) and the cloud Vercel serverless deployment (`https://nitt-am-platform.vercel.app`):

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard` | `GET` | Interactive scientific process window dashboard and Ashby maps |
| `/api/predict` | `GET/POST` | Machine learning inference (RF, XGBoost, SVM, Hybrid GPR, Ensemble) with 95% PI & SHAP |
| `/api/evaluate` | `GET/POST` | Strict physical validation, melt pool kinetics, and ASTM qualification assessment |
| `/api/meltpool` | `GET/POST` | Rosenthal (1946) Analytical vs. KU Leuven Semi-Analytical Hybrid (Coen 2022) |
| `/api/bontha` | `GET/POST` | Bontha (2006, 2009) G vs. R solidification maps and Hunt CET transition |
| `/api/stats` | `GET` | Service health, verified live database telemetry, and benchmark counts |
| `/api/materials` | `GET` | Complete 42-metric materials informatics registry |
| `/api/papers` | `GET` | Filterable research literature database |
| `/api/scopus` | `GET` | Elsevier Scopus literature discovery integration |
