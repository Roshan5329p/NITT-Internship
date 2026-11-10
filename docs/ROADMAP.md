# Product & Technical Roadmap

## NOW (Current Release v2.4.0)

- [x] Pure Java 21+ embedded HTTP platform with 7 high-speed REST endpoints.
- [x] Full parameter coupling for Power ($P$), Speed ($v$), Spot ($\emptyset_{\text{spot}}$), Hatch ($h$), Layer ($t$), Preheat ($T_0$), and Alloy properties.
- [x] KU Leuven Hybrid (Coen et al. 2022) & Rosenthal (1946) analytical melt pool engines.
- [x] Bontha et al. (2006, 2009) 2D/3D Solidification Microstructure Maps with Bessel solutions.
- [x] ASTM E140 hardness conversions (HV to HRC) and ASTM F2924 tensile qualification rules.
- [x] Zero-collision SVG visual canvas layout with centered quench notification banner.
- [x] Automated 14-point regression verification runner (`DashboardVerifier.java`).

---

## NEXT (v2.5.0)

- [ ] Support for additional titanium grades (Ti-6242, Ti-5553) and Nickel superalloys (IN718, IN625).
- [ ] Multi-laser scanning overlap simulator (dual-laser and quad-laser thermal interference).
- [ ] Exportable PDF qualification audit reports formatted to ISO/ASTM 52920 audit standards.

---

## LATER (v3.0.0)

- [ ] In-situ pyrometry and photodiode sensor data streaming integration.
- [ ] Machine-specific laser parameter calibration profiles (Concept Laser M2, EOS M290, Renishaw RenAM 500Q).
- [ ] Machine learning surrogate models for powder bed spatter distribution.

---

## DEFERRED

- Full 3D finite element voxel meshing (OpenFOAM / Ansys FEA taking hours) — intentionally avoided to preserve sub-50 ms real-time interactive feedback.
- Automated CAD slicing and direct machine motor PLC control.

---

## NOT PLANNED

- Re-introduction of Python microservices or Node/Vite development server dependencies.
