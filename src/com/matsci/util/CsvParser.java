package com.matsci.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Robust RFC-4180 compliant CSV line parser.
 * Handles quoted fields, embedded commas, and whitespace.
 */
public class CsvParser {

    public static List<String> parseLine(String line) {
        List<String> tokens = new ArrayList<>();
        if (line == null) {
            return tokens;
        }

        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        boolean afterClosingQuote = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);

            if (inQuotes) {
                if (c == '\"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '\"') {
                        // Escaped quote: ""
                        sb.append('\"');
                        i++;
                    } else {
                        inQuotes = false;
                        afterClosingQuote = true;
                    }
                } else {
                    sb.append(c);
                }
            } else if (c == ',') {
                tokens.add(sb.toString());
                sb.setLength(0);
                afterClosingQuote = false;
            } else if (afterClosingQuote) {
                throw new IllegalArgumentException("Unexpected character after closing quote at index " + i);
            } else if (c == '\"') {
                if (sb.length() != 0) {
                    throw new IllegalArgumentException("Quote in unquoted field at index " + i);
                }
                inQuotes = true;
            } else {
                sb.append(c);
            }
        }

        if (inQuotes) {
            throw new IllegalArgumentException("Unclosed quoted field");
        }
        tokens.add(sb.toString());

        return tokens;
    }
}
