#!/usr/bin/env bash
# Rebuild $TARGET as master plus every labelled PR described on stdin.
# Input: one open PR per line, tab-separated: number, head branch, base branch,
# and 1 if labelled dev-preview (0 otherwise). Unlabelled PRs only serve as links
# in a stack: a labelled PR may be based on another open PR's branch, as long as
# that chain reaches master; its commits then carry the PRs below it.
# A PR that conflicts or whose stack is broken is left out and reported, both in
# the report and as `number<TAB>head sha<TAB>reason` lines in $SKIPPED; the rest
# still land.
# Writes the result to $TARGET locally; the caller decides whether to push.
set -euo pipefail

: "${TARGET:?}"
REMOTE="${REMOTE:-origin}"
REPORT="${REPORT:-/dev/stdout}"
SKIPPED="${SKIPPED:-/dev/null}"

git fetch --quiet "$REMOTE" master
git checkout --quiet -B "$TARGET" "$REMOTE/master"

# pr:file lines for every PR merged so far, to name who a conflict is with.
touched="$(mktemp)"; prs="$(mktemp)"; trap 'rm -f "$touched" "$prs"' EXIT
included=() skipped=()
: > "$SKIPPED"
skip() { skipped+=("#$1 ($2)"); printf '%s\t%s\t%s\n' "$1" "$(git rev-parse FETCH_HEAD)" "$2" >> "$SKIPPED"; }

cat > "$prs"
# Each labelled PR's depth in its stack (0 = based on master), `cycle`, or the
# branch the chain breaks at. Applied shallowest first, so a stack lands bottom-up.
order="$(awk -F'\t' '
  # Two PRs from one branch (the old dev + master pair): the one on master is the link.
  { if (!($2 in head) || $3 == "master") head[$2] = $1; base[$1] = $3; lab[$1] = $4 }
  END {
    for (pr in lab) if (lab[pr] == 1) {
      d = 0; b = base[pr]
      while (b != "master" && (b in head) && d < 50) { b = base[head[b]]; d++ }
      print pr "\t" (b == "master" ? d : (b in head) ? "cycle" : "broken:" b)
    }
  }' "$prs" | sort -t$'\t' -k2,2n -k1,1n)"

while IFS=$'\t' read -r pr depth; do
  [ -n "$pr" ] || continue
  git fetch --quiet "$REMOTE" "pull/$pr/head"
  case "$depth" in
    broken:*)
      skip "$pr" "stacked on \`${depth#broken:}\`, which is not master or an open PR's branch; retarget this PR to master if that branch is long-lived, or rebase it onto master if the PR below it merged"
      continue ;;
    cycle)
      skip "$pr" "its stack of PRs never reaches master (a loop, or more than 50 deep); retarget one of them to master"
      continue ;;
  esac
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
    hint="stack it on the overlapping PR's branch, or wait for that PR to merge"
    [ "$with" != master ] || hint="rebase onto master; if the PR below it just merged, its commits are now on master"
    skip "$pr" "conflicts with $with on: $(printf '%s' "$files" | paste -sd' ' -) — $hint"
  else
    git reset --hard --quiet
    skip "$pr" "merge failed; see the rebuild log"
  fi
done <<< "$order"

{
  echo "Rebuilt \`$TARGET\` = master + ${#included[@]} PR(s): ${included[*]+"${included[*]/#/#}"}"
  for s in "${skipped[@]+"${skipped[@]}"}"; do echo "- Left out $s"; done
} > "$REPORT"
# 2, not 1, so the caller can tell PRs left out from the script failing.
[ "${#skipped[@]}" -eq 0 ] || exit 2
