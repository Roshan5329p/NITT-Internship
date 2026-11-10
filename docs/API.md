# API Documentation & Contracts

## 1. Overview

The **NIT Trichy Titanium AM Platform** exposes 7 high-performance REST endpoints running on the embedded Java 21+ HTTP server (Default: `http://localhost:8080`).

All responses are delivered in UTF-8 formatted JSON with explicit status headers and sub-5 ms execution latency.

---

## 2. Global Rules & Guidelines

- **Base URL**: `http://localhost:8080`
- **Authentication**: Intranet / Local machine access (zero token barrier for local simulation).
- **Error Format**:
  ```json
  {
    "status": "error",
    "code": 400,
    "message": "Invalid parameter: 'power' must be between 10 and 5000 Watts."
  }
  ```
- **Validation**: Numerical parameters are strictly cast and bounded to physically realistic ranges.

---

## 3. Endpoints

### 1. Global Platform Statistics
- **Route**: `GET /api/stats`
- **Purpose**: Returns indexed dataset counts, supported alloys, and platform telemetry.
- **Sample Request**:
  ```bash
  curl http://localhost:8080/api/stats
  ```
- **Sample Response**:
  ```json
  {
    "platform": "NIT Trichy Titanium AM Platform",
    "version": "2.4.0",
    "indexed_papers": 54,
    "experimental_variants": 289,
    "supported_alloys": ["Ti-6Al-4V Grade 5", "Ti-6Al-4V ELI Grade 23"],
    "supported_routes": ["LPBF", "L-DED", "WAAM", "Binder Jetting"],
    "supabase_synced": true
  }
  ```

---

### 2. Comprehensive Physics & Defect Evaluation
- **Route**: `GET /api/evaluate`
- **Purpose**: Runs the full thermo-kinetic calculation stack for a given parameter set.
- **Query Parameters**:
  - `power` (float, required): Laser power in Watts (e.g., `280`)
  - `speed` (float, required): Scan speed in mm/s (e.g., `960`)
  - `hatch` (float, optional, default `110`): Hatch spacing in µm
  - `layer` (float, optional, default `40`): Layer thickness in µm
  - `spot` (float, optional, default `80`): Beam spot diameter in µm
  - `preheat` (float, optional, default `200`): Build plate preheat in °C
- **Sample Request**:
  ```bash
  curl "http://localhost:8080/api/evaluate?power=280&speed=960&hatch=110&layer=40"
  ```
- **Sample Response**:
  ```json
  {
    "inputs": {
      "laser_power_w": 280.0,
      "scan_speed_mms": 960.0,
      "hatch_spacing_um": 110.0,
      "layer_thickness_um": 40.0,
      "ved_j_mm3": 66.28
    },
    "melt_pool": {
      "width_um": 146,
      "depth_um": 103,
      "length_um": 343,
      "aspect_ratio": 0.71,
      "mode": "Conduction Mode",
      "remelt_ratio": 2.58
    },
    "thermal_kinetics": {
      "cooling_rate_ks": 600000,
      "t85_ms": 0.5,
      "marangoni_velocity_mms": 212
    },
    "defect_indices": {
      "regime": "Optimal Conduction",
      "lof_index": 0.69,
      "keyhole_ratio": 0.27,
      "balling_ratio": 0.75
    },
    "mechanical_properties": {
      "predicted_density_pct": 99.98,
      "hardness_hv": 398,
      "hardness_hrc": "40 HRC",
      "yield_strength_mpa": 945,
      "uts_mpa": 1120,
      "elongation_pct": 11.2,
      "astm_f2924_compliant": true
    }
  }
  ```

---

### 3. Dedicated Melt Pool Geometry API
- **Route**: `GET /api/meltpool`
- **Purpose**: Computes cross-sectional dimensions based on KU Leuven Hybrid or Rosenthal analytical models.
- **Query Parameters**:
  - `model` (string, `coen` or `rosenthal`, default `coen`)
  - `power` (float, required)
  - `speed` (float, required)
  - `spot` (float, optional, default `80`)
- **Sample Request**:
  ```bash
  curl "http://localhost:8080/api/meltpool?model=coen&power=200&speed=950"
  ```
- **Sample Response**:
  ```json
  {
    "model": "KU Leuven Semi-Analytical Hybrid (Coen et al. 2022)",
    "power_w": 200,
    "speed_mms": 950,
    "width_um": 128,
    "depth_um": 72,
    "length_um": 305,
    "aspect_ratio": 0.56,
    "peak_temp_c": 2845
  }
  ```

---

### 4. Bontha Solidification Map API
- **Route**: `GET /api/bontha`
- **Purpose**: Solves Bessel differential equations for 2D Thin-Wall (2006) or 3D Bulky (2009) solidification maps.
- **Query Parameters**:
  - `dim` (string, `3d-bulky` or `2d-thin-wall`, default `3d-bulky`)
  - `power` (float, required)
  - `speed` (float, required)
  - `preheat` (float, optional, default `25`)
- **Sample Request**:
  ```bash
  curl "http://localhost:8080/api/bontha?dim=3d-bulky&power=200&speed=950"
  ```
- **Sample Response**:
  ```json
  {
    "dimension": "3D Bulky Half-Space",
    "surface_growth_rate_r_cms": 95.0,
    "surface_temperature_gradient_g_kcm": 14250,
    "cooling_rate_ks": 1353750,
    "gr_ratio": 150.0,
    "morphology": "Mixed (CET)",
    "depth_profile_stations": 10
  }
  ```

---

### 5. Materials Registry API
- **Route**: `GET /api/materials`
- **Purpose**: Returns thermophysical properties, absorptivity constants, and ASTM baseline specs for registered alloys.

---

### 6. Process Recipe Synthesis API
- **Route**: `GET /api/recipe?variant=TIV-00001`
- **Purpose**: Fetches the validated machine recipe and literature citation for an indexed variant.

---

### 7. Interactive Dashboard Web Interface
- **Route**: `GET /dashboard` or `GET /`
- **Purpose**: Serves the standalone interactive single-page dashboard (`process_windows_dashboard.html`).
