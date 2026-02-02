# Git Flow & Development Rules

This document outlines the branching strategy, commit conventions, and development workflow for the **Contacless Order Service**.

---

## 1. Branching Strategy

We follow a simplified **Git Flow** model:

| Branch Name | Purpose | Stability |
|-------------|---------|-----------|
| `main` | Production-ready code. Only merged from `develop`. | 🟢 Stable |
| `develop` | Integration branch for features. Base for all sub-branches. | 🟡 Testing |
| `feature/*` | Individual features or improvements. | 🔵 Work-in-progress |
| `bugfix/*` | Non-emergency bug fixes. | 🔵 Work-in-progress |
| `hotfix/*` | Emergency production fixes (merges to `main` and `develop`). | 🔴 Critical |

### Branch Naming Convention:
- `feature/auth-guest-session`
- `bugfix/payment-timeout-tz`
- `hotfix/login-crash`

---

## 2. Commit Message Convention

We use **Conventional Commits** to ensure readable history and automated changelogs.

**Format:** `<type>(<scope>): <description>`

### Types:
- `feat`: A new feature (e.g., `feat(order): add special instructions field`)
- `fix`: A bug fix (e.g., `fix(auth): fix timezone-naive comparison`)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation changes
- `test`: Adding missing tests or correcting existing tests
- `chore`: Updating build tasks, dependencies, etc. (e.g., `chore(deps): update Pydantic to V2`)

### Rules:
1. Use the **imperative mood** ("add" not "added").
2. Do not end the subject line with a period.
3. Limit the subject line to 50 characters.

---

## 3. Pull Request (PR) Policy

1. **Self-Review**: Before opening a PR, run tests locally:
   ```bash
   uv run pytest tests/ -v -W error::DeprecationWarning
   ```
2. **CI Check**: PRs can ONLY be merged if the **GitHub Actions (CI)** status is green (passing).
3. **Small PRs**: Favor small, incremental PRs over massive "megamerges". Ideally < 300 lines.
4. **Squash & Merge**: Features should be squashed into a single clean commit when merging to `develop`.

---

## 4. Timezone & Pydantic Standards

As per the refactoring in Feb 2026:
- **Time**: Always use `datetime.now(UTC)`. Never use `utcnow()`.
- **Pydantic**: Always use `model_config = ConfigDict(from_attributes=True)`. Never use `class Config`.
- **SQLAlchemy Defaults**: Use `default=lambda: datetime.now(UTC)` for model timestamps.

---

## 5. Deployment Flow

1. **Stage**: Push to `develop` ➔ Automated CI runs ➔ Deploy to staging environment.
2. **Release**: Merge `develop` into `main`.
3. **Tag**: Create a version tag (e.g., `v1.2.0`) to trigger the production deployment workflow.
4. **Docker**: Production images are automatically built using the multi-stage `Dockerfile`.
