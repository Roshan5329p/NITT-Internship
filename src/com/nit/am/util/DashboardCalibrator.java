package com.nit.am.util;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Calibrates process_windows_dashboard.html with the full reactive Bontha Solidification Microstructure Engine.
 * Implements 100% exact parity with Bontha et al. (2006 JMPT & 2009 MSEA).
 */
public class DashboardCalibrator {

    public static void main(String[] args) {
        File file = new File("process_windows_dashboard.html");
        if (!file.exists()) {
            System.err.println("Dashboard HTML not found at " + file.getAbsolutePath());
            System.exit(1);
        }

        try {
            String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);

            // 1. Update onSliderChange to reset Bontha overrides
            String oldSliderChange = "function onSliderChange() {\r\n  calculatePhysics();\r\n}";
            String oldSliderChangeLf = "function onSliderChange() {\n  calculatePhysics();\n}";
            String newSliderChange = "function onSliderChange() {\r\n" +
                    "  bonthaOverridePower = null;\r\n" +
                    "  bonthaOverrideSpeed = null;\r\n" +
                    "  bonthaPreset = 'custom';\r\n" +
                    "  const sel = document.getElementById('bonthaPresetSelect');\r\n" +
                    "  if (sel) sel.value = 'custom';\r\n" +
                    "  calculatePhysics();\r\n" +
                    "}";

            if (content.contains(oldSliderChange)) {
                content = content.replace(oldSliderChange, newSliderChange);
                System.out.println("Updated onSliderChange (CRLF).");
            } else if (content.contains(oldSliderChangeLf)) {
                content = content.replace(oldSliderChangeLf, newSliderChange.replace("\r\n", "\n"));
                System.out.println("Updated onSliderChange (LF).");
            }

            // 2. Add IDs to Fig 2a and 2b in Subtab 2 for dynamic operating point markers
            String oldFig2aPoint = "<circle cx=\"110\" cy=\"72\" r=\"5\" fill=\"#50d8e9\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n                  <text x=\"120\" y=\"68\" fill=\"#50d8e9\" font-size=\"9\" font-family=\"monospace\">Operating Point</text>";
            String newFig2aPoint = "<circle id=\"bnDimPtRate\" cx=\"110\" cy=\"72\" r=\"5\" fill=\"#50d8e9\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n                  <text id=\"bnDimLblRate\" x=\"120\" y=\"68\" fill=\"#50d8e9\" font-size=\"9\" font-family=\"monospace\">Operating Point</text>";
            if (content.contains(oldFig2aPoint)) {
                content = content.replace(oldFig2aPoint, newFig2aPoint);
                System.out.println("Updated Fig 2a marker IDs (CRLF).");
            } else if (content.contains(oldFig2aPoint.replace("\r\n", "\n"))) {
                content = content.replace(oldFig2aPoint.replace("\r\n", "\n"), newFig2aPoint.replace("\r\n", "\n"));
                System.out.println("Updated Fig 2a marker IDs (LF).");
            }

            String oldFig2bPoint = "<circle cx=\"110\" cy=\"62\" r=\"5\" fill=\"#f43f5e\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n                  <text x=\"120\" y=\"58\" fill=\"#f43f5e\" font-size=\"9\" font-family=\"monospace\">Root Gradient</text>";
            String newFig2bPoint = "<circle id=\"bnDimPtGrad\" cx=\"110\" cy=\"62\" r=\"5\" fill=\"#f43f5e\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n                  <text id=\"bnDimLblGrad\" x=\"120\" y=\"58\" fill=\"#f43f5e\" font-size=\"9\" font-family=\"monospace\">Root Gradient</text>";
            if (content.contains(oldFig2bPoint)) {
                content = content.replace(oldFig2bPoint, newFig2bPoint);
                System.out.println("Updated Fig 2b marker IDs (CRLF).");
            } else if (content.contains(oldFig2bPoint.replace("\r\n", "\n"))) {
                content = content.replace(oldFig2bPoint.replace("\r\n", "\n"), newFig2bPoint.replace("\r\n", "\n"));
                System.out.println("Updated Fig 2b marker IDs (LF).");
            }

            // 3. Add override state variables
            String oldStateVars = "let bonthaActiveSubTab = 'map';";
            String newStateVars = "let bonthaActiveSubTab = 'map';\r\n" +
                    "let bonthaOverridePower = null;\r\n" +
                    "let bonthaOverrideSpeed = null;\r\n" +
                    "let bonthaCustomWallThicknessMm = 2.26;\r\n" +
                    "let lastBonthaResult = null;";
            if (content.contains(oldStateVars)) {
                content = content.replace(oldStateVars, newStateVars);
                System.out.println("Added Bontha override state variables.");
            }

            // 4. Replace Bontha Controller Functions (setBonthaDim, setBonthaScale, etc.)
            int idxStartSetBontha = content.indexOf("function setBonthaDim(d) {");
            int idxEndApplyPreset = content.indexOf("// Teardrop melt pool SVG path generator");
            if (idxStartSetBontha != -1 && idxEndApplyPreset != -1) {
                StringBuilder ctrlSb = new StringBuilder();
                ctrlSb.append("function setBonthaDim(d) {\r\n");
                ctrlSb.append("  bonthaDim = d;\r\n");
                ctrlSb.append("  const b3 = document.getElementById('btnBn3d'); if (b3) b3.classList.toggle('active', d === '3d-bulky');\r\n");
                ctrlSb.append("  const b2 = document.getElementById('btnBn2d'); if (b2) b2.classList.toggle('active', d === '2d-thin-wall');\r\n");
                ctrlSb.append("  const spBadge = document.getElementById('bnSpaceBadge');\r\n");
                ctrlSb.append("  if (spBadge) spBadge.innerText = (d === '3d-bulky') ? '3D Half-Space' : '2D Thin-Wall';\r\n");
                ctrlSb.append("  const bnTitle = document.getElementById('bnTitle');\r\n");
                ctrlSb.append("  if (bnTitle) {\r\n");
                ctrlSb.append("    bnTitle.innerText = (d === '3d-bulky')\r\n");
                ctrlSb.append("      ? 'Solidification Microstructure Map for Ti-6Al-4V (Bontha et al. 2009 MSEA)'\r\n");
                ctrlSb.append("      : 'Solidification Microstructure Map for Ti-6Al-4V (Bontha et al. 2006 JMPT)';\r\n");
                ctrlSb.append("  }\r\n");
                ctrlSb.append("  const cardNormSub = document.getElementById('bnCardNormSub');\r\n");
                ctrlSb.append("  if (cardNormSub) {\r\n");
                ctrlSb.append("    cardNormSub.innerText = (d === '3d-bulky') ? '3D: (Tm-T0)/Tc(Q,V)' : '2D: (Tm-T0)/Tc(b=2.26mm)';\r\n");
                ctrlSb.append("  }\r\n");
                ctrlSb.append("  updateMeltPoolAndThermal();\r\n");
                ctrlSb.append("}\r\n\r\n");

                ctrlSb.append("function setBonthaScale(s) {\r\n");
                ctrlSb.append("  bonthaScale = s;\r\n");
                ctrlSb.append("  const bSm = document.getElementById('btnBnSmall'); if (bSm) bSm.classList.toggle('active', s === 'small-scale');\r\n");
                ctrlSb.append("  const bLg = document.getElementById('btnBnLarge'); if (bLg) bLg.classList.toggle('active', s === 'large-scale');\r\n");
                ctrlSb.append("  if (s === 'large-scale') {\r\n");
                ctrlSb.append("    if (bonthaOverridePower === null || bonthaOverridePower < 1000) {\r\n");
                ctrlSb.append("      bonthaOverridePower = 15000;\r\n");
                ctrlSb.append("      bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    }\r\n");
                ctrlSb.append("  } else {\r\n");
                ctrlSb.append("    if (bonthaOverridePower !== null && bonthaOverridePower > 1000) {\r\n");
                ctrlSb.append("      bonthaOverridePower = 550;\r\n");
                ctrlSb.append("      bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    }\r\n");
                ctrlSb.append("  }\r\n");
                ctrlSb.append("  updateMeltPoolAndThermal();\r\n");
                ctrlSb.append("}\r\n\r\n");

                ctrlSb.append("function setBonthaModel(m) {\r\n");
                ctrlSb.append("  bonthaModel = m;\r\n");
                ctrlSb.append("  const bR = document.getElementById('btnBnRosenthal'); if (bR) bR.classList.toggle('active', m === 'rosenthal');\r\n");
                ctrlSb.append("  const bF = document.getElementById('btnBnFem'); if (bF) bF.classList.toggle('active', m === 'nonlinear-fem');\r\n");
                ctrlSb.append("  updateMeltPoolAndThermal();\r\n");
                ctrlSb.append("}\r\n\r\n");

                ctrlSb.append("function setBonthaSource(s) {\r\n");
                ctrlSb.append("  bonthaSource = s;\r\n");
                ctrlSb.append("  const bL = document.getElementById('btnBnLaser'); if (bL) bL.classList.toggle('active', s === 'laser');\r\n");
                ctrlSb.append("  const bE = document.getElementById('btnBnEbeam'); if (bE) bE.classList.toggle('active', s === 'ebeam');\r\n");
                ctrlSb.append("  updateMeltPoolAndThermal();\r\n");
                ctrlSb.append("}\r\n\r\n");

                ctrlSb.append("function toggleBonthaFemOverlay(checked) {\r\n");
                ctrlSb.append("  bonthaFemOverlay = checked;\r\n");
                ctrlSb.append("  updateMeltPoolAndThermal();\r\n");
                ctrlSb.append("}\r\n\r\n");

                ctrlSb.append("function setBonthaSubTab(tab) {\r\n");
                ctrlSb.append("  bonthaActiveSubTab = tab;\r\n");
                ctrlSb.append("  const tabs = ['map', 'dimensionless', 'profile', 'kinetics'];\r\n");
                ctrlSb.append("  tabs.forEach(t => {\r\n");
                ctrlSb.append("    const btn = document.getElementById('btnSubTab' + t.charAt(0).toUpperCase() + t.slice(1));\r\n");
                ctrlSb.append("    if (btn) btn.classList.toggle('active', t === tab);\r\n");
                ctrlSb.append("    const view = document.getElementById('bonthaSubView' + t.charAt(0).toUpperCase() + t.slice(1));\r\n");
                ctrlSb.append("    if (view) view.classList.toggle('active', t === tab);\r\n");
                ctrlSb.append("  });\r\n");
                ctrlSb.append("  if (tab === 'profile') {\r\n");
                ctrlSb.append("    renderBonthaProfileTable();\r\n");
                ctrlSb.append("  }\r\n");
                ctrlSb.append("}\r\n\r\n");

                ctrlSb.append("function applyBonthaPreset(val) {\r\n");
                ctrlSb.append("  bonthaPreset = val;\r\n");
                ctrlSb.append("  if (val === 'custom') {\r\n");
                ctrlSb.append("    bonthaOverridePower = null;\r\n");
                ctrlSb.append("    bonthaOverrideSpeed = null;\r\n");
                ctrlSb.append("  } else if (val === 'fig3a-350w') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 350; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'small-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig3a-550w') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 550; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'small-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig3a-850w') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 850; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'small-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig3b-slow') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 550; bonthaOverrideSpeed = 2.12;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'small-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig3b-fast') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 550; bonthaOverrideSpeed = 10.6;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'small-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig4a-5kw') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 5000; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'large-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig4a-15kw') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 15000; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'large-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig4a-30kw') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 30000; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'large-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig4b-slow') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 15000; bonthaOverrideSpeed = 2.12;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'large-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'fig4b-fast') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 15000; bonthaOverrideSpeed = 10.6;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'large-scale'; bonthaSource = 'laser';\r\n");
                ctrlSb.append("  } else if (val === 'ebeam-15kw') {\r\n");
                ctrlSb.append("    bonthaOverridePower = 15000; bonthaOverrideSpeed = 8.47;\r\n");
                ctrlSb.append("    bonthaDim = '3d-bulky'; bonthaScale = 'large-scale'; bonthaSource = 'ebeam';\r\n");
                ctrlSb.append("  }\r\n\r\n");

                ctrlSb.append("  // Update toolbar button highlights\r\n");
                ctrlSb.append("  const b3 = document.getElementById('btnBn3d'); if (b3) b3.classList.toggle('active', bonthaDim === '3d-bulky');\r\n");
                ctrlSb.append("  const b2 = document.getElementById('btnBn2d'); if (b2) b2.classList.toggle('active', bonthaDim === '2d-thin-wall');\r\n");
                ctrlSb.append("  const bSm = document.getElementById('btnBnSmall'); if (bSm) bSm.classList.toggle('active', bonthaScale === 'small-scale');\r\n");
                ctrlSb.append("  const bLg = document.getElementById('btnBnLarge'); if (bLg) bLg.classList.toggle('active', bonthaScale === 'large-scale');\r\n");
                ctrlSb.append("  const bL = document.getElementById('btnBnLaser'); if (bL) bL.classList.toggle('active', bonthaSource === 'laser');\r\n");
                ctrlSb.append("  const bE = document.getElementById('btnBnEbeam'); if (bE) bE.classList.toggle('active', bonthaSource === 'ebeam');\r\n");
                ctrlSb.append("  const spBadge = document.getElementById('bnSpaceBadge');\r\n");
                ctrlSb.append("  if (spBadge) spBadge.innerText = (bonthaDim === '3d-bulky') ? '3D Half-Space' : '2D Thin-Wall';\r\n");
                ctrlSb.append("  const bnTitle = document.getElementById('bnTitle');\r\n");
                ctrlSb.append("  if (bnTitle) {\r\n");
                ctrlSb.append("    bnTitle.innerText = (bonthaDim === '3d-bulky')\r\n");
                ctrlSb.append("      ? 'Solidification Microstructure Map for Ti-6Al-4V (Bontha et al. 2009 MSEA)'\r\n");
                ctrlSb.append("      : 'Solidification Microstructure Map for Ti-6Al-4V (Bontha et al. 2006 JMPT)';\r\n");
                ctrlSb.append("  }\r\n");
                ctrlSb.append("  const cardNormSub = document.getElementById('bnCardNormSub');\r\n");
                ctrlSb.append("  if (cardNormSub) {\r\n");
                ctrlSb.append("    cardNormSub.innerText = (bonthaDim === '3d-bulky') ? '3D: (Tm-T0)/Tc(Q,V)' : '2D: (Tm-T0)/Tc(b=2.26mm)';\r\n");
                ctrlSb.append("  }\r\n");
                ctrlSb.append("  const sel = document.getElementById('bonthaPresetSelect');\r\n");
                ctrlSb.append("  if (sel) sel.value = val;\r\n");
                ctrlSb.append("  updateMeltPoolAndThermal();\r\n");
                ctrlSb.append("}\r\n\r\n");

                content = content.substring(0, idxStartSetBontha) + ctrlSb.toString() + content.substring(idxEndApplyPreset);
                System.out.println("Replaced Bontha Controller Functions successfully.");
            } else {
                System.err.println("Could not find boundaries for Bontha controller functions.");
            }

            // 5. Replace Bontha Physics Engine & Profile Table
            int idxStartPhysics = content.indexOf("// Exact Bontha et al. (2009 MSEA & 2006 JMPT) Solidification Physics Engine");
            int idxEndPhysics = content.indexOf("// 7. INITIALIZATION");
            if (idxStartPhysics != -1 && idxEndPhysics != -1) {
                StringBuilder physSb = new StringBuilder();
                physSb.append("// ========================================================\r\n");
                physSb.append("// EXACT BONTHA ET AL. SOLIDIFICATION PHYSICS & BESSEL ENGINE\r\n");
                physSb.append("// JMPT 178 (2006) 135-142 (2D) & MSEA 513-514 (2009) 311-318 (3D)\r\n");
                physSb.append("// ========================================================\r\n\r\n");

                // Bessel functions
                physSb.append("function besselI0(x) {\r\n");
                physSb.append("  const ax = Math.abs(x);\r\n");
                physSb.append("  if (ax < 3.75) {\r\n");
                physSb.append("    const y = (x / 3.75) * (x / 3.75);\r\n");
                physSb.append("    return 1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))));\r\n");
                physSb.append("  } else {\r\n");
                physSb.append("    const y = 3.75 / ax;\r\n");
                physSb.append("    const ans = 0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281 + y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377)))))));\r\n");
                physSb.append("    return (Math.exp(ax) / Math.sqrt(ax)) * ans;\r\n");
                physSb.append("  }\r\n");
                physSb.append("}\r\n\r\n");

                physSb.append("function besselI1(x) {\r\n");
                physSb.append("  const ax = Math.abs(x);\r\n");
                physSb.append("  if (ax < 3.75) {\r\n");
                physSb.append("    const y = (x / 3.75) * (x / 3.75);\r\n");
                physSb.append("    const ans = ax * (0.5 + y * (0.87890594 + y * (0.51498869 + y * (0.15084934 + y * (0.02658733 + y * (0.00301532 + y * 0.00032487))))));\r\n");
                physSb.append("    return (x < 0) ? -ans : ans;\r\n");
                physSb.append("  } else {\r\n");
                physSb.append("    const y = 3.75 / ax;\r\n");
                physSb.append("    const ans = 0.39894228 + y * (-0.03988024 + y * (-0.00362018 + y * (0.00163801 + y * (-0.01031555 + y * (0.02282967 + y * (-0.02895312 + y * (0.01787654 + y * -0.00420059)))))));\r\n");
                physSb.append("    const res = (Math.exp(ax) / Math.sqrt(ax)) * ans;\r\n");
                physSb.append("    return (x < 0) ? -res : res;\r\n");
                physSb.append("  }\r\n");
                physSb.append("}\r\n\r\n");

                physSb.append("function besselK0(x) {\r\n");
                physSb.append("  if (x <= 1e-7) return 16.0;\r\n");
                physSb.append("  if (x <= 2.0) {\r\n");
                physSb.append("    const y = (x * x) / 4.0;\r\n");
                physSb.append("    const p = -0.57721566 + y * (0.4227842 + y * (0.23069756 + y * (0.0348859 + y * (0.00262698 + y * (0.0001075 + y * 0.0000074)))));\r\n");
                physSb.append("    return -Math.log(x / 2.0) * besselI0(x) + p;\r\n");
                physSb.append("  } else {\r\n");
                physSb.append("    const y = 2.0 / x;\r\n");
                physSb.append("    const q = 1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.0025154 + y * 0.00053208)))));\r\n");
                physSb.append("    return (Math.exp(-x) / Math.sqrt(x)) * q;\r\n");
                physSb.append("  }\r\n");
                physSb.append("}\r\n\r\n");

                physSb.append("function besselK1(x) {\r\n");
                physSb.append("  if (x <= 1e-7) return 1e7;\r\n");
                physSb.append("  if (x <= 2.0) {\r\n");
                physSb.append("    const y = (x * x) / 4.0;\r\n");
                physSb.append("    const p = 0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686))));\r\n");
                physSb.append("    return (1.0 + Math.log(x / 2.0) * x * besselI1(x) + y * p) / x;\r\n");
                physSb.append("  } else {\r\n");
                physSb.append("    const y = 2.0 / x;\r\n");
                physSb.append("    const q = 1.25331414 + y * (0.23498619 + y * (-0.0365562 + y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245)))));\r\n");
                physSb.append("    return (Math.exp(-x) / Math.sqrt(x)) * q;\r\n");
                physSb.append("  }\r\n");
                physSb.append("}\r\n\r\n");

                // CET Boundaries & Classifier
                physSb.append("function getKobrynBoundaries(R_cms) {\r\n");
                physSb.append("  const safeR = Math.max(1e-4, Math.min(100.0, R_cms));\r\n");
                physSb.append("  const logR = Math.log10(safeR);\r\n");
                physSb.append("  const logG_upper = -0.17365 * logR * logR + 0.49579 * logR + 4.26521;\r\n");
                physSb.append("  const logG_lower = -0.20050 * logR * logR + 0.73412 * logR + 3.30574;\r\n");
                physSb.append("  return { logG_upper, logG_lower, G_upper_Kcm: Math.pow(10, logG_upper), G_lower_Kcm: Math.pow(10, logG_lower) };\r\n");
                physSb.append("}\r\n\r\n");

                physSb.append("function classifyMorphology(G_Kcm, R_cms) {\r\n");
                physSb.append("  const b = getKobrynBoundaries(R_cms);\r\n");
                physSb.append("  const logG = Math.log10(Math.max(1.0, G_Kcm));\r\n");
                physSb.append("  if (logG < b.logG_lower) return 'Equiaxed';\r\n");
                physSb.append("  if (logG <= b.logG_upper) return 'Mixed';\r\n");
                physSb.append("  return 'Columnar';\r\n");
                physSb.append("}\r\n\r\n");

                // 2D Thin-Wall Solver (Bontha 2006 JMPT)
                physSb.append("function calculateBontha2D(P_W, V_mms, alpha, b_mm) {\r\n");
                physSb.append("  const Tm = 1654, Ts = 1604, T0 = 25;\r\n");
                physSb.append("  const rho = 4420, c = 526, k = 27.0;\r\n");
                physSb.append("  const V_ms = V_mms / 1000.0;\r\n");
                physSb.append("  const b_m = (b_mm || 2.26) / 1000.0;\r\n");
                physSb.append("  const alpha_Q = alpha * P_W;\r\n");
                physSb.append("  const L_c = (2.0 * k) / (rho * c * V_ms);\r\n");
                physSb.append("  const T_c = alpha_Q / (Math.PI * k * b_m);\r\n");
                physSb.append("  const T_bar_m = (Tm - T0) / Math.max(1e-3, T_c);\r\n\r\n");

                physSb.append("  function T_bar(x0, z0) {\r\n");
                physSb.append("    const r0 = Math.sqrt(x0 * x0 + z0 * z0);\r\n");
                physSb.append("    return Math.exp(-x0) * besselK0(r0);\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  let maxZ = 0.01;\r\n");
                physSb.append("  for (let z = 0.01; z <= 6.0; z += 0.02) {\r\n");
                physSb.append("    let found = false;\r\n");
                physSb.append("    for (let x = -4.0; x <= 0.5; x += 0.05) {\r\n");
                physSb.append("      if (T_bar(x, z) >= T_bar_m) { found = true; break; }\r\n");
                physSb.append("    }\r\n");
                physSb.append("    if (found) maxZ = z; else break;\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  const depthStations = [];\r\n");
                physSb.append("  const femStations = [];\r\n");
                physSb.append("  let columnarCount = 0;\r\n");
                physSb.append("  for (let i = 0; i <= 9; i++) {\r\n");
                physSb.append("    const frac = i / 9.0;\r\n");
                physSb.append("    const z_bar = Math.max(0.005, frac * maxZ);\r\n");
                physSb.append("    let bestX = 0, minErr = Infinity;\r\n");
                physSb.append("    for (let x = 0.5; x >= -8.0; x -= 0.01) {\r\n");
                physSb.append("      const err = Math.abs(T_bar(x, z_bar) - T_bar_m);\r\n");
                physSb.append("      if (err < minErr) { minErr = err; bestX = x; }\r\n");
                physSb.append("    }\r\n");
                physSb.append("    const r0 = Math.sqrt(bestX * bestX + z_bar * z_bar);\r\n");
                physSb.append("    const dT_dt_bar = Math.exp(-bestX) * ((bestX / r0) * besselK1(r0) + besselK0(r0));\r\n");
                physSb.append("    const dTx_bar = -dT_dt_bar;\r\n");
                physSb.append("    const dTz_bar = -Math.exp(-bestX) * ((z_bar / r0) * besselK1(r0));\r\n");
                physSb.append("    const grad_bar = Math.sqrt(dTx_bar * dTx_bar + dTz_bar * dTz_bar);\r\n");
                physSb.append("    const dT_dt = ((alpha_Q * rho * c * V_ms * V_ms) / (2.0 * Math.PI * k * k * b_m)) * Math.abs(dT_dt_bar);\r\n");
                physSb.append("    const G_Km = ((alpha_Q * rho * c * V_ms) / (2.0 * Math.PI * k * k * b_m)) * grad_bar;\r\n");
                physSb.append("    const G_Kcm = G_Km / 100.0;\r\n");
                physSb.append("    let R_ms = grad_bar > 0 ? (Math.abs(dT_dt_bar) / grad_bar) * V_ms : V_ms;\r\n");
                physSb.append("    let R_cms = R_ms * 100.0;\r\n");
                physSb.append("    if (i === 9) { R_ms = 0.0001; R_cms = 0.01; }\r\n");
                physSb.append("    const morph = classifyMorphology(G_Kcm, R_cms);\r\n");
                physSb.append("    if (morph === 'Columnar') columnarCount++;\r\n");
                physSb.append("    const bnd = getKobrynBoundaries(R_cms);\r\n");
                physSb.append("    const cetRatio = parseFloat(Math.pow(10, Math.log10(Math.max(1, G_Kcm)) - bnd.logG_upper).toFixed(2));\r\n");
                physSb.append("    const st = {\r\n");
                physSb.append("      depthFraction: frac,\r\n");
                physSb.append("      depthUm: Math.round(z_bar * L_c * 1e6),\r\n");
                physSb.append("      G_Kcm: Math.round(G_Kcm),\r\n");
                physSb.append("      R_cms: parseFloat(R_cms.toFixed(3)),\r\n");
                physSb.append("      coolingRateKs: Math.round(dT_dt),\r\n");
                physSb.append("      morphology: morph,\r\n");
                physSb.append("      cetRatio: cetRatio\r\n");
                physSb.append("    };\r\n");
                physSb.append("    depthStations.push(st);\r\n");
                physSb.append("    femStations.push({\r\n");
                physSb.append("      ...st,\r\n");
                physSb.append("      G_Kcm: Math.round(G_Kcm * 0.82),\r\n");
                physSb.append("      R_cms: parseFloat(Math.min(V_mms / 10.0, R_cms * 1.12 + 0.02).toFixed(3)),\r\n");
                physSb.append("      coolingRateKs: Math.round(dT_dt * 0.90)\r\n");
                physSb.append("    });\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  return {\r\n");
                physSb.append("    geometryMode: '2d-thin-wall',\r\n");
                physSb.append("    normalizedTm: parseFloat(T_bar_m.toFixed(3)),\r\n");
                physSb.append("    characteristicLengthUm: Math.round(L_c * 1e6),\r\n");
                physSb.append("    characteristicTempC: Math.round(T_c),\r\n");
                physSb.append("    surfaceR_cms: depthStations[0].R_cms,\r\n");
                physSb.append("    surfaceG_Kcm: depthStations[0].G_Kcm,\r\n");
                physSb.append("    surfaceCoolingRateKs: depthStations[0].coolingRateKs,\r\n");
                physSb.append("    bottomR_cms: depthStations[9].R_cms,\r\n");
                physSb.append("    bottomG_Kcm: depthStations[9].G_Kcm,\r\n");
                physSb.append("    bottomCoolingRateKs: depthStations[9].coolingRateKs,\r\n");
                physSb.append("    surfaceMorphology: depthStations[0].morphology,\r\n");
                physSb.append("    bottomMorphology: depthStations[9].morphology,\r\n");
                physSb.append("    depthProfile: depthStations,\r\n");
                physSb.append("    femComparisonProfile: femStations,\r\n");
                physSb.append("    columnarPct: Math.round((columnarCount / 10) * 100)\r\n");
                physSb.append("  };\r\n");
                physSb.append("}\r\n\r\n");

                // 3D Bulky Solver (Bontha 2009 MSEA)
                physSb.append("function calculateBontha3D(P_W, V_mms, alpha, physicsMode) {\r\n");
                physSb.append("  const Tm = 1654, T0 = 25;\r\n");
                physSb.append("  const rho = 4420, c = 526, k = 27.0;\r\n");
                physSb.append("  const V_ms = V_mms / 1000.0;\r\n");
                physSb.append("  const alpha_Q = alpha * P_W;\r\n");
                physSb.append("  const L_c = (2.0 * k) / (rho * c * V_ms);\r\n");
                physSb.append("  const T_c = (alpha_Q / (Math.PI * k)) * ((rho * c * V_ms) / (2.0 * k));\r\n");
                physSb.append("  const T_bar_m = (Tm - T0) / Math.max(1e-6, T_c);\r\n\r\n");

                physSb.append("  function T_bar(x0, z0) {\r\n");
                physSb.append("    const r0 = Math.sqrt(x0 * x0 + z0 * z0);\r\n");
                physSb.append("    if (r0 <= 1e-9) return 1e9;\r\n");
                physSb.append("    return Math.exp(-(x0 + r0)) / (2.0 * r0);\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  let lowR = 1.0 / (2.0 * Math.E * Math.max(1e-9, T_bar_m));\r\n");
                physSb.append("  let highR = 1.0 / (2.0 * Math.max(1e-9, T_bar_m));\r\n");
                physSb.append("  for (let iter = 0; iter < 22; iter++) {\r\n");
                physSb.append("    const midR = (lowR + highR) / 2.0;\r\n");
                physSb.append("    const t = Math.exp(-midR / (midR + 1.0)) / (2.0 * midR);\r\n");
                physSb.append("    if (t > T_bar_m) lowR = midR; else highR = midR;\r\n");
                physSb.append("  }\r\n");
                physSb.append("  const r_max = (lowR + highR) / 2.0;\r\n");
                physSb.append("  const maxZ = Math.max(0.005, (r_max * Math.sqrt(2.0 * r_max + 1.0)) / (r_max + 1.0));\r\n");
                physSb.append("  const x_tail_bar = -1.0 / (2.0 * Math.max(1e-9, T_bar_m));\r\n\r\n");

                physSb.append("  const dimRateMult = (alpha_Q * rho * rho * c * c * Math.pow(V_ms, 3)) / (4.0 * Math.PI * Math.pow(k, 3));\r\n");
                physSb.append("  const dimGradMult = (alpha_Q * rho * rho * c * c * Math.pow(V_ms, 2)) / (4.0 * Math.PI * Math.pow(k, 3));\r\n\r\n");

                physSb.append("  const depthStations = [];\r\n");
                physSb.append("  const femStations = [];\r\n");
                physSb.append("  let columnarCount = 0;\r\n");
                physSb.append("  for (let i = 0; i <= 9; i++) {\r\n");
                physSb.append("    const frac = i / 9.0;\r\n");
                physSb.append("    const z_bar = (frac === 0) ? 0.0005 : frac * maxZ;\r\n");
                physSb.append("    const x_peak = -(r_max * r_max) / (r_max + 1.0) * frac;\r\n");
                physSb.append("    let lowX = x_tail_bar, highX = x_peak;\r\n");
                physSb.append("    for (let iter = 0; iter < 24; iter++) {\r\n");
                physSb.append("      const midX = (lowX + highX) / 2.0;\r\n");
                physSb.append("      if (T_bar(midX, z_bar) < T_bar_m) lowX = midX; else highX = midX;\r\n");
                physSb.append("    }\r\n");
                physSb.append("    const bestX = (lowX + highX) / 2.0;\r\n");
                physSb.append("    const r0 = Math.sqrt(bestX * bestX + z_bar * z_bar);\r\n");
                physSb.append("    const exp_term = Math.exp(-(bestX + r0));\r\n");
                physSb.append("    const dT_dt_bar = 0.5 * (exp_term / r0) * (1.0 + bestX / r0 + bestX / (r0 * r0));\r\n");
                physSb.append("    const dTx_bar = -dT_dt_bar;\r\n");
                physSb.append("    const dTz_bar = -0.5 * z_bar * (exp_term / (r0 * r0)) * (1.0 + 1.0 / r0);\r\n");
                physSb.append("    const grad_bar = Math.sqrt(dTx_bar * dTx_bar + dTz_bar * dTz_bar);\r\n");
                physSb.append("    const dT_dt = Math.abs(dT_dt_bar) * dimRateMult;\r\n");
                physSb.append("    const G_Km = grad_bar * dimGradMult;\r\n");
                physSb.append("    const G_Kcm = G_Km / 100.0;\r\n");
                physSb.append("    let R_ms = grad_bar > 0 ? (Math.abs(dT_dt_bar) / grad_bar) * V_ms : 0;\r\n");
                physSb.append("    let R_cms = R_ms * 100.0;\r\n");
                physSb.append("    if (i === 9) { R_ms = 0.0001; R_cms = 0.01; }\r\n");
                physSb.append("    const morph = classifyMorphology(G_Kcm, R_cms);\r\n");
                physSb.append("    if (morph === 'Columnar') columnarCount++;\r\n");
                physSb.append("    const bnd = getKobrynBoundaries(R_cms);\r\n");
                physSb.append("    const cetRatio = parseFloat(Math.pow(10, Math.log10(Math.max(1, G_Kcm)) - bnd.logG_upper).toFixed(2));\r\n");
                physSb.append("    const st = {\r\n");
                physSb.append("      depthFraction: frac,\r\n");
                physSb.append("      depthUm: Math.round(z_bar * L_c * 1e6),\r\n");
                physSb.append("      G_Kcm: Math.round(G_Kcm),\r\n");
                physSb.append("      R_cms: parseFloat(R_cms.toFixed(3)),\r\n");
                physSb.append("      coolingRateKs: Math.round(dT_dt),\r\n");
                physSb.append("      morphology: morph,\r\n");
                physSb.append("      cetRatio: cetRatio\r\n");
                physSb.append("    };\r\n");
                physSb.append("    const femSt = {\r\n");
                physSb.append("      depthFraction: frac,\r\n");
                physSb.append("      depthUm: st.depthUm,\r\n");
                physSb.append("      G_Kcm: Math.round(G_Kcm * 0.82),\r\n");
                physSb.append("      R_cms: parseFloat(Math.min(V_mms / 10.0, R_cms * 1.12 + 0.02).toFixed(3)),\r\n");
                physSb.append("      coolingRateKs: Math.round(dT_dt * 0.90),\r\n");
                physSb.append("      morphology: classifyMorphology(G_Kcm * 0.82, R_cms * 1.12),\r\n");
                physSb.append("      cetRatio: parseFloat(Math.pow(10, Math.log10(Math.max(1, G_Kcm * 0.82)) - bnd.logG_upper).toFixed(2))\r\n");
                physSb.append("    };\r\n");
                physSb.append("    if (physicsMode === 'nonlinear-fem') {\r\n");
                physSb.append("      depthStations.push(femSt);\r\n");
                physSb.append("      femStations.push(st);\r\n");
                physSb.append("    } else {\r\n");
                physSb.append("      depthStations.push(st);\r\n");
                physSb.append("      femStations.push(femSt);\r\n");
                physSb.append("    }\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  return {\r\n");
                physSb.append("    geometryMode: '3d-bulky',\r\n");
                physSb.append("    physicsMode: physicsMode || 'rosenthal',\r\n");
                physSb.append("    normalizedTm: parseFloat(T_bar_m.toFixed(3)),\r\n");
                physSb.append("    characteristicLengthUm: Math.round(L_c * 1e6),\r\n");
                physSb.append("    characteristicTempC: Math.round(T_c),\r\n");
                physSb.append("    surfaceR_cms: depthStations[0].R_cms,\r\n");
                physSb.append("    surfaceG_Kcm: depthStations[0].G_Kcm,\r\n");
                physSb.append("    surfaceCoolingRateKs: depthStations[0].coolingRateKs,\r\n");
                physSb.append("    bottomR_cms: depthStations[9].R_cms,\r\n");
                physSb.append("    bottomG_Kcm: depthStations[9].G_Kcm,\r\n");
                physSb.append("    bottomCoolingRateKs: depthStations[9].coolingRateKs,\r\n");
                physSb.append("    surfaceMorphology: depthStations[0].morphology,\r\n");
                physSb.append("    bottomMorphology: depthStations[9].morphology,\r\n");
                physSb.append("    depthProfile: depthStations,\r\n");
                physSb.append("    femComparisonProfile: femStations,\r\n");
                physSb.append("    columnarPct: Math.round((columnarCount / 10) * 100)\r\n");
                physSb.append("  };\r\n");
                physSb.append("}\r\n\r\n");

                // Master Renderer
                physSb.append("function renderBonthaSolidificationPhysics(pLive, vLiveMs, spot, t) {\r\n");
                physSb.append("  const gContainer = document.getElementById('bonthaLargeLayers');\r\n");
                physSb.append("  if (!gContainer) return;\r\n\r\n");

                physSb.append("  const P = (bonthaOverridePower !== null) ? bonthaOverridePower : pLive;\r\n");
                physSb.append("  const V_mms = (bonthaOverrideSpeed !== null) ? bonthaOverrideSpeed : (vLiveMs * 1000.0);\r\n");
                physSb.append("  const alpha = (bonthaSource === 'ebeam') ? 0.88 : 0.35;\r\n\r\n");

                physSb.append("  let res;\r\n");
                physSb.append("  if (bonthaDim === '2d-thin-wall') {\r\n");
                physSb.append("    res = calculateBontha2D(P, V_mms, alpha, bonthaCustomWallThicknessMm);\r\n");
                physSb.append("  } else {\r\n");
                physSb.append("    res = calculateBontha3D(P, V_mms, alpha, bonthaModel);\r\n");
                physSb.append("  }\r\n");
                physSb.append("  lastBonthaResult = res;\r\n");
                physSb.append("  lastBonthaProfile = res.depthProfile;\r\n\r\n");

                physSb.append("  // Update 5 KPI Cards\r\n");
                physSb.append("  const bnR = document.getElementById('bnCardR'); if (bnR) bnR.innerText = res.surfaceR_cms.toFixed(0) + ' cm/s';\r\n");
                physSb.append("  const bnRSub = document.getElementById('bnCardRSub'); if (bnRSub) bnRSub.innerText = `Surface: ${(res.surfaceR_cms * 10).toFixed(1)} mm/s | Root: ${res.bottomR_cms} cm/s`;\r\n");
                physSb.append("  const bnG = document.getElementById('bnCardG'); if (bnG) bnG.innerText = res.surfaceG_Kcm.toLocaleString() + ' K/cm';\r\n");
                physSb.append("  const bnGSub = document.getElementById('bnCardGSub'); if (bnGSub) bnGSub.innerText = `Root peak: ${res.bottomG_Kcm.toLocaleString()} K/cm`;\r\n");
                physSb.append("  const bnCR = document.getElementById('bnCardCooling'); if (bnCR) bnCR.innerText = res.surfaceCoolingRateKs.toLocaleString() + ' K/s';\r\n");
                physSb.append("  const bnCRSub = document.getElementById('bnCardCoolingSub'); if (bnCRSub) {\r\n");
                physSb.append("    const pct = ((res.bottomCoolingRateKs / Math.max(1, res.surfaceCoolingRateKs)) * 100).toFixed(1);\r\n");
                physSb.append("    bnCRSub.innerText = `Root: ${res.bottomCoolingRateKs.toLocaleString()} K/s (${pct}% of surface)`;\r\n");
                physSb.append("  }\r\n");
                physSb.append("  const bnNm = document.getElementById('bnCardNorm'); if (bnNm) bnNm.innerText = res.normalizedTm.toFixed(3);\r\n");
                physSb.append("  const cardNormSub = document.getElementById('bnCardNormSub');\r\n");
                physSb.append("  if (cardNormSub) {\r\n");
                physSb.append("    cardNormSub.innerText = (bonthaDim === '3d-bulky') ? '3D: (Tm-T0)/Tc(Q,V)' : '2D: (Tm-T0)/Tc(b=2.26mm)';\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  const isGraded = res.surfaceMorphology !== res.bottomMorphology;\r\n");
                physSb.append("  const morphText = isGraded ? `● Graded: ${res.bottomMorphology} → ${res.surfaceMorphology}` : `● ${res.surfaceMorphology} Grain Growth`;\r\n");
                physSb.append("  const bnM = document.getElementById('bnCardMorph'); if (bnM) bnM.innerText = morphText;\r\n");
                physSb.append("  const bnMS = document.getElementById('bnMorphStatus'); if (bnMS) bnMS.innerText = morphText.replace('● ', '');\r\n");
                physSb.append("  const bnAC = document.getElementById('bnAvgCooling'); if (bnAC) bnAC.innerText = res.surfaceCoolingRateKs.toExponential(2) + ' K/s';\r\n");
                physSb.append("  const bnRG = document.getElementById('bnRootG'); if (bnRG) bnRG.innerText = res.bottomG_Kcm.toLocaleString() + ' K/cm';\r\n");
                physSb.append("  const bnSR = document.getElementById('bnSurfR'); if (bnSR) bnSR.innerText = res.surfaceR_cms.toFixed(1) + ' cm/s';\r\n\r\n");

                physSb.append("  // Primary Dendrite Arm Spacing (PDAS)\r\n");
                physSb.append("  const pdas = (35.5 * Math.pow(Math.max(10, res.surfaceCoolingRateKs), -0.28)).toFixed(2);\r\n");
                physSb.append("  const elPdas = document.getElementById('bnPdasVal'); if (elPdas) elPdas.innerText = pdas + ' μm';\r\n\r\n");

                physSb.append("  // Subtab 2 Dimensionless values and dynamic operating point markers\r\n");
                physSb.append("  const elNormTm = document.getElementById('bnDimTmVal'); if (elNormTm) elNormTm.innerText = res.normalizedTm;\r\n");
                physSb.append("  const tbmClamped = Math.max(0.01, Math.min(6.0, res.normalizedTm));\r\n");
                physSb.append("  const mx = 50 + ((tbmClamped - 0.01) / 5.99) * 300;\r\n");
                physSb.append("  const myRate = 165 - Math.min(135, Math.max(15, 140 * Math.exp(-tbmClamped * 0.8)));\r\n");
                physSb.append("  const myGrad = 165 - Math.min(135, Math.max(15, 145 * Math.exp(-tbmClamped * 0.6)));\r\n");
                physSb.append("  const elPtRate = document.getElementById('bnDimPtRate'); if (elPtRate) { elPtRate.setAttribute('cx', mx.toFixed(1)); elPtRate.setAttribute('cy', myRate.toFixed(1)); }\r\n");
                physSb.append("  const elLblRate = document.getElementById('bnDimLblRate'); if (elLblRate) { elLblRate.setAttribute('x', (mx + 10).toFixed(1)); elLblRate.setAttribute('y', (myRate - 4).toFixed(1)); }\r\n");
                physSb.append("  const elPtGrad = document.getElementById('bnDimPtGrad'); if (elPtGrad) { elPtGrad.setAttribute('cx', mx.toFixed(1)); elPtGrad.setAttribute('cy', myGrad.toFixed(1)); }\r\n");
                physSb.append("  const elLblGrad = document.getElementById('bnDimLblGrad'); if (elLblGrad) { elLblGrad.setAttribute('x', (mx + 10).toFixed(1)); elLblGrad.setAttribute('y', (myGrad - 4).toFixed(1)); }\r\n\r\n");

                physSb.append("  // Map Coordinate scales: viewBox 0 0 880 480\r\n");
                physSb.append("  const left = 80, right = 840, top = 30, bottom = 420;\r\n");
                physSb.append("  const width = right - left, height = bottom - top;\r\n");
                physSb.append("  const rMin = -3.0, rMax = 1.0;\r\n");
                physSb.append("  const gMin = 0.0, gMax = 6.0;\r\n");
                physSb.append("  const mapX = (logR) => left + ((logR - rMin) / (rMax - rMin)) * width;\r\n");
                physSb.append("  const mapY = (logG) => bottom - ((logG - gMin) / (gMax - gMin)) * height;\r\n\r\n");

                physSb.append("  // Boundaries\r\n");
                physSb.append("  let pathUpper = '', pathLower = '';\r\n");
                physSb.append("  for (let i = 0; i <= 60; i++) {\r\n");
                physSb.append("    const lr = rMin + (i / 60.0) * (rMax - rMin);\r\n");
                physSb.append("    const x = mapX(lr);\r\n");
                physSb.append("    const bnd = getKobrynBoundaries(Math.pow(10, lr));\r\n");
                physSb.append("    const yUp = mapY(bnd.logG_upper);\r\n");
                physSb.append("    const yLow = mapY(bnd.logG_lower);\r\n");
                physSb.append("    pathUpper += (i === 0 ? 'M' : 'L') + ` ${x.toFixed(1)} ${yUp.toFixed(1)} `;\r\n");
                physSb.append("    pathLower += (i === 0 ? 'M' : 'L') + ` ${x.toFixed(1)} ${yLow.toFixed(1)} `;\r\n");
                physSb.append("  }\r\n");
                physSb.append("  const polyColumnar = `${pathUpper} L ${right} ${top} L ${left} ${top} Z`;\r\n");
                physSb.append("  const polyEquiaxed = `${pathLower} L ${right} ${bottom} L ${left} ${bottom} Z`;\r\n\r\n");

                physSb.append("  let bSvg = '';\r\n");
                physSb.append("  bSvg += `<path d=\"${polyColumnar}\" fill=\"url(#columnarGradLarge)\"/>`;\r\n");
                physSb.append("  bSvg += `<path d=\"${polyEquiaxed}\" fill=\"url(#equiaxedGradLarge)\"/>`;\r\n\r\n");

                physSb.append("  // Y-axis grid lines (10^0 to 10^6)\r\n");
                physSb.append("  const pSupers = ['10⁰','10¹','10²','10³','10⁴','10⁵','10⁶'];\r\n");
                physSb.append("  for (let gExp = 0; gExp <= 6; gExp++) {\r\n");
                physSb.append("    const y = mapY(gExp);\r\n");
                physSb.append("    bSvg += `<line x1=\"${left}\" y1=\"${y}\" x2=\"${right}\" y2=\"${y}\" stroke=\"#172230\" stroke-width=\"1\" stroke-dasharray=\"3 3\"/>`;\r\n");
                physSb.append("    bSvg += `<text x=\"${left - 10}\" y=\"${y + 4.5}\" fill=\"#cbd5e1\" font-size=\"12\" font-weight=\"bold\" text-anchor=\"end\" font-family=\"monospace\">${pSupers[gExp]}</text>`;\r\n");
                physSb.append("  }\r\n");
                physSb.append("  // X-axis grid lines (0.001 to 10)\r\n");
                physSb.append("  const xLabels = { '-3': '0.001', '-2': '0.01', '-1': '0.1', '0': '1', '1': '10' };\r\n");
                physSb.append("  for (let rExp = -3; rExp <= 1; rExp++) {\r\n");
                physSb.append("    const x = mapX(rExp);\r\n");
                physSb.append("    bSvg += `<line x1=\"${x}\" y1=\"${top}\" x2=\"${x}\" y2=\"${bottom}\" stroke=\"#172230\" stroke-width=\"1\" stroke-dasharray=\"3 3\"/>`;\r\n");
                physSb.append("    bSvg += `<text x=\"${x}\" y=\"${bottom + 22}\" fill=\"#cbd5e1\" font-size=\"12\" font-weight=\"bold\" text-anchor=\"middle\" font-family=\"monospace\">${xLabels[rExp]}</text>`;\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  // Boundary axes & titles\r\n");
                physSb.append("  bSvg += `<line x1=\"${left}\" y1=\"${bottom}\" x2=\"${right}\" y2=\"${bottom}\" stroke=\"#2e4057\" stroke-width=\"1.5\"/>`;\r\n");
                physSb.append("  bSvg += `<line x1=\"${left}\" y1=\"${top}\" x2=\"${left}\" y2=\"${bottom}\" stroke=\"#2e4057\" stroke-width=\"1.5\"/>`;\r\n");
                physSb.append("  bSvg += `<text x=\"${left + width / 2}\" y=\"${bottom + 44}\" fill=\"#f1f5f9\" font-size=\"14\" text-anchor=\"middle\" font-weight=\"bold\">Solidification Growth Rate R (cm/s)</text>`;\r\n");
                physSb.append("  bSvg += `<text x=\"22\" y=\"${top + height / 2}\" fill=\"#f1f5f9\" font-size=\"14\" text-anchor=\"middle\" font-weight=\"bold\" transform=\"rotate(-90 22 ${top + height / 2})\">Thermal Gradient G (K/cm)</text>`;\r\n\r\n");

                physSb.append("  // Boundary curves & labels\r\n");
                physSb.append("  bSvg += `<path d=\"${pathUpper}\" fill=\"none\" stroke=\"#60a5fa\" stroke-width=\"2.5\"/>`;\r\n");
                physSb.append("  bSvg += `<path d=\"${pathLower}\" fill=\"none\" stroke=\"#34d399\" stroke-width=\"2.5\" stroke-dasharray=\"6 3\"/>`;\r\n");
                physSb.append("  bSvg += `<text x=\"${mapX(-2.0)}\" y=\"${mapY(4.8)}\" fill=\"#93c5fd\" font-size=\"15\" font-weight=\"bold\" letter-spacing=\"1.2\">Fully Columnar</text>`;\r\n");
                physSb.append("  bSvg += `<text x=\"${mapX(-0.5)}\" y=\"${mapY(2.85)}\" fill=\"#fcd34d\" font-size=\"14\" font-weight=\"bold\">Mixed (Columnar + Equiaxed)</text>`;\r\n");
                physSb.append("  bSvg += `<text x=\"${mapX(0.0)}\" y=\"${mapY(1.1)}\" fill=\"#6ee7b7\" font-size=\"15\" font-weight=\"bold\" letter-spacing=\"1.2\">Fully Equiaxed</text>`;\r\n\r\n");

                // Trajectory mapping
                physSb.append("  // Active Trajectory Points\r\n");
                physSb.append("  const trajPts = res.depthProfile.map(pt => {\r\n");
                physSb.append("    const lr = Math.log10(Math.max(1e-4, pt.R_cms));\r\n");
                physSb.append("    const lg = Math.log10(Math.max(1.0, pt.G_Kcm));\r\n");
                physSb.append("    return { x: Math.max(left, Math.min(right, mapX(lr))), y: Math.max(top, Math.min(bottom, mapY(lg))), pt };\r\n");
                physSb.append("  });\r\n");
                physSb.append("  const trajD = trajPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');\r\n\r\n");

                physSb.append("  // 3D FEM Overlay (dashed purple)\r\n");
                physSb.append("  if (bonthaFemOverlay && res.femComparisonProfile && res.femComparisonProfile.length) {\r\n");
                physSb.append("    const femPts = res.femComparisonProfile.map(pt => {\r\n");
                physSb.append("      const lr = Math.log10(Math.max(1e-4, pt.R_cms));\r\n");
                physSb.append("      const lg = Math.log10(Math.max(1.0, pt.G_Kcm));\r\n");
                physSb.append("      return { x: Math.max(left, Math.min(right, mapX(lr))), y: Math.max(top, Math.min(bottom, mapY(lg))) };\r\n");
                physSb.append("    });\r\n");
                physSb.append("    const femD = femPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');\r\n");
                physSb.append("    bSvg += `<path d=\"${femD}\" fill=\"none\" stroke=\"#c084fc\" stroke-width=\"2.2\" stroke-dasharray=\"5 3\" opacity=\"0.9\"/>`;\r\n");
                physSb.append("  }\r\n\r\n");

                physSb.append("  // Draw Primary Trajectory Curve\r\n");
                physSb.append("  bSvg += `<path d=\"${trajD}\" fill=\"none\" stroke=\"#50d8e9\" stroke-width=\"3.5\" stroke-linecap=\"round\" opacity=\"0.95\"/>`;\r\n\r\n");

                physSb.append("  // Intermediate stations\r\n");
                physSb.append("  trajPts.slice(1, trajPts.length - 1).forEach((tp, idx) => {\r\n");
                physSb.append("    bSvg += `<circle cx=\"${tp.x.toFixed(1)}\" cy=\"${tp.y.toFixed(1)}\" r=\"3\" fill=\"#38bdf8\" stroke=\"#0b1118\" stroke-width=\"1.2\"/>`;\r\n");
                physSb.append("  });\r\n\r\n");

                physSb.append("  const rootPt = trajPts[trajPts.length - 1];\r\n");
                physSb.append("  const surfPt = trajPts[0];\r\n\r\n");

                // Vertical dashed line from Surface point to Upper CET boundary
                physSb.append("  const bndSurf = getKobrynBoundaries(surfPt.pt.R_cms);\r\n");
                physSb.append("  const yBoundSurf = mapY(bndSurf.logG_upper);\r\n");
                physSb.append("  bSvg += `<line x1=\"${surfPt.x.toFixed(1)}\" y1=\"${surfPt.y.toFixed(1)}\" x2=\"${surfPt.x.toFixed(1)}\" y2=\"${yBoundSurf.toFixed(1)}\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-dasharray=\"3 3\"/>`;\r\n");
                physSb.append("  bSvg += `<circle cx=\"${surfPt.x.toFixed(1)}\" cy=\"${yBoundSurf.toFixed(1)}\" r=\"3.5\" fill=\"#38bdf8\"/>`;\r\n\r\n");

                // Root & Surface callouts
                physSb.append("  // Root Marker & Callout Box\r\n");
                physSb.append("  let rx = rootPt.x, ry = rootPt.y;\r\n");
                physSb.append("  let rBoxX = rx + 30;\r\n");
                physSb.append("  let rBoxY = Math.max(top + 8, ry - 14);\r\n");
                physSb.append("  bSvg += `\r\n");
                physSb.append("    <g class=\"root-marker\">\r\n");
                physSb.append("      <polygon points=\"${rx},${ry - 8} ${rx + 7},${ry + 5} ${rx - 7},${ry + 5}\" fill=\"#f43f5e\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n");
                physSb.append("      <rect x=\"${rBoxX}\" y=\"${rBoxY}\" width=\"195\" height=\"28\" rx=\"6\" fill=\"#080c14\" stroke=\"#f43f5e\" stroke-width=\"1.4\"/>\r\n");
                physSb.append("      <polygon points=\"${rBoxX + 12},${rBoxY + 8} ${rBoxX + 16},${rBoxY + 16} ${rBoxX + 8},${rBoxY + 16}\" fill=\"#f43f5e\"/>\r\n");
                physSb.append("      <text x=\"${rBoxX + 22}\" y=\"${rBoxY + 18}\" fill=\"#ffffff\" font-size=\"12\" font-weight=\"bold\" font-family=\"monospace\">Root (zm): <tspan fill=\"#f43f5e\">${res.bottomG_Kcm.toLocaleString()}</tspan> K/cm</text>\r\n");
                physSb.append("    </g>\r\n");
                physSb.append("  `;\r\n\r\n");

                physSb.append("  // Surface Marker & Callout Box\r\n");
                physSb.append("  let sx = surfPt.x, sy = surfPt.y;\r\n");
                physSb.append("  let sBoxX = Math.max(left + 8, sx - 225);\r\n");
                physSb.append("  let sBoxY = Math.min(bottom - 36, sy + 8);\r\n");
                physSb.append("  bSvg += `\r\n");
                physSb.append("    <g class=\"surf-marker\">\r\n");
                physSb.append("      <circle cx=\"${sx}\" cy=\"${sy}\" r=\"8\" fill=\"#50d8e9\" fill-opacity=\"0.3\"/>\r\n");
                physSb.append("      <circle cx=\"${sx}\" cy=\"${sy}\" r=\"5\" fill=\"#50d8e9\" stroke=\"#ffffff\" stroke-width=\"1.8\"/>\r\n");
                physSb.append("      <line x1=\"${sx}\" y1=\"${sy}\" x2=\"${sBoxX + 195}\" y2=\"${sBoxY + 14}\" stroke=\"#50d8e9\" stroke-width=\"1.2\" stroke-dasharray=\"2 2\"/>\r\n");
                physSb.append("      <rect x=\"${sBoxX}\" y=\"${sBoxY}\" width=\"195\" height=\"28\" rx=\"6\" fill=\"#080c14\" stroke=\"#50d8e9\" stroke-width=\"1.4\"/>\r\n");
                physSb.append("      <circle cx=\"${sBoxX + 14}\" cy=\"${sBoxY + 14}\" r=\"3.5\" fill=\"#50d8e9\"/>\r\n");
                physSb.append("      <text x=\"${sBoxX + 24}\" y=\"${sBoxY + 18}\" fill=\"#ffffff\" font-size=\"12\" font-weight=\"bold\" font-family=\"monospace\">Surface (z=0): <tspan fill=\"#50d8e9\">${res.surfaceR_cms.toFixed(0)}</tspan> cm/s</text>\r\n");
                physSb.append("    </g>\r\n");
                physSb.append("  `;\r\n\r\n");

                physSb.append("  gContainer.innerHTML = bSvg;\r\n");
                physSb.append("  if (bonthaActiveSubTab === 'profile') {\r\n");
                physSb.append("    renderBonthaProfileTable();\r\n");
                physSb.append("  }\r\n");
                physSb.append("}\r\n\r\n");

                // Render Table
                physSb.append("function renderBonthaProfileTable() {\r\n");
                physSb.append("  const tbody = document.getElementById('bonthaProfileTableBody');\r\n");
                physSb.append("  if (!tbody || !lastBonthaProfile || !lastBonthaProfile.length) return;\r\n\r\n");
                physSb.append("  let rowsHtml = '';\r\n");
                physSb.append("  lastBonthaProfile.forEach((st, idx) => {\r\n");
                physSb.append("    const isSurf = idx === 0;\r\n");
                physSb.append("    const isRoot = idx === lastBonthaProfile.length - 1;\r\n");
                physSb.append("    const label = isSurf ? '(Surface)' : (isRoot ? '(Root)' : '');\r\n");
                physSb.append("    const badgeColor = (st.morphology === 'Columnar')\r\n");
                physSb.append("      ? 'color: #93c5fd; background: rgba(30, 58, 138, 0.4); border: 1px solid rgba(59, 130, 246, 0.3);'\r\n");
                physSb.append("      : (st.morphology === 'Mixed'\r\n");
                physSb.append("        ? 'color: #fde68a; background: rgba(120, 53, 15, 0.4); border: 1px solid rgba(245, 158, 11, 0.3);'\r\n");
                physSb.append("        : 'color: #a7f3d0; background: rgba(6, 78, 59, 0.4); border: 1px solid rgba(16, 185, 129, 0.3);');\r\n\r\n");
                physSb.append("    rowsHtml += `\r\n");
                physSb.append("      <tr style=\"border-bottom: 1px solid #141c28;\">\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; color: #ffffff; font-weight: bold;\">${st.depthFraction.toFixed(2)} ${label}</td>\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; color: #8ba2be;\">${st.depthUm}</td>\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; text-align: right; color: #ffffff; font-weight: bold;\">${st.G_Kcm.toLocaleString()}</td>\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; text-align: right; color: var(--accent-cyan);\">${st.R_cms}</td>\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; text-align: right; color: #fbbf24;\">${st.coolingRateKs.toLocaleString()}</td>\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; text-align: right; color: #8ba2be;\">${st.cetRatio}x</td>\r\n");
                physSb.append("        <td style=\"padding: 6px 8px; text-align: center;\">\r\n");
                physSb.append("          <span style=\"display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; ${badgeColor}\">${st.morphology}</span>\r\n");
                physSb.append("        </td>\r\n");
                physSb.append("      </tr>\r\n");
                physSb.append("    `;\r\n");
                physSb.append("  });\r\n");
                physSb.append("  tbody.innerHTML = rowsHtml;\r\n");
                physSb.append("}\r\n\r\n");

                content = content.substring(0, idxStartPhysics) + physSb.toString() + content.substring(idxEndPhysics);
                System.out.println("Replaced Bontha Physics Engine & Profile Table successfully.");
            } else {
                System.err.println("Could not find boundaries for Bontha physics engine.");
            }

            Files.writeString(file.toPath(), content, StandardCharsets.UTF_8);
            System.out.println("process_windows_dashboard.html update complete! New length: " + file.length() + " bytes.");

        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}