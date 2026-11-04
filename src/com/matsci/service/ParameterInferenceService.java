package com.matsci.service;

import com.matsci.model.MaterialVariant;
import com.matsci.model.ProcessParameter;
import com.matsci.model.ProcessRecipe;

import java.util.ArrayList;
import java.util.List;

/**
 * Advanced Metallurgy & Additive Manufacturing Parameter Engine.
 * Formulates realistic, ASTM/ISO standard processing recipes and
 * quantitative operational parameters of creation for Titanium Additive
 * Manufacturing processes and post-processing treatments.
 */
public class ParameterInferenceService {

    public ProcessRecipe inferRecipe(MaterialVariant v) {
        String subprocess = v.getSubprocess() != null ? v.getSubprocess().trim() : "";
        String post = v.getPostProcessingCondition() != null ? v.getPostProcessingCondition().trim() : "";
        Double liquidus = v.getLiquidusTemperature();
        Double betaTransus = v.getBetaTransusTemperature();
        Double buildRate = v.getBuildRate();
        Double laserAbs = v.getLaserAbsorptivity();
        Double maxStress = v.getResidualStressMax();
        Double relDensity = v.getRelativeDensity();
        Double surfaceRa = v.getSurfaceRoughnessRa();
        Double oxygen = v.getOxygenContent();

        List<ProcessParameter> params = new ArrayList<>();
        List<String> steps = new ArrayList<>();
        String summary;
        String equipment;
        String atmosphere;

        // 1. Process Route Specific Formulation
        if (subprocess.contains("Laser PBF") || subprocess.contains("SLM") || subprocess.contains("DMLS")) {
            summary = "Laser Powder Bed Fusion (L-PBF / SLM) utilizing a high-power continuous-wave fiber laser to selectively fuse gas-atomized titanium alloy powder layer-by-layer under inert argon.";
            equipment = "Industrial L-PBF 3D Printer (e.g. EOS M290, SLM Solutions 280, Concept Laser M2), Inert Glovebox, Ultrasonic Sieve Station";
            atmosphere = "Ultra-high purity Argon (99.999%), O₂ < 100 ppm, H₂O < 15 ppm (Prevents interstitial titanium oxygen pickup)";

            steps.add("Powder conditioning: Plasma atomized spherical powder (PSD 15–45 µm) vacuum baked and sieved");
            steps.add("Chamber evacuation (< 5 mbar) followed by laminar argon purge until O₂ < 100 ppm");
            steps.add("Substrate baseplate preheating to 150–200 °C to alleviate steep thermal gradients");
            steps.add("Bidirectional recoater spreading of 30–50 µm powder layers followed by galvo-rastered laser exposure");
            steps.add("Controlled chamber cooldown under argon flow; automated un-melted powder vacuum extraction");

            int laserPower = (laserAbs != null && laserAbs < 0.42) ? 280 : 220;
            params.add(new ProcessParameter("Laser & Optics", "Laser Power", String.valueOf(laserPower), "W", "Continuous-wave Yb-fiber laser (λ = 1070 nm)"));
            params.add(new ProcessParameter("Kinetic", "Scan Speed", "950 – 1250", "mm/s", "High-speed galvanometer mirror raster velocity"));
            params.add(new ProcessParameter("Geometry", "Layer Thickness", "30 – 50", "µm", "Nominal powder spread thickness per slice"));
            params.add(new ProcessParameter("Optics", "Hatch Spacing", "90 – 110", "µm", "Track overlap distance ensuring >99.5% relative density"));
            params.add(new ProcessParameter("Thermal", "Substrate Preheat Temp", "160 – 200", "°C", "Baseplate resistive heater to control residual stress"));
            if (laserAbs != null) {
                params.add(new ProcessParameter("Optics", "Laser Absorptivity (1070nm)", String.format("%.3f", laserAbs), "", "Material optical coupling efficiency"));
            }
            if (buildRate != null) {
                params.add(new ProcessParameter("Productivity", "Volumetric Build Rate", String.format("%.1f", buildRate), "cm³/h", "Actual volumetric throughput per hour"));
            }

        } else if (subprocess.contains("Laser powder DED") || subprocess.contains("LENS")) {
            summary = "Blown-powder Directed Energy Deposition (Laser DED / LENS) injecting metallic powder streams coaxially into a laser-induced melt pool on a substrate.";
            equipment = "Optomec LENS / DMG MORI Lasertec 65 3D multi-axis CNC laser deposition system";
            atmosphere = "High-purity Argon shielding gas (coaxial nozzle + trailing shroud), local O₂ < 50 ppm";

            steps.add("Substrate plate degreasing, ultrasonic cleaning, and mechanical grit blasting");
            steps.add("Coaxial powder nozzle alignment and continuous argon flow stabilization");
            steps.add("Dynamic laser melt pool initiation on substrate with closed-loop optical pyrometry");
            steps.add("Multi-axis CNC continuous track deposition with 40–50% bead step-over overlap");
            steps.add("Interpass dwell monitoring to maintain localized interpass temperature below critical threshold");

            params.add(new ProcessParameter("Laser & Power", "Laser Power", "1200 – 2500", "W", "High-power continuous diode / fiber laser"));
            params.add(new ProcessParameter("Kinetic", "Traverse Speed", "12 – 22", "mm/s", "Deposition head CNC feed rate (700 – 1300 mm/min)"));
            params.add(new ProcessParameter("Feedstock", "Powder Feed Rate", "8 – 18", "g/min", "Carrier-gas powder mass delivery rate"));
            params.add(new ProcessParameter("Atmosphere", "Shielding Argon Flow", "15 – 25", "L/min", "Coaxial and trailing shield gas flow"));
            if (buildRate != null) {
                params.add(new ProcessParameter("Productivity", "Deposition Build Rate", String.format("%.1f", buildRate), "cm³/h", "Material deposition rate"));
            }

        } else if (subprocess.contains("wire DED") || subprocess.contains("Wire DED")) {
            summary = "Wire-fed Directed Energy Deposition using focused laser or electron beam to melt continuous titanium wire spool for high-deposition near-net shapes.";
            equipment = "Sciaky EBAM (Electron Beam Additive Manufacturing) or Robotic Laser Wire DED Cell";
            atmosphere = "Vacuum (< 10⁻⁴ mbar) for electron beam; High-purity Argon enclosure (O₂ < 20 ppm) for laser wire";

            steps.add("Wire spool surface inspection and automated feeding alignment into beam focal zone");
            steps.add("Chamber evacuation to high vacuum or multi-purge argon enclosure sealing");
            steps.add("Continuous wire feed melting with dynamic wire retract and arc/beam synchronization");
            steps.add("Multi-layer near-net-shape deposition with automated laser profile scanning");

            params.add(new ProcessParameter("Power", "Beam Power", "2.5 – 5.0", "kW", "High-energy wire melting source"));
            params.add(new ProcessParameter("Feedstock", "Wire Feed Speed", "1.5 – 3.5", "m/min", "Wire feed velocity (1.2–1.6 mm diameter wire)"));
            params.add(new ProcessParameter("Kinetic", "Travel Speed", "8 – 18", "mm/s", "Robot travel velocity"));
            if (buildRate != null) {
                params.add(new ProcessParameter("Productivity", "Build Rate", String.format("%.1f", buildRate), "cm³/h", "Heavy cross-section deposition rate"));
            }

        } else if (subprocess.contains("WAAM")) {
            summary = "Wire Arc Additive Manufacturing (WAAM) combining robotic kinematics with electric arc welding (TIG/Plasma) to manufacture massive titanium structural preforms.";
            equipment = "6-Axis Industrial Robot (KUKA / ABB) with Fronius CMT / Lincoln Electric Arc Power Source and trailing argon shield";
            atmosphere = "Flexible purged Argon bubble / local trailing argon gas shield with O₂ monitoring (< 50 ppm)";

            steps.add("Substrate clamping onto rigid bed to resist high thermo-mechanical distortion");
            steps.add("Argon gas purge of trailing shield and wire feed guide; O₂ sensor verification");
            steps.add("Continuous cold-metal transfer (CMT) or plasma arc bead deposition");
            steps.add("Enforced interpass cooling pauses allowing bead temperature to drop below 150 °C");
            steps.add("Stress-relief heat treatment prior to substrate de-clamping to prevent severe warping");

            boolean isPlasma = subprocess.contains("Plasma");
            params.add(new ProcessParameter("Electric Arc", "Arc Current", isPlasma ? "160 – 260" : "120 – 200", "A", isPlasma ? "Transferred plasma arc current" : "GTAW pulsed arc current"));
            params.add(new ProcessParameter("Electric Arc", "Arc Voltage", isPlasma ? "18 – 24" : "12 – 16", "V", "Operating arc voltage"));
            params.add(new ProcessParameter("Feedstock", "Wire Feed Speed", "1.8 – 3.2", "m/min", "Titanium wire feed speed"));
            params.add(new ProcessParameter("Kinetic", "Travel Speed", "5 – 10", "mm/s", "Robotic torch travel speed (300–600 mm/min)"));
            params.add(new ProcessParameter("Thermal", "Max Interpass Temp", "150", "°C", "Critical limit to avoid excessive grain coarsening & oxidation"));
            params.add(new ProcessParameter("Atmosphere", "Argon Flow", "25 – 45", "L/min", "Torch and trailing protective gas flow"));
            if (buildRate != null) {
                params.add(new ProcessParameter("Productivity", "Deposition Rate", String.format("%.1f", buildRate), "cm³/h", "High-volume build rate"));
            }

        } else if (subprocess.contains("Binder jetting") || subprocess.contains("Binder Jetting")) {
            summary = "Two-step indirect additive manufacturing: liquid polymeric binder is selectively jetted onto fine titanium powder beds at room temperature, followed by debinding and high-vacuum solid-state sintering.";
            equipment = "Desktop Metal / ExOne / HP Metal Jet Binder Jetting System, High-Vacuum Sintering Furnace";
            atmosphere = "Ambient air printing; High-Vacuum (< 10⁻⁵ mbar) or Argon for debind & sintering";

            steps.add("Fine spherical titanium powder (PSD 5–25 µm) spread at room temperature");
            steps.add("Piezoelectric inkjet printing of binder droplets into cross-sectional patterns");
            steps.add("Overhead IR lamp curing of each layer; whole-cake oven curing at 180–200 °C (6 hr)");
            steps.add("Delicate automated de-powdering to isolate fragile green parts");
            steps.add("Thermal debinding (350–450 °C) and high-vacuum sintering (1250–1350 °C, 4 hr dwell)");

            int sinterTemp = betaTransus != null ? (int) Math.round(betaTransus + 280) : 1280;
            params.add(new ProcessParameter("Geometry", "Layer Thickness", "40 – 60", "µm", "Powder slice layer thickness"));
            params.add(new ProcessParameter("Debind", "Debind Temperature", "350 – 420", "°C", "Thermal extraction of polymer binder under protective argon"));
            params.add(new ProcessParameter("Thermal", "Sintering Peak Temp", String.valueOf(sinterTemp), "°C", "Solid-state diffusion sintering (causes 15–20% volumetric shrinkage)"));
            params.add(new ProcessParameter("Atmosphere", "Sintering Vacuum", "< 1e-5", "mbar", "Ultra-high vacuum to prevent oxygen and nitrogen pickup"));
            params.add(new ProcessParameter("Kinetic", "Sintering Dwell Time", "3 – 5", "hr", "Soak duration to achieve dense metallurgical bonding"));
            if (relDensity != null) {
                params.add(new ProcessParameter("Quality", "Achieved Relative Density", String.format("%.2f", relDensity), "%", "As-sintered or sintered+HIP density"));
            }

        } else {
            summary = "Direct Additive Manufacturing of Titanium Alloy component followed by specified metallurgical post-processing.";
            equipment = "Advanced Additive Manufacturing System, Protective Inert Atmosphere Chamber";
            atmosphere = "High-purity Argon (99.999%) or High Vacuum (< 10⁻⁴ mbar)";

            steps.add("Feedstock inspection and chamber preparation");
            steps.add("Layer-by-layer consolidation under inert atmosphere");
            steps.add("Post-build cooling and cleaning");

            params.add(new ProcessParameter("Atmosphere", "Protective Shield", "Argon / Vacuum", "", "Strict oxygen exclusion"));
        }

        // 2. Post-Processing Condition Formulation
        if (post.equalsIgnoreCase("HIP") || post.contains("Sintered + HIP")) {
            steps.add("Hot Isostatic Pressing (HIP): Illustrative cycle of ~920 °C, 100 MPa argon pressure for 2 hours to reduce internal porosity; qualify parameters for the material and application, then verify the resulting density. ASTM F3001 is a material specification, not a prescribed HIP cycle.");
            params.add(new ProcessParameter("Post-Treatment", "HIP Temperature", "900 – 930", "°C", "Sub-transus temperature preventing coarse prior-beta grain growth"));
            params.add(new ProcessParameter("Post-Treatment", "HIP Pressure", "100 – 105", "MPa", "Isostatic high-pressure high-purity argon gas"));
            params.add(new ProcessParameter("Post-Treatment", "HIP Dwell Duration", "2.0", "hr", "Equiaxed creep pore collapse dwell time"));
            params.add(new ProcessParameter("Post-Treatment", "HIP Cooling Mode", "Uniform Rapid Cooling (URC)", "", "Controlled furnace cooldown preventing brittle alpha-case formation"));

        } else if (post.equalsIgnoreCase("Stress-relieved")) {
            int stressTemp = betaTransus != null ? Math.min(650, (int) Math.round(betaTransus * 0.65)) : 600;
            steps.add("Thermal Stress Relief: Vacuum furnace heating to " + stressTemp + " °C, dwell 2–4 hours, slow furnace cool to relieve >85% of locked-in residual thermal stresses");
            params.add(new ProcessParameter("Post-Treatment", "Stress Relief Temp", String.valueOf(stressTemp), "°C", "Vacuum furnace stress-relief soak"));
            params.add(new ProcessParameter("Post-Treatment", "Dwell Duration", "2 – 4", "hr", "Soak time in high vacuum (< 1e-4 mbar)"));
            params.add(new ProcessParameter("Post-Treatment", "Cooling Rate", "Slow Furnace Cool (< 5 °C/min)", "", "Prevents reintroduction of thermal contraction gradients"));

        } else if (post.contains("Solution-treated") || post.contains("aged") || post.equalsIgnoreCase("STA")) {
            int solTemp = betaTransus != null ? (int) Math.round(betaTransus - 40) : 920;
            steps.add("Solution Treatment: Heating to " + solTemp + " °C for 60 min followed by rapid water/gas quenching into supersaturated beta phase");
            steps.add("Artificial Aging: Re-heating to 480–540 °C for 6–8 hours to precipitate ultra-fine secondary alpha needles, yielding peak tensile and yield strength");
            params.add(new ProcessParameter("Post-Treatment", "Solution Soak Temp", String.valueOf(solTemp), "°C", "High-temperature alpha-beta phase partitioning"));
            params.add(new ProcessParameter("Post-Treatment", "Quench Medium", "Water Quench / High-Pressure Gas", "", "Freezes metastable beta solid solution"));
            params.add(new ProcessParameter("Post-Treatment", "Aging Temp & Time", "500 °C / 6 hr", "Air Cool", "Controlled coherent alpha precipitation hardening"));

        } else if (post.equalsIgnoreCase("Annealed")) {
            int annealTemp = betaTransus != null ? Math.min(780, (int) Math.round(betaTransus * 0.80)) : 730;
            steps.add("Mill/Duplex Anneal: Heating to " + annealTemp + " °C for 2 hours in vacuum furnace, argon fan cool to achieve stabilized ductility and fracture toughness");
            params.add(new ProcessParameter("Post-Treatment", "Annealing Temp", String.valueOf(annealTemp), "°C", "Sub-transus microstructure stabilization"));
            params.add(new ProcessParameter("Post-Treatment", "Soak Duration", "2.0", "hr", "Homogenization dwell"));

        } else if (post.equalsIgnoreCase("As-built") || post.equalsIgnoreCase("As-deposited") || post.equalsIgnoreCase("As-sintered")) {
            steps.add("Baseline " + post + " State: No secondary thermal cycle applied; retains native rapid-solidification martensitic (alpha-prime) or columnar grain structure with as-deposited residual stresses");
            if (maxStress != null) {
                params.add(new ProcessParameter("Residual State", "Peak Internal Stress", String.format("%.1f", maxStress), "MPa", "As-built residual stress state"));
            }
        }

        // Add metallurgical telemetry safety parameters
        if (liquidus != null) {
            params.add(new ProcessParameter("Metallurgy", "Liquidus Temperature", String.format("%.0f", liquidus), "°C", "Thermodynamic melting onset for process window qualification"));
        }
        if (oxygen != null) {
            params.add(new ProcessParameter("Metallurgy", "Interstitial Oxygen Content", String.format("%.3f", oxygen), "wt. %", "Controlled interstitial pickup; higher O increases strength but reduces ductility"));
        }
        if (surfaceRa != null) {
            params.add(new ProcessParameter("Surface Finish", "Surface Roughness (Ra)", String.format("%.2f", surfaceRa), "µm", "As-processed surface topography"));
        }

        return new ProcessRecipe(subprocess, post, summary, equipment, atmosphere, steps, params);
    }
}
