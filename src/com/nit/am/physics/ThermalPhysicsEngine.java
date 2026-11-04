package com.nit.am.physics;

import com.nit.am.model.AmRecord;

/**
 * Analytical Thermal Physics & Defect Boundary Engine for Ti-6Al-4V Additive Manufacturing.
 * Zero external dependencies.
 */
public class ThermalPhysicsEngine {

    // Thermophysical properties of Ti-6Al-4V (Grade 5 / ELI)
    public static final double DENSITY = 4430.0;             // kg/m^3
    public static final double SPECIFIC_HEAT = 560.0;        // J/(kg*K)
    public static final double THERMAL_CONDUCTIVITY = 7.0;   // W/(m*K)
    public static final double MELTING_TEMP_K = 1928.0;      // K (1655 °C)
    public static final double BOILING_TEMP_K = 3560.0;      // K (3287 °C)
    public static final double ROOM_TEMP_K = 298.0;          // K (25 °C)
    public static final double DEFAULT_ABSORPTIVITY = 0.35;  // 1064 nm fiber laser on Ti powder

    public static class PhysicsResult {
        public double volumetricEnergyDensity;
        public double linearHeatInputJmm;
        public double estimatedMeltPoolDepthUm;
        public double estimatedMeltPoolWidthUm;
        public double estimatedCoolingRateKs;
        public double aspectRatio;
        public String defectRegime;
        public boolean isSafeWindow;
    }

    /**
     * Evaluates melt pool geometry, cooling rate, and defect regime for a given parameter set.
     */
    public static PhysicsResult evaluate(double powerW, double speedMms, double layerUm, double hatchUm) {
        PhysicsResult res = new PhysicsResult();

        // 1. Energy Density Metrics
        if (speedMms > 0 && hatchUm > 0 && layerUm > 0) {
            res.volumetricEnergyDensity = (powerW * 1e6) / (speedMms * hatchUm * layerUm);
            res.linearHeatInputJmm = powerW / speedMms;
        }

        // 2. Analytical Rosenthal Melt Pool Approximations
        double speedMs = speedMms / 1000.0;
        double deltaT = MELTING_TEMP_K - ROOM_TEMP_K;
        double heatCapacityVol = DENSITY * SPECIFIC_HEAT; // J/(m^3*K)

        if (speedMs > 0 && powerW > 0) {
            // Analytical depth approximation (Roshal / King et al.):
            // d ~ sqrt( (2 * eta * P) / (pi * e * rho * Cp * deltaT * v) )
            double effectivePower = DEFAULT_ABSORPTIVITY * powerW;
            double depthM = Math.sqrt((2.0 * effectivePower) / (Math.PI * Math.E * heatCapacityVol * deltaT * speedMs));
            res.estimatedMeltPoolDepthUm = depthM * 1e6;

            // Width ~ 2 * depth for standard conduction mode
            res.estimatedMeltPoolWidthUm = res.estimatedMeltPoolDepthUm * 2.05;

            // Cooling rate (dT/dt ~ 2 * pi * k * v / (eta * P) * (Tm - T0)^2)
            res.estimatedCoolingRateKs = (2.0 * Math.PI * THERMAL_CONDUCTIVITY * speedMs / effectivePower) * (deltaT * deltaT);
        }

        res.aspectRatio = (res.estimatedMeltPoolWidthUm > 0) ? (res.estimatedMeltPoolDepthUm / res.estimatedMeltPoolWidthUm) : 0.0;

        // 3. Defect Regime Classification
        if (speedMms > 1650.0) {
            res.defectRegime = "balling";
            res.isSafeWindow = false;
        } else if (res.volumetricEnergyDensity < 55.0 || res.estimatedMeltPoolDepthUm < (1.4 * layerUm)) {
            res.defectRegime = "lack_of_fusion";
            res.isSafeWindow = false;
        } else if (res.volumetricEnergyDensity > 95.0 || res.aspectRatio > 0.8) {
            res.defectRegime = "keyhole";
            res.isSafeWindow = false;
        } else {
            res.defectRegime = "conduction (optimal)";
            res.isSafeWindow = true;
        }

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
            PhysicsResult res = evaluate(rec.laserPowerW, rec.scanSpeedMms, rec.layerThicknessUm, rec.hatchSpacingUm);
            if (rec.meltPoolDepthUm <= 0) rec.meltPoolDepthUm = res.estimatedMeltPoolDepthUm;
            if (rec.meltPoolWidthUm <= 0) rec.meltPoolWidthUm = res.estimatedMeltPoolWidthUm;
            if (rec.coolingRateKs <= 0) rec.coolingRateKs = res.estimatedCoolingRateKs;
            if (rec.defectRegime == null || rec.defectRegime.isEmpty()) rec.defectRegime = res.defectRegime;
        }
    }
}
