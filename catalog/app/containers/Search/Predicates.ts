import * as dateFns from 'date-fns'
import * as Eff from 'effect'
import { Schema as S } from 'effect'

import { JsonRecord, Json } from 'utils/types'

export interface PredicateIO<Tag extends string, State extends JsonRecord> {
  tag: Tag
  state: S.Schema<State>
  empty: State
  str: S.Schema<State, string>
}

function make<const Tag extends string, State extends JsonRecord>(input: {
  tag: Tag
  state: S.Schema<State>
  empty: (StateSchema: S.Schema<State>) => State
  str: (StateSchema: S.Schema<State>, empty: State) => S.Schema<State, string>
}): PredicateIO<Tag, State> {
  const state = input.state.annotations({
    title: `${input.tag} predicate state`,
    identifier: `${input.tag}PredicateState`,
  })
  const empty = input.empty(state)
  const str = input.str(state, empty)
  return {
    tag: input.tag,
    state,
    empty,
    str,
  }
}

const fromJsonStringWithDefault = <A extends Json>(a: S.Schema<A>, fallback: A) => {
  const aFromString = S.compose(S.parseJson(), a)
  return S.transform(S.String, a, {
    encode: (toI) => Eff.pipe(toI, S.encodeSync(aFromString)),
    decode: (fromA) =>
      Eff.pipe(
        fromA,
        S.decodeOption(aFromString),
        Eff.Option.getOrElse(() => fallback),
      ),
  })
}

const NumberRange = make({
  tag: 'Number',
  state: S.Struct({
    gte: S.optional(S.Number),
    lte: S.optional(S.Number),
  }),
  empty: (schema) => S.decodeSync(schema)({}),
  str: (schema) => {
    // Aux: backwards-compatible representation of query string param
    const aux = S.Struct({
      gte: S.optional(S.NullOr(S.Number)),
      lte: S.optional(S.NullOr(S.Number)),
    })
    // State <-> Aux
    const stateFromAux = S.transform(aux, schema, {
      decode: ({ gte, lte }) => {
        let resp = {} as typeof schema.Type
        if (gte != null) resp = { ...resp, gte }
        if (lte != null) resp = { ...resp, lte }
        return resp
      },
      encode: ({ gte, lte }) => ({ gte: gte ?? null, lte: lte ?? null }),
    })
    // Aux <-> String
    const auxFromString = fromJsonStringWithDefault(aux, {})
    // State <-> String
    return S.compose(auxFromString, stateFromAux)
  },
})

export { NumberRange as Number }

export const Text = make({
  tag: 'Text',
  state: S.Struct({
    queryString: S.optional(S.String),
  }),
  empty: (schema) => S.decodeSync(schema)({}),
  str: (schema) =>
    S.transform(S.String, schema, {
      encode: (toI) => (toI.queryString ?? '').trim(),
      decode: (fromA) => ({ queryString: fromA.trim() }),
    }),
})

export const KeywordEnum = make({
  tag: 'KeywordEnum',
  state: S.Struct({
    terms: S.optional(S.Array(S.String)),
  }),
  empty: (schema) => S.decodeSync(schema)({}),
  str: (schema) => {
    const aux = S.Array(S.String)
    const stateFromAux = S.transform(aux, schema, {
      decode: (terms) => ({ terms }),
      encode: ({ terms }) => terms ?? [],
    })
    const auxFromString = fromJsonStringWithDefault(aux, [])
    const auxFromProcessedString = S.transform(S.String, auxFromString, {
      encode: (toI) => toI.slice(1, -1),
      decode: (fromA) => `[${fromA}]`,
    })
    return S.compose(auxFromProcessedString, stateFromAux)
  },
})

const STRICT_MARKER = '$s$:'

export const KeywordWildcard = make({
  tag: 'KeywordWildcard',
  state: S.Struct({
    wildcard: S.optional(S.String),
    strict: S.optional(S.Boolean),
  }),
  empty: (schema) => S.decodeSync(schema)({}),
  str: (schema) =>
    S.transform(S.String, schema, {
      encode: ({ wildcard, strict }) => (strict ? STRICT_MARKER : '') + (wildcard ?? ''),
      decode: (wildcard) => {
        const strict = wildcard.startsWith(STRICT_MARKER)
        if (strict) wildcard = wildcard.slice(STRICT_MARKER.length)
        return { wildcard, strict }
      },
    }),
})

export const Boolean = make({
  tag: 'Boolean',
  state: S.Struct({
    true: S.optional(S.Boolean),
    false: S.optional(S.Boolean),
  }),
  empty: (schema) => S.decodeSync(schema)({}),
  str: (schema) =>
    S.transform(S.String, schema, {
      encode: (toI) => {
        const values = []
        if (toI.true) values.push('true')
        if (toI.false) values.push('false')
        return values.join(',')
      },
      decode: (fromA) => {
        const values = fromA.split(',')
        return { true: values.includes('true'), false: values.includes('false') }
      },
    }),
})

const ISODateString = S.String.pipe(
  S.filter((s) => !Number.isNaN(dateFns.parseISO(s).getTime()), {
    description: 'ISO date string',
    jsonSchema: { format: 'date-time' },
  }),
)

export const Datetime = make({
  tag: 'Datetime',
  state: S.Struct({
    // XXX: fallback if string is not a valid date?
    gte: S.optional(ISODateString),
    lte: S.optional(ISODateString),
  }),
  empty: (schema) => S.decodeSync(schema)({}),
  str: (schema) => {
    const aux = S.Struct({
      gte: S.optional(S.NullOr(S.String)),
      lte: S.optional(S.NullOr(S.String)),
    })
    const stateFromAux = S.transform(aux, schema, {
      decode: ({ gte, lte }) => {
        let resp = {} as typeof schema.Type
        if (gte != null) resp = { ...resp, gte }
        if (lte != null) resp = { ...resp, lte }
        return resp
      },
      encode: ({ gte, lte }) => ({ gte: gte ?? null, lte: lte ?? null }),
    })
    const auxFromString = fromJsonStringWithDefault(aux, {})
    return S.compose(auxFromString, stateFromAux)
  },
})

export const KNOWN_PREDICATES = [
  Boolean,
  Datetime,
  KeywordEnum,
  KeywordWildcard,
  NumberRange,
  Text,
]

export type KnownPredicate = (typeof KNOWN_PREDICATES)[number]
