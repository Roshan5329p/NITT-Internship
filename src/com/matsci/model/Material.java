package com.matsci.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Represents a parent Titanium Alloy entity (e.g., "Ti-6Al-4V (Grade 5)", "Ti Grade 2 (CP)"),
 * which encapsulates multiple additive manufacturing subprocess variants.
 */
public class Material {
    private final String materialId;
    private final String name;
    private final String alloyFamily;
    private final String materialClass;
    private final String subclass;
    private final List<MaterialVariant> variants = new ArrayList<>();

    public Material(String materialId, String name, String alloyFamily, String materialClass, String subclass) {
        this.materialId = materialId;
        this.name = name;
        this.alloyFamily = alloyFamily;
        this.materialClass = materialClass != null ? materialClass : "Titanium Alloy";
        this.subclass = subclass;
    }

    public String getMaterialId() { return materialId; }
    public String getName() { return name; }
    public String getAlloyFamily() { return alloyFamily; }
    public String getMaterialClass() { return materialClass; }
    public String getSubclass() { return subclass; }
    public List<MaterialVariant> getVariants() { return variants; }

    public void addVariant(MaterialVariant variant) {
        this.variants.add(variant);
    }

    public Map<String, Object> toSummaryMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("materialId", materialId);
        map.put("name", name);
        map.put("alloyFamily", alloyFamily);
        map.put("alloyFamilyName", subclass);
        map.put("materialClass", materialClass);
        map.put("subclass", subclass);
        map.put("variantCount", variants.size());

        List<String> routes = new ArrayList<>();
        List<String> categories = new ArrayList<>();

        double minYield = Double.MAX_VALUE, maxYield = Double.NEGATIVE_INFINITY;
        double minUTS = Double.MAX_VALUE, maxUTS = Double.NEGATIVE_INFINITY;
        double minElongation = Double.MAX_VALUE, maxElongation = Double.NEGATIVE_INFINITY;
        double minDensity = Double.MAX_VALUE, maxDensity = Double.NEGATIVE_INFINITY;
        double minRelDensity = Double.MAX_VALUE, maxRelDensity = Double.NEGATIVE_INFINITY;
        double minBuildRate = Double.MAX_VALUE, maxBuildRate = Double.NEGATIVE_INFINITY;
        Double betaTransus = null;

        for (MaterialVariant v : variants) {
            String routeLabel = v.getIsoAstmCategory() + " · " + v.getPostProcessingCondition();
            if (!routes.contains(routeLabel)) {
                routes.add(routeLabel);
            }
            if (v.getIsoAstmCategory() != null && !categories.contains(v.getIsoAstmCategory())) {
                categories.add(v.getIsoAstmCategory());
            }

            if (v.getYieldStrength() != null) {
                minYield = Math.min(minYield, v.getYieldStrength());
                maxYield = Math.max(maxYield, v.getYieldStrength());
            }
            if (v.getUltimateTensileStrength() != null) {
                minUTS = Math.min(minUTS, v.getUltimateTensileStrength());
                maxUTS = Math.max(maxUTS, v.getUltimateTensileStrength());
            }
            if (v.getElongationAtBreak() != null) {
                minElongation = Math.min(minElongation, v.getElongationAtBreak());
                maxElongation = Math.max(maxElongation, v.getElongationAtBreak());
            }
            if (v.getDensity() != null) {
                minDensity = Math.min(minDensity, v.getDensity());
                maxDensity = Math.max(maxDensity, v.getDensity());
            }
            if (v.getRelativeDensity() != null) {
                minRelDensity = Math.min(minRelDensity, v.getRelativeDensity());
                maxRelDensity = Math.max(maxRelDensity, v.getRelativeDensity());
            }
            if (v.getBuildRate() != null) {
                minBuildRate = Math.min(minBuildRate, v.getBuildRate());
                maxBuildRate = Math.max(maxBuildRate, v.getBuildRate());
            }
            if (betaTransus == null && v.getBetaTransusTemperature() != null) {
                betaTransus = v.getBetaTransusTemperature();
            }
        }

        map.put("availableRoutes", routes);
        map.put("availableCategories", categories);

        Map<String, Object> envelope = new LinkedHashMap<>();
        if (minYield != Double.MAX_VALUE) {
            envelope.put("yieldStrengthMPa", Map.of("min", minYield, "max", maxYield, "unit", "MPa"));
        }
        if (minUTS != Double.MAX_VALUE) {
            envelope.put("ultimateTensileStrengthMPa", Map.of("min", minUTS, "max", maxUTS, "unit", "MPa"));
        }
        if (minElongation != Double.MAX_VALUE) {
            envelope.put("elongationAtBreakPct", Map.of("min", minElongation, "max", maxElongation, "unit", "%"));
        }
        if (minDensity != Double.MAX_VALUE) {
            envelope.put("densityGPerCm3", Map.of("min", minDensity, "max", maxDensity, "unit", "g/cm³"));
        }
        if (minRelDensity != Double.MAX_VALUE) {
            envelope.put("relativeDensityPct", Map.of("min", minRelDensity, "max", maxRelDensity, "unit", "%"));
        }
        if (minBuildRate != Double.MAX_VALUE) {
            envelope.put("buildRateCm3h", Map.of("min", minBuildRate, "max", maxBuildRate, "unit", "cm³/h"));
        }
        if (betaTransus != null) {
            envelope.put("betaTransusTempC", Map.of("value", betaTransus, "unit", "°C"));
        }
        map.put("propertyEnvelope", envelope);

        return map;
    }

    public Map<String, Object> toDetailMap() {
        Map<String, Object> map = toSummaryMap();
        List<Map<String, Object>> variantMaps = new ArrayList<>();
        for (MaterialVariant v : variants) {
            variantMaps.add(v.toMap());
        }
        map.put("variants", variantMaps);
        return map;
    }
}
