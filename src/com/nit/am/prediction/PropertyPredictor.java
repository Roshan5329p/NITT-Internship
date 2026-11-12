package com.nit.am.prediction;

import com.nit.am.model.AmRecord;

/**
 * Materials Informatics Prediction & ASTM Qualification Engine for Ti-6Al-4V AM.
 * Calibrated against:
 * 1. Cao, Zou, Lim, Wu (2021) - Table 1 & Fig. 13 tensile data across As-built, Heat Treated, HIP, and Bi-modal states.
 * 2. ASTM F2924-14 (Standard Specification for Additive Manufacturing Ti-6Al-4V with PBF).
 * 3. ASTM F3001-14 (Standard Specification for Additive Manufacturing Ti-6Al-4V ELI with PBF).
 * 4. Murakami (2002) defect-tolerant fatigue threshold model with pore size / HIP closure effects.
 */
public class PropertyPredictor {

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

        if (cond.contains("as-built") || cond.contains("none")) {
            if (isWaam) {
                // As-deposited WAAM Widmanstatten alpha+beta lamellae (lower residual stress, higher ductility)
                out.predictedYieldStrengthMpa = Math.max(820.0, Math.min(935.0, hallPetchBase * 0.90));
                out.predictedElongationPct = 12.8;
                out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.68);
            } else if (isDed) {
                // As-deposited L-DED basketweave alpha+beta + tempered martensite
                out.predictedYieldStrengthMpa = Math.max(860.0, Math.min(1010.0, hallPetchBase * 0.96));
                out.predictedElongationPct = 11.2;
                out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.62);
            } else {
                // As-built LPBF hierarchical acicular α' martensite (Cao et al. Table 1: YS 980-1140 MPa, El. 4-8%)
                out.predictedYieldStrengthMpa = Math.min(1150.0, hallPetchBase + 120.0);
                out.predictedElongationPct = 7.2;
                out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.55);
            }
        } else if (cond.contains("hip")) {
            // Hot Isostatic Pressing: 900-930°C / 100-120 MPa (Cao et al. Table 1: YS 840-885 MPa, El. 14-22%)
            out.predictedYieldStrengthMpa = Math.max(835.0, (isWaam ? 845.0 : hallPetchBase - 50.0));
            out.predictedElongationPct = isWaam ? 16.5 : 15.5;
            out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.80);
        } else if (cond.contains("bi-modal") || cond.contains("cyclic") || cond.contains("sta")) {
            // Bi-modal α+β microstructure (Cao et al. Table 1: YS 865-1080 MPa, El. 16-20%)
            out.predictedYieldStrengthMpa = isWaam ? 875.0 : 910.0;
            out.predictedElongationPct = isWaam ? 18.0 : 17.5;
            out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.65);
        } else if (cond.contains("anneal") || cond.contains("stress")) {
            // Stress relief / Annealed (Cao et al. Table 1: YS 935-1010 MPa, El. 9.5-14%)
            out.predictedYieldStrengthMpa = Math.max(855.0, (isWaam ? 865.0 : hallPetchBase - 25.0));
            out.predictedElongationPct = isWaam ? 14.0 : 11.5;
            out.vickersHardnessHv = Math.round(out.predictedYieldStrengthMpa / 2.70);
        } else {
            out.predictedYieldStrengthMpa = 920.0;
            out.predictedElongationPct = 10.0;
            out.vickersHardnessHv = 345.0;
        }

        // Ultimate Tensile Strength (UTS ~ 1.10 - 1.15 * YS)
        out.predictedUtsMpa = Math.round(out.predictedYieldStrengthMpa * 1.12);

        // Rockwell C Equivalent: HRC = 100 - (15000 / HV)
        if (out.vickersHardnessHv >= 240.0) {
            out.rockwellHrc = Math.max(20.0, Math.min(68.0, Math.round(100.0 - (15000.0 / out.vickersHardnessHv))));
        } else {
            out.rockwellHrc = 0.0;
        }

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
            } else {
                out.qualificationVerdict = "NON-COMPLIANT (Ductility elongation < 10% requires post-build HIP or annealing)";
            }
        }

        return out;
    }

    /**
     * Verifies if an AmRecord complies with ASTM F2924.
     */
    public static boolean checkAstmF2924(AmRecord rec) {
        if (rec.yieldStrengthMpa <= 0 && rec.elongationPct <= 0) {
            double lath = rec.alphaLathThicknessUm > 0 ? rec.alphaLathThicknessUm :
                         (rec.priorBetaGrainWidthUm > 0 ? rec.priorBetaGrainWidthUm * 0.05 : 0.45);
            double pore = (rec.defectRegime != null && rec.defectRegime.toLowerCase().contains("keyhole")) ? 45.0 : 15.0;
            PredictionOutput pred = predictForProcess(rec.amProcess, lath, rec.condition, pore);
            return pred.passesAstmF2924;
        }
        return (rec.yieldStrengthMpa >= ASTM_F2924_MIN_YS) &&
               (rec.utsMpa >= ASTM_F2924_MIN_UTS || rec.utsMpa <= 0) &&
               (rec.elongationPct >= ASTM_F2924_MIN_ELONG);
    }
}
