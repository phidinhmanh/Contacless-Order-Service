---
name: terminal-troubleshooter
description: Critical for resolving failing terminal commands or tests. Use this when a command exits with a non-zero status or when you are stuck in a retry loop.
---

# Terminal Troubleshooter Skill

You are currently stuck in a "Loop of Stupid" because you are not seeing the full error logs from the terminal. Use this skill to break the loop.

## The "Stop the Loop" Protocol

When a command fails (Exit Code != 0), you **MUST NOT** guess the fix. Follow these exact steps:

1. **Capture the Full Log**: Run the failing command again, but pipe the output to a temporary file.
   - Example: `pytest > debug_log.txt 2>&1` or `npm test > debug_log.txt 2>&1`
2. **Read the Log**: Use your `read_file` tool to ingest `debug_log.txt`.
3. **Analyze the Traceback**: Look for specific line numbers, `ImportError`, `AttributeError`, or `ConnectionError`.
4. **Contextualize**: Relate the error to the **Contactless Order Service** logic (e.g., check if the database is running or if the JWT secret is set).
5. **Propose and Fix**: Only after reading the log should you attempt a code change.

## Best Practices
- **Never ignore STDERR**: Most of the useful information is in the error stream.
- **Identify Flakiness**: If the log shows a timeout, do not change code; check the environment/infrastructure.
- **Clean Up**: Always `rm debug_log.txt` after you have solved the issue to keep the workspace clean.
