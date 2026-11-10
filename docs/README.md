# The Vibe Coding Blueprint

> **The Complete Documentation System for Building Apps With AI**  
> *Idea → Context → Documentation → Plan → Code → Validate → Ship*  
> *Build faster. Guess less.* — **The Automation Guy**

---

## Overview

Vibe coding makes it incredibly easy to go from an idea to working software. You describe what you want, AI writes the code, you run it, you fix something, and repeat.

However, as applications grow in complexity, an inevitable problem appears: **the AI coding agent starts guessing**.
- It guesses what features should do.
- It guesses how UI components look.
- It guesses database schemas and relationships.
- It guesses auth flows and security boundaries.
- It guesses where files belong.

The purpose of this documentation system is to **give your AI coding agent enough context that it spends less time guessing and more time implementing**.

```text
YOUR IDEA
   ↓
PRODUCT REQUIREMENTS (PRD.md)
   ↓
USER FLOWS (UX_FLOWS.md)
   ↓
DESIGN SYSTEM (DESIGN_SYSTEM.md)
   ↓
ARCHITECTURE (ARCHITECTURE.md)
   ↓
DATABASE (DATABASE.md)
   ↓
API CONTRACTS (API.md)
   ↓
SECURITY (SECURITY.md)
   ↓
CODE CONVENTIONS (CODE_STYLE.md)
   ↓
TESTING (TESTING.md)
   ↓
AI AGENT INSTRUCTIONS (AGENTS.md)
   ↓
IMPLEMENTATION
   ↓
VALIDATION
```

---

## Documentation Structure

```text
docs/
├── PRD.md                 # What are we building?
├── DESIGN_SYSTEM.md       # What should it look and feel like?
├── UX_FLOWS.md            # What does the user actually do?
├── ARCHITECTURE.md        # How should the system work?
├── DATABASE.md            # What data exists and how does it relate?
├── API.md                 # How do different parts communicate?
├── SECURITY.md            # What must be protected and how?
├── CODE_STYLE.md          # How should code be written?
├── TESTING.md             # How will we know it works?
├── AGENTS.md              # How should the AI coding agent behave?
│
├── ENVIRONMENT.md         # Environment variables configuration
├── ERROR_HANDLING.md      # How the system handles failure
├── DEPLOYMENT.md          # Environments, release pipelines, rollbacks
├── OBSERVABILITY.md       # Logging, metrics, monitoring, alerts
├── DECISIONS.md           # Architecture Decision Records (ADRs)
├── ROADMAP.md             # Priorities: NOW / NEXT / LATER / DEFERRED
└── CHANGELOG.md           # Version release notes
```

---

## When to Use Which Stack

### 1. Absolute Minimum (Small Projects / MVPs)
- `PRD.md`
- `DESIGN_SYSTEM.md`
- `ARCHITECTURE.md`
- `AGENTS.md`

### 2. Recommended (Medium Projects)
Add:
- `DATABASE.md`
- `SECURITY.md`
- `API.md`
- `TESTING.md`
- `UX_FLOWS.md`

### 3. Production-Ready (Serious / Commercial Applications)
Add:
- `ENVIRONMENT.md`
- `ERROR_HANDLING.md`
- `DEPLOYMENT.md`
- `OBSERVABILITY.md`
- `DECISIONS.md`
- `ROADMAP.md`
- `CHANGELOG.md`

---

## The 6-Step Workflow With Your AI Coding Agent

Don't say: *"Build me a SaaS dashboard."* Instead, use this structured process:

1. **Step 1 — Give the Agent Context**: Point to `/docs`, require the agent to read before writing code, and ask it to summarize its understanding.
2. **Step 2 — Ask for a Plan**: Require a detailed implementation plan (files changed, dependencies, DB/API changes, security considerations, tests).
3. **Step 3 — Review the Plan**: Inspect what the agent intends to change before approving.
4. **Step 4 — Implement**: Agent makes focused, minimal changes following existing architecture without introducing unneeded dependencies.
5. **Step 5 — Validate**: Run tests, linters, type checks, and build commands. Inspect the final git diff.
6. **Step 6 — Update Documentation**: Keep `/docs` in sync whenever implementation alters any documented assumptions.

---

## Copy-Paste Prompts

### 1. Project Bootstrap Prompt (New Project)
```markdown
I want to build a new application.
Do not start coding yet.

First, help me create the project documentation.

Create the following documentation:
1. PRD.md
2. DESIGN_SYSTEM.md
3. UX_FLOWS.md
4. ARCHITECTURE.md
5. DATABASE.md
6. API.md
7. SECURITY.md
8. CODE_STYLE.md
9. TESTING.md
10. AGENTS.md

For each document:
- Clearly explain its purpose
- Identify assumptions
- Identify unresolved questions
- Keep requirements explicit
- Avoid inventing business decisions
- Reuse decisions consistently across documents

Start with PRD.md.
Ask me only the questions that are necessary to define the product correctly.
Do not generate application code until the documentation has been reviewed and approved.
```

### 2. Feature Implementation Prompt
```markdown
I want to add this feature:
[FEATURE]

Before changing code:
1. Read the relevant documentation.
2. Identify which documents are affected.
3. Inspect the existing implementation.
4. Explain the current architecture relevant to this feature.
5. Identify affected frontend files.
6. Identify affected backend/API files.
7. Identify database changes.
8. Identify security considerations.
9. Identify tests required.
10. Create an implementation plan.

Do not modify unrelated parts of the project.

After implementation:
- Run tests
- Run lint
- Run type checking
- Run the build
- Review the final diff
- Update documentation if required
```

### 3. Senior Engineer Code Review Prompt
```markdown
Review the changes you just made as a senior engineer.

Check for:
- Incorrect requirements
- Architecture violations
- Duplicate logic
- Unnecessary abstractions
- Security issues
- Database issues
- API inconsistencies
- Accessibility issues
- Responsive UI issues
- Error handling issues
- Missing loading/empty/error states
- Missing tests
- Regressions
- Unnecessary dependencies
- Unintended file changes

Compare the implementation against /docs.
Do not modify anything yet.

First provide:
1. Findings
2. Severity
3. Recommended fixes
4. Documentation that should be updated
```

---

## Golden Rules of AI-Assisted Development

1. **Context before code.**
2. **Architecture before implementation.**
3. **Define important decisions instead of repeatedly re-deciding them.**
4. **Make requirements explicit.**
5. **Don't let AI guess when the answer can be documented.**
6. **Keep your documentation close to your code.**
7. **Validate AI-generated code instead of blindly trusting it.**
8. **Update your documentation when your system changes.**
9. **Use AI to accelerate implementation, not to replace product thinking.**

---

## When to Update Each Document

| Change Event | Document to Update |
| :--- | :--- |
| Product requirements or scope change | `PRD.md` |
| User journeys or interaction paths change | `UX_FLOWS.md` |
| Visual language, theme, or tokens change | `DESIGN_SYSTEM.md` |
| Technical structure or pattern changes | `ARCHITECTURE.md` |
| Schema, tables, relationships change | `DATABASE.md` |
| Endpoints, request/response contracts change | `API.md` |
| Auth rules, secrets, or data security policies change | `SECURITY.md` |
| Conventions, formatting, or linting rules change | `CODE_STYLE.md` |
| Testing tools, coverage targets, or test flows change | `TESTING.md` |
| AI rules, constraints, or instruction sets change | `AGENTS.md` |
| Environment variables added or changed | `ENVIRONMENT.md` |
| Error handling protocols or status codes change | `ERROR_HANDLING.md` |
| Target environments or release pipelines change | `DEPLOYMENT.md` |
| Architectural tradeoffs or technical choices recorded | `DECISIONS.md` |
| Roadmaps, backlog priorities change | `ROADMAP.md` |
| Versions released or features deployed | `CHANGELOG.md` |
