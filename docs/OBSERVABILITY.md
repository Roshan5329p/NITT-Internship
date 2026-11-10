# Observability & Diagnostics

## 1. Observability Architecture

Observability in the NIT AM Platform is divided into two operational streams:
1. **Server Console Telemetry**: Real-time request logging, cold start timing, route status codes, and verification outputs.
2. **Client Physics Telemetry**: High-frequency pyrometric readouts, Marangoni convection velocity, cooling rate metrics, and ASTM qualification statuses.

---

## 2. Server Logging Standards

### What is Logged:
- Server startup configuration: Java version, bound port, local dataset row counts.
- HTTP access logs: Timestamp, HTTP method, request URI, response status code, payload size in bytes.
- Verification test executions: Check-by-check pass/fail status and regression score.
- Supabase cloud synchronization events: Success counts or connection retry warnings.

### What is NEVER Logged:
- Database secret tokens or service role keys.
- Proprietary unencrypted customer build files.

---

## 3. Client Pyrometry & Microstructural Telemetry

The interactive dashboard streams real-time physical metrics into explicit telemetry elements:

| Element ID | Metric Displayed | Physical Meaning |
| :--- | :--- | :--- |
| `#kpi_ved` | VED ($J/\text{mm}^3$) | Volumetric Energy Density: $P / (v \cdot h \cdot t)$ |
| `#mpPyrometryTelemetry` | $t_{8/5}$ (ms) & Rate ($K/s$) | Cooling time through 800°C–500°C phase window |
| `#mpMarangoniTelemetry` | $v_{\text{Marangoni}}$ (mm/s) | Marangoni surface thermocapillary velocity ($d\gamma/dT < 0$) |
| `#mpPhaseFractions` | $\alpha'$ / $\beta$ / $\alpha$ (%) | Koistinen-Marburger phase distribution |
| `#mpMechanicalProperties`| UTS / YS / Elongation | Predicted tensile behavior vs ASTM F2924 limits |
| `#mpCoupledBadge` | Status text & borders | Real-time linkage status between sliders & thermal engine |

---

## 4. Diagnostics & Verification Runner

To verify operational health at any time, execute the standalone verifier:

```powershell
java -cp bin com.nit.am.util.DashboardVerifier
```

The verifier interrogates all endpoints and confirms zero regressions across the entire platform.
