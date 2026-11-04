package com.nit.am.prediction;

import com.nit.am.model.AmRecord;

/**
 * Materials Informatics Prediction & ASTM Qualification Engine for Ti-6Al-4V AM.
 * Implements Hall-Petch microstructure-property models, Murakami fatigue models,
 * and ASTM F2924 / ASTM F3001 standards verification.
 */
public class PropertyPredictor {

    // Ti-6Al-4V Hall-Petch parameters
    public static final double SIGMA_0 = 510.0;           // Friction stress (MPa)
    public static final double K_HALL_PETCH = 0.38;       // Hall-Petch slope (MPa * m^0.5)

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
        public boolean passesAstmF2924;
        public boolean passesAstmF3001;
        public String qualificationVerdict;
    }

    /**
     * Predicts mechanical behavior based on α-lath thickness and condition.
     */
    public static PredictionOutput predict(double alphaLathUm, String condition, double maxPoreSqrtAreaUm) {
        PredictionOutput out = new PredictionOutput();

        // 1. Hall-Petch Yield Strength: sigma_y = sigma_0 + k_hp / sqrt(lambda_alpha)
        if (alphaLathUm > 0) {
            double lambdaM = alphaLathUm * 1e-6;
            out.predictedYieldStrengthMpa = SIGMA_0 + (K_HALL_PETCH / Math.sqrt(lambdaM));
        } else {
            out.predictedYieldStrengthMpa = 920.0;
        }

        // Condition corrections
        String cond = condition.toLowerCase();
        if (cond.contains("as-built")) {
            // High dislocation density martensite boost
            out.predictedYieldStrengthMpa += 120.0;
            out.predictedElongationPct = 7.2;
        } else if (cond.contains("hip")) {
            // Stress-relieved, coarsened ductile basketweave
            out.predictedYieldStrengthMpa = Math.max(850.0, out.predictedYieldStrengthMpa - 50.0);
            out.predictedElongationPct = 14.5;
        } else if (cond.contains("anneal")) {
            out.predictedYieldStrengthMpa = Math.max(880.0, out.predictedYieldStrengthMpa - 30.0);
            out.predictedElongationPct = 12.8;
        } else {
            out.predictedElongationPct = 10.5;
        }

        // UTS is typically ~1.12 to 1.15 * YS for Ti-6Al-4V
        out.predictedUtsMpa = out.predictedYieldStrengthMpa * 1.13;

        // 2. Murakami Defect-Based Fatigue Prediction: sigma_w = 1.43 * (HV + 120) / (sqrt(area))^0.1667
        double vickersHv = out.predictedYieldStrengthMpa / 2.75;
        double sqrtArea = Math.max(10.0, maxPoreSqrtAreaUm);
        out.predictedFatigueLimitMpa = (1.43 * (vickersHv + 120.0)) / Math.pow(sqrtArea, 1.0 / 6.0);

        // Polished / HIP boost
        if (cond.contains("hip")) {
            out.predictedFatigueLimitMpa *= 1.35;
        }

        // 3. ASTM Compliance Check
        out.passesAstmF2924 = (out.predictedYieldStrengthMpa >= ASTM_F2924_MIN_YS) &&
                              (out.predictedUtsMpa >= ASTM_F2924_MIN_UTS) &&
                              (out.predictedElongationPct >= ASTM_F2924_MIN_ELONG);

        out.passesAstmF3001 = (out.predictedYieldStrengthMpa >= ASTM_F3001_MIN_YS) &&
                              (out.predictedUtsMpa >= ASTM_F3001_MIN_UTS) &&
                              (out.predictedElongationPct >= ASTM_F3001_MIN_ELONG);

        if (out.passesAstmF2924 && out.passesAstmF3001) {
            out.qualificationVerdict = "QUALIFIED (Complies with ASTM F2924 Grade 5 and ASTM F3001 ELI)";
        } else if (out.passesAstmF2924) {
            out.qualificationVerdict = "QUALIFIED (ASTM F2924 Grade 5 Compliant)";
        } else {
            out.qualificationVerdict = "NON-COMPLIANT (Ductility elongation < 10% requires post-build HIP or annealing)";
        }

        return out;
    }

    /**
     * Validates an existing record against ASTM standards.
     */
    public static boolean checkAstmF2924(AmRecord rec) {
        return (rec.yieldStrengthMpa >= ASTM_F2924_MIN_YS) &&
               (rec.utsMpa >= ASTM_F2924_MIN_UTS) &&
               (rec.elongationPct >= ASTM_F2924_MIN_ELONG);
    }
}
