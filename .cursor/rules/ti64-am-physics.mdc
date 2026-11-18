---
description: Domain physics constants, dimensional equations, regime thresholds, and ASTM F2924 compliance rules for the NIT Titanium AM Platform (Ti-6Al-4V).
globs: ["src/**/*", "tests/**/*", "api/**/*", "scripts/**/*", "*.html"]
---

# Ti-6Al-4V Additive Manufacturing Physics & Compliance Rules

All code changes involving thermal modeling, melt pool dynamics, parameter solvers, ML inference, or dashboard KPIs MUST adhere strictly to the physical constants, unit conventions, and metallurgical compliance boundaries defined below.

## 1. Unit Conventions & Dimensional Consistency
- **Internal SI / Canonical Units:** Always convert UI inputs immediately upon entry before executing physics or ML calculations:
  - Laser / Arc Power ($P$): Watts ($\text{W}$)
  - Scan / Travel Speed ($v$): $\text{mm/s}$ (convert to $\text{m/s}$ via $v \times 10^{-3}$ for Rosenthal thermal equations)
  - Hatch Spacing ($h$): UI displays $\mu\text{m}$; convert to $\text{mm}$ ($h \times 10^{-3}$) for VED and $\text{m}$ ($h \times 10^{-6}$) for thermal fields
  - Layer Thickness ($t$): UI displays $\mu\text{m}$; convert to $\text{mm}$ ($t \times 10^{-3}$) for VED and $\text{m}$ ($t \times 10^{-6}$) for thermal fields
  - Beam Spot Diameter ($d_b$): UI displays $\mu\text{m}$; convert to $\text{m}$ ($d_b \times 10^{-6}$)
  - Preheat Temperature ($T_0$): UI displays $^{\circ}\text{C}$; convert to Kelvin ($\text{K} = T_0 + 273.15$) for radiation/thermophysical equations
- **Never mix $\mu\text{m}$ and $\text{mm}$ inside core calculation helpers.**

## 2. Thermophysical Baseline Constants (Ti-6Al-4V Grade 5 & Grade 23 ELI)
Use these validated baseline constants unless overridden by an explicit user thermophysical override:
- **Density ($\rho$):** $4430\ \text{kg/m}^3$ ($4.43 \times 10^{-3}\ \text{g/mm}^3$)
- **Solidus Temperature ($T_s$):** $1604\ ^{\circ}\text{C}$ ($1877.15\ \text{K}$)
- **Liquidus Temperature ($T_l$):** $1660\ ^{\circ}\text{C}$ ($1933.15\ \text{K}$)
- **Beta-Transus Temperature ($T_{\beta}$):**
  - Grade 5 (`ti64_gr5`): $995\ ^{\circ}\text{C}$
  - Grade 23 ELI (`ti64_eli`): $975\ ^{\circ}\text{C}$
- **Specific Heat Capacity ($c_p$, solid-liquid average):** $670\ \text{J/(kg}\cdot\text{K)}$
- **Thermal Conductivity ($k$, near solidus):** $21.9\ \text{W/(m}\cdot\text{K)}$
- **Thermal Diffusivity ($\alpha = k / (\rho c_p)$):** $\approx 7.38 \times 10^{-6}\ \text{m}^2/\text{s}$
- **Latent Heat of Fusion ($L_f$):** $286{,}000\ \text{J/kg}$
- **Effective Laser Absorptivity ($\eta$):** $0.35\text{–}0.48$ in conduction mode (default $0.42$ for LPBF powder bed); increases non-linearly above keyhole threshold due to multiple internal reflections.

## 3. Core Analytical Equations & Processing Regimes
- **Volumetric Energy Density (VED):**
  $$E_v = \frac{P}{v \cdot h_{\text{mm}} \cdot t_{\text{mm}}} \quad [\text{J/mm}^3]$$
- **LPBF Processing Windows (Ti-6Al-4V):**
  - **Severe Lack-of-Fusion (LOF):** $E_v < 40\ \text{J/mm}^3$ (porous, unmelted powder particles)
  - **Sub-optimal / Transition LOF:** $40 \le E_v < 55\ \text{J/mm}^3$
  - **Optimal Conduction Window:** $55 \le E_v \le 85\ \text{J/mm}^3$ (fully dense $> 99.8\%$)
  - **Transition / Mild Keyhole:** $85 < E_v \le 110\ \text{J/mm}^3$
  - **Severe Keyhole / Vaporization Instability:** $E_v > 110\ \text{J/mm}^3$ (trapped gas pores, Al vaporization loss)
- **Tabor Scaling & Mechanical Approximations:**
  - Ultimate Tensile Strength: $\text{UTS}\ [\text{MPa}] \approx 3.05 \times \text{HV}$ (with microstructure-dependent scaling factor between $2.95$ for coarse lamellar $\alpha+\beta$ and $3.15$ for fine $\alpha'$ martensite).
  - Rockwell C ($\text{HRC}$) conversion must ALWAYS carry an explicit UI disclaimer (`*approximate for Ti alloys via ASTM E140 steel reference`).

## 4. Microstructure & Post-Processing State Rules
- **As-Built (`None`):** Rapid solidification cooling rate ($\dot{T} > 10^5\ \text{K/s}$) produces epitaxial columnar prior-$\beta$ grains filled with acicular $\alpha'$ martensite. High hardness ($365\text{–}405\ \text{HV}$), low ductility ($< 8\%$ elongation). **Fails ASTM F2924 Class 1 ductility without post-processing.**
- **Stress-Relieved (`650°C / 2 hr`):** Retains fine $\alpha'$ / ultra-fine $\alpha+\beta$ needles while relieving residual thermal stress. Hardness $\approx 360\text{–}390\ \text{HV}$.
- **Annealed (`730°C / 2 hr`):** Partial decomposition into fine lamellar $\alpha+\beta$. Hardness $\approx 345\text{–}370\ \text{HV}$.
- **HIP-Treated (`920°C / 100 MPa / 2 hr`):** Decomposes brittle $\alpha'$ into ductile lamellar $\alpha+\beta$ basketweave and closes internal lack-of-fusion/gas pores. Target hardness $320\text{–}360\ \text{HV}$. **Required for ASTM F2924 Class 1 / aerospace fracture-critical qualification.**

## 5. ASTM F2924 Compliance Guardrails
Never mark a build configuration as `ASTM F2924 Qualified` unless ALL of the following hold simultaneously:
1. **Alloy Chemistry:** Matches `ti64_gr5` or `ti64_eli` compositional limits (Al: $5.50\text{–}6.75\ \text{wt}\%$, V: $3.50\text{–}4.50\ \text{wt}\%$, O $\le 0.20\ \text{wt}\%$ for Grade 5 or $\le 0.13\ \text{wt}\%$ for Grade 23 ELI).
2. **Relative Density:** $\ge 99.5\%$ (porosity $\le 0.5\%$).
3. **Minimum Tensile Properties (Post-Processed):**
   - $\text{UTS} \ge 895\ \text{MPa}$
   - Yield Strength ($\text{YS}_{0.2\%}$) $\ge 825\ \text{MPa}$
   - Elongation at break $\ge 10\%$ (requires Stress-Relief, Annealing, or HIP; As-Built $\alpha'$ state must trigger a ductility compliance warning).

## 6. UI & Numerical Safety Guardrails
- **Zero `NaN` / `Infinity` Tolerance:** Guard all divisions ($v, h, t, d_b$) against zero or negative inputs; clamp sliders before running solvers.
- **Uncertainty Honesty:** Never hide the `95% Prediction Interval` on ML outputs, and always surface an extrapolation warning when inputs fall outside the $N = 178$ indexed benchmark envelope.
