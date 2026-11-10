# Error Handling

## Purpose
Document how the system handles failure, boundary exceptions, and recovery across the stack.

---

## Scope & Coverage Checklist
- Validation errors
- API failures
- Network errors
- Authentication errors
- Permission errors
- Database failures
- Third-party failures
- Timeouts
- Empty states
- Loading states
- Retry behavior
- User-facing messages

---

## API Error Status Codes

- **400**: Validation error
- **401**: Authentication required
- **403**: Permission denied
- **404**: Resource not found
- **429**: Rate limit exceeded
- **500**: Unexpected server error

---

## Error Response Format

```json
{
  "data": null,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request"
  }
}
```
