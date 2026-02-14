# Consensus System

Priority override system for managing consensus rankings. Allows manual rank seeding via structured commands, with swap/shift logic to maintain data integrity. Supports both database-backed and in-memory storage.

## Files

| File | Purpose |
|------|---------|
| `commandRouter.ts` | Parses `TIBER consensus ...` commands, resolves player IDs, executes rank updates with swap logic |
| `curves.ts` | Ranking curve functions for value distribution across tiers |
| `dynastySoftenerV2.ts` | Applies dynasty-specific value softening to young/old players |
| `injuryProfiles.ts` | Injury impact profiles that adjust rankings based on injury type/severity |
| `injuryProfiles.v2.json` | V2 injury profile data (structured JSON) |
| `inMemoryStore.ts` | In-memory consensus ranking store (fallback when DB unavailable) |
| `test-curves.ts` | Testing utilities for curve functions |

## How It Works

### Command Format
```
TIBER consensus {Redraft|Dynasty} {QB|RB|WR|TE|ALL} {rank}: {Player Name}
```
Example: `TIBER consensus Redraft WR 3: Ja'Marr Chase`

### Update Flow
1. `shouldRouteToConsensus(text)` checks if message matches the consensus command regex
2. `parseConsensusCommand(text)` extracts mode, position, rank, player name into `ConsensusUpdatePayload`
3. `resolvePlayerId(playerName)` does fuzzy name→ID resolution
4. `updateConsensusRank(payload)` executes the update:
   - Checks if rank slot is occupied → swap
   - Checks if player already ranked → update
   - Otherwise → insert
5. Audit entry logged for every change

### Storage
- **Primary**: `consensus_ranks` and `consensus_audit` DB tables (via Drizzle)
- **Fallback**: `inMemoryConsensusStore` when DB tables not available

### Ranking Adjustments
- `curves.ts`: Defines value curves so rank #1 is worth significantly more than rank #50
- `dynastySoftenerV2.ts`: Adjusts dynasty values based on player age/career stage
- `injuryProfiles.ts`: Applies injury-based rank penalties by injury type and severity
