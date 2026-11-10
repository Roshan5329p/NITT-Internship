# AI Coding Agent Instructions & Guardrails

## 1. Project Context

- **Project**: NIT Trichy Titanium Additive Manufacturing (Ti-6Al-4V) Platform
- **Mission**: Deliver a zero-dependency, pure-Java scientific platform for AM process optimization and ASTM qualification.
- **Primary Users**: Additive manufacturing research scholars, metallurgical engineers, and certification auditors.

---

## 2. Hard Architectural Rules (Non-Negotiable)

1. **NO PYTHON**: The backend must remain 100% pure Java standard library. Never add Python scripts, NumPy/SciPy wrappers, or Python HTTP microservices.
2. **NO VITE / REACT HMR SERVER**: The separate Vite frontend was completely excised. All UI code resides in `process_windows_dashboard.html`. Do not recreate or attempt to start a separate Node.js dev server.
3. **PRESERVE ALL PHYSICAL EQUATIONS**: Do not modify or simplify the KU Leuven (Coen et al. 2022) hybrid equations, Rosenthal point-source equations, or Bontha Bessel function calculations without rigorous citation.
4. **MAINTAIN ZERO COLLISION LAYOUT**: Ensure all SVG badges, dimension arrows, and banners maintain adequate margin buffers (>15 px) across all parameter combinations ($P \in [80, 450]\text{ W}$, $v \in [300, 2200]\text{ mm/s}$).
5. **AUTOMATED VERIFICATION**: Always execute `java -cp bin com.nit.am.util.DashboardVerifier` before declaring a task complete.

---

## 3. Workflow for Non-Trivial Changes

```text
1. Inspect /docs (PRD.md, ARCHITECTURE.md, etc.)
   ↓
2. Inspect Relevant Source Code (AmPlatformApplication.java, process_windows_dashboard.html)
   ↓
3. Create Concise Implementation Plan
   ↓
4. Make Minimal Focused Edits
   ↓
5. Run java -cp bin com.nit.am.util.DashboardVerifier
   ↓
6. Update /docs If System Behavior Altered
```

---

## 4. Conflict Resolution

If a user request appears to contradict physical laws (e.g., asking for 100% density under $10\text{ W}$ power) or architectural rules (e.g., asking to install Python packages):
1. **Do not guess or silently degrade the architecture.**
2. **Explain the physical/architectural constraint clearly to the user.**
3. **Provide the compliant, physically valid solution.**
