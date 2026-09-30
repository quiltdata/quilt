#!/usr/bin/env bash
# Rebuild $TARGET as master plus each PR number given on stdin, in order.
# A PR that conflicts is left out and reported; the rest still land.
# Writes the result to $TARGET locally; the caller decides whether to push.
set -euo pipefail

: "${TARGET:?}"
REMOTE="${REMOTE:-origin}"
REPORT="${REPORT:-/dev/stdout}"

git fetch --quiet "$REMOTE" master
git checkout --quiet -B "$TARGET" "$REMOTE/master"

# pr:file lines for every PR merged so far, to name who a conflict is with.
touched="$(mktemp)"
included=() skipped=()

while read -r pr; do
  [ -n "$pr" ] || continue
  git fetch --quiet "$REMOTE" "pull/$pr/head"
  before="$(git rev-parse HEAD)"
  if git merge --quiet --no-ff --no-edit -m "Merge #$pr into rebuilt $TARGET" FETCH_HEAD >/dev/null; then
    git diff --name-only "$before" HEAD | sed "s|^|$pr:|" >> "$touched"
    included+=("$pr")
  elif git rev-parse -q --verify MERGE_HEAD >/dev/null; then
    files="$(git diff --name-only --diff-filter=U)"
    git merge --abort
    # A conflicted file no earlier PR touched conflicts with master.
    with="$(printf '%s\n' "$files" | while read -r f; do
      o="$(awk -v f="$f" '{ i = index($0, ":") } substr($0, i + 1) == f { print "#" substr($0, 1, i - 1) }' "$touched")"
      echo "${o:-master}"
    done | sort -u | paste -sd' ' -)"
    skipped+=("#$pr (conflicts with $with on: $(printf '%s' "$files" | paste -sd' ' -))")
  else
    git reset --hard --quiet
    skipped+=("#$pr (merge failed; see the log)")
  fi
done

{
  echo "Rebuilt \`$TARGET\` = master + ${#included[@]} PR(s): ${included[*]+"${included[*]/#/#}"}"
  for s in "${skipped[@]+"${skipped[@]}"}"; do echo "- Left out $s"; done
} > "$REPORT"
# 2, not 1, so the caller can tell PRs left out from the script failing.
[ "${#skipped[@]}" -eq 0 ] || exit 2
