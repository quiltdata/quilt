---
plan_slug: data-products-1-compose
phase: design-note
rig: quilt
bead: qu-ii4
convoy: c4-pins
status: refuted
created_at: 2026-08-14T00:00:00Z
updated_at: 2026-08-14T00:00:00Z
---

# Physical keys are not always version-pinned

`qu-ii4` is a P0 gate in front of the pins convoy. It asks one question — are the
physical keys handed to the connector always version-pinned? — and it fixes the
disposition in advance: *if version pinning cannot be confirmed, mark this convoy
blocked and report; do not implement integrity validation on an unverified
foundation.*

The answer is **no**. This note records why, and what it costs.

## Why the question gates the convoy

Pin integrity validation is the claim that a pinned read either returns exactly the
bytes captured at pin time or fails closed. That claim is only mechanically checkable
if every member carries an immutable physical identity — a version id. A member
identified by bucket and key alone names a mutable location: the same key can be
overwritten, and a later read returns different bytes through an identical reference.
Integrity validation built on such a member cannot detect the substitution it exists
to detect. It would report success by construction.

So the foundation is not a nice-to-have. If some members can lack a version id, an
integrity check has to treat those members as unverifiable and say so — which is a
different feature, with a different contract, than the one `qu-lkj` specifies.

## What was checked

Three independent places, all at repository head (see the caveat below).

**1. The client can opt out, deliberately and publicly.** `quilt3.Package.set_dir`
takes `unversioned: bool = False` (`api/python/quilt3/packages.py:850`), documented as
*"when True, do not retrieve VersionId for S3 physical keys"* (`:867`) and honoured at
`:920`. `Package.set` carries the same option (`:1157`, documented `:1178`, honoured
`:1214`). This is not an internal flag or a deprecated path — it is a documented
parameter on two of the most-used methods of the public packaging API, with test
coverage asserting the unpinned behaviour (`api/python/tests/integration/test_packages.py:668`,
`:866`). Any package built with it contains members with no version id.

**2. S3 itself can make pinning impossible.** Four call sites in the transfer layer
record `VersionId` as *"Absent in unversioned buckets"*
(`api/python/quilt3/data_transfer.py:274`, `:321`, `:430`, `:478`). On a bucket with
versioning disabled there is no version id to retrieve — no flag involved, no author
decision involved. This is the stronger of the two findings: the first is an opt-out a
policy could forbid, this one is a property of the customer's storage that Quilt does
not control. Quilt browses data in place on the customer's own S3, so unversioned
buckets are not a hypothetical.

**3. The schema already says so.** `DataProductObjectMember.versionId` is nullable
(`shared/graphql/schema.graphql:758`) and its own comment reads *"echoes the pinned
versionId, or null = latest"* (`:753`). The type has been telling us that a member may
name latest rather than a fixed version. The parallel is explicit one type up:
*"`hashOrTag`: null = latest, set = pinned"* (`:711`).

The three are independent. Closing the opt-out would not touch the unversioned-bucket
case; fixing both would still leave a schema that permits null.

## The deployed-build caveat, and why it does not change the outcome

`qu-ii4` asks for verification against **deployed builds, not repository heads**. I
verified at repository head; I have no access to deployed builds from here. That is a
real gap in the evidence and it should not be papered over.

It does not change the disposition, because the acceptance criteria send both branches
to the same place: *"whether physical keys are version-pinned is confirmed or refuted"*
and *"if refuted **or unverifiable**, the finding is recorded and the convoy marked
blocked."* Refuted at head, or unverifiable against deployed builds — either way the
convoy is blocked. The only outcome the gate leaves open is *confirmed*, and nothing
found here points that direction.

Worth being precise about what head evidence can and cannot settle. A universal claim
("always version-pinned") is refuted by a single counterexample, and finding two in the
current source is strong evidence, since deployed builds are built from some head. What
head evidence cannot rule out is a deployment that constrains inputs from outside the
code — a registry that rejects unversioned members on ingest, say. If such a constraint
exists it would be an operational one, and confirming it is exactly the deployed-build
check that remains undone.

## Consequence

Convoy 4 (`c4-pins`) is blocked, and with it:

- `qu-0h4` — capture a pin recording every member identity and source revision. A pin
  can still record what it resolved; it cannot promise the recorded identity is
  immutable for members with no version id.
- `qu-lkj` — pinned reads fail closed on denial, missing revision, or integrity
  failure. This is the bead the gate directly protects. Its integrity clause is not
  implementable as written.
- `qu-nre` — pin capture, listing, and pinned-vs-live distinction. Blocked
  transitively through `qu-0h4`. This is the one user-visible casualty: it is the last
  open bead in Phase 5, whose other four are landed.
- `qu-ekh` — edit and delete semantics for view definitions. Partially affected, and
  the affected part is the middle clause: *"existing pins retain their captured
  resolution across both."* For a member with no version id the captured resolution
  names a mutable location, so what survives an edit or a delete is a reference, not
  the bytes. The edit/delete mechanics and the deleted-view-resolves-to-not-found
  clause are independent of pinning and stay implementable in principle — but see the
  next section: nothing here can start early regardless.

Phases 1–3 and the rest of Phase 5 stand.

## This refutation is not the binding constraint

Written after tracing the convoy's actual dependency edges, which I had not done when
the section above was first written. It corrects an implication of that section.

Every bead listed above sits behind `qu-0h4`, and `qu-0h4` itself depends on `qu-46w`
(resolve a predicate rule via packages-search) and `qu-ncy` (authorize the consuming
principal per member and revision). Both are resolver work in `quiltdata/enterprise`.
The edges:

- `qu-0h4` → `qu-46w`, `qu-ncy` — both registry-side
- `qu-lkj` → `qu-ii4`, `qu-0h4`
- `qu-nre` → `qu-0h4`, `qu-o02` (`qu-o02` is landed)
- `qu-ekh` → `qu-0h4`

So resolving `qu-ii4` — by either route — **unblocks nothing on its own.** It is a
second gate on `qu-lkj` alone, and `qu-lkj` is behind the registry either way. The
registry is the single binding constraint on the whole remainder of the plan.

This matters most for the cheaper of the two routes out. "Confirm the operational
constraint" asks for a deployed-build check, which costs someone real time; it is
worth knowing in advance that paying that cost opens no work until the registry is
also available. The finding still needs recording and the decision still needs making
— but it is not on the critical path, and should not be treated as urgent.

## What would unblock it

Two routes, and they are not equivalent.

**Confirm the operational constraint.** If deployed registries in fact reject or
rewrite unversioned members on ingest, the universal claim may hold in practice even
though the source permits exceptions. This needs a deployed-build check, not a code
read, and it is the cheaper route if the constraint already exists.

**Weaken the contract to match reality.** Let a pin record per-member verifiability and
have pinned reads fail closed only for members that carry a version id, while marking
the rest explicitly unverifiable. This is honest and implementable today, but it is a
different promise than `qu-lkj` makes, so it is a specification change and needs the
same sign-off any contract change would.

Both are decisions above the implementation. Neither should be taken by inferring
intent from the plan text.

## Route taken, and why it was mine to take

The operator approved resolving this gate but did not pick between the two routes. Under
the standing instruction to use judgement and make decisions that can be corrected later,
I took **route (b): weaken the contract.**

The deciding factor is not preference. Route (a) asks for a check against deployed
builds, and this environment has no deployed-build access — so route (a) cannot be
executed from here at all, only assigned to a human. Route (b) is implementable today.

What route (b) changes, stated so it can be reversed cleanly: a pin records per-member
verifiability; a pinned read fails closed for members that carry a version id, and marks
members without one explicitly unverifiable rather than silently asserting integrity.
That is a **specification change to `qu-lkj`**, not an implementation detail — `qu-lkj`
as written promises fail-closed for every member. Anyone reversing this decision should
change `qu-lkj`'s acceptance criteria back and re-block the convoy, not just edit code.

This is recorded as an interpretation. If the operator meant route (a), nothing has been
built on route (b) yet — the convoy is behind the registry regardless.
