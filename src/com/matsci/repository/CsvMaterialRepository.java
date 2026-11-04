package com.matsci.repository;

import com.matsci.model.Material;
import com.matsci.model.MaterialVariant;
import com.matsci.service.ParameterInferenceService;
import com.matsci.util.CsvParser;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * High-performance thread-safe in-memory repository populated directly from the dataset.
 * Supports dynamic header mapping for the 42-column Titanium Additive Manufacturing schema.
 */
public class CsvMaterialRepository implements MaterialRepository {

    private final Map<String, Material> materialsById = new LinkedHashMap<>();
    private final Map<String, MaterialVariant> variantsById = new ConcurrentHashMap<>();
    private final List<MaterialVariant> allVariants = new ArrayList<>();
    private final Set<String> materialClasses = new TreeSet<>();
    private final Map<String, Set<String>> subclassesByClass = new HashMap<>();

    public CsvMaterialRepository(File csvFile, ParameterInferenceService parameterService) throws Exception {
        loadCsv(csvFile, parameterService);
    }

    public static final List<String> AUTHORIZED_PROCESSES = List.of(
        "Laser Powder Bed Fusion",
        "Directed Energy Deposition",
        "Wire Arc Additive Manufacturing",
        "Binder Jetting"
    );

    private String normalizeProcess(String category) {
        if (category == null || category.trim().isEmpty()) return "Laser Powder Bed Fusion";
        String trimmed = category.trim();
        if (trimmed.equalsIgnoreCase("Powder Bed Fusion") || trimmed.equalsIgnoreCase("Laser Powder Bed Fusion") || trimmed.equalsIgnoreCase("L-PBF") || trimmed.equalsIgnoreCase("LPBF")) {
            return "Laser Powder Bed Fusion";
        }
        if (trimmed.equalsIgnoreCase("Directed Energy Deposition") || trimmed.equalsIgnoreCase("DED")) {
            return "Directed Energy Deposition";
        }
        if (trimmed.equalsIgnoreCase("Wire Arc Additive Manufacturing") || trimmed.equalsIgnoreCase("Wire arc additive manufacturing") || trimmed.equalsIgnoreCase("WAAM")) {
            return "Wire Arc Additive Manufacturing";
        }
        if (trimmed.equalsIgnoreCase("Binder Jetting") || trimmed.equalsIgnoreCase("BJ")) {
            return "Binder Jetting";
        }
        return trimmed;
    }

    private void loadCsv(File csvFile, ParameterInferenceService parameterService) throws Exception {
        if (!csvFile.exists()) {
            throw new IllegalArgumentException("Database CSV file not found at: " + csvFile.getAbsolutePath());
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(csvFile), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) return;

            List<String> headers = CsvParser.parseLine(headerLine);
            Map<String, Integer> colMap = new HashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                colMap.put(headers.get(i).trim().toLowerCase(Locale.ROOT), i);
            }

            boolean isNewSchema = colMap.containsKey("alloy_id") || colMap.containsKey("subprocess");

            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                List<String> cols = CsvParser.parseLine(line);
                if (cols.isEmpty()) continue;

                MaterialVariant variant;
                String materialId;
                String materialName;
                String alloyFamily;
                String mClass;
                String subClass;

                if (isNewSchema) {
                    String variantId = getVal(cols, colMap, "variant_id");
                    materialId = getVal(cols, colMap, "alloy_id");
                    materialName = getVal(cols, colMap, "alloy_name");
                    alloyFamily = getVal(cols, colMap, "alloy_family");
                    String isoCategory = normalizeProcess(getVal(cols, colMap, "iso_astm_category"));
                    String subprocess = getVal(cols, colMap, "subprocess");

                    // Strictly enforce only the 4 authorized AM processes: LPBF, DED, WAAM, Binder Jetting
                    if (!AUTHORIZED_PROCESSES.contains(isoCategory)) {
                        continue;
                    }
                    if (subprocess != null && subprocess.contains("Electron-beam")) {
                        continue;
                    }

                    String maturity = getVal(cols, colMap, "maturity");
                    String postProcessing = getVal(cols, colMap, "post_processing_condition");

                    Double density = parseDouble(getVal(cols, colMap, "density_g_cm3"));
                    Double relativeDensity = parseDouble(getVal(cols, colMap, "relative_density"));
                    Double porosity = parseDouble(getVal(cols, colMap, "porosity"));
                    Double youngsModulus = parseDouble(getVal(cols, colMap, "youngs_modulus_gpa"));
                    Double yieldStrength = parseDouble(getVal(cols, colMap, "yield_strength_mpa"));
                    Double ultimateTensileStrength = parseDouble(getVal(cols, colMap, "ultimate_tensile_strength_mpa"));
                    Double elongationAtBreak = parseDouble(getVal(cols, colMap, "elongation_at_break"));
                    Double hardnessVickers = parseDouble(getVal(cols, colMap, "hardness_vickers_hv"));
                    Double fractureToughness = parseDouble(getVal(cols, colMap, "fracture_toughness_kic_mpa_m_0_5"));
                    Double poissonsRatio = parseDouble(getVal(cols, colMap, "poissons_ratio"));
                    Double fatigueStrength = parseDouble(getVal(cols, colMap, "fatigue_strength_1e7_cycles_mpa"));
                    Double charpyImpactEnergy = parseDouble(getVal(cols, colMap, "charpy_impact_energy_j"));
                    Double dampingLossFactor = parseDouble(getVal(cols, colMap, "damping_loss_factor"));
                    Double longitudinalWaveSpeed = parseDouble(getVal(cols, colMap, "longitudinal_wave_speed_m_s"));

                    Double thermalConductivity = parseDouble(getVal(cols, colMap, "thermal_conductivity_w_m_k"));
                    Double thermalExpansionCoeff = parseDouble(getVal(cols, colMap, "thermal_expansion_coeff_1e_6_k"));
                    Double specificHeat = parseDouble(getVal(cols, colMap, "specific_heat_j_kg_k"));
                    Double liquidusTemperature = parseDouble(getVal(cols, colMap, "liquidus_temperature_c"));
                    Double betaTransusTemperature = parseDouble(getVal(cols, colMap, "beta_transus_temperature_c"));
                    Double maxServiceTemperature = parseDouble(getVal(cols, colMap, "max_service_temperature_c"));
                    Double hemisphericalEmissivity = parseDouble(getVal(cols, colMap, "hemispherical_emissivity"));

                    Double electricalResistivity = parseDouble(getVal(cols, colMap, "electrical_resistivity_ohm_m"));
                    Double volumeMagneticSusceptibility = parseDouble(getVal(cols, colMap, "volume_magnetic_susceptibility_1e_6_si"));
                    Double laserAbsorptivity = parseDouble(getVal(cols, colMap, "laser_absorptivity_1070nm"));
                    Double visibleReflectance = parseDouble(getVal(cols, colMap, "visible_reflectance_polished"));

                    Double corrosionResistance = parseDouble(getVal(cols, colMap, "corrosion_resistance_rating_1_5_5_best"));
                    Double biocompatibility = parseDouble(getVal(cols, colMap, "biocompatibility_rating_1_5_5_best"));
                    Double oxygenContent = parseDouble(getVal(cols, colMap, "oxygen_content_wt"));

                    Double surfaceRoughnessRa = parseDouble(getVal(cols, colMap, "surface_roughness_ra_um"));
                    Double residualStressMax = parseDouble(getVal(cols, colMap, "residual_stress_max_mpa"));
                    Double anisotropy = parseDouble(getVal(cols, colMap, "build_direction_anisotropy"));
                    Double minFeatureSize = parseDouble(getVal(cols, colMap, "minimum_feature_size_mm"));
                    Double dimensionalAccuracy = parseDouble(getVal(cols, colMap, "dimensional_accuracy"));
                    Double buildRate = parseDouble(getVal(cols, colMap, "build_rate_cm3_h"));

                    variant = new MaterialVariant(
                        variantId, materialId, materialName, alloyFamily,
                        isoCategory, subprocess, maturity, postProcessing,
                        density, relativeDensity, porosity,
                        youngsModulus, yieldStrength, ultimateTensileStrength, elongationAtBreak,
                        hardnessVickers, fractureToughness, poissonsRatio,
                        fatigueStrength, charpyImpactEnergy, dampingLossFactor, longitudinalWaveSpeed,
                        thermalConductivity, thermalExpansionCoeff, specificHeat,
                        liquidusTemperature, betaTransusTemperature, maxServiceTemperature,
                        hemisphericalEmissivity,
                        electricalResistivity, volumeMagneticSusceptibility, laserAbsorptivity, visibleReflectance,
                        corrosionResistance, biocompatibility, oxygenContent,
                        surfaceRoughnessRa, residualStressMax, anisotropy,
                        minFeatureSize, dimensionalAccuracy, buildRate
                    );

                    mClass = isoCategory.isEmpty() ? "Powder Bed Fusion" : isoCategory;
                    subClass = variant.getAlloyFamilyFullName();

                } else {
                    // Legacy fallback
                    String variantId = getCol(cols, 0);
                    materialId = getCol(cols, 1);
                    materialName = getCol(cols, 2);
                    mClass = getCol(cols, 3);
                    subClass = getCol(cols, 4);
                    String processRoute = getCol(cols, 5);
                    String postTreatment = getCol(cols, 6);

                    Double density = parseDouble(getCol(cols, 7));
                    Double youngsModulus = parseDouble(getCol(cols, 8));
                    Double yieldStrength = parseDouble(getCol(cols, 9));
                    Double ultimateTensileStrength = parseDouble(getCol(cols, 10));
                    Double elongation = parseDouble(getCol(cols, 11));
                    Double hardnessVickers = parseDouble(getCol(cols, 12));
                    Double fractureToughness = parseDouble(getCol(cols, 14));
                    Double poissonsRatio = parseDouble(getCol(cols, 15));
                    Double fatigueStrength = parseDouble(getCol(cols, 18));
                    Double dampingLoss = parseDouble(getCol(cols, 19));
                    Double charpy = parseDouble(getCol(cols, 20));

                    Double thermalConductivity = parseDouble(getCol(cols, 22));
                    Double thermalExpansion = parseDouble(getCol(cols, 23));
                    Double meltingPoint = parseDouble(getCol(cols, 24));
                    Double specificHeat = parseDouble(getCol(cols, 25));
                    Double maxServiceTemp = parseDouble(getCol(cols, 26));
                    Double electricalResistivity = parseDouble(getCol(cols, 27));
                    Double corrosionResistance = parseDouble(getCol(cols, 33));

                    variant = new MaterialVariant(
                        variantId, materialId, materialName, "ab",
                        "Powder Bed Fusion", processRoute, "commercial", postTreatment,
                        density, 99.5, 0.5,
                        youngsModulus, yieldStrength, ultimateTensileStrength, elongation,
                        hardnessVickers, fractureToughness, poissonsRatio,
                        fatigueStrength, charpy, dampingLoss, 5800.0,
                        thermalConductivity, thermalExpansion, specificHeat,
                        meltingPoint, 995.0, maxServiceTemp, 0.35,
                        electricalResistivity, 180.0, 0.45, 55.0,
                        corrosionResistance, 5.0, 0.15,
                        10.0, 250.0, 5.0,
                        0.4, 0.2, 25.0
                    );
                    alloyFamily = "ab";
                }

                if (parameterService != null) {
                    variant.setRecipe(parameterService.inferRecipe(variant));
                }

                variantsById.put(variant.getVariantId(), variant);
                allVariants.add(variant);

                materialClasses.add(mClass);
                subclassesByClass.computeIfAbsent(mClass, k -> new TreeSet<>()).add(subClass);

                final String finalFamily = alloyFamily;
                final String finalClass = mClass;
                final String finalSub = subClass;
                Material material = materialsById.computeIfAbsent(materialId,
                    id -> new Material(id, materialName, finalFamily, finalClass, finalSub));
                material.addVariant(variant);
            }
        }
    }

    private String getVal(List<String> cols, Map<String, Integer> colMap, String key) {
        Integer idx = colMap.get(key);
        if (idx == null || idx >= cols.size()) return "";
        return cols.get(idx).trim();
    }

    private String getCol(List<String> cols, int idx) {
        return idx < cols.size() ? cols.get(idx).trim() : "";
    }

    private Double parseDouble(String s) {
        if (s == null || s.trim().isEmpty()) return null;
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    public List<Material> findAllMaterials() {
        return new ArrayList<>(materialsById.values());
    }

    private String toSlug(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    @Override
    public Optional<Material> findMaterialById(String materialId) {
        if (materialId == null) return Optional.empty();
        String idClean = materialId.trim().toUpperCase(Locale.ROOT);
        Material direct = materialsById.get(idClean);
        if (direct != null) return Optional.of(direct);

        // Case-insensitive / name search fallback
        for (Material m : materialsById.values()) {
            if (m.getMaterialId().equalsIgnoreCase(materialId) || m.getName().equalsIgnoreCase(materialId)) {
                return Optional.of(m);
            }
        }

        // Normalized slug search fallback (e.g. ti-6al-4v, ti-6242, ti-5553)
        String targetSlug = toSlug(materialId);
        if (!targetSlug.isEmpty()) {
            for (Material m : materialsById.values()) {
                String nameSlug = toSlug(m.getName());
                String idSlug = toSlug(m.getMaterialId());
                if (nameSlug.contains(targetSlug) || targetSlug.contains(idSlug)) {
                    return Optional.of(m);
                }
            }
        }
        return Optional.empty();
    }

    @Override
    public Optional<MaterialVariant> findVariantById(String variantId) {
        if (variantId == null) return Optional.empty();
        String idClean = variantId.trim().toUpperCase(Locale.ROOT);
        MaterialVariant direct = variantsById.get(idClean);
        if (direct != null) return Optional.of(direct);

        for (MaterialVariant v : allVariants) {
            if (v.getVariantId().equalsIgnoreCase(variantId)) {
                return Optional.of(v);
            }
        }
        return Optional.empty();
    }

    @Override
    public List<MaterialVariant> searchVariants(String query, String materialClass, String subclass) {
        String q = query != null ? query.trim().toLowerCase(Locale.ROOT) : "";
        List<MaterialVariant> results = new ArrayList<>();

        for (MaterialVariant v : allVariants) {
            if (materialClass != null && !materialClass.isEmpty()) {
                boolean matchClass = v.getIsoAstmCategory().equalsIgnoreCase(materialClass)
                    || v.getMaterialClass().equalsIgnoreCase(materialClass);
                if (!matchClass) continue;
            }
            if (subclass != null && !subclass.isEmpty()) {
                boolean matchSub = v.getAlloyFamily().equalsIgnoreCase(subclass)
                    || v.getAlloyFamilyFullName().equalsIgnoreCase(subclass)
                    || v.getSubclass().equalsIgnoreCase(subclass);
                if (!matchSub) continue;
            }
            if (!q.isEmpty()) {
                boolean match = v.getAlloyName().toLowerCase(Locale.ROOT).contains(q)
                    || v.getVariantId().toLowerCase(Locale.ROOT).contains(q)
                    || v.getAlloyId().toLowerCase(Locale.ROOT).contains(q)
                    || v.getAlloyFamily().toLowerCase(Locale.ROOT).contains(q)
                    || v.getAlloyFamilyFullName().toLowerCase(Locale.ROOT).contains(q)
                    || v.getSubprocess().toLowerCase(Locale.ROOT).contains(q)
                    || v.getIsoAstmCategory().toLowerCase(Locale.ROOT).contains(q)
                    || v.getPostProcessingCondition().toLowerCase(Locale.ROOT).contains(q)
                    || v.getMaturity().toLowerCase(Locale.ROOT).contains(q);
                if (!match) continue;
            }
            results.add(v);
        }
        return results;
    }

    @Override
    public List<String> getMaterialClasses() {
        return new ArrayList<>(AUTHORIZED_PROCESSES);
    }

    @Override
    public List<String> getSubclasses(String materialClass) {
        Set<String> sub = subclassesByClass.get(materialClass);
        if (sub != null) return new ArrayList<>(sub);

        // Fallback: collect all distinct alloy families
        Set<String> allSubs = new TreeSet<>();
        for (MaterialVariant v : allVariants) {
            allSubs.add(v.getAlloyFamilyFullName());
        }
        return new ArrayList<>(allSubs);
    }

    @Override
    public int getTotalVariantCount() {
        return allVariants.size();
    }

    @Override
    public int getTotalMaterialCount() {
        return materialsById.size();
    }
}
