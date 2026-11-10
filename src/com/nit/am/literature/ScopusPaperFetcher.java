package com.nit.am.literature;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 100% Pure Java Scopus Research Paper Fetcher & Ingestion Engine.
 * Integrates directly with Elsevier Scopus Search API (https://api.elsevier.com).
 * Zero Python dependencies.
 */
public class ScopusPaperFetcher {

    private static final String SCOPUS_SEARCH_URL = "https://api.elsevier.com/content/search/scopus";

    public static class ScopusPaper {
        public String scopusId;
        public String title;
        public String creator;
        public String publicationName;
        public String coverDate;
        public String year;
        public String doi;
        public int citedByCount;
        public String aggregationType;
        public String subTypeDescription;
        public boolean openAccess;

        @Override
        public String toString() {
            return String.format("[%s] %s (%s, %s) - Cited: %d | DOI: %s",
                    scopusId, title, creator, year, citedByCount, doi);
        }
    }

    /**
     * Reads an API key from .env file or environment variable.
     */
    public static String getApiKey() {
        String key = System.getenv("SCOPUS_API_KEY");
        if (key != null && !key.trim().isEmpty()) {
            return key.trim();
        }
        key = System.getenv("ELSEVIER_API_KEY");
        if (key != null && !key.trim().isEmpty()) {
            return key.trim();
        }

        File envFile = new File(".env");
        if (envFile.exists()) {
            try (BufferedReader br = new BufferedReader(new FileReader(envFile, StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.startsWith("SCOPUS_API_KEY=")) {
                        return line.substring("SCOPUS_API_KEY=".length()).trim();
                    }
                    if (line.startsWith("ELSEVIER_API_KEY=")) {
                        return line.substring("ELSEVIER_API_KEY=".length()).trim();
                    }
                }
            } catch (IOException ignored) {}
        }

        return null;
    }

    /**
     * Executes a Scopus Search API query.
     */
    public static List<ScopusPaper> searchPapers(String apiKey, String query, int count, String sort) throws Exception {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Scopus API Key is missing. Ensure SCOPUS_API_KEY is defined in .env");
        }

        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        String urlStr = String.format("%s?query=%s&count=%d&sort=%s&view=STANDARD",
                SCOPUS_SEARCH_URL, encodedQuery, count, sort != null ? sort : "citedby-count");

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(urlStr))
                .header("X-ELS-APIKey", apiKey)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Scopus API Error (HTTP " + response.statusCode() + "): " + response.body());
        }

        return parseEntries(response.body());
    }

    /**
     * Arbitrary-depth JSON array parser for Scopus entry objects.
     */
    public static List<ScopusPaper> parseEntries(String json) {
        List<ScopusPaper> papers = new ArrayList<>();
        
        // Find entry array with optional whitespace around colon
        Pattern entryArrayPattern = Pattern.compile("\"entry\"\\s*:\\s*\\[");
        Matcher arrayMatcher = entryArrayPattern.matcher(json);
        if (!arrayMatcher.find()) {
            return papers;
        }

        int i = arrayMatcher.end();
        while (i < json.length()) {
            while (i < json.length() && (Character.isWhitespace(json.charAt(i)) || json.charAt(i) == ',')) {
                i++;
            }
            if (i >= json.length() || json.charAt(i) == ']') break;

            if (json.charAt(i) == '{') {
                int depth = 0;
                int start = i;
                boolean inStr = false;
                while (i < json.length()) {
                    char c = json.charAt(i);
                    if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) {
                        inStr = !inStr;
                    } else if (!inStr) {
                        if (c == '{') depth++;
                        else if (c == '}') {
                            depth--;
                            if (depth == 0) {
                                String entryJson = json.substring(start, i + 1);
                                ScopusPaper p = parseSingleEntry(entryJson);
                                if (p != null) papers.add(p);
                                i++;
                                break;
                            }
                        }
                    }
                    i++;
                }
            } else {
                i++;
            }
        }

        return papers;
    }

    private static ScopusPaper parseSingleEntry(String block) {
        if (!block.contains("\"dc:title\"")) return null;

        ScopusPaper paper = new ScopusPaper();
        paper.title = extractJsonString(block, "dc:title");
        paper.creator = extractJsonString(block, "dc:creator");
        if (paper.creator.isEmpty()) paper.creator = "Unknown Authors";
        paper.publicationName = extractJsonString(block, "prism:publicationName");
        paper.coverDate = extractJsonString(block, "prism:coverDate");
        paper.doi = extractJsonString(block, "prism:doi");
        paper.scopusId = extractJsonString(block, "dc:identifier");
        paper.aggregationType = extractJsonString(block, "prism:aggregationType");
        paper.subTypeDescription = extractJsonString(block, "subtypeDescription");

        String citedStr = extractJsonString(block, "citedby-count");
        try {
            paper.citedByCount = Integer.parseInt(citedStr);
        } catch (Exception e) {
            paper.citedByCount = 0;
        }

        paper.openAccess = extractJsonBoolean(block, "openaccessFlag") || "1".equals(extractJsonString(block, "openaccess"));

        if (paper.coverDate != null && paper.coverDate.length() >= 4) {
            paper.year = paper.coverDate.substring(0, 4);
        } else {
            paper.year = "2024";
        }

        return paper;
    }

    private static String extractJsonString(String block, String fieldName) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(fieldName) + "\"\\s*:\\s*\"((?:\\\\\"|[^\"])*)\"");
        Matcher m = p.matcher(block);
        if (m.find()) {
            return m.group(1).replace("\\\"", "\"").replace("\\\\", "\\").trim();
        }
        return "";
    }

    private static boolean extractJsonBoolean(String block, String fieldName) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(fieldName) + "\"\\s*:\\s*(true|false)");
        Matcher m = p.matcher(block);
        return m.find() && "true".equalsIgnoreCase(m.group(1));
    }

    /**
     * Saves papers to CSV format.
     */
    public static void saveToCsv(List<ScopusPaper> papers, String filePath) throws IOException {
        File f = new File(filePath);
        if (f.getParentFile() != null) f.getParentFile().mkdirs();

        try (FileWriter fw = new FileWriter(f, StandardCharsets.UTF_8)) {
            fw.write("scopus_id,title,authors,year,journal,doi,cited_by_count,open_access\n");
            for (ScopusPaper p : papers) {
                fw.write(String.format("\"%s\",\"%s\",\"%s\",%s,\"%s\",\"%s\",%d,%b\n",
                        escapeCsv(p.scopusId),
                        escapeCsv(p.title),
                        escapeCsv(p.creator),
                        p.year,
                        escapeCsv(p.publicationName),
                        escapeCsv(p.doi),
                        p.citedByCount,
                        p.openAccess));
            }
        }
    }

    private static String escapeCsv(String str) {
        if (str == null) return "";
        return str.replace("\"", "\"\"");
    }

    public static String toJson(List<ScopusPaper> papers, String query) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"status\": \"success\",\n");
        sb.append("  \"source\": \"Elsevier Scopus Search API\",\n");
        sb.append("  \"query\": \"").append(escapeJson(query)).append("\",\n");
        sb.append("  \"count\": ").append(papers.size()).append(",\n");
        sb.append("  \"papers\": [\n");
        for (int i = 0; i < papers.size(); i++) {
            ScopusPaper p = papers.get(i);
            sb.append("    {\n");
            sb.append("      \"scopusId\": \"").append(escapeJson(p.scopusId)).append("\",\n");
            sb.append("      \"title\": \"").append(escapeJson(p.title)).append("\",\n");
            sb.append("      \"creator\": \"").append(escapeJson(p.creator)).append("\",\n");
            sb.append("      \"publicationName\": \"").append(escapeJson(p.publicationName)).append("\",\n");
            sb.append("      \"year\": \"").append(escapeJson(p.year)).append("\",\n");
            sb.append("      \"doi\": \"").append(escapeJson(p.doi)).append("\",\n");
            sb.append("      \"citedByCount\": ").append(p.citedByCount).append(",\n");
            sb.append("      \"openAccess\": ").append(p.openAccess).append("\n");
            sb.append("    }").append(i < papers.size() - 1 ? "," : "").append("\n");
        }
        sb.append("  ]\n");
        sb.append("}");
        return sb.toString();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", "");
    }

    public static void main(String[] args) {
        System.out.println("==================================================================");
        System.out.println("  ELSEVIER SCOPUS RESEARCH PAPER HARVESTER (PURE JAVA)            ");
        System.out.println("==================================================================");

        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isEmpty()) {
            System.err.println("ERROR: SCOPUS_API_KEY not found in .env or environment.");
            System.exit(1);
        }

        String query = "TITLE-ABS-KEY(\"Ti-6Al-4V\" AND (\"selective laser melting\" OR \"LPBF\" OR \"additive manufacturing\") AND (\"solidification\" OR \"melt pool\"))";
        int count = 25;
        String sort = "citedby-count";

        for (int i = 0; i < args.length; i++) {
            if ("--query".equals(args[i]) && i + 1 < args.length) query = args[++i];
            if ("--count".equals(args[i]) && i + 1 < args.length) count = Integer.parseInt(args[++i]);
            if ("--sort".equals(args[i]) && i + 1 < args.length) sort = args[++i];
        }

        System.out.println("Scopus API Key:  [DETECTED]");
        System.out.println("Query:           " + query);
        System.out.println("Target Count:    " + count);
        System.out.println("Sort Strategy:   " + sort);
        System.out.println("Connecting to Elsevier Scopus REST API...");

        try {
            List<ScopusPaper> papers = searchPapers(apiKey, query, count, sort);
            System.out.printf("Successfully retrieved %d research papers from Scopus!%n%n", papers.size());

            System.out.println(String.format("%-4s | %-55s | %-16s | %-4s | %-7s | %s",
                    "#", "TITLE", "AUTHOR", "YEAR", "CITES", "DOI"));
            System.out.println("--------------------------------------------------------------------------------------------------------------------------------");

            for (int i = 0; i < papers.size(); i++) {
                ScopusPaper p = papers.get(i);
                String shortTitle = p.title.length() > 55 ? p.title.substring(0, 52) + "..." : p.title;
                String shortAuthor = p.creator.length() > 16 ? p.creator.substring(0, 13) + "..." : p.creator;
                System.out.println(String.format("%-4d | %-55s | %-16s | %-4s | %-7d | %s",
                        i + 1, shortTitle, shortAuthor, p.year, p.citedByCount, p.doi));
            }

            // Save to data directory
            String outCsv = "data/scopus_ti64_solidification_papers.csv";
            saveToCsv(papers, outCsv);
            System.out.println("\nSaved full paper metadata to: " + outCsv);

        } catch (Exception e) {
            System.err.println("Scopus fetch failed: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
