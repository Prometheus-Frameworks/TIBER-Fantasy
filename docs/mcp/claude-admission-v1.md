# Claude admission v1: owner-private connector over a static API key

Status: candidate (draft PR #428, stacked on #422). Joe approved this plan on
2026-10-26: a separate league-only Cloudflare Worker, `x-api-key` request header,
token generated on his own machine. That approval covers this runbook only. It does not cover
frozen ROP on this host, merging #422/#428, changes to the ChatGPT/Sites deployment, or any
other user.

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
| `tools/call` arguments no larger than 2,048 serialized UTF-8 bytes, checked before SDK validation | 413 `tool_arguments_too_large` |

`x-api-key` is used because Claude reserves `Authorization` for OAuth on connectors. The 401 never
advertises OAuth discovery. Only league environment values reach the reader, and
`scripts/buildClaudeReaderWorker.mjs` refuses private input. Frozen ROP cannot be on this host.

The shared key identifies the Claude organization, not a person. That is acceptable only while
Joe is its only member. The Worker has one configured profile.

The early input bound reduces exposure to oversized tool arguments; it does not upgrade the MCP SDK
or Zod, or by itself resolve their advisories. The existing 16 KiB request-body cap remains in place.
Deployment and installed-tool acceptance must be repeated for the exact reviewed candidate.

## Runbook (on Joe's computer, not the phone)

Needs Node 22+, git and a Cloudflare account. Run `npx wrangler login` once.

### 1. Build the exact reviewed commit

```bash
git clone https://github.com/Prometheus-Frameworks/TIBER-Fantasy tiber-claude && cd tiber-claude
git checkout <#428 head commit>          # the exact SHA from the PR, not the branch name
npm ci
node scripts/buildClaudeReaderWorker.mjs "$HOME/tiber-claude-build/worker.mjs"
```

Compare the printed `sha256` with the one recorded on PR #428 for that commit. If they differ, stop
and report both values; do not deploy an unmatched bundle.

### 2. Deploy, still closed

```bash
npx wrangler deploy "$HOME/tiber-claude-build/worker.mjs" --name tiber-claude-mcp \
  --no-bundle --compatibility-date 2026-10-01 \
  --var TIBER_CLAUDE_ADMISSION:static-api-key-v1 --var TIBER_LEAGUE_SOURCE:public-sleeper
```

Note the `https://tiber-claude-mcp.<your-subdomain>.workers.dev` URL. With no digest set yet, every
`/mcp` request returns 503. That is expected.

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

Expected: `{"error":"egress_not_allowed"}`. Your machine is outside Anthropic's range, so even the
right key is refused. Then `unset TOKEN`.

### 5. Add the connector (claude.ai on the computer)

Settings → Connectors → Add custom connector:
- Name: `TIBER`
- URL: `https://tiber-claude-mcp.<sub>.workers.dev/mcp`
- Request headers → Add header: name `x-api-key`, value the key from step 3
- Leave the OAuth choice at its default. The server never advertises OAuth, so sign-in should not start.

### 6. Acceptance

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
