import * as Eff from 'effect'
import { Schema as S } from 'effect'

import * as Nav from 'utils/Navigation'

import * as Predicates from './Predicates'
import { META_PREFIX } from './model'

type TaggedPredicate<P extends Predicates.KnownPredicate> = {
  type: P['tag']
  value: P['state']['Type']
}

// XXX: distribute types?
const KNOWN_PREDICATES_TAGGED = Predicates.KNOWN_PREDICATES.map(
  (p) =>
    S.Struct({
      type: S.Literal(p.tag),
      value: p.state,
    }).annotations({
      identifier: `${p.tag}TaggedPredicate`,
    }) as S.Schema<TaggedPredicate<typeof p>>,
)

const EntrySchema = S.Struct({
  path: S.String,
  predicate: S.Union(...KNOWN_PREDICATES_TAGGED),
})

export const UserMetaFiltersSchema = S.Array(EntrySchema)

const TYPE_MAP = {
  d: Predicates.Datetime,
  n: Predicates.Number,
  t: Predicates.Text,
  e: Predicates.KeywordEnum,
  w: Predicates.KeywordWildcard,
  b: Predicates.Boolean,
}

const REVERSE_TYPE_MAP = {
  [Predicates.Datetime.tag]: 'd',
  [Predicates.Number.tag]: 'n',
  [Predicates.Text.tag]: 't',
  [Predicates.KeywordEnum.tag]: 'e',
  [Predicates.KeywordWildcard.tag]: 'w',
  [Predicates.Boolean.tag]: 'b',
}

const PREDICATE_TYPE_MAP = {
  [Predicates.Datetime.tag]: Predicates.Datetime,
  [Predicates.Number.tag]: Predicates.Number,
  [Predicates.Text.tag]: Predicates.Text,
  [Predicates.KeywordEnum.tag]: Predicates.KeywordEnum,
  [Predicates.KeywordWildcard.tag]: Predicates.KeywordWildcard,
  [Predicates.Boolean.tag]: Predicates.Boolean,
}

// key format: $prefix$type$path
export const fromSearchParams = S.transform(Nav.SearchParams, UserMetaFiltersSchema, {
  strict: true,
  // qs to json api
  decode: Eff.flow(
    Eff.Record.toEntries,
    Eff.Array.filterMap(([key, values]) =>
      Eff.Option.gen(function* () {
        const value = yield* Eff.Array.last(values)

        if (!key.startsWith(META_PREFIX)) return yield* Eff.Option.none()

        const withoutPrefix = key.slice(META_PREFIX.length)
        const idx = withoutPrefix.indexOf('/')
        if (idx === -1) return yield* Eff.Option.none()

        const path = withoutPrefix.slice(idx)
        const typeAbbr = withoutPrefix.slice(0, idx)
        const pio = yield* Eff.Record.get(TYPE_MAP, typeAbbr as any)

        // @ts-expect-error
        const decoded = yield* S.decodeOption(pio.str)(value)

        return { path, predicate: { type: pio.tag, value: decoded } }
      }),
    ),
  ),
  // json api to qs
  encode: Eff.flow(
    Eff.Array.reduce({}, (acc, { path, predicate: { type, value } }) =>
      Eff.pipe(
        // @ts-expect-error
        value,
        // @ts-expect-error
        S.encodeOption(PREDICATE_TYPE_MAP[type].str),
        Eff.Option.match({
          onNone: () => acc,
          onSome: (s) => ({
            ...acc,
            [`${META_PREFIX}${REVERSE_TYPE_MAP[type]}${path}`]: [s],
          }),
        }),
      ),
    ),
  ),
})
