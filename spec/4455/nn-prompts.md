# Decomposition

1. review PR to see what changed
2. Use the spec/4455/ to write an atomic decomposition of the PR
3. Number specs.
   1. Specify a branch numbering scheme
   2. Use 4455-toolbar
4. Create branches from master, then cherry-pick files from
   add-files-to-bucket
    1. Use a follow-on commit if you need manual tweaks to support the
       decomposition
    2. Do one branch at a time (create, PR, review tests, fix), but write
       a TODO to ensure you do that for all the branches in the correct
       order (and with the proper PR dependencies)
    3. At the very end, review all the specs and identify gaps (but do
       not fix)
5. Go back and fix PRs to depend on the prior one (not all on master)
    1. make 01 depend on 00
6. Starting with 00, go through each PR in turm to:
    1. Update from its prior
    2. Address review comments
    3. Fix linting errors *as reported* by PR (MANUALLY: DO NOT trust
       local linter)
    4. Fix any other error
    5. Push, and RESOLVE any outdate comments (hopefully fixed by (2))
