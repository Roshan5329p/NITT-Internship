package com.nit.am;

import com.matsci.model.Material;
import com.matsci.model.MaterialVariant;
import com.matsci.model.ProcessRecipe;
import com.matsci.repository.CsvMaterialRepository;
import com.matsci.service.MaterialService;
import com.matsci.service.ParameterInferenceService;
import com.matsci.util.JsonUtil;
import com.nit.am.literature.ScopusPaperFetcher;
import com.nit.am.literature.ScopusPaperFetcher.ScopusPaper;
import com.nit.am.model.AmRecord;
import com.nit.am.physics.BonthaSolidificationModel;
import com.nit.am.physics.MeltPoolPhysicsEngine;
import com.nit.am.physics.ThermalPhysicsEngine;
import com.nit.am.prediction.PropertyPredictor;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * Unified Pure Java Additive Manufacturing & Metallurgy Intelligence Platform.
 * Integrates:
 * 1. 54 Research Papers Literature Database (LPBF, DED, WAAM, Binder Jetting)
 * 2. Complete Materials Science 42-Metric Registry (276 Titanium alloy variants)
 * 3. ParameterInferenceService (Automated operational recipe synthesis across all AM routes)
 * 4. ThermalPhysicsEngine (Rosenthal melt pool & defect boundary modeling)
 * 5. PropertyPredictor (Hall-Petch, Murakami fatigue & ASTM F2924 / F3001 qualification)
 * 6. ProcessWindowPlotter (Java2D high-resolution scientific visualization)
 * 7. Embedded Native Web Server & REST API.
 *
 * Zero external runtime dependencies. Runs natively on JDK 21+.
 */
public class AmPlatformApplication {

    private static final int DEFAULT_PORT = 8080;
    private final List<AmRecord> paperDatabase = new ArrayList<>();
    private final String workspaceDir;
    private final int port;

    // Integrated Material Science services
    private CsvMaterialRepository materialRepo;
    private MaterialService materialService;
    private ParameterInferenceService inferenceService;

    public AmPlatformApplication(String workspaceDir) {
        this.workspaceDir = workspaceDir;
        this.port = resolvePort();
    }

    public void init() throws IOException {
        System.out.println("==================================================================");
        System.out.println("  NIT INTERNSHIP: UNIFIED Ti-6Al-4V ADDITIVE MANUFACTURING ENGINE ");
        System.out.println("    [INTEGRATED LITERATURE DATABASE + ADVANCED METALLURGY LOGIC]  ");
        System.out.println("==================================================================");

        String dataDir = Paths.get(workspaceDir, "data").toString();

        // 1. Load Literature Database (54 Research Papers)
        loadPaperCsvData(dataDir);
        System.out.printf(">> [Literature Engine] Loaded %d Research Papers into Java memory.%n", paperDatabase.size());

        // 2. Load Materials Informatics Repository (276 Alloy Variants)
        Path matCsv = Paths.get(dataDir, "materials.csv");
        if (Files.exists(matCsv)) {
            try {
                this.inferenceService = new ParameterInferenceService();
                this.materialRepo = new CsvMaterialRepository(matCsv.toFile(), inferenceService);
                this.materialService = new MaterialService(materialRepo);
                System.out.printf(">> [Materials Engine] Loaded %d Titanium Alloys (%d Variants) with 42 Metrics each.%n",
                        materialRepo.getTotalMaterialCount(), materialRepo.getTotalVariantCount());
            } catch (Exception e) {
                System.err.println(">> Warning: could not load materials.csv: " + e.getMessage());
            }
        }

        // 3. Run Physics & Property Analysis on 54 papers
        int astmCompliantCount = 0;
        double totalYs = 0;
        double totalElong = 0;

        for (AmRecord rec : paperDatabase) {
            ThermalPhysicsEngine.enrich(rec);
            rec.astmF2924Compliant = PropertyPredictor.checkAstmF2924(rec);
            if (rec.astmF2924Compliant) {
                astmCompliantCount++;
            }
            totalYs += rec.yieldStrengthMpa;
            totalElong += rec.elongationPct;
        }

        if (!paperDatabase.isEmpty()) {
            System.out.printf(">> [Physics Engine] Average Yield Strength: %.1f MPa | Average Elongation: %.1f%%%n",
                    totalYs / paperDatabase.size(), totalElong / paperDatabase.size());
            System.out.printf(">> [Standards Engine] ASTM F2924 Compliant Entries: %d / %d (%.1f%%)%n",
                    astmCompliantCount, paperDatabase.size(), (astmCompliantCount * 100.0) / paperDatabase.size());
        } else {
            System.out.println(">> [Physics Engine] No literature CSV entries loaded.");
        }

        // 4. Generate Java2D High-Resolution Visualizations
        System.out.println(">> [Plotter Engine] Generating Java2D scientific plots & interactive dashboard...");
        ProcessWindowPlotter plotter = new ProcessWindowPlotter();
        plotter.loadData(dataDir);

        String plotsDir = Paths.get(workspaceDir, "plots").toString();
        Files.createDirectories(Paths.get(plotsDir));

        plotter.plotLpbfProcessWindow(Paths.get(plotsDir, "ti64_lpbf_defect_processing_window.png").toString());
        plotter.plotDedProcessWindow(Paths.get(plotsDir, "ti64_ded_waam_process_window.png").toString());
        plotter.plotAshbyQualificationMap(Paths.get(plotsDir, "ti64_astm_qualification_ashby_map.png").toString());
        plotter.plotEnergyDensityTradeoff(Paths.get(plotsDir, "ti64_energy_density_density_tradeoff.png").toString());
        Path dashPath = Paths.get(workspaceDir, "process_windows_dashboard.html");
        if (!Files.exists(dashPath)) {
            plotter.generateHtmlDashboard(dashPath.toString());
        }

        System.out.println(">> All Java2D maps and interactive HTML dashboard generated successfully.");
    }

    private void loadPaperCsvData(String dataDir) throws IOException {
        Path papersPath = Paths.get(dataDir, "ti64_papers.csv");
        Path procPath = Paths.get(dataDir, "ti64_process_parameters.csv");
        Path thermPath = Paths.get(dataDir, "ti64_thermal_physics.csv");
        Path mechPath = Paths.get(dataDir, "ti64_mechanical_properties.csv");

        Map<Integer, AmRecord> map = new LinkedHashMap<>();

        // Papers
        List<String> lines = Files.readAllLines(papersPath, StandardCharsets.UTF_8);
        for (int i = 1; i < lines.size(); i++) {
            String raw = lines.get(i).trim();
            if (raw.isEmpty()) continue;
            String[] tok = parseCsvLine(raw);
            if (tok.length >= 5) {
                int pid = parsePositiveI(tok[0].trim(), -1);
                if (pid <= 0) continue;
                AmRecord rec = new AmRecord();
                rec.paperNumber = pid;
                rec.title = tok[1];
                rec.authors = tok[2];
                rec.year = (int) parseD(tok[3]);
                rec.amProcess = tok[4];
                map.putIfAbsent(pid, rec);
            }
        }

        // Process
        lines = Files.readAllLines(procPath, StandardCharsets.UTF_8);
        for (int i = 1; i < lines.size(); i++) {
            String[] tok = parseCsvLine(lines.get(i));
            if (tok.length >= 7) {
                int pid = (int) parseD(tok[1]);
                AmRecord rec = map.get(pid);
                if (rec != null) {
                    rec.laserPowerW = parseD(tok[2]);
                    rec.scanSpeedMms = parseD(tok[3]);
                    rec.layerThicknessUm = parseD(tok[4]);
                    rec.hatchSpacingUm = parseD(tok[5]);
                    rec.energyDensityJmm3 = parseD(tok[6]);
                }
            }
        }

        // Thermal
        lines = Files.readAllLines(thermPath, StandardCharsets.UTF_8);
        for (int i = 1; i < lines.size(); i++) {
            String[] tok = parseCsvLine(lines.get(i));
            if (tok.length >= 11) {
                int pid = (int) parseD(tok[1]);
                AmRecord rec = map.get(pid);
                if (rec != null) {
                    rec.meltPoolWidthUm = parseD(tok[2]);
                    rec.meltPoolDepthUm = parseD(tok[3]);
                    rec.coolingRateKs = parseD(tok[5]);
                    rec.residualStressMpa = parseD(tok[8]);
                    rec.defectRegime = tok[10].isEmpty() ? "Conduction" : tok[10];
                }
            }
        }

        // Mech
        lines = Files.readAllLines(mechPath, StandardCharsets.UTF_8);
        for (int i = 1; i < lines.size(); i++) {
            String[] tok = parseCsvLine(lines.get(i));
            if (tok.length >= 12) {
                int pid = (int) parseD(tok[1]);
                AmRecord rec = map.get(pid);
                if (rec != null) {
                    rec.condition = tok[3];
                    rec.yieldStrengthMpa = parseD(tok[4]);
                    rec.utsMpa = parseD(tok[5]);
                    rec.elongationPct = parseD(tok[6]);
                    rec.vickersHv = parseD(tok[7]);
                    rec.fatigueLimitMpa = parseD(tok[10]);
                }
            }
        }

        paperDatabase.addAll(map.values());
    }

    private double parseD(String s) {
        if (s == null || s.trim().isEmpty()) return 0.0;
        try {
            return Double.parseDouble(s.trim());
        } catch (Exception e) {
            return 0.0;
        }
    }

    private String[] parseCsvLine(String line) {
        List<String> list = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuote = false;
        for (char c : line.toCharArray()) {
            if (c == '\"') inQuote = !inQuote;
            else if (c == ',' && !inQuote) {
                list.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        list.add(sb.toString().trim());
        return list.toArray(new String[0]);
    }

    public void startServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newCachedThreadPool());

        // 1. Dashboard & Static Assets Handler
        server.createContext("/", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    String path = exchange.getRequestURI().getPath();
                    if (path == null) path = "/";

                    // Main Website: Standalone interactive process windows dashboard
                    if (path.equals("/") || path.equals("/dashboard") || path.equals("/dashboard/") || path.equals("/dashboard.html")) {
                        Path htmlFile = Paths.get(workspaceDir, "process_windows_dashboard.html");
                        if (Files.exists(htmlFile)) {
                            serveFile(exchange, htmlFile, "text/html; charset=UTF-8");
                            return;
                        }
                    }

                    // Serve static plots generated by Java2D engine
                    if (path.startsWith("/plots/")) {
                        String filename = path.substring("/plots/".length());
                        Path file = resolveStaticFile(Paths.get(workspaceDir, "plots"), filename);
                        if (file != null && Files.isRegularFile(file)) {
                            serveFileWithContentType(exchange, file);
                            return;
                        }
                    }

                    addCommonHeaders(exchange);
                    byte[] notFoundBytes = "404 Not Found".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=UTF-8");
                    exchange.sendResponseHeaders(404, notFoundBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(notFoundBytes);
                    }
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        // 2. API /api/stats (Literature + Materials Registry Stats)
        server.createContext("/api/stats", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    int astmCount = 0;
                    for (AmRecord r : paperDatabase) if (r.astmF2924Compliant) astmCount++;

                    int matCount = (materialRepo != null) ? materialRepo.getTotalMaterialCount() : 0;
                    int varCount = (materialRepo != null) ? materialRepo.getTotalVariantCount() : 0;

                    String json = String.format(Locale.US,
                            "{\"literature_papers\": %d, \"astm_compliant_papers\": %d, \"registered_titanium_alloys\": %d, \"registered_variants\": %d, \"material_baseline\": \"Ti-6Al-4V (Grade 5 & ELI)\", \"status\": \"ACTIVE_HEALTHY\"}",
                            paperDatabase.size(), astmCount, matCount, varCount);

                    sendJsonResponse(exchange, 200, json);
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        // 3. API /api/evaluate?process=lpbf&power=250&speed=1000&layer=30&hatch=100&spot=80&preheat=200&condition=HIP
        server.createContext("/api/evaluate", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    Map<String, String> params = parseQueryParams(exchange.getRequestURI().getRawQuery());
                    double p = 250.0, v = 1000.0, l = 30.0, h = 100.0, spot = 80.0, preheat = 200.0, abs = -1.0;
                    boolean hasSpot = params.containsKey("spot");
                    boolean hasLayer = params.containsKey("layer");
                    boolean hasHatch = params.containsKey("hatch");
                    String condition = params.getOrDefault("condition", "HIP");
                    String process = params.get("process");
                    if (params.containsKey("power")) p = parsePositiveD(params.get("power"), p);
                    if (params.containsKey("speed")) v = parsePositiveD(params.get("speed"), v);
                    if (hasLayer) l = parsePositiveD(params.get("layer"), l);
                    if (hasHatch) h = parsePositiveD(params.get("hatch"), h);
                    if (hasSpot) spot = parsePositiveD(params.get("spot"), spot);
                    if (params.containsKey("preheat")) preheat = parseFiniteD(params.get("preheat"), preheat);
                    if (params.containsKey("absorptivity")) abs = parsePositiveD(params.get("absorptivity"), abs);

                    if (process == null || process.isBlank()) {
                        process = (v < 100.0 && spot >= 400.0) ? ((spot >= 2200.0 || p >= 2400.0) ? "waam" : "ded-laser") : "lpbf";
                    }
                    String normProc = ThermalPhysicsEngine.normalizeProcess(process);
                    if (!hasSpot) {
                        spot = normProc.equals("waam") ? 3000.0 : (normProc.equals("ded-laser") ? 1500.0 : 80.0);
                    }
                    if (!hasLayer) {
                        l = normProc.equals("waam") ? 1500.0 : (normProc.equals("ded-laser") ? 450.0 : l);
                    }
                    if (!hasHatch) {
                        h = normProc.equals("waam") ? 3500.0 : (normProc.equals("ded-laser") ? 1200.0 : h);
                    }

                    ThermalPhysicsEngine.PhysicsResult phys = ThermalPhysicsEngine.evaluateForProcess(normProc, p, v, l, h, spot, preheat, abs);
                    double poreSqrt = phys.isSafeWindow ? 15.0 : 35.0;
                    PropertyPredictor.PredictionOutput pred = PropertyPredictor.predictForProcess(normProc, phys.cellSpacingLambdaUm, condition, poreSqrt);

                    String json = String.format(Locale.US,
                            "{\"process\": %s, \"power_w\": %.1f, \"speed_mms\": %.1f, \"energy_density_j_mm3\": %.2f, \"linear_heat_input_j_mm\": %.2f, \"peclet_number\": %.2f, \"normalized_enthalpy\": %.2f, \"defect_regime\": %s, \"safe_window\": %b, \"relative_density_pct\": %.2f, \"melt_pool_width_um\": %.1f, \"melt_pool_depth_um\": %.1f, \"melt_pool_length_um\": %.1f, \"aspect_ratio\": %.2f, \"cooling_rate_k_s\": %.2e, \"thermal_gradient_g\": %.2e, \"solidification_rate_r\": %.3f, \"grain_morphology\": %s, \"cell_spacing_um\": %.2f, \"hardness_hv\": %.0f, \"rockwell_hrc\": %.0f, \"predicted_ys_mpa\": %.1f, \"predicted_uts_mpa\": %.1f, \"predicted_elongation_pct\": %.1f, \"fatigue_limit_mpa\": %.0f, \"astm_compliant\": %b, \"verdict\": %s}",
                            JsonUtil.escape(normProc), p, v, phys.volumetricEnergyDensity, phys.linearHeatInputJmm, phys.pecletNumber, phys.normalizedEnthalpy, JsonUtil.escape(phys.defectRegime), phys.isSafeWindow, phys.relativeDensityPct,
                            phys.estimatedMeltPoolWidthUm, phys.estimatedMeltPoolDepthUm, phys.estimatedMeltPoolLengthUm, phys.aspectRatio,
                            phys.estimatedCoolingRateKs, phys.thermalGradientG, phys.solidificationRateR, JsonUtil.escape(phys.grainMorphology), phys.cellSpacingLambdaUm,
                            pred.vickersHardnessHv, pred.rockwellHrc, pred.predictedYieldStrengthMpa, pred.predictedUtsMpa, pred.predictedElongationPct, pred.predictedFatigueLimitMpa,
                            pred.passesAstmF2924, JsonUtil.escape(pred.qualificationVerdict));

                    sendJsonResponse(exchange, 200, json);
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        // 4. API /api/materials (Integrated Material Science Registry)
        server.createContext("/api/materials", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    if (materialService == null) {
                        sendErrorJson(exchange, 503, "Materials service not initialized");
                        return;
                    }
                    List<Map<String, Object>> list = materialService.listAllMaterials();
                    String json = JsonUtil.toJson(list);
                    sendJsonResponse(exchange, 200, json);
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        // 5. API /api/recipe?variant=TIV-00001 (Infers full process recipe from ParameterInferenceService)
        server.createContext("/api/recipe", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    if (materialRepo == null || inferenceService == null) {
                        sendErrorJson(exchange, 503, "Materials service not initialized");
                        return;
                    }
                    Map<String, String> params = parseQueryParams(exchange.getRequestURI().getRawQuery());
                    String rawVariant = params.getOrDefault("variant", "TIV-00001");
                    String varId = rawVariant.isBlank() ? "TIV-00001" : rawVariant.trim();

                    Optional<MaterialVariant> opt = materialRepo.findVariantById(varId);
                    if (opt.isEmpty()) {
                        sendJsonResponse(exchange, 404, JsonUtil.toJson(Map.of("error", "Variant not found: " + varId)));
                        return;
                    }

                    ProcessRecipe recipe = inferenceService.inferRecipe(opt.get());
                    String json = JsonUtil.toJson(recipe.toMap());
                    sendJsonResponse(exchange, 200, json);
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        // 6. API /api/meltpool?model=coen&process=lpbf&power=200&speed=950&spot=80&layer=40&hatch=80
        server.createContext("/api/meltpool", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    Map<String, String> params = parseQueryParams(exchange.getRequestURI().getRawQuery());
                    String model = params.getOrDefault("model", "coen");
                    String process = params.get("process");
                    if (process != null && process.isBlank()) process = null;
                    double p = 200.0, v = 950.0, spot = 80.0, layer = 40.0, hatch = 80.0;
                    boolean hasSpot = params.containsKey("spot");
                    boolean hasLayer = params.containsKey("layer");
                    boolean hasHatch = params.containsKey("hatch");
                    if (params.containsKey("power")) p = parsePositiveD(params.get("power"), p);
                    if (params.containsKey("speed")) v = parsePositiveD(params.get("speed"), v);
                    if (hasSpot) spot = parsePositiveD(params.get("spot"), spot);
                    if (hasLayer) layer = parsePositiveD(params.get("layer"), layer);
                    if (hasHatch) hatch = parsePositiveD(params.get("hatch"), hatch);

                    if (process != null) {
                        String np = ThermalPhysicsEngine.normalizeProcess(process);
                        if (!hasSpot) spot = np.equals("waam") ? 3000.0 : (np.equals("ded-laser") ? 1500.0 : spot);
                        if (!hasLayer) layer = np.equals("waam") ? 1500.0 : (np.equals("ded-laser") ? 450.0 : layer);
                        if (!hasHatch) hatch = np.equals("waam") ? 3500.0 : (np.equals("ded-laser") ? 1200.0 : hatch);
                    }
                    MeltPoolPhysicsEngine.MeltPoolResult res = (process != null)
                            ? MeltPoolPhysicsEngine.calculate(model, p, v, spot, layer, hatch, process)
                            : MeltPoolPhysicsEngine.calculate(model, p, v, spot, layer, hatch);
                    sendJsonResponse(exchange, 200, res.json);
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        // 7. API /api/bontha?dim=3d-bulky&physics=rosenthal&source=laser&power=200&speed=950
        server.createContext("/api/bontha", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    Map<String, String> params = parseQueryParams(exchange.getRequestURI().getRawQuery());
                    String dim = params.getOrDefault("dim", "3d-bulky");
                    String physics = params.getOrDefault("physics", "rosenthal");
                    String source = params.getOrDefault("source", "laser");
                    double p = params.containsKey("power") ? parsePositiveD(params.get("power"), 200.0) : 200.0;
                    double v = params.containsKey("speed") ? parsePositiveD(params.get("speed"), 950.0) : 950.0;
                    BonthaSolidificationModel.BonthaResult res = BonthaSolidificationModel.evaluate(dim, physics, source, p, v);
                    sendJsonResponse(exchange, 200, res.json);
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        server.createContext("/api/scopus", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                try {
                    if (handlePreflight(exchange)) return;
                    Map<String, String> params = parseQueryParams(exchange.getRequestURI().getRawQuery());
                    String searchQuery = "TITLE-ABS-KEY(\"Ti-6Al-4V\" AND (\"selective laser melting\" OR \"LPBF\" OR \"additive manufacturing\") AND (\"solidification\" OR \"melt pool\"))";
                    int count = 10;
                    String sort = "citedby-count";

                    if (params.containsKey("query") && !params.get("query").isBlank()) {
                        String q = params.get("query").trim();
                        searchQuery = q.length() > 500 ? q.substring(0, 500) : q;
                    }
                    if (params.containsKey("count")) {
                        count = Math.max(1, Math.min(parsePositiveI(params.get("count"), count), 25));
                    }
                    if (params.containsKey("sort")) {
                        String rawSort = params.get("sort").trim();
                        if (Set.of("citedby-count", "relevancy", "relevance", "coverDate", "-coverDate", "pubyear", "-pubyear", "title").contains(rawSort)) {
                            sort = rawSort;
                        }
                    }

                    String apiKey = ScopusPaperFetcher.getApiKey();
                    if (apiKey == null || apiKey.isEmpty()) {
                        sendJsonResponse(exchange, 503, "{\"status\":\"error\",\"message\":\"SCOPUS_API_KEY is not defined in .env or environment\"}");
                        return;
                    }

                    try {
                        List<ScopusPaper> papers = ScopusPaperFetcher.searchPapers(apiKey, searchQuery, count, sort);
                        String json = ScopusPaperFetcher.toJson(papers, searchQuery);
                        sendJsonResponse(exchange, 200, json);
                    } catch (Exception e) {
                        String msg = (e.getMessage() != null && !e.getMessage().isBlank()) ? e.getMessage() : e.getClass().getSimpleName();
                        sendJsonResponse(exchange, 502, "{\"status\":\"error\",\"message\":" + JsonUtil.escape(msg) + "}");
                    }
                } catch (Exception e) {
                    sendErrorJson(exchange, 500, e.getMessage());
                }
            }
        });

        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        System.out.println("==================================================================");
        System.out.printf(">> Pure Java AM Platform Server is LIVE on: http://localhost:%d%n", port);
        System.out.printf("   - Interactive Dashboard:  http://localhost:%d/dashboard%n", port);
        System.out.printf("   - Physics Evaluation API: http://localhost:%d/api/evaluate?power=250&speed=1100%n", port);
        System.out.printf("   - Melt Pool Physics API:  http://localhost:%d/api/meltpool?model=coen&power=200%n", port);
        System.out.printf("   - Bontha Solidification:  http://localhost:%d/api/bontha?dim=3d-bulky&power=200%n", port);
        System.out.printf("   - Materials Registry API: http://localhost:%d/api/materials%n", port);
        System.out.printf("   - Recipe Synthesis API:   http://localhost:%d/api/recipe?variant=TIV-00001%n", port);
        System.out.printf("   - Global Stats API:       http://localhost:%d/api/stats%n", port);
        System.out.println("==================================================================");
    }

    private static int resolvePort() {
        String envPort = System.getenv("PORT");
        int preferredPort = DEFAULT_PORT;

        if (envPort != null && !envPort.isBlank()) {
            try {
                preferredPort = Integer.parseInt(envPort);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("PORT must be a number between 1 and 65535", e);
            }
        }

        if (preferredPort < 1 || preferredPort > 65535) {
            throw new IllegalArgumentException("PORT must be a number between 1 and 65535");
        }

        for (int candidate = preferredPort; candidate <= 65535; candidate++) {
            try (ServerSocket probe = new ServerSocket()) {
                probe.setReuseAddress(true);
                probe.bind(new InetSocketAddress(candidate));
                return candidate;
            } catch (IOException ignored) {
                // Try the next port if the preferred one is already in use.
            }
        }

        throw new IllegalStateException("No free TCP port found between " + preferredPort + " and 65535.");
    }

    private double parseFiniteD(String value, double fallback) {
        try {
            double parsed = Double.parseDouble(value);
            return Double.isFinite(parsed) ? parsed : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private double parsePositiveD(String value, double fallback) {
        double parsed = parseFiniteD(value, fallback);
        return parsed > 0 ? parsed : fallback;
    }

    private int parsePositiveI(String value, int fallback) {
        try {
            int parsed = Integer.parseInt(value);
            return parsed > 0 ? parsed : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }

    private Path resolveStaticFile(Path root, String relativePath) {
        if (relativePath == null || relativePath.contains("..") || relativePath.contains("\\")) {
            return null;
        }
        String cleaned = relativePath.replaceFirst("^/+", "");
        Path normalizedRoot = root.toAbsolutePath().normalize();
        Path file = normalizedRoot.resolve(cleaned).normalize();
        if (!file.startsWith(normalizedRoot) || Files.isSymbolicLink(file)) {
            return null;
        }
        return file;
    }

    private static void addCommonHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("X-Frame-Options", "SAMEORIGIN");
        exchange.getResponseHeaders().set("Referrer-Policy", "strict-origin-when-cross-origin");
    }

    private static boolean handlePreflight(HttpExchange exchange) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            addCommonHeaders(exchange);
            exchange.sendResponseHeaders(204, -1);
            exchange.getResponseBody().close();
            return true;
        }
        return false;
    }

    private static Map<String, String> parseQueryParams(String query) {
        Map<String, String> params = new LinkedHashMap<>();
        if (query == null || query.isEmpty()) return params;
        for (String pair : query.split("&")) {
            if (pair.isEmpty()) continue;
            String[] kv = pair.split("=", 2);
            try {
                String k = URLDecoder.decode(kv[0], StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
                String v = (kv.length > 1) ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "";
                params.put(k, v);
            } catch (IllegalArgumentException ignored) {
                // Skip malformed percent-encoding instead of failing the whole request
            }
        }
        return params;
    }

    private static void sendErrorJson(HttpExchange exchange, int status, String message) throws IOException {
        String safe = (message != null && !message.isBlank()) ? message : "Internal server error";
        sendJsonResponseStatic(exchange, status, "{\"error\":" + JsonUtil.escape(safe) + "}");
    }

    private static void sendJsonResponseStatic(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        addCommonHeaders(exchange);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        if ("HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(status, -1);
            return;
        }
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void serveFile(HttpExchange exchange, Path file, String contentType) throws IOException {
        byte[] bytes = Files.readAllBytes(file);
        addCommonHeaders(exchange);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        if ("HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(200, -1);
            return;
        }
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void serveFileWithContentType(HttpExchange exchange, Path file) throws IOException {
        String name = file.getFileName().toString().toLowerCase(Locale.US);
        String contentType = "application/octet-stream";
        if (name.endsWith(".js")) contentType = "application/javascript; charset=UTF-8";
        else if (name.endsWith(".css")) contentType = "text/css; charset=UTF-8";
        else if (name.endsWith(".html")) contentType = "text/html; charset=UTF-8";
        else if (name.endsWith(".json")) contentType = "application/json; charset=UTF-8";
        else if (name.endsWith(".png")) contentType = "image/png";
        else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) contentType = "image/jpeg";
        else if (name.endsWith(".svg")) contentType = "image/svg+xml";
        else if (name.endsWith(".woff2")) contentType = "font/woff2";
        else if (name.endsWith(".woff")) contentType = "font/woff";
        serveFile(exchange, file, contentType);
    }

    private void sendJsonResponse(HttpExchange exchange, int status, String json) throws IOException {
        sendJsonResponseStatic(exchange, status, json);
    }

    public static void main(String[] args) {
        try {
            String workspace = System.getProperty("user.dir");
            AmPlatformApplication app = new AmPlatformApplication(workspace);
            app.init();

            boolean runServer = args.length > 0 && args[0].equalsIgnoreCase("--serve");
            if (runServer) {
                app.startServer();
                Thread.currentThread().join();
            } else {
                System.out.println(">> Batch evaluation complete. Run with '--serve' to start the interactive web server.");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
