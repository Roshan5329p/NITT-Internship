# Environment Configuration

## Purpose
Document every environment variable across local development and production.

---

## Public Variables

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
```

---

## Private Variables

```bash
DATABASE_URL=
AUTH_SECRET=
STRIPE_SECRET_KEY=
```

---

## Rules

- Never commit real secrets
- Never expose private variables to client-side code
- Keep local and production configuration separate
- Document newly introduced variables
