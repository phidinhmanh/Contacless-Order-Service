# Project Error Stack

This file tracks errors and their solutions to prevent recurrence.

| Date | Issue | Cause | Prevention Rule |
| :--- | :--- | :--- | :--- |
| 2026-02-03 | Admin dashboard showed incorrect stats | Client-side self-calculation from raw order data | Always use `/analytics/*` endpoints for business metrics. |
| 2026-02-03 | Skill creation failed | Task boundary too simple | Avoid task boundaries for trivial single-file writes. |
| 2026-02-05 | Dockerfile Unknown Instruction | Multiline script with here-doc (`<<EOF`) in `HEALTHCHECK` | Use one-liner `python -c "..."` for container healthchecks. |
| 2026-02-05 | LAN Access Refused | Backend bound to `127.0.0.1` instead of `0.0.0.0` | Bind uvicorn to `0.0.0.0` for all LAN/Docker accessibility. |
| 2026-02-05 | CORS 400 on OPTIONS Preflight | Credentials enabled with wildcard origins or missing IP in `.env` | Use `allow_origin_regex` in `DEBUG` mode to auto-allow LAN origins. |
| 2026-02-05 | Login 401 Unauthorized | Database missing user records after seed | Always run `scripts/create_admin.py` after database reset. |
