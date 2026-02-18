# SESSION_PROTOCOL (Manus)

Every session must follow this order:

1) Read /AGENT_BOOTSTRAP.md
2) Write /reports/manus_preflight_latest.md (Preflight Acknowledgement)
3) Create a new branch: manus/<task-slug>
4) Execute only tasks that match /CURRENT_PHASE.md
5) Produce /reports/manus_daily_YYYY-MM-DD.md
6) Open a PR to main (never merge)

If any step cannot be completed, stop and write a report explaining why.
