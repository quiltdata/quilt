# RC QA Package Handoff Prompt

Use this prompt after a v1 RC deeper QA package is published. The handoff is package-only; do not create GitHub issues, Slack messages, or Asana tasks unless a later workflow explicitly adds those integrations.

```text
Review the Quilt RC deeper QA package for release readiness.

Package URL: <paste package URL>
Expected version: <paste QA_EXPECTED_VERSION>
Target URL: <paste QA_TARGET_URL>

Focus on:
- README.md summary and findings, ordered by severity.
- qa-summary.json counts, package revision, and runnerError if present.
- screenshots/ evidence for failed or visually suspicious checks.
- data/cleanup.json to confirm e2e resources were removed or intentionally left in place.
- data/release.json to confirm the displayed version matches the expected RC.

Summarize:
- Whether any findings should block the RC.
- Which findings are acceptable to defer.
- Any manual follow-up required before release.
```
