---
inclusion: always
---

# Git push policy

After making any code/file change in this workspace, ALWAYS:

1. Stage the specific files you changed (use explicit file paths, not `git add .` or `-A`).
2. Commit with a clear, descriptive message.
3. Push to the configured remote (`git push`) — every time, without asking.

Rules:
- Never use `--force`, `--no-verify`, or `--amend` unless the user explicitly asks.
- If the push fails (e.g. needs `--set-upstream`), set upstream to `origin <current-branch>` and retry.
- If a pre-commit hook fails, fix the issue, re-stage, and create a NEW commit (do not amend).
- If there are no changes, skip the commit/push silently.
- Run the push as the FINAL step of the turn, after any tests/builds the task required.
