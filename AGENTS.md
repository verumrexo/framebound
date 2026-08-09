# model routing

- use `gpt-5.6-sol` as the primary orchestrator for architecture, planning, product decisions, audits, code review, and final verification.
- delegate substantive coding and implementation work to `gpt-5.6-luna` subagents at `xhigh` reasoning when delegation is available and the task can be bounded clearly.
- sol must review luna's changes, resolve integration problems, and verify the finished result before reporting completion.
- do not create a subagent for a trivial edit when delegation would cost more work than it saves.
- when waiting on subagents, use multi-minute waits instead of frequent polling. only update the user when a subagent finishes, hits a real blocker, or reaches a material milestone; do not narrate routine heartbeat checks.
