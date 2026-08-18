/**
 * Access requests: the delegation record.
 *
 * The record is **Quilt's**, not the catalog's, and that is a forced move
 * rather than a preference. Only DataZone can enumerate pending requests
 * (`enumerableRequests`); Unity can initiate one but not list them, and
 * Snowflake has no request flow for anything but organizational listings. So
 * `mayBranchOn('enumerableRequests')` is *false* -- one supporting platform,
 * and not a documented exception -- which means a queue built by branching on
 * the platform would exist on one third of installations and silently not
 * exist on the rest.
 *
 * Owning the record here inverts that: the queue always exists because Quilt
 * wrote it, and platform state is *reconciled in* as enrichment where the
 * platform can be asked (contract §5.3).
 *
 * Two things deliberately absent from this file:
 *
 * - **No `expiresAt`.** No target platform supports time-bounded access
 *   (contract §5.4). A field here would invite an "access until Friday" control
 *   that nothing can enforce, and an unenforceable expiry reads as a security
 *   boundary while being decoration.
 * - **No per-user access verdict.** Same reason as
 *   `Capabilities.effectiveAccessForNamedUser` -- see `types.ts`.
 */

import type { PrincipalType } from './types'

/**
 * Where a request has got to.
 *
 * `SUBMITTED` and `PENDING` are genuinely different states, not a stylistic
 * split: `SUBMITTED` means Quilt holds the record and the catalog has not
 * acknowledged it (or cannot be asked), while `PENDING` means the catalog
 * itself reports it as awaiting a decision. Collapsing them would let a request
 * that never reached the catalog render identically to one sitting in an
 * approver's queue.
 *
 * `UNKNOWN` exists because reconciliation can fail. It is not an error state --
 * on Unity it is the *expected* steady state for a request we initiated but
 * cannot list.
 */
export type RequestStatus =
  | 'SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVOKED'
  | 'UNKNOWN'

/**
 * The catalog's own record, when one exists and we are able to see it.
 *
 * `reconciledAt` is a read timestamp, never a sync guarantee. No platform emits
 * product- or subscription-level change events (contract §6.3), so this is
 * always "when we last looked", and a request can change state with nothing
 * emitted.
 */
export interface PlatformRecord {
  /** Native id -- e.g. a DataZone subscription request id. */
  id: string
  reconciledAt: Date
}

/**
 * Who the access actually lands on.
 *
 * Not merged into `requestedBy`, because on DataZone they are routinely
 * different principals: a subscription is held by a **project**, so approving
 * one person's request grants the entire project. A UI that showed only the
 * requester would misreport the blast radius of an approval as one person.
 */
export interface Beneficiary {
  type: PrincipalType
  label: string
}

export interface AccessRequest {
  /** Quilt-owned and stable. Not the platform's id -- see `platformRecord`. */
  id: string
  /**
   * The product this is about.
   *
   * Note the known weakness: product ids are synthesized from the binding and
   * are *not* stable across renames (see `DataProduct.id`). A Unity schema
   * rename silently repoints this with no event emitted, so a long-lived
   * request can end up orphaned. Reconciliation must tolerate a miss rather
   * than treat one as corruption.
   */
  dataProductId: string
  requestedBy: string
  beneficiary: Beneficiary
  /** Free text from the requester. Shown to approvers verbatim. */
  reason: string
  createdAt: Date
  status: RequestStatus
  platformRecord: PlatformRecord | null
  /**
   * Whether a revoke left live permissions behind. Only meaningful when
   * `status` is `REVOKED`.
   *
   * DataZone's revoke takes `retainPermissions`, and when true the underlying
   * Lake Formation permissions **remain in force** while DataZone stops
   * managing them (contract §5.4). `null` means we could not determine it --
   * which must be treated as "possibly still granted", never as "clean".
   */
  retainedPermissions: boolean | null
}

/**
 * Whether access may still be in force despite a revocation.
 *
 * The honest reading of the `retainPermissions` trap. A revoked request with
 * retained permissions is a revocation *that did not take effect*, and one with
 * `null` is a revocation whose effect we cannot confirm. Both must render as
 * unresolved rather than as a clean ending -- showing "revoked" full stop would
 * assert a security outcome the catalog never guaranteed.
 *
 * Returns false for every non-revoked status: this asks specifically about the
 * revoke trap, not about whether access exists generally.
 */
export function accessMayPersistAfterRevoke(request: AccessRequest): boolean {
  return request.status === 'REVOKED' && request.retainedPermissions !== false
}

/**
 * Whether a request has reached an end state that needs no further watching.
 *
 * `REVOKED` is deliberately *not* unconditionally terminal -- see
 * `accessMayPersistAfterRevoke`. `UNKNOWN` is not terminal either: it means
 * reconciliation could not answer, and an unanswered question is not a
 * conclusion.
 */
export function isSettled(request: AccessRequest): boolean {
  switch (request.status) {
    case 'APPROVED':
    case 'REJECTED':
    case 'CANCELLED':
      return true
    case 'REVOKED':
      return !accessMayPersistAfterRevoke(request)
    default:
      return false
  }
}

/**
 * Whether approving this request would grant access beyond the requester.
 *
 * True whenever the beneficiary is a collective principal. Drives the wording
 * an approver sees: granting to a DataZone project or a Unity group is not the
 * same act as granting to a person, and the difference is invisible unless the
 * UI says it.
 */
export function grantsBeyondRequester(request: AccessRequest): boolean {
  const { type, label } = request.beneficiary
  if (type === 'PROJECT' || type === 'GROUP' || type === 'ROLE') return true
  // A user-typed beneficiary who is not the requester is still a widening, just
  // a single-seat one.
  return type === 'USER' && label !== request.requestedBy
}
