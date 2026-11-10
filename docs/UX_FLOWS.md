# UX Flows & User Journeys

## 1. Primary User Journey: Parameter Tuning & Process Window Exploration

```text
Open Dashboard (http://localhost:8080/dashboard)
    ↓
Select Alloy (Ti-6Al-4V Grade 5 or ELI Grade 23)
    ↓
Select AM Route (LPBF / SLM, L-DED, WAAM, Binder Jetting)
    ↓
Adjust Live Sliders (Laser Power P, Scan Speed v, Spot Ø, Preheat T0)
    ↓
Observe Immediate Visual Responses:
├─ Top KPI Cards (Hardness HV/HRC, Est. UTS, Relative Density, VED)
├─ Defect Status Badge (Conduction Mode vs Lack of Fusion vs Keyhole)
├─ Dynamic SVG Melt Pool Canvas (Width W, Length L, Depth D, Isotherms)
├─ Telemetry Stream (t8/5 cooling time, cooling rate, Marangoni velocity)
└─ Bontha Solidification Map (Pulsating Radar cursor at [R, G], Grain Morphology)
```

---

## 2. Secondary User Journey: Target Property Reverse Solving

```text
Navigate to VED & Property Solver
    ↓
Enter Target Hardness (e.g. 400 HV) or Target VED (e.g. 72 J/mm³)
    ↓
Select Optimization Strategy (Fine Quality, Balanced, Productivity)
    ↓
Click "Auto-Tune Safe Window"
    ↓
System automatically calculates:
├─ Optimal Laser Power P
├─ Optimal Scan Speed v
└─ Safe Hatch Spacing & Layer Thickness
    ↓
Sliders smoothly animate to target coordinates with zero collision
```

---

## 3. Tertiary User Journey: Solidification Map & Microstructural Profiling

```text
Navigate to Subsection 2 (Bontha Solidification Map)
    ↓
Toggle Dimension Mode (Bulky 3D Half-Space vs Thin-Wall 2D)
    ↓
Toggle Scale Mode (Small-Scale LENS™ vs Large-Scale 5–30 kW)
    ↓
Toggle Beam Source (Laser α=0.35 vs Electron Beam EBAM α=0.88)
    ↓
Review Sub-Views:
├─ Microstructure Map (Ashby-style log-log G vs R chart)
├─ Dimensionless Process Maps (Bontha 2009 Fig. 2a & 2b)
├─ Through-Depth Solidification Profile (10 Depth Stations table)
└─ Size-Scale & Kinetics comparison
```

---

## 4. Quench & Emergency Abort Flow

```text
User clicks "Quench Emitter"
    ↓
System triggers isOpticalAborted = true
    ↓
Visual Updates:
├─ Laser center turns to dashed gray reticle (Power P = 0 W)
├─ Centered Quench Notification Banner appears (⚠️ EMITTER QUENCHED [T = Preheat °C])
├─ Isotherms collapse to ambient / preheat baseline
├─ Marangoni convection drops to 0 mm/s
└─ Status badge shifts to "EMITTER QUENCHED" in red (#f87171)
    ↓
User clicks "Live Simulation" to re-ignite laser beam
```
