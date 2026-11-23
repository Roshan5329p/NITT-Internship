package com.matsci.security;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;

import java.net.InetSocketAddress;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Applies industry-standard OWASP security headers, strict origin allowlisting,
 * and sliding-window rate limiting across all HTTP handlers.
 */
public class SecurityHeaders {

    private static final String CSP_POLICY =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' blob: 'wasm-unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
        "img-src 'self' data: blob:; " +
        "worker-src 'self' blob:; " +
        "connect-src 'self' http://localhost:* http://127.0.0.1:* https://cdn.jsdelivr.net; " +
        "object-src 'none'; " +
        "frame-ancestors 'self'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    private static final Set<String> EXACT_ALLOWED_ORIGINS = Set.of(
        "https://nit-titanium-am-platform.vercel.app",
        "https://nitt-am-platform.vercel.app"
    );

    private static final Pattern LOCALHOST_ORIGIN_PATTERN =
        Pattern.compile("^http://(localhost|127\\.0\\.0\\.1)(:\\d{1,5})?$", Pattern.CASE_INSENSITIVE);

    private static final ConcurrentHashMap<String, Deque<Long>> RATE_BUCKETS = new ConcurrentHashMap<>();

    public static boolean isAllowedOrigin(String origin) {
        if (origin == null || origin.isBlank()) return false;
        String clean = origin.trim();
        return EXACT_ALLOWED_ORIGINS.contains(clean) || LOCALHOST_ORIGIN_PATTERN.matcher(clean).matches();
    }

    public static void applyCors(HttpExchange exchange) {
        Headers reqHeaders = exchange.getRequestHeaders();
        Headers respHeaders = exchange.getResponseHeaders();
        respHeaders.set("Vary", "Origin");

        String origin = reqHeaders.getFirst("Origin");
        if (origin != null && isAllowedOrigin(origin)) {
            respHeaders.set("Access-Control-Allow-Origin", origin.trim());
        } else {
            respHeaders.remove("Access-Control-Allow-Origin");
        }
        respHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        respHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        respHeaders.set("Access-Control-Max-Age", "86400");
    }

    public static boolean isAllowedPostOrigin(HttpExchange exchange) {
        Headers reqHeaders = exchange.getRequestHeaders();
        String origin = reqHeaders.getFirst("Origin");
        if (origin != null && !origin.isBlank()) {
            return isAllowedOrigin(origin);
        }
        String fetchSite = reqHeaders.getFirst("Sec-Fetch-Site");
        if (fetchSite != null && !fetchSite.isBlank()) {
            String low = fetchSite.trim().toLowerCase();
            return "same-origin".equals(low) || "none".equals(low);
        }
        return true;
    }

    public static String getClientIp(HttpExchange exchange) {
        InetSocketAddress remote = exchange.getRemoteAddress();
        if (remote != null && remote.getAddress() != null) {
            return remote.getAddress().getHostAddress();
        }
        return "unknown";
    }

    public static boolean allowRateLimit(String bucketKey, int maxRequests, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> deque = RATE_BUCKETS.computeIfAbsent(bucketKey, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() >= windowMs) {
                deque.pollFirst();
            }
            if (deque.size() >= maxRequests) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }

    public static void apply(HttpExchange exchange, boolean isApi) {
        Headers headers = exchange.getResponseHeaders();

        // 1. Prevent MIME-type sniffing (stops browsers from interpreting text as HTML/JS)
        headers.set("X-Content-Type-Options", "nosniff");

        // 2. Prevent clickjacking / framing attacks
        headers.set("X-Frame-Options", "SAMEORIGIN");

        // 3. Cross-Site Scripting (XSS) filter
        headers.set("X-XSS-Protection", "1; mode=block");

        // 4. Content Security Policy (strict resource boundaries)
        headers.set("Content-Security-Policy", CSP_POLICY);

        // 5. Referrer Policy (prevent URL leakage to external sites)
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

        // 6. Restrict dangerous browser features (camera, mic, geolocation)
        headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

        // 7. Obscure underlying server/runtime version
        headers.set("Server", "MatSci-Engine/1.0 (Secured)");

        // 8. Cache-Control: API data should never be cached in shared/public proxies
        if (isApi) {
            headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            headers.set("Pragma", "no-cache");
        }
    }
}
