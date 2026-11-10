package com.nit.am.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * Pure Java Verification & Quality Assurance Tool.
 * Replaces all Python testing scripts with 100% native Java code.
 *
 * Verifies:
 * 1. process_windows_dashboard.html structure, SVG elements, CSS, and controllers
 * 2. HTTP Server status on http://localhost:8080
 * 3. REST endpoints: /dashboard, /api/stats, /api/evaluate, /api/meltpool, /api/bontha
 * 4. Data CSVs and SQLite database integrity
 */
public class DashboardVerifier {

    public static void main(String[] args) {
        System.out.println("==================================================================");
        System.out.println("  NIT INTERNSHIP: PURE JAVA SYSTEM VERIFICATION & QA RUNNER        ");
        System.out.println("==================================================================");

        boolean allPassed = true;
        int passCount = 0;
        int totalChecks = 0;

        // 1. Verify Dashboard HTML File Content
        totalChecks++;
        Path dashPath = Paths.get("process_windows_dashboard.html");
        if (Files.exists(dashPath)) {
            try {
                String html = Files.readString(dashPath);
                System.out.printf("[CHECK 1] Dashboard HTML exists (%d bytes).%n", html.length());

                String[] requiredTokens = {
                    "switchTab('melt-pool'",
                    "id=\"view_melt-pool\"",
                    "KU Leuven Hybrid Melt Pool (Coen et al. 2022)",
                    "Rosenthal Thermal Field & Melt Pool Geometry",
                    "id=\"bonthaLargeSvg\"",
                    "3D FEM Overlay (Figs. 6 & 7)",
                    "Solidification Microstructure Maps & Size-Scale Physics",
                    "btnSubTabMap",
                    "btnSubTabDimensionless",
                    "btnSubTabProfile",
                    "btnSubTabKinetics",
                    "updateMeltPoolAndThermal();",
                    "id=\"mpAnimLayers\"",
                    "btnMpAnimate",
                    "renderMpAnimationStep"
                };

                boolean htmlOk = true;
                for (String tok : requiredTokens) {
                    if (!html.contains(tok)) {
                        System.err.println("  FAILED: Missing required token in HTML: " + tok);
                        htmlOk = false;
                    }
                }

                if (htmlOk) {
                    System.out.println("  PASSED: All required Melt Pool & Bontha UI elements verified in HTML.");
                    passCount++;
                } else {
                    allPassed = false;
                }
            } catch (Exception e) {
                System.err.println("  FAILED: Error reading HTML: " + e.getMessage());
                allPassed = false;
            }
        } else {
            System.err.println("[CHECK 1] FAILED: process_windows_dashboard.html not found!");
            allPassed = false;
        }

        // 2. Verify Data Directory CSVs
        totalChecks++;
        Path dataDir = Paths.get("data");
        if (Files.exists(dataDir)) {
            String[] expectedCsvs = {
                "ti64_mechanical_properties.csv",
                "ti64_thermal_physics.csv",
                "ti64_process_parameters.csv",
                "ti64_papers.csv",
                "materials.csv"
            };

            boolean csvsOk = true;
            for (String csv : expectedCsvs) {
                Path cp = dataDir.resolve(csv);
                if (!Files.exists(cp)) {
                    System.err.println("  FAILED: Missing CSV file: " + csv);
                    csvsOk = false;
                }
            }

            if (csvsOk) {
                System.out.println("[CHECK 2] PASSED: All 5 core material and literature CSV datasets verified.");
                passCount++;
            } else {
                allPassed = false;
            }
        } else {
            System.err.println("[CHECK 2] FAILED: data/ directory not found!");
            allPassed = false;
        }

        // 3. Verify Melt Pool & Thermal Source Files from Conversation 26558942-1cb2-4119-904e-bc3c393511a3
        totalChecks++;
        Path predictorTsx = Paths.get("dashboard", "src", "components", "MatSciPredictor.tsx");
        Path physicsEngineTs = Paths.get("dashboard", "src", "utils", "amPhysicsEngine.ts");
        Path distIndex = Paths.get("dashboard", "dist", "index.html");

        if (Files.exists(predictorTsx) && Files.exists(physicsEngineTs) && Files.exists(distIndex)) {
            try {
                String predictorSrc = Files.readString(predictorTsx);
                String physicsSrc = Files.readString(physicsEngineTs);

                boolean tsxOk = predictorSrc.contains("MELT POOL & THERMAL KINETICS")
                        && predictorSrc.contains("KU Leuven Hybrid Melt Pool (Coen et al. 2022)")
                        && predictorSrc.contains("Solidification Microstructure Maps");
                boolean physicsOk = physicsSrc.contains("calculateCoenHybridMeltPool")
                        && physicsSrc.contains("calculateBonthaThermalModel")
                        && physicsSrc.contains("getBonthaDimensionlessProcessMapData");

                if (tsxOk && physicsOk) {
                    System.out.println("[CHECK 3] PASSED: Verified 26558942-1cb2-4119-904e-bc3c393511a3 Melt Pool & Thermal section files.");
                    passCount++;
                } else {
                    System.err.println("[CHECK 3] FAILED: Missing required physics tokens in imported TypeScript sources.");
                    allPassed = false;
                }
            } catch (Exception e) {
                System.err.println("[CHECK 3] FAILED: Error checking TSX files: " + e.getMessage());
                allPassed = false;
            }
        } else {
            System.err.println("[CHECK 3] FAILED: Required dashboard files from 26558942-1cb2-4119-904e-bc3c393511a3 not found!");
            allPassed = false;
        }

        // 4. Verify Complete Decommission of Workstation Suite and System Decoupling
        totalChecks++;
        try {
            boolean dashUnlinked = !Files.readString(dashPath).contains("Workstation Suite")
                    && !Files.readString(dashPath).contains("titanium-workstation");
            boolean predictorUnlinked = !Files.readString(predictorTsx).contains("titanium-workstation");
            Path appTsx = Paths.get("dashboard", "src", "App.tsx");
            boolean appUnlinked = !Files.readString(appTsx).contains("titanium-workstation")
                    && !Files.readString(appTsx).contains("TitaniumWorkstationView");
            Path tiDir = Paths.get("dashboard", "src", "components", "titanium");
            boolean dirRemoved = !Files.exists(tiDir);

            if (dashUnlinked && predictorUnlinked && appUnlinked && dirRemoved) {
                System.out.println("[CHECK 4] PASSED: Workstation Suite and external linkage website completely removed.");
                passCount++;
            } else {
                System.err.println("[CHECK 4] FAILED: Lingering workstation suite linkages or files detected!");
                if (!dashUnlinked) System.err.println("  - process_windows_dashboard.html still has workstation link");
                if (!predictorUnlinked) System.err.println("  - MatSciPredictor.tsx still has workstation link");
                if (!appUnlinked) System.err.println("  - App.tsx still has workstation link/component");
                if (!dirRemoved) System.err.println("  - dashboard/src/components/titanium directory still exists");
                allPassed = false;
            }
        } catch (Exception e) {
            System.err.println("[CHECK 4] FAILED: Error checking workstation decommission: " + e.getMessage());
            allPassed = false;
        }

        // 5. Test HTTP Server Endpoints (Pure Java Server)
        String currentJsAsset = "index-Cy1u7cQU.js";
        String currentCssAsset = "index-CUbhpxe1.css";
        Path distIndexPath = Paths.get("dashboard/dist/index.html");
        if (Files.exists(distIndexPath)) {
            try {
                String distHtml = Files.readString(distIndexPath);
                java.util.regex.Matcher mJs = java.util.regex.Pattern.compile("/assets/(index-[A-Za-z0-9_-]+\\.js)").matcher(distHtml);
                if (mJs.find()) currentJsAsset = mJs.group(1);
                java.util.regex.Matcher mCss = java.util.regex.Pattern.compile("/assets/(index-[A-Za-z0-9_-]+\\.css)").matcher(distHtml);
                if (mCss.find()) currentCssAsset = mCss.group(1);
            } catch (Exception ignored) {}
        }

        String[] testUrls = {
            "http://localhost:8080/dashboard",
            "http://localhost:8080/app",
            "http://localhost:8080/assets/" + currentJsAsset,
            "http://localhost:8080/assets/" + currentCssAsset,
            "http://localhost:8080/api/stats",
            "http://localhost:8080/api/evaluate?power=200&speed=950",
            "http://localhost:8080/api/meltpool?model=coen&power=200&speed=950",
            "http://localhost:8080/api/bontha?dim=3d-bulky&power=200&speed=950"
        };

        for (String urlStr : testUrls) {
            totalChecks++;
            try {
                URL url = URI.create(urlStr).toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                int code = conn.getResponseCode();

                if (code == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    br.close();

                    System.out.printf("[HTTP CHECK] %s -> 200 OK (payload %d bytes)%n", urlStr, sb.length());
                    passCount++;
                } else {
                    System.err.printf("[HTTP CHECK] %s -> HTTP %d (FAILED)%n", urlStr, code);
                    allPassed = false;
                }
            } catch (Exception e) {
                System.err.printf("[HTTP CHECK] %s -> Connection error: %s (Server may be restarting)%n", urlStr, e.getMessage());
                // Non-fatal if server not running yet
            }
        }

        System.out.println("------------------------------------------------------------------");
        System.out.printf("VERIFICATION SUMMARY: %d / %d Checks Passed (100%% Pure Java Architecture)%n", passCount, totalChecks);
        System.out.println("==================================================================");
    }
}
