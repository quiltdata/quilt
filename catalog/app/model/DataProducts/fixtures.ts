/**
 * Fixtures for the local volume model.
 *
 * These stand in for a registry that serves no volume, exchange or mint API yet.
 * Their value is not the data -- it is that the screens are built against a shape
 * congruent with what the registry will produce, so the day an adapter lands, no
 * container changes.
 *
 * **Every screen that renders these says so.** Not a courtesy: several of these
 * rows are states that would be alarming if read as real -- an approval whose
 * grant did not read back, a revoke that did not take. Presented as an operator's
 * own stack they would send someone to debug Lake Formation. `FixtureNotice`
 * carries the label; the ids all carry a `fixture-` prefix so a fixture volume
 * cannot shadow a real bucket name at `/b/:bucket`; and there are no internal
 * email addresses, account ids or real bucket names anywhere below.
 *
 * # Why this file holds stack-wide records and projects them
 *
 * The registry's `volumes` and `holdings` are stack-wide tables, and a workspace
 * reads only **its own slice** of holdings (DEC-52, *ruled*). So the fixtures are
 * written the same way: `PRODUCT_RECORDS` is what the stack knows, and
 * `projectVolume` derives what one workspace may see -- its own holding, and the
 * queue and subscriber list **only when it owns the product**.
 *
 * That projection is the point. Written the other way -- a `ProductVolume` per
 * workspace with its subscriber list filled in by hand -- nothing would stop a
 * screen from reading another workspace's holdings, and the rule would hold only
 * as long as everyone remembered it. Here a non-owner projection has `requests`
 * and `subscribers` as `null` by construction, so a screen that tried could not.
 *
 * # What the fixtures deliberately cover
 *
 * Two workspaces, exactly one active at a time (invariant 9), and switching
 * changes the holdings slice, the publisher's queue and the listing -- because
 * "one active workspace, never unioned" is only testable if there are two.
 *
 * Every state a screen must render distinctly: the four agreeing ones, and every
 * disagreement -- approved with the grant missing, rejected with a grant still
 * present, a revoke that did not take, an approval recorded as failed, and a
 * read-back that did not answer at all.
 *
 * What they deliberately do **not** contain: a capture. Minting is not wired, so
 * there are no invented bytes and no invented file tree -- see
 * `UNAVAILABLE_ACTS.MINT`.
 */

import type {
  BucketVolume,
  Capture,
  Decision,
  Definition,
  GrantObservation,
  Holding,
  ProductVolume,
  Publication,
  Subscription,
  Workspace,
} from './types'

/** Fixed so "last checked" rendering and snapshots stay deterministic. */
const NOW = new Date('2026-09-15T12:00:00.000Z')
const d = (iso: string) => new Date(iso)

const ws = (name: string): Workspace => ({ name })

const grant = (status: GrantObservation['status'], at = NOW): GrantObservation => ({
  status,
  at,
})

const decision = (
  kind: Decision['kind'],
  by: string,
  at: string,
  reason?: string,
): Decision => ({ kind, by, at: d(at), exchange: 'local', reason })

// ---------------------------------------------------------------------------
// The two workspaces.
// ---------------------------------------------------------------------------

export const WS_GENOMICS = 'fixture-ws-genomics'
export const WS_CLINICAL = 'fixture-ws-clinical'

/**
 * The workspaces this fixture stack has, and the one active by default.
 *
 * A switcher over these exists on the prototype's surfaces so the "one active
 * workspace" rule can be *seen*: the same product shows the publisher face to one
 * and the subscriber face to the other, and neither list ever contains the other's
 * holdings. In the real catalog this is `switchRole`, which already exists.
 */
export const WORKSPACES = [WS_GENOMICS, WS_CLINICAL]

export const DEFAULT_WORKSPACE = WS_GENOMICS

// ---------------------------------------------------------------------------
// The exchange record: requests and decisions, stack-wide.
// ---------------------------------------------------------------------------

const ASSAY = 'fixture-assay-cohort-2026'
const DRAFT = 'fixture-variant-calls-draft'
const PANELS = 'fixture-reference-panels'
const OUTCOMES = 'fixture-clinical-outcomes'
const TILES = 'fixture-imaging-tiles'
const LEGACY = 'fixture-legacy-assays'

/**
 * Requests against `fixture-assay-cohort-2026`, which `ws-genomics` owns.
 *
 * One per state the publisher's Sharing screen must render distinctly. The
 * clinical workspace is among them, which is what makes the face switch
 * meaningful: the same row is a queue entry to the owner and its own access state
 * to the subscriber.
 */
const ASSAY_SUBSCRIPTIONS: Subscription[] = [
  // Agreeing: no decision yet.
  {
    id: 'sub-pending',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-biostats'),
    requestedBy: 'j.tan',
    requestedAt: d('2026-09-11T08:05:00.000Z'),
    decision: null,
    grant: grant('ABSENT'),
    lastFailure: null,
  },
  /**
   * An approve whose grant write did not read back -- Fig. 5's `else` branch.
   *
   * The publisher must see *approval failed* with a retry; the subscriber sees a
   * plain pending. Two faces, one row: the case a single stored state cannot
   * carry, and the reason `deriveState` takes a face.
   */
  {
    id: 'sub-approval-failed',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-imaging'),
    requestedBy: 'p.novak',
    requestedAt: d('2026-09-10T11:20:00.000Z'),
    decision: null,
    grant: grant('ABSENT'),
    lastFailure: {
      at: d('2026-09-12T10:02:00.000Z'),
      cause:
        'GrantPermissions: EntityNotFoundException (view not found in product database)',
    },
  },
  // Agreeing: approve + grant present. The clinical workspace's own row.
  {
    id: 'sub-clinical',
    volumeId: ASSAY,
    subscriber: ws(WS_CLINICAL),
    requestedBy: 'r.okafor',
    requestedAt: d('2026-09-02T09:12:00.000Z'),
    decision: decision('APPROVE', 'l.mendes', '2026-09-02T15:40:00.000Z'),
    grant: grant('PRESENT'),
    lastFailure: null,
  },
  /**
   * Approved, no failure recorded, and the grant is gone.
   *
   * Not the same as `sub-approval-failed`, and the difference is the whole point:
   * nobody attempted-and-failed here, so there is nothing to retry -- the grant
   * went missing after the fact. An audit read, reported unresolved to both faces
   * and collapsed into neither Pending nor Approved.
   */
  {
    id: 'sub-approved-grant-missing',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-registry-ops'),
    requestedBy: 's.iqbal',
    requestedAt: d('2026-08-28T14:00:00.000Z'),
    decision: decision('APPROVE', 'l.mendes', '2026-08-28T16:30:00.000Z'),
    grant: grant('ABSENT'),
    lastFailure: null,
  },
  // Rejected, with the publisher's reason shown to the requester verbatim.
  {
    id: 'sub-rejected',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-partner-eval'),
    requestedBy: 'm.aoki',
    requestedAt: d('2026-09-04T07:45:00.000Z'),
    decision: decision(
      'REJECT',
      'l.mendes',
      '2026-09-04T12:10:00.000Z',
      'Cohort is limited to consented studies; ask again with a study id.',
    ),
    grant: grant('ABSENT'),
    lastFailure: null,
  },
  // Rejected, yet a grant is present. The audit fact from the other side.
  {
    id: 'sub-rejected-grant-present',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-legacy-etl'),
    requestedBy: 'v.silva',
    requestedAt: d('2026-08-20T10:00:00.000Z'),
    decision: decision('REJECT', 'l.mendes', '2026-08-20T11:00:00.000Z'),
    grant: grant('PRESENT'),
    lastFailure: null,
  },
  // Revoked and the grant is gone. Credentials minted before it live to TTL.
  {
    id: 'sub-revoked',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-archive'),
    requestedBy: 'h.berger',
    requestedAt: d('2026-07-15T09:00:00.000Z'),
    decision: decision('REVOKE', 'l.mendes', '2026-09-08T09:00:00.000Z'),
    grant: grant('ABSENT'),
    lastFailure: null,
  },
  /**
   * Revoke recorded, grant still present: the removal did not take.
   *
   * The faces disagree in the other direction here -- the publisher sees *revoke
   * failed* and retries, the subscriber reads *approved*, because they can still
   * read. Telling them access was removed would be false.
   */
  {
    id: 'sub-revoke-failed',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-vendor-qc'),
    requestedBy: 'a.dubois',
    requestedAt: d('2026-08-01T13:30:00.000Z'),
    decision: decision('REVOKE', 'l.mendes', '2026-09-13T16:45:00.000Z'),
    grant: grant('PRESENT'),
    lastFailure: {
      at: d('2026-09-13T16:45:30.000Z'),
      cause: 'RevokePermissions: ConcurrentModificationException',
    },
  },
  // The read-back call itself failed. Not a state of the subscription.
  {
    id: 'sub-unknown',
    volumeId: ASSAY,
    subscriber: ws('fixture-ws-ml-platform'),
    requestedBy: 'k.zhou',
    requestedAt: d('2026-09-05T15:00:00.000Z'),
    decision: decision('APPROVE', 'l.mendes', '2026-09-05T17:20:00.000Z'),
    grant: grant('UNREAD'),
    lastFailure: null,
  },
]

/** `ws-genomics` is approved on the reference panels the reference-data workspace publishes. */
const PANELS_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-genomics-panels',
    volumeId: PANELS,
    subscriber: ws(WS_GENOMICS),
    requestedBy: 'l.mendes',
    requestedAt: d('2026-09-09T10:15:00.000Z'),
    decision: decision('APPROVE', 'd.ferreira', '2026-09-09T14:00:00.000Z'),
    grant: grant('PRESENT'),
    lastFailure: null,
  },
]

/** `ws-genomics` has asked the clinical workspace for its outcomes, and is waiting. */
const OUTCOMES_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-genomics-outcomes',
    volumeId: OUTCOMES,
    subscriber: ws(WS_GENOMICS),
    requestedBy: 'l.mendes',
    requestedAt: d('2026-09-14T09:30:00.000Z'),
    decision: null,
    grant: grant('ABSENT'),
    lastFailure: null,
  },
]

/** `ws-genomics` was revoked on the legacy assays, and the row stays listed as such. */
const LEGACY_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-genomics-legacy',
    volumeId: LEGACY,
    subscriber: ws(WS_GENOMICS),
    requestedBy: 'l.mendes',
    requestedAt: d('2026-04-02T09:00:00.000Z'),
    decision: decision('REVOKE', 'h.berger', '2026-09-07T10:00:00.000Z'),
    grant: grant('ABSENT'),
    lastFailure: null,
  },
]

// ---------------------------------------------------------------------------
// Stack-wide product records.
// ---------------------------------------------------------------------------

/**
 * One `volumes` row plus the exchange's record for it.
 *
 * Deliberately *not* a `ProductVolume`: it has no `holding`, because a holding is
 * a fact about a workspace and this is a fact about the stack. `projectVolume`
 * turns one into the other for one reader.
 */
interface ProductRecord {
  id: string
  title: string
  description: string | null
  owner: string
  designatedBy: string
  designatedAt: Date
  definition: Definition
  published: Publication | null
  /** The exchange record for this product: every request, with its decision and read-back. */
  subscriptions: Subscription[]
}

const PROXY_ENDPOINT = 'https://dpp.example-stack.quilt/local/'

const PRODUCT_RECORDS: ProductRecord[] = [
  {
    id: ASSAY,
    title: 'Assay cohort 2026',
    description: 'Plate-level assay outputs joined to the consented cohort manifest.',
    owner: WS_GENOMICS,
    designatedBy: 'l.mendes',
    designatedAt: d('2026-08-18T10:00:00.000Z'),
    definition: {
      view: 'assay_cohort_2026_v3',
      versionId: 'gv-8c41f0',
      sql:
        'SELECT\n' +
        "  concat('plates/', p.plate_id, '/', o.file_name) AS logical_key,\n" +
        '  o.bucket,\n' +
        '  o.key,\n' +
        '  o.version_id\n' +
        'FROM "fixture_assay_raw"."objects" o\n' +
        'JOIN "fixture_cohort_ref"."plates" p ON p.plate_id = o.plate_id\n' +
        "WHERE p.consent_status = 'consented'",
      referencedBuckets: ['fixture-assay-raw', 'fixture-cohort-ref'],
      authoredAt: d('2026-09-06T11:30:00.000Z'),
    },
    published: { scope: 'STACK', publishedAt: d('2026-08-18T10:20:00.000Z') },
    subscriptions: ASSAY_SUBSCRIPTIONS,
  },
  /**
   * Designated and not published.
   *
   * Its own state, not a half-finished one: a row and a database exist, and there
   * is no listing. The Sharing screen says a product that is unpublished cannot
   * receive requests, rather than showing an empty queue with no explanation.
   */
  {
    id: DRAFT,
    title: 'Variant calls (draft)',
    description: 'Working definition over the variant call sets. Not shared yet.',
    owner: WS_GENOMICS,
    designatedBy: 'l.mendes',
    designatedAt: d('2026-09-14T16:00:00.000Z'),
    definition: {
      view: 'variant_calls_draft_v1',
      versionId: 'gv-11ab90',
      sql:
        "SELECT concat('vcf/', s.sample_id, '.vcf.gz') AS logical_key, o.bucket, o.key\n" +
        'FROM "fixture_variant_raw"."objects" o\n' +
        'JOIN "fixture_variant_raw"."samples" s ON s.sample_id = o.sample_id',
      referencedBuckets: ['fixture-variant-raw'],
      authoredAt: d('2026-09-14T16:00:00.000Z'),
    },
    published: null,
    subscriptions: [],
  },
  {
    id: OUTCOMES,
    title: 'Clinical outcomes',
    description: 'Outcome measures by study arm.',
    owner: WS_CLINICAL,
    designatedBy: 'r.okafor',
    designatedAt: d('2026-07-21T13:00:00.000Z'),
    definition: {
      view: 'clinical_outcomes_v2',
      versionId: 'gv-90ffa2',
      sql:
        "SELECT concat('outcomes/', a.arm_id, '/', o.file_name) AS logical_key, o.bucket, o.key\n" +
        'FROM "fixture_clinical_core"."objects" o\n' +
        'JOIN "fixture_clinical_core"."arms" a ON a.arm_id = o.arm_id',
      referencedBuckets: ['fixture-clinical-core'],
      authoredAt: d('2026-08-30T10:00:00.000Z'),
    },
    published: { scope: 'STACK', publishedAt: d('2026-07-21T13:15:00.000Z') },
    subscriptions: OUTCOMES_SUBSCRIPTIONS,
  },
  {
    id: PANELS,
    title: 'Reference panels',
    description: 'Curated reference panels for imputation, refreshed quarterly.',
    owner: 'fixture-ws-reference-data',
    designatedBy: 'd.ferreira',
    designatedAt: d('2026-06-02T09:00:00.000Z'),
    definition: {
      view: 'reference_panels_v7',
      versionId: 'gv-4471de',
      sql:
        "SELECT concat('panels/', p.panel_id, '.bcf') AS logical_key, o.bucket, o.key\n" +
        'FROM "fixture_reference_data"."objects" o\n' +
        'JOIN "fixture_reference_data"."panels" p ON p.panel_id = o.panel_id',
      referencedBuckets: ['fixture-reference-data'],
      authoredAt: d('2026-09-01T08:00:00.000Z'),
    },
    published: { scope: 'STACK', publishedAt: d('2026-06-02T09:30:00.000Z') },
    subscriptions: PANELS_SUBSCRIPTIONS,
  },
  /** Published in the stack, held by neither of the two switchable workspaces. */
  {
    id: TILES,
    title: 'Imaging tiles',
    description: 'Whole-slide image tiles with per-slide manifests.',
    owner: 'fixture-ws-imaging',
    designatedBy: 'p.novak',
    designatedAt: d('2026-05-11T11:00:00.000Z'),
    definition: {
      view: 'imaging_tiles_v4',
      versionId: 'gv-2a77c1',
      sql: null,
      referencedBuckets: ['fixture-imaging-raw', 'fixture-imaging-derived'],
      authoredAt: d('2026-08-12T14:00:00.000Z'),
    },
    published: { scope: 'STACK', publishedAt: d('2026-05-11T11:30:00.000Z') },
    // The clinical workspace subscribes here and the genomics workspace does not,
    // so neither workspace's holdings are a subset of the other's. That matters for
    // more than realism: with one list nested inside the other, a screen that
    // unioned the two roles would look merely longer rather than visibly wrong.
    subscriptions: [
      {
        id: 'sub-clinical-tiles',
        volumeId: TILES,
        subscriber: ws(WS_CLINICAL),
        requestedBy: 'r.okafor',
        requestedAt: d('2026-08-19T09:00:00.000Z'),
        decision: decision('APPROVE', 'p.novak', '2026-08-19T14:30:00.000Z'),
        grant: grant('PRESENT'),
        lastFailure: null,
      },
    ],
  },
  {
    id: LEGACY,
    title: 'Legacy assays',
    description: 'Retired assay outputs, retained for reproducibility.',
    owner: 'fixture-ws-archive',
    designatedBy: 'h.berger',
    designatedAt: d('2026-03-14T09:00:00.000Z'),
    definition: {
      view: 'legacy_assays_v1',
      versionId: 'gv-55cc02',
      sql: null,
      referencedBuckets: ['fixture-legacy-archive'],
      authoredAt: d('2026-03-14T09:00:00.000Z'),
    },
    published: { scope: 'STACK', publishedAt: d('2026-03-14T09:20:00.000Z') },
    subscriptions: LEGACY_SUBSCRIPTIONS,
  },
]

// ---------------------------------------------------------------------------
// Bucket volumes and the reach.
// ---------------------------------------------------------------------------

interface BucketRecord {
  id: string
  description: string
  /** Which workspaces hold it, and at what level. The holdings slice for buckets. */
  holders: Record<string, 'RW' | 'RO'>
}

/**
 * Bucket records.
 *
 * They carry nothing but the wrapper: the catalog's own bucket queries still
 * supply everything a bucket screen renders, and the volume model adds a kind
 * rather than moving anything a bucket user has (the stable-destination rule).
 */
const BUCKET_RECORDS: BucketRecord[] = [
  {
    id: 'fixture-assay-raw',
    description: 'Instrument output, written by the assay pipeline.',
    holders: { [WS_GENOMICS]: 'RW' },
  },
  {
    id: 'fixture-cohort-ref',
    description: 'Cohort manifests and consent status.',
    holders: { [WS_GENOMICS]: 'RO', [WS_CLINICAL]: 'RO' },
  },
  {
    id: 'fixture-variant-raw',
    description: 'Variant call sets and sample index.',
    holders: { [WS_GENOMICS]: 'RW' },
  },
  {
    id: 'fixture-clinical-core',
    description: 'Clinical core tables and study arms.',
    holders: { [WS_CLINICAL]: 'RW' },
  },
]

/**
 * The substrate a workspace's definitions may select from.
 *
 * The authoring screen shows this beside the editor because a SQL naming a bucket
 * outside it is `BucketNotInReach` before anything runs, and that is worth saying
 * before a check rather than after. In a real adapter this is the registry's
 * answer, not a client-side derivation from a bucket list.
 */
export function reachFor(workspace: string): string[] {
  return BUCKET_RECORDS.filter((b) => workspace in b.holders)
    .map((b) => b.id)
    .sort()
}

// ---------------------------------------------------------------------------
// Projection: what one workspace may see.
// ---------------------------------------------------------------------------

/**
 * The reader's holding on a product, from the stack-wide record.
 *
 * Owner comes from the row; subscriber comes from the reader's **own** request in
 * the exchange record. Anything else is `null` -- a listing without a holding,
 * which mounts Overview and Access only (screen rule R4).
 */
function holdingFor(record: ProductRecord, workspace: string): Holding | null {
  if (record.owner === workspace) return { role: 'OWNER', level: 'RW' }
  const mine = record.subscriptions.find((s) => s.subscriber.name === workspace)
  if (mine) return { role: 'SUBSCRIBER', level: 'RO', subscription: mine }
  return null
}

/**
 * A stack-wide record as one workspace may see it.
 *
 * The two `null`s are the DEC-52 slice made structural: a workspace that does not
 * own the product gets no queue and no subscriber list, so a screen cannot read
 * another workspace's holdings even by mistake. `null` rather than `[]` because
 * "nobody subscribes" is a claim a non-owner has no standing to make.
 *
 * `sql` is withheld from a non-owner as **UNK-C6's conservative default, not a
 * ruled requirement**. A grantee can `DESCRIBE` the view in Glue today (SP-8a), so
 * hiding it here hides nothing from a determined reader; the default is kept
 * because the owner has not called it, and it is the cheap direction to reverse.
 * The version id is shown to everyone either way, because a revision advances it
 * and readers are affected.
 */
export function projectVolume(record: ProductRecord, workspace: string): ProductVolume {
  const owned = record.owner === workspace
  return {
    id: record.id,
    kind: 'PRODUCT',
    title: record.title,
    description: record.description,
    holding: holdingFor(record, workspace),
    owner: ws(record.owner),
    designatedBy: record.designatedBy,
    designatedAt: record.designatedAt,
    definition: owned ? record.definition : { ...record.definition, sql: null },
    published: record.published,
    address: { endpoint: PROXY_ENDPOINT, bucket: record.id, connector: 'local' },
    // The queue is every request with no decision yet -- including an approve
    // recorded as failed, which is still pending (Fig. 5's `else`).
    requests: owned ? record.subscriptions.filter((s) => !s.decision) : null,
    subscribers: owned ? record.subscriptions : null,
  }
}

/** Bucket volumes this workspace holds. */
export function bucketVolumesFor(workspace: string): BucketVolume[] {
  return BUCKET_RECORDS.filter((b) => workspace in b.holders).map((b) => ({
    id: b.id,
    kind: 'BUCKET',
    title: b.id,
    description: b.description,
    holding: { role: 'ATTACHED', level: b.holders[workspace]! },
  }))
}

/** Products this workspace holds -- owned or subscribed, including revoked. */
export function heldProductsFor(workspace: string): ProductVolume[] {
  return PRODUCT_RECORDS.filter((r) => holdingFor(r, workspace) !== null).map((r) =>
    projectVolume(r, workspace),
  )
}

/**
 * The exchange listing for this workspace: every product published in its scope.
 *
 * Held or not -- the listing is what is published, and the workspace's relation to
 * each row is a separate column. The unpublished draft has no listing and is
 * absent, including from its own owner's listing.
 */
export function exchangeFor(workspace: string): ProductVolume[] {
  return PRODUCT_RECORDS.filter((r) => r.published !== null).map((r) =>
    projectVolume(r, workspace),
  )
}

/**
 * One volume by id, as this workspace may see it, or null.
 *
 * Filtered on the same rule its siblings use: a workspace may see a product it
 * **holds**, or one that is **published** in its scope. Neither is true of another
 * workspace's unpublished draft, and an unfiltered lookup here leaked exactly that
 * -- title, description, owner, who designated it and the view name -- to anyone who
 * guessed the id, while `exchangeFor` and `heldProductsFor` correctly withheld it.
 * A direct read has to enforce what the lists enforce; otherwise the URL is the
 * hole.
 */
export function volumeFor(
  workspace: string,
  id: string,
): ProductVolume | BucketVolume | null {
  const product = PRODUCT_RECORDS.find((r) => r.id === id)
  if (product) {
    const visible = holdingFor(product, workspace) !== null || product.published !== null
    return visible ? projectVolume(product, workspace) : null
  }
  return bucketVolumesFor(workspace).find((b) => b.id === id) ?? null
}

/** Every volume this workspace holds, both kinds, one list. */
export function volumesFor(workspace: string): (ProductVolume | BucketVolume)[] {
  return [...bucketVolumesFor(workspace), ...heldProductsFor(workspace)]
}

/**
 * No captures.
 *
 * Deliberately empty, and exported as such so a container cannot reach for a
 * fixture tree that does not exist. Minting is not wired (UNK-C2 open, no mint on
 * this stack), and a fixture capture would put invented bytes behind a real-looking
 * file tree -- the one lie on this surface with a cost measured in someone's
 * afternoon.
 */
export const CAPTURES: Record<string, Capture> = {}
