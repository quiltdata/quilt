import invariant from 'invariant'
import * as R from 'ramda'

const scope = 'app/utils/tagged'

const TAG = Symbol('tag')
const VALUE = Symbol('value')

const getTag = (inst) => (inst ? inst[TAG] : undefined)

const getValue = (inst) => (inst ? inst[VALUE] : undefined)

const withValue = (fn) => (inst, ...rest) => fn(getValue(inst), ...rest)

const exhaustive = (variants, cases) => cases._ || variants.every((v) => cases[v])

const chooseCase = (cases, variant) => {
  if (!variant) return cases.__ // eslint-disable-line no-underscore-dangle
  if (!(variant in cases)) return cases._ // eslint-disable-line no-underscore-dangle
  return withValue(cases[variant])
}

/**
 * Create a tagged union constructor.
 *
 * @param {[string]} variants
 *
 * @returns {TaggedUnionType}
 */
export default (variants) => {
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

  const symbols = R.fromPairs(variants.map((str) => [str, Symbol(str)]))

  const variantMap = R.invertObj(symbols)

  const getVariant = (inst) => {
    const tag = getTag(inst)
    return tag && variantMap[tag]
  }

  const mkConstructor = (tag, variant) => {
    const constructor = (value) => ({ [TAG]: tag, [VALUE]: value, type: tag })

    constructor.is = (inst, pred) =>
      getVariant(inst) === variant && (pred ? pred(constructor.unbox(inst)) : true)

    constructor.unbox = (inst) => {
      invariant(
        constructor.is(inst),
        `${scope}/unbox: must be called with an instance of type`,
      )
      return getValue(inst)
    }

    return constructor
  }

  const constructors = R.mapObjIndexed(mkConstructor, symbols)

  const doCase = (cases, ...args) => {
    invariant(
      R.all((x) => typeof x === 'function', cases),
      `${scope}/case: cases must be an object of functions`,
    )
    invariant(
      // eslint-disable-next-line no-underscore-dangle
      R.all(R.contains(R.__, ['_', '__', ...variants]), R.keys(cases)),
      `${scope}/case: cases may only include type variants and placeholders (_ and __)`,
    )
    invariant(exhaustive(variants, cases), `${scope}/case: non-exhaustive cases`)

    const exec = (inst, ...extra) => {
      const variant = getVariant(inst)
      // eslint-disable-next-line no-underscore-dangle
      if (!cases.__) {
        invariant(
          variant,
          `${scope}/case: must be called with an instance of type, otherwise cases must include the __ placeholder`,
        )
      }
      return chooseCase(cases, variant)(inst, ...extra)
    }

    return args.length ? exec(...args) : exec
  }

  return {
    is: (inst) => !!getVariant(inst),

    /**
     *
     */
    case: doCase,

    /**
     *
     */
    reducer: (cases) => (acc, next) => doCase(cases, next)(acc),

    // TODO: mapCase
    ...constructors,
  }
}
