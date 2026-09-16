/**
 * The adapter that stands in until the registry serves the volume model.
 *
 * Reads the fixture tables and nothing else. Its value is not the data -- it is
 * that every container goes through the port, so the day a GraphQL-backed adapter
 * lands, no container changes.
 *
 * # Every write returns `UNAVAILABLE`
 *
 * Not one of them pretends, and the alternatives are each worse:
 *
 * - *Omitting the write methods* would make `supportsPublishing()` false, and the
 *   screens would then hide the controls -- which hides the surface being reviewed
 *   and makes the design look smaller than it is.
 * - *Mutating the fixture arrays* would give a designation, an approval or a
 *   revoke the appearance of having worked. The reader would then be told a grant
 *   exists that nothing wrote, on a stack where nothing can write one.
 * - *Throwing* would render as an error, and there is no error here: the registry
 *   was never asked. Nothing failed, because nothing was attempted.
 *
 * So the methods exist, they are honest, and the honesty sits in the return type
 * rather than in copy a later edit could drift away from.
 *
 * `mint` is absent entirely, which is a stronger statement than an unavailable
 * write: there is no capture, no invented file tree, and no fallback. The catalog
 * reads a product's objects only through a mint and the proxy, never through the
 * workspace's S3-only session (model.md §Reading a product, step 6; screen rule
 * R3). `supportsMinting()` is therefore false and the Files tab renders a state.
 *
 * # Why the adapter is constructed per workspace
 *
 * Every read is scoped to one workspace, and the workspace is bound when the
 * adapter is made rather than passed per call. A workspace is a role, one active
 * at a time (model.md invariant 9), so there is no legitimate call that spans two
 * -- and an adapter that took the workspace as an argument would make a unioned
 * read a typo away.
 */

import type {
  DefinitionCheck,
  PublishingAdapter,
  SubscribingAdapter,
  UnavailableActId,
  WriteFailure,
} from './adapter'
import * as fixtures from './fixtures'
import type { ProductVolume, Volume } from './types'

/**
 * The one refusal, as a helper.
 *
 * `async` bodies with no `await` throughout this file, on purpose: the port is a
 * network boundary and its callers must treat it as one. Returning plain values
 * would let a call site depend on synchronous resolution, which the real adapter
 * would break.
 */
const unavailable = (act: UnavailableActId): WriteFailure => ({
  ok: false,
  reason: 'UNAVAILABLE',
  act,
})

/**
 * Bucket names a SQL string references, read out of `"schema"."table"` forms.
 *
 * A parse, not a validation: it is what lets the authoring screen name a bucket
 * outside the workspace's reach *before* anything runs, which is the one check
 * that genuinely needs no registry. It underreads deliberately -- a name it
 * cannot see is not reported -- and no screen presents it as proof a definition is
 * valid. Real validation is a `SELECT ... LIMIT 0` as the definer after the view
 * exists in the product database (Fig. 4 step 7), which this stack cannot run.
 *
 * Substrate databases use underscores where bucket names use hyphens, so the
 * schema name is mapped back.
 *
 * The capture is **lowercased**, not only underscore-mapped. The `i` flag makes the
 * character class match uppercase, and Athena identifiers are case-insensitive, so
 * `FROM "Fixture_Assay_Raw".plates` is valid SQL over a bucket the workspace holds
 * -- but it parsed to `Fixture-Assay-Raw`, which matches no bucket name, and the
 * check then reported a bucket outside the reach for a definition that was fine.
 */
export function referencedBuckets(sql: string): string[] {
  const found = new Set<string>()
  const re = /\b(?:from|join)\s+"?([a-z0-9][a-z0-9_-]*)"?\s*\./gi
  let m = re.exec(sql)
  while (m) {
    found.add(m[1]!.toLowerCase().replace(/_/g, '-'))
    m = re.exec(sql)
  }
  return Array.from(found).sort()
}

/**
 * Static checks on a draft definition.
 *
 * Exported separately from the adapter so a spec can exercise the rules without
 * standing one up. `sample` is null: whether any run is affordable before
 * designation is UNK-C4, and inventing candidate rows would answer that open
 * question in the reader's favour and teach a preview nothing has agreed to.
 */
export function checkDefinition(sql: string, reach: string[]): DefinitionCheck {
  const buckets = referencedBuckets(sql)
  const outOfReach = buckets.filter((b) => !reach.includes(b))
  const errors: string[] = []

  const trimmed = sql.trim()
  if (!trimmed) {
    errors.push('The definition is empty.')
  } else if (!/^select\b/i.test(trimmed)) {
    // A product is read-only and composes from physical volumes (DEC-50, DEC-51),
    // so a definition is a SELECT. Refused here rather than at designation, where
    // it would cost a saga.
    errors.push('A definition must be a SELECT statement.')
  }
  if (trimmed && !/\blogical_key\b/i.test(trimmed)) {
    // D-J's output contract is open (UNK-41), so this checks the one column the
    // model names -- the logical key readers address entries by -- and says
    // nothing about the rest. The copy says so, rather than implying a full
    // contract check ran.
    errors.push(
      'The definition must project a `logical_key` column. The rest of the output contract is not settled yet.',
    )
  }
  if (trimmed && !buckets.length) {
    errors.push(
      'No source table was recognized. A definition selects from the substrate tables of buckets your workspace holds.',
    )
  }
  for (const b of outOfReach) {
    errors.push(
      `Your workspace does not hold s3://${b}, so a definition cannot select from it.`,
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    referencedBuckets: buckets,
    outOfReach,
    sample: null,
  }
}

/**
 * A fixture adapter bound to one workspace.
 *
 * Reads project the stack-wide fixture records through `fixtures.projectVolume`,
 * so a non-owner never receives another workspace's queue or subscriber list --
 * the DEC-52 slice is enforced by the projection rather than by each screen
 * remembering to filter.
 */
export function makeFixtureAdapter(
  workspace: string,
): PublishingAdapter & SubscribingAdapter {
  return {
    async listVolumes(): Promise<Volume[]> {
      return fixtures.volumesFor(workspace)
    },

    async getVolume(id: string): Promise<Volume | null> {
      // `?? null` rather than letting `undefined` through: the port promises
      // `null` for a miss, and callers branch on it as data. Increment 1 keeps no
      // tombstone for a retired product (UNK-C3), so a retired product and a typo
      // are indistinguishable here -- and the overview says exactly that.
      return fixtures.volumeFor(workspace, id) ?? null
    },

    async listExchange(): Promise<ProductVolume[]> {
      return fixtures.exchangeFor(workspace)
    },

    async activeWorkspace(): Promise<string> {
      return workspace
    },

    async checkDefinition(sql: string, reach: string[]): Promise<DefinitionCheck> {
      return checkDefinition(sql, reach)
    },

    // -------------------------------------------------------------------------
    // Writes. Every one is honestly unavailable; see the file header.
    // -------------------------------------------------------------------------

    async designate() {
      return unavailable('DESIGNATE')
    },
    async revise() {
      return unavailable('REVISE')
    },
    async updateMetadata() {
      return unavailable('UPDATE_METADATA')
    },
    async publish() {
      return unavailable('PUBLISH')
    },
    async unpublish() {
      return unavailable('UNPUBLISH')
    },
    async approve() {
      return unavailable('APPROVE')
    },
    async reject() {
      return unavailable('REJECT')
    },
    async revoke() {
      return unavailable('REVOKE')
    },
    async subscribe() {
      return unavailable('SUBSCRIBE')
    },
    async unsubscribe() {
      return unavailable('UNSUBSCRIBE')
    },
  }
}
