package com.matsci.model;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Represents a single processed variant of a material.
 * Fully supports the ISO/ASTM 52900 Additive Manufacturing telemetry
 * and comprehensive metallurgy property schema (34 quantitative metrics).
 */
public class MaterialVariant {

    // 1. Identification & Classification
    private final String variantId;
    private final String alloyId;
    private final String alloyName;
    private final String alloyFamily;
    private final String isoAstmCategory;
    private final String subprocess;
    private final String maturity;
    private final String postProcessingCondition;

    // 2. Physical & Mechanical Properties
    private final Double density;
    private final Double relativeDensity;
    private final Double porosity;
    private final Double youngsModulus;
    private final Double yieldStrength;
    private final Double ultimateTensileStrength;
    private final Double elongationAtBreak;
    private final Double hardnessVickers;
    private final Double fractureToughness;
    private final Double poissonsRatio;
    private final Double fatigueStrength;
    private final Double charpyImpactEnergy;
    private final Double dampingLossFactor;
    private final Double longitudinalWaveSpeed;

    // 3. Thermal & Phase Transformation Properties
    private final Double thermalConductivity;
    private final Double thermalExpansionCoeff;
    private final Double specificHeat;
    private final Double liquidusTemperature;
    private final Double betaTransusTemperature;
    private final Double maxServiceTemperature;
    private final Double hemisphericalEmissivity;

    // 4. Electrical, Magnetic & Optical Properties
    private final Double electricalResistivity;
    private final Double volumeMagneticSusceptibility;
    private final Double laserAbsorptivity;
    private final Double visibleReflectance;

    // 5. Chemical, Biological & Environmental Properties
    private final Double corrosionResistanceRating;
    private final Double biocompatibilityRating;
    private final Double oxygenContent;

    // 6. Additive Manufacturing & Geometric Quality Metrics
    private final Double surfaceRoughnessRa;
    private final Double residualStressMax;
    private final Double buildDirectionAnisotropy;
    private final Double minimumFeatureSize;
    private final Double dimensionalAccuracy;
    private final Double buildRate;

    // Enriched Process Recipe
    private ProcessRecipe recipe;

    public MaterialVariant(
        String variantId, String alloyId, String alloyName, String alloyFamily,
        String isoAstmCategory, String subprocess, String maturity, String postProcessingCondition,
        Double density, Double relativeDensity, Double porosity,
        Double youngsModulus, Double yieldStrength, Double ultimateTensileStrength, Double elongationAtBreak,
        Double hardnessVickers, Double fractureToughness, Double poissonsRatio,
        Double fatigueStrength, Double charpyImpactEnergy, Double dampingLossFactor, Double longitudinalWaveSpeed,
        Double thermalConductivity, Double thermalExpansionCoeff, Double specificHeat,
        Double liquidusTemperature, Double betaTransusTemperature, Double maxServiceTemperature,
        Double hemisphericalEmissivity,
        Double electricalResistivity, Double volumeMagneticSusceptibility, Double laserAbsorptivity, Double visibleReflectance,
        Double corrosionResistanceRating, Double biocompatibilityRating, Double oxygenContent,
        Double surfaceRoughnessRa, Double residualStressMax, Double buildDirectionAnisotropy,
        Double minimumFeatureSize, Double dimensionalAccuracy, Double buildRate
    ) {
        this.variantId = variantId;
        this.alloyId = alloyId;
        this.alloyName = alloyName;
        this.alloyFamily = alloyFamily;
        this.isoAstmCategory = isoAstmCategory;
        this.subprocess = subprocess;
        this.maturity = maturity;
        this.postProcessingCondition = postProcessingCondition;

        this.density = density;
        this.relativeDensity = relativeDensity;
        this.porosity = porosity;
        this.youngsModulus = youngsModulus;
        this.yieldStrength = yieldStrength;
        this.ultimateTensileStrength = ultimateTensileStrength;
        this.elongationAtBreak = elongationAtBreak;
        this.hardnessVickers = hardnessVickers;
        this.fractureToughness = fractureToughness;
        this.poissonsRatio = poissonsRatio;
        this.fatigueStrength = fatigueStrength;
        this.charpyImpactEnergy = charpyImpactEnergy;
        this.dampingLossFactor = dampingLossFactor;
        this.longitudinalWaveSpeed = longitudinalWaveSpeed;

        this.thermalConductivity = thermalConductivity;
        this.thermalExpansionCoeff = thermalExpansionCoeff;
        this.specificHeat = specificHeat;
        this.liquidusTemperature = liquidusTemperature;
        this.betaTransusTemperature = betaTransusTemperature;
        this.maxServiceTemperature = maxServiceTemperature;
        this.hemisphericalEmissivity = hemisphericalEmissivity;

        this.electricalResistivity = electricalResistivity;
        this.volumeMagneticSusceptibility = volumeMagneticSusceptibility;
        this.laserAbsorptivity = laserAbsorptivity;
        this.visibleReflectance = visibleReflectance;

        this.corrosionResistanceRating = corrosionResistanceRating;
        this.biocompatibilityRating = biocompatibilityRating;
        this.oxygenContent = oxygenContent;

        this.surfaceRoughnessRa = surfaceRoughnessRa;
        this.residualStressMax = residualStressMax;
        this.buildDirectionAnisotropy = buildDirectionAnisotropy;
        this.minimumFeatureSize = minimumFeatureSize;
        this.dimensionalAccuracy = dimensionalAccuracy;
        this.buildRate = buildRate;
    }

    // Getters for primary identifiers
    public String getVariantId() { return variantId; }
    public String getAlloyId() { return alloyId; }
    public String getAlloyName() { return alloyName; }
    public String getAlloyFamily() { return alloyFamily; }
    public String getIsoAstmCategory() { return isoAstmCategory; }
    public String getSubprocess() { return subprocess; }
    public String getMaturity() { return maturity; }
    public String getPostProcessingCondition() { return postProcessingCondition; }

    // Backwards-compatible aliases
    public String getMaterialId() { return alloyId; }
    public String getName() { return alloyName; }
    public String getMaterialClass() { return isoAstmCategory != null ? isoAstmCategory : "Powder Bed Fusion"; }
    public String getSubclass() { return getAlloyFamilyFullName(); }
    public String getProcessRoute() { return isoAstmCategory != null ? isoAstmCategory : "Powder Bed Fusion"; }
    public String getPostTreatment() { return postProcessingCondition; }
    public Double getMeltingOrSofteningPoint() { return liquidusTemperature; }

    public String getAlloyFamilyFullName() {
        if (alloyFamily == null) return "Titanium Alloy";
        return switch (alloyFamily.toLowerCase().trim()) {
            case "cp" -> "Commercially Pure (CP)";
            case "ab" -> "Alpha-Beta (α-β)";
            case "na" -> "Near-Alpha (Near-α)";
            case "nb" -> "Near-Beta (Near-β)";
            case "b"  -> "Metastable Beta (β)";
            case "g"  -> "Gamma Titanium Aluminide (γ-TiAl)";
            default   -> alloyFamily;
        };
    }

    // Physical & Mechanical Getters
    public Double getDensity() { return density; }
    public Double getRelativeDensity() { return relativeDensity; }
    public Double getPorosity() { return porosity; }
    public Double getYoungsModulus() { return youngsModulus; }
    public Double getYieldStrength() { return yieldStrength; }
    public Double getUltimateTensileStrength() { return ultimateTensileStrength; }
    public Double getElongationAtBreak() { return elongationAtBreak; }
    public Double getHardnessVickers() { return hardnessVickers; }
    public Double getFractureToughness() { return fractureToughness; }
    public Double getPoissonsRatio() { return poissonsRatio; }
    public Double getFatigueStrength() { return fatigueStrength; }
    public Double getCharpyImpactEnergy() { return charpyImpactEnergy; }
    public Double getDampingLossFactor() { return dampingLossFactor; }
    public Double getLongitudinalWaveSpeed() { return longitudinalWaveSpeed; }

    // Thermal Getters
    public Double getThermalConductivity() { return thermalConductivity; }
    public Double getThermalExpansionCoeff() { return thermalExpansionCoeff; }
    public Double getSpecificHeat() { return specificHeat; }
    public Double getLiquidusTemperature() { return liquidusTemperature; }
    public Double getBetaTransusTemperature() { return betaTransusTemperature; }
    public Double getMaxServiceTemperature() { return maxServiceTemperature; }
    public Double getHemisphericalEmissivity() { return hemisphericalEmissivity; }

    // Electrical & Optical Getters
    public Double getElectricalResistivity() { return electricalResistivity; }
    public Double getVolumeMagneticSusceptibility() { return volumeMagneticSusceptibility; }
    public Double getLaserAbsorptivity() { return laserAbsorptivity; }
    public Double getVisibleReflectance() { return visibleReflectance; }

    // Chemical & Environmental Getters
    public Double getCorrosionResistanceRating() { return corrosionResistanceRating; }
    public Double getBiocompatibilityRating() { return biocompatibilityRating; }
    public Double getOxygenContent() { return oxygenContent; }

    // AM & Quality Metrics Getters
    public Double getSurfaceRoughnessRa() { return surfaceRoughnessRa; }
    public Double getResidualStressMax() { return residualStressMax; }
    public Double getBuildDirectionAnisotropy() { return buildDirectionAnisotropy; }
    public Double getMinimumFeatureSize() { return minimumFeatureSize; }
    public Double getDimensionalAccuracy() { return dimensionalAccuracy; }
    public Double getBuildRate() { return buildRate; }

    public ProcessRecipe getRecipe() { return recipe; }
    public void setRecipe(ProcessRecipe recipe) { this.recipe = recipe; }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new LinkedHashMap<>();

        // 1. Identification
        map.put("variantId", variantId);
        map.put("alloyId", alloyId);
        map.put("alloyName", alloyName);
        map.put("alloyFamily", alloyFamily);
        map.put("alloyFamilyName", getAlloyFamilyFullName());
        map.put("isoAstmCategory", isoAstmCategory);
        map.put("subprocess", subprocess);
        map.put("maturity", maturity);
        map.put("postProcessingCondition", postProcessingCondition);

        // Aliases for compatibility
        map.put("materialId", alloyId);
        map.put("name", alloyName);
        map.put("materialClass", getMaterialClass());
        map.put("subclass", getAlloyFamilyFullName());
        map.put("processRoute", getProcessRoute());
        map.put("postTreatment", postProcessingCondition);

        // 2. Mechanical Properties
        Map<String, Object> mechanical = new LinkedHashMap<>();
        putIfNotNull(mechanical, "density", density, "g/cm³");
        putIfNotNull(mechanical, "youngsModulus", youngsModulus, "GPa");
        putIfNotNull(mechanical, "yieldStrength", yieldStrength, "MPa");
        putIfNotNull(mechanical, "ultimateTensileStrength", ultimateTensileStrength, "MPa");
        putIfNotNull(mechanical, "elongationAtBreak", elongationAtBreak, "%");
        putIfNotNull(mechanical, "hardnessVickers", hardnessVickers, "HV");
        putIfNotNull(mechanical, "fractureToughness", fractureToughness, "MPa·m⁰·⁵");
        putIfNotNull(mechanical, "poissonsRatio", poissonsRatio, "");
        putIfNotNull(mechanical, "fatigueStrength", fatigueStrength, "MPa (10⁷ cycles)");
        putIfNotNull(mechanical, "charpyImpactEnergy", charpyImpactEnergy, "J");
        putIfNotNull(mechanical, "dampingLossFactor", dampingLossFactor, "");
        putIfNotNull(mechanical, "longitudinalWaveSpeed", longitudinalWaveSpeed, "m/s");
        map.put("mechanicalProperties", mechanical);

        // 3. Thermal Properties & Phase Transitions
        Map<String, Object> thermal = new LinkedHashMap<>();
        putIfNotNull(thermal, "thermalConductivity", thermalConductivity, "W/m·K");
        putIfNotNull(thermal, "thermalExpansionCoeff", thermalExpansionCoeff, "10⁻⁶/K");
        putIfNotNull(thermal, "specificHeat", specificHeat, "J/kg·K");
        putIfNotNull(thermal, "liquidusTemperature", liquidusTemperature, "°C");
        putIfNotNull(thermal, "betaTransusTemperature", betaTransusTemperature, "°C");
        putIfNotNull(thermal, "maxServiceTemperature", maxServiceTemperature, "°C");
        putIfNotNull(thermal, "hemisphericalEmissivity", hemisphericalEmissivity, "");
        map.put("thermalProperties", thermal);

        // 4. Electrical, Magnetic & Optical Properties
        Map<String, Object> electroOptical = new LinkedHashMap<>();
        putIfNotNull(electroOptical, "electricalResistivity", electricalResistivity, "Ω·m");
        putIfNotNull(electroOptical, "volumeMagneticSusceptibility", volumeMagneticSusceptibility, "10⁻⁶ SI");
        putIfNotNull(electroOptical, "laserAbsorptivity", laserAbsorptivity, "@ 1070 nm");
        putIfNotNull(electroOptical, "visibleReflectance", visibleReflectance, "%");
        map.put("electricalAndOpticalProperties", electroOptical);

        // 5. Chemical & Environmental Durability
        Map<String, Object> durability = new LinkedHashMap<>();
        putIfNotNull(durability, "corrosionResistanceRating", corrosionResistanceRating, "/ 5.0");
        putIfNotNull(durability, "biocompatibilityRating", biocompatibilityRating, "/ 5.0");
        putIfNotNull(durability, "oxygenContent", oxygenContent, "wt. %");
        map.put("durabilityProperties", durability);

        // 6. Additive Manufacturing & Geometric Quality Metrics
        Map<String, Object> amMetrics = new LinkedHashMap<>();
        putIfNotNull(amMetrics, "relativeDensity", relativeDensity, "%");
        putIfNotNull(amMetrics, "porosity", porosity, "%");
        putIfNotNull(amMetrics, "surfaceRoughnessRa", surfaceRoughnessRa, "µm");
        putIfNotNull(amMetrics, "residualStressMax", residualStressMax, "MPa");
        putIfNotNull(amMetrics, "buildDirectionAnisotropy", buildDirectionAnisotropy, "%");
        putIfNotNull(amMetrics, "minimumFeatureSize", minimumFeatureSize, "mm");
        putIfNotNull(amMetrics, "dimensionalAccuracy", dimensionalAccuracy, "± mm");
        putIfNotNull(amMetrics, "buildRate", buildRate, "cm³/h");
        map.put("additiveManufacturingMetrics", amMetrics);

        // 7. Enriched Process Recipe
        if (recipe != null) {
            map.put("recipe", recipe.toMap());
        }

        return map;
    }

    private void putIfNotNull(Map<String, Object> map, String key, Double val, String unit) {
        if (val != null) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("value", val);
            item.put("unit", unit);
            map.put(key, item);
        }
    }
}
