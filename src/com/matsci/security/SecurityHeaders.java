package com.matsci.security;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;

/**
 * Applies industry-standard OWASP security headers to all HTTP responses.
 * Protects against XSS, clickjacking, MIME sniffing, and information disclosure.
 */
public class SecurityHeaders {

    private static final String CSP_POLICY =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "img-src 'self' data: blob:; " +
        "connect-src 'self' http://localhost:* http://127.0.0.1:*; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    public static void apply(HttpExchange exchange, boolean isApi) {
        Headers headers = exchange.getResponseHeaders();

        // 1. Prevent MIME-type sniffing (stops browsers from interpreting text as HTML/JS)
        headers.set("X-Content-Type-Options", "nosniff");

        // 2. Prevent clickjacking / framing attacks
        headers.set("X-Frame-Options", "DENY");

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
