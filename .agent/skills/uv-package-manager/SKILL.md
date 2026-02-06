---
description: Managing Python projects and dependencies with Astral's uv
---

# `uv` Package Manager

`uv` is an extremely fast Python package installer and project manager, written in Rust. It replaces `pip`, `pip-tools`, and `virtualenv`.

## Core Commands

### 1. Running Commands (The most common usage)
Use `uv run` to execute scripts or tools in the project's environment. It automatically manages the environment.
```powershell
uv run python main.py
uv run pytest
uv run uvicorn app.main:app --reload
```

### 2. Managing Dependencies (`pyproject.toml`)
If the project has a `pyproject.toml`, use `uv add` to manage dependencies.

**Add a package:**
```powershell
uv add fastapi
uv add sqlalchemy --extras asyncio
```

**Add a development dependency:**
```powershell
uv add --dev pytest
uv add --dev flake8
```

**Remove a package:**
```powershell
uv remove flask
```

### 3. Syncing Environment
Ensure the virtual environment matches the lockfile.
```powershell
uv sync
```

### 4. Direct Pip Usage (Ad-hoc)
If you just need to install something quickly without updating `pyproject.toml` (or if not using a project file):
```powershell
uv pip install requests
```

## Best Practices
- **Prefer `uv run`**: Instead of activating a virtual environment manually, just prefix commands with `uv run`. It ensures dependencies are fresh.
- **Lockfile**: `uv` creates a `uv.lock` file. Keep this committed.
- **Performance**: `uv` is significantly faster than pip. Use it for all dependency operations.

## Troubleshooting
- If `uv` fails to resolve, try `uv cache clean` to reset.
- To upgrade `uv` itself: `uv self update`.
