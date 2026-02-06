---
name: error-prevention
description: Ensures errors and their root causes are recorded in stack.md to prevent recurrence.
---

# Error Prevention Skill

This skill turns every mistake into a permanent project rule, ensuring the AI never makes the same error twice.

## Core Rules

1.  **Error Recording**: Whenever you encounter a bug, a runtime error, or a logical mistake that requires more than a simple syntax fix, you MUST record it in the project root's `stack.md`.
2.  **Concise Entry**: Each entry in `stack.md` must be extremely short:
    - **Issue**: What went wrong.
    - **Cause**: The shortest possible explanation of the root cause.
    - **Fix**: The permanent rule to avoid it.
3.  **Pre-computation Check**: Before starting any major task, read `stack.md` to ensure your plan doesn't violate any previously learned lessons.

## Checklist

- [ ] **Discovery**: Did I just fix an error that took more than one try to solve?
- [ ] **Logging**: Is the cause documented in `stack.md`?
- [ ] **Prevention**: Is the solution framed as a "Never do X" or "Always do Y" rule?

## Example Entry for `stack.md`
| Issue | Cause | Prevention |
| :--- | :--- | :--- |
| Admin revenue shows 0 | Self-calculating from raw orders | Always use `/analytics/revenue` endpoint. |
