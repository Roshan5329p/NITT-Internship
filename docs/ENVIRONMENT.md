# Environment & Configuration

## 1. Embedded Server Configuration

The pure Java AM platform server is configured via runtime flags or default constants in `AmPlatformApplication.java`:

| Parameter | Default Value | CLI Flag Override | Description |
| :--- | :--- | :--- | :--- |
| **HTTP Port** | `8080` | `--port <num>` | Network port for the embedded HTTP server |
| **Server Mode**| Foreground | `--serve` | Starts the persistent background HTTP server |
| **Verify Mode**| Standard | `--verify` | Executes the self-diagnostic test runner |

---

## 2. Cloud Database Credentials (Supabase)

Environment variables loaded at runtime for cloud database synchronization:

```bash
# Supabase Cloud Project Configuration
SUPABASE_URL=https://iismzfileyuvqgdpivgx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Local File Paths

The platform utilizes relative filesystem paths rooted at the working directory:
- **Dashboard Source**: `process_windows_dashboard.html`
- **CSV Datasets**: `data/*.csv`
- **Generated Plots**: `plots/*.png`
- **Documentation**: `docs/*.md`
- **Compiled Binaries**: `bin/com/nit/am/**/*.class`
