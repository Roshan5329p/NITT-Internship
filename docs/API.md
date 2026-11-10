# API Documentation

## Purpose
This document serves as the single source of truth for API contracts.

---

## API Rules

- Validate all inputs
- Authenticate protected endpoints
- Authorize resource access
- Return consistent error responses
- Do not expose internal implementation details

---

## Error Format

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

---

## Endpoints

### GET /projects

Authentication:
Required

Response:
```json
{
  "projects": []
}
```

---

### POST /projects

Authentication:
Required

Request:
```json
{
  "name": "My Project"
}
```

Validation:
- name is required
- name must be unique per user
