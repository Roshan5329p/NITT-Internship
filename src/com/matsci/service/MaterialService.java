package com.matsci.service;

import com.matsci.model.Material;
import com.matsci.model.MaterialVariant;
import com.matsci.repository.MaterialRepository;

import java.util.*;

/**
 * High-level business logic service for materials retrieval and comparative analytics.
 */
public class MaterialService {

    private final MaterialRepository repository;

    public MaterialService(MaterialRepository repository) {
        this.repository = repository;
    }

    public List<Map<String, Object>> search(String query, String materialClass, String subclass) {
        List<MaterialVariant> variants = repository.searchVariants(query, materialClass, subclass);
        List<Map<String, Object>> list = new ArrayList<>();
        for (MaterialVariant v : variants) {
            list.add(v.toMap());
        }
        return list;
    }

    public Optional<Map<String, Object>> getMaterial(String materialId) {
        return repository.findMaterialById(materialId).map(Material::toDetailMap);
    }

    public Optional<Map<String, Object>> getVariant(String variantId) {
        return repository.findVariantById(variantId).map(MaterialVariant::toMap);
    }

    public List<Map<String, Object>> listAllMaterials() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Material m : repository.findAllMaterials()) {
            list.add(m.toSummaryMap());
        }
        return list;
    }

    public Map<String, Object> compareVariants(List<String> variantIds) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> variantMaps = new ArrayList<>();

        for (String vid : variantIds == null ? Collections.<String>emptyList() : variantIds) {
            if (vid == null || vid.trim().isEmpty()) {
                continue;
            }
            String clean = vid.trim();
            Optional<MaterialVariant> optVar = repository.findVariantById(clean);
            if (optVar.isPresent()) {
                variantMaps.add(optVar.get().toMap());
            } else {
                Optional<Material> optMat = repository.findMaterialById(clean);
                if (optMat.isPresent() && !optMat.get().getVariants().isEmpty()) {
                    variantMaps.add(optMat.get().getVariants().get(0).toMap());
                }
            }
        }

        result.put("variants", variantMaps);
        result.put("count", variantMaps.size());
        return result;
    }

    public Map<String, Object> getMetadata() {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("totalMaterials", repository.getTotalMaterialCount());
        meta.put("totalVariants", repository.getTotalVariantCount());
        meta.put("classes", repository.getMaterialClasses());
        return meta;
    }
}
