/**
 * What to tell a reader when an act cannot be performed, or a mint was refused.
 *
 * Two separate vocabularies live here, and merging them would be the mistake:
 *
 * - **`UNAVAILABLE_ACTS`** -- a write the prototype cannot perform, because the
 *   registry serves no volume, exchange or mint API yet. Every publisher and
 *   subscriber mutation is in this state. Its copy says the act is not wired,
 *   never that it failed and never that it succeeded: a fixture that reported a
 *   successful designation would teach a reader that a backend exists, and the
 *   whole point of shipping this behind a flag is to design the surface without
 *   claiming the plumbing.
 * - **`MINT_REFUSALS`** -- a refusal of *one mint attempt*, in the mint's own
 *   words. Deliberately not lifecycle states: *no grant* is not "you are not
 *   subscribed" (a grant can be missing after an approval), and *definition
 *   failed* is not "the publisher's definition is broken" (the requester's
 *   authority and the run's conditions bear on it). Whether the browser face may
 *   name a cause at all is UNK-C5, so the uniform rendering is here too.
 *
 * Copy lives in this module rather than inline in JSX so a spec can pin the
 * distinctions -- and on this surface the distinctions *are* the honesty, so a
 * later "simplification" that collapses two of them is worth failing a test over.
 *
 * Register, from PRODUCT.md and the precedents in `PackageTree.tsx` and
 * `RehydrateDialog.tsx`: state what is true, name the specific thing to ask for
 * rather than "contact your administrator", no blame, no "Oops".
 */

/**
 * A write the local volume model defines but nothing serves yet.
 *
 * One id per act rather than a single "not implemented", because the acts land at
 * different times behind different units (U16c, U16d, U19, U25) and a reader
 * deserves to know which of them is missing. The screens render the control and
 * this notice, rather than hiding the control: hiding it would misreport the
 * design as smaller than it is, and the surface is what is being reviewed.
 */
export type UnavailableActId =
  | 'DESIGNATE'
  | 'REVISE'
  | 'UPDATE_METADATA'
  | 'PUBLISH'
  | 'UNPUBLISH'
  | 'APPROVE'
  | 'REJECT'
  | 'REVOKE'
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'MINT'

export interface UnavailableAct {
  /** What the act would do, so the notice reads as a description of the design rather than an error. */
  title: string
  /** One sentence: what is missing, named. */
  body: string
  /** The unit that lands it, so a reader can go and look. */
  unit: string
}

export const UNAVAILABLE_ACTS: Record<UnavailableActId, UnavailableAct> = {
  DESIGNATE: {
    title: 'Designating a product is not wired yet',
    body:
      'Creating a product runs a five-step saga on the registry — product database, owner grant, view, validation, row — ' +
      'and this stack serves none of it. Nothing was created.',
    unit: 'U16c',
  },
  REVISE: {
    title: 'Revising a definition is not wired yet',
    body:
      'A revision authors a new view version on the registry. Nothing was changed, and the version this product ' +
      'points at is unchanged.',
    unit: 'U16c',
  },
  UPDATE_METADATA: {
    title: 'Editing title and description is not wired yet',
    body: 'The registry serves no volume row to write. Nothing was changed.',
    unit: 'U16d',
  },
  PUBLISH: {
    title: 'Publishing is not wired yet',
    body:
      'Publishing writes the volume row and adds a listing to the exchange. Neither exists on this stack, so ' +
      'no listing was created.',
    unit: 'U16d, U19',
  },
  UNPUBLISH: {
    title: 'Unpublishing is not wired yet',
    body:
      'Unpublishing removes the listing only — it does not touch a holding or a grant. Neither the listing nor ' +
      'the row can be written here, so nothing was changed.',
    unit: 'U16d, U19',
  },
  APPROVE: {
    title: 'Approving is not wired yet',
    body:
      'An approval records a decision, writes the subscriber workspace’s grant, and reads it back. The exchange ' +
      'and the grant path do not exist on this stack, so no grant was written.',
    unit: 'U19',
  },
  REJECT: {
    title: 'Rejecting is not wired yet',
    body: 'A rejection records a decision in the exchange. The exchange does not exist on this stack.',
    unit: 'U19',
  },
  REVOKE: {
    title: 'Revoking is not wired yet',
    body:
      'A revoke removes the grant and records the decision; credentials already minted keep working until they ' +
      'expire. Nothing was removed here.',
    unit: 'U19',
  },
  SUBSCRIBE: {
    title: 'Requesting access is not wired yet',
    body:
      'A request writes your workspace’s holding row and a request in the exchange. Neither exists on this ' +
      'stack, so no request was filed.',
    unit: 'U16d, U19',
  },
  UNSUBSCRIBE: {
    title: 'Withdrawing is not wired yet',
    body:
      'Withdrawing a request, and leaving an approved subscription, are the registry’s to define (what happens ' +
      'to the request and to a grant is still open). Nothing was changed.',
    unit: 'U16d',
  },
  MINT: {
    // The one that would be most tempting to fake, and the most expensive to
    // fake: a fabricated mint would put invented bytes behind a real-looking
    // file tree. It also cannot be faked *safely* even with goodwill, because
    // which session the catalog may present to the mint is itself unanswered
    // (UNK-C2) -- and the catalog must never fall back to the workspace's
    // S3-only session to read a product's objects directly (model.md §Reading a
    // product, step 6).
    title: 'Minting access is not wired yet',
    body:
      'Reading a product means asking the registry to mint short-lived credentials against a capture, then ' +
      'reading through the proxy. This stack serves no mint, and the catalog does not read a product’s objects ' +
      'any other way.',
    unit: 'U25',
  },
}

/**
 * Cause classes a refused mint may carry, as model.md names them.
 *
 * These are outcomes of **one attempt**, not durable states of a product. The
 * screen shows the cause and, beside it, re-reads the derived subscription state
 * — so a *no grant* refusal sits next to whatever the record actually says,
 * rather than being translated into a claim about the subscription.
 */
export type MintRefusalCause =
  | 'NO_GRANT'
  | 'NO_SUCH_VOLUME'
  | 'DEFINITION_FAILED'
  | 'OVER_CAP'
  | 'OVER_BUDGET'
  /** D-F may rule that no cause is disclosed. Then there is one line and the last derived state. */
  | 'UNIFORM'

export interface MintRefusal {
  /** The cause in the mint's words, for the line "Minting was refused: <label>". */
  label: string
  /** What is and is not implied. Never a lifecycle claim. */
  body: string
}

export const MINT_REFUSALS: Record<MintRefusalCause, MintRefusal> = {
  NO_GRANT: {
    label: 'no grant',
    // Explicitly severed from the subscription's state: a grant can be missing
    // *after* an approval, which is one of the disagreement states, and telling
    // a reader "you are not subscribed" when a decision exists is simply wrong.
    body:
      'The mint found no grant for your workspace on this product’s view. That is not the same as your ' +
      'subscription’s state — see it beside this.',
  },
  NO_SUCH_VOLUME: {
    label: 'no such volume',
    body: 'The registry has no volume with this id.',
  },
  DEFINITION_FAILED: {
    label: 'definition failed',
    // Not "the publisher's definition is broken": the run happens as the
    // requester, so the requester's authority and the run's conditions bear on
    // the outcome too.
    body:
      'The definition did not run for this attempt. The requester’s authority and the run’s conditions bear ' +
      'on this as much as the definition does.',
  },
  OVER_CAP: {
    label: 'over cap',
    body: 'The attempt exceeded a cap the mint enforces.',
  },
  OVER_BUDGET: {
    label: 'over budget',
    body: 'The attempt exceeded a budget the mint enforces.',
  },
  UNIFORM: {
    label: 'refused',
    body:
      'Quilt could not mint access to this product for your workspace just now. No cause is disclosed for a ' +
      'refused mint.',
  },
}
