#!/usr/bin/env bash
# Self-check for rebuild-dev.sh against a throwaway repo.
# Run: .github/scripts/test-rebuild-dev.sh
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/rebuild-dev.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
git init -q --bare remote.git
git clone -q remote.git w 2>/dev/null; cd w
git config user.email t@t; git config user.name t
git checkout -q -b master; echo base > a; echo base > b; echo base > c; git add .; git commit -qm base
git push -q origin master
pr() { git checkout -q -B "p$1" master; echo "$3" > "$2"; git add "$2"; git commit -qm "pr$1"; git push -q origin "HEAD:refs/pull/$1/head"; }
pr 1 a one; pr 2 ab two; pr 3 a three; pr 4 c stale
pr 7 a seven; echo seven > c; git commit -qam c7; git push -q origin HEAD:refs/pull/7/head
# PR 5 is already in master: a no-op merge that must not claim PR 1's files
git push -q origin "master:refs/pull/5/head"
# PR 6 shares no history, so its merge fails without starting
git checkout -q --orphan p6; git rm -rqf .; echo x > z; git add z; git commit -qm pr6
git push -q origin "HEAD:refs/pull/6/head"
# master moves under PR 4, so it conflicts with master itself
git checkout -q master; echo moved > c; git commit -a -qm moved; git push -q origin master
rc=0; printf '1\n5\n2\n3\n4\n6\n7\n' | TARGET=dev REPORT=../report "$script" 2>/dev/null || rc=$?
[ "$rc" -eq 2 ] || { echo "FAIL: exit $rc, want 2"; exit 1; }
grep -q 'master + 3 PR(s): #1 #5 #2' ../report || { cat ../report; echo "FAIL: wrong includes"; exit 1; }
grep -q 'Left out #3 (conflicts with #1 on: a)' ../report || { cat ../report; echo "FAIL: wrong conflict"; exit 1; }
grep -q 'Left out #4 (conflicts with master on: c)' ../report || { cat ../report; echo "FAIL: master conflict"; exit 1; }
grep -q 'Left out #6 (merge failed' ../report || { cat ../report; echo "FAIL: unstarted merge"; exit 1; }
grep -q 'Left out #7 (conflicts with #1 master on: a c)' ../report || { cat ../report; echo "FAIL: mixed conflict"; exit 1; }
[ "$(cat a)$(cat ab)" = onetwo ] || { echo "FAIL: tree"; exit 1; }
echo ok
