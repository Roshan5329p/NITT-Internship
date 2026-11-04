package com.matsci.model;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Represents a specific operational parameter of creation
 * (e.g., Chamber Temperature, Pressure, Laser Power, Quench Medium).
 */
public record ProcessParameter(
    String category,      // e.g. "Thermal", "Atmosphere & Pressure", "Kinetic / Speed", "Mechanical"
    String name,          // e.g. "Sintering Temperature"
    String value,         // e.g. "1350 - 1450"
    String unit,          // e.g. "°C"
    String description    // e.g. "Dwell time at peak temperature to achieve >98% theoretical density"
) {
    public Map<String, Object> toMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("category", category);
        map.put("name", name);
        map.put("value", value);
        map.put("unit", unit);
        map.put("description", description);
        return map;
    }
}
