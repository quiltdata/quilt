/**
 * Data products: the read shape of the **local** volume model.
 *
 * A data product is a volume this stack's own registry holds a row for -- not a
 * listing read out of an external enterprise catalog. That is the whole
 * difference from the shape this file used to carry, and it changes who owns
 * every fact on the screen: the publishing *workspace* defines the product with
 * a SQL definition, the registry records the row and the holdings, a local
 * exchange records the requests and the publisher's decisions, and a mint hands
 * out short-lived credentials against a capture of what the definition selected.
 *
 * Grounded in `contrib/simon/creation-ux/model.md` (rev 2) and its `api/README.md`.
 * Three registers are kept apart there and are kept apart here, in comments:
 * *ruled* (model.md or a DEC states it), *freezing* (this week's design in
 * `arch/`, liable to move), *proposed* (a choice the sub-package makes). Nothing
 * in this file may render a proposal as a ruling.
 *
 * Two things this file will not do:
 *
 * - **Store a subscription's state.** The registry holds no approval state
 *   (DEC-42); *approved* is read back from the grant's existence. So there is no
 *   `state` field here -- only the evidence (`decision`, `grant`,
 *   `lastFailure`), from which `state.ts` derives what a screen says. A stored
 *   verdict would let a screen show "approved" while the grant is gone.
 * - **Claim readability.** Nothing here says a workspace can read a product's
 *   bytes. Listed, granted, minted and read are four separate facts (model.md
 *   invariant 1), and no field collapses them.
 */

/**
 * A workspace -- today a role (`MyRole` in the registry schema).
 *
 * Deliberately not a user. Grants land on the workspace's IAM role, never on a
 * person (model.md §Stacks and workspaces, *ruled*), so every grantee, every
 * subscriber row and every request is a workspace. A screen that renders a
 * person as the grantee breaks invariant 2.
 */
export interface Workspace {
  name: string
}

/** Registry `volumes.kind`. */
export type VolumeKind = 'BUCKET' | 'PRODUCT'

/**
 * The active workspace's relation to a volume -- registry `holdings.role`.
 *
 * `ATTACHED` is a plain bucket the workspace works in; `OWNER` publishes;
 * `SUBSCRIBER` consumes. A workspace reads only **its own slice** of `holdings`
 * (DEC-52, *ruled*), which is why a publisher's subscriber list comes from the
 * exchange record and never from this.
 */
export type HoldingRole = 'ATTACHED' | 'OWNER' | 'SUBSCRIBER'

export type HoldingLevel = 'RW' | 'RO'

export interface Holding {
  role: HoldingRole
  level: HoldingLevel
  /** Present when `role` is `SUBSCRIBER`. */
  subscription?: Subscription
}

/**
 * What Lake Formation said about the grant **when this was read**.
 *
 * Carried as evidence rather than folded into a state, because the read itself
 * can fail: `UNREAD` means the `ListPermissions` call did not answer, and a
 * screen must then say "state unknown" rather than pick a state (model.md
 * §States, R5). Folding this into a boolean would make an unanswered question
 * indistinguishable from a "no".
 */
export type GrantStatus = 'PRESENT' | 'ABSENT' | 'UNREAD'

export interface GrantObservation {
  status: GrantStatus
  /** When the read-back ran. Shown to the reader: *approved* means the grant read back at a time, not that a button was pressed. */
  at: Date
}

export type DecisionKind = 'APPROVE' | 'REJECT' | 'REVOKE'

/**
 * The publisher's decision, as the exchange record holds it.
 *
 * `by` is a user name -- who pressed the button -- which is *not* the grantee.
 * The grantee is always the subscriber workspace (invariant 2).
 */
export interface Decision {
  kind: DecisionKind
  by: string
  at: Date
  /** Reject only. Free text, shown to the requester verbatim. */
  reason?: string
  /** `"local"` in increment 1. */
  exchange: string
}

/**
 * An approve or revoke whose grant did not read back.
 *
 * Fig. 5's `else` branch made a record (*freezing*). It is why the publisher's
 * queue has an *approval failed* row rather than a toast: the decision was
 * recorded, the grant was not confirmed, and the request is still pending. A
 * client that dropped this would show the approval as success.
 */
export interface DecisionFailure {
  at: Date
  /** The grant call's error, verbatim. Not translated -- it may name Lake Formation internals. */
  cause: string
}

/**
 * One request in the exchange record, with the evidence a state is derived from.
 *
 * No `state` field: see the file header. `state.ts` derives it, and the
 * derivation is **face-dependent** -- a failed approval reads as *approval
 * failed* to the publisher and as *pending* to the subscriber, because the cause
 * is the publisher's to act on (model.md §States).
 */
export interface Subscription {
  id: string
  volumeId: string
  /** The requesting workspace. The grantee, if approved. */
  subscriber: Workspace
  /** The member who pressed request. Not the grantee. */
  requestedBy: string
  requestedAt: Date
  /** Null while pending. */
  decision: Decision | null
  grant: GrantObservation
  /** Set when the last decision's grant write did not read back. */
  lastFailure: DecisionFailure | null
}

/**
 * The definer view a product is defined by.
 *
 * `versionId` is half the definition identity the mint's capture key uses (the
 * other half is an expanded-text digest -- DEC-28, *ruled*). It is on the screen
 * because a revision advances it, and captures already minted keep serving the
 * version they were minted against until their credentials expire (invariant 5).
 */
export interface Definition {
  /** Glue view name in the product database. */
  view: string
  versionId: string
  /**
   * The SQL. Owner-only in the API proposal; whether a subscriber may read it is
   * UNK-C6 (a grantee can `DESCRIBE` the view in Glue today, so hiding it here
   * hides nothing from a determined reader). Null when not returned.
   */
  sql: string | null
  /** Substrate buckets the view selects from. Shown as shape without bytes. */
  referencedBuckets: string[]
  authoredAt: Date
}

/** Publication scope. `STACK` to start (DEC-42); more later. */
export type PublishScope = 'STACK'

export interface Publication {
  scope: PublishScope
  publishedAt: Date
}

/**
 * What a stock S3 client configures to read the product.
 *
 * A product *is* an S3-compatible bucket at the proxy: `bucket` is the
 * `volume_id`, path-style, at the proxy endpoint (DEC-48 as amended). This is
 * what the Connect screen teaches; it is not a credential and never carries one.
 */
export interface VolumeAddress {
  endpoint: string
  bucket: string
  connector: string
}

/** Common to both kinds. */
interface VolumeBase {
  /**
   * `volume_id` -- a label under S3's bucket-name rule, unique per stack, and
   * **immutable**: a rename is a new row (DEC-23 as amended, DEC-50, *ruled*).
   * That is why the creation screen has an Id field and a Title field rather
   * than one "Name".
   */
  id: string
  kind: VolumeKind
  title: string
  description: string | null
  /** The active workspace's holding. Null when the volume is merely listed to it. */
  holding: Holding | null
}

/**
 * A bucket volume.
 *
 * Carries no bucket detail of its own: the catalog already renders buckets, and
 * the volume model *adds* a kind rather than moving anything a bucket user has
 * (the stable-destination rule). Everything a bucket screen needs still comes
 * from the existing bucket queries.
 */
export interface BucketVolume extends VolumeBase {
  kind: 'BUCKET'
}

export interface ProductVolume extends VolumeBase {
  kind: 'PRODUCT'
  /** The publishing workspace. */
  owner: Workspace
  designatedBy: string
  designatedAt: Date
  definition: Definition
  /** Null when `shared` is false. Unpublished is a real state, not an absence of the product. */
  published: Publication | null
  address: VolumeAddress
  /**
   * The publisher's queue and its subscriber list -- **owner face only**, null
   * for every other workspace.
   *
   * Both read the exchange record joined to the grant read-back, never another
   * workspace's `holdings` rows, which a workspace cannot read (DEC-52). The
   * queue includes approvals recorded as failed: they are still pending.
   */
  requests: Subscription[] | null
  subscribers: Subscription[] | null
}

export type Volume = BucketVolume | ProductVolume

export const isProduct = (v: Volume): v is ProductVolume => v.kind === 'PRODUCT'

/**
 * One entry of a capture, as a mint's drain reported it.
 *
 * `readableThroughProduct` is the honest encoding of DEC-44 (*ruled*): an entry
 * registered by the definition but sitting outside the owning workspace's reach
 * **lists and fails at read** with AccessDenied. So it is listed like any other
 * entry and fails when opened -- never dropped, which would make the product
 * look smaller than it is, and never marked unreadable in advance, which would
 * claim knowledge the listing does not carry.
 *
 * Sizes and hashes are the *capture's*, from the substrate at the join --
 * they are not the definition SQL's own columns (invariant 4).
 */
export interface CaptureEntry {
  /** Logical key within the product, e.g. `plates/A01.tiff`. */
  logicalKey: string
  /** Physical location the drain resolved. Shown so a reader can see what a product composes. */
  bucket: string
  key: string
  versionId?: string
  sizeBytes?: number
  /**
   * The hash the proxy will verify against, in its own namespaced form
   * (`dpp.<type>.<value>`). Attests the *registered entry*, not that the bytes
   * at rest are currently identical (model.md §The boundary).
   */
  hash?: string
  /**
   * False for an entry whose bytes are outside the owning workspace's reach.
   * Undefined means the listing said nothing, which is the ordinary case --
   * absence of a `false` is not a promise of readability.
   */
  readableThroughProduct?: boolean
}

/**
 * What a mint returned: a capture, not a guarantee.
 *
 * A successful mint proves the drain ran as the requester and a capture exists.
 * It does **not** prove every entry's bytes are readable (invariant 1, DEC-44),
 * which is why this type carries `entries` and an expiry and makes no readability
 * claim at all.
 */
export interface Capture {
  id: string
  mintedAt: Date
  /** The workspace the drain ran as. On screen, so a reader knows who minted. */
  mintedAs: Workspace
  /** The bounds the drain applied, in the mint's words. Shown beside a capture of zero, so "no files" can be read as a capture rather than an absence. */
  bounds: string
  entries: CaptureEntry[]
  /**
   * When the minted credentials expire.
   *
   * The revocation grain: revoke removes the grant, and credentials minted
   * before it keep serving until this time (model.md §The mint, *ruled*). Every
   * revoke affordance must say so.
   */
  credentialsExpireAt: Date
}
