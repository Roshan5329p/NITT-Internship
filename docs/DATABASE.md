# Database

## 1. Database Engine

Database:
[PostgreSQL / MySQL / SQLite / MongoDB / etc.]

Hosting:
[Provider]

---

## 2. Naming Conventions

Tables:
[Convention]

Columns:
[Convention]

Primary Keys:
[Convention]

Foreign Keys:
[Convention]

Timestamps:
[Convention]

---

## 3. Tables

### users
Purpose:
[Description]

Columns:
- id
- email
- name
- created_at
- updated_at

---

### projects
Purpose:
[Description]

Columns:
- id
- user_id
- name
- description
- status
- created_at
- updated_at

---

## 4. Relationships

users → projects
One user can have many projects.

projects → tasks
One project can have many tasks.

---

## 5. Constraints

Required:
- [Field]

Unique:
- [Field]

Foreign Keys:
- [Relationship]

---

## 6. Indexes

Index:
[Column]

Reason:
[Reason]

---

## 7. Data Validation

- [Rule]
- [Rule]

---

## 8. Soft Delete

Does the system use soft deletion?
[Yes / No]

If yes:
[Explain implementation.]

---

## 9. Auditing

Do we record:
- Created by?
- Updated by?
- Deleted by?
- Activity history?

[Rules]

---

## 10. Sensitive Data

Sensitive fields:
- [Field]

Protection:
[Rules]

---

## 11. Migration Rules

Schema changes must:
1. Be documented
2. Have a migration
3. Be tested
4. Avoid breaking existing production data

---

## 12. Seed Data

[Describe development/demo seed data.]
