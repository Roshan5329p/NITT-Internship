package com.nit.am.model;

/**
 * Domain entity representing an Additive Manufacturing dataset record
 * for Ti-6Al-4V synthesized from research literature.
 */
public class AmRecord {
    public int paperNumber;
    public String title = "";
    public String authors = "";
    public int year = 2022;
    public String amProcess = "LPBF";
    public String material = "Ti-6Al-4V";
    public String pdfFilename = "";

    // Process Parameters
    public double laserPowerW = 0.0;
    public double scanSpeedMms = 0.0;
    public double layerThicknessUm = 30.0;
    public double hatchSpacingUm = 100.0;
    public double energyDensityJmm3 = 0.0;
    public double wireFeedMMin = 0.0;
    public double powderFeedGMin = 0.0;
    public String scanStrategy = "";

    // Thermal Physics
    public double meltPoolWidthUm = 0.0;
    public double meltPoolDepthUm = 0.0;
    public double peakTemperatureK = 2200.0;
    public double coolingRateKs = 1.0e6;
    public double thermalGradientGm = 3.0e6;
    public double solidificationRateRms = 0.2;
    public double residualStressMpa = 0.0;
    public double distortionMm = 0.0;
    public String defectRegime = "conduction";

    // Microstructure
    public String condition = "as-built";
    public String phasesIdentified = "alpha_prime";
    public double alphaFractionPct = 0.0;
    public double betaFractionPct = 2.0;
    public double alphaPrimeFractionPct = 98.0;
    public double alphaLathThicknessUm = 0.7;
    public double priorBetaGrainWidthUm = 60.0;
    public String priorBetaMorphology = "columnar";
    public String characterizationMethods = "SEM,XRD";

    // Mechanical Properties
    public String testDirection = "horizontal (XY)";
    public double yieldStrengthMpa = 0.0;
    public double utsMpa = 0.0;
    public double elongationPct = 0.0;
    public double vickersHv = 0.0;
    public double fractureToughnessKic = 0.0;
    public double charpyImpactJ = 0.0;
    public double fatigueLimitMpa = 0.0;
    public boolean astmF2924Compliant = false;
    public boolean astmF3001Compliant = false;

    // Computational / Prediction
    public String modelType = "";
    public String targetProperty = "";
    public double predictedValue = 0.0;
    public double modelAccuracyR2 = 0.95;

    public double calculateVolumetricEnergyDensity() {
        if (scanSpeedMms > 0 && hatchSpacingUm > 0 && layerThicknessUm > 0) {
            return (laserPowerW * 1e6) / (scanSpeedMms * hatchSpacingUm * layerThicknessUm);
        }
        return energyDensityJmm3;
    }

    public double getMeltPoolAspectRatio() {
        return (meltPoolWidthUm > 0) ? (meltPoolDepthUm / meltPoolWidthUm) : 0.0;
    }
}
