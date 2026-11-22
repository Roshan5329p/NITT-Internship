package com.nit.am.prediction;

import com.nit.am.model.AmRecord;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Materials Informatics Prediction & ASTM Qualification Engine for Ti-6Al-4V AM.
 * Calibrated against:
 * 1. Cao, Zou, Lim, Wu (2021) - Table 1 & Fig. 13 tensile data across As-built, Heat Treated, HIP, and Bi-modal states.
 * 2. ASTM F2924-14 (Standard Specification for Additive Manufacturing Ti-6Al-4V with PBF).
 * 3. ASTM F3001-14 (Standard Specification for Additive Manufacturing Ti-6Al-4V ELI with PBF).
 * 4. Murakami (2002) defect-tolerant fatigue threshold model with pore size / HIP closure effects.
 * 5. Calibrated process/condition residual priors from data/pinn_ti64_weights.json.
 */
public class PropertyPredictor {

    // Synced fallback condition residual offsets (from scripts/train_ti64_models.mjs)
    private static volatile Map<String, Double> cachedConditionOffsets = null;

    private static synchronized Map<String, Double> getConditionOffsets() {
        if (cachedConditionOffsets != null) {
            return cachedConditionOffsets;
        }
        Map<String, Double> map = new HashMap<>();
        // Graceful fallback defaults synced with data/pinn_ti64_weights.json condition_priors
        map.put("lpbf|As-Built|hardness_hv", 15.156);
        map.put("lpbf|As-Built|ys_mpa", 27.33);
        map.put("lpbf|As-Built|uts_mpa", 53.389);
        map.put("lpbf|As-Built|elongation_pct", 1.321);
        map.put("lpbf|Stress-Relieved|hardness_hv", 13.472);
        map.put("lpbf|Stress-Relieved|ys_mpa", 39.021);
        map.put("lpbf|Annealed|hardness_hv", 23.899);
        map.put("ded-laser|As-Built|hardness_hv", 15.548);
        map.put("waam|HIP|ys_mpa", 69.945);
        map.put("binder-jetting|HIP|hardness_hv", 0.036);

        try {
            Path p = Paths.get("data", "pinn_ti64_weights.json");
            if (Files.exists(p)) {
                String json = Files.readString(p, StandardCharsets.UTF_8);
                int idx = json.indexOf("\"condition_priors\"");
                if (idx >= 0) {
                    String sub = json.substring(idx);
                    for (String proc : new String[]{"lpbf", "ded-laser", "waam", "binder-jetting"}) {
                        for (String cond : new String[]{"As-Built", "Stress-Relieved", "Annealed", "HIP", "Solution-Aged"}) {
                            Pattern pat = Pattern.compile(
                                "\"" + Pattern.quote(proc) + "\"\\s*:\\s*\\{[\\s\\S]*?\"" + Pattern.quote(cond) + "\"\\s*:\\s*\\{([^}]*)\\}"
                            );
                            Matcher m = pat.matcher(sub);
                            if (m.find()) {
                                String body = m.group(1);
                                Matcher kv = Pattern.compile("\"([a-z_]+)\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)").matcher(body);
                                while (kv.find()) {
                                    map.put(proc + "|" + cond + "|" + kv.group(1), Double.parseDouble(kv.group(2)));
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Fall back silently to synced defaults when data/ is unavailable on classpath
        }
        cachedConditionOffsets = map;
        return cachedConditionOffsets;
    }

    private static double boundedCalibratedDelta(String proc, String condKey, String prop, double cap) {
        double raw = getConditionOffsets().getOrDefault(proc + "|" + condKey + "|" + prop, 0.0);
        return cap * Math.tanh(raw / Math.max(1e-6, cap));
    }

    // Ti-6Al-4V Hall-Petch parameters (Cao et al. 2021 Fig. 13a)
    public static final double SIGMA_0 = 710.0;           // Friction stress (MPa)
    public static final double K_HALL_PETCH = 0.32;       // Hall-Petch slope (MPa * m^0.5)

    // ASTM F2924 Minimums for PBF Ti-6Al-4V (Grade 5)
    public static final double ASTM_F2924_MIN_YS = 825.0;     // MPa
    public static final double ASTM_F2924_MIN_UTS = 895.0;    // MPa
    public static final double ASTM_F2924_MIN_ELONG = 10.0;   // %

    // ASTM F3001 Minimums for PBF Ti-6Al-4V ELI (Grade 23)
    public static final double ASTM_F3001_MIN_YS = 795.0;     // MPa
    public static final double ASTM_F3001_MIN_UTS = 860.0;    // MPa
    public static final double ASTM_F3001_MIN_ELONG = 10.0;   // %

    public static class PredictionOutput {
        public double predictedYieldStrengthMpa;
        public double predictedUtsMpa;
        public double predictedElongationPct;
        public double predictedFatigueLimitMpa;
        public double vickersHardnessHv;
        public double rockwellHrc;
        public boolean passesAstmF2924;
        public boolean passesAstmF3001;
        public String qualificationVerdict;
    }

    /**
     * Predicts tensile and fatigue behavior based on α/α' lath width, condition, and pore defect size.
     */
    public static PredictionOutput predict(double alphaLathUm, String condition, double maxPoreSqrtAreaUm) {
        return predictForProcess("lpbf", alphaLathUm, condition, maxPoreSqrtAreaUm);
    }

    /**
     * Process-aware tensile, hardness, fatigue, and ASTM F2924/F3001/F3187 qualification prediction.
     */
    public static PredictionOutput predictForProcess(String process, double alphaLathUm, String condition, double maxPoreSqrtAreaUm) {
        PredictionOutput out = new PredictionOutput();
        String proc = com.nit.am.physics.ThermalPhysicsEngine.normalizeProcess(process);
        boolean isDed = proc.equals("ded-laser");
        boolean isWaam = proc.equals("waam");

        // 1. Hall-Petch Yield Strength: sigma_y = sigma_0 + k_hp / sqrt(lambda_alpha)
        double lambdaUm = (alphaLathUm > 0) ? alphaLathUm : (isWaam ? 1.85 : (isDed ? 1.25 : 0.45));
        double lambdaM = lambdaUm * 1e-6;
        double hallPetchBase = SIGMA_0 + (K_HALL_PETCH / Math.sqrt(lambdaM));

        String cond = (condition != null) ? condition.toLowerCase() : "none";
        boolean isBj = proc.equals("binder-jetting");
        boolean isHighPreheat = cond.contains("preheat") || cond.contains("bed temp");
        boolean isLsp = cond.contains("lsp") || cond.contains("peen");
        double parsedTempC = Double.NaN;
        Matcher tempMatcher = Pattern.compile("(\\d{3,4})\\s*°?\\s*c").matcher(cond);
        if (tempMatcher.find()) {
            parsedTempC = Double.parseDouble(tempMatcher.group(1));
        }

        String canonicalCond = isLsp ? "LSP"
            : ((cond.contains("bi-modal") || cond.contains("cyclic") || cond.contains("sta") || cond.contains("solution") || cond.contains("aged")) ? "Solution-Aged"
            : (cond.contains("hip") ? "HIP"
            : (cond.contains("anneal") ? "Annealed"
            : ((cond.contains("stress") || cond.contains("reliev")) ? "Stress-Relieved" : "As-Built"))));

        if (isBj) {
            boolean isHip = canonicalCond.equals("HIP");
            out.predictedYieldStrengthMpa = isHip ? 840.0 : 710.0;
            out.predictedElongationPct = isHip ? 12.3 : 7.5;
            out.vickersHardnessHv = isHip ? 332.0 : 286.0;
        } else if (canonicalCond.equals("LSP")) {
            out.predictedYieldStrengthMpa = 1120.0;
            out.predictedElongationPct = 8.8;
            out.vickersHardnessHv = 425.0;
        } else if (canonicalCond.equals("As-Built")) {
            if (isWaam) {
                // As-deposited WAAM Widmanstatten alpha+beta lamellae (lower residual stress, higher ductility)
                out.predictedYieldStrengthMpa = Math.max(820.0, Math.min(935.0, hallPetchBase * 0.90));
                out.predictedElongationPct = 13.8;
                out.vickersHardnessHv = 324.0;
            } else if (isDed) {
                // As-deposited L-DED basketweave alpha+beta + tempered martensite
                out.predictedYieldStrengthMpa = Math.max(858.0, Math.min(1010.0, hallPetchBase * 0.96));
                out.predictedElongationPct = 11.6;
                out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.62);
            } else {
                // As-built LPBF: Room-temp 7.0% baseline vs High-Preheat (>=350C) in-situ alpha' tempering sigmoid
                double effT0 = isHighPreheat ? (Double.isFinite(parsedTempC) ? Math.max(100.0, Math.min(600.0, parsedTempC)) : 400.0) : 200.0;
                double preheatSigmoid = 1.0 / (1.0 + Math.exp(-(effT0 - 320.0) / 30.0));
                out.predictedYieldStrengthMpa = Math.min(1150.0, 1045.0 - 115.0 * preheatSigmoid);
                out.predictedElongationPct = 7.0 + (14.2 - 7.0) * preheatSigmoid;
                out.vickersHardnessHv = Math.round(382.0 - 38.0 * preheatSigmoid);
            }
        } else if (canonicalCond.equals("HIP")) {
            // Hot Isostatic Pressing: temperature-scaled 850-920 C baseline (~14.4 - 15.6% El., ~15.0% nominal)
            double hipT = Double.isFinite(parsedTempC) ? Math.max(800.0, Math.min(960.0, parsedTempC)) : 920.0;
            out.predictedYieldStrengthMpa = isWaam ? 805.0 : (885.0 - ((hipT - 850.0) / 70.0) * 20.0);
            out.predictedElongationPct = isWaam ? 15.5 : (14.4 + ((hipT - 850.0) / 70.0) * (15.6 - 14.4));
            out.vickersHardnessHv = Math.round(isWaam ? 310.0 : (345.0 - ((hipT - 850.0) / 70.0) * 6.0));
        } else if (canonicalCond.equals("Solution-Aged")) {
            // Bi-modal alpha+beta microstructure (STA)
            out.predictedYieldStrengthMpa = isWaam ? 875.0 : 1015.0;
            out.predictedElongationPct = isWaam ? 16.5 : 13.5;
            out.vickersHardnessHv = isWaam ? 330.0 : 372.0;
        } else if (canonicalCond.equals("Annealed")) {
            double annT = Double.isFinite(parsedTempC) ? Math.max(700.0, Math.min(980.0, parsedTempC)) : 800.0;
            out.predictedYieldStrengthMpa = isWaam ? 855.0 : (955.0 - ((annT - 750.0) / 200.0) * 85.0);
            out.predictedElongationPct = isWaam ? 14.5 : (12.0 + ((annT - 750.0) / 200.0) * 3.2);
            out.vickersHardnessHv = Math.round(isWaam ? 318.0 : (356.0 - ((annT - 750.0) / 200.0) * 20.0));
        } else {
            // Stress-Relieved (~650 C)
            out.predictedYieldStrengthMpa = isWaam ? 865.0 : 1000.0;
            out.predictedElongationPct = isWaam ? 14.0 : 8.2;
            out.vickersHardnessHv = isWaam ? 320.0 : 368.0;
        }

        // Apply gentle bounded calibrated prior adjustment from data/pinn_ti64_weights.json
        out.vickersHardnessHv = Math.round(out.vickersHardnessHv + 0.35 * boundedCalibratedDelta(proc, canonicalCond, "hardness_hv", 18.0));
        out.predictedYieldStrengthMpa = Math.round(out.predictedYieldStrengthMpa + 0.25 * boundedCalibratedDelta(proc, canonicalCond, "ys_mpa", 60.0));

        // Ultimate Tensile Strength (UTS ~ 1.10 - 1.15 * YS)
        out.predictedUtsMpa = Math.round(out.predictedYieldStrengthMpa * 1.12);

        // Rockwell C Equivalent via ASTM E140 piecewise lookup (matches dashboard hvToHrcStandard)
        out.rockwellHrc = hvToHrcStandard(out.vickersHardnessHv);

        // 2. Murakami Defect-Tolerant Fatigue Model: sigma_w = 1.43 * (HV + 120) / (sqrt(area))^0.1667
        double sqrtArea = Math.max(8.0, maxPoreSqrtAreaUm);
        if (cond.contains("hip")) {
            sqrtArea = Math.min(sqrtArea, 6.0);
        }
        out.predictedFatigueLimitMpa = Math.round((1.43 * (out.vickersHardnessHv + 120.0)) / Math.pow(sqrtArea, 1.0 / 6.0));
        if (cond.contains("hip")) {
            out.predictedFatigueLimitMpa = Math.round(out.predictedFatigueLimitMpa * 1.30);
        }

        // 3. ASTM Compliance Verification
        out.passesAstmF2924 = (out.predictedYieldStrengthMpa >= ASTM_F2924_MIN_YS) &&
                              (out.predictedUtsMpa >= ASTM_F2924_MIN_UTS) &&
                              (out.predictedElongationPct >= ASTM_F2924_MIN_ELONG);

        out.passesAstmF3001 = (out.predictedYieldStrengthMpa >= ASTM_F3001_MIN_YS) &&
                              (out.predictedUtsMpa >= ASTM_F3001_MIN_UTS) &&
                              (out.predictedElongationPct >= ASTM_F3001_MIN_ELONG);

        if (isDed || isWaam) {
            if (out.passesAstmF2924) {
                out.qualificationVerdict = "QUALIFIED (ASTM F3187 DED & ASTM F2924 Grade 5 Tensile Baseline)";
            } else if (out.passesAstmF3001) {
                out.qualificationVerdict = "QUALIFIED (ASTM F3187 DED / F3001 ELI Ductility Window)";
            } else {
                out.qualificationVerdict = "NON-COMPLIANT (Adjust heat input / interpass control or apply stress-relief + HIP)";
            }
        } else {
            if (out.passesAstmF2924 && out.passesAstmF3001) {
                out.qualificationVerdict = "QUALIFIED (Complies with ASTM F2924 Grade 5 & ASTM F3001 Grade 23 ELI)";
            } else if (out.passesAstmF2924) {
                out.qualificationVerdict = "QUALIFIED (ASTM F2924 Grade 5 Compliant)";
            } else if (out.predictedElongationPct < ASTM_F2924_MIN_ELONG) {
                out.qualificationVerdict = "NON-COMPLIANT (Ductility elongation < 10% requires post-build HIP or annealing)";
            } else {
                out.qualificationVerdict = "NON-COMPLIANT (YS < 825 MPa or UTS < 895 MPa per ASTM F2924)";
            }
        }

        return out;
    }

    /**
     * Converts Vickers hardness (HV) to Rockwell C (HRC) via ASTM E140 piecewise linear interpolation.
     */
    public static double hvToHrcStandard(double hv) {
        if (!Double.isFinite(hv) || hv < 240.0) return 0.0;
        final double[][] table = {
            {240.0, 20.3}, {300.0, 29.8}, {400.0, 40.8},
            {500.0, 49.1}, {600.0, 54.7}, {700.0, 58.1}, {800.0, 60.3}
        };
        if (hv >= table[table.length - 1][0]) return Math.round(table[table.length - 1][1]);
        for (int i = 1; i < table.length; i++) {
            double upperHv = table[i][0];
            if (hv <= upperHv) {
                double lowerHv = table[i - 1][0];
                double lowerHrc = table[i - 1][1];
                double upperHrc = table[i][1];
                return Math.round(lowerHrc + ((hv - lowerHv) / (upperHv - lowerHv)) * (upperHrc - lowerHrc));
            }
        }
        return 0.0;
    }

    /**
     * Verifies if an AmRecord complies with ASTM F2924.
     * Excludes unextracted/missing experimental tensile rows (YS <= 0 or Elong <= 0).
     */
    public static boolean checkAstmF2924(AmRecord rec) {
        if (rec == null || rec.yieldStrengthMpa <= 0 || rec.elongationPct <= 0) {
            return false;
        }
        return (rec.yieldStrengthMpa >= ASTM_F2924_MIN_YS) &&
               (rec.utsMpa <= 0 || rec.utsMpa >= ASTM_F2924_MIN_UTS) &&
               (rec.elongationPct >= ASTM_F2924_MIN_ELONG);
    }
}
