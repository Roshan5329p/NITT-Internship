# AI Coding Agent Instructions

## 1. Project Context

Project:
[Name]

Purpose:
[Description]

Primary Users:
[Users]

---

## 2. Source of Truth

Before making significant changes, read the relevant documentation inside /docs.

Core documentation:
- PRD.md
- DESIGN_SYSTEM.md
- ARCHITECTURE.md
- DATABASE.md
- SECURITY.md
- CODE_STYLE.md
- TESTING.md

Do not contradict these documents without first identifying the conflict.

---

## 3. General Rules

- Understand existing code before modifying it
- Reuse existing components and utilities
- Follow the design system
- Follow the architecture
- Follow database conventions
- Follow security requirements
- Follow coding conventions
- Do not invent business requirements
- Do not expose secrets
- Avoid unnecessary dependencies
- Avoid unrelated changes

---

## 4. Planning

Before implementing a non-trivial task:
1. Inspect relevant documentation
2. Inspect relevant code
3. Identify affected files
4. Identify dependencies
5. Identify database/API changes
6. Identify tests required
7. Create a concise implementation plan

---

## 5. Implementation

During implementation:
- Make focused changes
- Reuse established patterns
- Preserve existing behavior
- Avoid unnecessary rewrites
- Keep code maintainable

---

## 6. Validation

After implementation:
1. Run tests
2. Run linting
3. Run type checking
4. Run the build
5. Review changed files
6. Check for unintended changes

---

## 7. Documentation

Update documentation when implementation changes:
- Product behavior
- Architecture
- Database schema
- API contracts
- Security rules
- Coding conventions

---

## 8. Conflict Handling

If requirements conflict:
Do not guess.
Identify the conflict and ask for clarification.

---

## 9. Completion Criteria

A task is complete only when:
- Requirements are satisfied
- Tests pass
- Build succeeds
- No unintended files changed
- Security rules are respected
- Documentation is updated when necessary
