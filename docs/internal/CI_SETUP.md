# CI Credit Hook Setup

## Overview
Lightweight Node.js script that automatically parses commit trailers and adds credits to the internal ledger on merge.

## Installation

### GitHub Actions
```yaml
name: Credit Hook
on:
  push:
    branches: [main]

jobs:
  credits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Process Credits
        run: node scripts/credit-hook.js ${{ github.sha }}
      - name: Commit Updated Ledger
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add docs/internal/credits.json
          git diff --staged --quiet || git commit -m "chore: update credits ledger"
          git push
```

### Manual Usage
```bash
# Process latest commit
node scripts/credit-hook.js

# Process specific commit
node scripts/credit-hook.js abc1234
```

## Commit Message Format
Include credit trailers in your commit messages:

```
feat: implement new ranking algorithm

This adds the VORP-based ranking system for dynasty leagues.

Credit: Tiber | Builder | VORP ranking algorithm implementation
Credit: Architect J | Architect | Algorithm design and specification
```

## How It Works

1. **Parse**: Extracts `Credit: Who | Role | What` lines from commit messages
2. **Validate**: Ensures proper format and required fields
3. **Append**: Adds structured entries to `docs/internal/credits.json`
4. **Log**: Reports processed credits to console

## Example Output
```
[credit-hook] Processing commit: abc1234
[credit-hook] Added 2 credit(s) to ledger:
  → Tiber (Builder): VORP ranking algorithm implementation
  → Architect J (Architect): Algorithm design and specification
```

## Integration Points

- **Founder Mode**: Credits visible via `mirror()` → `/api/signal?founder=1`
- **Security**: Credits only revealed with founder authentication
- **History**: Complete audit trail with timestamps and commit references
- **Public**: Credits remain completely hidden from public API calls