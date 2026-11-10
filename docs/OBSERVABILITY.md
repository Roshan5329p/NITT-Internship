# Observability

## Purpose
Define production telemetry, monitoring thresholds, logging protocols, and alert routing.

---

## Logging

### What to Log:
- Application errors
- Authentication events
- Important business events
- Security-relevant occurrences

### What NEVER to Log:
- Passwords
- Tokens / Session IDs
- API keys / Secret credentials
- Sensitive personal data (PII)

---

## Monitoring Metrics

- **Error rate**: Operational error budget & spike detection
- **API latency**: p50, p95, p99 endpoint response times
- **Database performance**: Connection pools, slow queries, serialization locks
- **Availability**: Uptime SLA, health check routes
