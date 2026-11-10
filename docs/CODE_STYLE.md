# Code Style & Engineering Conventions

## 1. General Principles

1. **Zero External Dependency Rule**: The Java backend must remain 100% pure standard library. Never introduce Maven/Gradle dependencies or external frameworks (no Spring, no Jackson, no Python bridges) without explicit project consensus.
2. **Scientific & Mathematical Precision**: Physical variables must retain their standard scientific notation and SI units in identifiers (e.g., `laserPowerW`, `scanSpeedMms`, `coolingRateKs`).
3. **Fail-Safe Robustness**: Physics calculations must guard against zero denominators and negative square roots using physically justified floor bounds (e.g., `Math.max(0.01, vMs)`).
4. **Single-Page Cohesion**: The dashboard HTML (`process_windows_dashboard.html`) is self-contained with embedded CSS and vanilla ES6+ JavaScript.

---

## 2. Naming Conventions

### Java (Backend)
- **Packages**: Lowercase reverse-domain style: `com.nit.am.*`.
- **Classes**: PascalCase nouns: `AmPlatformApplication`, `MeltPoolSimulator`, `DashboardVerifier`.
- **Methods**: camelCase verbs: `calculatePhysics()`, `handleMeltPool()`, `verifySystem()`.
- **Constants**: UPPER_SNAKE_CASE: `DEFAULT_PORT`, `TI64_LIQUIDUS_TEMP_C`.

### JavaScript (Frontend)
- **Global Constants**: UPPER_SNAKE_CASE: `ALLOY_DATA`, `SOLVER_CONFIG`.
- **Functions**: camelCase: `updateMeltPoolAndThermal()`, `onSliderChange()`, `hvToHrcStandard()`.
- **DOM Element IDs**:
  - Sliders: `sl_[param]` (e.g., `sl_p`, `sl_v`, `sl_h`, `sl_preheat`).
  - Readouts: `val_[param]` (e.g., `val_p`, `val_v`).
  - Cards: `mpCard[Metric]` (e.g., `mpCardLength`, `mpCardWidth`).
  - Badges: `[context]Badge` (e.g., `mpCoupledBadge`, `bonthaMorphBadge`).

---

## 3. Physical Constants & Units

Always standardize to the following physical base units:
- **Power**: Watts ($W$)
- **Speed**: Millimeters per second ($mm/s$) in UI; Meters per second ($m/s$) in thermal diffusion equations.
- **Dimensions**: Micrometers ($\mu m$) in UI/tables; Meters ($m$) in heat equations.
- **Temperature**: Celsius ($^\circ\text{C}$) in UI; Kelvin ($K$) in thermodynamic equations ($K = ^\circ\text{C} + 273.15$).
- **Thermal Conductivity ($k$)**: $W/(m\cdot K)$ ($27.0$ for Ti-6Al-4V liquid, $6.7$ for solid).
- **Density ($\rho$)**: $kg/m^3$ ($4189$ for liquid, $4430$ for solid).
- **Specific Heat ($C_p$)**: $J/(kg\cdot K)$ ($759$ for liquid, $526$ for solid).

---

## 4. Anti-Patterns to Avoid

- **DO NOT** use inline `node -e` or shell script injections that can corrupt Windows CRLF line endings.
- **DO NOT** hardcode ambient temperature when substrate preheating is present ($T_0 = T_{\text{preheat}}$).
- **DO NOT** place callout bounding boxes without explicit padding calculations to prevent visual collisions.
- **DO NOT** introduce floating-point precision display errors in the UI (always format using `.toFixed()` or `.toLocaleString()`).
