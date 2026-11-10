# Design System

## 1. Design Direction

- **Style**: High-precision, scientific aerospace instrumentation, dark-mode terminal aesthetics.
- **Mood**: Authoritative, analytical, responsive, cutting-edge metallurgical engineering.
- **Design Principles**:
  1. **Visual Clarity over Decorative Clutter**: Every badge, curve, and isotherm represents a real physical phenomenon.
  2. **Zero Collision Layout**: Dimension lines, badges, and callouts must never intersect or overlap under any parameter regime.
  3. **Instantaneous Feedback**: Slider manipulations must trigger 60 FPS visual state transitions with sub-50 ms recalculation.

---

## 2. Brand Identity

- **Brand Name**: NIT Trichy Titanium AM Platform
- **Logo / Mark**: Laser beam focal spot icon with molten metal droplet (`💧 Molten Pool | 🎯 Incident Laser Beam`).
- **Brand Voice**: Scientific, rigorous, empirical, and compliant with ISO/ASTM standards.

---

## 3. Color Palette

The interface utilizes a precision scientific dark-mode theme based on physical thermal gradients:

```css
:root {
  /* Core Backgrounds & Surfaces */
  --bg-primary:      #060a0f; /* Deep obsidian space */
  --bg-secondary:    #0d1829; /* Dark navy card surface */
  --bg-tertiary:     #132238; /* Elevated container surface */
  --border-color:    rgba(255, 255, 255, 0.08);
  --border-glow:     rgba(80, 216, 233, 0.25);

  /* Scientific Accents */
  --accent-cyan:     #50d8e9; /* Primary telemetry / Conduction mode */
  --accent-sky:      #38bdf8; /* Secondary metrics */
  --accent-blue:     #3b82f6; /* Information callouts */
  --accent-indigo:   #6366f1; /* Microstructure & Bontha profiles */

  /* Thermal & Defect Regimes */
  --accent-emerald:  #10b981; /* Optimal Conduction / ASTM Compliant */
  --accent-amber:    #fbbf24; /* Lack of Fusion / Balling Alert */
  --accent-rose:     #f43f5e; /* Keyhole Porosity / Emitter Quenched */

  /* Text & Labels */
  --text-primary:    #f1f5f9; /* Slate 100 high-contrast body */
  --text-muted:      #94a3b8; /* Slate 400 secondary labels */
  --text-dark:       #64748b; /* Slate 500 annotations */

  /* Thermal Isotherms */
  --iso-liquidus:    #00f7ff; /* 1650°C Liquidus boundary */
  --iso-mushy:       #e2e8f0; /* 1600°C Mushy dendrite envelope */
  --iso-beta:        #fbbf24; /* 995°C Beta-transus HAZ */
  --iso-martensite:  #a855f7; /* 575°C Martensite Start Ms */
}
```

---

## 4. Typography

- **Primary Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Monospace Telemetry Font**: `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`

### Type Scale
- **H1 (Page Header)**: 24px / Bold (700) / Line-height: 1.2
- **H2 (Section Header)**: 18px / Semi-bold (600) / Line-height: 1.3
- **H3 (Card Header)**: 14px / Semi-bold (600) / Line-height: 1.4
- **Body**: 13px / Regular (400) / Line-height: 1.5
- **Small / Badges**: 11px / Medium (500) / Letter-spacing: 0.04em
- **Telemetry Readout**: 18px–28px / Bold Monospace (700)

---

## 5. Spacing Scale

Based on an 8px modular grid:
- `4px` (xs): Tight badge padding and inline gaps
- `8px` (sm): Standard control padding
- `12px` (md): Sub-section element spacing
- `16px` (lg): Card internal padding
- `24px` (xl): Section header separation
- `32px` (2xl): Major view section gaps

---

## 6. Components

### A. Range Sliders (`.dark-slider`)
- Sleek cyan thumb with neon glow upon focus.
- Live numerical badge positioned directly above slider track.
- Direct synchronization via `oninput="onSliderChange()"`.

### B. Metric Telemetry Cards (`.kpi-card`)
- Solid surface `#0d1829` with subtle border `rgba(255, 255, 255, 0.08)`.
- Large prominent numerical readout in bold monospace.
- Contextual subtitle indicating physical thresholds (e.g., `1.8x layer t` or `Keyhole Mode`).

### C. Process Mode Pills (`.process-pill`)
- Radio-like pill buttons with rounded borders (`rx = 6px`).
- Active state highlighted in deep cyan background with glowing cyan border.

### D. Anti-Collision Callout Boxes
- High-contrast badges with translucent backgrounds (`rgba(8, 14, 24, 0.95)`).
- Centered quench emitter banner with bounded dimensions (`width: 240px`, `center: 400px`) ensuring a minimum 15px clearance to adjacent callouts.

---

## 7. Interactive States

- **Normal**: Muted slate borders and neutral dark-blue background.
- **Hover**: Subtle border illumination (`rgba(80, 216, 233, 0.4)`).
- **Active / Drag**: Real-time canvas redraw at 60 FPS.
- **Quenched / Aborted**: Laser center replaced with dashed gray reticle, quench notification banner displayed, isotherms suppressed.
- **ASTM Out of Spec**: Amber alert border with explicit delta requirements.

---

## 8. Accessibility & Responsiveness

- High contrast ratio (>7:1) between text `#f1f5f9` and background `#060a0f`.
- Color is never used as the sole indicator of state: textual badges (`CONDUCTION`, `KEYHOLE`, `BALLING`) accompany all color shifts.
- Responsive layout supports fluid side-panel collapse and scalable SVG viewboxes (`viewBox="0 0 960 420"` and `viewBox="0 0 760 360"`).
