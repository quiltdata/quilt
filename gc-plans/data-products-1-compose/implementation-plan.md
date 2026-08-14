---
plan_slug: data-products-1-compose
phase: implementation-plan
rig: quilt
rig_root: /Users/simonkohnstamm/simon-city/rigs/quilt
artifact_root: /Users/simonkohnstamm/simon-city/city/.gc/worktrees/quilt/dx-dp-compose/gc-plans
requirements_file: /Users/simonkohnstamm/simon-city/city/.gc/worktrees/quilt-specs/main/changes/data-products-1-compose-r2/requirements.md
status: draft
created_at: 2026-08-14T19:10:00Z
updated_at: 2026-08-14T19:10:00Z
---

# Implementation Plan: Compose a live view over scattered data

## Summary

Turn the existing Data Product surface from a **fixed manifest** (two explicit lists of
objects and packages) into a **predicate-defined membership rule** resolved live at read
time, and build the authorization, pinning, and UI layers the requirements contract.

The existing work on `origin/dx-dp-browse` already established the right seam: a
`DataProductDefinition` (stored, echoed verbatim) versus `DataProductMembers`
(dereferenced, scoped to the caller's readable buckets). This plan keeps that split and
replaces only the *definition* side with a predicate, so `members` becomes the resolution
output the requirements describe.

Branch: `dx-dp-compose`, cut from `origin/dev` at `686eaa5e`.

## Assumptions

The requirements artifact is `status: questions` with 15 operator-owned open questions.
Each is answered here as a **labeled, overturnable assumption**. Overturning any single
one should touch only the beads that cite it.

| ID | Question | Decision | Cost to overturn |
|---|---|---|---|
| **A1** | `q-membership-expression-space` — predicate vocabulary | Reuse `PackageUserMetaPredicate` (already has `keyword`/`text`/`number`/`datetime`/`boolean` + facet discovery) plus a package-name pattern and an entry-path pattern. **Package-level tags do not exist** (`tags` is bucket-only; `SearchHitPackage.tags` is `TODO: currently not provided`), so "tagged items" is realized as a `keyword` predicate over a userMeta path. | **High** — this is the load-bearing choice. If a first-class package tag lands, the predicate type gains a variant; resolution and UI both change. |
| **A2** | (design) definition shape | `DataProductDefinition` becomes a union: `FixedManifest` (existing `objects`/`packages` lists) **or** `PredicateRule`. Backward compatible — `dx-dp-browse` data keeps working. | Low — additive. |
| **A3** | `q-unpinned-revision-selection` | Unpinned reads resolve each member at **latest revision at resolution time**. | Low — single resolver function. |
| **A4** | `q-anchor-slice-scope` | Treat this story as **one shippable slice**, contract it as written. Siblings stay out of scope per `oos-sibling-slices`. | Medium — if ruled an anchor, scope narrows and some beads drop. |
| **A5** | (design) `virtualName` for predicate members | Predicate-derived members have no authored `virtualName`. Derive deterministically as `<bucket>/<package-name>/<logical-key>`, collision-suffixed. | Low — one naming function. |
| **A6** | `q-catalog-surface` | v1 surfaces: **catalog UI + GraphQL**. Tabular-query consumption is **deferred** — `cf-connector-pairing-pinning` records that the tabulator connector and registry heads do not pair and version-pinning is unverified, so certifying `ac-cross-source-result` there is not yet possible. Metadata/export surfaces out of v1. | Medium — deferring tabular means `us-query-one-interface` is not satisfied in v1. |
| **A7** | `q-view-name-collision` | A view name must not collide with an existing package name in the same bucket; definition is rejected with a distinct class. Resolution prefers package on ambiguity. | Low. |
| **A8** | `q-file-unit-result-shape` | File-unit consumption returns member records (bucket, package, revision, logical key, size) plus byte access through the existing package-entry path, addressed by `virtualName`. | Medium. |
| **A9** | `q-authoring-denial-arm` | Unauthorized definition attempts return not-found, matching the standing `invariant-config-authz` posture (unlistable bucket appears not to exist) rather than a permission error that leaks namespace existence. | Low. |
| **A10** | `q-authoring-authority-set` | Write **or** admin authority over the target bucket/namespace authorizes definition, matching `invariant-config-authz`'s disjunction. | Low. |
| **A11** | `q-authoring-surface` | Definitions authored through the catalog UI and GraphQL mutation (extend existing `dataProductSetDefinition`). | Low. |
| **A12** | `q-revocation-staleness-bound` | Accept the standing credential-TTL and token-lifetime windows already recorded in `invariant-iam-enforces` and `invariant-jwt-irrevocable`; do not build a denylist. Document the window. | Medium — a hard no-stale-authority ruling would require new machinery. |
| **A13** | `q-definition-lifecycle` | Definitions are editable and deletable. Existing pins retain their captured resolution (already required by `br-version-pin`). Unpinned reference to a deleted view resolves to not-found. | Low. |
| **A14** | `q-resolution-edge-arms` | Zero-member resolution succeeds and returns empty. Schema-mismatched members and unservable entry kinds are rejected per-operation with a distinct class. | Low. |
| **A15** | (scope) backend location | Resolver work lands in this repo where the schema lives. Anything requiring the private registry backend is filed as a **blocked** bead rather than guessed at. | — |

## Current System

Verified by reading the repository, not inferred.

**The existing Data Product surface lives entirely on `origin/dx-dp-browse` (`b71f4dd9`).**
No other remote branch contains it. It is **frontend plus schema only** — a `git grep` for
any DP identifier outside `catalog/` returns exactly one file, `shared/graphql/schema.graphql`.
There are **no resolvers** for `dataProducts`, `dataProduct`,
`dataProductCreate`, `dataProductSetDefinition`, or `dataProductSetOwnContent` anywhere in
this repo.

Schema contract (`shared/graphql/schema.graphql`):

```graphql
type DataProductDefinition {
  objects: [DataProductObjectEntry!]!
  packages: [DataProductPackageEntry!]!
}

type DataProductPackageEntry {
  virtualName: String!
  bucket: String!
  name: String!
  hashOrTag: String       # null = latest, set = pinned
}

type DataProduct {
  id: ID!
  name: String!
  ownerRole: Role!
  definition: DataProductDefinition!   # stored manifest, echoed verbatim
  members: DataProductMembers!         # dereferenced, readable-scoped
}
```

Frontend, all under `catalog/app/containers/DataProduct/`:
`DataProduct.tsx`, `index.ts`, `packageItems.ts`, `gql/DataProduct.graphql`.
A DP renders as a **virtual bucket** with Overview / Objects / Packages tabs, integrated
into the landing volume list via `catalog/app/website/pages/Landing/Buckets/Buckets.jsx`
and `catalog/app/website/components/BucketGrid/`.

Gated behind an admin feature flag, default off:
`FeatureFlag = 'beta' | 'dataProducts'` in
`catalog/app/containers/Admin/Settings/Settings.tsx:19`, toggle at `:337`,
`dataProducts?: boolean` in `catalog/app/utils/CatalogSettings.tsx:33`.

**A client-side limitation this plan fixes.** GraphQL has no per-list-item arguments, so
the client cannot request per-member pinned revisions. `packageItems.ts` dereferences
*latest* and then discards it when it does not match the pin:

```ts
export function effectiveRevision(member: PackageMember): MemberRevision | null {
  const latest = member.package?.revision
  if (!latest) return null
  const pin = member.hashOrTag
  if (!pin) return latest
  return latest.hash === pin || (pin.length >= 6 && latest.hash.startsWith(pin))
    ? latest : null
}
```

When this returns null, size / entries / comment / workflow / meta all render as unknown.
Resolving members **server-side** removes the limitation — a resolver can pin per member.

**Predicate substrate that already exists** (`shared/graphql/schema.graphql`):

```graphql
input PackageUserMetaPredicate {
  path: String!
  datetime: DatetimeSearchPredicate
  number: NumberSearchPredicate
  text: TextSearchPredicate
  keyword: KeywordSearchPredicate    # { terms: [String!], wildcard: String }
  boolean: BooleanSearchPredicate
}
```

Consumed via `userMetaFilters` on the packages-search filter, with facet discovery through
`PackageUserMetaFacet` / `filteredUserMetaFacets(path:, type:)`. This is the vocabulary the
search UI already renders facets for — reusing it means the DP definition UI can reuse
those facet components (**A1**).

**Branch state.** `dx-dp-browse` is *not* an ancestor of `dev`. Merging conflicts on 8
files, 4 of them modify/delete where `dev` deleted files that branch edits:

```
CONFLICT (content):       .github/workflows/deploy-catalog.yaml
CONFLICT (content):       catalog/app/containers/Search/List/Hit.spec.tsx
CONFLICT (content):       catalog/app/containers/Search/Table/Table.tsx
CONFLICT (content):       catalog/app/containers/Sidebar/Sidebar.tsx
CONFLICT (modify/delete): catalog/app/website/components/BucketGrid/BucketGrid.tsx
CONFLICT (modify/delete): catalog/app/website/components/BucketGrid/BucketList.tsx
CONFLICT (modify/delete): catalog/app/website/pages/Landing/Buckets/Buckets.jsx
CONFLICT (modify/delete): catalog/app/website/pages/Landing/Buckets/Buckets.spec.tsx
```

The modify/delete set means the landing-page integration must be **re-done** against
whatever replaced BucketGrid on `dev`, not merged.

## Proposed Implementation

### Phase 0 — Land the existing DP surface on `dev`

Port `dx-dp-browse` onto `dx-dp-compose`. Content conflicts resolved in favour of `dev`
plus the DP additions; the four modify/delete files re-implemented against `dev`'s current
landing architecture. Ends with the existing fixed-manifest DP surface working on `dev`,
behind its existing flag, with catalog typecheck and tests green.

This is a prerequisite for every later phase and is the only phase whose value does not
depend on any assumption above.

### Phase 1 — Predicate definition (schema + authoring)

Extend `DataProductDefinition` to the union in **A2**:

```graphql
type PredicateRule {
  packageNamePattern: String        # e.g. "cellarity/de-run-*"
  entryPathPattern: String          # e.g. "results/de.h5ad#obs"
  userMetaFilters: [PackageUserMetaPredicate!]
}
```

Mutation input mirrors it. Authoring authorized per **A10** (write or admin on the target
bucket/namespace); denial per **A9** (not-found, no namespace disclosure). Name collision
rejected per **A7**. Files: `shared/graphql/schema.graphql`, the
`DataProduct/gql/` documents, and regenerated `*.generated.ts`.

**Codegen note:** only `gql:generate` validates queries; run it and expect generated-file
churn.

### Phase 2 — Live resolution (resolver)

Resolve `members` from a `PredicateRule` by querying the existing packages-search path with
`userMetaFilters`, then filtering entries by `entryPathPattern`. Per **A3**, unpinned
members resolve at latest-at-resolution. Each resolved member carries bucket, package name,
**source revision**, logical key, and derived `virtualName` (**A5**) — satisfying
`br-member-provenance`.

One resolution per operation, reused for every result, disclosure, and authorization
decision in that operation (`br-live-resolution`). Zero members is a success returning
empty (**A14**).

Pin per member **server-side**, which removes the `effectiveRevision` fallback and makes
size/entries/comment/meta reliable.

### Phase 3 — Source-side authorization

Every view-derived operation authorizes the **consuming** principal against each resolved
member and revision — never the author's authority, never a cached decision
(`br-source-authorization`). Authorization is **all-or-nothing**: if any resolved member is
denied, return no content, rows, schema, provenance, paths, revisions, counts, or previews,
and apply this **before** emitting output. Rejection class `source-denied`.

Revocation windows documented, not closed, per **A12**.

### Phase 4 — Pins

`dataProductPinCreate` captures the canonical identity and immutable source revision of
every resolved member. A pin conveys no authority: every pinned read re-authorizes against
all captured members. Fail closed if authorization fails, a captured revision is
unavailable, or content fails integrity validation — never substitute a newer revision,
never omit a member, never serve under stale authority (`br-version-pin`).

Integrity validation depends on version-pinned physical keys, which
`cf-connector-pairing-pinning` records as **unverified**. That verification is a bead in
this phase and may block it.

### Phase 5 — UI / UX

1. **Definition authoring** — predicate builder reusing the existing userMeta facet
   components, with a live preview of resolved members before save.
2. **Member browse** — extend the existing Objects/Packages tabs to show per-member
   provenance (source package, revision, path) per `br-member-provenance`.
3. **Pin affordance** — capture a pin, list pins, open a pinned view; pinned state visibly
   distinct from live.
4. **Denial states** — `source-denied` renders as an all-or-nothing refusal with no partial
   listing and no leaked member names.
5. **Landing integration** — re-do the volume-list integration against `dev`'s current
   architecture (the modify/delete conflicts from Phase 0).

## Testing

- **Unit:** predicate → member-set resolution, `virtualName` derivation and collision
  suffixing, revision selection (**A3**), pin capture/compare, `effectiveRevision`
  replacement.
- **Authorization:** all-or-nothing refusal — assert **zero** disclosure on denial
  (no schema, count, path, revision, or preview). This is the highest-value test in the plan
  because partial disclosure is the failure mode the requirements care most about.
- **Example-driven:** the requirements' Example Mapping section is directly executable.
  `ex-obs-across-runs` asserts `[A, 2.0, 3], [B, -1.0, 3]` — values no proper subset of
  resolved members reproduces, so it discriminates membership. Also `ex-pin-survives-new-run`,
  `ex-pin-fails-closed`, `ex-live-member-removal`, `ex-source-denied-member`,
  `ex-definition-and-read-copy-free`.
- **Frontend:** existing `packageItems.spec.ts` / `packagesLinks.spec.tsx` patterns.
- **Copy-free:** `ac-no-new-objects` needs an enumerable inventory boundary, which
  `cf-copy-free-inventory-boundary` says is undefined. Filed as a bead, not asserted.

## Rollout

Ships behind the existing `dataProducts` admin flag, default off. Predicate definitions are
additive to fixed manifests (**A2**), so existing DPs are unaffected. No migration.

## Open Questions

Routed, not swallowed:

1. **Registry-side work** — resolution and source authorization may need registry backend
   changes outside this repo. Per **A15** these are filed as blocked beads rather than
   guessed at.
2. **Tabular consumption** — deferred per **A6**, so `us-query-one-interface` is unsatisfied
   in v1. Needs the `cf-connector-pairing-pinning` verification first.
3. **First-class package tags** — if a real tag mechanism is planned, **A1** should be
   revisited before Phase 1 lands.
4. **`cf-tabular-auth-elevation`** — the tabulator open-query elevation executes with
   authority the consuming principal does not hold, which `br-source-authorization` forbids.
   Deferring tabular sidesteps it for v1; it must be resolved before tabular ships.
