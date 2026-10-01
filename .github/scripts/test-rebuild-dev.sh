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
# Stacks. #11 sits on unlabelled #10 and overwrites its file; #13 sits on
# labelled #14, whose higher number must not reorder them; #15's base is gone.
git checkout -q -B s10 master; echo ten > d; git add d; git commit -qm pr10; git push -q origin HEAD:refs/pull/10/head
git checkout -q -B s11; echo eleven > d; git commit -qam pr11; git push -q origin HEAD:refs/pull/11/head
git checkout -q -B s14 master; echo fourteen > e; git add e; git commit -qm pr14; git push -q origin HEAD:refs/pull/14/head
git checkout -q -B s13; echo thirteen > e; git commit -qam pr13; git push -q origin HEAD:refs/pull/13/head
git checkout -q -B s15 master; echo fifteen > f; git add f; git commit -qm pr15; git push -q origin HEAD:refs/pull/15/head
# master moves under PR 4, so it conflicts with master itself
git checkout -q master; echo moved > c; git commit -a -qm moved; git push -q origin master
rc=0
printf '%s\t%s\t%s\t%s\n' 1 p1 master 1  5 p5 master 1  2 p2 master 1  3 p3 master 1 \
  4 p4 master 1  6 p6 master 1  7 p7 master 1  9 p9 master 0 \
  10 s10 master 0  11 s11 s10 1  13 s13 s14 1  14 s14 master 1  15 s15 gone 1 \
  | TARGET=dev REPORT=../report SKIPPED=../skipped "$script" 2>/dev/null || rc=$?
[ "$rc" -eq 2 ] || { echo "FAIL: exit $rc, want 2"; exit 1; }
grep -q 'master + 6 PR(s): #1 #2 #5 #14 #11 #13' ../report || { cat ../report; echo "FAIL: wrong includes"; exit 1; }
grep -q 'Left out #3 (conflicts with #1 on: a — stack it' ../report || { cat ../report; echo "FAIL: wrong conflict"; exit 1; }
grep -q 'Left out #4 (conflicts with master on: c — rebase onto master' ../report || { cat ../report; echo "FAIL: master conflict"; exit 1; }
grep -q 'Left out #6 (merge failed' ../report || { cat ../report; echo "FAIL: unstarted merge"; exit 1; }
grep -q 'Left out #7 (conflicts with #1 master on: a c' ../report || { cat ../report; echo "FAIL: mixed conflict"; exit 1; }
grep -q 'Left out #15 (stacked on `gone`' ../report || { cat ../report; echo "FAIL: broken stack"; exit 1; }
[ "$(cut -f1 ../skipped | paste -sd' ' -)" = "3 4 6 7 15" ] || { cat ../skipped; echo "FAIL: skipped list"; exit 1; }
[ "$(cat a)$(cat ab)$(cat d)$(cat e)" = onetwoeleventhirteen ] || { echo "FAIL: tree"; exit 1; }
echo ok
