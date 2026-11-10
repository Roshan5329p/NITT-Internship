# Testing & System Verification Strategy

## 1. Testing Philosophy

The platform relies on an automated, self-contained verification suite (`com.nit.am.util.DashboardVerifier`). 

Testing validates four foundational pillars:
1. **Physical Soundness**: Analytical equations match published peer-reviewed benchmarks (Coen 2022, Rosenthal 1946, Bontha 2006/2009).
2. **Dataset Integrity**: All 6 core CSV files are intact, non-empty, and conform to the schema.
3. **Endpoint Reliability**: The embedded HTTP server handles all REST routes with HTTP 200 OK responses and valid JSON payloads.
4. **Architectural Decoupling**: Vite React development routes (`/app`) must strictly return HTTP 404 to guarantee the standalone status of the platform.

---

## 2. Test Execution Command

Run the automated 14-point regression runner from the workspace root:

```powershell
java -cp bin com.nit.am.util.DashboardVerifier
```

---

## 3. The 14 Verification Checkpoints

| Check # | Scope | Description | Success Criteria |
| :--- | :--- | :--- | :--- |
| **CHECK 1** | HTML Integrity | Verifies `process_windows_dashboard.html` exists and is non-empty (>200 KB) | File exists, contains Melt Pool, Bontha, and Rosenthal elements |
| **CHECK 2** | Datasets | Checks all 5 core CSV files in `data/` | Files exist and contain headers + data rows |
| **CHECK 3** | Java Plots | Verifies Java2D publication plot outputs in `plots/` | PNG files exist and are valid images |
| **CHECK 4** | Vite Excised | Verifies Vite React HMR server is completely decoupled | `dashboard/` directory absent or decommissioned |
| **HTTP 1** | Route `/dashboard` | Main interactive dashboard web route | HTTP 200 OK |
| **HTTP 2** | Route `/` | Root redirect / index route | HTTP 200 OK |
| **HTTP 3** | Route `/plots/*.png` | Defect processing window static image | HTTP 200 OK (image/png) |
| **HTTP 4** | Route `/plots/*.png` | ASTM qualification Ashby map image | HTTP 200 OK (image/png) |
| **HTTP 5** | API `/api/stats` | Global platform metrics | HTTP 200 OK (valid JSON) |
| **HTTP 6** | API `/api/evaluate` | Dynamic thermo-kinetic physics solver | HTTP 200 OK (valid JSON) |
| **HTTP 7** | API `/api/meltpool` | Melt pool geometry endpoint | HTTP 200 OK (valid JSON) |
| **HTTP 8** | API `/api/bontha` | Solidification microstructural map API | HTTP 200 OK (valid JSON) |
| **HTTP 9** | API `/api/materials`| Alloy thermophysical registry | HTTP 200 OK (valid JSON) |
| **HTTP 10**| Route `/app` | Verifies old Vite development route is inactive | HTTP 404 Not Found |

---

## 4. Definition of Done (DoD)

A code change is accepted only when:
- [x] `java -cp bin com.nit.am.util.DashboardVerifier` passes **14 / 14 checks (100%)**.
- [x] Zero JavaScript console errors occur upon slider movement in the browser.
- [x] No label or badge collision occurs on the SVG simulation canvas.
- [x] Working tree is clean and synchronized with the remote Git repository.
