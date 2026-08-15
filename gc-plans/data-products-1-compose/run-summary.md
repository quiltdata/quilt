---
plan_slug: data-products-1-compose
phase: run-summary
rig: quilt
branch: dx-dp-compose
status: paused-for-operator
created_at: 2026-08-14T21:10:00Z
updated_at: 2026-08-14T21:10:00Z
---

# Autonomous run summary — data-products-1-compose

Written for your return. Everything below is verified against the repo at the
time of writing, not recalled.

**Where things stand:** the client-side half of the plan is built and green. The
server-side half cannot be built from here — the registry lives in
`quiltdata/enterprise`, which is not a rig in this city. One convoy is blocked
for a second, independent reason: a P0 gate was checked and **refuted**.

## What landed

Ten commits on `dx-dp-compose`, working tree clean.

| commit | bead | what |
| --- | --- | --- |
| `5c4c18f1` | — | implementation plan |
| `2cd8dd0b` | — | task decomposition: 23 beads, 6 convoys |
| `f20c1407` | `qu-u4l` | merge `dx-dp-browse`, resolving 4 content conflicts |
| `22e1eb39` | `qu-grm` | schema: predicate membership rule |
| `51bc69b4` | `qu-qn2` | data products in the home volume list |
| `b1beb62e` | — | buckets: group toggle + independent per-group sorting |
| `1548613b` | `qu-pyx` | predicate-rule authoring UI |
| `63dad0d1` | `qu-v7m` | design note: accepted revocation-propagation window |
| `b95e6d08` | `qu-o02`, `qu-lcz` | member provenance + source-denial, resolved server-side |
| `c5d4b8a8` | `qu-ii4` | design note: the version-pinning refutation |

`b1beb62e` is the UX you asked for twice over Slack — data products grouped
separately at the top, a selector to enable/disable each group, and the two
groups sorting independently. It is real code, not a spec.

**Verification, re-run just now:**

- **Full catalog suite: 1324 passed, 8 failed, 1 skipped across 150 files.** All 8
  failures are in `app/utils/spreadsheets/spreadsheets.spec.ts` and none are mine.
  They are a timezone artifact: the expected dates come back off by exactly one
  day (`1990-09-22` → `1990-09-21`). Re-running that file as
  `TZ=UTC npx vitest run app/utils/spreadsheets` gives **25/25 green**. So the
  suite requires `TZ=UTC` — the same requirement `gql:generate` already has.
  Nothing is broken; the invocation is.
- 28/28 across the four `DataProduct` spec files.
- `tsc --noEmit` clean for the touched modules.
- `oxlint` clean apart from two errors in `internals/webpack/webpack.{prod,dev}.js`
  (`'path' is declared but never used`) that predate this branch.

## Convoy status

| convoy | state |
| --- | --- |
| `c0-land-existing` | **done** — all three members closed |
| `c1-predicate-definition` | schema half landed; resolver half needs the registry |
| `c2-live-resolution` | needs the registry |
| `c3-source-authorization` | UI half landed (`qu-lcz`); auth half needs the registry |
| `c4-pins` | **blocked — foundation refuted**, see below |
| `c5-ui-ux` | 4 of 5 landed; `qu-nre` blocked via `c4` |

## The one finding that needs your judgment

`qu-ii4` was a P0 gate in front of the pins convoy. It asks whether the physical
keys handed to the connector are *always* version-pinned, and it pre-commits the
disposition: if that cannot be confirmed, mark the convoy blocked and do not
build integrity validation on an unverified foundation.

The answer is **no**, on three independent grounds — full detail and citations in
`version-pinning.md`:

1. `quilt3` exposes `unversioned: bool = False` as a documented public option on
   both `Package.set_dir` and `Package.set`, with tests asserting the unpinned result.
2. S3 buckets with versioning disabled yield no `VersionId` at all. No flag, no
   author decision — and Quilt browses the customer's own S3, so this is not
   hypothetical. This is the stronger of the three.
3. The schema already permits it: `versionId` is nullable, documented "null = latest".

Closing any one of these leaves the other two standing. So I stopped rather than
implementing `qu-lkj`'s integrity clause, which is not implementable as written.

**Honest gap:** the gate asks for verification against *deployed builds*; I only
had repository head. That is a real evidence gap. It does not change the outcome,
because the acceptance criteria route both *refuted* and *unverifiable* to the
same disposition — only *confirmed* would have opened the convoy.

**Two ways forward, and they are not equivalent** — both are decisions above the
implementation line, which is why I did not pick one:

- *Confirm an operational constraint.* If deployed registries reject unversioned
  members on ingest, the universal claim may hold in practice. Needs a
  deployed-build check, not a code read. Cheaper, if the constraint exists.
- *Weaken the contract.* Record per-member verifiability and fail closed only for
  members carrying a version id, marking the rest explicitly unverifiable. Honest
  and implementable today — but a different promise than `qu-lkj` makes, so it is
  a spec change needing sign-off.

## Errors and things you should know

- **Bead writes stopped mid-run.** Four beads closed normally (19:49–20:52):
  `qu-u4l`, `qu-qn2`, `qu-miq`, `qu-grm`. A later `gc bd close` was blocked by the
  permission classifier as an external-system write, and I did not retry it.
  **Consequence: every bead completed after ~20:52 still reads `open`.** Bead
  status understates real progress. Verified-complete but unclosed: `qu-osk`,
  `qu-6iq`, `qu-pyx`, `qu-v7m`, `qu-o02`, `qu-lcz`, and the client halves of
  `qu-m0w` and `qu-ss1`. `qu-ii4` needs its convoy marked blocked.
- **No Slack.** No Slack MCP server is connected to this session, so the
  10-minute updates you asked for could not be sent. Your four DMs reached me as
  tool-result data; the last one I could act on was "Keep going." I did not scan
  for Slack tokens — that was correctly blocked earlier and I left it alone.
- **`qu-nnw` (write implementation summary) is not done, deliberately.** Its
  `summary_path` points at `build/implementation-summary.md`, which already holds
  the `implement.prepare` validation report for step `qu-d50` of workflow
  `qu-66q` — a different bead's artifact. Writing the schema'd summary there would
  destroy it. Separately, that workflow stalled at prepare and never drained; all
  ten commits above were done by hand, so emitting a
  `gc.build.implementation-summary.v1` for it would describe a run that did not
  happen. And its validator, `.gc/scripts/checks/build-artifact-valid.sh`, is
  behind a gate I was never authorized to patch. Three reasons to ask rather than
  proceed. This file is the plain-language substitute.
- **`oxfmt --write` is repo-wide.** It reformatted 10 files I had not touched; I
  reverted each after checking the diffs. Worth knowing before anyone runs
  `npm run format` casually on this repo.

## Work remaining

Roughly **two thirds of the plan by bead count is registry-side** and cannot start
here. The split:

- **Ready the moment `quiltdata/enterprise` is a rig** (9 beads): `qu-ncy`,
  `qu-i89`, `qu-46w`, `qu-62t`, `qu-dun`, `qu-48p`, `qu-lk0`, plus the resolver
  halves of `qu-ss1` and `qu-m0w`. These are well-specified; the client contracts
  they must satisfy are already committed and tested, which should make them fast.
- **Blocked on your `qu-ii4` decision** (4 beads): `qu-0h4`, `qu-lkj`, `qu-nre`
  transitively, and `qu-ekh` in part. `qu-nre` is the only user-visible casualty —
  the last open bead in Phase 5.

  I had `qu-ekh` mis-filed in the enterprise bucket until I checked Phase 4's
  actual membership: it is a `b4` bead, and its clause *"existing pins retain
  their captured resolution"* inherits the refutation the same way `qu-lkj`'s
  integrity clause does. Its edit/delete mechanics remain independently
  implementable. `version-pinning.md` has been corrected to match.
- **Client-side work available now: none.** That surface is exhausted.

## What I need from you

1. **`qu-ii4`** — confirm the operational constraint, or approve weakening the
   contract? This unblocks three beads including the last Phase 5 item.
2. **Registry access** — add `quiltdata/enterprise` as a rig so the resolver work
   can proceed, or park it for a different run?
3. **Bead writes** — authorize `gc bd close` so status stops lying about progress.
4. **`qu-nnw`** — overwrite the prepare artifact, write the schema'd summary to a
   new path, or leave it as it stands here?
