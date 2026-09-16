/**
 * Deriving what a screen says about a subscription, from the evidence.
 *
 * The registry stores **no approval state** (DEC-42, *ruled*): *approved* is
 * read back from the grant's existence on the view. So every state a screen
 * shows is computed here, at read time, from three facts -- the decision, the
 * grant read-back, and whether the last decision's grant write was recorded as
 * failed -- and never from a cached verdict.
 *
 * The reason this is a module of its own, with the disagreements as named states
 * rather than an `approved: boolean`: the interesting cases are the ones where
 * the record and the grant *disagree*, and those are exactly where a screen
 * lies. A decision that says approve with no grant present is not "approved",
 * and it is not "pending" either. Collapsing it into either is the failure this
 * file exists to prevent (model.md §States, screen rule R5). Drift between
 * approvals and grants is an audit read, not a component -- so a screen reports
 * it and does not resolve it.
 *
 * The derivation is **face-dependent**, which is the other reason it is not a
 * field on the type. A decision recorded as failed reads as *approval failed* to
 * the publisher, who can retry it, and as *pending* to the subscriber, for whom
 * nothing has happened and whose screen must not surface a cause that may name
 * Lake Formation internals.
 */

import type { Subscription } from './types'

/**
 * What a screen may say about a subscription.
 *
 * Nine states, not four. The four agreeing ones (`PENDING`, `APPROVED`,
 * `REJECTED`, `REVOKED`) are the model's; the rest are the disagreements and the
 * failed read-back, each of which must render as itself:
 *
 * - `APPROVAL_FAILED` -- the decision was recorded as failed and the request is
 *   **still pending**. The publisher retries. Never rendered as success, and
 *   never allowed to vanish from the queue.
 * - `APPROVED_GRANT_MISSING` -- approve, no failure recorded, and no grant.
 *   Nobody knows why; the audit does. Deliberately not folded into `PENDING`,
 *   which would tell the subscriber to wait for a decision that was made.
 * - `REJECTED_GRANT_PRESENT` -- rejected, yet a grant is there. The same audit
 *   fact from the other side.
 * - `REVOKE_FAILED` -- revoke recorded, grant still present: the removal did not
 *   take. The publisher retries; the subscriber still reads as approved, because
 *   they still are.
 * - `UNKNOWN` -- the read-back call itself failed. Not a state of the
 *   subscription; a state of our knowledge of it. Rendered as "last confirmed X
 *   at t", never as any of the above.
 */
export type SubscriptionState =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED'
  | 'APPROVAL_FAILED'
  | 'APPROVED_GRANT_MISSING'
  | 'REJECTED_GRANT_PRESENT'
  | 'REVOKE_FAILED'
  | 'UNKNOWN'

/**
 * Which face is reading.
 *
 * Not a persona -- a workspace is a role, one active at a time, and these are
 * the faces the same workspace shows (model.md §Actors). The face decides what a
 * failed approval reads as; see the file header.
 */
export type Face = 'publisher' | 'subscriber'

/**
 * States in which a grant is confirmed present right now.
 *
 * The **only** sanctioned basis for offering a read affordance. Note what is
 * absent: `APPROVED_GRANT_MISSING` (approved, but the grant is not there) and
 * `UNKNOWN` (we could not look). A Files tab offered on either would mint and
 * fail, which is the "listed ≠ readable" break in its most expensive form.
 *
 * `REVOKE_FAILED` **is** here, and that is not a slip: the grant is present, so
 * the subscriber can still read, and pretending otherwise would tell them access
 * is gone while it demonstrably is not. That honesty is the same one the revoke
 * copy carries -- revoked is not cut off until the credentials expire.
 */
export function grantIsPresent(state: SubscriptionState): boolean {
  return state === 'APPROVED' || state === 'REVOKE_FAILED'
}

/**
 * Whether this state is a disagreement between the record and the grant, or a
 * failed read-back.
 *
 * Drives the amber mark and the evidence line. Kept as a predicate so a screen
 * cannot enumerate "the normal ones" and quietly leave a new disagreement
 * rendering as nothing.
 */
export function isDisagreement(state: SubscriptionState): boolean {
  switch (state) {
    case 'APPROVAL_FAILED':
    case 'APPROVED_GRANT_MISSING':
    case 'REJECTED_GRANT_PRESENT':
    case 'REVOKE_FAILED':
    case 'UNKNOWN':
      return true
    default:
      return false
  }
}

/**
 * The state to show, for one face.
 *
 * Order matters. `UNREAD` is checked **first**, before any decision: a decision
 * plus an unreadable grant is not a state of the subscription, and reading the
 * decision alone would produce a confident `APPROVED` from a read that never
 * answered.
 */
export function deriveState(sub: Subscription, face: Face): SubscriptionState {
  // The read-back failed. Nothing below can be answered, whatever the record
  // says -- so this precedes the decision switch rather than sitting inside it.
  if (sub.grant.status === 'UNREAD') return 'UNKNOWN'

  const present = sub.grant.status === 'PRESENT'

  if (!sub.decision) {
    // No decision. A failure recorded against a pending request means an approve
    // was attempted and its grant did not read back (Fig. 5's `else`): the
    // publisher must see that and retry, and the subscriber sees a plain pending,
    // since nothing has happened for them and the cause is not theirs to act on.
    if (sub.lastFailure && face === 'publisher') return 'APPROVAL_FAILED'
    return 'PENDING'
  }

  switch (sub.decision.kind) {
    case 'APPROVE':
      if (present) return 'APPROVED'
      // Approve, no grant. Two different situations, and the difference is
      // whether the write was *recorded* as having failed. With a record, the
      // publisher has a retry and the subscriber waits. Without one, nobody
      // attempted-and-failed -- the grant went missing after the fact, which is
      // an audit fact and is reported to both, unresolved.
      if (sub.lastFailure) return face === 'publisher' ? 'APPROVAL_FAILED' : 'PENDING'
      return 'APPROVED_GRANT_MISSING'
    case 'REJECT':
      return present ? 'REJECTED_GRANT_PRESENT' : 'REJECTED'
    case 'REVOKE':
      // The grant is still there, so the removal did not take. Note the
      // subscriber's reading: they see the state their access actually has.
      if (present) return face === 'publisher' ? 'REVOKE_FAILED' : 'APPROVED'
      return 'REVOKED'
  }
}

export interface StateCopy {
  /** Short label for a row, a chip or a list line. */
  label: string
  /**
   * The evidence, in one sentence: what the record says and what the grant read
   * back, with times. On screen because *approved* means a grant read back at a
   * time, not that somebody pressed a button.
   */
  detail: string
  /** True when the label needs an amber mark: a disagreement or an unknown. */
  attention: boolean
}

const at = (d: Date) => d.toLocaleString()

/**
 * The copy for a state, with its evidence filled in.
 *
 * Copy lives here rather than inline in JSX so a spec can pin the distinctions.
 * That matters more than usual on this surface: the states most tempting to
 * "simplify" back into one are exactly the ones whose separation is the model's
 * honesty, and a test that asserts the strings catches the collapse.
 *
 * Register, per PRODUCT.md and the existing precedents: state what is true, name
 * who can act, no blame and no "Oops". A governed refusal is a normal state in a
 * product whose premise is per-workspace permission, so none of this is an error.
 */
export function stateCopy(sub: Subscription, face: Face): StateCopy {
  const state = deriveState(sub, face)
  const d = sub.decision
  const g = sub.grant

  switch (state) {
    case 'PENDING':
      return {
        label: 'Pending',
        detail: `Requested by ${sub.requestedBy} on ${at(sub.requestedAt)}. Waiting for a decision.`,
        attention: false,
      }
    case 'APPROVED':
      return {
        label: 'Approved',
        detail: `Approved by ${d?.by ?? 'unknown'} on ${d ? at(d.at) : 'unknown'}. Grant confirmed ${at(g.at)}.`,
        attention: false,
      }
    case 'REJECTED':
      return {
        label: 'Rejected',
        detail: d?.reason
          ? `Rejected by ${d.by} on ${at(d.at)}: ${d.reason}`
          : `Rejected by ${d?.by ?? 'unknown'} on ${d ? at(d.at) : 'unknown'}.`,
        attention: false,
      }
    case 'REVOKED':
      return {
        label: 'Revoked',
        detail:
          `Access revoked by ${d?.by ?? 'unknown'} on ${d ? at(d.at) : 'unknown'}. ` +
          // The TTL is the revocation granularity (model.md §The mint). Saying
          // "access removed" here would assert a security outcome that is not
          // true yet.
          'Credentials minted before then keep working until they expire.',
        attention: false,
      }
    case 'APPROVAL_FAILED':
      return {
        label: 'Approval failed',
        detail:
          `Approved by ${d?.by ?? sub.requestedBy} at ${sub.lastFailure ? at(sub.lastFailure.at) : at(g.at)}; ` +
          `the grant did not read back: ${sub.lastFailure?.cause ?? 'cause not recorded'}. ` +
          'The request is still pending.',
        attention: true,
      }
    case 'APPROVED_GRANT_MISSING':
      return {
        label: 'Approved — grant missing',
        detail: `Approved on ${d ? at(d.at) : 'unknown'}; the grant could not be confirmed (${at(g.at)}).`,
        attention: true,
      }
    case 'REJECTED_GRANT_PRESENT':
      return {
        label: 'Rejected — grant present',
        detail: `Rejected on ${d ? at(d.at) : 'unknown'}; a grant is still present (${at(g.at)}).`,
        attention: true,
      }
    case 'REVOKE_FAILED':
      return {
        label: 'Revoke failed',
        detail:
          `Revoked on ${d ? at(d.at) : 'unknown'}; the grant is still present (${at(g.at)}). ` +
          'The removal did not take.',
        attention: true,
      }
    case 'UNKNOWN':
      return {
        label: 'State unknown',
        // Names the last thing that was actually confirmed, rather than
        // asserting a state from the decision alone.
        detail:
          `Last confirmed: ${lastConfirmed(sub)} at ${at(g.at)}. ` +
          'The grant could not be read just now.',
        attention: true,
      }
  }
}

/**
 * What was last confirmed, for the `UNKNOWN` copy.
 *
 * Reads the decision only -- deliberately, since the grant is exactly what could
 * not be read. Naming the decision is honest; naming a state would not be.
 */
function lastConfirmed(sub: Subscription): string {
  if (!sub.decision) return 'requested'
  switch (sub.decision.kind) {
    case 'APPROVE':
      return 'approved'
    case 'REJECT':
      return 'rejected'
    case 'REVOKE':
      return 'revoked'
  }
}

/**
 * A product's holding as one short line for the volume list.
 *
 * The list says what the workspace's *relation* to a product is, never what it
 * may read: no counts, no "n of m readable" (invariant 1). A disagreement adds
 * the amber mark through `attention` and keeps the relation as the label.
 */
export function holdingSummary(
  holding: { role: string; subscription?: Subscription } | null,
): StateCopy | null {
  if (!holding) return null
  if (holding.role === 'OWNER') {
    return {
      label: 'Owner',
      detail: 'Your workspace publishes this product.',
      attention: false,
    }
  }
  if (holding.role === 'SUBSCRIBER' && holding.subscription) {
    const copy = stateCopy(holding.subscription, 'subscriber')
    return { ...copy, label: `Subscribed · ${copy.label.toLowerCase()}` }
  }
  return null
}

/** The minimum a screen needs to describe a workspace's standing on a product. */
export interface HoldingLike {
  holding: { role: string; subscription?: Subscription } | null
  published?: { publishedAt: Date } | null
}

/**
 * What one workspace may do with a product: the face, the state, and read access.
 *
 * **One function, because four screens derived this separately and disagreed.**
 * `Overview` read the state off `holding.subscription`, which is `null` for an
 * owner, and so hid "Open files" from the very workspace that publishes the
 * product — while `ProductVolume` mounted the Files tab for that same owner. Two
 * screens, one product, opposite answers. Anything deciding whether a read
 * affordance belongs calls this instead.
 *
 * `mayRead` is the owner **or** a confirmed grant. Never a listing, a holding or a
 * decision on its own: none of those is entitlement, and a Files tab offered on one
 * would mint and fail (screen rule R4).
 */
export interface ReadAccess {
  isOwner: boolean
  /** The subscriber-face state, or null when this workspace has no subscription. */
  state: SubscriptionState | null
  mayRead: boolean
}

export function readAccess(product: HoldingLike): ReadAccess {
  const isOwner = product.holding?.role === 'OWNER'
  const sub = product.holding?.subscription
  const state = sub ? deriveState(sub, 'subscriber') : null
  return {
    isOwner,
    state,
    mayRead: isOwner || (state !== null && grantIsPresent(state)),
  }
}

/**
 * The one-line relation for a volume-list row or card.
 *
 * The ⚠ prefix was spelled out at three call sites; it belongs with the label it
 * marks. Says what the workspace's relation *is* — never what it may read.
 */
export function relationLabel(product: HoldingLike): string {
  const copy = holdingSummary(product.holding)
  if (copy) return copy.attention ? `⚠ ${copy.label}` : copy.label
  return product.published ? 'Listed · not subscribed' : 'Unpublished'
}
