#!/usr/bin/env bash
set -euo pipefail

# === CONFIG ===
BRANCH="chore/site-cleanup-$(date +%F)"
TAG="pre-cleanup-$(date +%F)"
QUAR=".trash/phase1"
DOC_ARC="archive"
OPS=".ops/snapshots"
ROUTE_ROOT="client/src"  # adjust if your routes live elsewhere

# Test/demo routes we forbid in prod
ROUTE_PATTERNS="/api-test|/api-demo|/api-comprehensive|/te-evaluation-test|/batch-evaluation-test|/prometheus-stress-test|/projections-test|/adaptive-consensus-demo|/curves-demo|/injury-profiles-demo"

# Candidate directories to quarantine (will skip if not present)
CANDIDATE_DIRS=(
  "attached_assets" "backend" "components" "data" "database" "modules"
  "raw" "raw-data" "routes" "staging" "static" "static_captures"
  "storage" "templates" "warehouse" "tests" "utils" "temp" "logs"
)
# Glob for duplicate export files
DUP_EXPORT_GLOB="*-export.js"

echo "==> Guard rails"
git status --porcelain >/dev/null
git switch -c "$BRANCH"
git tag "$TAG" || true

echo "==> Snapshot (pre)"
mkdir -p "$OPS"
git ls-files > "$OPS/files-pre.txt"
du -sh * .[^.]* 2>/dev/null | sort -h > "$OPS/du-pre.txt" || true

echo "==> Ensure quarantine & archive dirs"
mkdir -p "$QUAR" "$DOC_ARC" ".trash" ".ops"

echo "==> Dry-run listing"
echo "--- Candidate directories present ---"
for d in "${CANDIDATE_DIRS[@]}"; do
  [[ -e "$d" ]] && echo "  - $d"
done
echo "--- Duplicate export files ---"
ls -1 $DUP_EXPORT_GLOB 2>/dev/null || true

echo "==> Quarantine (move, don't delete)"
# Prefer git mv, fall back to mv
move_cmd() {
  local src="$1"; local dst="$2"
  if git ls-files --error-unmatch "$src" >/dev/null 2>&1; then
    git mv "$src" "$dst"
  else
    mv "$src" "$dst"
    git add -A "$dst/$(basename "$src")" 2>/dev/null || true
  fi
}

for d in "${CANDIDATE_DIRS[@]}"; do
  if [[ -e "$d" ]]; then
    echo "  -> $d  →  $QUAR/"
    move_cmd "$d" "$QUAR/"
  fi
done

shopt -s nullglob
for f in $DUP_EXPORT_GLOB; do
  echo "  -> $f  →  $QUAR/"
  move_cmd "$f" "$QUAR/"
done
shopt -u nullglob

echo "==> Archive docs (non-destructive)"
# Sleeper batch docs
ls -1 SLEEPER_ROUTES_BATCH_*_COMPLETE.md 2>/dev/null | xargs -I{} mv "{}" "$DOC_ARC/" 2>/dev/null || true
# Generic *_COMPLETE
ls -1 *_COMPLETE.md 2>/dev/null | xargs -I{} mv "{}" "$DOC_ARC/" 2>/dev/null || true
# Roadmap
[[ -f IMPLEMENTATION_ROADMAP.md ]] && mv IMPLEMENTATION_ROADMAP.md "$DOC_ARC/"

# Handle duplicate changelogs if present
if [[ -f CHANGELOG-OLD.md ]]; then
  mv CHANGELOG-OLD.md "$DOC_ARC/"
fi

echo "==> Route scan (ensure demos are hidden in prod): $ROUTE_ROOT"
if command -v rg >/dev/null 2>&1; then
  rg -n --no-ignore -S "$ROUTE_PATTERNS" "$ROUTE_ROOT" || true
else
  echo "ripgrep (rg) not found – skipping scan."
fi

echo "==> Commit quarantined moves"
git add -A
git commit -m "chore(cleanup): quarantine unused dirs & duplicate exports, archive docs (Phase 1)"

echo "==> Snapshot (post)"
du -sh * .[^.]* 2>/dev/null | sort -h > "$OPS/du-post.txt" || true

echo "==> Size delta"
diff -u "$OPS/du-pre.txt" "$OPS/du-post.txt" || true

cat <<'NOTE'

✅ Phase 1 complete (quarantine, not delete).
Next steps:
  1) Ensure internal demo/test routes are disabled in production build.
  2) Run the app, validate key flows.
  3) When confident, finalize with: git rm -r .trash/phase1 && commit.
  4) Phase 2: run ts-prune / knip / depcheck, then surgically remove dead code.

NOTE