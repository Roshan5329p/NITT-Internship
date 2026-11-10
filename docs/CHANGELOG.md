# Changelog

All notable changes to the **NIT Trichy Titanium Additive Manufacturing Platform** are documented here.

---

## [2.4.0] — 2026-11-10

### Added
- **Full Parameter & Thermal Coupling**: Build plate preheat ($T_0$) and alloy thermophysical constants (`liquidusC`, `density`, `specificHeat`, `laserAbsorptivity`) dynamically update the KU Leuven and Rosenthal melt pool engines, quench banner, and Bontha 2D/3D solidification equations.
- **ASTM E140 Hardness Standard Conversion**: Implemented exact tabular interpolation mapping Vickers hardness (HV) to Rockwell C (HRC) equivalent.
- **The Vibe Coding Blueprint Suite**: Integrated complete 17-document architecture and engineering specification inside `docs/`.

### Fixed
- **Quench Banner Visual Collision**: Re-centered and sized the quench notification banner (`width: 240px`, `center: 400px`), guaranteeing minimum 15px clearance to adjacent callouts.
- **Preheat Ambient Display Bug**: Resolved issue where banner displayed `25°C AMBIENT` when preheat slider was set to elevated temperatures.

---

## [2.3.0] — 2026-11-09

### Added
- **Bontha Solidification Microstructure Maps**: Bessel function ($K_0, K_1$) analytical engine for 2D Thin-Wall (Bontha et al. 2006 JMPT) and 3D Bulky (Bontha et al. 2009 MSEA) additive regimes.
- **Pulsating Radar Cursor**: Real-time $(R, G)$ coordinate tracking indicating Columnar, Mixed CET, or Equiaxed grain morphology.

### Changed
- Excised separate Vite React development dashboard (`dashboard/` directory removed) and decommissioned `/app` route to enforce pure-Java architecture.

---

## [2.0.0] — 2026-11-05

### Added
- **Pure Java AM Platform Server**: Embedded `HttpServer` serving interactive dashboard, Java2D plots, and 7 REST endpoints.
- **Supabase Cloud Synchronization**: Bi-directional PostgreSQL sync across 6 core AM datasets.
- **Automated Regression Suite**: Created `com.nit.am.util.DashboardVerifier` with 14 automated system checks.

### Removed
- Removed legacy Python runtime scripts and external pip dependencies.
