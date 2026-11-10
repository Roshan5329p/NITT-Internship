# Error Handling & Fault Resilience

## 1. System Error Handling Philosophy

The platform operates on a **graceful degradation** model: mathematical simulations must never crash or produce NaN values, network outages must never freeze the UI, and input bounds must be enforced transparently.

---

## 2. API HTTP Error Response Contracts

All endpoints in `AmPlatformApplication.java` return standardized JSON error bodies:

```json
{
  "status": "error",
  "code": 400,
  "message": "Descriptive error message",
  "timestamp": "2026-11-10T10:55:00Z"
}
```

### Standard Status Codes:
- **400 Bad Request**: Malformed or physically impossible query parameter (e.g., negative laser power, non-numeric strings).
- **404 Not Found**: Unknown endpoint or decommissioned route (e.g., `/app` correctly returns 404).
- **500 Internal Error**: Unexpected server-side calculation exception (logged with stack trace).

---

## 3. Client-Side Resilience & Boundary Clamping

### A. Mathematical Division-by-Zero Guards
- Scan speed in meters per second ($v_{\text{ms}}$) is guarded by `Math.max(0.01, vMs)`.
- Laser spot radius ($r_0$) is guarded by `Math.max(1e-6, o_rad)`.
- Enthalpy burden ($\Delta T = T_m - T_0$) is bounded by `Math.max(50.0, liquidus - preheat)`.

### B. Bessel Function Convergence Safeguards
In the Bontha 2D/3D engines, modified Bessel functions of the second kind ($K_0, K_1$) diverge toward infinity as $r \to 0$. The calculation clamps minimum dimensionless radial distances to `1e-6` and applies iterative bisection with a strict 22-step ceiling to prevent infinite loops.

### C. Quench Emitter State Management
When the user triggers "Quench Emitter" (`isOpticalAborted = true`):
- Peak temperature safely collapses to substrate preheat temperature ($T_{\text{preheat}}$).
- Marangoni flow drops to $0\text{ mm/s}$.
- The centered notification banner renders safely with 15 px clearance to adjacent callouts.

---

## 4. Cloud Fallback & Offline Operation

If the Supabase PostgreSQL cloud database is unreachable or network connectivity drops:
1. `SupabaseClient` catches network timeout exceptions without crashing the Java server.
2. The platform logs a diagnostic warning and continues serving all queries directly from local CSV datasets in `data/`.
