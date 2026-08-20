/**
 * What to tell a reader when a product's contents cannot be listed.
 *
 * Four reasons, four different people who can fix it. The temptation is one
 * "no files" message; the cost of that is sending someone to the wrong person,
 * or to nobody. All four states are live in AWS's `raja-poc` deployment today --
 * 4 of its 7 published products are in one of them
 * (`wb/dp-ui-slice-1/research/raja-poc-reverse-engineered.md` §5, §5a).
 *
 * Copy lives here rather than inline in JSX so it can be asserted on directly.
 * The distinctions are the product decision; a spec that pins them catches a
 * later "simplification" that collapses two states back into one.
 *
 * Register, from `PRODUCT.md` and the design critiques: plainly stated, blame
 * free, no "Oops". Modeled on the existing precedents --
 * `PackageTree.tsx` ("You don't have access to this object") and
 * `RehydrateDialog.tsx`, which names the exact IAM action to ask for rather than
 * saying "contact your administrator". Naming the specific thing to request is
 * both kinder and more actionable.
 */

import type { UnavailableReason } from './types'

export interface Unavailable {
  /** Page-level heading. `h5` is the ceiling app-wide (No-Display-Font Rule). */
  title: string
  /** One sentence: what is true. Never speculation about why. */
  body: string
  /**
   * Who can change this, and what to ask them for. `null` when nobody can --
   * offering a remedy that does not exist is worse than admitting there is none.
   */
  remedy: string | null
  /**
   * Whether this is a permission boundary rather than a fault.
   *
   * Drives presentation: a governed denial is a normal state in a product whose
   * premise is per-bucket permissions, so it must not be rendered as an error.
   * There is no error-red token in the palette and reaching for one here would
   * misreport a working system as a broken one.
   */
  governed: boolean
}

export const UNAVAILABLE: Record<UnavailableReason, Unavailable> = {
  EMPTY: {
    title: 'No files',
    body: 'This product resolves, and the revision it points at contains no files.',
    // Nothing to fix. An empty package is a real thing to publish, and the
    // honest answer is that the contents are empty rather than hidden.
    remedy: null,
    governed: false,
  },

  NOT_FOUND: {
    title: 'Contents not found',
    body:
      'This product points at a package that does not exist in the registry it names. ' +
      'The listing was published, but its target was not.',
    // Deliberately not "request access": no grant fixes this, and suggesting one
    // sends the reader to an admin who will find nothing wrong on their side.
    // Live example: 4 of raja-poc's 7 listings resolve to nothing in the
    // registry configured for that deployment (research §5).
    remedy: 'Ask whoever publishes this product to check its target.',
    governed: false,
  },

  NOT_A_MEMBER: {
    title: 'Contents not visible to you',
    body:
      'You can see that this product exists, but listing its contents needs ' +
      'membership in the catalog project that owns it.',
    // Verified as its own layer, not inferred: the same AWS admin credential got
    // AccessDenied on one DataZone project and succeeded on another, so this is
    // project membership and an IAM grant will not touch it (research §2).
    remedy: 'Ask a catalog admin to add you to the owning project.',
    governed: true,
  },

  REGISTRY_UNREADABLE: {
    title: 'Storage not readable by you',
    body:
      'The catalog authorized you for this product, but its files live in storage ' +
      'you cannot read — commonly a bucket in another account.',
    // The pair most tempting to merge with NOT_A_MEMBER, and the reason not to:
    // this one is a bucket policy, that one is a catalog grant. Different
    // system, different owner, and a reader told the wrong one wastes a round
    // trip discovering the message was wrong.
    remedy: 'Ask a storage admin for read access to the registry bucket.',
    governed: true,
  },
}

/**
 * The reason to show for a member, given what the adapter reported.
 *
 * `EMPTY` is the fallback when a member is `UNAVAILABLE` with no reason stated.
 * That is the wrong-but-harmless choice on purpose: claiming "no files" about a
 * product that is actually restricted overstates nothing and accuses nobody,
 * whereas defaulting to a permission story would invent a denial that may not
 * exist and send the reader to an admin for no reason.
 */
export function reasonFor(
  contentsSource: string,
  reason: UnavailableReason | undefined,
): Unavailable | null {
  if (contentsSource !== 'UNAVAILABLE') return null
  return UNAVAILABLE[reason ?? 'EMPTY']
}
