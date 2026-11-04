package com.matsci.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Encapsulates the synthesis / manufacturing route and step-by-step
 * parameters of creation for a specific material variant.
 */
public class ProcessRecipe {
    private final String processRoute;
    private final String postTreatment;
    private final String summary;
    private final String standardEquipment;
    private final String atmosphere;
    private final List<String> processSteps;
    private final List<ProcessParameter> parameters;

    public ProcessRecipe(String processRoute, String postTreatment, String summary,
                         String standardEquipment, String atmosphere,
                         List<String> processSteps, List<ProcessParameter> parameters) {
        this.processRoute = processRoute;
        this.postTreatment = postTreatment;
        this.summary = summary;
        this.standardEquipment = standardEquipment;
        this.atmosphere = atmosphere;
        this.processSteps = processSteps != null
            ? new ArrayList<>(processSteps) : new ArrayList<>();
        this.parameters = parameters != null
            ? new ArrayList<>(parameters) : new ArrayList<>();
    }

    public String getProcessRoute() { return processRoute; }
    public String getPostTreatment() { return postTreatment; }
    public String getSummary() { return summary; }
    public String getStandardEquipment() { return standardEquipment; }
    public String getAtmosphere() { return atmosphere; }
    public List<String> getProcessSteps() {
        return Collections.unmodifiableList(processSteps);
    }
    public List<ProcessParameter> getParameters() {
        return Collections.unmodifiableList(parameters);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("processRoute", processRoute);
        map.put("postTreatment", postTreatment);
        map.put("summary", summary);
        map.put("standardEquipment", standardEquipment);
        map.put("atmosphere", atmosphere);
        map.put("processSteps", processSteps);

        List<Map<String, Object>> paramMaps = new ArrayList<>();
        for (ProcessParameter p : parameters) {
            paramMaps.add(p.toMap());
        }
        map.put("parameters", paramMaps);
        return map;
    }
}
