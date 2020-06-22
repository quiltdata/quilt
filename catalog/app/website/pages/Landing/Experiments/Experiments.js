import * as R from 'ramda'
import * as React from 'react'

import useConstant from 'utils/useConstant'

const Ctx = React.createContext()

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

// variants: map of experiment name to array of variants
export function ExperimentsProvider({ variants, children }) {
  const selected = useConstant(() => {
    // choose random variant for every experiment
    const sel = R.map(pickRandom, variants)
    // TODO: save as mixpanel user data
    return sel
  })

  // eslint-disable-next-line no-underscore-dangle
  const get = React.useCallback(R.prop(R.__, selected), [selected])

  return <Ctx.Provider value={get}>{children}</Ctx.Provider>
}

export function useExperiments(experiment) {
  const get = React.useContext(Ctx)
  return experiment ? get(experiment) : get
}

export { ExperimentsProvider as Provider, useExperiments as use }
