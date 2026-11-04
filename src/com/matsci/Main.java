package com.matsci;

import com.matsci.handler.ApiHandler;
import com.matsci.handler.StaticHandler;
import com.matsci.repository.CsvMaterialRepository;
import com.matsci.repository.MaterialRepository;
import com.matsci.service.MaterialService;
import com.matsci.service.ParameterInferenceService;
import com.matsci.service.UsageStatsService;
import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/**
 * Main application entry point.
 * Initializes the in-memory material index, synthesis parameter inference,
 * and launches the embedded high-performance HTTP server.
 */
public class Main {

    public static void main(String[] args) {
        try {
            int port = resolvePort();
            File baseDir = new File(".").getCanonicalFile();
            File dataFile = new File(baseDir, "data" + File.separator + "materials.csv");
            if (!dataFile.exists()) {
                dataFile = new File(baseDir, "data" + File.separator + "variant_properties_wide.csv");
            }
            File distDir = new File(baseDir, "dashboard" + File.separator + "dist");
            File webDir = distDir.exists() && distDir.isDirectory() ? distDir : new File(baseDir, "web");

            if (!dataFile.exists()) {
                System.err.println("Database file not found in data directory: " + dataFile.getAbsolutePath());
                System.exit(1);
            }

            System.out.println("==================================================================");
            System.out.println("  TITANIUM ADDITIVE MANUFACTURING & MATERIALS SCIENCE PLATFORM    ");
            System.out.println("==================================================================");
            System.out.println("Loading materials dataset from: " + dataFile.getName() + " ...");

            ParameterInferenceService parameterService = new ParameterInferenceService();
            MaterialRepository repository = new CsvMaterialRepository(dataFile, parameterService);
            MaterialService materialService = new MaterialService(repository);
            UsageStatsService usageStatsService = new UsageStatsService(
                new File(baseDir, "data" + File.separator + "usage-stats.properties").toPath()
            );

            System.out.printf("Loaded %d Titanium Alloys across %d Additive Manufacturing process variants.%n",
                repository.getTotalMaterialCount(), repository.getTotalVariantCount());

            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/api", new ApiHandler(materialService, usageStatsService));
            server.createContext("/", new StaticHandler(webDir));

            server.setExecutor(Executors.newFixedThreadPool(16));
            server.start();

            System.out.println("------------------------------------------------------------------");
            System.out.println(" Embedded Server running successfully with OWASP Defense Controls!");
            System.out.println(" Open your browser and navigate to:");
            System.out.printf("   >>> http://localhost:%d <<<%n", port);
            System.out.println(" REST API available at:");
            System.out.printf("   >>> http://localhost:%d/api/materials <<<%n", port);
            System.out.printf("   >>> http://localhost:%d/api/search?q=Ti-6Al-4V <<<%n", port);
            System.out.printf("   >>> http://localhost:%d/api/compare?ids=TIV-00001,TIV-00003 <<<%n", port);
            System.out.println(" Press Ctrl+C in terminal to stop.");
            System.out.println("==================================================================");

        } catch (Exception e) {
            System.err.println("Fatal startup error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static int resolvePort() {
        String envPort = System.getenv("PORT");
        if (envPort == null || envPort.isBlank()) {
            return 8080;
        }

        final int port;
        try {
            port = Integer.parseInt(envPort);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("PORT must be a number between 1 and 65535", e);
        }
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException("PORT must be a number between 1 and 65535");
        }
        return port;
    }
}
