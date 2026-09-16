/**
 * The adapter port: the one boundary between the UI and the registry.
 *
 * Containers must not reach for `fixtures` directly. They ask this port, and
 * something behind it decides where the answer comes from -- today a fixture
 * table, later the registry's GraphQL (`volumes`, `volume`, `exchangeListing`,
 * and the own-side and exchange mutations proposed in
 * `contrib/simon/creation-ux/api/README.md`). Swapping that must not touch a
 * container.
 *
 * **Async on purpose, even though the fixture implementation is not.** A real
 * adapter is a network call: it fails, it takes time. Modelling the port as
 * synchronous would let every call site assume data is always present, and every
 * one of them would need reopening the day the registry serves this.
 *
 * The shape reads and writes the **local** volume model, not an external
 * catalog's listing. Consequences that show up as absences here:
 *
 * - **No `whoHasAccess(user, product)`.** Grants land on workspace roles, never
 *   on people (model.md invariant 2, *ruled*), so a per-person verdict is not a
 *   thing the model has. The publisher's face answers *which workspaces* are
 *   granted, which is what `subscribers` carries.
 * - **No `listHoldings(workspace)`.** A workspace reads only its own slice of
 *   `holdings` (DEC-52, *ruled*). A publisher learns its subscribers from the
 *   exchange record, and this port offers no way to ask otherwise.
 * - **No read path for a product's bytes on the adapter itself.** Reading is a
 *   mint plus an S3 client at the proxy (`MintingAdapter`), separately declared,
 *   because a stack can serve the registry and not the mint.
 *
 * The write methods are the reason `Result` types are unions rather than throws:
 * the registry's own convention is a union of one success type and typed error
 * arms (`BucketAddResult = BucketAddSuccess | BucketAlreadyAdded | ...`), and an
 * expected outcome -- an id already taken, an approval whose grant did not read
 * back -- is data a screen renders, not an exception.
 */

import type { MintRefusalCause, UnavailableActId } from './unavailable'
import type { Capture, Subscription, Volume, ProductVolume } from './types'

export type { UnavailableActId }

/**
 * The refusal every write on a stack with no registry API returns.
 *
 * A single arm on every write union, and the honest one for this prototype: the
 * act is not wired, so nothing happened. Distinct from a *failure*, which would
 * mean the registry was asked and said no -- and distinct from success, which is
 * the arm a fixture must never fabricate. `act` names which act is missing so the
 * screen can show the specific notice from `UNAVAILABLE_ACTS`.
 */
export interface ActUnavailable {
  ok: false
  reason: 'UNAVAILABLE'
  act: UnavailableActId
}

/** A write the registry refused for a stated reason. Reserved for a real adapter. */
export interface ActRefused {
  ok: false
  reason: 'REFUSED'
  /** The registry's arm, verbatim -- e.g. `VolumeIdTaken`, `NotOwner`, `NotListed`. */
  arm: string
  detail: string
}

export type WriteFailure = ActUnavailable | ActRefused

/**
 * What an adapter can be asked to read.
 *
 * Reads and writes are split across interfaces for the same reason the old port
 * split browsing from fetching: a stack can serve reads and not writes, and an
 * adapter for one should not have to implement methods that throw. Absence of a
 * method is the honest encoding, and the `supports*` guards let a container ask.
 */
export interface DataProductAdapter {
  /**
   * Every volume the **active workspace** holds -- both kinds, one list (B1).
   *
   * One list rather than two because a reader is browsing "what is here", and the
   * backing kind is a property of an entry rather than a reason for a second
   * pane. Never unioned across the user's other workspaces: one active workspace
   * (model.md §Stacks and workspaces, *ruled*).
   */
  listVolumes(): Promise<Volume[]>

  /**
   * One volume, or `null` when this stack has none with that id.
   *
   * `null` is an expected answer. Increment 1 keeps no tombstone for a retired
   * product (UNK-C3), so a retired product and a typo look the same here -- by
   * design, and the overview says exactly that rather than inventing a reason.
   */
  getVolume(id: string): Promise<Volume | null>

  /**
   * Products published in the active workspace's scope, held or not (S1).
   *
   * Reads the exchange record. A listing is *visibility*: nothing in this answer
   * says the workspace may read any of it.
   */
  listExchange(): Promise<ProductVolume[]>

  /** The active workspace, for the copy that names it on every act. */
  activeWorkspace(): Promise<string>
}

/**
 * Static checks on a draft definition, before designation.
 *
 * `sample` is `null` in this prototype and that is a modelled absence, not a gap:
 * Fig. 4 validates *after* the view exists in the product database, so before
 * designation there is no database to run in, and whether any run -- even a
 * `SELECT ... LIMIT 0` -- is affordable beforehand is UNK-C4. A fixture that
 * returned invented candidate rows would answer an open question in the reader's
 * favour and teach the shape of a preview nothing has agreed to.
 */
export interface DefinitionCheck {
  valid: boolean
  errors: string[]
  /** Buckets the SQL selects from, as parsed. */
  referencedBuckets: string[]
  /** Buckets named by the SQL that the workspace does not hold -- `BucketNotInReach` before anything runs. */
  outOfReach: string[]
  /** Null until UNK-C4 rules a pre-designation run affordable. */
  sample: null
}

/**
 * An adapter that can author and share products (the publisher face).
 *
 * Every method returns a union whose success arm a fixture adapter never
 * produces. That is the structural version of the honesty rule: the type makes
 * "pretend it worked" require inventing a success value, rather than making it
 * the path of least resistance.
 */
export interface PublishingAdapter extends DataProductAdapter {
  /**
   * Static checks only -- no run. Always answerable, because parsing SQL for
   * referenced buckets is a local computation and needs no registry.
   */
  checkDefinition(sql: string, reach: string[]): Promise<DefinitionCheck>

  /** P4. A saga with five named steps; the job's shape is `ProductJob` when this lands. */
  designate(input: {
    id: string
    title: string
    description: string
    sql: string
  }): Promise<{ ok: true; product: ProductVolume } | WriteFailure>

  /** P5. A new view version; captures already minted keep serving theirs to TTL. */
  revise(id: string, sql: string): Promise<{ ok: true } | WriteFailure>

  /** P6. */
  updateMetadata(
    id: string,
    input: { title?: string; description?: string },
  ): Promise<{ ok: true } | WriteFailure>

  /** P7. Publish adds the listing; unpublish removes **only** the listing (DEC-42). */
  publish(id: string): Promise<{ ok: true } | WriteFailure>
  unpublish(id: string): Promise<{ ok: true } | WriteFailure>

  /**
   * P9. Records the decision, writes the grant, reads it back.
   *
   * The success arm carries the subscription so the row re-renders from the
   * read-back rather than from an assumption -- an approve whose grant does not
   * read back is a *recorded failure* and the request stays pending, which the
   * caller learns by re-deriving the state, not from a boolean.
   */
  approve(
    subscriptionId: string,
  ): Promise<{ ok: true; subscription: Subscription } | WriteFailure>
  reject(
    subscriptionId: string,
    reason: string,
  ): Promise<{ ok: true; subscription: Subscription } | WriteFailure>
  /**
   * P12. Removes the grant.
   *
   * `credentialsOutstandingUntil` is on the success arm so no caller can report a
   * revoke as an ending: the TTL is the revocation granularity (model.md §The
   * mint, *ruled*), and a screen that says "access removed" is wrong until then.
   */
  revoke(
    subscriptionId: string,
  ): Promise<
    | { ok: true; subscription: Subscription; credentialsOutstandingUntil: Date }
    | WriteFailure
  >
}

export function supportsPublishing(
  adapter: DataProductAdapter,
): adapter is PublishingAdapter {
  return typeof (adapter as PublishingAdapter).designate === 'function'
}

/** An adapter that can request and leave subscriptions (the subscriber face). */
export interface SubscribingAdapter extends DataProductAdapter {
  /** S2. Writes the workspace's holding row and the request. Never returns an approval. */
  subscribe(
    volumeId: string,
  ): Promise<{ ok: true; subscription: Subscription } | WriteFailure>
  /** S4. Withdraw a pending request or leave an approved subscription; the registry defines the semantics (UNK-56). */
  unsubscribe(subscriptionId: string): Promise<{ ok: true } | WriteFailure>
}

export function supportsSubscribing(
  adapter: DataProductAdapter,
): adapter is SubscribingAdapter {
  return typeof (adapter as SubscribingAdapter).subscribe === 'function'
}

/**
 * The refused arm of a mint, as the outcome of one attempt.
 *
 * `cause` is optional because whether the browser face may name one is UNK-C5:
 * with a uniform ruling there is one line and the last derived state, and this
 * type carries both renderings rather than assuming the permissive one.
 */
export interface MintRefused {
  ok: false
  reason: 'REFUSED'
  cause?: MintRefusalCause
}

export type MintResult = { ok: true; capture: Capture } | MintRefused | ActUnavailable

/**
 * An adapter that can mint access to a product and list its capture.
 *
 * Separate from the reads because a stack can serve the registry's rows and not
 * the mint, and because minting is the one call whose absence has no workaround:
 * the catalog reads a product's objects **only** through a mint and the proxy,
 * and never falls back to the workspace's S3-only session even where that session
 * could reach the bucket (model.md §Reading a product, step 6; R3). An adapter
 * that omits this method is a product that cannot be read here, which is the
 * truthful state while UNK-C2 is open.
 */
export interface MintingAdapter extends DataProductAdapter {
  mint(volumeId: string, prefix?: string): Promise<MintResult>
}

export function supportsMinting(adapter: DataProductAdapter): adapter is MintingAdapter {
  return typeof (adapter as MintingAdapter).mint === 'function'
}
