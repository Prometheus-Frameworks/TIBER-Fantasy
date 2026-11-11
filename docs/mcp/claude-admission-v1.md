# Claude admission v1: owner-private connector over a static API key

Status: **blocked integration candidate**, PR #428, reconciled with main for source review. Joe's October 31 review/fix/merge request permits repairing this source,
not deploying it or deciding the unresolved Claude-host ROS scope. No deployable
integrated candidate has been selected. The historical October 26 plan was a
separate league-only Worker, `x-api-key` header, and a token generated on Joe's
computer. Frozen ROP, other users, ChatGPT/Sites changes and activation remain
outside this runbook's authority.

## What this deploys

`server/mcp/claudeAdmissionWorker.ts` wraps the unchanged ChatGPT Worker. It admits a request only
if all of these hold, and otherwise refuses before any tool runs:

| Check | Refusal |
| --- | --- |
| path is `/mcp` | 404 |
| `TIBER_CLAUDE_ADMISSION=static-api-key-v1` | 503 `claude_admission_disabled` |
| `TIBER_CLAUDE_TOKEN_SHA256` set to a 64-char lowercase hex digest | 503 `claude_admission_unconfigured` |
| `CF-Connecting-IP` in Anthropic egress `160.79.104.0/21` (unless `TIBER_CLAUDE_EGRESS_CHECK=off`) | 403 `egress_not_allowed` |
| no foreign browser `Origin` | 403 `origin_not_allowed` |
| `x-api-key` whose SHA-256 matches (constant time). A token in `Authorization` is never accepted | 401 `invalid_credentials` |

`x-api-key` is used because Claude reserves `Authorization` for OAuth on connectors. The 401 never
advertises OAuth discovery. Only league environment values reach the reader, and
`scripts/buildClaudeReaderWorker.mjs` refuses private input. Frozen ROP cannot be on this host.

The shared key identifies the Claude organization, not a person. That is acceptable only while
Joe is its only member. The Worker has one configured profile.

## Runbook (on Joe's computer, not the phone)

**STOP before building or running any provider command:** the old
`8b86e06b05201b46a3b5f5851c4950106ebec4f9` candidate lacks #429's pre-SDK
argument guard. Neither that candidate nor its recorded bundle hash qualifies a
corrected deployment. The October 31 source integration includes that guard and current main, but does
not resolve the ROS-scope decision or clear a deployment gate.

### 1. Select and build a separately qualified integrated candidate

There is currently **no approved build SHA or bundle receipt** for this procedure.
Before it can be used, the maintainer must identify one published integrated head
that includes the argument guard, current required integration and the explicitly
decided ROS scope, then obtain fresh tests and independent review. Record its full
40-character commit SHA and expected Claude bundle SHA-256 together in a dated
receipt. Do not substitute "latest #428 head", a branch name, #429 alone, or the
old #428 hash. Further integration invalidates earlier build/review receipts.

Only after those gates and separate deployment permission are satisfied, on Joe's
computer with Node 22+, git and the authorized Cloudflare account: check out that
exact recorded commit, run `npm ci`, and build using
`node scripts/buildClaudeReaderWorker.mjs "$HOME/tiber-claude-build/worker.mjs"`.
Compare the printed SHA-256 to that same candidate's receipt. Stop on any mismatch.
The steps below describe the future closed procedure, not authority to execute it.

### 2. Deploy, still closed

```bash
npx wrangler deploy "$HOME/tiber-claude-build/worker.mjs" --name tiber-claude-mcp \
  --no-bundle --compatibility-date 2026-10-01 \
  --var TIBER_CLAUDE_ADMISSION:disabled --var TIBER_LEAGUE_SOURCE:disabled
```

Note the `https://tiber-claude-mcp.<your-subdomain>.workers.dev` URL. Verify an
`/mcp` request returns HTTP 503 with `claude_admission_disabled` before proceeding.
Existing secrets can survive redeployment: absence of a digest must never be the
closed-state guarantee. Keep both explicit disabled values through all secret
configuration and verify the same refusal afterwards; stop on any other result.

### 3. Set secrets

Use the same Sleeper user ID and default league as the Sites deployment. Wrangler prompts for each value:

```bash
npx wrangler secret put TIBER_PROFILE_USER_ID --name tiber-claude-mcp
npx wrangler secret put TIBER_DEFAULT_LEAGUE_ID --name tiber-claude-mcp   # optional
```

Generate the key locally. Only its hash goes to Cloudflare:

```bash
TOKEN=$(openssl rand -hex 32)
printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1 | npx wrangler secret put TIBER_CLAUDE_TOKEN_SHA256 --name tiber-claude-mcp
echo "$TOKEN"      # copy it into step 5 now; it is not stored anywhere else
```

Never paste the key into chat, an issue, a PR or a file in the repo.

### 4. Check that it refuses from your own machine

```bash
curl -s -X POST https://tiber-claude-mcp.<sub>.workers.dev/mcp -H 'content-type: application/json' \
  -H "x-api-key: $TOKEN" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected while closed: HTTP 503, `{"error":"claude_admission_disabled"}`, even
with the right key. Do not enable admission or sources to make this probe pass.
Copy the locally generated key only into the authorized connector configuration,
then `unset TOKEN`; never publish it.

### 5. Add the connector (claude.ai on the computer)

Settings → Connectors → Add custom connector:
- Name: `TIBER`
- URL: `https://tiber-claude-mcp.<sub>.workers.dev/mcp`
- Request headers → Add header: name `x-api-key`, value the key from step 3
- Leave the OAuth choice at its default. The server never advertises OAuth, so sign-in should not start.

### 6. Separate activation decision, then acceptance

Steps 2–5 deliberately leave admission and source reads disabled. Connector setup
is not activation permission. Stop here until Joe separately authorizes activation
of the exact reviewed candidate and its explicit tool/ROS scope. Keep the disabled
values otherwise. Any authorized activation must be a separately recorded action;
this runbook intentionally supplies no automatic enable command. After authorized
activation, an own-machine valid-key probe should refuse with `egress_not_allowed`
when outside the allowed range, and acceptance can proceed below.

In a new chat, enable the TIBER connector and ask Claude to list its tools, then call
`tiber_league_capabilities` and `tiber_get_my_leagues`. Repeat in a second fresh chat. Report
results on PR #428. Publication alone is not acceptance.

If it fails, watch `npx wrangler tail tiber-claude-mcp` while retrying:
- `egress_not_allowed`: live Claude traffic is not from the documented range. Stop and report.
  Turning the check off is a separate decision.
- `invalid_credentials`: header name or value mismatch. Remove the connector, re-add it.
- "Couldn't start sign-in": Claude tried OAuth. Report; do not add OAuth here.

## Rotation and rollback

- Rotate: repeat step 3's key commands, then remove and re-add the connector with the new key.
- Kill switch: `npx wrangler secret delete TIBER_CLAUDE_TOKEN_SHA256 --name tiber-claude-mcp` (every
  call returns 503), or `npx wrangler delete --name tiber-claude-mcp` to remove the Worker.
- The ChatGPT/Sites deployment is independent and unaffected by any of this.


## October 31 source integration (not deployment qualification)

The source candidate incorporates main `ee937153fb49bef0be59703ef0cc9711b84d4ede`
and the exact argument-limit implementation/tests from #429
`ca5aa9038c8cfb7f1cc3a70c3b0d37f8683311c8`, without modifying #429. Both agent-log
histories and TypeScript scopes are preserved. The existing eight-tool reader,
including schedule-only ROS, remains unchanged in capability scope; no new ROS
policy or admission gate is inferred. Joe's ROS decision remains required before
any deployment/activation. Existing source code inclusion is not that decision.

Local Node24.22.1 default builds with manifest/lock-matched dependencies:
- Claude: 239 modules, no private input, 427997 bytes, SHA-256
  `b8a607d7c896b669133fe3a5f113f26fb9bfee51c8ffdabf7abf5765120e4b89`.
- ChatGPT: 238 modules, no private input, 425612 bytes, SHA-256
  `4d8b394816b6088a158897e9e0e9a814b4a9788577dfc3e8aa96ac2b8bcbe974`;
  identical to current main's already-qualified shared reader.

The pre-SDK guard preserves the existing 16KiB request bound/deadline, enforces
2KiB serialized tool arguments before SDK schema validation, and strips credentials
before forwarding. Synthetic tests exercise oversized and deeply nested arguments,
zero inner calls on refusal, and unchanged bounded forwarding. CI now includes the
admission tests alongside main's public/private regression tests. Exact final-head
review/CI receipts belong on PR #428; these local build hashes alone are not a
selected deployment receipt. All closed-state and separate activation gates above
remain controlling. No credentials, provider reads or deployed settings changed.
