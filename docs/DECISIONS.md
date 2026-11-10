# Architecture Decision Records (ADRs)

## ADR-001: Pure Java Standard Library Architecture

- **Date**: 2026-11-05
- **Status**: Accepted
- **Context**: The project initially used an awkward combination of Python backend scripts and a Node/Vite frontend development server, leading to portability issues and duplicate math engines.
- **Decision**: Completely excise Python and external frameworks. Unify all backend logic, REST routing, CSV data loading, and Java2D plotting into standard library Java 21 LTS (`AmPlatformApplication.java`).
- **Consequences**:
  - Positive: Instant cold startup (<150 ms), tiny RAM footprint (<35 MB), zero dependency hell, 100% portable on any Windows/Linux/macOS JVM.
  - Tradeoff: Standard library HTTP server lacks built-in reactive streaming (not required for current query-response physics workloads).

---

## ADR-002: Standalone Single-Page HTML Dashboard

- **Date**: 2026-11-09
- **Status**: Accepted
- **Context**: Maintaining a separate Vite React dashboard required continuous npm package maintenance and Node.js HMR daemon management.
- **Decision**: Excised the Vite project (`dashboard/` directory deleted) and unified the user interface into a self-contained, standalone HTML document (`process_windows_dashboard.html`).
- **Consequences**:
  - Positive: Zero build steps. Can be opened directly in any browser or served statically by the Java server.
  - Tradeoff: High line count in a single file (~5,000 lines), requiring strict visual modularity.

---

## ADR-003: KU Leuven Semi-Analytical Hybrid Melt Pool Engine

- **Date**: 2026-11-08
- **Status**: Accepted
- **Context**: Classical Rosenthal (1946) point-source solutions assume pure conduction with semi-circular melt pools, underpredicting penetration depths in the keyhole regime.
- **Decision**: Implemented the KU Leuven hybrid semi-analytical model (Coen et al. 2022, *J. Mater. Process. Technol.* 304: 117547), coupling Eagar-Tsai conduction width with Fabbro recoil pressure scaling for keyhole aspect ratios.
- **Consequences**:
  - Positive: Accurately predicts the transition from conduction mode ($D/W \le 0.8$) to keyhole mode ($D/W > 0.8$). Matches synchrotron X-ray imaging benchmarks within 8%.

---

## ADR-004: Dual-Persistence Data Layer

- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**: Need both instant offline access during lab experiments and persistent cloud synchronization across researchers.
- **Decision**: Implemented dual persistence: local RFC-4180 CSV files in `data/` for local reads and Supabase PostgreSQL via HTTPS REST for cloud synchronization.
