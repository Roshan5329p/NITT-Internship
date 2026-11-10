# Product Requirements Document (PRD)

## 1. Product Overview

- **Product Name**: NIT Trichy Titanium Additive Manufacturing (Ti-6Al-4V) Platform
- **One-Line Description**: A unified pure-Java additive manufacturing physics platform, defect process window analyzer, and ASTM qualification engine for Ti-6Al-4V components.
- **Product Type**: Scientific & Industrial Simulation Platform / Material Qualification Suite
- **Primary Platform**: Web (Desktop Chrome / Edge / Firefox) backed by embedded Java 21+ HTTP server.

---

## 2. Problem

### What problem are we solving?
Laser Powder Bed Fusion (LPBF) and Directed Energy Deposition (DED) of Ti-6Al-4V frequently suffer from catastrophic metallurgical defects:
1. **Lack-of-fusion (LoF) porosity** caused by insufficient volumetric energy density ($VED < 55\text{ J/mm}^3$) and inadequate overlap ($W/h < 1.3$, $D/t < 1.5$).
2. **Keyholing porosity** triggered by excessive energy density ($VED > 85\text{ J/mm}^3$) and high laser power intensity that vaporizes alloy constituents, creating unstable vapor depressions ($d/W > 0.80$).
3. **Plateau-Rayleigh capillary balling** at excessive scan speeds where cylinder elongation exceeds stability limits ($L/W > \pi$).
4. **Severe brittleness** in as-built parts due to rapid thermal quenching ($>10^5\text{ K/s}$) producing 100% acicular $\alpha'$ martensite with inadequate tensile elongation ($<8\%$, violating ASTM F2924).

### Why does this problem matter?
Aerospace, defense, and biomedical implants demand 99.9%+ relative density, high yield strength ($\ge 825\text{ MPa}$), ultimate tensile strength ($\ge 895\text{ MPa}$), and minimum elongation ($\ge 10\%$). Physical trial-and-error prints cost thousands of dollars per build and waste months of qualification time.

### How are users solving this today?
- Expensive, slow 3D finite element simulation suites (Ansys Additive, Simufact) that take 6–24 hours per scan line.
- Disconnected spreadsheets and static published literature papers without real-time parameterized verification.

---

## 3. Goals

### Primary Goal:
Provide an instantaneous (<50 ms), mathematically verified physics engine and interactive dashboard that allows process engineers to tune AM parameters (Laser Power, Scan Speed, Hatch Spacing, Layer Thickness, Beam Spot, Preheat) and immediately observe melt pool dimensions, defect regimes, microstructure phase fractions, tensile properties, and ASTM F2924 compliance.

### Secondary Goals:
- Integrate Bontha et al. (2006, 2009) 2D/3D solidification microstructure maps with exact Bessel functions ($K_0, K_1$) to predict columnar-to-equiaxed transitions (CET).
- Correlate real-time analytical calculations with 54 indexed peer-reviewed literature publications covering 289 experimental variants.
- Provide a zero-dependency, pure Java platform server executable on any machine with zero Python or Node.js runtime requirements.

---

## 4. Target Users

### User Type 1: Additive Manufacturing Process Engineer
- **Description**: Sets machine build files for LPBF (Concept Laser, EOS, Renishaw) and DED machines.
- **Needs**: Real-time safe operating window identification, optimal hatch/layer remelt ratios, and balling prevention.
- **Pain Points**: Trial-and-error powder wastage, build failures due to keyhole porosity.

### User Type 2: Metallurgist / Materials Scientist
- **Description**: Analyzes phase transformation kinetics, prior-$\beta$ grain widths, and lath spacing.
- **Needs**: Cooling rates ($\dot{T}$ and $t_{8/5}$), thermal gradients ($G$), solidification rates ($R$), and Koistinen-Marburger kinetics.
- **Pain Points**: Complex mathematical tools needed to solve moving point-source heat transfer equations.

### User Type 3: Aerospace & Biomedical Qualification Auditor
- **Description**: Evaluates test specimens against ASTM F2924 and ASTM F3001 standards.
- **Needs**: Traceable compliance audits comparing as-built vs post-processed (HIP, Annealed, STA) tensile properties.
- **Pain Points**: Inconsistent hardness-to-tensile conversion and lack of unified evidence linking parameters to certified properties.

---

## 5. User Stories

- **As a process engineer**, I want to adjust the Laser Power ($P$) and Scan Speed ($v$) sliders and see the real-time VED and defect status update immediately so that I never run machine builds in the keyhole or lack-of-fusion regimes.
- **As a metallurgist**, I want to view the through-depth solidification profile on the Bontha map so that I can predict whether grain growth will be fully columnar, mixed CET, or equiaxed.
- **As a quality engineer**, I want to compare predicted UTS, Yield Strength, and Elongation against ASTM F2924 standards across As-built, Stress-relieved, Annealed, and HIP conditions.
- **As an academic researcher**, I want to access indexed empirical data from 54 peer-reviewed publications directly alongside my simulation results.

---

## 6. Core Features

### Feature 1 — Interactive Process Window & Defect Regimes
- **Purpose**: Classify operational regimes into Conduction (Optimal), Lack of Fusion, Keyholing, or Balling.
- **Inputs**: $P$ (80–450 W), $v$ (300–2200 mm/s), $h$ (50–180 µm), $t$ (20–90 µm), $\emptyset_{\text{spot}}$ (40–150 µm), $T_{\text{preheat}}$ (25–650 °C).
- **Outputs**: VED ($J/\text{mm}^3$), Lack of Fusion index, Keyhole aspect ratio ($d/W$), Balling ratio ($L/W$).
- **Acceptance Criteria**: Conduction mode requires $55 \le VED \le 85\text{ J/mm}^3$, $d/W \le 0.80$, and $L/W \le \pi$.

### Feature 2 — High-Fidelity Melt Pool & Thermal Simulation
- **Purpose**: Render real-time SVG cross-sections and isotherms for KU Leuven Hybrid (Coen et al. 2022) and Rosenthal (1946) models.
- **Outputs**: Width ($W$), Depth ($D$), Length ($L$), Peak Temp ($T_{\text{peak}}$), Marangoni velocity ($v_{\text{Marangoni}}$), $t_{8/5}$ cooling time, and isotherms ($1650^\circ\text{C}$ liquidus, $1600^\circ\text{C}$ mushy zone, $995^\circ\text{C}$ $\beta$-transus, $575^\circ\text{C}$ $M_s$).

### Feature 3 — Bontha Solidification Microstructure Maps
- **Purpose**: Calculate thermal gradient $G$ and solidification growth rate $R$ across 10 depth stations using Bessel solutions.
- **Outputs**: Morphology classification (`FULLY COLUMNAR`, `MIXED CET`, `EQUIAXED`), radar tracking cursor, dimensionless process maps ($G/\dot{T}$ vs $R$).

### Feature 4 — ASTM F2924 Mechanical Properties & Post-Processing Engine
- **Purpose**: Predict hardness (HV and ASTM E140 HRC), yield strength (MPa), UTS (MPa), and elongation (%) for Ti-6Al-4V Grade 5 & Grade 23 ELI.
- **Options**: As-built, Stress-relieved (600°C), Annealed (730°C), HIP (920°C, 100 MPa), Bi-modal cyclic STA.

---

## 7. Non-Goals

- Transient 3D CFD modeling of individual powder particle spatter dynamics.
- G-code or machine laser scanning toolpath generation.
- Full 3D finite element voxel meshing taking hours.
- Direct hardware machine motor controller communication.

---

## 8. MVP Scope

- **Must Have**:
  - Standalone single-page interactive dashboard (`process_windows_dashboard.html`).
  - Pure Java 21+ backend server with 7 REST API endpoints.
  - Full parameter coupling between sliders, melt pool geometry, and Bontha map.
  - Automated 14-point test suite (`DashboardVerifier.java`).
- **Nice to Have**:
  - Supabase PostgreSQL remote cloud synchronization.
  - Multi-laser beam overlap interference analysis.
- **Future**:
  - Live acoustic emission sensor telemetry integration for in-situ defect monitoring.

---

## 9. Success Metrics

- **Simulation Latency**: <50 ms on any standard laptop CPU.
- **Verification Score**: 14 / 14 automated test checks passing (100%).
- **Portability**: 0 external runtime dependencies (pure Java standard library + vanilla web standards).
- **Physical Fidelity**: Predicted melt pool dimensions within 8% of KU Leuven synchrotron X-ray benchmarks.

---

## 10. Constraints

- **Language / Runtime**: Strictly pure Java 21+ backend. Zero Python, zero Node.js server dependencies.
- **Frontend Architecture**: Standalone vanilla ES6+ HTML/SVG/Canvas dashboard. No separate Vite/Webpack dev server.
- **Database**: Local CSV persistence in `data/` mirrored to Supabase cloud PostgreSQL.
- **Standards**: ASTM F2924 (Ti-6Al-4V AM), ASTM E140 (Hardness conversions), ISO/ASTM 52900 (AM terminology).

---

## 11. Definition of Done

- [x] All 6 process parameters dynamically update melt pool geometry and thermal history.
- [x] Bontha 2D/3D solidification engine correctly renders without label collisions.
- [x] ASTM E140 hardness conversion accurately computes Rockwell C (HRC) equivalent.
- [x] Pure Java AM platform server serves dashboard and 7 REST endpoints with zero errors.
- [x] Automated regression suite (`DashboardVerifier.java`) achieves 100% pass rate.
- [x] All code committed and synchronized with GitHub repository.
