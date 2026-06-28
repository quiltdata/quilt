import invariant from 'invariant'
import * as R from 'ramda'

const scope = 'app/utils/tagged'

// The legacy tagged-union factory is dynamic by design: constructors are
// created from a runtime `variants` array and keyed by variant name, and
// `case`/`mapCase` accept the `_` (default) and `__` (non-instance) placeholders.
// This defeats precise static typing, so the public surface is typed
// conservatively (the dynamic constructors live under the string index
// signature). Precise per-variant inference is provided by the typed successor
// `utils/taggedV2`; migrating call sites to it is tracked separately.

export interface TaggedInstance {
  type: symbol
  value: unknown
}

type AnyFn = (...args: any[]) => any
type Cases = Record<string, AnyFn>

export interface TaggedConstructor {
  (value?: unknown): TaggedInstance
  is(inst: unknown, pred?: (value: any) => boolean): boolean
  unbox(inst: unknown): any
}

export interface TaggedUnion {
  is(inst: unknown): boolean
  // Curried when called with cases only, eager when called with an instance —
  // both forms collapse to `any` since the legacy union is not statically typed.
  case(cases: Cases, ...args: any[]): any
  mapCase(cases: Cases, ...args: any[]): any
  reducer(cases: Cases): (acc: any, next: unknown) => any
  // dynamically-created variant constructors (e.g. Ok, Err, …) and any props
  // attached by consumers (e.g. AsyncResult.prop)
  [key: string]: any
}

const withValue =
  (fn: AnyFn) =>
  (inst: unknown, ...rest: any[]) =>
    fn((inst as { value: unknown }).value, ...rest)

const exhaustive = (variants: string[], cases: Cases) =>
  cases._ || variants.every((v) => cases[v])

const chooseCase = (cases: Cases, variant: string | undefined): AnyFn => {
  if (!variant) return cases.__
  if (!(variant in cases)) return cases._
  return withValue(cases[variant])
}

export default (variants: string[]): TaggedUnion => {
  invariant(
    R.type(variants) === 'Array' &&
      R.equals(variants, R.uniq(variants)) &&
      variants.every(R.is(String)),
    `${scope}: variants must be an array of unique strings`,
  )
  invariant(
    variants.every((v) => v !== '_' && v !== '__'),
    `${scope}: variants may not contain placeholder strings (_ and __)`,
  )

  const symbols: Record<string, symbol> = R.fromPairs(
    variants.map((str) => [str, Symbol(str)]),
  )

  const variantMap: Record<symbol, string> = R.invertObj(symbols as any) as any

  const getVariant = (inst: unknown): string | undefined => {
    const tag = (inst as { type?: symbol } | null | undefined)?.type
    return tag ? variantMap[tag] : undefined
  }

  const mkConstructor = (tag: symbol, variant: string): TaggedConstructor => {
    const constructor = ((value: unknown) => ({ type: tag, value })) as TaggedConstructor

    constructor.is = (inst: unknown, pred?: (value: any) => boolean) =>
      getVariant(inst) === variant && (pred ? pred(constructor.unbox(inst)) : true)

    constructor.unbox = (inst: unknown) => {
      invariant(
        constructor.is(inst),
        `${scope}/unbox: must be called with an instance of type`,
      )
      return (inst as { value: unknown }).value
    }

    return constructor
  }

  const constructors: Record<string, TaggedConstructor> = R.mapObjIndexed(
    mkConstructor,
    symbols,
  )

  const doCase = (cases: Cases, ...args: any[]) => {
    invariant(
      R.all((x) => typeof x === 'function', R.values(cases)),
      `${scope}/case: cases must be an object of functions`,
    )
    invariant(
      R.all(
        (k: string) => ['_', '__', ...variants].includes(k),
        R.keys(cases) as string[],
      ),
      `${scope}/case: cases may only include type variants and placeholders (_ and __). Unrecognized variants: ${R.without(
        ['_', '__', ...variants],
        R.keys(cases) as string[],
      )}`,
    )
    invariant(exhaustive(variants, cases), `${scope}/case: non-exhaustive cases`)

    const exec = (inst: unknown, ...extra: any[]) => {
      const variant = getVariant(inst)
      if (!cases.__) {
        invariant(
          variant,
          `${scope}/case: must be called with an instance of type, otherwise cases must include the __ placeholder`,
        )
      }
      return chooseCase(cases, variant)(inst, ...extra)
    }

    return args.length ? exec(args[0], ...args.slice(1)) : exec
  }

  return {
    is: (inst: unknown) => !!getVariant(inst),

    case: doCase,

    mapCase: (cases: Cases, ...args: any[]) => {
      invariant(
        !Object.keys(cases).includes('_') && !Object.keys(cases).includes('__'),
        `${scope}/mapCase: cases should not include placeholders (_ and __)`,
      )
      return doCase(
        {
          ...R.mapObjIndexed(
            (fn: AnyFn, variant: string) => R.pipe(fn, constructors[variant]),
            cases,
          ),
          _: R.identity,
        },
        ...args,
      )
    },

    reducer: (cases: Cases) => (acc: any, next: unknown) => doCase(cases, next)(acc),

    ...constructors,
  }
}
