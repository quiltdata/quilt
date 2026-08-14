---
plan_slug: data-products-1-compose
phase: tasks
rig: quilt
rig_root: /Users/simonkohnstamm/simon-city/rigs/quilt
artifact_root: /Users/simonkohnstamm/simon-city/city/.gc/worktrees/quilt/dx-dp-compose/gc-plans
requirements_file: /Users/simonkohnstamm/simon-city/city/.gc/worktrees/quilt-specs/main/changes/data-products-1-compose-r2/requirements.md
implementation_plan_file: /Users/simonkohnstamm/simon-city/city/.gc/worktrees/quilt/dx-dp-compose/gc-plans/data-products-1-compose/implementation-plan.md
status: created
created_at: '2026-08-14T19:12:00Z'
updated_at: '2026-08-14T19:16:18Z'
created_beads_at: '2026-08-14T19:16:18Z'
---

# Tasks: Compose a live view over scattered data

Six convoys matching the plan's phases. Phase 0 is a hard prerequisite for everything
else — it lands the existing DP surface on `dev` so later phases extend rather than
reinvent.

Assumption IDs (**A1**–**A15**) refer to the plan's Assumptions table. Each bead that rests
on an assumption names it, so overturning one assumption identifies exactly the beads to
revisit.

## Convoy 0 — Land the existing DP surface on dev

Port `origin/dx-dp-browse` (`b71f4dd9`) onto `dx-dp-compose`. Four of the eight conflicts
are modify/delete where `dev` deleted files that branch edits, so the landing integration is
re-implemented, not merged.

## Convoy 1 — Predicate definition

Schema union (fixed manifest **or** predicate rule, **A2**), authoring mutation,
authorization (**A10**), denial posture (**A9**), name collision (**A7**).

## Convoy 2 — Live resolution

Resolve members from a predicate via the existing packages-search `userMetaFilters` path
(**A1**), latest-at-resolution (**A3**), derived `virtualName` (**A5**), per-member
server-side revision pinning.

## Convoy 3 — Source-side authorization

All-or-nothing authorization against the consuming principal, `source-denied` with zero
disclosure.

## Convoy 4 — Pins

Capture, re-authorize, fail closed. Includes the `cf-connector-pairing-pinning`
verification that may block integrity validation.

## Convoy 5 — UI / UX

Predicate builder with live preview, provenance display, pin affordance, denial states,
landing integration.

## Bead Creation Payload

```yaml
target_rig: quilt
labels:
  - data-products
  - dx-dp-compose
convoys:
  - key: c0-land-existing
    title: "Phase 0: land the existing DP surface on dev"
    description: >
      Port the Data Product surface from origin/dx-dp-browse (b71f4dd9) onto the
      dx-dp-compose branch, which is cut from origin/dev at 686eaa5e. dx-dp-browse is not an
      ancestor of dev and conflicts on 8 files. Prerequisite for all later phases.
    beads:
      - key: b0-port-content-conflicts
        title: "Port dx-dp-browse: resolve the 4 content conflicts"
        type: task
        priority: "1"
        description: >
          Bring the DataProduct containers, GraphQL documents, routes, and schema additions
          from origin/dx-dp-browse onto dx-dp-compose. Resolve the four content conflicts in
          favour of dev's version plus the DP additions: .github/workflows/deploy-catalog.yaml,
          catalog/app/containers/Search/List/Hit.spec.tsx,
          catalog/app/containers/Search/Table/Table.tsx,
          catalog/app/containers/Sidebar/Sidebar.tsx.
          Do NOT resolve the four modify/delete conflicts here - those are b0-redo-landing.
        acceptance_criteria:
          - "catalog/app/containers/DataProduct/ exists with DataProduct.tsx, index.ts, packageItems.ts and the gql/ documents"
          - "The DataProduct types are present in shared/graphql/schema.graphql"
          - "Routes /data-products/:id and its nested object/package routes are registered in catalog/app/constants/routes.ts"
          - "The dataProducts admin feature flag is present and defaults to off"
          - "No merge conflict markers remain in any tracked file"
        files:
          - catalog/app/containers/DataProduct/
          - shared/graphql/schema.graphql
          - catalog/app/constants/routes.ts
          - catalog/app/containers/App/App.jsx
          - catalog/app/containers/Sidebar/Sidebar.tsx
          - catalog/app/containers/Search/Table/Table.tsx
          - catalog/app/containers/Search/List/Hit.spec.tsx
        verification:
          - "cd catalog && npm run gql:generate  # only this validates queries; expect generated-file churn"
          - "cd catalog && npm run typecheck"
          - "cd catalog && npm test -- DataProduct"
      - key: b0-redo-landing
        title: "Re-implement the DP landing integration against dev's architecture"
        type: task
        priority: "1"
        description: >
          dev deleted the files dx-dp-browse modified for landing-page integration:
          catalog/app/website/components/BucketGrid/BucketGrid.tsx, BucketList.tsx,
          catalog/app/website/pages/Landing/Buckets/Buckets.jsx and Buckets.spec.tsx.
          These are modify/delete conflicts and cannot be merged. Read what replaced
          BucketGrid on dev, then re-implement merging data products into the volume list
          with a type filter, matching dev's current component architecture.
        acceptance_criteria:
          - "Data products appear in the landing volume list on dev's current architecture"
          - "A type filter distinguishes data products from buckets"
          - "No reference remains to the deleted BucketGrid/Buckets modules"
          - "The surface stays behind the dataProducts flag, default off"
        dependencies:
          - b0-port-content-conflicts
        verification:
          - "cd catalog && npm run typecheck"
          - "cd catalog && npm test -- Landing"
      - key: b0-graphcache-keys
        title: "Carry over graphcache non-entity keys for DP types"
        type: chore
        priority: "2"
        description: >
          dx-dp-browse configures the six DataProduct GraphQL types as non-entities
          (() => null keys) in catalog/app/utils/GraphQL/Provider.tsx, with only DataProduct
          itself keyed by id. Carry that configuration over and confirm it still matches the
          type set after the schema union lands in convoy 1.
        acceptance_criteria:
          - "All DP types except DataProduct have null cache keys"
          - "DataProduct is keyed by id"
        dependencies:
          - b0-port-content-conflicts
        files:
          - catalog/app/utils/GraphQL/Provider.tsx
        verification:
          - "cd catalog && npm run typecheck"

  - key: c1-predicate-definition
    title: "Phase 1: predicate definition (schema + authoring)"
    description: >
      Extend DataProductDefinition to a union of the existing fixed manifest or a new
      predicate rule (A2), with authoring, authorization, and denial semantics.
    beads:
      - key: b1-schema-union
        title: "Add PredicateRule to DataProductDefinition as a union (A2)"
        type: feature
        priority: "1"
        description: >
          Add a PredicateRule type carrying packageNamePattern, entryPathPattern, and
          userMetaFilters ([PackageUserMetaPredicate!]) per A1. Make DataProductDefinition a
          union of the existing FixedManifest and PredicateRule so existing dx-dp-browse data
          keeps resolving unchanged. Mirror the shape in the mutation input.
          Rests on A1 and A2.
        acceptance_criteria:
          - "PredicateRule exists with packageNamePattern, entryPathPattern, and userMetaFilters"
          - "DataProductDefinition resolves for both a fixed manifest and a predicate rule"
          - "An existing fixed-manifest data product is unaffected"
          - "Generated TypeScript types are regenerated and committed"
        dependencies:
          - b0-port-content-conflicts
        labels:
          - assumption:A1
          - assumption:A2
        files:
          - shared/graphql/schema.graphql
          - catalog/app/containers/DataProduct/gql/DataProduct.graphql
        verification:
          - "cd catalog && npm run gql:generate"
          - "cd catalog && npm run typecheck"
      - key: b1-authoring-mutation
        title: "Accept a predicate rule in dataProductSetDefinition"
        type: feature
        priority: "1"
        description: >
          Extend the dataProductSetDefinition mutation to accept a predicate rule. Preserve
          the existing InvalidInput | OperationError result-union pattern.
          NOTE per A15: if the resolver for this mutation lives in the private registry repo
          rather than here, do not guess - record the finding and mark this bead blocked.
        acceptance_criteria:
          - "A predicate definition can be submitted and is echoed back verbatim by definition"
          - "Invalid predicates return InvalidInput rather than throwing"
          - "If the resolver is not in this repo, the bead is marked blocked with the finding recorded"
        dependencies:
          - b1-schema-union
        labels:
          - assumption:A15
        verification:
          - "cd catalog && npm run typecheck"
      - key: b1-authoring-authorization
        title: "Authorize definition by write-or-admin, deny as not-found (A9, A10)"
        type: feature
        priority: "1"
        description: >
          Authorize view definition by write OR admin authority over the target
          bucket/namespace, matching invariant-config-authz's disjunction (A10). An
          unauthorized attempt returns not-found rather than a permission error, matching the
          standing posture where an unlistable bucket appears not to exist (A9), so a
          principal cannot probe which namespaces exist by attempting definitions.
        acceptance_criteria:
          - "A principal with write authority can define a view"
          - "A principal with admin authority alone can define a view"
          - "A principal with neither cannot, and the response discloses nothing about the namespace"
          - "A test asserts the denial response is indistinguishable from a genuinely absent namespace"
        dependencies:
          - b1-authoring-mutation
        labels:
          - assumption:A9
          - assumption:A10
      - key: b1-name-collision
        title: "Reject view names colliding with package names (A7)"
        type: feature
        priority: "2"
        description: >
          A view reference is spelled like a package reference. Reject a definition whose name
          collides with an existing package in the same bucket, with a distinct rejection
          class. On an otherwise ambiguous bare reference, resolution prefers the package.
        acceptance_criteria:
          - "Defining a view named after an existing package is rejected with a distinct class"
          - "A bare ambiguous reference resolves to the package"
        dependencies:
          - b1-authoring-mutation
        labels:
          - assumption:A7

  - key: c2-live-resolution
    title: "Phase 2: live resolution"
    description: >
      Resolve members from a predicate rule at read time, at one selected revision per
      member, with provenance and server-side pinning.
    beads:
      - key: b2-resolve-members
        title: "Resolve predicate rule to a member set via packages-search (A1, A3)"
        type: feature
        priority: "1"
        description: >
          Resolve a PredicateRule to its member set by querying the existing packages-search
          path with userMetaFilters, then filtering entries by entryPathPattern. Each unpinned
          member resolves at latest-revision-at-resolution-time (A3). One resolution per
          operation, reused for every result, disclosure, and authorization decision in that
          operation, so no operation presents a mixture of two resolutions
          (br-live-resolution). A rule resolving to zero members succeeds and returns empty
          (A14).
        acceptance_criteria:
          - "A predicate selecting a package-name pattern plus an entry path resolves to exactly the matching members"
          - "A newly matching package appears on the next read without editing the definition"
          - "A member that ceases to match is omitted while remaining matches are retained"
          - "Zero matching members returns an empty member set, not an error"
          - "One operation observes exactly one resolution"
        dependencies:
          - b1-schema-union
        labels:
          - assumption:A1
          - assumption:A3
          - assumption:A14
        verification:
          - "cd catalog && npm test -- DataProduct"
      - key: b2-member-provenance
        title: "Every member discloses source package, revision, and path"
        type: feature
        priority: "1"
        description: >
          Each resolved member carries its source bucket, package name, source revision, and
          logical key, so a consumer can trace any part of the whole back to where it lives
          (br-member-provenance). Revision identity must survive relocation of the member
          bytes, since top hash excludes physical location.
        acceptance_criteria:
          - "Every member exposes bucket, package name, revision, and logical key"
          - "Relocating member bytes with content unchanged leaves the disclosed revision identity unchanged"
        dependencies:
          - b2-resolve-members
      - key: b2-virtual-name
        title: "Derive virtualName for predicate-selected members (A5)"
        type: feature
        priority: "2"
        description: >
          Fixed-manifest members carry an authored virtualName; predicate-derived members have
          none. Derive it deterministically as bucket/package-name/logical-key, with a
          collision suffix when two members would derive the same name. The DP is presented as
          a virtual bucket, so this name is what navigation and display use.
        acceptance_criteria:
          - "Each predicate-derived member has a deterministic virtualName"
          - "Two members deriving the same name are disambiguated by suffix"
          - "Navigation within the virtual bucket resolves by virtualName"
        dependencies:
          - b2-resolve-members
        labels:
          - assumption:A5
      - key: b2-server-side-pinning
        title: "Pin per-member revisions server-side, replacing effectiveRevision"
        type: feature
        priority: "2"
        description: >
          GraphQL has no per-list-item arguments, so the existing client cannot request
          per-member pinned revisions: packageItems.ts dereferences latest and discards it
          when it does not match the pin, leaving size, entries, comment, workflow, and meta
          unknown. Resolving server-side removes the limitation. Replace the effectiveRevision
          fallback with resolver-supplied per-member revisions.
        acceptance_criteria:
          - "A pinned member returns its pinned revision's size, entries, comment, workflow, and meta"
          - "The effectiveRevision null-fallback path is removed or reduced to a genuine error case"
          - "packageItems.spec.ts is updated and passes"
        dependencies:
          - b2-resolve-members
        files:
          - catalog/app/containers/DataProduct/packageItems.ts
          - catalog/app/containers/DataProduct/packageItems.spec.ts
        verification:
          - "cd catalog && npm test -- packageItems"

  - key: c3-source-authorization
    title: "Phase 3: source-side authorization"
    description: >
      Authorize every view-derived operation against the consuming principal at the sources,
      all-or-nothing, with zero disclosure on denial.
    beads:
      - key: b3-per-member-authorization
        title: "Authorize the consuming principal against every resolved member and revision"
        type: feature
        priority: "0"
        description: >
          For every operation against a live view or pin, authorize the authenticated
          consuming principal against each source member AND source revision that operation
          resolved to. Never use authority inherited from the view author, the pin creator,
          the view itself, its reference, or a cached prior decision. Neither defining a view
          nor handing its reference grants any permission.
          Per-revision granularity matters: a realization that authorized per member and
          served any revision would pass member-level tests while violating the requirement.
        acceptance_criteria:
          - "A member the reader cannot read at source is not readable through the view"
          - "Authorization uses the consuming principal, never the author's or pin creator's authority"
          - "Receiving a view reference leaves the recipient's permissions unchanged"
          - "A test distinguishes per-revision from per-member authorization granularity, or records that the deployed path cannot distinguish them"
        dependencies:
          - b2-resolve-members
      - key: b3-all-or-nothing
        title: "source-denied refuses the whole view with zero disclosure"
        type: feature
        priority: "0"
        description: >
          Authorization is all-or-nothing for every view-derived operation. If the consuming
          principal is denied any member the operation resolved to, return NO member content,
          rows, schema, provenance, paths, revisions, counts, previews, or partial results -
          and apply this before emitting output, on every surface (query, file, metadata,
          export, pin-creation, agent-context). Rejection class source-denied.
          This is the highest-value test surface in the plan: partial disclosure is the
          failure mode the requirements care most about.
        acceptance_criteria:
          - "A reader denied on one of several members receives no content from any member"
          - "The rejection discloses no schema, row count, member path, or revision"
          - "Pin capture by a partially-denied reader is rejected with the same non-disclosure"
          - "A test asserts zero disclosure field-by-field, not merely a non-200 status"
        dependencies:
          - b3-per-member-authorization
      - key: b3-document-revocation-window
        title: "Document the revocation-propagation window (A12)"
        type: task
        priority: "2"
        description: >
          br-source-authorization states an absolute: no authorization from a cached prior
          decision, no serving under stale authority. Two standing invariants record real
          windows that contradict the absolute - the registry cannot retroactively narrow an
          already-issued credential within its TTL (about an hour), and an already-issued
          agent access token stays valid until expiry with no denylist consulted. Per A12 we
          accept these windows rather than building new machinery. Document them explicitly so
          the gap between contract and realization is recorded, not hidden.
        acceptance_criteria:
          - "The credential-TTL and token-lifetime windows are documented with their bounds"
          - "The document states plainly that these windows are accepted, not closed"
        dependencies:
          - b3-per-member-authorization
        labels:
          - assumption:A12

  - key: c4-pins
    title: "Phase 4: pins"
    description: >
      Capture an immutable resolution, re-authorize on every pinned read, fail closed when a
      capture cannot be honored.
    beads:
      - key: b4-verify-version-pinning
        title: "Verify version-pinned physical keys before certifying pin integrity"
        type: task
        priority: "0"
        description: >
          cf-connector-pairing-pinning records that the tabulator connector and registry heads
          do not pair, that the registry-side classifier behavior the refilter expects is not
          findable at that head, and that whether physical keys handed to the connector are
          always version-pinned is UNVERIFIED. That last point is exactly what pin integrity
          validation depends on. Verify against DEPLOYED builds, not repository heads.
          If version pinning cannot be confirmed, mark this convoy blocked and report - do not
          implement integrity validation on an unverified foundation.
        acceptance_criteria:
          - "Whether physical keys are version-pinned is confirmed or refuted against deployed builds"
          - "If refuted or unverifiable, the finding is recorded and the convoy marked blocked"
        dependencies:
          - b2-member-provenance
      - key: b4-pin-capture
        title: "Capture a pin recording every member identity and source revision"
        type: feature
        priority: "1"
        description: >
          An authorized consumer may capture an immutable pin containing the canonical
          identity of every resolved member and its immutable source revision. The pin retains
          those identities and revisions regardless of later source or predicate changes. A pin
          freezes resolution only - it conveys no source authority.
        acceptance_criteria:
          - "A pin records exactly the members and revisions resolved at capture time"
          - "A newly landing matching member does not appear in an existing pin"
          - "The same view unpinned does include the new member"
          - "A pin survives an edit to the view's predicate unchanged"
        dependencies:
          - b2-resolve-members
          - b3-per-member-authorization
      - key: b4-pin-fail-closed
        title: "Pinned reads fail closed on denial, missing revision, or integrity failure"
        type: feature
        priority: "0"
        description: >
          Every pinned operation performs CURRENT source authorization against all captured
          members. If authorization fails, or a captured revision is unavailable, or content
          fails integrity validation against the captured revision identity, the ENTIRE pinned
          operation fails closed. Never substitute a newer revision, never omit the member,
          never serve content under stale authority.
        acceptance_criteria:
          - "Authorization failure on any captured member fails the whole pinned read"
          - "An unavailable captured revision fails closed rather than substituting a newer one"
          - "Content failing integrity validation fails closed rather than being served"
          - "No arm omits the offending member and serves the rest"
        dependencies:
          - b4-pin-capture
          - b4-verify-version-pinning
      - key: b4-definition-lifecycle
        title: "Define edit and delete semantics for view definitions (A13)"
        type: feature
        priority: "2"
        description: >
          Definitions are editable and deletable. Existing pins retain their captured
          resolution across both. An unpinned reference to a deleted view resolves to
          not-found.
        acceptance_criteria:
          - "Editing a predicate changes what unpinned reads resolve to"
          - "Existing pins are unaffected by an edit or a delete"
          - "An unpinned reference to a deleted view returns not-found"
        dependencies:
          - b4-pin-capture
        labels:
          - assumption:A13

  - key: c5-ui-ux
    title: "Phase 5: UI / UX"
    description: >
      Predicate authoring with live preview, provenance display, pin affordances, denial
      states, and landing integration. Built on the virtual-bucket IA the existing surface
      established.
    beads:
      - key: b5-predicate-builder
        title: "Predicate builder reusing the userMeta facet components"
        type: feature
        priority: "1"
        description: >
          Build the definition-authoring UI for predicate rules (A11: catalog UI plus
          GraphQL). Reuse the existing PackageUserMetaFacet / filteredUserMetaFacets
          components that the search UI already renders, so the vocabulary an author sees
          matches the vocabulary search already exposes. Include a live preview of the
          resolved member set before save, since a predicate's effect is not obvious from its
          text.
        acceptance_criteria:
          - "An author can compose a package-name pattern, an entry-path pattern, and userMeta filters"
          - "Facet discovery is reused rather than reimplemented"
          - "A live preview shows the resolved members before saving"
          - "Saving an invalid predicate surfaces InvalidInput inline, not as a crash"
        dependencies:
          - b1-authoring-mutation
          - b2-resolve-members
        labels:
          - assumption:A11
        files:
          - catalog/app/containers/DataProduct/
        verification:
          - "cd catalog && npm run typecheck"
          - "cd catalog && npm test -- DataProduct"
      - key: b5-member-provenance-ui
        title: "Show per-member provenance in the Objects and Packages tabs"
        type: feature
        priority: "1"
        description: >
          Extend the existing virtual-bucket Objects and Packages tabs to disclose each
          member's source package, revision, and path, so a consumer can trace any part of the
          whole back to where it lives. Distinguish members drawn from different source
          packages that contribute the same entry path.
        acceptance_criteria:
          - "Each member row shows source package, revision, and path"
          - "Two members with the same entry path from different packages are distinguishable"
          - "Members resolved at a pinned revision show that revision, not latest"
        dependencies:
          - b2-member-provenance
          - b2-server-side-pinning
        verification:
          - "cd catalog && npm test -- DataProduct"
      - key: b5-pin-affordance
        title: "Pin capture, listing, and pinned-vs-live distinction"
        type: feature
        priority: "2"
        description: >
          Let a consumer capture a pin, list existing pins, and open a pinned view. A pinned
          view must be visibly distinct from a live one - a reader who cannot tell whether
          they are looking at frozen or live data cannot use either safely.
        acceptance_criteria:
          - "A consumer can capture a pin from a live view"
          - "Existing pins are listable and openable"
          - "Pinned state is visually unambiguous against live state"
        dependencies:
          - b4-pin-capture
          - b5-member-provenance-ui
      - key: b5-denial-states
        title: "Render source-denied as an all-or-nothing refusal"
        type: feature
        priority: "1"
        description: >
          A source-denied response must render as a whole-view refusal that leaks nothing:
          no partial member listing, no member names, no counts, no schema. The UI must not
          reconstruct from a failed response what the API deliberately withheld.
        acceptance_criteria:
          - "A source-denied view renders a refusal with no member listing"
          - "No member name, count, path, or revision appears in the denied state"
          - "A denied pin capture surfaces the same non-disclosing refusal"
        dependencies:
          - b3-all-or-nothing
        verification:
          - "cd catalog && npm test -- DataProduct"
      - key: b5-landing-type-filter
        title: "Polish the landing volume-list type filter for data products"
        type: task
        priority: "3"
        description: >
          Finish the landing integration begun in b0-redo-landing: the type filter that
          distinguishes data products from buckets in the volume list, on dev's current
          component architecture.
        acceptance_criteria:
          - "Data products and buckets are filterable by type in the volume list"
          - "The filter respects the dataProducts feature flag"
        dependencies:
          - b0-redo-landing
        verification:
          - "cd catalog && npm test -- Landing"
```

## Created Beads

| Key | Kind | Bead ID | Title |
|---|---|---|---|
| c0-land-existing | convoy | qu-6iq | Phase 0: land the existing DP surface on dev |
| c1-predicate-definition | convoy | qu-ach | Phase 1: predicate definition (schema + authoring) |
| c2-live-resolution | convoy | qu-2rj | Phase 2: live resolution |
| c3-source-authorization | convoy | qu-3rq | Phase 3: source-side authorization |
| c4-pins | convoy | qu-g4m | Phase 4: pins |
| c5-ui-ux | convoy | qu-ctq | Phase 5: UI / UX |
| b0-port-content-conflicts | bead | qu-u4l | Port dx-dp-browse: resolve the 4 content conflicts |
| b0-redo-landing | bead | qu-qn2 | Re-implement the DP landing integration against dev's architecture |
| b0-graphcache-keys | bead | qu-miq | Carry over graphcache non-entity keys for DP types |
| b1-schema-union | bead | qu-grm | Add PredicateRule to DataProductDefinition as a union (A2) |
| b1-authoring-mutation | bead | qu-ss1 | Accept a predicate rule in dataProductSetDefinition |
| b1-authoring-authorization | bead | qu-dun | Authorize definition by write-or-admin, deny as not-found (A9, A10) |
| b1-name-collision | bead | qu-48p | Reject view names colliding with package names (A7) |
| b2-resolve-members | bead | qu-46w | Resolve predicate rule to a member set via packages-search (A1, A3) |
| b2-member-provenance | bead | qu-62t | Every member discloses source package, revision, and path |
| b2-virtual-name | bead | qu-lk0 | Derive virtualName for predicate-selected members (A5) |
| b2-server-side-pinning | bead | qu-m0w | Pin per-member revisions server-side, replacing effectiveRevision |
| b3-per-member-authorization | bead | qu-ncy | Authorize the consuming principal against every resolved member and revision |
| b3-all-or-nothing | bead | qu-i89 | source-denied refuses the whole view with zero disclosure |
| b3-document-revocation-window | bead | qu-v7m | Document the revocation-propagation window (A12) |
| b4-verify-version-pinning | bead | qu-ii4 | Verify version-pinned physical keys before certifying pin integrity |
| b4-pin-capture | bead | qu-0h4 | Capture a pin recording every member identity and source revision |
| b4-pin-fail-closed | bead | qu-lkj | Pinned reads fail closed on denial, missing revision, or integrity failure |
| b4-definition-lifecycle | bead | qu-ekh | Define edit and delete semantics for view definitions (A13) |
| b5-predicate-builder | bead | qu-pyx | Predicate builder reusing the userMeta facet components |
| b5-member-provenance-ui | bead | qu-o02 | Show per-member provenance in the Objects and Packages tabs |
| b5-pin-affordance | bead | qu-nre | Pin capture, listing, and pinned-vs-live distinction |
| b5-denial-states | bead | qu-lcz | Render source-denied as an all-or-nothing refusal |
| b5-landing-type-filter | bead | qu-osk | Polish the landing volume-list type filter for data products |
