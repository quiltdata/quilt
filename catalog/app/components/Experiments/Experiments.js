import * as R from 'ramda'
import * as React from 'react'

// TODO: ensure proper variants
// map of experiment name to array of variants
const EXPERIMENTS = {
  cta: ['Ready to synchronize your data?'],
  lede: [
    'Maximize your return on data by managing data like code',
    'Experiment faster by managing data like code',
  ],
}

const Ctx = React.createContext()

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

const mapKeys = (fn) =>
  R.pipe(
    R.toPairs,
    R.map(([k, v]) => [fn(k, v), v]),
    R.fromPairs,
  )

export function ExperimentsProvider({ children }) {
  const ref = React.useRef({})

  const get = React.useCallback(
    (name) => {
      if (!(name in ref.current)) {
        ref.current[name] = pickRandom(EXPERIMENTS[name])
      }
      return ref.current[name]
    },
    [ref.current],
  )

  const getSelectedVariants = React.useCallback(
    (prefix = '') => mapKeys((k) => `${prefix}${k}`)(ref.current),
    [ref.current],
  )

  return <Ctx.Provider value={{ get, getSelectedVariants }}>{children}</Ctx.Provider>
}

export function useExperiments(experiment) {
  const exps = React.useContext(Ctx)
  return experiment ? exps.get(experiment) : exps
}

export { ExperimentsProvider as Provider, useExperiments as use }
