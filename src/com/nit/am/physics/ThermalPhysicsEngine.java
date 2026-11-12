package com.nit.am.physics;

import com.nit.am.model.AmRecord;

/**
 * Analytical Thermal Physics, Solidification Kinetics & Defect Boundary Engine for Ti-6Al-4V AM.
 * Formulations strictly calibrated from:
 * 1. Coen, Goossens, Van Hooreweder (2022) - Combined conduction/keyhole melt pool models (JMPT 304, 117547)
 * 2. Bontha, Klingbeil, Kobryn, Fraser (2006, 2009) - 2D & 3D Rosenthal thermal process maps and G vs. R solidification maps
 * 3. Cao, Zou, Lim, Wu (2021) - LPBF Ti-6Al-4V process-microstructure-property relationships (Light: Adv. Manuf. 2:20)
 * 4. Guo, Lin, Hu, Wu (2025) - Wire + Arc Additive Manufacturing process control & evaluation (Micromachines 16, 749)
 *
 * Zero external dependencies. Runs natively on pure JDK 21+.
 */
public class ThermalPhysicsEngine {

    // Thermophysical properties of Ti-6Al-4V (at melting point, Coen et al. 2022, Table 3)
    public static final double DENSITY = 4189.0;                  // kg/m^3 (at melting point)
    public static final double SPECIFIC_HEAT = 759.0;             // J/(kg*K)
    public static final double THERMAL_CONDUCTIVITY = 28.4;        // W/(m*K)
    public static final double MELTING_TEMP_K = 1923.0;           // K (1650 °C)
    public static final double BOILING_TEMP_K = 3573.0;           // K (3300 °C)
    public static final double ROOM_TEMP_K = 298.0;               // K (25 °C)
    public static final double LATENT_HEAT_FUSION = 365000.0;     // J/kg (365 kJ/kg)
    public static final double DEFAULT_ABSORPTIVITY = 0.40;       // Ti-6Al-4V laser absorptivity (Zhou/Keller)

    // Derived thermal diffusivity D = k / (rho * Cp)
    public static final double THERMAL_DIFFUSIVITY = THERMAL_CONDUCTIVITY / (DENSITY * SPECIFIC_HEAT); // ~8.93e-6 m^2/s

    public static class PhysicsResult {
        public double volumetricEnergyDensity;
        public double linearHeatInputJmm;
        public double pecletNumber;
        public double normalizedEnthalpy;
        public double estimatedMeltPoolWidthUm;
        public double estimatedMeltPoolDepthUm;
        public double estimatedMeltPoolLengthUm;
        public double aspectRatio;                         // R = d / w
        public double estimatedCoolingRateKs;              // dT/dt (K/s)
        public double thermalGradientG;                    // G (K/m)
        public double solidificationRateR;                 // R_sol = (dT/dt) / G (m/s)
        public double cellSpacingLambdaUm;                 // Secondary dendrite / martensite lath width (µm)
        public String grainMorphology;                     // Fully Columnar, Mixed, or Fully Equiaxed (Bontha et al.)
        public String defectRegime;                        // Conduction (optimal), Lack of Fusion, Keyholing, Balling
        public boolean isSafeWindow;
        public double relativeDensityPct;                  // Analytical densification (%)
    }

    /**
     * Normalizes an AM process identifier to one of: lpbf, ded-laser, waam, binder-jetting.
     */
    public static String normalizeProcess(String process) {
        if (process == null) return "lpbf";
        String p = process.trim().toLowerCase();
        if (p.contains("waam") || p.contains("wire arc") || p.contains("wire+arc") || p.contains("cmt")) {
            return "waam";
        }
        if (p.contains("ded") || p.contains("lmd") || p.contains("lens") || p.contains("clad")) {
            return "ded-laser";
        }
        if (p.contains("binder")) {
            return "binder-jetting";
        }
        return "lpbf";
    }

    /**
     * Evaluates melt pool dimensions, solidification kinematics, and defect regimes.
     */
    public static PhysicsResult evaluate(double powerW, double speedMms, double layerUm, double hatchUm) {
        return evaluateForProcess("lpbf", powerW, speedMms, layerUm, hatchUm, 80.0, 200.0, DEFAULT_ABSORPTIVITY);
    }

    /**
     * Full parametric physics evaluation including beam spot size, substrate preheat, and optical absorptivity.
     */
    public static PhysicsResult evaluateExtended(double powerW, double speedMms, double layerUm, double hatchUm,
                                                 double spotDiameterUm, double preheatC, double absorptivity) {
        return evaluateForProcess("lpbf", powerW, speedMms, layerUm, hatchUm, spotDiameterUm, preheatC, absorptivity);
    }

    /**
     * Process-aware analytical physics evaluation supporting LPBF, L-DED, WAAM, and Binder Jetting.
     * Preserves KU Leuven (Coen 2022) / Rosenthal / Bontha equations for LPBF and switches absorption,
     * power-density conduction vs. keyhole scaling, and linear heat input (P/v) process windows for DED/WAAM.
     */
    private static double finiteOrDefault(double val, double fallback, double min, double max) {
        if (!Double.isFinite(val)) return fallback;
        return Math.min(max, Math.max(min, val));
    }

    public static PhysicsResult evaluateForProcess(String process, double powerW, double speedMms, double layerUm, double hatchUm,
                                                   double spotDiameterUm, double preheatC, double absorptivity) {
        PhysicsResult res = new PhysicsResult();
        String proc = normalizeProcess(process);
        boolean isDed = proc.equals("ded-laser");
        boolean isWaam = proc.equals("waam");

        powerW = finiteOrDefault(powerW, isWaam ? 2400.0 : (isDed ? 1600.0 : 250.0), 10.0, 50000.0);
        speedMms = finiteOrDefault(speedMms, isWaam ? 8.0 : (isDed ? 15.0 : 1000.0), 0.1, 20000.0);
        layerUm = finiteOrDefault(layerUm, isWaam ? 1500.0 : (isDed ? 450.0 : 30.0), 1.0, 10000.0);
        hatchUm = finiteOrDefault(hatchUm, isWaam ? 3500.0 : (isDed ? 1200.0 : 100.0), 1.0, 20000.0);
        spotDiameterUm = finiteOrDefault(spotDiameterUm, isWaam ? 3000.0 : (isDed ? 1500.0 : 80.0), 5.0, 20000.0);
        preheatC = finiteOrDefault(preheatC, 200.0, 0.0, 1600.0);

        double vMs = Math.max(0.001, speedMms / 1000.0);
        double aBeamRadiusM = Math.max(1e-6, (spotDiameterUm / 2.0) * 1e-6); // beam / arc radius a
        double t0K = 273.15 + Math.max(20.0, preheatC);
        double deltaTm = Math.max(50.0, MELTING_TEMP_K - t0K);
        double deltaTb = Math.max(100.0, BOILING_TEMP_K - t0K);

        double defaultEta = isWaam ? 0.78 : (isDed ? 0.38 : DEFAULT_ABSORPTIVITY);
        double eta = (Double.isFinite(absorptivity) && absorptivity > 0.0 && absorptivity <= 1.0) ? absorptivity : defaultEta;
        double absorbedPower = powerW * eta;

        // 1. Energy Density & Linear Heat Input
        if (speedMms > 0 && hatchUm > 0 && layerUm > 0) {
            res.volumetricEnergyDensity = (powerW * 1e6) / (speedMms * hatchUm * layerUm);
            res.linearHeatInputJmm = powerW / speedMms;
        }

        // 2. Coen et al. (2022) Dimensionless Parameters
        // Péclet number: Pe = v * a / D
        res.pecletNumber = (vMs * aBeamRadiusM) / THERMAL_DIFFUSIVITY;

        // Specific melt enthalpy: hs = rho * Cp * (Tm - T0) + rho * Lf
        double meltEnthalpyHs = (DENSITY * SPECIFIC_HEAT * deltaTm) + (DENSITY * LATENT_HEAT_FUSION);

        // Normalized enthalpy: DeltaH / hs = (2^(3/4) * eta * P) / (hs * sqrt(pi * D * v * a^3))
        double denom = meltEnthalpyHs * Math.sqrt(Math.PI * THERMAL_DIFFUSIVITY * vMs * Math.pow(aBeamRadiusM, 3));
        res.normalizedEnthalpy = (Math.pow(2.0, 0.75) * absorbedPower) / Math.max(1e-12, denom);

        // 3. Absolute Melt Pool Dimensions
        // Conduction width w from Rubenchik / Eagar-Tsai / Rosenthal moving heat source
        double widthConductionM = Math.sqrt((8.0 * absorbedPower) / (Math.PI * Math.E * DENSITY * SPECIFIC_HEAT * deltaTm * vMs));
        res.estimatedMeltPoolWidthUm = Math.max(spotDiameterUm * 0.6, widthConductionM * 1e6 * 0.75 + spotDiameterUm * 0.4);

        // Keyhole aspect ratio R = d / w vs. broad-beam conduction-dilution mode (Coen et al. 2022 / Fabbro)
        double pe = Math.max(0.05, Math.min(20.0, res.pecletNumber));
        double yRecoil = absorbedPower / (2.0 * aBeamRadiusM * THERMAL_CONDUCTIVITY * deltaTb);
        double bFabbro = 0.1488 * Math.pow(pe, -0.79);
        double rKeyhole = yRecoil * bFabbro;

        if (isDed || isWaam) {
            double spotDiameterM = Math.max(1e-5, spotDiameterUm * 1e-6);
            double areaM2 = Math.PI * 0.25 * spotDiameterM * spotDiameterM;
            double intensityWcm2 = (absorbedPower / areaM2) / 1.0e4; // W/cm^2
            // Broad L-DED blown-powder & WAAM arc pools operate in conduction-dilution (d/w ~ 0.28..0.52)
            // unless power density exceeds laser keyhole drilling threshold (~1.5e5 W/cm^2)
            double conductionAspect = (isWaam ? 0.26 : 0.28)
                    + Math.min(0.24, res.linearHeatInputJmm * (isWaam ? 0.00045 : 0.0012));
            if (intensityWcm2 > 1.5e5) {
                double khBlend = Math.min(1.0, (intensityWcm2 - 1.5e5) / 2.5e5);
                res.aspectRatio = Math.max(0.22, Math.min(3.5,
                        conductionAspect * (1.0 - khBlend) + Math.min(3.5, rKeyhole) * khBlend));
            } else {
                res.aspectRatio = Math.max(0.22, Math.min(0.85, conductionAspect));
            }
        } else {
            // In LPBF, Coen/Fabbro recoil polynomial captures conduction-to-keyhole transition cleanly
            res.aspectRatio = Math.max(0.25, Math.min(3.5, rKeyhole));
        }

        res.estimatedMeltPoolDepthUm = res.estimatedMeltPoolWidthUm * res.aspectRatio;
        double lengthFactor = (isDed || isWaam) ? (1.35 + 0.015 * Math.min(40.0, speedMms)) : (1.2 + 0.0012 * speedMms);
        res.estimatedMeltPoolLengthUm = res.estimatedMeltPoolWidthUm * lengthFactor;

        // 4. Solidification Kinetics & Bontha et al. (2009) Solidification Map
        // Solidus cooling rate dT/dt (K/s); apply quasi-2D/interpass thermal accumulation factor for DED/WAAM
        double thermalAccumFactor = isWaam ? 0.15 : (isDed ? 0.45 : 1.0);
        res.estimatedCoolingRateKs = thermalAccumFactor * (2.0 * Math.PI * THERMAL_CONDUCTIVITY * vMs * Math.pow(deltaTm, 2)) / Math.max(5.0, absorbedPower);
        double minCooling = (isDed || isWaam) ? 1.0 : 1e2;
        res.estimatedCoolingRateKs = Math.max(minCooling, Math.min(5e7, res.estimatedCoolingRateKs));

        // Solidification rate R_sol (m/s) along trailing solidification front
        res.solidificationRateR = vMs * 0.72;

        // Thermal gradient G (K/m) = (dT/dt) / R_sol
        res.thermalGradientG = res.estimatedCoolingRateKs / Math.max(1e-4, res.solidificationRateR);

        // Grain morphology boundaries from Bontha, Klingbeil et al. (2006, 2009) CET curve
        String cetClass = BonthaSolidificationModel.classifyMorphology(res.thermalGradientG / 100.0, res.solidificationRateR * 100.0);
        if (cetClass.equals("Columnar")) {
            res.grainMorphology = isWaam ? "Coarse Columnar (Epitaxial prior-β + α/β)" : "Fully Columnar (Epitaxial prior-β grains)";
        } else if (cetClass.equals("Mixed")) {
            res.grainMorphology = "Mixed (Columnar + Equiaxed transition at surface)";
        } else {
            res.grainMorphology = isWaam
                    ? "Refined / Mixed Equiaxed-Lamellar (Slow arc cooling)"
                    : "Fully Equiaxed (High power / large scale melt pool)";
        }

        // Secondary dendrite / α lath spacing scale (Cao et al. 2021)
        res.cellSpacingLambdaUm = Math.max(0.15, Math.min(4.5, 18.5 * Math.pow(res.estimatedCoolingRateKs, -0.38)));

        // 5. Process-Aware Defect Regime Boundaries
        double penetrationRatio = res.estimatedMeltPoolDepthUm / Math.max(1.0, layerUm);
        double lofIndex = 1.35 / Math.max(0.1, penetrationRatio);
        double keyholeRatio = res.aspectRatio;
        double ballingRatio = res.estimatedMeltPoolLengthUm / (res.estimatedMeltPoolWidthUm * Math.PI);

        if (isWaam) {
            if (res.linearHeatInputJmm < 120.0 || lofIndex > 1.10) {
                res.defectRegime = "lack_of_fusion";
                res.isSafeWindow = false;
            } else if (speedMms > 25.0 || ballingRatio > 1.45) {
                res.defectRegime = "balling";
                res.isSafeWindow = false;
            } else if (res.linearHeatInputJmm > 600.0 || keyholeRatio > 0.95) {
                res.defectRegime = "overheating";
                res.isSafeWindow = false;
            } else {
                res.defectRegime = "conduction (optimal)";
                res.isSafeWindow = true;
            }
        } else if (isDed) {
            if (speedMms > 60.0 || ballingRatio > 1.45) {
                res.defectRegime = "balling";
                res.isSafeWindow = false;
            } else if (res.linearHeatInputJmm < 75.0 || lofIndex > 1.05) {
                res.defectRegime = "lack_of_fusion";
                res.isSafeWindow = false;
            } else if (res.linearHeatInputJmm > 240.0 || keyholeRatio > 0.95) {
                res.defectRegime = keyholeRatio > 0.95 ? "keyhole" : "overheating";
                res.isSafeWindow = false;
            } else {
                res.defectRegime = "conduction (optimal)";
                res.isSafeWindow = true;
            }
        } else {
            if (speedMms > 1650.0 || ballingRatio > 1.05) {
                res.defectRegime = "balling";
                res.isSafeWindow = false;
            } else if (res.volumetricEnergyDensity < 55.0 || lofIndex > 1.05) {
                res.defectRegime = "lack_of_fusion";
                res.isSafeWindow = false;
            } else if (res.volumetricEnergyDensity > 95.0 || keyholeRatio > 1.15) {
                res.defectRegime = "keyhole";
                res.isSafeWindow = false;
            } else {
                res.defectRegime = "conduction (optimal)";
                res.isSafeWindow = true;
            }
        }

        // 6. Relative Density
        double excessHeatPenalty = 0.0;
        if (isWaam && res.linearHeatInputJmm > 600.0) excessHeatPenalty = (res.linearHeatInputJmm - 600.0) * 0.015;
        else if (isDed && res.linearHeatInputJmm > 240.0) excessHeatPenalty = (res.linearHeatInputJmm - 240.0) * 0.025;
        else if (!isWaam && !isDed && keyholeRatio > 1.1) excessHeatPenalty = (keyholeRatio - 1.1) * 5.0;

        double lofHiPenalty = 0.0;
        if (isWaam && res.linearHeatInputJmm < 120.0) lofHiPenalty = (120.0 - res.linearHeatInputJmm) * 0.04;
        else if (isDed && res.linearHeatInputJmm < 75.0) lofHiPenalty = (75.0 - res.linearHeatInputJmm) * 0.06;

        double density = 99.85 - (lofIndex > 1 ? (lofIndex - 1) * 8.5 : 0)
                               - lofHiPenalty
                               - excessHeatPenalty
                               - ((isDed || isWaam) ? 0.0 : (ballingRatio > 1.05 ? (ballingRatio - 1.05) * 6.5 : 0));
        res.relativeDensityPct = Math.max(88.0, Math.min(99.95, density));

        return res;
    }

    /**
     * Enriches an AmRecord with evaluated physics if missing.
     */
    public static void enrich(AmRecord rec) {
        if (rec.energyDensityJmm3 <= 0) {
            rec.energyDensityJmm3 = rec.calculateVolumetricEnergyDensity();
        }
        if (rec.laserPowerW > 0 && rec.scanSpeedMms > 0) {
            String proc = normalizeProcess(rec.amProcess);
            double spot = proc.equals("waam") ? 3000.0 : (proc.equals("ded-laser") ? 1500.0 : 80.0);
            PhysicsResult res = evaluateForProcess(proc, rec.laserPowerW, rec.scanSpeedMms, rec.layerThicknessUm, rec.hatchSpacingUm, spot, 150.0, -1.0);
            if (rec.meltPoolDepthUm <= 0) rec.meltPoolDepthUm = res.estimatedMeltPoolDepthUm;
            if (rec.meltPoolWidthUm <= 0) rec.meltPoolWidthUm = res.estimatedMeltPoolWidthUm;
            if (rec.coolingRateKs <= 0) rec.coolingRateKs = res.estimatedCoolingRateKs;
            if (rec.defectRegime == null || rec.defectRegime.isEmpty()) rec.defectRegime = res.defectRegime;
        }
    }
}
