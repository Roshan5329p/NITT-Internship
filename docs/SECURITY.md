# Security Guidelines

## 1. Security Architecture & Threat Model

The platform operates as a specialized engineering calculation tool running on trusted internal networks or standalone workstations.

### Key Assets to Protect:
- Proprietary AM build recipes and experimental parameter sets.
- Supabase cloud database credentials and API service tokens.
- Integrity of mathematical calculations and ASTM qualification audit reports.

---

## 2. Secrets Management & Environment Variables

### Rules:
1. **Zero Secret Hardcoding**: API keys, database passwords, and private tokens must never be embedded in source code, committed to Git, or exposed in client-side HTML.
2. **Environment Variable Injection**: Cloud keys must be loaded via system environment variables:
   - `SUPABASE_URL`: Endpoint URL for the Supabase project.
   - `SUPABASE_ANON_KEY`: Public anonymous client key (read/write row-level authorized).
   - `SUPABASE_SERVICE_ROLE_KEY`: Admin service key (never exposed to client).
3. **Repository Protection**: `.env`, `.env.local`, `.vscode/`, `.aistudio/`, and `.qodo/` are strictly tracked in `.gitignore`.

---

## 3. Server & Network Security

### A. Bound Interface
The embedded Java HTTP server binds to `localhost` (loopback `127.0.0.1`) or explicitly configured host addresses. External exposing should be proxied through an authenticated reverse proxy (e.g., Nginx with TLS 1.3).

### B. Input Validation & Defense in Depth
- All query string arguments (`power`, `speed`, `hatch`, etc.) are parsed via strict numerical types (`Double.parseDouble`).
- Out-of-bounds inputs are clamped or rejected with HTTP 400 Bad Request to prevent Denial of Service (DoS) through CPU exhaustion in iterative Bessel convergence loops.
- No shell command execution or dynamic class loading is performed on user inputs.

---

## 4. Database Security & Row-Level Security (RLS)

- **Supabase Cloud**: Protected by Row-Level Security (RLS) policies.
- Public read access is restricted to authenticated or whitelisted academic clients.
- Mutations (inserts/updates to the 54 papers and 289 variants) require authenticated service tokens.

---

## 5. Security Verification Checklist

- [x] No plaintext credentials or secrets in Git repository history.
- [x] Numerical input parameters validated against bounds ($P \le 5000\text{ W}$, $v \ge 1\text{ mm/s}$).
- [x] Static file server prevents directory traversal attacks (path sanitization in `AmPlatformApplication.java`).
- [x] Supabase API requests conducted strictly over HTTPS with TLS 1.3.
- [x] Verification runner (`DashboardVerifier.java`) confirms external dev servers (Vite) are decoupled.
