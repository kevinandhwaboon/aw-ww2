#!/bin/bash
# Stop hook: Claude may not finish a turn while `npm run check` is red on uncommitted code changes.
#
# - Nothing changed in the code (a question, a docs-only edit): no check, instant.
# - Changes that already passed: no second run.
# - A failure is sent back to Claude once, with the end of the output, so it keeps working.
#   If Claude stops again without changing anything, the turn ends with a warning rather than
#   looping forever (for example when another session's half-done work is what is red).

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ -d "$HOME/.local/node/bin" ] && PATH="$HOME/.local/node/bin:$PATH"
command -v npm >/dev/null || exit 0

SCOPE=(src tests tools package.json package-lock.json tsconfig.json tsconfig.base.json tsconfig.engine.json eslint.config.js vite.config.ts index.html)

changes=$(git status --porcelain -- "${SCOPE[@]}" 2>/dev/null)
[ -z "$changes" ] && exit 0

fingerprint=$(
  {
    git rev-parse HEAD
    echo "$changes"
    git diff HEAD -- "${SCOPE[@]}"
    git ls-files --others --exclude-standard -z -- "${SCOPE[@]}" | xargs -0 shasum 2>/dev/null
  } | shasum | cut -d' ' -f1
)

state=node_modules/.cache/check-on-stop
mkdir -p "$state"
[ "$(cat "$state/passed" 2>/dev/null)" = "$fingerprint" ] && exit 0
if [ "$(cat "$state/failed" 2>/dev/null)" = "$fingerprint" ]; then
  echo '{"systemMessage":"npm run check is still failing on the uncommitted changes. Claude was told once and stopped without changing the code."}'
  exit 0
fi

if output=$(npm run check 2>&1); then
  echo "$fingerprint" > "$state/passed"
  exit 0
fi

echo "$fingerprint" > "$state/failed"
{
  echo "npm run check failed on the uncommitted changes. Fix it before finishing, or say plainly why it can't be fixed here. Last lines:"
  echo "$output" | tail -60
} >&2
exit 2
