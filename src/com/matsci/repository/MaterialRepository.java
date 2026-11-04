package com.matsci.repository;

import com.matsci.model.Material;
import com.matsci.model.MaterialVariant;

import java.util.List;
import java.util.Optional;

/**
 * Clean data access interface.
 * Today this is implemented by CsvMaterialRepository.
 * In Phase 2, this can be seamlessly swapped with JpaMaterialRepository (PostgreSQL).
 */
public interface MaterialRepository {
    List<Material> findAllMaterials();
    Optional<Material> findMaterialById(String materialId);
    Optional<MaterialVariant> findVariantById(String variantId);
    List<MaterialVariant> searchVariants(String query, String materialClass, String subclass);
    List<String> getMaterialClasses();
    List<String> getSubclasses(String materialClass);
    int getTotalVariantCount();
    int getTotalMaterialCount();
}
