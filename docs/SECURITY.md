# Security Guidelines

## 1. Authentication

Authentication Provider:
[Provider]

Methods:
- Email/password
- OAuth
- Magic link
- [Other]

---

## 2. Authorization

Roles:
- Admin
- User
- [Role]

Permissions:

### Admin
- [Permission]

### User
- [Permission]

Authorization must be enforced server-side.

---

## 3. Secrets

Rules:
- Never hard-code credentials
- Never commit production secrets
- Never expose private secrets to the client
- Use environment variables
- Rotate compromised credentials
- Use appropriate secret storage

---

## 4. Environment Variables

Public:
[Variables]

Private:
[Variables]

---

## 5. API Security

Input validation:
[Rules]

Rate limiting:
[Rules]

CORS:
[Rules]

Authentication:
[Rules]

Authorization:
[Rules]

---

## 6. Data Protection

Sensitive data:
[List]

Encryption:
[Rules]

Retention:
[Rules]

Deletion:
[Rules]

---

## 7. Logging

Never log:
- Passwords
- API keys
- Tokens
- Sensitive personal information

Log:
- Authentication events
- Important actions
- Errors
- Security events

---

## 8. File Uploads

Allowed file types:
[List]

Maximum size:
[Limit]

Validation:
[Rules]

Storage:
[Location]

---

## 9. Security Checklist

- [ ] Authentication implemented
- [ ] Authorization implemented
- [ ] Server-side validation
- [ ] Secrets protected
- [ ] Sensitive data protected
- [ ] Rate limiting considered
- [ ] File uploads validated
- [ ] Errors do not expose sensitive details
- [ ] Dependencies reviewed
