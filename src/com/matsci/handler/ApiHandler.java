package com.matsci.handler;

import com.matsci.security.SecurityHeaders;
import com.matsci.service.MaterialService;
import com.matsci.service.UsageStatsService;
import com.matsci.util.JsonUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Hardened REST JSON API handler with failsafe defensive controls.
 * Implements strict input sanitization, rate/query bounds checking,
 * OWASP security headers, and path traversal protection.
 */
public class ApiHandler implements HttpHandler {

    private static final Pattern SAFE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9\\-_]{1,64}$");
    private static final Pattern SAFE_CSV_IDS_PATTERN = Pattern.compile("^[A-Za-z0-9\\-_,]{1,512}$");
    private static final int MAX_QUERY_LENGTH = 128;
    private static final int MAX_COMPARE_ITEMS = 12;

    private final MaterialService service;
    private final UsageStatsService usageStatsService;

    public ApiHandler(MaterialService service, UsageStatsService usageStatsService) {
        this.service = service;
        this.usageStatsService = usageStatsService;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Enforce OWASP security headers on all responses
        SecurityHeaders.apply(exchange, true);

        URI uri = exchange.getRequestURI();
        String path = uri.getPath();
        String method = exchange.getRequestMethod();

        // Standard CORS support for web frontend
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

        if ("OPTIONS".equalsIgnoreCase(method)) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        if ("POST".equalsIgnoreCase(method)) {
            try {
                if (path.equals("/api/stats/visit")) {
                    sendJson(exchange, 200, usageStatsService.recordVisit());
                } else if (path.equals("/api/stats/prediction")) {
                    sendJson(exchange, 200, usageStatsService.recordPrediction());
                } else {
                    sendJson(exchange, 405, Map.of("error", "Method Not Allowed", "allowed", List.of("GET", "POST", "OPTIONS")));
                }
            } catch (Exception e) {
                System.err.println("[ApiHandler ERROR] " + e.getMessage());
                sendJson(exchange, 500, Map.of(
                    "error", "Internal Server Error",
                    "message", "Usage statistics could not be saved."
                ));
            }
            return;
        }

        if (!"GET".equalsIgnoreCase(method)) {
            sendJson(exchange, 405, Map.of("error", "Method Not Allowed", "allowed", List.of("GET", "POST", "OPTIONS")));
            return;
        }

        Map<String, String> queryParams = parseQueryParams(uri.getRawQuery());

        try {
            if (path.equals("/api/metadata") || path.equals("/api/metadata/")) {
                sendJson(exchange, 200, service.getMetadata());

            } else if (path.equals("/api/stats") || path.equals("/api/stats/")) {
                sendJson(exchange, 200, usageStatsService.getStats());

            } else if (path.equals("/api/classes") || path.equals("/api/classes/") || path.equals("/api/materials/classes") || path.equals("/api/materials/classes/") || path.equals("/api/processes") || path.equals("/api/processes/")) {
                sendJson(exchange, 200, service.getMetadata().get("classes"));

            } else if (path.equals("/api/search") || path.equals("/api/search/")) {
                String q = sanitizeInput(queryParams.getOrDefault("q", ""));
                String mClass = sanitizeInput(queryParams.getOrDefault("class", ""));
                String sub = sanitizeInput(queryParams.getOrDefault("subclass", ""));
                sendJson(exchange, 200, service.search(q, mClass, sub));

            } else if (path.equals("/api/materials") || path.equals("/api/materials/")) {
                sendJson(exchange, 200, service.listAllMaterials());

            } else if (path.startsWith("/api/materials/")) {
                String rawId = path.substring("/api/materials/".length()).trim();
                if (!SAFE_ID_PATTERN.matcher(rawId).matches()) {
                    sendJson(exchange, 400, Map.of("error", "Invalid Material ID format. Must be alphanumeric (max 64 chars)."));
                    return;
                }
                Optional<Map<String, Object>> mat = service.getMaterial(rawId);
                if (mat.isPresent()) {
                    sendJson(exchange, 200, mat.get());
                } else {
                    sendJson(exchange, 404, Map.of("error", "Material not found: " + rawId));
                }

            } else if (path.startsWith("/api/variants/")) {
                String rawId = path.substring("/api/variants/".length()).trim();
                if (!SAFE_ID_PATTERN.matcher(rawId).matches()) {
                    sendJson(exchange, 400, Map.of("error", "Invalid Variant ID format. Must be alphanumeric (max 64 chars)."));
                    return;
                }
                Optional<Map<String, Object>> var = service.getVariant(rawId);
                if (var.isPresent()) {
                    sendJson(exchange, 200, var.get());
                } else {
                    sendJson(exchange, 404, Map.of("error", "Variant not found: " + rawId));
                }

            } else if (path.equals("/api/compare") || path.equals("/api/compare/")) {
                String idsParam = queryParams.getOrDefault("ids", "").trim();
                if (idsParam.isEmpty()) {
                    sendJson(exchange, 400, Map.of("error", "Missing 'ids' query parameter (e.g. ids=TIV-00001,TIV-00002)"));
                    return;
                }
                if (!SAFE_CSV_IDS_PATTERN.matcher(idsParam).matches()) {
                    sendJson(exchange, 400, Map.of("error", "Invalid characters in 'ids' parameter. Only alphanumeric, dashes, and commas allowed."));
                    return;
                }
                String[] split = idsParam.split(",");
                List<String> validIds = new ArrayList<>();
                for (String s : split) {
                    String clean = s.trim();
                    if (!clean.isEmpty()) {
                        validIds.add(clean);
                    }
                    if (validIds.size() >= MAX_COMPARE_ITEMS) break;
                }
                sendJson(exchange, 200, service.compareVariants(validIds));

            } else {
                sendJson(exchange, 404, Map.of("error", "API endpoint not found: " + path));
            }

        } catch (Exception e) {
            System.err.println("[ApiHandler ERROR] " + e.getMessage());
            sendJson(exchange, 500, Map.of(
                "error", "Internal Server Error",
                "message", "An unexpected condition was encountered processing the request."
            ));
        }
    }

    private String sanitizeInput(String input) {
        if (input == null) return "";
        String trimmed = input.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            trimmed = trimmed.substring(0, MAX_QUERY_LENGTH);
        }
        // Remove dangerous control characters or null bytes
        return trimmed.replaceAll("[\\x00-\\x1F\\x7F]", "");
    }

    private void sendJson(HttpExchange exchange, int statusCode, Object body) throws IOException {
        String json = JsonUtil.toJson(body);
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");

        String acceptEncoding = exchange.getRequestHeaders().getFirst("Accept-Encoding");
        if (acceptEncoding != null && acceptEncoding.contains("gzip") && bytes.length > 256) {
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream(bytes.length / 2);
            try (java.util.zip.GZIPOutputStream gzos = new java.util.zip.GZIPOutputStream(baos)) {
                gzos.write(bytes);
            }
            byte[] gzipBytes = baos.toByteArray();
            exchange.getResponseHeaders().set("Content-Encoding", "gzip");
            exchange.sendResponseHeaders(statusCode, gzipBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(gzipBytes);
            }
        } else {
            exchange.sendResponseHeaders(statusCode, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    private Map<String, String> parseQueryParams(String query) {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.isEmpty()) return params;

        String[] pairs = query.split("&");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            try {
                if (idx > 0) {
                    String key = URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
                    String val = URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8);
                    params.put(key, val);
                } else if (!pair.isEmpty()) {
                    String key = URLDecoder.decode(pair, StandardCharsets.UTF_8);
                    params.put(key, "");
                }
            } catch (Exception ignored) {}
        }
        return params;
    }
}
