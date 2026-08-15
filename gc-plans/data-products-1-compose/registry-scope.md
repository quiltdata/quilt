---
plan_slug: data-products-1-compose
phase: design-note
rig: quilt
bead: qu-ss1
convoy: c1-predicate-definition
status: blocked
created_at: 2026-08-14T00:00:00Z
updated_at: 2026-08-14T00:00:00Z
---

# The DataProduct server surface does not exist anywhere

The plan's remaining two thirds were filed as "resolver work in
`quiltdata/enterprise`" — the implied shape being that a DataProduct API exists
server-side and needs its predicate path filled in. That is wrong, and the
correction changes what the remaining beads are asking for.

There is **no DataProduct surface in either repo.** Not a stub, not a partial, not
an older spelling. The nine registry beads are not resolver work; they are a new
subsystem, and one thing they all depend on is not covered by any of them.

## What was checked, and how hard the negative is

`quiltdata/enterprise` at `6e7121dd` (master):

```
grep -rEia "data.?products?"        . --exclude-dir=.git   →  0
grep -rn  "dataProductSetDefinition" . --exclude-dir=.git   →  0
```

The first pattern is deliberately loose — it catches `DataProduct`,
`data_product`, `data-product`, `data product`, and the plural of each, in any
case. Zero. The repo has exactly one `.graphql` file
(`registry/quilt_server/graphql/schema.graphql`), and its `Mutation` type has 26
fields, none DataProduct-related.

`quiltdata/quilt` was checked separately and earlier: zero server-side hits
across `api/`, `lambdas/`, `s3-proxy/`, `py-shared/`, `quilt3_local/`, and there
is no `registry/` directory at all. The 35 `DataProduct` hits in that repo are
confined to `catalog/app/**` and `shared/graphql/schema.graphql` — client code
and a client-authored contract.

So both halves are negative, established independently. The contract at
`shared/graphql/schema.graphql:690-863` describes a server that was never built.

Provenance agrees: the schema block arrives in commit `a2a7ea73`, *"catalog: Data
Product browse (dx demo slice)"*, Thu Jul 2 2026 — 96 lines, schema only, no
resolver. It never merged to `dev` or `master`; it reached this branch through
`dx-dp-browse`.

## What this does to `qu-ss1`

`qu-ss1` carries its own instruction, A15: *"if the resolver for this mutation
lives in the private registry repo rather than here, do not guess — record the
finding and mark this bead blocked."* Its acceptance criteria close the loop:
*"If the resolver is not in this repo, the bead is marked blocked with the finding
recorded."*

That fires, and the actual finding is stronger than the one A15 anticipated. A15
imagined two locations and asked which. The answer is **neither**. `qu-ss1` says
"accept a predicate rule in `dataProductSetDefinition`" — there is no
`dataProductSetDefinition` to accept it into.

Blocked, finding recorded. This note is the record.

## The gap no bead covers: persistence

All nine registry beads assume a store that can hold a `DataProductDefinition`
and hand it back. None of them builds it.

- `qu-46w` resolves a predicate **that has already been stored**.
- `qu-ss1` accepts a predicate **into a mutation that would persist it**.
- `qu-ncy`, `qu-i89`, `qu-62t` operate on **members resolved from a stored
  definition**.
- `qu-dun`, `qu-48p` authorize and validate **definitions being written**.
- `qu-lk0` derives display names for **resolved members**.

There is no `DataProduct` model in `registry/quilt_server/models.py`, no table, no
migration, and no bead that creates one. This is a genuine hole in the task
decomposition, not a thing I could not find. It needs a bead before any of the
nine can land, and it is the first thing to build.

## What the registry *does* have, and what it does not

Three things are directly reusable, which is why this is a scope correction and
not a dead end.

**packages-search with `userMetaFilters` — exists and is exactly what `qu-46w`
needs.** `schema.graphql:660-666` declares
`searchPackages(buckets, searchString, filter, userMetaFilters, latestOnly)`,
bound at `graphql/search.py:180` to a `SearchHandler` over
`model/search/packages.py:216`. `userMetaFilters` compiles to an Elasticsearch
`has_parent` query against manifest metadata (`packages.py:227-239`). The
resolution primitive `qu-46w` specifies is already built.

**The result-union error pattern — exists, and every new mutation should follow
it.** `graphql/util.py:50` `GraphQLResult` carries an explicit typename;
`util.py:136` `InvalidInput` and `util.py:166` `OperationError` are the standard
members, both with `.from_exc`. `schema.graphql:756` already defines
`InsufficientPermissions`. `DataProductSetDefinitionResult = DataProduct |
InvalidInput | OperationError` is the shape the registry already speaks.

**Write-or-admin authorization — exists, so `qu-dun` is implementable today.**
`auth.py:1040` `bucket_is_writable_by` and `auth.py:1027`
`get_buckets_listable_by` (which has the admin bypass) give exactly the
disjunction `qu-dun` asks for. Its deny-as-not-found posture is the house style
already: `graphql/buckets.py:129` returns a filtered query rather than a boolean,
so an unreadable bucket is indistinguishable from a missing one.

What does **not** exist is the thing `qu-ncy` needs. See below.

## `qu-ncy` (P0) cannot be met as written, and the reason is structural

`qu-ncy` requires authorizing the consuming principal *"against every resolved
member and revision."* It warns, in its own text, against a realization that
*"authorized per member and served any revision would pass member-level tests
while violating the requirement."*

The registry has exactly one authorization grain: **the bucket.**

- One permission table, `models.py:623` `RolePolicyBucketPermission`, keyed on
  `bucket_name`.
- One enum, `const.py:67-69` `BucketPermissionEnum`, with two values: `READ`,
  `READ_WRITE`.
- Three entrypoints, all bucket-keyed: `auth.py:1004` `get_buckets_readable_by`,
  `:1027` `get_buckets_listable_by`, `:1040` `bucket_is_writable_by`.

There is no package-level and no revision-level ACL anywhere. Once a principal has
READ on a bucket, every package, every revision, and every manifest in it is
reachable. That is the product's model, not an oversight.

The consequence has to be stated precisely, because half of `qu-ncy` is fine:

- **Per-member authorization is implementable.** A data product's members can span
  buckets, so checking each resolved member's bucket is a real check that can
  really fail. This is the half that matters in practice, and it is the half that
  makes source-denial (`qu-i89`) meaningful.
- **Per-revision authorization is not enforceable by the ACL,** because no
  revision-grained permission exists to consult. Authorizing revision X and
  serving revision Y is equally permitted by every check available.

So the protection `qu-ncy` is reaching for cannot come from an authorization
check. It has to come from **identity discipline**: resolve once, carry the
resolved hash unchanged through every subsequent decision, serve exactly the
revision that was authorized. That is a code-structure property, verifiable by
construction and by test, and `qu-46w` already sets it up — its *"one resolution
per operation, reused for every result, disclosure, and authorization decision"*
clause is exactly this invariant.

This is a weaker promise than the bead's wording implies, and the gap is
security-relevant, so it is a **specification question for the operator, not a
judgement call for me.** Two options:

- **Accept the reduction.** `qu-ncy` becomes: authorize each member by bucket, and
  guarantee by construction that the served revision is the resolved one. Honest,
  implementable now, and testable. The bead's acceptance criteria need rewording
  to say so.
- **Build revision-grained authorization.** A new ACL grain in a product that has
  never had one. Large, and it changes the permission model for everything, not
  just data products.

I have not picked. Unlike `qu-ii4` — where one route was simply not executable
from this environment and the other was — both of these are executable, so the
choice is a real product decision about how strong a promise to make.

## Revised estimate of what remains

The earlier estimate said nine registry beads, *"well-specified; the client
contracts they must satisfy are already committed and tested, which should make
them fast."* The first clause holds. The last does not.

What actually has to be built, in order:

1. **Persistence** — model, table, migration. *No bead exists.* Blocks everything.
2. **Query + mutation surface** — `dataProduct`, `dataProducts`,
   `dataProductSetDefinition`, plus the ten types/inputs/unions at
   `shared/graphql/schema.graphql:690-863`. Partially `qu-ss1`, which is blocked.
3. `qu-46w` — resolution. The search primitive exists; the wiring does not.
4. `qu-ncy` — authorization, pending the decision above.
5. `qu-i89` — source-denial, the highest-value test surface in the plan.
6. `qu-62t`, `qu-dun`, `qu-48p`, `qu-lk0` — disclosure, authz, validation, naming.

`qu-m0w` was mis-filed in this bucket by an earlier summary of mine, including in
`run-summary.md`. Its files are `catalog/app/containers/DataProduct/packageItems.*`
and its verification is `npm test -- packageItems` — it is client work whose
premise ("resolver-supplied per-member revisions") depends on step 2 existing.

So: **one uncovered foundation bead, one greenfield API surface, then the nine.**
Not resolver infill.

## Bottom line

Nothing here is blocked on access any more — the enterprise rig is registered and
readable, and the reusable primitives are mapped with citations. It is blocked on
two things the operator owns: a **persistence bead that does not exist**, and the
**`qu-ncy` grain decision**. Both are cheap to answer and neither needs a
deployed build.

The client half of this plan is done, green, and pushed. The server half turns out
never to have been started.
