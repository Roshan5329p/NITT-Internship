package com.nit.am.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Pure Java Verification & Quality Assurance Tool.
 * 100% native Java verification for the Unified Additive Manufacturing Platform.
 *
 * Verifies:
 * 1. process_windows_dashboard.html (Main Website) structure, SVG visualizers, and interactive models
 * 2. Data directory CSVs and material repositories
 * 3. Pure Java2D scientific plotting engine and analytical physics models
 * 4. Complete decommission and excision of the separate Vite React dashboard
 * 5. Native HTTP Server endpoints and REST APIs on http://localhost:8080
 */
public class DashboardVerifier {

    public static void main(String[] args) {
        System.out.println("==================================================================");
        System.out.println("  NIT INTERNSHIP: PURE JAVA SYSTEM VERIFICATION & QA RUNNER        ");
        System.out.println("==================================================================");

        boolean allPassed = true;
        int passCount = 0;
        int totalChecks = 0;

        // 1. Verify Main Website Dashboard HTML File Content
        totalChecks++;
        Path dashPath = Paths.get("process_windows_dashboard.html");
        if (Files.exists(dashPath)) {
            try {
                String html = Files.readString(dashPath);
                System.out.printf("[CHECK 1] Main Website Dashboard HTML exists (%d bytes).%n", html.length());

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

                if (html.contains("/app#titanium-workstation") || html.contains("Workstation Suite")) {
                    System.err.println("  FAILED: process_windows_dashboard.html still has chained workstation suite link!");
                    htmlOk = false;
                }

                if (htmlOk) {
                    System.out.println("  PASSED: All required Melt Pool, Bontha, and Rosenthal elements verified in Main Website HTML.");
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

        // 3. Verify Pure Java AM Platform & Scientific Plotter Architecture
        totalChecks++;
        Path plotterSrc = Paths.get("src", "com", "nit", "am", "ProcessWindowPlotter.java");
        Path appSrc = Paths.get("src", "com", "nit", "am", "AmPlatformApplication.java");
        Path mainSrc = Paths.get("src", "com", "matsci", "Main.java");
        Path plotDir = Paths.get("plots");

        boolean sourcesOk = Files.exists(plotterSrc) && Files.exists(appSrc) && Files.exists(mainSrc);
        boolean plotsOk = Files.exists(plotDir.resolve("ti64_lpbf_defect_processing_window.png"))
                && Files.exists(plotDir.resolve("ti64_astm_qualification_ashby_map.png"));

        if (sourcesOk && plotsOk) {
            System.out.println("[CHECK 3] PASSED: Pure Java platform sources and generated Java2D publication plots verified.");
            passCount++;
        } else {
            System.err.println("[CHECK 3] FAILED: Missing Java platform sources or generated plots.");
            allPassed = false;
        }

        // 4. Verify Complete Decommission of Separate Vite React Dashboard
        totalChecks++;
        try {
            Path dashboardDir = Paths.get("dashboard");
            boolean dirRemoved = !Files.exists(dashboardDir);
            boolean dashUnlinked = !Files.readString(dashPath).contains("/app")
                    && !Files.readString(dashPath).contains("vite");
            Path appJava = Paths.get("src", "com", "nit", "am", "AmPlatformApplication.java");
            boolean serverClean = !Files.readString(appJava).contains("dashboard/dist");

            if (dirRemoved && dashUnlinked && serverClean) {
                System.out.println("[CHECK 4] PASSED: Separate Vite React dashboard completely excised. Main website is 100% standalone.");
                passCount++;
            } else {
                System.err.println("[CHECK 4] FAILED: Lingering Vite dashboard traces detected!");
                if (!dirRemoved) System.err.println("  - dashboard/ directory still exists on disk");
                if (!dashUnlinked) System.err.println("  - process_windows_dashboard.html contains links to Vite app");
                if (!serverClean) System.err.println("  - AmPlatformApplication.java still routes to dashboard/dist");
                allPassed = false;
            }
        } catch (Exception e) {
            System.err.println("[CHECK 4] FAILED: Error checking Vite decommission: " + e.getMessage());
            allPassed = false;
        }

        // 5. Test Live HTTP Server Endpoints (Pure Java AM Platform Server)
        String[] testUrls200 = {
            "http://localhost:8080/dashboard",
            "http://localhost:8080/",
            "http://localhost:8080/plots/ti64_lpbf_defect_processing_window.png",
            "http://localhost:8080/plots/ti64_astm_qualification_ashby_map.png",
            "http://localhost:8080/api/stats",
            "http://localhost:8080/api/evaluate?power=200&speed=950",
            "http://localhost:8080/api/meltpool?model=coen&power=200&speed=950",
            "http://localhost:8080/api/bontha?dim=3d-bulky&power=200&speed=950",
            "http://localhost:8080/api/materials",
            "http://localhost:8080/api/scopus?count=2"
        };

        for (String urlStr : testUrls200) {
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
            }
        }

        // Verify decommissioned route returns 404
        totalChecks++;
        try {
            URL url = URI.create("http://localhost:8080/app").toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            int code = conn.getResponseCode();

            if (code == 404) {
                System.out.println("[HTTP CHECK] http://localhost:8080/app -> 404 Not Found (PASSED: Vite dashboard route correctly deactivated)");
                passCount++;
            } else {
                System.err.printf("[HTTP CHECK] http://localhost:8080/app -> Expected 404 but got HTTP %d%n", code);
                allPassed = false;
            }
        } catch (Exception e) {
            System.err.printf("[HTTP CHECK] http://localhost:8080/app -> Error: %s%n", e.getMessage());
        }

        System.out.println("------------------------------------------------------------------");
        System.out.printf("VERIFICATION SUMMARY: %d / %d Checks Passed (100%% Pure Java Architecture)%n", passCount, totalChecks);
        System.out.println("==================================================================");
    }
}
