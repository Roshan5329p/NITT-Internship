package com.matsci.util;

import java.util.Collection;
import java.util.IdentityHashMap;
import java.util.Map;
import java.lang.reflect.Array;

/**
 * Lightweight, zero-dependency JSON serializer.
 */
public class JsonUtil {

    public static String escape(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder();
        sb.append('\"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                        if (c < ' ' || (Character.isSurrogate(c)
                            && !(Character.isHighSurrogate(c) && i + 1 < s.length()
                            && Character.isLowSurrogate(s.charAt(i + 1)))
                            && !(Character.isLowSurrogate(c) && i > 0
                            && Character.isHighSurrogate(s.charAt(i - 1))))) {
                        String hex = Integer.toHexString(c);
                        sb.append("\\u");
                        for (int k = 0; k < 4 - hex.length(); k++) sb.append('0');
                        sb.append(hex);
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('\"');
        return sb.toString();
    }

    public static String toJson(Object obj) {
        return toJson(obj, new IdentityHashMap<>());
    }

    private static String toJson(Object obj, IdentityHashMap<Object, Boolean> path) {
        if (obj == null) return "null";

        if (obj instanceof String s) {
            return escape(s);
        } else if (obj instanceof Number || obj instanceof Boolean) {
            if (obj instanceof Number number) {
                String value = number.toString();
                if (!value.matches("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?")) {
                    throw new IllegalArgumentException("Not a valid JSON number: " + value);
                }
                return value;
            }
            return obj.toString();
        }

        boolean container = obj instanceof Collection<?> || obj instanceof Map<?, ?> || obj.getClass().isArray();
        if (container && path.put(obj, Boolean.TRUE) != null) {
            throw new IllegalArgumentException("Cannot serialize a cyclic object graph");
        }
        try {
            if (obj instanceof Collection<?> col) {
                StringBuilder sb = new StringBuilder("[");
                boolean first = true;
                for (Object item : col) {
                    if (!first) sb.append(",");
                    sb.append(toJson(item, path));
                    first = false;
                }
                sb.append("]");
                return sb.toString();
            } else if (obj instanceof Map<?, ?> map) {
                StringBuilder sb = new StringBuilder("{");
                boolean first = true;
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (!first) sb.append(",");
                    sb.append(escape(String.valueOf(entry.getKey()))).append(":");
                    sb.append(toJson(entry.getValue(), path));
                    first = false;
                }
                sb.append("}");
                return sb.toString();
            } else if (obj.getClass().isArray()) {
                StringBuilder sb = new StringBuilder("[");
                for (int i = 0; i < Array.getLength(obj); i++) {
                    if (i > 0) sb.append(",");
                    sb.append(toJson(Array.get(obj, i), path));
                }
                sb.append("]");
                return sb.toString();
            }
        } finally {
            if (container) path.remove(obj);
        }
        return escape(obj.toString());
    }
}
