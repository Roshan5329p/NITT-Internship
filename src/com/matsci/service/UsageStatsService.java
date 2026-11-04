package com.matsci.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Ultra-fast non-blocking Usage Statistics Service.
 * Uses atomic in-memory counters with asynchronous batched disk persistence.
 * Completely eliminates HTTP thread blocking on disk I/O.
 */
public class UsageStatsService {

    private final Path storageFile;
    private final AtomicLong totalVisitors = new AtomicLong(0);
    private final AtomicLong visitorsToday = new AtomicLong(0);
    private final AtomicLong predictionsMade = new AtomicLong(0);
    private volatile LocalDate statsDate;
    private final AtomicBoolean isDirty = new AtomicBoolean(false);
    private final ScheduledExecutorService flusher = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "Stats-Async-Flusher");
        t.setDaemon(true);
        return t;
    });

    public UsageStatsService(Path storageFile) throws IOException {
        this.storageFile = storageFile;
        this.statsDate = LocalDate.now();

        if (Files.exists(storageFile)) {
            Properties properties = new Properties();
            try (InputStream input = Files.newInputStream(storageFile)) {
                properties.load(input);
            }

            totalVisitors.set(parseCount(properties, "totalVisitors"));
            predictionsMade.set(parseCount(properties, "predictionsMade"));
            String savedDate = properties.getProperty("statsDate");
            if (savedDate != null) {
                try {
                    LocalDate persistedDate = LocalDate.parse(savedDate);
                    if (persistedDate.equals(statsDate)) {
                        visitorsToday.set(parseCount(properties, "visitorsToday"));
                    }
                } catch (Exception ignored) {}
            }
        }

        // Periodic async flush every 3 seconds if modified
        flusher.scheduleWithFixedDelay(this::flushIfNeeded, 3, 3, TimeUnit.SECONDS);

        // Guaranteed flush on application shutdown
        Runtime.getRuntime().addShutdownHook(new Thread(this::flushIfNeeded));
    }

    public synchronized Map<String, Object> recordVisit() {
        rolloverDateIfNeeded();
        totalVisitors.incrementAndGet();
        visitorsToday.incrementAndGet();
        isDirty.set(true);
        return toMap();
    }

    public Map<String, Object> recordPrediction() {
        rolloverDateIfNeeded();
        predictionsMade.incrementAndGet();
        isDirty.set(true);
        return toMap();
    }

    public Map<String, Object> getStats() {
        rolloverDateIfNeeded();
        return toMap();
    }

    private void rolloverDateIfNeeded() {
        LocalDate today = LocalDate.now();
        if (!today.equals(statsDate)) {
            synchronized (this) {
                // Re-read after acquiring the lock so a caller delayed across midnight
                // cannot roll the date back using its stale value.
                today = LocalDate.now();
                if (!today.equals(statsDate)) {
                    statsDate = today;
                    visitorsToday.set(0);
                    isDirty.set(true);
                }
            }
        }
    }

    private synchronized void flushIfNeeded() {
        if (!isDirty.compareAndSet(true, false)) {
            return;
        }
        try {
            Properties properties = new Properties();
            properties.setProperty("totalVisitors", Long.toString(totalVisitors.get()));
            properties.setProperty("visitorsToday", Long.toString(visitorsToday.get()));
            properties.setProperty("predictionsMade", Long.toString(predictionsMade.get()));
            properties.setProperty("statsDate", statsDate.toString());

            Path parent = storageFile.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Path tempFile = storageFile.resolveSibling(storageFile.getFileName() + ".tmp");
            try (OutputStream output = Files.newOutputStream(tempFile)) {
                properties.store(output, "MatSci usage statistics");
            }
            try {
                Files.move(tempFile, storageFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tempFile, storageFile, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            System.err.println("[UsageStatsService WARN] Async flush error: " + e.getMessage());
            isDirty.set(true);
        }
    }

    private Map<String, Object> toMap() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalVisitors", totalVisitors.get());
        stats.put("visitorsToday", visitorsToday.get());
        stats.put("predictionsMade", predictionsMade.get());
        stats.put("statsDate", statsDate.toString());
        return stats;
    }

    private long parseCount(Properties properties, String key) {
        String value = properties.getProperty(key, "0");
        try {
            long count = Long.parseLong(value);
            return Math.max(0, count);
        } catch (Exception e) {
            return 0;
        }
    }
}
