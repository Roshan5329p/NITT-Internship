# Database Architecture & Data Model

## 1. Database Overview

The platform uses a synchronized dual-layer database architecture:
- **Cloud Database**: PostgreSQL hosted on **Supabase** (`https://iismzfileyuvqgdpivgx.supabase.co`).
- **Local Persistence**: Normalized CSV datasets located in the `data/` directory for zero-latency offline operation.

---

## 2. Naming Conventions

- **Tables**: Plural snake_case (e.g., `papers`, `process_parameters`, `thermal_physics`).
- **Columns**: Descriptive snake_case with explicit physical units appended where applicable (e.g., `laser_power_w`, `scan_speed_mms`, `cooling_rate_ks`, `relative_density_pct`).
- **Primary Keys**: Integer auto-increment (`id SERIAL PRIMARY KEY`) or synthetic code keys (e.g., `variant_id`).
- **Foreign Keys**: Target singular table name followed by `_id` (e.g., `paper_id`, `parameter_id`).

---

## 3. Relational Schema & Tables

### Table 1: `papers`
Stores metadata for 54 peer-reviewed literature publications curated across Ti-6Al-4V additive manufacturing research.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Unique publication identifier |
| `paper_code` | VARCHAR(16) | UNIQUE, NOT NULL | Reference code (e.g., `P-01`, `P-54`) |
| `title` | TEXT | NOT NULL | Full paper title |
| `authors` | TEXT | NOT NULL | Author string (e.g., `Coen et al.`) |
| `year` | INTEGER | NOT NULL | Year of publication (2006–2026) |
| `journal` | VARCHAR(128) | NOT NULL | Publishing journal (e.g., `JMPT`, `MSEA`, `Acta Mater`) |
| `doi` | VARCHAR(128) | | Digital Object Identifier |
| `process_type`| VARCHAR(32) | NOT NULL | `LPBF`, `L-DED`, `WAAM`, `Binder Jetting` |
| `alloy` | VARCHAR(64) | NOT NULL | `Ti-6Al-4V Grade 5`, `Ti-6Al-4V ELI Grade 23` |

---

### Table 2: `process_parameters`
Captures the operating parameters associated with each experimental run or simulated trial.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Unique parameter set identifier |
| `paper_id` | INTEGER | REFERENCES `papers(id)` | Associated publication |
| `variant_id` | VARCHAR(32) | NOT NULL | Recipe identifier (e.g., `TIV-00001`) |
| `laser_power_w` | NUMERIC(8,2) | NOT NULL | Beam / laser power in Watts |
| `scan_speed_mms`| NUMERIC(8,2) | NOT NULL | Laser scan speed in mm/s |
| `hatch_spacing_um` | NUMERIC(8,2) | NOT NULL | Distance between adjacent passes (µm) |
| `layer_thickness_um` | NUMERIC(8,2) | NOT NULL | Powder layer thickness (µm) |
| `beam_diameter_um` | NUMERIC(8,2) | NOT NULL | Laser spot diameter $D_{4\sigma}$ (µm) |
| `preheat_temp_c` | NUMERIC(8,2) | DEFAULT 25.0 | Substrate / build plate preheat (°C) |
| `ved_j_mm3` | NUMERIC(8,2) | NOT NULL | Volumetric Energy Density ($J/\text{mm}^3$) |

---

### Table 3: `thermal_physics`
Stores analytical and experimental melt pool dimensions and thermal kinetics.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Unique thermal record identifier |
| `parameter_id` | INTEGER | REFERENCES `process_parameters(id)` | Associated process parameters |
| `melt_pool_width_um` | NUMERIC(8,2) | NOT NULL | Transverse melt pool width (µm) |
| `melt_pool_depth_um` | NUMERIC(8,2) | NOT NULL | Penetration depth (µm) |
| `melt_pool_length_um`| NUMERIC(8,2) | NOT NULL | Longitudinal pool length (µm) |
| `aspect_ratio` | NUMERIC(5,2) | NOT NULL | Ratio $D/W$ (Keyhole threshold $>0.80$) |
| `peak_temp_c` | NUMERIC(8,2) | NOT NULL | Peak temperature at beam center (°C) |
| `cooling_rate_ks` | NUMERIC(12,2)| NOT NULL | Solidus cooling rate $\dot{T}$ (K/s) |
| `t85_time_ms` | NUMERIC(6,2) | NOT NULL | Cooling time between 800°C and 500°C |
| `thermal_gradient_g_kcm` | NUMERIC(12,2) | NOT NULL | Temperature gradient $G$ (K/cm) |
| `solidification_rate_r_cms` | NUMERIC(8,2) | NOT NULL | Solidification front growth rate $R$ (cm/s) |

---

### Table 4: `microstructure`
Captures metallographic phase fractions, grain morphology, and dendrite/lath spacing.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Unique microstructure record |
| `parameter_id` | INTEGER | REFERENCES `process_parameters(id)` | Associated process parameters |
| `alpha_prime_pct`| NUMERIC(5,2) | NOT NULL | Acicular $\alpha'$ martensite fraction (%) |
| `beta_retained_pct` | NUMERIC(5,2) | NOT NULL | Retained body-centered cubic $\beta$ phase (%) |
| `alpha_lamellar_pct`| NUMERIC(5,2) | NOT NULL | Equilibrium lamellar $\alpha$ phase (%) |
| `prior_beta_width_um`| NUMERIC(8,2) | | Prior-$\beta$ grain column width (µm) |
| `lath_spacing_um`| NUMERIC(6,3) | NOT NULL | Secondary dendrite / martensite lath spacing |
| `morphology` | VARCHAR(32) | NOT NULL | `Columnar`, `Mixed CET`, or `Equiaxed` |

---

### Table 5: `mechanical_properties`
Stores as-built and post-processed tensile test results and ASTM compliance audits.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Unique property record |
| `parameter_id` | INTEGER | REFERENCES `process_parameters(id)` | Associated process parameters |
| `post_processing`| VARCHAR(64) | NOT NULL | `As-Built`, `Stress-Relieved`, `Annealed`, `HIP` |
| `hardness_hv` | NUMERIC(6,1) | NOT NULL | Vickers microhardness (HV0.5) |
| `hardness_hrc` | VARCHAR(16) | NOT NULL | ASTM E140 converted Rockwell C hardness |
| `yield_strength_mpa` | NUMERIC(8,2) | NOT NULL | 0.2% offset Yield Strength (MPa) |
| `uts_mpa` | NUMERIC(8,2) | NOT NULL | Ultimate Tensile Strength (MPa) |
| `elongation_pct` | NUMERIC(5,2) | NOT NULL | Plastic strain to fracture (%) |
| `relative_density_pct` | NUMERIC(5,2) | NOT NULL | Archimedes relative density (%) |
| `astm_compliant`| BOOLEAN | NOT NULL | True if meeting ASTM F2924 criteria |

---

### Table 6: `predictions_and_models`
Stores validation outputs from hybrid physics-AI models (Gaussian Process Regressor, Rosenthal, Bontha, Coen).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | Record ID |
| `parameter_id` | INTEGER | REFERENCES `process_parameters(id)` | Associated parameter set |
| `model_name` | VARCHAR(64) | NOT NULL | `KU Leuven Semi-Analytical`, `Rosenthal 3D`, etc. |
| `predicted_density_pct` | NUMERIC(5,2) | NOT NULL | Model predicted density |
| `defect_regime`| VARCHAR(32) | NOT NULL | `Conduction`, `Lack of Fusion`, `Keyholing`, `Balling` |
| `keyhole_risk` | NUMERIC(5,3) | NOT NULL | Keyhole onset probability index |
| `lof_risk` | NUMERIC(5,3) | NOT NULL | Lack of fusion probability index |

---

## 4. Relationships

```text
       ┌───────────┐
       │  papers   │
       └─────┬─────┘
             │ 1 : N
             ▼
┌───────────────────────────┐
│    process_parameters     │
└────────────┬──────────────┘
             │ 1 : 1
   ┌─────────┼──────────────┬──────────────┬──────────────┐
   ▼         ▼              ▼              ▼              ▼
┌────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────────────┐
│thermal_│ │microstructure│ │ mechanical_│ │predictions_│ │     Supabase Cloud    │
│physics │ │              │ │ properties │ │ and_models │ │ PostgreSQL Sync Engine│
└────────┘ └──────────────┘ └────────────┘ └────────────┘ └───────────────────────┘
```

---

## 5. Migration & Data Integrity Rules

1. **Unit Consistency**: All power inputs are in Watts, speeds in mm/s, dimensions in micrometers (µm), and temperatures in Celsius (°C).
2. **Defect Safety Guardrails**: Records where $d/W > 0.80$ must be flagged as `Keyhole Mode`.
3. **Hardness Standards**: Vickers hardness (HV) must be mapped to Rockwell C (HRC) strictly in accordance with ASTM E140 table conversions.
